# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

dev-flow-plugin (v4.0.0) is a Claude Code plugin providing unified development workflow automation: planning → coding → commit → PR → release. Features VDD (Verification-Driven Development), multi-agent collaboration, generic agent-team orchestration, and cross-platform team orchestration. Built-in support for iOS (Swift) and Android (Kotlin), with extensible architecture for Python, Go, Rust, Node and other platforms.

## Build & Development

```bash
# MCP Server (use --prefix to avoid cd alias issues)
npm install --prefix mcp-server
npm run --prefix mcp-server bundle    # Bundle to scripts/mcp-server.cjs (required for plugin)
npm run --prefix mcp-server build     # TypeScript compile to dist/ (for development)
npm run --prefix mcp-server dev       # Run with ts-node

# Tests exist (coordination/*.test.ts) but no test runner configured yet
```

## Architecture

### Plugin Structure

```
.claude-plugin/plugin.json  # Plugin manifest (v4.0.0)
.mcp.json                   # MCP server config → scripts/mcp-server.cjs
skills/                     # 9 skills (SKILL.md + references/)
commands/                   # 21 command definitions (includes /verify, /init, /extract-knowledge)
agents/                     # 12 agent prompts
hooks/hooks.json            # 6 hook types (PreToolUse, Setup, SessionStart, PreCompact, Stop, PostToolUse)
scripts/track-team.sh       # Session→team mapping for StatusLine (PostToolUse: TeamCreate/TeamDelete)
templates/thoughts/schema/  # JSON schemas for meta-iterate and handoff outputs
docs/                       # keybindings.md, hooks-setup.md
```

### MCP Server (mcp-server/src/)

Single-file bundle architecture using `@modelcontextprotocol/sdk`:

| Module | Purpose |
|--------|---------|
| `index.ts` | Server entry, 19 MCP tools |
| `detector.ts` | Project type detection + unified `detectPlatformSimple()` |
| `git/workflow.ts` | Git status, phase detection |
| `git/build-control.ts` | PR draft/ready, change analysis |
| `git/version.ts` | Version info, release notes |
| `platforms/ios.ts` | SwiftLint, SwiftFormat, test/verify |
| `platforms/android.ts` | ktlint, ktfmt, test/verify |
| `continuity/` | Ledgers, reasoning, branch, task-sync, memory, context-injector, embeddings |
| `coordination/` | Multi-agent coordination, handoffs, aggregation |

### Platform Extension

To add a new platform (e.g., Python, Go, Rust):

1. **Update `detector.ts`**: Add detection logic based on project files
2. **Create `platforms/xxx.ts`**: Implement lint/format/build commands

```typescript
// Example: platforms/python.ts
export function getPythonCommands(): PlatformCommands {
  return {
    lint: 'ruff check .',
    format: 'black .',
    check: 'ruff check . && mypy .'
  };
}
```

| Platform | Detection Files | Lint | Format |
|----------|----------------|------|--------|
| iOS | `*.xcodeproj`, `Podfile` | SwiftLint | SwiftFormat |
| Android | `build.gradle`, `AndroidManifest.xml` | ktlint | ktfmt |
| Python | `pyproject.toml`, `requirements.txt` | ruff, mypy | black |
| Go | `go.mod` | golangci-lint | gofmt |
| Rust | `Cargo.toml` | clippy | rustfmt |
| Node | `package.json` | eslint | prettier |

### Key MCP Tools

| Tool | Tokens | Purpose |
|------|--------|---------|
| `dev_status` | ~30 | Quick status: `PHASE\|✅0\|next` |
| `dev_flow` | ~100 | Full status table |
| `dev_config` | ~50 | Platform commands with test/verify (auto-detected) |
| `dev_ledger` | ~50 | Task continuity management |
| `dev_tasks` | ~30 | Sync ledger with Task Management |
| `dev_defaults` | ~20 | Auto-infer scope from changes |
| `dev_coordinate` | ~40 | Multi-agent task planning/dispatch |
| `dev_handoff` | ~50 | Handoff document management |
| `dev_aggregate` | ~60 | Aggregate results for PR |
| `dev_memory` | ~60 | Knowledge: consolidate/status/query/list/extract/save/search/get |

### Workflow Phases

```
IDLE → DEVELOPING → READY_TO_PUSH → WAITING_QA → PR_OPEN → READY_TO_RELEASE
```

### Skill Architecture Pattern

Skills use Reference File Architecture for progressive loading:

```
skill/
├── SKILL.md           # < 150 lines, frontmatter + overview
└── references/        # Detailed docs loaded on demand
```

Required frontmatter:
```yaml
---
name: skill-name
description: What it does. Use when "[triggers]", "[中文触发词]".
allowed-tools: [specific, tools, only]
---
```

## Plugin Manifest Rules

**Unsupported fields** (will cause validation error):
- `bundledMcpServers` - Use `mcpServers: "./.mcp.json"` instead
- `agents` - Auto-discovered from agents/ directory
- `hooks` - Auto-discovered from hooks/hooks.json

## Key Patterns

### Continuity System

- **Ledgers**: `thoughts/ledgers/CONTINUITY_CLAUDE-*.md` - Track task state across sessions
- **Reasoning**: `.git/claude/commits/<hash>/reasoning.md` + `thoughts/reasoning/<hash>-reasoning.md` - Dual-write for persistence
- **Task Sync**: Bridge ledger state with Claude Code Task Management tools
- Both stored in git for persistence

### Knowledge System (v4.0.0)

4-tier progressive memory with closed-loop knowledge consolidation:

```
Session → [auto-handoff] → [dev_memory consolidate] → Knowledge → [SessionStart inject] → Next Session
                                                         ↑
                                    Stop hook → session summary (Tier 1)
                                    PostToolUse → observations (Tier 3)
```

**Tier Architecture**:

| Tier | Features | Cost | Dependencies |
|------|----------|------|-------------|
| 0 | FTS5 search, save/search/get, synonyms | 0 | None |
| 1 | + Session summaries (Stop hook) | ~$0.001/sess | Optional API key |
| 2 | + ChromaDB semantic search | Same | + chromadb |
| 3 | + Periodic observation capture | ~$0.005/sess | Same as Tier 1 |

**Components**:
- **Knowledge Store**: `~/.claude/knowledge/{platforms,patterns,discoveries}/`
- **FTS5 Index**: `.claude/cache/artifact-index/context.db` (knowledge, reasoning, synonyms, session_summaries, observations)
- **Smart Injection**: SessionStart injects pitfalls + task knowledge + last session summary (budget: ~2500 tokens)
- **Synonym Expansion**: 8 default synonym groups for query enhancement
- **ChromaDB**: Optional semantic search via dynamic import, graceful degradation
- **Extract**: `/dev-flow:extract-knowledge` scans CLAUDE.md pitfalls, ledger decisions, reasoning patterns

**Configuration** (`.dev-flow.json`):
```json
{
  "memory": {
    "tier": 0,
    "sessionSummary": false,
    "chromadb": false,
    "periodicCapture": false,
    "captureInterval": 10
  }
}
```

### Hook Integration

- `PreToolUse(Bash(git commit*))`: Block raw git commit, enforce /dev commit
- `Setup`: Initialize dev-flow environment + memory config on first run
- `SessionStart`: Load active ledger + platform knowledge + last session summary
- `PreCompact`: Backup transcript before context compaction
- `Stop`: Generate session summary via Haiku or heuristic (Tier 1+)
- `PostToolUse`: Tool counter + dev reminders + periodic observation capture (Tier 3)

### Agent Orchestration

Agents in `agents/` are spawned via Task tool for complex operations:
- `plan-agent.md` - Create implementation plans
- `implement-agent.md` - TDD execution
- `code-reviewer.md` - PR review
- `evaluate/diagnose/propose/apply/verify-agent.md` - Meta-iterate cycle
- `validate-agent.md` - Validate plan tech choices
- `pr-describer.md` - Generate PR descriptions
- `reasoning-generator.md` - Commit reasoning documentation

## Conventions

- Commit messages: `type(scope): subject` (Conventional Commits)
- Scope auto-inferred via `dev_defaults(action="scope")`
- All `/dev-flow:*` commands use MCP tools internally
- Platform detection: `.dev-flow.json` > file-based auto-detect (`detectPlatformSimple()` unified entry)
- **No Makefile required**: `dev_config` returns platform-specific commands automatically

## Command Adaptation

The `dev_config` MCP tool returns platform-specific commands with this priority:

```
1. .dev-flow.json (project config) → highest priority
2. Makefile with fix/check targets → second priority
3. Auto-detect (iOS/Android) → fallback
```

### Custom Platform via .dev-flow.json

Users can add any platform support without modifying plugin code:

```json
{
  "platform": "python",
  "commands": {
    "fix": "black . && ruff check --fix .",
    "check": "ruff check . && mypy ."
  },
  "scopes": ["api", "models", "utils"]
}
```

### Makefile Convention

If project has `Makefile` with `fix:` and `check:` targets, plugin uses `make fix/check` automatically.

### Output Format

```
dev_config → python|fix:black .|check:ruff .|scopes:api,models|src:custom
           → makefile|fix:make fix|check:make check|scopes:|src:Makefile
           → ios|fix:swiftlint --fix|check:swiftlint|scopes:...|src:auto
```

## Recent Changes (v3.15.0)

### StatusLine Session Isolation

**Problem**: StatusLine displayed all Agent Teams across sessions, causing confusion when multiple sessions were active.

**Solution**: Implemented dual-strategy session isolation:

1. **Primary**: Session→team mapping via `PostToolUse` hooks
   - `TeamCreate` → `track-team.sh create` → writes mapping
   - `TeamDelete` → `track-team.sh delete` → clears mapping
   - Mapping stored in `~/.claude/state/dev-flow/session_teams.json`

2. **Fallback**: Time-based filter (5-minute window)
   - Activated if mapping file missing/corrupted
   - Ensures StatusLine always works

**Files Modified**:
- `scripts/statusline.sh`: Updated `get_team_line()` with dual-strategy logic
- `hooks/hooks.json`: Added `TeamCreate`/`TeamDelete` PostToolUse hooks
- `scripts/track-team.sh`: New hook script for mapping management
- `docs/session-team-mapping.md`: Complete implementation guide

**Impact**: Each session now sees only its own Agent Team, preventing cross-session confusion.

**Automatic**: No user configuration required, works out-of-the-box.
