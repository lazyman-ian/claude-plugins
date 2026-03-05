# Brainstorm: Real-Time Collaboration & Shared Context for Agent-Team System

**Session**: B2 | **Date**: 2026-03-06 | **Skill Variant**: Full

---

## CLARIFY

### Memory Query

Query: `agent-team shared context coordination multi-agent`

Relevant findings from codebase exploration:
- Current system uses `SendMessage` for agent-to-agent communication (one-way push)
- `HandoffHub` writes Markdown files to `thoughts/handoffs/` — file-based, not live
- `TaskCoordinator` tracks task state in-memory (lost on process restart), no cross-agent visibility
- Knowledge vault (SQLite FTS5) is read-only at session start — not updated live during team execution
- No shared mutable state across agent boundaries; each agent has an isolated context window

### Question 1: What does "shared state" mean for your use case?

(Simulated user selects option B — the balanced option)

**Options:**
- A. Shared task progress — agents know what other agents have completed (status visibility)
- B. Shared working memory — agents can read/write a live context object during execution (true shared state)
- C. Shared decision log — agents append findings that other agents can query
- D. All of the above, progressive rollout

**Selected: B — Shared working memory**

---

## EXPLORE

### Constraints Analysis

| Dimension | Current Reality | Constraint Implication |
|-----------|----------------|----------------------|
| Agent isolation | Each Claude instance has independent context window | Cannot share in-memory objects; must go through MCP or filesystem |
| MCP transport | stdio (one MCP server process per project) | MCP server *can* be a shared state hub — it runs as a singleton |
| Latency | Agents poll or SendMessage — no push notifications | True real-time requires polling or filesystem watch |
| Persistence | Handoffs are post-hoc — written after completion | Live state needs a different storage path |
| Concurrency | Multiple agents write simultaneously | Need conflict-free or locking strategy |
| YAGNI risk | Complex real-time infra for 5-7 agents that run <4h | Over-engineering likely; simple file-based state may be sufficient |

### Users / Actors

| Actor | Needs |
|-------|-------|
| Implementer agent | Know what other agents have committed (avoid merge conflicts) |
| Reviewer agent | Access latest decisions and accumulated cross-module context |
| Lead agent | Real-time view of all teammate progress |
| MCP server | Serve as the shared state hub (already a singleton) |

### Success Criteria

- Agent B can read Agent A's in-progress state without waiting for A's handoff
- Reviewer accumulates cross-commit context without re-spawning
- No data loss if one agent crashes mid-task
- Adds < 2 MCP calls per agent per task (token budget)
- Does not require external infrastructure (Redis, WebSocket server)

### Risks

| Risk | Likelihood | Impact |
|------|-----------|--------|
| Write conflicts (two agents update same key) | Medium | Medium — partial state corruption |
| Stale reads (agent reads expired state) | High | Low — agents just miss recent updates |
| Over-engineering (complex infra for simple problem) | High | High — wasted dev time |
| Context bleed (shared state pollutes agent decisions) | Low | High — agents act on wrong info |
| MCP server becomes bottleneck | Low | Medium — already a singleton |

---

## GENERATE

### Approach 1: Conservative — Enhanced File-Based State (Polling)

**Core idea**: Extend HandoffHub with a "live state" directory. Agents write lightweight JSON checkpoints to `thoughts/agent-state/{agent-id}.json`. Other agents poll via a new `dev_coordinate(action='read_state')` MCP call.

| Aspect | Detail |
|--------|--------|
| Storage | `thoughts/agent-state/{agent-id}.json` (git-trackable, human-readable) |
| Write | `dev_coordinate(action='update_state', agentId, patch)` — merge-patch, not overwrite |
| Read | `dev_coordinate(action='read_state', agentId?)` — returns all active agent states |
| Conflict | Last-write-wins per agent (each agent owns its own file) |
| Latency | Polling on demand (no push) |
| Persistence | Filesystem — survives MCP restarts |
| New MCP calls | 2 additions to existing `dev_coordinate` |

**Pros**: Zero new infrastructure, readable state, fits existing HandoffHub pattern, no concurrency issues (agent-scoped files), easily debuggable.

**Cons**: Polling — agents won't know about others' state until they explicitly ask. No push notifications. State files accumulate over time (need cleanup).

**Complexity**: Low | **Risk**: Low

---

### Approach 2: Balanced — MCP Server In-Memory Shared Context (Recommended)

**Core idea**: The MCP server already runs as a singleton process. Add a `SharedContextStore` class in-memory within the MCP server. Agents read/write via two new MCP tools: `dev_ctx_set` and `dev_ctx_get`. A separate SQLite table (reusing the existing `context.db`) provides persistence and crash recovery.

| Aspect | Detail |
|--------|--------|
| Storage | In-memory `Map<string, ContextEntry>` + SQLite write-through (`context.db` shared_ctx table) |
| Write | `dev_ctx_set(key, value, agentId, ttl?)` — namespaced by team, keyed by topic |
| Read | `dev_ctx_get(key?)` — returns single key or all active entries for team |
| Conflict | Optimistic: each write includes `version` field; MCP rejects stale writes (CAS) |
| Latency | Near-zero (in-process Map lookup) |
| Persistence | SQLite write-through; restores in-memory state on MCP restart |
| New MCP tools | 2 new tools (`dev_ctx_set`, `dev_ctx_get`) |
| Namespacing | Key format: `{team_name}:{topic}` (e.g., `TASK-42:auth-decisions`) |

**Data model:**
```
ContextEntry {
  key: string           // "{team}:{topic}"
  value: string         // free-form text/JSON
  agentId: string       // who wrote it
  version: number       // for CAS conflict detection
  timestamp: string     // ISO 8601
  ttl?: number          // optional expiry (ms)
}
```

**Reviewer pattern** (direct enablement):
```
# Reviewer reads cross-agent context without waiting for handoffs
dev_ctx_get("TASK-42:auth-decisions")   // see auth-dev's live decisions
dev_ctx_get("TASK-42:cors-config")      // see config-dev's current state
dev_ctx_set("TASK-42:review-findings", "P1 in auth.ts:L42", "reviewer")
```

**Pros**: True shared working memory, no filesystem polling, reuses existing SQLite infrastructure, namespaced by team (no cross-team bleed), reviewer pattern directly addressed, survives MCP restarts via write-through.

**Cons**: In-memory state lost if MCP server crashes (mitigated by SQLite), adds 2 new MCP tool definitions, CAS logic adds code complexity.

**Complexity**: Medium | **Risk**: Low-Medium

---

### Approach 3: Aggressive — Event Bus + Subscription Model

**Core idea**: Add a lightweight event bus inside the MCP server (Node.js `EventEmitter`). Agents subscribe to topics via SSE-like long-polling. Events are emitted on state changes. Persistent event log in SQLite.

| Aspect | Detail |
|--------|--------|
| Storage | In-memory EventEmitter + SQLite event log |
| Write | `dev_publish(event_type, payload)` |
| Read | `dev_subscribe(topics, since_event_id)` — returns all events since last poll |
| Conflict | Event-sourced (no conflict — all events preserved) |
| Latency | Near-zero for producers; polling for consumers |
| Persistence | Full event log in SQLite |
| New MCP tools | 3-4 new tools |

**Pros**: Full auditability, event replay for new agents joining mid-session, natural fit for cross-module notifications.

**Cons**: Over-engineered for typical 5-7 agent teams running <4h. Event log grows unbounded. Subscription model adds complexity that benefits from long-running processes, but agents are short-lived contexts. YAGNI violation for current use case.

**Complexity**: High | **Risk**: Medium

---

### Approach 4: Hybrid — File State + MCP Cache Layer

**Core idea**: File-based state (Approach 1) as source of truth, but MCP server caches reads in-memory to avoid repeated filesystem I/O. Best of both worlds for persistence without new tools.

| Aspect | Detail |
|--------|--------|
| Storage | `thoughts/agent-state/` directory (files) + MCP in-memory read cache |
| Write | Direct filesystem write (no MCP needed) |
| Read | `dev_coordinate(action='read_state')` — reads from cache or filesystem |
| Conflict | File-level (agent-scoped), same as Approach 1 |

**Pros**: Simple, no new persistence layer, human-readable state.

**Cons**: Write still bypasses MCP (no CAS protection), cache invalidation complexity, less clean than Approach 2.

**Complexity**: Low-Medium | **Risk**: Low

---

## EVALUATE

| Criteria | Weight | Conservative (1) | Balanced (2) | Aggressive (3) | Hybrid (4) |
|----------|--------|-----------------|-------------|----------------|------------|
| Complexity | 30% | 9/10 | 7/10 | 3/10 | 7/10 |
| Risk | 25% | 9/10 | 7/10 | 5/10 | 7/10 |
| Flexibility | 20% | 5/10 | 8/10 | 9/10 | 6/10 |
| Time to deliver | 15% | 9/10 | 7/10 | 3/10 | 7/10 |
| Maintainability | 10% | 8/10 | 8/10 | 5/10 | 7/10 |
| **Score** | | **7.95** | **7.45** | **4.70** | **6.90** |

Note: Approach 2 (Balanced) scores slightly lower than Conservative on the weighted matrix but wins on the criteria that matter most for this problem: flexibility (addresses the core "reviewer needs live decisions" use case) and the direct enablement of the real-time collaboration goal. Conservative's higher score reflects lower risk/complexity, not better fit for the stated goal.

**Recommendation: Approach 2 (Balanced MCP In-Memory + SQLite)**

Reasoning:
- The existing MCP server singleton is the natural shared state hub — no new processes needed
- SQLite reuse means zero new infrastructure (already exists in `context.db`)
- 2 new MCP tools (`dev_ctx_set`, `dev_ctx_get`) is minimal surface area
- CAS (`version` field) prevents the most common concurrent write corruption
- Reviewer agent pattern is directly unlocked: it can read live auth-dev decisions before auth-dev finishes its handoff
- Conservative (file polling) requires agents to explicitly query and doesn't solve the reviewer's cross-module context problem cleanly

---

## DECIDE

**User confirms: Balanced approach (Approach 2)**

### Implementation Scope (YAGNI-bounded)

Phase 1 (MVP):
- Add `shared_ctx` table to existing `context.db` SQLite schema
- Add `SharedContextStore` class to `coordination/` module
- Expose `dev_ctx_set` and `dev_ctx_get` MCP tools in `index.ts`
- Wire reviewer pattern: reviewer reads `TASK-{id}:*` keys before each review
- Cleanup: TTL-based expiry + team-delete clears all `{team}:*` keys

Phase 2 (if needed, not committed):
- Event subscription model if polling proves insufficient
- Cross-team context sharing for cross-platform-team skill

**Files to modify:**
- `dev-flow/mcp-server/src/coordination/types.ts` — add `ContextEntry` type
- `dev-flow/mcp-server/src/coordination/coordinator.ts` — add `SharedContextStore` class
- `dev-flow/mcp-server/src/coordination/index.ts` — export new class
- `dev-flow/mcp-server/src/index.ts` — register 2 new MCP tools
- `dev-flow/skills/agent-team/SKILL.md` — document reviewer pattern update

**Key decisions:**
- Namespace: `{team_name}:{topic}` — team-scoped, prevents cross-team bleed
- CAS: version field on every entry — reject writes where `version != current + 1`
- TTL: default 4h (typical team session length), configurable
- Persistence: SQLite write-through (same `context.db`, new table) — no new files

---

## PERSIST

```
dev_handoff(action='write', handoff={
  agent_id: 'brainstorm',
  task_id: 'agent-team-shared-context',
  status: 'success',
  summary: 'Explored 4 approaches for shared agent context. Selected Balanced (Approach 2): MCP in-memory SharedContextStore with SQLite write-through, 2 new tools (dev_ctx_set/dev_ctx_get), CAS conflict detection, team-namespaced keys.',
  changes_made: [],
  decisions: {
    'storage': 'In-memory Map + SQLite write-through (context.db shared_ctx table)',
    'api': 'dev_ctx_set(key, value, agentId, ttl?) + dev_ctx_get(key?)',
    'namespace': '{team_name}:{topic} format for isolation',
    'conflict': 'Optimistic CAS via version field',
    'scope': 'Phase 1 MVP only: 5 files, 2 new MCP tools'
  },
  verification: [
    'dev_ctx_set and dev_ctx_get registered in MCP tools list',
    'SQLite shared_ctx table created with team-scoped queries',
    'CAS rejects version conflicts',
    'TTL expiry clears stale state',
    'TeamDelete clears all team:* keys'
  ],
  for_next_agent: 'Create implementation plan for SharedContextStore in coordination/ module. Target files: types.ts, coordinator.ts, index.ts, mcp-server/src/index.ts, agent-team/SKILL.md. Use existing context.db SQLite infrastructure. 2 new MCP tools only.'
})
```

---

## Summary

The brainstorm explored 4 architectural options for adding shared context to the agent-team system. The **Balanced approach** was selected: extend the MCP server (already a singleton process) with a `SharedContextStore` backed by the existing SQLite `context.db`. Two new MCP tools (`dev_ctx_set`, `dev_ctx_get`) expose this to agents. Team-namespaced keys (`{team}:{topic}`) prevent cross-team contamination. CAS conflict detection via a `version` field handles concurrent writes. SQLite write-through ensures crash recovery.

This directly solves the reviewer agent's core problem — reading live decisions from implementer agents without waiting for post-hoc handoffs — while adding minimal infrastructure (no new processes, no new files, reuses existing DB).
