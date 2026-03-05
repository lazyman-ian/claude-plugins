---
plan_version: "2.0"
status: research-complete
created: 2026-03-06
feature: knowledge-vault-hybrid-migration
phases:
  - id: 0
    name: "Audit current state — confirm what is and isn't implemented"
    complexity: low
    model: haiku
    parallelizable: false
    depends_on: []
    target_files: []
    verify: ["echo 'Phase 0 is audit-only, no code changes'"]
  - id: 1
    name: "Harden vault write path — priority + mtime tracking in SQLite index"
    complexity: medium
    model: sonnet
    parallelizable: false
    depends_on: [0]
    target_files:
      - "dev-flow/mcp-server/src/continuity/memory.ts"
    verify: ["npm run --prefix dev-flow/mcp-server build", "npm test --prefix dev-flow/mcp-server"]
  - id: 2
    name: "Add vault reindex trigger — mtime-based incremental reindex"
    complexity: medium
    model: sonnet
    parallelizable: false
    depends_on: [1]
    target_files:
      - "dev-flow/mcp-server/src/continuity/memory.ts"
    verify: ["npm run --prefix dev-flow/mcp-server build", "npm test --prefix dev-flow/mcp-server"]
  - id: 3
    name: "Upgrade context-injector — critical-priority vault injection"
    complexity: medium
    model: sonnet
    parallelizable: false
    depends_on: [2]
    target_files:
      - "dev-flow/mcp-server/src/continuity/context-injector.ts"
    verify: ["npm run --prefix dev-flow/mcp-server build", "npm test --prefix dev-flow/mcp-server"]
  - id: 4
    name: "Add temporal decay scoring to search + test coverage"
    complexity: medium
    model: sonnet
    parallelizable: false
    depends_on: [3]
    target_files:
      - "dev-flow/mcp-server/src/continuity/memory.ts"
      - "dev-flow/mcp-server/src/continuity/memory.test.ts"
    verify: ["npm test --prefix dev-flow/mcp-server"]
  - id: 5
    name: "Add Stop hook vault writer — quality-gated session capture"
    complexity: medium
    model: sonnet
    parallelizable: false
    depends_on: [4]
    target_files:
      - "dev-flow/hooks/scripts/session-summary.sh"
      - "dev-flow/hooks/hooks.json"
    verify: ["npm run --prefix dev-flow/mcp-server bundle"]
  - id: 6
    name: "Bundle and smoke test end-to-end"
    complexity: low
    model: haiku
    parallelizable: false
    depends_on: [5]
    target_files: []
    verify:
      - "npm run --prefix dev-flow/mcp-server bundle"
      - "npm test --prefix dev-flow/mcp-server"
---

# Knowledge Vault Hybrid Migration — Implementation Plan

## Overview

Migrate the dev-flow knowledge system from a flat Markdown-only storage model to a
fully-realised hybrid Markdown + SQLite architecture with:

- **Markdown vault** (`thoughts/knowledge/`) as source of truth — human-editable, git-tracked
- **SQLite FTS5** as a search index — fast, scored, decaying
- **Temporal decay scoring** on all search results
- **Quality gates** on every write path
- **SessionStart injection** from `priority: critical` vault entries

Critical finding from research: **most of the target architecture is already implemented
in the current codebase** (as of v6.2.0). The gap is not a ground-up build — it is a
set of specific hardening and completion tasks. See Phase 0 for the full audit.

---

## Current State Analysis

### What IS already implemented (v6.2.0)

All code references are in `dev-flow/mcp-server/src/continuity/memory.ts`.

| Feature | Status | Evidence |
|---------|--------|---------|
| Vault directory structure | Implemented | `ensureVaultDirs()` — creates `pitfalls/patterns/decisions/habits/` |
| YAML frontmatter generation | Implemented | `generateFrontmatter()` with type/priority/platform/tags/created/access_count |
| `parseFrontmatter()` — regex-based | Implemented | Lines 230–239, exported |
| `memorySave()` writes `.md` to vault | Implemented | Lines 381–446 — writes file then indexes in SQLite |
| SQLite FTS5 index | Implemented | `knowledge_fts` virtual table with INSERT/DELETE triggers (lines 86–103) |
| Synonym expansion on FTS queries | Implemented | `expandQuery()`, `seedSynonyms()` — 8 domain synonym sets |
| Smart dedup (FTS5 + token overlap + optional LLM) | Implemented | `smartDedup()`, `tokenOverlap()`, `llmCompare()` |
| Quality gate | Implemented | `qualityCheck()` — length + generic-description regex + Type-Token Ratio |
| `priority` column in DB | Implemented | Migration lines 123–124; INSERT includes `priority` field |
| Priority scoring in search | Implemented | `memorySearch()` ORDER BY includes `CASE priority WHEN 'critical' THEN 3.0 ...` |
| `memoryPrune()` with promote/demote/archive | Implemented | Lines 547–617 — all three decay operations |
| `reindexVault()` full scan rebuild | Implemented | Lines 754–810 — scans vault dirs, rebuilds FTS |
| `memoryGet()` reads from vault .md files | Implemented | Lines 498–532 — reads vault file and returns body |
| `context-injector.ts` — MEMORY.md sync | Implemented | `syncToMemoryMd()` with budget-aware sections |
| `session-start-continuity.sh` — injects via Node.js mjs | Implemented | Runs `dist/session-start-continuity.mjs` |
| Quality gate tests | Implemented | 7 test cases in `memory.test.ts` lines 71–120 |
| `memoryPrune()` tests | Implemented | 2 tests lines 122–140 |

### What is NOT yet implemented / incomplete

| Gap | Impact | Phase |
|-----|--------|-------|
| `priority` column not included in `reindexVault()` inserts | Vault entries lose priority on reindex | Phase 1 |
| `access_count` from vault frontmatter not loaded during reindex | Decay scoring inaccurate after reindex | Phase 1 |
| No per-file `mtime` tracking — reindex is always full rebuild | Performance: O(n) rebuild on every status call | Phase 2 |
| `context-injector` queries `type='pitfall'` by platform, ignores `priority` field | Critical non-pitfall entries never injected | Phase 3 |
| Temporal decay formula in `memorySearch()` uses `last_accessed` OR `created_at` but does not use `access_count` logarithm as specified | Search ranking not fully aligned with Stanford Generative Agents model | Phase 4 |
| No Stop hook integration — vault receives no session-end captures | Vault stays empty unless manually populated | Phase 5 |
| No test for `reindexVault()`, `memorySave()`, `memorySearch()` scoring, `parseFrontmatter()` | Test coverage gap on core new functions | Phase 4 |

### Key Files

| File | Lines | Role |
|------|-------|------|
| `dev-flow/mcp-server/src/continuity/memory.ts` | ~814 | Core vault + SQLite implementation |
| `dev-flow/mcp-server/src/continuity/memory.test.ts` | 141 | Tests (partial coverage) |
| `dev-flow/mcp-server/src/continuity/context-injector.ts` | ~250 | SessionStart injection logic |
| `dev-flow/hooks/scripts/session-start-continuity.sh` | ~100 | SessionStart shell wrapper |
| `dev-flow/hooks/scripts/session-summary.sh` | exists | Stop hook — currently writes session summary (not vault) |
| `dev-flow/hooks/hooks.json` | exists | Hook registrations |

### Desired End State

```
thoughts/knowledge/
├── pitfalls/      # .md files with YAML frontmatter
├── patterns/
├── decisions/
├── habits/
└── .archive/      # auto-archived reference entries

SQLite FTS5 index (.claude/cache/artifact-index/context.db)
  knowledge table: id, type, platform, title, problem, solution,
                   priority, access_count, last_accessed, file_path
  knowledge_fts:   FTS5 virtual table with porter tokenizer

Search: score = FTS5_rank * priority_weight * temporal_decay * log(access_count+1)
Inject: SessionStart reads critical+recent-important → MEMORY.md section
Write:  Stop hook captures session learnings → quality gate → vault .md + SQLite index
```

---

## What We Are NOT Doing

- No ChromaDB / vector embeddings (plan 2026-02-09 tier 2 was never approved for this phase)
- No session_summaries DB table (removed in 2026-02-28 simplification plan)
- No reasoning system (deleted in 2026-02-28 plan)
- No changes to ledger system (independent, working)
- No changes to handoff system (independent, working)
- No new MCP tools — only improving existing `dev_memory` actions
- No Makefile changes (project uses `npm run --prefix` pattern)

---

## Phase 0: Audit — Confirm Current State Before Writing Any Code

### Purpose

Before changing anything, read the actual current state of each file to confirm the
analysis above. The plan was built from a code read on 2026-03-06; confirm no drift.

### Checklist

- [ ] Read `memory.ts` lines 380–450 — confirm `memorySave()` writes vault .md + SQLite
- [ ] Read `memory.ts` lines 754–810 — confirm `reindexVault()` does NOT include priority/access_count from frontmatter
- [ ] Read `context-injector.ts` lines 88–111 — confirm `loadPlatformPitfalls()` uses `type='pitfall'` only, not priority
- [ ] Read `memory.test.ts` — confirm which functions have tests (parseFrontmatter does NOT, reindexVault does NOT)
- [ ] Run `npm test --prefix dev-flow/mcp-server` — confirm all existing tests pass before touching code
- [ ] Check `session-summary.sh` — confirm it does NOT write to vault (it writes to session context, not knowledge vault)

### Success Criteria

- [ ] `npm test --prefix dev-flow/mcp-server` passes (baseline: 141 lines, ~20 tests)
- [ ] `npm run --prefix dev-flow/mcp-server build` passes

---

## Phase 1: Harden Vault Write Path — Priority and Access Count in Reindex

### Problem

`reindexVault()` in `memory.ts:754–810` creates entries via `dbInsertKnowledge()` but
does NOT pass `priority` or `access_count` from the vault .md frontmatter. Every
reindex resets all priorities to the column default (`'important'`), discarding any
promotions made by `memoryPrune()`.

### Changes Required

#### File: `dev-flow/mcp-server/src/continuity/memory.ts`

**In `reindexVault()` (approximately lines 781–806)**

Change the entry construction to also read `priority` and `access_count` from
parsed frontmatter, and pass them to `dbInsertKnowledge()`.

Current pattern (simplified):
```typescript
const entry: KnowledgeEntry = {
  id, type: entryType as any, platform, title,
  problem: body.replace(/^#\s+.+\n+/, '').trim(),
  solution: data.tags || '',
  sourceProject: getProjectName(),
  sourceSession: 'vault',
  createdAt: data.created || new Date().toISOString().slice(0, 10),
  filePath,
};
dbInsertKnowledge(entry);
```

Required change: add `priority` and `access_count` fields:
```typescript
const priority = ['critical', 'important', 'reference'].includes(data.priority)
  ? data.priority : 'important';
const accessCount = parseInt(data.access_count || '0', 10) || 0;

const entry: KnowledgeEntry & { priority?: string; access_count?: number } = {
  id, type: entryType as any, platform, title,
  problem: body.replace(/^#\s+.+\n+/, '').trim(),
  solution: data.tags || '',
  sourceProject: getProjectName(),
  sourceSession: 'vault',
  createdAt: data.created || new Date().toISOString().slice(0, 10),
  filePath,
  priority,
  access_count: accessCount,
};
dbInsertKnowledge(entry);
```

**In `dbInsertKnowledge()` (approximately lines 129–142)**

The current INSERT uses `access_count: 0` hardcoded. Change to accept and use the
`access_count` field from the entry if present:

```typescript
function dbInsertKnowledge(entry: KnowledgeEntry & { priority?: string; access_count?: number }): boolean {
  // ...
  const accessCount = entry.access_count ?? 0;
  const sql = `INSERT OR REPLACE INTO knowledge (..., access_count, ...) VALUES (..., ${accessCount}, ...);`;
```

Note: Change `INSERT OR IGNORE` to `INSERT OR REPLACE` so reindexes properly update
existing entries (priority promotions made externally are preserved on full reindex).

### Success Criteria

#### Automated:
- [ ] `npm run --prefix dev-flow/mcp-server build` passes
- [ ] After `memorySave(..., priority='critical')` followed by `reindexVault()`, querying
  the DB shows `priority='critical'` for that entry (manual verification)

---

## Phase 2: Add Incremental Reindex — mtime-based Change Detection

### Problem

`reindexVault()` currently does a full delete+rebuild every time it is called.
`memoryStatus()` and the `reindex` action trigger it explicitly. This is O(n) on vault
size. The 2026-02-28 plan (Decision 3) specified per-file mtime tracking.

### Changes Required

#### File: `dev-flow/mcp-server/src/continuity/memory.ts`

**Add a metadata table to the DB schema (in `ensureDbSchema()`)**

```sql
CREATE TABLE IF NOT EXISTS vault_index_meta (
  file_path TEXT PRIMARY KEY,
  mtime_ms INTEGER NOT NULL,
  indexed_at TEXT NOT NULL
);
```

**Add migration** for existing DBs (in the migration section after schema creation):

```typescript
try {
  execSync(`sqlite3 "${dbPath}" "CREATE TABLE IF NOT EXISTS vault_index_meta ..."`, ...);
} catch { /* already exists */ }
```

**Rewrite `reindexVault()` with incremental mode**

```typescript
export function reindexVault(force: boolean = false): { indexed: number; skipped: number; message: string } {
  // 1. If force=true, clear vault_index_meta and do full rebuild (existing behavior)
  // 2. Otherwise, for each .md file:
  //    a. stat() to get mtime
  //    b. check vault_index_meta for this file_path
  //    c. if mtime matches stored mtime, skip
  //    d. if new or changed: parse + dbInsertKnowledge (INSERT OR REPLACE)
  //       + update vault_index_meta
  //    e. rebuild FTS only if any files were indexed
}
```

The `force` parameter maps to the existing `reindex` MCP action.
`memoryStatus()` calls `reindexVault(false)` (incremental) to keep the index fresh.

### Success Criteria

#### Automated:
- [ ] `npm run --prefix dev-flow/mcp-server build` passes
- [ ] `reindexVault(false)` on unchanged vault returns `skipped: N, indexed: 0`
- [ ] `reindexVault(false)` after vault file edit returns `indexed: 1`
- [ ] `reindexVault(true)` always rebuilds everything

---

## Phase 3: Upgrade Context Injector — Priority-Aware Injection

### Problem

`context-injector.ts:loadPlatformPitfalls()` queries:
```sql
SELECT title, substr(problem,1,100) FROM knowledge
WHERE type='pitfall' AND platform='${safePlatform}'
ORDER BY created_at DESC LIMIT 5;
```

This ignores `priority` entirely. A `critical` decision entry is never injected;
a stale `reference` pitfall from the same platform is injected. The desired behavior
(per the 2026-02-28 plan) is: SessionStart injects `critical` + recent `important`
entries, regardless of type.

### Changes Required

#### File: `dev-flow/mcp-server/src/continuity/context-injector.ts`

**Replace `loadPlatformPitfalls()` with `loadCriticalKnowledge()`**

```typescript
function loadCriticalKnowledge(platform: string, maxChars: number): string {
  const dbPath = getDbPath();
  if (!existsSync(dbPath)) return '';

  // critical entries for this platform, any type
  const safePlatform = platform.replace(/'/g, "''");
  const sql = `
    SELECT type, title, substr(problem,1,120)
    FROM knowledge
    WHERE priority = 'critical'
      AND (platform = '${safePlatform}' OR platform = 'general')
    ORDER BY COALESCE(last_accessed, created_at) DESC
    LIMIT 8;
  `;
  // ... format and return, budget-capped
}
```

**Add `loadRecentImportant()` (separate budget slice)**

```typescript
function loadRecentImportant(maxChars: number): string {
  const dbPath = getDbPath();
  if (!existsSync(dbPath)) return '';

  const sql = `
    SELECT type, title, substr(problem,1,80)
    FROM knowledge
    WHERE priority = 'important'
      AND julianday('now') - julianday(created_at) <= 7
    ORDER BY created_at DESC
    LIMIT 5;
  `;
  // ... format and return, budget-capped
}
```

**Update `syncToMemoryMd()` budget allocation:**

| Section | Current budget | New budget |
|---------|---------------|------------|
| Platform pitfalls | 600 chars | replaced by critical knowledge |
| Critical knowledge (new) | — | 700 chars |
| Task-related FTS match | 500 chars | 500 chars (unchanged) |
| Recent important (new) | — | 400 chars |
| Recent discoveries | 400 chars | 300 chars |
| Total | 1500 chars | 1900 chars (within 2500 limit) |

### Success Criteria

#### Automated:
- [ ] `npm run --prefix dev-flow/mcp-server build` passes
- [ ] After saving a `priority: critical` decision entry, `syncToMemoryMd()` output
  includes that entry (manual test)

---

## Phase 4: Temporal Decay Scoring — Full Formula + Test Coverage

### Problem

The current `memorySearch()` ORDER BY (approximately lines 462–466):
```sql
ORDER BY rank * CASE priority WHEN 'critical' THEN 3.0 ... END
       * (1.0 / (1.0 + julianday_diff / 30.0))
```

This is missing the `log(access_count + 1)` frequency saturation term specified in the
2026-02-28 plan (Decision 5, grounded in Stanford Generative Agents + BM25).

Also: test coverage gaps — `parseFrontmatter()`, `reindexVault()`, `memorySave()` vault
write path, and `memorySearch()` priority ordering have no unit tests.

### Changes Required

#### File: `dev-flow/mcp-server/src/continuity/memory.ts`

**Update `memorySearch()` ORDER BY** to include the log(access_count + 1) term:

```sql
ORDER BY rank
  * CASE COALESCE(k.priority, 'important')
      WHEN 'critical' THEN 3.0
      WHEN 'important' THEN 2.0
      ELSE 1.0
    END
  * (1.0 / (1.0 + COALESCE(
      julianday('now') - julianday(COALESCE(k.last_accessed, k.created_at)), 0
    ) / 30.0))
  * (1.0 + log(COALESCE(k.access_count, 0) + 1))
LIMIT ${limit};
```

Note: SQLite does not have a built-in `log()` function. Options:
1. Pre-compute a bucket in the application layer (simpler)
2. Use `(1.0 + CASE WHEN access_count >= 3 THEN 1.1 WHEN access_count >= 1 THEN 0.5 ELSE 0.0 END)` as approximation
3. Load SQLite math extension

Recommended: option 2 (approximation, no dependencies). The exact log value matters
less than the directional correctness.

#### File: `dev-flow/mcp-server/src/continuity/memory.test.ts`

**Add 12 new tests** following the existing `vi.mock()` pattern (but most new tests
target pure functions and need no mocking):

| Test Suite | Count | Functions | Mocking |
|------------|-------|-----------|---------|
| `parseFrontmatter` | 4 | valid frontmatter, no frontmatter, empty body, Chinese chars | none |
| `qualityCheck` additions | 2 | additional edge cases | none |
| `memorySave` vault write | 3 | creates file, dedup rejects, quality rejects | `vi.mock('fs')`, `vi.mock('child_process')` |
| `memoryPrune` decay | 3 | promote on access_count>=3, demote at 90d, archive | `vi.mock('child_process')` |

**Test for `parseFrontmatter`** (pure function, no mock needed):
```typescript
describe('parseFrontmatter', () => {
  it('parses valid frontmatter', () => {
    const content = '---\ntype: pitfall\npriority: critical\n---\n\n# Title\nBody';
    const { data, body } = parseFrontmatter(content);
    expect(data.type).toBe('pitfall');
    expect(data.priority).toBe('critical');
    expect(body).toContain('# Title');
  });

  it('returns empty data when no frontmatter', () => {
    const { data, body } = parseFrontmatter('# Just a title\nSome body');
    expect(Object.keys(data)).toHaveLength(0);
    expect(body).toContain('# Just a title');
  });

  it('handles empty frontmatter block', () => {
    const { data } = parseFrontmatter('---\n---\n\nBody');
    expect(Object.keys(data)).toHaveLength(0);
  });

  it('handles Chinese characters in body', () => {
    const content = '---\ntype: decision\n---\n\n# 使用 guard\n说明';
    const { body } = parseFrontmatter(content);
    expect(body).toContain('使用 guard');
  });
});
```

### Success Criteria

#### Automated:
- [ ] `npm test --prefix dev-flow/mcp-server` passes all tests including new ones
- [ ] New test count: minimum 32 (current ~20 + 12 new)
- [ ] `npm run --prefix dev-flow/mcp-server build` passes

---

## Phase 5: Stop Hook — Quality-Gated Session Vault Writer

### Problem

The knowledge vault is empty by default. The architecture specifies that the Stop hook
should capture session learnings. The existing `session-summary.sh` writes a session
summary for context continuity but does NOT save actionable knowledge to the vault.

### Current `session-summary.sh` behavior

Reads `last_assistant_message` from hook input, writes a brief "last session" context
to help with continuity. This is correct and should be preserved.

### Changes Required

#### File: `dev-flow/hooks/scripts/session-summary.sh`

Add a section after the existing session-summary logic that:

1. Reads `last_assistant_message` from hook JSON input
2. Splits on heuristics to find potential knowledge items (patterns, decisions, pitfalls
   mentioned with imperative language)
3. Calls `dev_memory save` via the MCP server CLI, or writes directly via `sqlite3`
   if the MCP server bundle is available

**Design**: Do NOT call the Anthropic API in the hook (adds latency, requires key).
Instead, apply the same quality gate heuristics used in `qualityCheck()` to filter
the last assistant message for paragraphs that look like knowledge entries.

**Simple approach** — pattern-based extraction from `last_assistant_message`:

```bash
# Extract knowledge-looking sentences from last_assistant_message
LAST_MSG=$(echo "$INPUT" | jq -r '.last_assistant_message // empty' 2>/dev/null || echo "")

if [[ -n "$LAST_MSG" ]] && [[ -n "$PROJECT_DIR" ]]; then
  # Look for sentences starting with "Use ", "Avoid ", "Always ", "Never ", "Note:"
  # These heuristically identify actionable knowledge
  KNOWLEDGE_LINES=$(echo "$LAST_MSG" | grep -E '^(Use |Avoid |Always |Never |Note:|Remember:|Lesson:|Key |Important:)' | head -5)

  # For each candidate line, write via MCP server bundle if available
  MCP_BUNDLE="$SCRIPT_DIR/../../../scripts/mcp-server.cjs"
  if [[ -f "$MCP_BUNDLE" ]] && [[ -n "$KNOWLEDGE_LINES" ]]; then
    while IFS= read -r line; do
      # The quality gate in memorySave() handles rejection of low-quality entries
      echo "$line" | node -e "
        const mem = require('$MCP_BUNDLE');
        // ... invoke memorySave via exported interface
      " 2>/dev/null || true
    done <<< "$KNOWLEDGE_LINES"
  fi
fi
```

**Important constraint**: The hook must not fail or block if the MCP bundle is unavailable.
All vault writes in the hook are best-effort with silent failure.

**Alternative simpler approach** (recommended for first implementation): The Stop hook
invokes `dev_memory save` via the full MCP server bundle using a Node.js one-liner.
The quality gate in `memorySave()` will reject vague entries automatically — no
additional filtering needed in the hook.

#### File: `dev-flow/hooks/hooks.json`

Confirm the Stop hook entry for `session-summary.sh` is already registered. If not,
add it. The existing entry (if present) should already cover this.

### Success Criteria

#### Automated:
- [ ] `npm run --prefix dev-flow/mcp-server bundle` passes
- [ ] `bash dev-flow/hooks/scripts/session-summary.sh < /dev/null` exits 0 (graceful
  when no input)

#### Manual:
- [ ] After a session where Claude mentions "Use X instead of Y", ending the session
  creates a vault entry in `thoughts/knowledge/`
- [ ] Duplicate sentences across sessions are rejected by smart dedup

---

## Phase 6: Bundle and Smoke Test

### Changes Required

No code changes. Run the full verification sequence:

```bash
npm run --prefix dev-flow/mcp-server build
npm test --prefix dev-flow/mcp-server
npm run --prefix dev-flow/mcp-server bundle
```

Then manually verify the end-to-end flow:

1. `dev_memory(action='save', text='Use --prefix for npm in hooks, not cd', type='pitfall')`
   → verify `thoughts/knowledge/pitfalls/use---prefix-for-npm-in-hooks--not-cd.md` created
2. `dev_memory(action='search', query='npm prefix')` → verify result returned
3. `dev_memory(action='get', ids=['...'])` → verify full markdown body returned
4. `dev_memory(action='prune', dryRun=true)` → verify no errors
5. Start new Claude session → verify MEMORY.md contains knowledge section

### Success Criteria

#### Automated:
- [ ] `npm run --prefix dev-flow/mcp-server build` exits 0
- [ ] `npm test --prefix dev-flow/mcp-server` exits 0
- [ ] `npm run --prefix dev-flow/mcp-server bundle` exits 0

#### Manual:
- [ ] Vault .md file created with correct YAML frontmatter
- [ ] `memorySearch()` returns result via FTS5
- [ ] SessionStart MEMORY.md section updated with vault content

---

## Testing Strategy

### Existing Tests (preserve all)

| Suite | Count | Functions |
|-------|-------|-----------|
| `extractKeyTerms` | 5 | pure, no mock |
| `tokenOverlap` | 5 | pure, no mock |
| `qualityCheck` | 7 | pure, no mock |
| `memoryPrune` | 2 | DB mock |

### New Tests (Phase 4)

| Suite | Count | Priority |
|-------|-------|---------|
| `parseFrontmatter` | 4 | High — used in reindex critical path |
| `qualityCheck` additions | 2 | Medium — edge cases |
| `memorySave` vault write | 3 | High — end-to-end save path |
| `memoryPrune` decay rules | 3 | High — promote/demote/archive logic |

**Total target**: 32 tests (current: ~20, new: 12+)

**Mock pattern** (follow existing `memory.test.ts`):
```typescript
vi.mock('child_process', () => ({ execSync: vi.fn() }));
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  readdirSync: vi.fn().mockReturnValue([]),
  statSync: vi.fn(),
  renameSync: vi.fn(),
}));
```

---

## Data Migration Notes

- No existing vault data to migrate (vault is empty as of 2026-03-06)
- Existing SQLite DB entries in `knowledge` table (if any) are unaffected
- `INSERT OR REPLACE` in Phase 1 is safe — existing rows are updated, not duplicated
- `vault_index_meta` table (Phase 2) is additive — no existing data affected

---

## Performance Considerations

| Concern | Mitigation |
|---------|-----------|
| Full reindex O(n) | Phase 2 incremental reindex via mtime tracking |
| SessionStart latency | Injection reads SQLite index (fast), not vault files |
| Stop hook latency | Knowledge write is best-effort, async-safe |
| Quality gate per save | Pure regex + TTR, ~0 ms |
| FTS5 rebuild | Only triggered when `force=true` or vault truly changed |

---

## References

| Category | Reference |
|----------|-----------|
| Architecture design | `thoughts/shared/plans/2026-02-28-memory-system-simplification.md` |
| Earlier evolution plan | `thoughts/shared/plans/2026-02-09-memory-system-evolution.md` |
| Current implementation | `dev-flow/mcp-server/src/continuity/memory.ts` (814 lines) |
| Current tests | `dev-flow/mcp-server/src/continuity/memory.test.ts` (141 lines) |
| Context injection | `dev-flow/mcp-server/src/continuity/context-injector.ts` |
| Session hook | `dev-flow/hooks/scripts/session-start-continuity.sh` |
| SQLite FTS5 docs | https://www.sqlite.org/fts5.html |
| Stanford Generative Agents | Park et al. 2023 — recency × importance × relevance scoring |
