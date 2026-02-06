# Changelog

All notable changes to dev-flow-plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

Author: lazyman

## [3.12.0] - 2026-01-27

### Added

- **VDD (Verification-Driven Development)**
  - `/dev-flow:verify` command for lint + typecheck + tests
  - Platform configs now include `testCmd` and `verifyCmd`
  - Machine judges completion via exit code 0

- **Multi-Agent Coordination**
  - `dev_coordinate` tool for task planning and dispatch
  - `dev_handoff` tool for agent handoff documents
  - `dev_aggregate` tool for aggregating multi-agent results
  - New `coordination/` module in MCP server

- **Knowledge Base**
  - Cross-project knowledge at `~/.claude/knowledge/`
  - `/dev-flow:extract-knowledge` command
  - Auto-load platform pitfalls at session start
  - Structure: platforms/, patterns/, discoveries/

- **Documentation**
  - `docs/GUIDE.md` - Chinese complete guide (~600 lines)
  - `docs/GUIDE_EN.md` - English complete guide (~550 lines)
  - `CONTRIBUTING.md` - Contribution guidelines
  - README restructured with badges and collapsible sections

### Changed

- MCP tools: 14 → 18
- Commands: 18 → 21
- Platform configs extended with test/verify
- README in mainstream open-source style

### Fixed

- Background agent permission handling
- zoxide alias compatibility in hooks

## [3.11.0] - 2026-01-24

### Added
- `skills/dev/references/mcp-tools.md` - Complete MCP tools reference (170 lines)
- Added 4 missing tools to README MCP table: `dev_fix`, `dev_changes`, `dev_config`, `dev_ready`

### Changed
- **dev skill**: Adopted Reference File Architecture pattern
- Simplified MCP Tools table in `skills/dev/SKILL.md` (moved details to references/)
- Updated README.md MCP tools table (10 → 14 tools)

### Documentation
- Updated plugin version to 3.11.0

## [3.10.0] - 2026-01-23

### Added
- **Task Management Integration**: Bridge Continuity Ledger with Claude Code Task Management
- `dev_tasks` MCP tool with summary/export/sync actions
- `/dev-flow:tasks` command for task synchronization
- `continuity/task-sync.ts` module for bidirectional sync
- Task management best practices in `references/task-management.md`

### Changed
- Updated 5 skills with Task Management allowed-tools (TaskCreate, TaskUpdate, TaskList, TaskGet)
- Replaced TodoWrite with native Task Management tools
- Updated CLAUDE.md with new tool documentation

### Skills Updated
- implement_plan, create_plan, meta-iterate, config-optimize, implement_task

## [3.7.1] - 2026-01-12

### Fixed
- Remove `"hooks"` field from `plugin.json` to avoid duplicate hooks loading error
- Hooks now use standard path auto-loading mechanism

### Documentation
- Add Hooks section to README explaining auto-enabled features
- Clarify that hooks work automatically without user configuration

## [3.7.0] - 2026-01-12

### Changed
- **BREAKING**: Rename command files from `dev-*.md` to `*.md` (shorter names)
- Update README.md to use full skill names (`/dev-flow:dev` instead of `/dev`)
- Simplify hooks.json configuration

### Added
- CLAUDE.md project documentation for Claude Code

## [3.6.2] - 2026-01-11

### Changed
- Bundle MCP server to single `scripts/mcp-server.cjs` file using esbuild
- No more TypeScript compilation required on plugin install
- Update `.mcp.json` to use bundled file

### Fixed
- Plugin installation failure when `mcp-server/dist/` not compiled

## [3.6.1] - 2026-01-11

### Added
- Complete hooks to plugin: dev-workflow.sh, session-start-continuity.sh, pre-compact.sh
- Self-contained hook configuration in hooks.json

## [3.6.0] - 2026-01-11

### Added
- Subagent optimization patterns from official documentation
- `context: fork` to meta-iterate, validate-agent skills
- `model` selection to dev skill (sonnet)
- `user-invocable: false` to internal helper skills
- Reference File Architecture for all major skills
- `docs/OPTIMIZATION_GUIDE.md` - comprehensive optimization patterns
- `docs/SUBAGENT_PATTERNS.md` - subagent best practices

### Changed
- Optimized skill SKILL.md files (60-80% line reduction)
- Moved detailed content to `references/` directories
- Updated frontmatter with official best practices

## [3.5.0] - 2026-01-10

### Added
- `/config-optimize` skill for tracking Claude Code updates
- Reference File Architecture pattern
- Progressive loading for skills

### Changed
- Restructured major skills with references/ directories
- create_plan: 486 → 97 lines
- implement_plan: 316 → 106 lines
- implement_task: 297 → 84 lines
- validate-agent: 254 → 100 lines

## [3.1.0] - 2026-01-08

### Added
- `/meta-iterate` skill for self-improvement workflow
- 5-phase iteration: evaluate → diagnose → propose → apply → verify
- Meta-iterate agents: evaluate, diagnose, propose, apply, verify
- `thoughts/schema/` templates for structured outputs
- Session analysis integration with Braintrust

### Changed
- Enhanced agent orchestration patterns
- Improved handoff chain mechanism

## [3.0.0] - 2026-01-05

### Added
- Agent orchestration for complex implementations
- Continuity ledgers for task tracking
- Reasoning documentation for commits
- TDD workflow integration

### Changed
- Unified `/dev-flow:` command interface
- Platform-agnostic design (iOS, Android, Web)

## [2.0.0] - 2025-12-20

### Added
- MCP server integration (dev-flow-mcp)
- Token-optimized tools (dev_status, dev_flow, etc.)
- Automated scope inference
- PR description generation

## [1.0.0] - 2025-12-01

### Added
- Initial release
- Basic `/dev-flow:commit`, `/dev-flow:pr`, `/dev-flow:release` commands
- Git workflow automation
