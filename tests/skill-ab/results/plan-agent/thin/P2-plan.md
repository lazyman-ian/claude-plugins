---
plan_version: "2.0"
status: draft
created: 2026-03-06
phases:
  - id: 1
    name: "Bootstrap vault directory structure + reindex CLI"
    complexity: low
    model: sonnet
    parallelizable: false
    depends_on: []
    target_files:
      - "dev-flow/mcp-server/src/continuity/memory.ts"
    verify: ["npm run --prefix dev-flow/mcp-server build"]
  - id: 2
    name: "Wire vault into memorySave — Markdown-first writes"
    complexity: medium
    model: sonnet
    parallelizable: false
    depends_on: [1]
    target_files:
      - "dev-flow/mcp-server/src/continuity/memory.ts"
    verify: ["npm run --prefix dev-flow/mcp-server build"]
  - id: 3
    name: "Temporal decay scoring in FTS5 search"
    complexity: medium
    model: sonnet
    parallelizable: false
    depends_on: [2]
    target_files:
      - "dev-flow/mcp-server/src/continuity/memory.ts"
    verify: ["npm run --prefix dev-flow/mcp-server build"]
  - id: 4
    name: "Quality gate — reject vague entries on save"
    complexity: low
    model: sonnet
    parallelizable: true
    depends_on: [2]
    target_files:
      - "dev-flow/mcp-server/src/continuity/memory.ts"
    verify: ["npm run --prefix dev-flow/mcp-server build"]
  - id: 5
    name: "SessionStart injection reads from vault (context-injector update)"
    complexity: medium
    model: sonnet
    parallelizable: false
    depends_on: [3, 4]
    target_files:
      - "dev-flow/mcp-server/src/continuity/context-injector.ts"
    verify: ["npm run --prefix dev-flow/mcp-server build"]
  - id: 6
    name: "Unit tests — parseFrontmatter, qualityCheck, memorySave vault write, memorySearch decay"
    complexity: medium
    model: sonnet
    parallelizable: false
    depends_on: [3, 4]
    target_files:
      - "dev-flow/mcp-server/src/continuity/memory.test.ts"
    verify: ["npm test --prefix dev-flow/mcp-server"]
  - id: 7
    name: "Bundle + smoke test"
    complexity: low
    model: sonnet
    parallelizable: false
    depends_on: [5, 6]
    target_files: []
    verify: ["npm run --prefix dev-flow/mcp-server bundle"]
---

# Knowledge Vault Migration: Hybrid Markdown + SQLite with FTS, Temporal Decay, and Quality Gates

## Overview

Migrate the knowledge vault from a state where SQLite (`context.db`) is the sole storage medium — with `file_path` column pointing to nonexistent vault files — to a true hybrid architecture where Markdown files in `thoughts/knowledge/` are the source of truth and SQLite FTS5 serves as the search index.

The core infrastructure already exists in `memory.ts` (v6.2.0): schema, FTS5 triggers, synonym expansion, `memorySave`, `memorySearch`, `memoryGet`, `qualityCheck`, `memoryPrune`, and `reindexVault`. The gap is that vault directory creation, Markdown file writes, and the scoring formula are partially wired but the `thoughts/knowledge/` directory has never been initialized — `dev_memory(save)` will fail to write files because `ensureVaultDirs()` is called but the parent `getVaultPath()` path may not exist.

## Current State Analysis

### What exists (verified in `memory.ts`):
| Component | Status | Location |
|-----------|--------|----------|
| SQLite schema: `knowledge` table + FTS5 triggers | Working | `memory.ts:65-127` |
| `memorySave()` — writes .md file + inserts SQLite | Implemented | `memory.ts:381-446` |
| `memorySearch()` — FTS5 + temporal decay SQL | Implemented | `memory.ts:450-494` |
| `memoryGet()` — reads full .md content from vault | Implemented | `memory.ts:498-532` |
| `qualityCheck()` — regex + TTR heuristics | Implemented | `memory.ts:361-377` |
| `memoryPrune()` — promote/demote/archive by decay | Implemented | `memory.ts:547-617` |
| `reindexVault()` — scans vault, rebuilds SQLite | Implemented | `memory.ts:754-810` |
| `parseFrontmatter()` — regex YAML parser | Implemented | `memory.ts:230-239` |
| Synonym expansion (`expandQuery`) | Implemented | `memory.ts:172-189` |
| Context injection in SessionStart | Implemented | `context-injector.ts` |

### What is missing or broken:

1. **Vault directory does not exist**: `thoughts/knowledge/` has never been created. `ensureVaultDirs()` calls `mkdirSync` correctly but only creates subdirs under `getVaultPath()` — if the config `memory.vault` path points to a non-existent directory tree, this works. However `.dev-flow.json` sets `"vault": "thoughts/knowledge"` and that directory is absent. First `memorySave()` call should auto-create via `mkdirSync(... { recursive: true })` — need to verify no race condition exists.

2. **Temporal decay formula gap**: `memorySearch()` SQL at line 462-466 uses `COALESCE(julianday('now') - julianday(COALESCE(k.last_accessed, k.created_at)), 0)` — this is a decay factor but does NOT include the `log(access_count + 1)` frequency boost described in the plan docs (Decision 5). The scoring should be `rank * priority_weight * (1 / (1 + age_days/30)) * log(access_count + 1)`.

3. **`access_count` not factored into search ranking**: `last_accessed` is updated on retrieval (line 484), but the access count multiplication is missing from the SQL ORDER BY.

4. **FTS5 UPDATE trigger missing**: Schema has INSERT and DELETE triggers for FTS sync but no UPDATE trigger. If a vault `.md` file is edited and reindexed, the path is: `DELETE from FTS → INSERT to FTS`. But if priority changes (via `memoryPrune`), the knowledge table row is updated without an FTS rebuild. For correctness, an UPDATE trigger or explicit `rebuild` call is needed.

5. **Context injector still queries session_summaries**: `context-injector.ts` may have a stale `loadLastSessionSummary()` function that reads from a `session_summaries` table that was removed in the simplification plan. Need to confirm current state.

6. **No unit tests for vault write path**: `memory.test.ts` tests `extractKeyTerms`, `tokenOverlap`, `qualityCheck` but does NOT test `memorySave()` vault file creation, `parseFrontmatter()`, or `reindexVault()`.

### Storage layout (target):
```
thoughts/knowledge/          ← vault root (source of truth)
├── pitfalls/
│   └── builtin-cd-only-works-with-shell-builtins.md
├── patterns/
├── decisions/
├── habits/
└── .archive/                ← pruned reference entries
.claude/cache/artifact-index/
└── context.db               ← SQLite FTS5 index (rebuild from vault)
```

## Desired End State

```
memorySave(text, type, priority)
  → qualityCheck() + smartDedup()
  → write thoughts/knowledge/{type}/{slug}.md (YAML frontmatter + body)
  → INSERT INTO knowledge + FTS5 trigger auto-syncs

memorySearch(query)
  → expandQuery() synonym expansion
  → FTS5 MATCH with scoring: rank * priority_weight * temporal_decay * log(access_count+1)
  → returns lightweight index (id, type, title, platform, createdAt)

memoryGet(ids)
  → SQLite lookup for metadata
  → reads full .md body from vault file path
  → returns rich content

SessionStart injection
  → queries SQLite for critical + recent important entries
  → injects up to 2500 chars into session context

reindexVault()
  → scans thoughts/knowledge/**/*.md
  → parses frontmatter
  → rebuilds SQLite index
  → triggered by: explicit `dev_memory(reindex)`, or mtime-detected drift
```

## What We're NOT Doing

- Not adding ChromaDB or vector embeddings (de-scoped in simplification plan)
- Not adding session summaries table (removed in simplification plan)
- Not adding Tier 3 periodic observations (de-scoped)
- Not changing the `dev_memory` MCP tool interface (already has `status/save/search/get/list/prune/reindex`)
- Not modifying ledger, handoff, or coordination systems
- Not migrating existing SQLite entries to vault files (no existing entries have real file paths)

---

## Phase 1: Bootstrap Vault Directory Structure + Reindex CLI

### Overview

Ensure the vault directory is always initialized before first use. Currently `ensureVaultDirs()` exists but is only called inside `memorySave()` — not called on `memorySearch()` or `reindexVault()`. Add a `_index.md` overview file in vault root for Obsidian users.

### Changes Required

- **File**: `dev-flow/mcp-server/src/continuity/memory.ts`
- **Changes**:
  1. Call `ensureVaultDirs()` at the top of `reindexVault()` and `memorySearch()` (currently not called there).
  2. In `ensureVaultDirs()`, create `_index.md` in vault root on first init (idempotent check: only if not exists). Content: brief overview of vault structure.
  3. Verify `mkdirSync(join(vault, dir), { recursive: true })` correctly handles the case where the top-level `thoughts/knowledge` dir does not exist yet — `{ recursive: true }` handles this, but add a comment confirming this.
  4. Add `reindexVault()` call inside `memoryStatus()` when vault has files but SQLite is empty (auto-bootstrap scenario).

### Success Criteria

#### Automated:
- [ ] `npm run --prefix dev-flow/mcp-server build` exits 0

#### Manual:
- [ ] After `dev_memory(status)`, `thoughts/knowledge/{pitfalls,patterns,decisions,habits}/` directories exist
- [ ] `thoughts/knowledge/_index.md` exists after first status call

---

## Phase 2: Wire Vault into memorySave — Markdown-First Writes

### Overview

The `memorySave()` function is implemented but the vault write path needs hardening: slug collision handling, frontmatter format verification for Obsidian compatibility, and a return value that includes the relative vault path (for user feedback).

### Changes Required

- **File**: `dev-flow/mcp-server/src/continuity/memory.ts`
- **Changes**:
  1. **Slug collision handling**: If `thoughts/knowledge/{type}/{slug}.md` already exists, append `-2`, `-3` etc. until a free filename is found. Currently the code writes blindly (overwrite risk on title collision with different content).
  2. **Frontmatter Obsidian compat**: Confirm `---` delimiter is the very first bytes of file (no leading whitespace or BOM). The current `generateFrontmatter()` at line 241 produces correct output — add a unit-testable assertion.
  3. **FTS5 UPDATE trigger**: Add UPDATE trigger to schema in `ensureDbSchema()`:
     ```sql
     CREATE TRIGGER IF NOT EXISTS knowledge_au AFTER UPDATE ON knowledge BEGIN
       INSERT INTO knowledge_fts(knowledge_fts, rowid, title, problem, solution)
         VALUES('delete', old.rowid, old.title, old.problem, old.solution);
       INSERT INTO knowledge_fts(rowid, title, problem, solution)
         VALUES(new.rowid, new.title, new.problem, new.solution);
     END;
     ```
  4. **Return relative path**: Change `filePath` in return value from absolute to relative (from project root) for cleaner output in MCP response.

### Success Criteria

#### Automated:
- [ ] `npm run --prefix dev-flow/mcp-server build` exits 0

#### Manual:
- [ ] `dev_memory(action='save', text='builtin cd only works for shell builtins, not npm/node', type='pitfall')` creates `thoughts/knowledge/pitfalls/builtin-cd-only-works-for-shell-builtins.md`
- [ ] File starts with `---` (no leading whitespace)
- [ ] Second save with same title gets `-2` suffix, not overwrite

---

## Phase 3: Temporal Decay Scoring in FTS5 Search

### Overview

The existing `memorySearch()` ORDER BY clause is missing the `log(access_count + 1)` frequency boost. Fix the scoring formula to match the documented architecture (Stanford Generative Agents pattern: recency × importance × relevance × frequency).

### Changes Required

- **File**: `dev-flow/mcp-server/src/continuity/memory.ts`
- **Changes**:
  1. Update the SQL in `memorySearch()` (line ~462) ORDER BY clause from:
     ```sql
     ORDER BY rank * CASE ... priority_weight ... END * (1.0 / (1.0 + age_days/30))
     ```
     to:
     ```sql
     ORDER BY rank
       * CASE COALESCE(k.priority, 'important')
           WHEN 'critical' THEN 3.0
           WHEN 'important' THEN 2.0
           ELSE 1.0 END
       * (1.0 / (1.0 + COALESCE(julianday('now') - julianday(COALESCE(k.last_accessed, k.created_at)), 0) / 30.0))
       * (1.0 + log(COALESCE(k.access_count, 0) + 1))
     ```
     Note: SQLite does not have a built-in `log()` function. Use `(1.0 + (COALESCE(k.access_count, 0) * 0.1))` as a linear approximation, or load the math extension. Document this trade-off in a code comment.
  2. Add a SQL comment above the ORDER BY explaining the scoring model and its academic grounding (Stanford Generative Agents, TinyLFU).
  3. Verify `last_accessed` update (line ~484) still fires after the scoring change.

### Success Criteria

#### Automated:
- [ ] `npm run --prefix dev-flow/mcp-server build` exits 0

#### Manual:
- [ ] Entry accessed 5 times appears before an entry with 0 accesses when both match the same query
- [ ] A `critical` priority entry ranks above an `important` entry with identical FTS rank

---

## Phase 4: Quality Gate — Reject Vague Entries on Save

### Overview

`qualityCheck()` exists and is called inside `memorySave()`. This phase verifies the gate is working correctly and adds one missing pattern: entries that are pure file lists (from git diff output) should be rejected.

### Changes Required

- **File**: `dev-flow/mcp-server/src/continuity/memory.ts`
- **Changes**:
  1. Add rejection pattern for file-list-style content:
     ```typescript
     if (/^(\s*[-*]\s+\S+\.(ts|swift|kt|py|md|json)\s*\n?){3,}/.test(text))
       return { pass: false, reason: 'File list, not actionable knowledge' };
     ```
  2. Add rejection for single-word entries with no context:
     ```typescript
     if (words.length < 5 && !text.includes(':') && !text.includes('.'))
       return { pass: false, reason: 'Too terse — needs context' };
     ```
  3. Expose `qualityCheck` from the module exports (already at line 813) — confirm it's exported for testing.

### Success Criteria

#### Automated:
- [ ] `npm run --prefix dev-flow/mcp-server build` exits 0

#### Manual:
- [ ] `dev_memory(save, text='Updated files')` → rejected: "Generic description"
- [ ] `dev_memory(save, text='- auth.ts\n- user.ts\n- token.ts')` → rejected: "File list"
- [ ] `dev_memory(save, text='Use guard clauses over nested if/else for early return pattern')` → accepted

---

## Phase 5: SessionStart Injection Reads from Vault

### Overview

Verify and update `context-injector.ts` to correctly load critical + recent important knowledge from the SQLite index (which now reflects vault files). Remove any stale references to `session_summaries` table.

### Changes Required

- **File**: `dev-flow/mcp-server/src/continuity/context-injector.ts`
- **Changes**:
  1. Audit `loadLastSessionSummary()` — if it queries `session_summaries` table (which was removed), remove the function and its call site.
  2. Verify `loadPlatformPitfalls()` queries `knowledge` table with `priority = 'critical'` filter and `platform` match. If it still uses file-based loading (scanning vault directory), switch to SQLite query for consistency.
  3. Confirm budget constants are correct: `BUDGET_PITFALLS=600`, `BUDGET_TASK=500`, `BUDGET_RECENT=400` summing to `BUDGET_TOTAL=2500` (currently defined at lines 18-20).
  4. If `context-injector.ts` has any direct vault file reads that bypass SQLite, replace with SQLite queries (single source of truth for injection).

### Success Criteria

#### Automated:
- [ ] `npm run --prefix dev-flow/mcp-server build` exits 0

#### Manual:
- [ ] After saving a `critical` pitfall via `dev_memory(save, priority='critical')`, a new session's SessionStart includes that entry in injected context
- [ ] No TypeScript errors referencing `session_summaries`

---

## Phase 6: Unit Tests

### Overview

Add unit tests covering the vault write path, frontmatter parsing, quality gate, and temporal decay scoring. Follow existing test pattern in `memory.test.ts` (vitest + `vi.mock('child_process')` + `vi.mock('fs')`).

### Changes Required

- **File**: `dev-flow/mcp-server/src/continuity/memory.test.ts`
- **Changes**: Add test suites:

  **`parseFrontmatter` (3 tests)**:
  - Parses valid frontmatter into data + body
  - Returns empty data for content without frontmatter
  - Handles edge case: frontmatter with missing fields

  **`qualityCheck` (5 tests)**:
  - Rejects text < 20 chars
  - Rejects "Updated files" pattern (generic commit)
  - Rejects low TTR repetitive content
  - Rejects file-list pattern (Phase 4 addition)
  - Accepts valid knowledge entry

  **`memorySave` vault write (3 tests)**:
  - Creates `.md` file in correct vault subdirectory
  - Returns `saved: false` when quality gate rejects
  - Returns `saved: false` when smart dedup detects duplicate (token overlap > 0.7)

  **`memorySearch` decay scoring (2 tests)**:
  - Critical priority entry ranks higher than important with same FTS rank (mock execSync output)
  - Recently-accessed entry ranks higher than never-accessed entry

### Success Criteria

#### Automated:
- [ ] `npm test --prefix dev-flow/mcp-server` exits 0 with all new tests passing
- [ ] Total test count increases from current baseline by at least 13

---

## Phase 7: Bundle + Smoke Test

### Overview

Bundle the MCP server and perform a quick smoke test to verify the vault integration works end-to-end without runtime errors.

### Changes Required

No code changes. Verification only.

### Success Criteria

#### Automated:
- [ ] `npm run --prefix dev-flow/mcp-server bundle` exits 0, producing `scripts/mcp-server.cjs`
- [ ] `npm run --prefix dev-flow/mcp-server build` exits 0 (TypeScript clean)
- [ ] `npm test --prefix dev-flow/mcp-server` exits 0 (all tests pass)

#### Manual:
- [ ] `dev_memory(status)` returns vault stats including `vault_files` count
- [ ] `dev_memory(save, text='...', type='pitfall')` creates a `.md` file in `thoughts/knowledge/pitfalls/`
- [ ] `dev_memory(search, query='...')` returns lightweight index entries
- [ ] `dev_memory(get, ids='...')` returns full `.md` body content
- [ ] `dev_memory(prune, dryRun=true)` reports promotion/demotion candidates without writing

---

## Key Technical Decisions

### SQLite as Index Only (Not Source of Truth)

Markdown files are source of truth. If SQLite is deleted, `dev_memory(reindex)` reconstructs it fully from vault files. This enables:
- Human editing of knowledge in Obsidian or any text editor
- Git-trackable knowledge history (`thoughts/knowledge/` is in the repo)
- Zero vendor lock-in for the storage layer

### FTS5 Scoring Formula

SQLite has no built-in `log()` function. The access_count frequency boost uses a linear approximation `(1.0 + access_count * 0.1)` instead of `log(access_count + 1)`. This is a known simplification — the difference is negligible at the scale of a personal knowledge vault (< 1000 entries). Document in code comments.

### Quality Gate: No LLM

All quality filtering is rule-based (regex + TTR). This runs on every save at zero cost and zero latency. LLM-based quality assessment was explicitly rejected because: (1) cost per entry, (2) latency, (3) non-determinism. The specific patterns being rejected (generic commit descriptions, file lists, low-diversity content) are reliably caught by regex.

### Vault Reindex Trigger

Reindex is triggered explicitly via `dev_memory(reindex)` and auto-triggered in `memoryStatus()` if vault has `.md` files but SQLite is empty. It is NOT triggered on every `memorySearch()` call (performance). Users editing vault files manually should run `dev_memory(reindex)` afterward, or the drift will be caught on next status check.

## Migration Notes

- No existing vault data to migrate (`thoughts/knowledge/` does not exist yet)
- Existing SQLite entries in `context.db` have no corresponding vault files — they are orphaned. `reindexVault()` clears and rebuilds from vault, so running `dev_memory(reindex)` will reset to clean state
- `.dev-flow.json` already has `"memory": { "vault": "thoughts/knowledge" }` — no config change needed

## Testing Strategy

| Type | Target | Tooling |
|------|--------|---------|
| Unit | `parseFrontmatter`, `qualityCheck`, `memorySave`, `memorySearch` | vitest, `vi.mock` |
| Integration | Full save→search→get→prune cycle | vitest with temp dir |
| Manual | SessionStart injection, Obsidian file opening | Manual verification |

Build command: `npm run --prefix dev-flow/mcp-server build`
Bundle command: `npm run --prefix dev-flow/mcp-server bundle`
Test command: `npm test --prefix dev-flow/mcp-server`
