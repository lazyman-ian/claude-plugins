# Changelog

All notable changes to dev-flow plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [6.1.0] - 2026-02-28

### Added

- **Auto-Retrieval Hook**: New `UserPromptSubmit` hook (`prompt-knowledge.sh`) injects relevant knowledge from SQLite FTS5 every 3rd prompt (zero cost, <50ms latency)
- **Temporal Decay**: FTS5 search results now scored with `rank * 1/(1 + days_since_access/30)`, prioritizing recent and frequently-accessed knowledge
- **TTL Pruning**: Knowledge entries with `access_count=0` and older than 90 days are automatically pruned weekly on SessionStart. Manual prune via `dev_memory(action="prune")`
- **MEMORY.md Layered Trim**: Section-aware priority trimming (P0 core never trimmed, P1 tables truncated, P2 Last Session minimized, P3 Compact State removed)

### Changed

- **Project Isolation**: Removed all automatic writes to global `~/.claude/knowledge/` directory. Per-project SQLite DB (`.claude/cache/artifact-index/context.db`) is now the single source of truth
- **`loadPlatformPitfalls()`** and **`loadRecentDiscoveries()`** now query SQLite instead of reading global files
- **`memoryStatus()`** counts from SQLite `GROUP BY type` instead of filesystem scanning
- **`memoryConsolidate()`** uses `smartDedup()` for duplicate detection instead of filesystem checks

### Fixed

- `prune` action missing from `dev_memory` MCP tool schema enum
- Shell injection vulnerability in `llmCompare()` — dynamic values now passed via environment variables instead of shell interpolation
- SQL injection risk in `session-start-continuity.sh` — platform value now sanitized before SQL embedding

### Removed

- `ensureKnowledgeDirs()` — no longer creates global knowledge directories
- `writeKnowledgeEntry()` — no longer writes .md files to global paths
- `getKnowledgeDir()` — removed from both `memory.ts` and `context-injector.ts`
- `pitfallsToBullets()` — replaced by direct SQLite query formatting
- `isDuplicate()` — replaced by `smartDedup()` (SQLite-based)

## [6.0.0] - 2026-02-27

### Added

- **Instinct System** (`instincts.ts`, 328 lines): Auto-extract patterns from observations via DBSCAN-style clustering, with confidence decay and evolution to skills/rules via `/dev evolve`
- **Notion Pipeline**: Task triage (`dev_inbox`), spec generation (`dev_spec`), `post-merge-notion.sh` hook for status updates
- **Product Brain** (`product-brain.ts`, 275 lines): Product knowledge extraction, query, and save with `dev_product` MCP tool (4 actions) and `post-impl-extract.sh` hook
- **Memory Architecture Alignment**: `syncToMemoryMd()` for Auto Memory bidirectional sync, topic file output (`pitfalls.md`, `patterns.md`, `decisions.md`), `memory-sync.sh` SessionStart hook
- **Rules Distribution System**: 9 platform-aware rule templates (coding-style ×4, testing, git-workflow, security, agent-rules, performance) + `/dev rules` command + `/dev init` auto-install
- **Test Infrastructure**: vitest config, 6 test files with 98 tests (`detector`, `notion`, `instincts`, `product-brain`, `coordinator`, `handoff-hub`), `validate-plugins.sh` (229 checks), CI workflow
- **Hook System Upgrade**: `post-edit-format.sh` multi-formatter dispatch (prettier/swiftformat/ktlint), `context-warning.sh` strategic compaction triggers, `session-end.sh` cleanup
- **Security Scan Skill**: 10-category deny-rules detection + security guardrails reference
- **Eval Harness Skill**: Session performance evaluation framework with metrics guide
- **Search-First Skill**: Encourage search-before-create thinking pattern
- **Skill Stocktake Skill**: Plugin skill audit with quality criteria
- **Checkpoint Command**: Manual checkpoint creation for session state preservation
- **Migration & Tech-Debt Checklists**: Plan template references for systematic upgrades
- **Path-Scoped Pitfall Templates**: `ios-pitfalls.md` (`**/*.swift`) and `android-pitfalls.md` (`**/*.kt`)
- **Iterative Retrieval Reference**: 4-phase retrieval pattern for implement-plan
- **Spec Generator Skill**: Generate specs from Notion tasks with feature/bug templates
- **Contributing Guide** + PR template for standardized contribution workflow

### Changed

- **Plugin structure**: All 5 plugins unified to `hooks/scripts/` path convention
- **session-summary.sh**: MEMORY.md integration with `## Last Session` section, 200-line-safe trim (minimize section, never cut from top)
- **context-injector.ts**: Added `pitfallsToBullets()` for concise bullet-point pitfalls in Dev Memory section
- **memory.ts**: Added `writeTopicFiles()` and `getAutoMemoryDir()` for consolidate output to markdown
- **detector.ts**: Added `getNotionConfig()` for Notion integration
- **index.ts**: Registered 8 new MCP tools (`dev_instinct`, `dev_inbox`, `dev_spec`, `dev_commit`, `dev_product` + actions)
- **init command**: Added Step 5 for automatic rules template installation
- **utils-plugin/context-warning.sh**: Enhanced with strategic compaction triggers and context zone detection
- **research-plugin & utils-plugin**: Added CLAUDE.md and standardized hooks.json structure

### Stats

- 87 files changed, +10,233 lines
- 22 skills (was 17), 29 commands (was 24), 14 agents, 27 MCP tools (was 19), 15 hooks
- Bundle: 862.1kb
- 6 test files, 98 tests, 229 validation checks

## [5.0.0] - 2026-02-12

### Added

- **5-Gate Execution Pipeline**: Per-task quality gates in implement-plan
  - Gate 1: Fresh subagent per task (context isolation, anti-corruption)
  - Gate 2: 11-point self-review checklist (completeness, quality, discipline, testing)
  - Gate 3: Spec review via new `spec-reviewer` agent (implementation matches plan exactly)
  - Gate 4: Quality review via `code-reviewer` (P0-P3 severity)
  - Gate 5: Batch checkpoint (pause every N tasks for architect coherence check)
- **brainstorm skill**: Independent pre-creative-work exploration via Socratic questioning (extracted from create-plan)
- **verify skill**: Internal skill enforcing "no completion claims without fresh verification evidence" (5-step gate: IDENTIFY → RUN → READ → VERIFY → CLAIM)
- **spec-reviewer agent**: Verifies implementation matches spec exactly with APPROVED/REQUEST CHANGES output
- **`/dev finish` command**: Branch completion with 4 options (merge locally, push & PR, keep, discard)
- **`/dev brainstorm` command**: Trigger brainstorm skill for design exploration
- **Adaptive plan granularity**: logic-task (2-5min, complete code) and ui-task (5-15min, Figma design_ref)
- **Receiving-review reference**: Feedback protocol for handling spec/quality review results
- **API template reference**: `create-plan/references/api-template.md` with NestJS/Fastify checklists

### Changed

- **create-plan**: Narrowed to single Implementation Planning mode (brainstorm extracted), added task granularity evaluation
- **implement-plan**: Restructured with 5-gate pipeline section, batch checkpoint reference
- **agent-team**: Self-review in teammate prompt template, merged spec+quality reviewer, verify skill in Phase 4 Close
- **cross-platform-team**: UI-task spec review in plan reviewer checklist, platform-specific verify in Close, self-review in teammate prompt
- **debugging**: Phase 5 VERIFY now references verify skill protocol
- **implement-agent**: Added 11-point self-review checklist before handoff
- **task-executor.md**: Complete rewrite to 6-step pipeline (Prepare → Implement → Self-Review → Spec Review → Quality Review → Complete)
- **agent-orchestration.md**: Added batch checkpoint mechanism with interval table
- **CSO optimization**: 9 skill descriptions rewritten to state only triggering conditions

### Removed

- **api-implementer skill**: Absorbed into `create-plan/references/api-template.md`
- **Design Exploration mode** from create-plan (now in brainstorm skill)

### Documentation

- CLAUDE.md (root + dev-flow): Updated version, architecture, skill inventory, 5-gate pipeline section
- CHANGELOG.md: Full v5.0.0 release notes
- README.md: Version badge updated

## [4.0.0] - 2026-02-09

### Added

- **4-Tier Progressive Memory System**: Configurable memory tiers in `.dev-flow.json`
  - Tier 0: FTS5 full-text search + save/search/get API (zero cost, pure SQLite)
  - Tier 1: Session auto-summaries via Stop hook (Haiku API or heuristic fallback)
  - Tier 2: ChromaDB semantic search (optional, graceful degradation)
  - Tier 3: Periodic observation capture via PostToolUse hook
- **Memory-Aware Agents/Skills**: 5 agents + 3 skills now auto-query/save knowledge via `dev_memory`
- **New MCP Actions**: `dev_memory` adds `save`, `search`, `get` — 3-layer search pattern
- **FTS5 Synonym Expansion**: 8 default synonym groups (concurrency, auth, crash, performance, ui, network, database, test)
- **ChromaDB Integration** (`embeddings.ts`): Dynamic import, lazy init, graceful fallback to FTS5
- **Session Summary Hook** (`session-summary.sh`): Stop hook generates structured JSON summary
- **Observation Capture Hook** (`observe-batch.sh`): PostToolUse batches N tool uses, classifies via Haiku
- **Heuristic Fallback**: Both hooks work without API key (extract from git log + tool patterns)
- **New DB Tables**: `synonyms`, `session_summaries` + FTS5, `observations` + FTS5

### Changed

- **Setup Hook**: New projects auto-include `"memory": { "tier": 0 }` in `.dev-flow.json`
- **Context Injector**: Budget 2000 → 2500 tokens, adds last session summary injection (500 tokens)
- `hooks/hooks.json`: Added Stop hook + PostToolUse observe-batch entry
- `continuity/index.ts`: Exports embeddings module
- `index.ts`: dev_memory supports 8 actions (was 5), adds text/title/tags/ids/limit params

### Documentation

- GUIDE.md/GUIDE_EN.md: New "Memory System" section with tier docs, init guide, migration guide
- CLAUDE.md: Updated Knowledge System section with tier architecture + config reference
- CHANGELOG.md: Full v4.0.0 release notes

## [3.17.0] - 2026-02-09

### Added

- **Knowledge Consolidation Engine**: Closed-loop `Distill → Consolidate → Inject` system
  - `dev_memory` MCP tool with 5 actions: consolidate, status, query, list, extract
  - Knowledge store at `~/.claude/knowledge/{platforms,patterns,discoveries}/`
  - FTS5 index (`knowledge` + `knowledge_fts` tables) in artifact-index DB
  - Deduplication via substring matching on title + problem fields
- **Reasoning Persistence**: Dual-write reasoning to `thoughts/reasoning/` (git-tracked)
  - FTS5 index (`reasoning` + `reasoning_fts` tables) for full-text search
  - `reasoningRecall` now searches both file system and FTS5 index
- **Smart Context Injection**: SessionStart hook auto-injects relevant knowledge
  - Platform pitfalls (max 800 chars), task-related FTS5 results (max 600 chars), recent discoveries (max 600 chars)
  - Total budget: ~500 tokens per session start
- **Extract-Knowledge command**: `/dev-flow:extract-knowledge` calls `dev_memory(action:"extract")`
  - Scans CLAUDE.md pitfalls, ledger decisions, reasoning patterns, handoff errors
  - Supports `--dry-run` for preview

### Changed

- **Unified Platform Detection**: `detectPlatformSimple()` in `detector.ts` replaces 4 independent implementations
  - `memory.ts`, `context-injector.ts`, SessionStart hook all call the unified function
  - `.dev-flow.json` `platform` field takes highest priority over file-based detection
  - Supports custom platforms (python, rust, go, etc.) via `.dev-flow.json`
- `continuity/reasoning.ts`: Added persistent copy + FTS5 indexing on generate
- `hooks/session-start-continuity.sh`: Added knowledge injection for clear/compact sessions
- MCP tool count: 18 → 19
- `continuity/index.ts`: Exports memory and context-injector modules

## [3.16.0] - 2026-02-07

### Added

- **agent-team skill**: Generic Agent Team orchestration extracted from cross-platform-team
  - 4-phase workflow: Plan → Setup → Execute → Close
  - Model strategy: opus (planning), sonnet (implementation), haiku (quick tasks)
  - Teammate prompt template, error handling, resumable agents
  - `references/team-patterns.md`: Fan-out, Pipeline, Master-Worker, Review-Chain patterns
- **evaluate-agent**: `memory: user` for cross-session baseline comparison
- **verify-agent**: `memory: user` for tracking improvement effects across sessions
- **Task metrics** (v2.1.31+): evaluate-agent extracts `token_count`, `tool_uses`, `duration` per subagent

### Changed

- **cross-platform-team**: Refactored to extend agent-team, removed duplicate orchestration logic (354 → 307 lines)
- **agent-team + cross-platform-team**: Aligned with create-plan/implement-plan features:
  - Plan frontmatter v2.0 awareness (phases metadata, auto-task creation)
  - validate-agent post-plan option
  - `dev_coordinate` conflict detection before parallel execution
  - `dev_aggregate` PR summary in close phase
  - TDD mode reference in teammate prompts
- **meta-iterate**: Added Task metrics as data source for agent efficiency analysis

## [3.15.0] - 2026-02-06

### Added

- **StatusLine Session Isolation**: Agent Team display now isolated per session
  - Primary strategy: Session→team mapping via PostToolUse hooks
  - Fallback strategy: Time-based filtering (5-minute window)
  - Automatic tracking via `TeamCreate`/`TeamDelete` hooks
  - No user configuration required
  - Graceful degradation if mapping file missing/corrupted

### Changed

- `scripts/statusline.sh`: Implemented dual-strategy team filtering in `get_team_line()`
- `hooks/hooks.json`: Added `TeamCreate` and `TeamDelete` PostToolUse hooks

### Fixed

- Multiple sessions using Agent Teams no longer show all teams in StatusLine
- Cross-session Agent Team confusion eliminated

### Documentation

- Added `docs/session-team-mapping.md`: Complete implementation guide
- Updated README.md: Added StatusLine feature section
- Updated CLAUDE.md: Documented session isolation implementation

## [3.14.0] - 2026-02-06

### Added

- Cross-platform team skill for parallel multi-repo development
- Stats tracking at `~/.claude/memory/cross-platform-stats.yaml`

### Changed

- Enhanced StatusLine with token efficiency metrics
- Added extended context display (>200K)
- Added session turn counter and ledger tracking

## [Earlier Versions]

See git history for earlier changes.
