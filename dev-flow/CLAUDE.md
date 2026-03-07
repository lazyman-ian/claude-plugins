# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

dev-flow-plugin (v7.0.0) is a Claude Code plugin providing unified development workflow automation: brainstorm → plan → implement (5-gate pipeline) → review → commit → PR → release. Features VDD (Verification-Driven Development), 5-gate execution pipeline, Agentic Engineering (autonomous execution with task contracts, proof manifests, and decision agent routing), closed-loop learning engine (Ledger v2 + adaptive execution), Ralph Loop integration, multi-layer automated code review (P0-P3), Markdown-first knowledge vault with SQLite FTS5 search, Notion pipeline (task triage → spec generation), product brain (architecture knowledge), rules distribution system, multi-agent collaboration, and cross-platform team orchestration. Built-in support for iOS (Swift) and Android (Kotlin), with extensible architecture for Python, Go, Rust, Node and other platforms.

## Build & Development

```bash
# MCP Server (use --prefix to avoid cd alias issues)
npm install --prefix mcp-server
npm run --prefix mcp-server bundle    # Bundle to scripts/mcp-server.cjs (required for plugin)
npm run --prefix mcp-server build     # TypeScript compile to dist/ (for development)
npm run --prefix mcp-server dev       # Run with ts-node

# Run tests (vitest)
npm test --prefix mcp-server                  # All 176 tests
```

## Architecture

### Plugin Structure

```
.claude-plugin/plugin.json  # Plugin manifest (v7.0.0)
.mcp.json                   # MCP server config → scripts/mcp-server.cjs
skills/                     # 25 skills (SKILL.md + references/)
commands/                   # 30 command definitions
agents/                     # 14 agent prompts + references/ (security/quality checklists)
hooks/hooks.json            # 20 hooks across 9 types (PreToolUse, PostToolUse, SessionStart, SessionEnd, PreCompact, Stop, SubagentStart, UserPromptSubmit, TaskCompleted)
scripts/track-team.sh       # Session→team mapping for StatusLine
templates/rules/            # 12 rule templates (platform-aware, path-scoped)
templates/thoughts/schema/  # JSON schemas for meta-iterate and handoff outputs
docs/                       # keybindings.md, hooks-setup.md
```

### MCP Server (mcp-server/src/)

Single-file bundle architecture using `@modelcontextprotocol/sdk`:

| Module | Purpose |
|--------|---------|
| `index.ts` | Server entry, 21 MCP tools |
| `detector.ts` | Project type detection + unified `detectPlatformSimple()` + Notion config |
| `notion.ts` | Notion integration: config, inbox filter, spec extraction |
| `git/workflow.ts` | Git status, phase detection |
| `git/build-control.ts` | PR draft/ready, change analysis |
| `git/version.ts` | Version info, release notes |
| `platforms/ios.ts` | SwiftLint, SwiftFormat, test/verify |
| `platforms/android.ts` | ktlint, ktfmt, test/verify |
| `continuity/` | Ledgers, branch, defaults, task-sync, memory, context-injector, execution-report |
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
| `dev_memory` | ~60 | Knowledge vault: save/search/get/list/prune/reindex |
| `dev_inbox` | ~40 | Notion task triage with priority filtering |
| `dev_spec` | ~50 | Spec generation from Notion tasks |

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
- **Task Sync**: Bridge ledger state with Claude Code Task Management tools
- Stored in git for persistence

### Knowledge System

Markdown-first knowledge vault with SQLite FTS5 search index.

```
Obsidian Vault (.md files)  ← source of truth, human-editable
        ↓ (auto-index)
SQLite FTS5 (index)         ← fast search
        ↓ (SessionStart)
Auto Memory (MEMORY.md)     ← Claude session injection
```

**Vault structure**: `thoughts/knowledge/{pitfalls,patterns,decisions,habits}/*.md`

**Each entry**: YAML frontmatter with type, priority (critical/important/reference), platform, tags, created, access_count.

**Priority + decay**:
- Score: `priority_weight × temporal_decay(30-day half-life)`
- Auto-promote: `access_count >= 3` → critical
- Auto-demote: `important + 0 access + >90 days` → reference
- Auto-archive: `reference + 0 access + >90 days` → `.archive/`

**Quality gate**: Rejects vague entries (regex + Type-Token Ratio, no LLM).

**Write triggers**: Stop hook, commit time, AI proactive save, user manual — all through quality gate + smart dedup.

**Read**: SessionStart injects `priority='critical'` entries only (context diet). On-demand via `dev_memory(search)`.

**Configuration** (`.dev-flow.json`):
```json
{
  "memory": {
    "vault": "thoughts/knowledge"
  }
}
```

### Hook Integration

- `PreToolUse(Bash(git commit*))`: Pre-commit knowledge pitfall check (FTS5 query, warns only)
- `PreToolUse(Bash(*git commit*))`: Commit guard — blocks raw `git commit` (including chained), enforces `/dev commit` via `DEV_FLOW_COMMIT=1` prefix
- `SessionStart`: Warn if not initialized + load active ledger + inject critical knowledge from vault (priority='critical' only) + init review session log + detect resume directive
- `PreCompact`: Backup transcript before context compaction
- `Stop`: Save session learnings to knowledge vault (quality gate filtered)
- `PostToolUse`: Tool counter + dev reminders

### Review System (v4.1.0)

Multi-layer automated code review with P0-P3 severity, integrated at 4 workflow points:

```
/dev simplify         → AI auto: /simplify (light) or code-simplifier@anthropics (deep)
/dev commit           → code-reviewer (commit-gate: P0/P1 blocks)
/dev commit --simplify → AI auto: simplify → code-reviewer → commit
/dev review           → dev-flow reviewer + AI auto: 官方专项 agents (按信号触发)
/dev pr               → dev-flow reviewer + AI auto: 专项 agents + GH comment (按信号触发)
Agent Team            → reviewer teammate (persistent, cross-module)
```

AI 根据变更信号（文件类型、改动规模、error patterns）自主决策调用哪些官方 plugin agents。
未安装的 plugin 静默跳过。详见各 command 定义中的信号表。

**Key design**: Review depth decided by code-reviewer agent in isolated context (not by main agent), preventing skip-bias. Agent auto-classifies risk from diff signals (sensitive files, change size, pitfall matches).

**Review Session Log**: `.git/claude/review-session-{branch}.md` — branch-scoped file that accumulates review context across commits. Each code-reviewer spawn reads previous findings before reviewing, enabling cross-commit issue detection without Agent Teams.

**Reference checklists**: `agents/references/security-checklist.md`, `agents/references/code-quality-checklist.md`

### 5-Gate Execution Pipeline (v5.0.0)

Per-task quality gates in implement-plan:

```
Plan Task → [Figma Pre-fetch] → Fresh Subagent → Self-Review → Spec Review → [UI Verify] → Quality Review
```

| Gate | Agent/Skill | Purpose |
|------|-------------|---------|
| 0. Figma Pre-fetch | Figma MCP (orchestrator) | Fetch design specs for ui-task (inject into subagent prompt) |
| 1. Fresh Subagent | implement-agent | Context isolation, anti-corruption |
| 2. Self-Review | (built-in) | 11-point checklist before reporting done |
| 3. Spec Review | spec-reviewer | Implementation matches plan exactly |
| 3.5 UI Verify | ui-verify skill | Measure rendered CSS vs Figma specs (ui-task only) |
| 4. Quality Review | code-reviewer | P0-P3 code quality |
| 5. Batch Checkpoint | (orchestrator) | Pause every N tasks for coherence check |

### Agent Orchestration

Agents in `agents/` are spawned via Task tool for complex operations:
- `plan-agent.md` - Create implementation plans
- `implement-agent.md` - TDD execution + 11-point self-review
- `spec-reviewer.md` - Verify implementation matches spec exactly
- `code-reviewer.md` - Multi-dimensional review with P0-P3 severity + review session log
- `evaluate/diagnose/propose/apply/verify-agent.md` - Meta-iterate cycle
- `validate-agent.md` - Validate plan tech choices
- `decision-agent.md` - Runtime uncertainty routing (Sonnet, fork context)
- `pr-describer.md` - Generate PR descriptions

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

## Recent Changes (v7.0.0)

### Closed-Loop Learning Engine
- **Ledger v2**: Structured task state with gate tracking (`gates: self:pass spec:fail>pass(r1: err)`), retry counts, timestamps
- **Adaptive Execution Engine**: L1 hooks enforce scope/context limits; L2 decision-agent routes uncertainty; L3 human escalation for security/architecture
- **Execution Report**: `continuity/execution-report.ts` generates `.proof/execution-report.md` from ledger gate data — task completion, gate pass rates, self-healing stats, top pitfalls
- **Generalized Scope Inference**: `defaults.ts` reads `scopes` from `.dev-flow.json` (primary) or infers from top-level directory structure (fallback); no hardcoded project-specific patterns

### Agentic Engineering (v6.3.0)
- **Task Contracts**: Plan tasks include `contract:` with explicit acceptance criteria and `autonomy: 1|2` levels
- **Proof Manifest**: Structured evidence per task at `.proof/{task-id}.json` (verdict, commands, diff_stats)
- **Decision Agent**: Lightweight Sonnet agent (`decision-agent.md`) for runtime uncertainty routing — security/architecture escalates to human
- **Three-Layer Decision Architecture**: L1 Environment auto-judge → L2 Decision Agent (Sonnet) → L3 Human (PR only)
- **Self-Healing Retry**: verify fail → diagnose → fix implementation (never modify verify command) → re-verify (max 2)
- **Silent Execution**: No explanatory text during implementation; output only at milestones or final
- **Auto-Resume**: `thoughts/ledgers/.resume-directive.md` written by context-handoff, injected by SessionStart
- **Context Diet**: SessionStart injects only `priority='critical'` knowledge entries

### Ralph Loop Integration
- **ralph-implement command**: Bridge `/dev ralph-implement [plan-path]` reads plan → extracts tasks/contracts → generates Ralph prompt
- **Ralph Loop Mode**: implement-plan execution mode using Stop hook re-injection for iterative completion
- Reference: `skills/implement-plan/references/ralph-loop-mode.md`

### Notion Pipeline
Task triage (`/dev inbox`), spec generation (`/dev spec`), and post-merge Notion status update hook. Configured via `notion` section in `.dev-flow.json`.

### Knowledge Vault
- Markdown-first storage in `thoughts/knowledge/` — human-editable, git-tracked
- SQLite FTS5 index for fast search with temporal decay scoring
- Priority levels (critical/important/reference) with auto-promote/demote
- Quality gate rejects vague entries (regex + Type-Token Ratio)
- Path-scoped pitfall templates: `ios-pitfalls.md` (`**/*.swift`), `android-pitfalls.md` (`**/*.kt`)

### Infrastructure
- vitest + 176 tests across 12 files
- `validate-plugins.sh` (229 structural checks)
- CI workflow (`.github/workflows/ci.yml`)
- Hook system: post-edit-format multi-formatter, context-warning strategic compaction, session-end cleanup
