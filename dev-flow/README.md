<p align="center">
  <img src="docs/assets/logo.svg" alt="dev-flow" width="120" height="120">
</p>

<h1 align="center">dev-flow</h1>

<p align="center">
  <strong>Unified Development Workflow for Claude Code</strong>
</p>

<p align="center">
  planning → coding → commit → PR → release
</p>

<p align="center">
  <a href="#installation">Installation</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#features">Features</a> •
  <a href="#documentation">Docs</a> •
  <a href="#contributing">Contributing</a>
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
| **Complete Workflow** | From planning to release, fully automated |
| **VDD** | Verification-Driven Development - machine judges completion |
| **Smart Automation** | Auto-infer scope, generate commit messages, PR descriptions |
| **State Persistence** | Ledger tracks state across sessions |
| **Task Management** | Bidirectional sync with Claude Code Task Management |
| **Rich StatusLine** | Real-time workflow phase, token efficiency, team status - session-isolated |
| **Multi-Agent** | TaskCoordinator + HandoffHub for complex tasks |
| **Cross-Platform Team** | Parallel multi-repo development (iOS/Android/Web) with Agent Teams |
| **Quality Assurance** | Auto-run platform lint/format/test/verify |
| **Knowledge Base** | Markdown-first knowledge vault with SQLite FTS5 search |
| **Notion Pipeline** | Task triage, spec generation, and status sync with Notion |
| **Rules Distribution** | Platform-aware rule templates for `.claude/rules/` |
| **Multi-Platform** | iOS, Android built-in; extensible to Python, Go, Rust, Node |
| **Self-Improvement** | Analyze sessions and iterate prompts automatically |
| **Autonomous Pipeline** | `/dev start --auto` → spec → validate → plan → implement → review gate → PR |
| **Agentic Engineering** | Autonomous execution with task contracts, proof manifests, decision agent |
| **Ralph Loop** | Stop-hook re-injection for iterative plan completion |

## Installation

### From Marketplace

```
# Add marketplace (one-time)
/plugin marketplace add lazyman-ian/claude-plugins

# Install plugin
/plugin install dev-flow@lazyman-ian
```

### From Local Directory

```bash
# Development mode
claude --plugin-dir /path/to/dev-flow
```

See [INSTALL.md](../INSTALL.md) for detailed installation guide.

### Verify

```bash
/plugin  # Check plugin load status
/dev     # Test dev workflow
```

## Quick Start

```bash
# 1. Start task
/dev-flow:start TASK-001 "Implement user login"

# 2. Write code...

# 3. Commit (auto-format, auto-scope)
/dev-flow:commit

# 4. Create PR (auto-push, auto-review)
/dev-flow:pr
```

## Commands

### Core Workflow

| Command | Description |
|---------|-------------|
| `/dev-flow:dev` | Status + next step suggestion |
| `/dev-flow:start` | Start task (create branch + ledger) |
| `/dev-flow:plan` | Create implementation plan |
| `/dev-flow:validate` | Validate tech choices |
| `/dev-flow:implement` | Execute plan with TDD |
| `/dev-flow:verify` | VDD verification (lint + test) |
| `/dev-flow:commit` | Smart commit |
| `/dev-flow:pr` | Create PR with review |
| `/dev-flow:release` | Release with changelog |

### Utilities

| Command | Description |
|---------|-------------|
| `/dev-flow:ledger` | Manage state ledger |
| `/dev-flow:tasks` | Sync with Task Management |
| `/dev-flow:recall` | Search decision history |
| `/dev-flow:extract-knowledge` | Extract cross-project knowledge |
| `/dev-flow:meta-iterate` | Self-improvement cycle |
| `/dev-flow:inbox` | Notion task triage |
| `/dev-flow:spec` | Generate spec from Notion task |
| `/dev-flow:rules` | Install rule templates |
| `/dev-flow:checkpoint` | Manual checkpoint creation |
| `/dev-flow:finish` | Branch completion workflow |
| `/dev-flow:ralph-implement` | Ralph Loop plan execution |

<details>
<summary><strong>All 29 Commands</strong></summary>

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
| `meta-iterate` | Self-improvement |
| `init` | Initialize project |
| `inbox` | Notion task triage |
| `spec` | Generate spec from task |
| `rules` | Install rule templates |
| `checkpoint` | Manual checkpoint |
| `finish` | Branch completion |
| `brainstorm` | Exploration session |
| `review` | Code review |
| `ralph-implement` | Ralph Loop execution |

</details>

## Workflow

```
    ┌──────────────┐
    │    START     │  /dev-flow:start
    │  Branch +    │  Create TASK-XXX branch
    │   Ledger     │  Initialize state tracking
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐
    │    PLAN      │  /dev-flow:plan (optional)
    │  Research +  │  Research → Design → Iterate
    │   Design     │  Output: thoughts/shared/plans/
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐
    │  IMPLEMENT   │  /dev-flow:implement
    │    TDD +     │  Red → Green → Refactor
    │ Multi-Agent  │  Complex: Agent orchestration
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐
    │   VERIFY     │  /dev-flow:verify
    │  Lint/Test   │  VDD: exit code 0 = done
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐
    │   COMMIT     │  /dev-flow:commit
    │  Auto-scope  │  lint fix → commit → reasoning
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐
    │     PR       │  /dev-flow:pr
    │   Review     │  push → description → review
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐
    │   RELEASE    │  /dev-flow:release
    │  Tag + Notes │  version → tag → changelog
    └──────────────┘

### Autonomous Pipeline (v7.1.0)

With `--auto` flag, the entire workflow runs autonomously — human only at entry and exit:

```
/dev start "需求描述" --auto
    │
    ▼
┌────────────────────────────────────────────────┐
│  Source Detection                               │
│  Notion URL / File / URL / Plain Text           │
└─────────────────────┬──────────────────────────┘
                      ▼
┌────────────────────────────────────────────────┐
│  spec-generator → spec-validator               │
│  validate-spec.sh (5 checks)                   │
│  detect-escalation.sh (5 rules)                │
│  PASS → continue │ FAIL → self-heal (2x)       │
│  ESCALATE → stop, wait human                   │
└─────────────────────┬──────────────────────────┘
                      ▼
┌────────────────────────────────────────────────┐
│  create-plan → validate-agent (mandatory)      │
│  VALIDATED → continue │ MUST CHANGE → stop     │
└─────────────────────┬──────────────────────────┘
                      ▼
┌────────────────────────────────────────────────┐
│  implement-plan (5-gate pipeline)              │
│  Per-task: subagent → review → verify          │
│  verify pass → .proof/ → commit → next         │
└─────────────────────┬──────────────────────────┘
                      ▼
┌────────────────────────────────────────────────┐
│  Review Gate Loop                              │
│  P0/P1 → fix → re-review (max 3 rounds)       │
│  P2/P3 → PR notes │ clean → /dev pr           │
└─────────────────────┬──────────────────────────┘
                      ▼
            Human: PR Review + Merge
```
```

## VDD (Verification-Driven Development)

Machine judges completion, not Agent.

| Traditional | VDD |
|-------------|-----|
| "Fix this bug" | "Fix bug, `npm test auth` should pass" |
| Agent says done | exit code 0 says done |

```bash
/dev-flow:verify              # Full: lint + typecheck + test
/dev-flow:verify --test-only  # Tests only
/dev-flow:verify --lint-only  # Lint only
```

## StatusLine

Rich context display with session-isolated team tracking.

### Display Sections

| Section | Content | Example |
|---------|---------|---------|
| **Line 1** | Model, context bar, phase, git status | `Son ██████░░░░ 60% \| ● DEV \| main ~3 +1` |
| **Line 2** | Token efficiency, code changes, cache | `in:45K out:12K \| +123 -45 \| cache:75%` |
| **Line 3** | Task progress | `✓ 3/5 (60%) →1 ⏳1` |
| **Line 4** | **Agent Team** (session-isolated) | `⚡ feature-auth (3) agent-1,agent-2,agent-3` |
| **Line 5** | Active agents | `▸ impl-agent: Implementing auth (45s)` |
| **Line 6** | Session info + ledger | `turn:12 \| ▶ Auth Module → Phase 2` |

### Agent Team Session Isolation ✨

**Problem**: Multiple sessions using Agent Teams would show all teams in StatusLine.

**Solution**: Dual-strategy filtering (v3.15.0)

1. **Primary**: Session→team mapping (`~/.claude/state/dev-flow/session_teams.json`)
   - Automatically tracked via `TeamCreate`/`TeamDelete` hooks
   - Precise session isolation

2. **Fallback**: Time-based filter (5-minute window)
   - Used if mapping file missing/corrupted
   - Graceful degradation

**Automatic**: No configuration needed, works out-of-the-box.

**Details**: See [docs/session-team-mapping.md](./docs/session-team-mapping.md)

### Installation

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

### Built-in

| Platform | Detection | Lint | Format | Test |
|----------|-----------|------|--------|------|
| **iOS** | `*.xcodeproj`, `Podfile` | SwiftLint | SwiftFormat | xcodebuild |
| **Android** | `build.gradle` | ktlint | ktfmt | Gradle |

### Custom Platform

Create `.dev-flow.json` in project root:

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

## MCP Tools

21 tools for workflow automation:

<details>
<summary><strong>Core Tools (15)</strong></summary>

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
| `dev_ledger` | ~50 | Ledger management |
| `dev_memory` | ~60 | Knowledge vault |
| `dev_branch` | ~30 | Branch lifecycle |
| `dev_defaults` | ~20 | Smart defaults |
| `dev_commits` | ~100 | Commit grouping |
| `dev_version` | ~30 | Version info |
| `dev_tasks` | ~30 | Task Management sync |

</details>

<details>
<summary><strong>Multi-Agent Tools (3)</strong></summary>

| Tool | Tokens | Purpose |
|------|--------|---------|
| `dev_coordinate` | ~40 | Task planning & dispatch |
| `dev_handoff` | ~50 | Agent handoff documents |
| `dev_aggregate` | ~60 | Aggregate results |

</details>

<details>
<summary><strong>Knowledge & Memory Tools (2)</strong></summary>

| Tool | Tokens | Purpose |
|------|--------|---------|
| `dev_memory` | ~60 | Knowledge vault: save/search/get/list/prune/reindex |
| `dev_commit` | ~30 | Server-enforced commit pipeline |

</details>

<details>
<summary><strong>Notion Pipeline Tools (2)</strong></summary>

| Tool | Tokens | Purpose |
|------|--------|---------|
| `dev_inbox` | ~40 | Notion task triage & priority |
| `dev_spec` | ~50 | Spec generation from Notion tasks |

</details>

## Documentation

### User Guides

| Document | Description |
|----------|-------------|
| [中文完整指南](./docs/GUIDE.md) | Chinese complete guide |
| [English Guide](./docs/GUIDE_EN.md) | English complete guide |
| [StatusLine Quick Ref](./docs/statusline-quick-ref.md) | StatusLine feature overview and usage |
| [Session-Team Mapping](./docs/session-team-mapping.md) | Agent Team session isolation implementation |

### Development

| Document | Description |
|----------|-------------|
| [CONTRIBUTING](./CONTRIBUTING.md) | Contribution guidelines |
| [CHANGELOG](./CHANGELOG.md) | Version history |
| [Hooks Setup](./docs/hooks-setup.md) | Hook configuration guide |

## Architecture

```
dev-flow-plugin/
├── .claude-plugin/plugin.json   # Plugin manifest
├── .mcp.json                    # MCP server config
├── mcp-server/                  # MCP server (21 tools)
│   └── src/
│       ├── index.ts             # Entry point
│       ├── detector.ts          # Platform detection
│       ├── notion.ts            # Notion integration
│       ├── git/                 # Git operations
│       ├── platforms/           # iOS, Android
│       ├── continuity/          # Memory, instincts, product brain
│       └── coordination/        # Multi-Agent
├── skills/                      # 25 skills
├── commands/                    # 30 commands
├── agents/                      # 15 agents
├── hooks/                       # 20 hooks
├── scripts/                     # validate-spec.sh, detect-escalation.sh, statusline.sh
├── templates/rules/             # 12 rule templates
└── docs/                        # Documentation
```

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

### Most Wanted

- [ ] Python platform support (ruff, black, mypy)
- [ ] Go platform support (golangci-lint, gofmt)
- [ ] Rust platform support (clippy, rustfmt)
- [ ] Node platform support (eslint, prettier)

### Development

```bash
# Clone
git clone https://github.com/lazyman-ian/dev-flow.git

# Build MCP server
npm install --prefix dev-flow/mcp-server
npm run --prefix dev-flow/mcp-server bundle

# Test locally
claude plugins add /path/to/dev-flow
```

## Acknowledgements

- [Claude Code](https://claude.ai/code) - The AI coding assistant
- [Anthropic](https://anthropic.com) - For Claude and MCP protocol

## License

[MIT](./LICENSE) © lazyman

---

<p align="center">
  <sub>Built with Claude Code</sub>
</p>
