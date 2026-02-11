# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

dev-flow-plugin (v4.1.0) is a Claude Code plugin providing unified development workflow automation: planning → coding → review → commit → PR → release. Features VDD (Verification-Driven Development), multi-layer automated code review (P0-P3 severity), multi-agent collaboration, generic agent-team orchestration, and cross-platform team orchestration. Built-in support for iOS (Swift) and Android (Kotlin), with extensible architecture for Python, Go, Rust, Node and other platforms.

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
.claude-plugin/plugin.json  # Plugin manifest (v4.1.0)
.mcp.json                   # MCP server config → scripts/mcp-server.cjs
skills/                     # 10 skills (SKILL.md + references/)
commands/                   # 22 command definitions (includes /verify, /init, /extract-knowledge, /review)
agents/                     # 12 agent prompts + references/ (security/quality checklists)
hooks/hooks.json            # 6 hook types (PreToolUse x3, SessionStart, PreCompact, Stop, PostToolUse x4)
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
| `dev_commit` | ~30 | Server-enforced commit: prepare → review → finalize |
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

### Hook Debugging

```bash
# Test hook output
echo '{"type":"test"}' | hooks/script.sh

# Suppress stderr to see clean JSON
echo '{"type":"test"}' | hooks/script.sh 2>/dev/null

# Check Node.js hook dependencies
ls -l hooks/dist/*.mjs
```

**Note:** Node.js hooks using `console.error()` can pollute stderr. Use JSON `message` field instead.

### Commit Guard

`commit-guard.sh` blocks ALL raw `git commit` (including chained `git add && git commit`). `/dev commit` bypasses via `DEV_FLOW_COMMIT=1` prefix.

**Hook matcher caveat**: `Bash(git commit*)` only matches commands STARTING with `git commit`. Use `Bash(*git commit*)` to catch chained commands.

### Continuity System

- **Ledgers**: `thoughts/ledgers/CONTINUITY_CLAUDE-*.md` - Track task state across sessions
- **Reasoning**: `.git/claude/commits/<hash>/reasoning.md` + `thoughts/reasoning/<hash>-reasoning.md` - Dual-write for persistence
- **Task Sync**: Bridge ledger state with Claude Code Task Management tools
- Both stored in git for persistence

### Knowledge System (v4.0.0+)

4-tier progressive memory with closed-loop knowledge consolidation. Tier selected interactively during `/dev-flow:init`, upgradeable via `--tier N`:

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

- `PreToolUse(Bash(git commit*))`: Pre-commit knowledge pitfall check (FTS5 query, warns only)
- `PreToolUse(Bash(*git commit*))`: Commit guard — blocks raw `git commit` (including chained), enforces `/dev commit` via `DEV_FLOW_COMMIT=1` prefix
- `SessionStart`: Warn if not initialized + load active ledger + platform knowledge + last session summary + init review session log
- `PreCompact`: Backup transcript before context compaction
- `Stop`: Generate session summary via Haiku or heuristic (Tier 1+)
- `PostToolUse`: Tool counter + dev reminders + periodic observation capture (Tier 3)

### Review System (v4.1.0)

Multi-layer automated code review with P0-P3 severity, integrated at 4 workflow points:

```
/dev commit  → code-reviewer agent (commit-gate: P0/P1 blocks)
/dev review  → code-reviewer agent (standalone: P0-P3 full)
/dev pr      → code-reviewer agent (PR: P0-P3 full)
Agent Team   → reviewer teammate (persistent, cross-module)
```

**Key design**: Review depth decided by code-reviewer agent in isolated context (not by main agent), preventing skip-bias. Agent auto-classifies risk from diff signals (sensitive files, change size, pitfall matches).

**Review Session Log**: `.git/claude/review-session-{branch}.md` — branch-scoped file that accumulates review context across commits. Each code-reviewer spawn reads previous findings before reviewing, enabling cross-commit issue detection without Agent Teams.

**Reference checklists**: `agents/references/security-checklist.md`, `agents/references/code-quality-checklist.md`

### Agent Orchestration

Agents in `agents/` are spawned via Task tool for complex operations:
- `plan-agent.md` - Create implementation plans
- `implement-agent.md` - TDD execution
- `code-reviewer.md` - Multi-dimensional review with P0-P3 severity + review session log
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

## Recent Changes (v4.1.0)

### Multi-Layer Code Review System

**Problem**: dev-flow had 5 review agents (code-reviewer, validate-agent, verify-agent, evaluate-agent, diagnose-agent) and self-check skill, but none were integrated into the main commit/PR workflow. Cross-cutting bugs (Auth+CORS+SSE) shipped undetected.

**Solution**: Automated review at 4 workflow points with P0-P3 severity:

| Point | Mechanism | Depth Decision |
|-------|-----------|---------------|
| `/dev commit` Step 2.5 | code-reviewer agent (isolated context) | Agent auto-classifies risk |
| `/dev review` | code-reviewer agent (standalone) | Full P0-P3 |
| `/dev pr` Step 7 | code-reviewer agent (mandatory) | Agent checks commit coverage |
| Agent Team Phase 4 | reviewer teammate (persistent) | Cross-module accumulated context |

**Key design decisions**:
- Review depth decided by code-reviewer agent, not main agent (prevents skip-bias)
- Branch-scoped review session log (`.git/claude/review-session-{branch}.md`) for cross-commit context
- Pre-commit hook FTS5 pitfall check (fast, warns only)
- Reference checklists: `agents/references/security-checklist.md`, `code-quality-checklist.md`

**New files**: `commands/review.md`, `agents/references/security-checklist.md`, `agents/references/code-quality-checklist.md`, `hooks/commit-guard.sh`

**Modified**: `agents/code-reviewer.md` (rewritten), `commands/commit.md` (Step 2.5 review gate + DEV_FLOW_COMMIT=1), `commands/pr.md` (Step 7 mandatory), `commands/init.md` (interactive tier selection + --tier upgrade + post-init validation), `hooks/hooks.json` (added `Bash(*git commit*)` matcher), `hooks/pre-commit-check.sh` (FTS5 + SQL escape), `hooks/session-start-continuity.sh` (removed auto-setup, warn-only + review log init), `skills/agent-team/SKILL.md` (reviewer teammate), `skills/dev/SKILL.md` (/review command)

### Commit Guard & Init Refactor

**Commit Guard**: `commit-guard.sh` blocks ALL raw `git commit` via `Bash(*git commit*)` matcher (catches chained commands). `/dev commit` bypasses with `DEV_FLOW_COMMIT=1` prefix. Background: prompt-level rules proved insufficient — agent bypassed `/dev commit` 3/4 times in practice.

**Init as Single Source**: SessionStart no longer auto-creates `.dev-flow.json` or `thoughts/` directories. Must run `/dev-flow:init` explicitly. SessionStart warns if not initialized.

**Interactive Tier Selection**: `/dev-flow:init` asks user to choose memory tier (0-3) via AskUserQuestion. `--tier N` flag for lightweight tier upgrade without full re-init. Post-init auto-validates DB and installs ChromaDB for tier 2+.
