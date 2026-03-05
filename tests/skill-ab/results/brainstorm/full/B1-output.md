# Brainstorm: Caching Layer for dev_memory MCP Tool

**Date**: 2026-03-06
**Task**: Explore options for caching to reduce SQLite hits on every query
**Simulated user choice**: Balanced option

---

## CLARIFY

**Socratic question I would ask first:**

> What's driving the concern — is this about latency (queries feel slow) or about resource pressure (too many sqlite3 subprocess spawns)?

*(Simulated user answer: Latency. Each MCP call spawns a `sqlite3` CLI process via `execSync`. On queries that run during SessionStart context injection, this is noticeable.)*

**Follow-up question:**

> Which call paths are hottest? Multiple choice:
> A. SessionStart context injection (`injectKnowledgeContext` / `syncToMemoryMd`) — runs once per session
> B. Interactive `dev_memory(action="search")` — runs on brainstorm/commit/review
> C. Both roughly equally

*(Simulated user answer: A is the worst offender — it fires 3+ SQLite queries at session start. B is secondary.)*

---

## EXPLORE

### Constraints Identified from Code

| Constraint | Detail |
|------------|--------|
| Runtime model | MCP server is a long-lived Node.js process (`scripts/mcp-server.cjs`) — in-process cache is valid |
| Existing cache infra | `toolCache` Map already exists in `index.ts` with TTL pattern (`getCached`) — reusable |
| SQLite access | Via `execSync('sqlite3 ...')` child process — each call is ~5-30ms cold fork overhead |
| Call sites | `memorySearch`, `memoryQuery`, `memoryGet`, `memoryList` in `memory.ts` + 3 functions in `context-injector.ts` |
| Data volatility | Vault data changes only on `memorySave` / `reindexVault` — reads vastly outnumber writes |
| Process lifetime | MCP server lives for the duration of the Claude Code session — cache doesn't need persistence |
| No external dependencies | Project avoids adding npm dependencies for things achievable in-process |

### Users

- **Claude (agent)**: Calls `dev_memory(search)` before brainstorming, before commit (pitfall check hook), during review
- **SessionStart hook**: Calls `injectKnowledgeContext()` once at session start — cold path, most painful
- **Human via `/dev memory`**: Rare, direct, latency-tolerant

### Success Criteria

- Session start latency reduced (target: 3 SQLite calls → 0-1 on repeat invocations)
- No stale data visible: cache must invalidate on `save` / `reindex`
- No new npm dependencies
- No behavioral change for `save` / `prune` / `reindex` actions (always hit DB)

### Risks

- Cache returning stale results after vault write (invalidation bug)
- Memory pressure if result sets grow large (unlikely — entries capped at 50, results at 10)
- Process restart wipes cache (acceptable — process lives for session)

---

## GENERATE

### Option A — Conservative: Extend Existing `toolCache` to Memory Reads

**Core idea**: The `toolCache` Map already caches `project`, `git`, `quality` reads with TTL. Add `memory_search_{hash}`, `memory_list_{type}`, `memory_pitfalls_{platform}` keys with a moderate TTL (30s). Invalidate entire memory cache namespace on `save`/`reindex`.

Implementation touch points:
- `index.ts`: wrap `memoryTool` branches for `search`, `query`, `list` with `getCached`
- `memory.ts`: expose an `invalidateCache()` function called after `memorySave` / `reindexVault`
- Cache key: `memory_search_${hash(query+type+limit)}`

| Pros | Cons |
|------|------|
| Zero new infrastructure — reuses `getCached` already in `index.ts` | Cache lives in `index.ts`, memory module stays unaware |
| TTL-based expiry needs no explicit invalidation per write | Requires passing cache-bust signal from `memory.ts` up to `index.ts` (cross-layer coupling) |
| Trivial to test | TTL means up to 30s stale window unless invalidation is wired up |

- **Complexity**: Low
- **Risk**: Low-Medium (stale window if invalidation not wired)
- **Flexibility**: Low (query-level cache only; context-injector still hits DB directly)

---

### Option B — Balanced: In-Module Query Cache with Write Invalidation

**Core idea**: Add a lightweight query result cache *inside* `memory.ts` — a `Map<string, {results, timestamp}>`. Cache `memorySearch`, `memoryQuery`, `memoryList`, and the three `context-injector.ts` functions (`loadPlatformPitfalls`, `queryKnowledgeFts`, `loadRecentDiscoveries`). Any write operation (`memorySave`, `reindexVault`, `memoryPrune`) calls `invalidateMemoryCache()`.

Implementation:

```typescript
// memory.ts
const queryCache = new Map<string, { data: unknown; ts: number }>();
const MEMORY_CACHE_TTL = 60_000; // 1 min fallback

function cacheGet<T>(key: string): T | undefined {
  const entry = queryCache.get(key);
  if (entry && Date.now() - entry.ts < MEMORY_CACHE_TTL) return entry.data as T;
  return undefined;
}

function cacheSet(key: string, data: unknown): void {
  queryCache.set(key, { data, ts: Date.now() });
}

export function invalidateMemoryCache(): void {
  queryCache.clear();
}
```

Wrap existing functions:

```typescript
export function memorySearch(query: string, limit = 10, type?: string) {
  const key = `search:${query}:${limit}:${type}`;
  const cached = cacheGet<ReturnType<typeof memorySearch>>(key);
  if (cached) return cached;
  // ... existing execSync logic ...
  cacheSet(key, results);
  return results;
}
```

Call `invalidateMemoryCache()` at the end of `memorySave`, `reindexVault`, and `memoryPrune`.

Apply same pattern in `context-injector.ts` for the 3 DB-hitting functions — or have them call the cached `memorySearch`/`memoryQuery` internally.

| Pros | Cons |
|------|------|
| Cache lives next to data — self-contained module | `context-injector.ts` has its own raw SQL, needs parallel treatment |
| Exact invalidation on write — no stale window | Must ensure every write path calls `invalidateMemoryCache()` |
| No TTL stale window for normal usage | Module-level Map means one cache per Node.js process (correct for MCP server) |
| Trivially extensible to `memoryGet` | Slightly more code than Option A |

- **Complexity**: Medium-Low
- **Risk**: Low
- **Flexibility**: Medium (covers all read paths; invalidation is deterministic)

---

### Option C — Aggressive: Structured Read-Through Cache + DB Dirty Flag

**Core idea**: Replace all direct `execSync('sqlite3 ...')` in `memory.ts` and `context-injector.ts` with a `MemoryCache` class that maintains a full in-memory snapshot of the `knowledge` table. On first access it loads all rows; subsequent reads are pure JS Map lookups. Writes go directly to SQLite and update the in-memory snapshot atomically. FTS scoring is approximated in-process.

| Pros | Cons |
|------|------|
| Zero SQLite process spawns after initial load | Reimplements FTS5 rank scoring in JS (approximation, not identical) |
| Instant read latency | Must load all rows at startup — slow first call |
| Full control over eviction | Significantly more code; risk of drift between SQLite and in-memory state |

- **Complexity**: High
- **Risk**: High (FTS5 parity, snapshot consistency)

---

### Option D — Hybrid: Option B + Structured Cache for Context Injector

**Core idea**: Apply Option B (in-module cache) to `memory.ts`, AND refactor `context-injector.ts` to call `memorySearch`/`memoryQuery` instead of raw SQL — so the context injector benefits from the same cache transparently.

This is the natural evolution of B: eliminate the duplicated raw-SQL code in `context-injector.ts` and route through the shared cached functions.

| Pros | Cons |
|------|------|
| Solves the worst pain point (SessionStart 3 DB calls → 0 on second start) | Requires refactoring context-injector.ts SQL to use public API |
| Single invalidation point | More files touched than pure Option B |
| Removes code duplication (raw SQL in two files) | |

- **Complexity**: Medium
- **Risk**: Low-Medium

---

## EVALUATE

| Criteria (weight) | A: toolCache extend | B: In-module cache | C: Full snapshot | D: B + injector refactor |
|-------------------|--------------------|--------------------|-----------------|--------------------------|
| **Complexity (30%)** | 9/10 | 7/10 | 3/10 | 6/10 |
| **Risk (25%)** | 6/10 (stale TTL) | 9/10 | 4/10 | 8/10 |
| **Flexibility (20%)** | 5/10 | 7/10 | 9/10 | 8/10 |
| **Time to deliver (15%)** | 9/10 | 7/10 | 2/10 | 6/10 |
| **Maintainability (10%)** | 6/10 | 8/10 | 5/10 | 9/10 |
| **Weighted score** | **7.05** | **7.65** | **4.05** | **7.45** |

Scoring rationale:
- A scores lower on risk because TTL without write-invalidation means up to 30s of stale results visible to the agent, which could cause commit hooks to miss a newly saved pitfall.
- B scores highest because it directly addresses invalidation, lives near the data, and requires minimal new code.
- C is rejected (YAGNI — FTS5 reimplementation is not justified for a session-local cache).
- D is close to B but requires touching context-injector.ts which adds scope. Worth noting as the natural follow-on once B is stable.

---

## DECIDE

**Chosen approach: Option B — In-Module Query Cache with Write Invalidation**

Rationale:
- Highest weighted score (7.65)
- Self-contained: cache logic lives in `memory.ts` next to the data operations
- Deterministic invalidation: `memorySave`, `reindexVault`, `memoryPrune` explicitly clear the cache — no stale window
- Reuses the TTL fallback pattern already established in `index.ts` (`getCached`)
- No new dependencies
- Context injector stays unchanged initially; Option D can be a follow-on PR once this is proven

Key implementation decisions:
1. Cache is a module-level `Map<string, {data, ts}>` (not exported — internal)
2. TTL = 60s (fallback safety in case a write path is missed)
3. `invalidateMemoryCache()` is exported and called at the end of every write function
4. Cache keying: `{action}:{query}:{limit}:{type}` — simple string concat, no hashing needed at this scale
5. `memoryGet` is also cached (key: `get:${ids.sort().join(',')}`) since it reads vault files via `readFileSync`

Scope (files to touch):
- `/dev-flow/mcp-server/src/continuity/memory.ts` — add cache Map + `cacheGet/cacheSet/invalidateMemoryCache`, wrap `memorySearch`, `memoryQuery`, `memoryList`, `memoryGet`
- `/dev-flow/mcp-server/src/continuity/memory.test.ts` — add cache invalidation tests
- No changes to `index.ts`, `context-injector.ts`, or any other file

---

## PERSIST

*In a real session this would call `dev_handoff(action='write', ...)` to save decisions. Recorded here inline:*

```
agent_id: brainstorm
task_id: dev-memory-cache
status: success
decisions:
  approach: "Option B — in-module Map cache in memory.ts"
  invalidation: "explicit clear on memorySave/reindexVault/memoryPrune"
  ttl: "60s fallback"
  cache_scope: "memorySearch, memoryQuery, memoryList, memoryGet"
  deferred: "Option D (context-injector refactor) as follow-on"
for_next_agent: "Create implementation plan: add queryCache Map to memory.ts, wrap 4 read functions, export invalidateMemoryCache, add tests"
```

---

## Appendix: Current Hot Path Analysis

From code reading:

| Call site | SQLite calls per invocation | Frequency |
|-----------|----------------------------|-----------|
| `injectKnowledgeContext()` (SessionStart) | 3 (`loadPlatformPitfalls` + `queryKnowledgeFts` + `loadRecentDiscoveries`) | Once per session |
| `syncToMemoryMd()` (called inside above) | Same 3 queries duplicated | Once per session |
| `memorySearch()` (commit hook pitfall check) | 1 + 1 (expand + search) + 1 (update access_count) | Every git commit |
| `dev_memory(action="search")` (brainstorm) | 1 + 1 + 1 | Per brainstorm session |
| `expandQuery()` in each search | 1 per query term for synonym lookup | Embedded in above |

The synonym expansion (`expandQuery`) alone does 1 `execSync` per query term. For a 3-term query that's 3 additional subprocesses. Caching `expandQuery` results is a bonus win from Option B if we cache at the `memorySearch` layer (the expanded query is part of the cache key's input, so it gets cached as a side effect).
