<p align="center">
  <img src="docs/assets/logo.svg" alt="dev-flow" width="120" height="120">
</p>

<h1 align="center">dev-flow</h1>

<p align="center">
  <strong>Autonomous Development Workflow for Claude Code</strong>
</p>

<p align="center">
  brainstorm → plan → implement → review → commit → PR → release
</p>

<p align="center">
  <a href="#installation">Installation</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#features">Features</a> •
  <a href="#documentation">Docs</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-7.1.0-blue.svg" alt="Version">
  <img src="https://img.shields.io/badge/Claude_Code-2.1.19+-purple.svg" alt="Claude Code">
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License">
  <img src="https://img.shields.io/badge/platforms-iOS%20%7C%20Android%20%7C%20Custom-orange.svg" alt="Platforms">
  <img src="https://img.shields.io/badge/MCP_Tools-21-brightgreen.svg" alt="MCP Tools">
</p>

<p align="center">
  <a href="./docs/GUIDE.md">中文文档</a> |
  <a href="./docs/GUIDE_EN.md">English Guide</a>
</p>

---

## Features

| Feature | Description |
|---------|-------------|
| **Autonomous Pipeline** | `/dev start --auto` → spec → validate → plan → implement → review gate → PR |
| **5-Gate Execution** | Per-task quality gates: Fresh Subagent → Self-Review → Spec Review → Quality Review → Verify |
| **Agentic Engineering** | Task contracts, proof manifests, decision agent routing, self-healing retry |
| **VDD** | Verification-Driven Development — exit code 0 = done, machine judges completion |
| **Multi-layer Review** | P0-P3 severity, branch-scoped review session log, commit gate |
| **Knowledge Vault** | Markdown-first `thoughts/knowledge/`, SQLite FTS5 search, priority + decay scoring |
| **Ledger State** | Cross-session task tracking with gate history and retry counts |
| **Multi-Agent** | `dev_coordinate` + `dev_handoff` + `dev_aggregate` for complex parallel tasks |
| **Cross-Platform Teams** | Agent Teams for parallel multi-repo development (iOS/Android/Web) |
| **Notion Pipeline** | `/dev inbox` task triage + `/dev spec` spec generation |
| **Rules Distribution** | 12 platform-aware rule templates for `.claude/rules/` |
| **Ralph Loop** | Stop-hook re-injection for iterative plan completion |
| **Meta-Iterate** | Self-improvement cycle: analyze sessions → iterate prompts |

## Installation

### From Marketplace

```
/plugin marketplace add lazyman-ian/claude-plugins
/plugin install dev-flow@lazyman-ian
```

### Verify

```bash
/plugin  # Check plugin load status
/dev     # Test dev workflow
```

### Initialize Project

```bash
/dev-flow:init   # Creates .dev-flow.json + thoughts/ directories
```

See [INSTALL.md](../INSTALL.md) for full installation guide.

## Quick Start

### Standard Workflow

```bash
# Start task (creates branch + ledger)
/dev-flow:start TASK-001 "Implement user login"

# Plan (optional but recommended)
/dev-flow:plan

# Implement
/dev-flow:implement

# Commit + PR
/dev-flow:commit
/dev-flow:pr
```

### Autonomous Pipeline (v7.1.0)

```bash
# Full pipeline — human only at entry and exit
/dev-flow:start "Implement user login with JWT" --auto
```

```
/dev start "requirements" --auto
    │
    ▼
Source Detection (Notion URL / File / URL / Plain Text)
    │
    ▼
spec-generator → spec-validator
  validate-spec.sh (5 checks) + detect-escalation.sh (5 rules)
  PASS → continue │ FAIL → self-heal (2x) │ ESCALATE → wait human
    │
    ▼
create-plan → validate-agent (mandatory)
  VALIDATED → continue │ MUST CHANGE → stop, wait human
    │
    ▼
implement-plan (5-gate pipeline)
  per-task: subagent → self-review → spec-review → quality-review → verify
  verify pass → .proof/ → commit → next task
    │
    ▼
Review Gate Loop
  P0/P1 → fix → re-review (max 3 rounds)
  P2/P3 → PR notes │ clean → /dev pr
    │
    ▼
Human: PR Review + Merge
```

## Commands

### Core Workflow

| Command | Description |
|---------|-------------|
| `/dev-flow:dev` | Status + next step suggestion |
| `/dev-flow:start` | Start task (branch + ledger) |
| `/dev-flow:brainstorm` | Exploration session |
| `/dev-flow:plan` | Create implementation plan |
| `/dev-flow:validate` | Validate tech choices |
| `/dev-flow:implement` | Execute plan (5-gate pipeline) |
| `/dev-flow:verify` | VDD verification (lint + test) |
| `/dev-flow:commit` | Smart commit with review gate |
| `/dev-flow:pr` | Create PR with review |
| `/dev-flow:release` | Release with changelog |
| `/dev-flow:review` | Standalone code review |

<details>
<summary><strong>All 30 Commands</strong></summary>

| Command | Description |
|---------|-------------|
| `dev` | Status + suggestions |
| `start` | Start task |
| `plan` | Create plan |
| `validate` | Validate plan |
| `implement` | Execute plan |
| `verify` | VDD verification |
| `commit` | Smart commit |
| `pr` | Create PR |
| `release` | Release version |
| `brainstorm` | Exploration session |
| `review` | Code review |
| `ledger` | State management |
| `tasks` | Task sync |
| `recall` | Search history |
| `describe` | PR description |
| `tokens` | Token analysis |
| `deps` | Dependency check |
| `switch` | Smart branch switch |
| `cleanup` | Clean merged branches |
| `extract-knowledge` | Extract knowledge |
| `config-optimize` | Optimize Claude config |
| `meta-iterate` | Self-improvement cycle |
| `init` | Initialize project |
| `inbox` | Notion task triage |
| `spec` | Generate spec from task |
| `rules` | Install rule templates |
| `checkpoint` | Manual checkpoint |
| `finish` | Branch completion |
| `ralph-implement` | Ralph Loop execution |
| `simplify` | Code simplification |

</details>

## VDD (Verification-Driven Development)

Machine judges completion, not Agent.

| Traditional | VDD |
|-------------|-----|
| "Fix this bug" | "Fix bug. `npm test auth` exits 0." |
| Agent says "done" | exit code 0 says done |

```bash
/dev-flow:verify              # Full: lint + typecheck + test
/dev-flow:verify --test-only  # Tests only
/dev-flow:verify --lint-only  # Lint only
```

## MCP Tools

21 tools for workflow automation.

<details>
<summary><strong>Core (11)</strong></summary>

| Tool | Tokens | Purpose |
|------|--------|---------|
| `dev_status` | ~30 | Quick status |
| `dev_flow` | ~100 | Detailed status |
| `dev_check` | ~10 | CI-ready check |
| `dev_fix` | ~20 | Get fix commands |
| `dev_next` | ~15 | Next step suggestion |
| `dev_changes` | ~50 | Analyze changes |
| `dev_config` | ~50 | Platform config |
| `dev_ready` | ~20 | PR status control |
| `dev_version` | ~30 | Version info |
| `dev_commits` | ~100 | Commit grouping |
| `dev_defaults` | ~20 | Smart defaults |

</details>

<details>
<summary><strong>Continuity & Knowledge (4)</strong></summary>

| Tool | Tokens | Purpose |
|------|--------|---------|
| `dev_ledger` | ~50 | Cross-session task state |
| `dev_tasks` | ~30 | Task Management sync |
| `dev_memory` | ~60 | Knowledge vault: save/search/get/list/prune/reindex |
| `dev_commit` | ~30 | Server-enforced commit pipeline |

</details>

<details>
<summary><strong>Multi-Agent (3)</strong></summary>

| Tool | Tokens | Purpose |
|------|--------|---------|
| `dev_coordinate` | ~40 | Task planning & dispatch |
| `dev_handoff` | ~50 | Agent handoff documents |
| `dev_aggregate` | ~60 | Aggregate results for PR |

</details>

<details>
<summary><strong>Branch & Notion (3)</strong></summary>

| Tool | Tokens | Purpose |
|------|--------|---------|
| `dev_branch` | ~30 | Branch lifecycle |
| `dev_inbox` | ~40 | Notion task triage |
| `dev_spec` | ~50 | Spec generation from Notion tasks |

</details>

## StatusLine

Real-time workflow context in the Claude Code status bar.

```
Son ██████░░░░ 60% | ● DEV | main ~3 +1
in:45K out:12K | +123 -45 | cache:75%
✓ 3/5 (60%) →1 ⏳1
turn:12 | ▶ Auth Module → Phase 2
```

Add to `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "~/.claude/plugins/marketplaces/lazyman-ian/dev-flow/scripts/statusline.sh",
    "padding": 0
  }
}
```

## Platform Support

| Platform | Detection | Lint | Format |
|----------|-----------|------|--------|
| **iOS** | `*.xcodeproj`, `Podfile` | SwiftLint | SwiftFormat |
| **Android** | `build.gradle` | ktlint | ktfmt |
| **Custom** | `.dev-flow.json` | any | any |

Custom platform via `.dev-flow.json`:

```json
{
  "platform": "python",
  "commands": {
    "fix": "black . && ruff check --fix .",
    "check": "ruff check . && mypy .",
    "test": "pytest",
    "verify": "ruff check . && mypy . && pytest"
  },
  "scopes": ["api", "models", "utils"]
}
```

<details>
<summary><strong>More Platform Examples</strong></summary>

**Go**
```json
{"platform":"go","commands":{"fix":"gofmt -w .","check":"golangci-lint run","test":"go test ./..."}}
```

**Rust**
```json
{"platform":"rust","commands":{"fix":"cargo fmt","check":"cargo clippy","test":"cargo test"}}
```

**Node**
```json
{"platform":"node","commands":{"fix":"prettier -w .","check":"eslint .","test":"npm test"}}
```

</details>

Detection priority: `.dev-flow.json` > Makefile > file-based auto-detect.

## Architecture

```
dev-flow/
├── .claude-plugin/plugin.json   # Plugin manifest (v7.1.0)
├── .mcp.json                    # MCP server config
├── mcp-server/                  # MCP server (21 tools)
│   └── src/
│       ├── index.ts             # Entry point
│       ├── detector.ts          # Platform detection
│       ├── notion.ts            # Notion integration
│       ├── git/                 # Git operations
│       ├── platforms/           # iOS, Android
│       ├── continuity/          # Memory, ledger, tasks
│       └── coordination/        # Multi-Agent
├── skills/                      # 25 skills
├── commands/                    # 30 commands
├── agents/                      # 15 agents
├── hooks/                       # 23 hook entries across 9 types
├── scripts/                     # 12 scripts (statusline, validation, etc.)
├── templates/rules/             # 12 rule templates
└── docs/                        # Guides, references
```

## Documentation

| Document | Description |
|----------|-------------|
| [中文完整指南](./docs/GUIDE.md) | Complete Chinese guide |
| [English Guide](./docs/GUIDE_EN.md) | Complete English guide |
| [CHANGELOG](./CHANGELOG.md) | Version history |
| [Hooks Setup](./docs/hooks-setup.md) | Hook configuration guide |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

```bash
# Build MCP server
npm install --prefix dev-flow/mcp-server
npm run --prefix dev-flow/mcp-server bundle

# Test locally
claude plugins add /path/to/dev-flow
```

## License

[MIT](./LICENSE) © lazyman

---

<p align="center">
  <sub>Built with Claude Code</sub>
</p>
