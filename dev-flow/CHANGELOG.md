# Changelog

All notable changes to dev-flow plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
