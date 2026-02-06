# dev-flow Plugin Complete Guide

> Claude Code Development Workflow Automation | v3.15.0

## Table of Contents

- [Why dev-flow](#why-dev-flow)
- [Quick Start](#quick-start)
- [Core Workflow](#core-workflow)
- [Advanced Features](#advanced-features)
- [Best Practices](#best-practices)
- [FAQ](#faq)
- [Claude Code Integration](#claude-code-integration)

---

## Why dev-flow

### Traditional Development vs dev-flow

| Traditional | dev-flow |
|-------------|----------|
| Manual `git add && git commit` | `/dev commit` auto-format + scope inference |
| Hand-write commit messages | Auto-generate conventional commits |
| Manual PR creation | `/dev pr` auto-push + description + code review |
| Manual code quality checks | `/dev verify` auto lint + test |
| Context loss (session switches) | Ledger persists task state |
| Agent judges completion | VDD: exit code 0 judges completion |

### Core Value

1. **Reduce repetition**: One command for lint → commit → push
2. **Maintain context**: Ledger persists state across sessions
3. **Quality assurance**: Auto-run platform-specific checks
4. **Knowledge accumulation**: Auto-record decisions, extract cross-project knowledge

---

## Quick Start

### Installation

```bash
# Option 1: From Marketplace (recommended)
/plugin marketplace add lazyman-ian/claude-plugins
/plugin install dev-flow@lazyman-ian

# Option 2: Local development
claude plugins add /path/to/dev-flow
```

### Verify Installation

```bash
/dev-flow:dev
```

Example output:
```
STARTING|✅0|checkout
```

### 5-Minute Tutorial

```bash
# 1. Start new task
/dev-flow:start TASK-001 "Implement user login"

# 2. Write code...

# 3. Commit
/dev-flow:commit

# 4. Create PR
/dev-flow:pr
```

---

## Core Workflow

### Complete Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     /dev-flow:start                              │
│              Create branch TASK-XXX-xxx                          │
│              Create Ledger for state tracking                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   /dev-flow:plan (optional)                      │
│              Research → Design → Iterate → Generate plan         │
│              Output: thoughts/shared/plans/xxx.md                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                 /dev-flow:validate (optional)                    │
│              Validate tech choices against 2024-2025 practices   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   /dev-flow:implement                            │
│                  TDD: Red → Green → Refactor                     │
│                  Large tasks: Multi-Agent coordination           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    /dev-flow:verify                              │
│              lint check → typecheck → unit tests                 │
│              VDD: exit code 0 = done                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    /dev-flow:commit                              │
│       1. lint fix (auto-format)                                  │
│       2. lint check (validate)                                   │
│       3. git commit (auto scope + message)                       │
│       4. reasoning record                                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      /dev-flow:pr                                │
│       1. push to remote                                          │
│       2. generate PR description                                 │
│       3. auto code review                                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   /dev-flow:release                              │
│              Version suggestion → Tag → Release Notes            │
└─────────────────────────────────────────────────────────────────┘
```

### Command Details

#### /dev-flow:start - Start Task

```bash
# Basic usage
/dev-flow:start TASK-001 "Implement user login"

# From existing branch
/dev-flow:start --branch feature/auth
```

**Auto-executes**:
1. Create branch `TASK-001-implement-user-login`
2. Create Ledger `thoughts/ledgers/TASK-001-xxx.md`
3. Set initial state

#### /dev-flow:commit - Smart Commit

```bash
# Auto mode
/dev-flow:commit

# Specify scope
/dev-flow:commit --scope auth

# Specify type
/dev-flow:commit --type fix
```

**Auto-executes**:
1. `lint fix` - Auto-format code
2. `lint check` - Validate no errors
3. `git diff --stat` - Analyze changes
4. `dev_defaults` - Infer scope
5. `git commit` - Generate message (no Claude attribution)
6. `dev_reasoning` - Record decision history
7. `dev_ledger` - Update state

#### /dev-flow:pr - Create PR

```bash
# Auto mode
/dev-flow:pr

# Specify reviewers
/dev-flow:pr --reviewer @team-lead
```

**Auto-executes**:
1. Check uncommitted → auto `/dev-flow:commit`
2. Check unpushed → `git push -u`
3. Collect commit history
4. Aggregate reasoning
5. `gh pr create` (with description)
6. Auto code review

#### /dev-flow:verify - VDD Verification

```bash
# Full verification
/dev-flow:verify

# Test only
/dev-flow:verify --test-only

# Lint only
/dev-flow:verify --lint-only
```

**VDD Principle**: Machine judges completion, not Agent.

| Traditional | VDD |
|-------------|-----|
| "Fix this bug" | "Fix bug, `npm test auth` should pass" |
| Agent says "done" | exit code 0 says "done" |

---

## Advanced Features

### Ledger State Management

Ledger tracks task state across sessions.

```bash
# View current ledger
/dev-flow:ledger status

# Create new ledger
/dev-flow:ledger create --branch TASK-001

# Update state
/dev-flow:ledger update --commit abc123 --message "Complete login UI"

# Archive completed task
/dev-flow:ledger archive TASK-001
```

**Ledger Structure**:
```markdown
# TASK-001: Implement user login

## Goal
Implement complete user login functionality

## Constraints
- Use JWT authentication
- Support OAuth2

## Key Decisions
- [2026-01-27] Choose Firebase Auth

## State
- [x] Phase 1: UI Design
- [→] Phase 2: API Integration
- [ ] Phase 3: Testing

## Open Questions
- [ ] Refresh token strategy?
```

### Knowledge Base

Cross-project knowledge auto-accumulation and loading.

```bash
# Extract knowledge from current project
/dev-flow:extract-knowledge

# Extract specific type
/dev-flow:extract-knowledge --type pitfalls
/dev-flow:extract-knowledge --type patterns
/dev-flow:extract-knowledge --type discoveries
```

**Structure**:
```
~/.claude/knowledge/
├── index.md                  # Index
├── platforms/
│   ├── ios/pitfalls.md      # iOS pitfalls
│   └── android/pitfalls.md  # Android pitfalls
├── patterns/                 # Common patterns
│   └── async-error-handling.md
└── discoveries/              # Timeline discoveries
    └── 2026-01-27-swift-concurrency.md
```

Auto-loads at session start:
```
📚 ios pitfalls: 4 items
```

### Multi-Agent Coordination

Complex tasks auto-decomposed to multiple agents.

```bash
# View task decomposition
dev_coordinate(action="plan", task="Implement complete auth system")

# Create handoff
dev_handoff(action="create", from="plan-agent", to="implement-agent")

# Aggregate results
dev_aggregate(sources=["agent-1", "agent-2"])
```

**Coordination Tools**:

| Tool | Function |
|------|----------|
| `dev_coordinate` | Task planning, dispatch, conflict detection |
| `dev_handoff` | Inter-agent handoff documents |
| `dev_aggregate` | Aggregate multi-agent results |

### Meta-Iterate Self-Improvement

Analyze session performance, continuously optimize prompts.

```bash
# Complete 5-phase flow
/dev-flow:meta-iterate

# Execute single phase
/dev-flow:meta-iterate evaluate --recent 20
/dev-flow:meta-iterate diagnose
/dev-flow:meta-iterate propose
/dev-flow:meta-iterate apply  # requires approval
/dev-flow:meta-iterate verify

# Discover new skill opportunities
/dev-flow:meta-iterate discover
```

**5-Phase Flow**:
```
evaluate → diagnose → propose → [approve] → apply → verify
```

---

## Best Practices

### 1. Task Granularity

| Size | Recommendation |
|------|----------------|
| Small (< 3 files) | Execute directly, no plan needed |
| Medium (3-10 files) | `/dev-flow:plan` → `/dev-flow:implement` |
| Large (> 10 files) | Split into multiple TASKs, Multi-Agent |

### 2. Commit Frequency

```bash
# Recommended: Small commits
/dev-flow:commit  # Commit after each feature point

# Not recommended: Batch commits
# Accumulate changes then commit all at once
```

### 3. Context Management

| Signal | Action |
|--------|--------|
| Context > 70% | Update ledger → `/clear` |
| Complete subtask | New session |
| Agent repeating | New session |

### 4. VDD Practice

```bash
# Include verification in task definition
"Fix login bug, verify: npm test auth should pass"

# Auto-verify after completion
/dev-flow:verify
# exit code 0 → truly done
```

### 5. Knowledge Accumulation

```bash
# Weekly knowledge extraction
/dev-flow:extract-knowledge

# Record pitfalls immediately in CLAUDE.md
## Known Pitfalls
- session.save() is async, must await
```

---

## FAQ

### Q: dev_config returns "unknown"

**Cause**: Project not configured and not iOS/Android

**Solution**:
1. Create `.dev-flow.json`:
```json
{
  "platform": "python",
  "commands": {
    "fix": "black .",
    "check": "ruff . && mypy ."
  }
}
```

2. Or create `Makefile`:
```makefile
fix:
	black .
check:
	ruff . && mypy .
```

### Q: Ledger out of sync

**Solution**:
```bash
# Sync ledger with Task Management
/dev-flow:tasks sync
```

### Q: Commit blocked by hook

**Common causes**:
- `--no-verify` is blocked
- lint check failed

**Solution**:
```bash
# Fix issues first
/dev-flow:verify

# Then commit
/dev-flow:commit
```

### Q: Multi-Agent task conflict

**Solution**:
```bash
# Check conflicts
dev_coordinate(action="check_conflicts")

# Replan
dev_coordinate(action="replan")
```

---

## Claude Code Integration

### Recommended Rules

dev-flow works best with these rules:

| Rule | Function |
|------|----------|
| `agentic-coding.md` | Context management + discovery capture |
| `command-tools.md` | Tools first, reduce Bash |
| `verification-driven.md` | VDD principles |
| `context-budget.md` | Context budget management |
| `failure-detection.md` | Loop/bypass detection |

### Hooks Integration

dev-flow auto-enables these hooks:

| Hook | Trigger | Function |
|------|---------|----------|
| PreToolUse | Before `git commit` | Block raw git commit, enforce /dev commit |
| Setup | First init | Configure dev-flow environment |
| SessionStart | Resume session | Load ledger + platform knowledge |
| PreCompact | Before compact | Backup transcript |
| PostToolUse | After tool use | Tool counter + remind /dev commands |

### StatusLine

StatusLine multi-line display (v3.13.0+):

```
████████░░ 76% | main | ↑2↓0 | !3M +2A | 15m
✓ Read ×12 | ✓ Edit ×3 | ✓ Bash ×5
Tasks: 2/5 (40%) | → 1 active | 2 pending
```

**Line 1**: Context usage | Branch | ahead/behind | File stats | Session duration
**Line 2**: Tool usage stats (Read/Edit/Bash/Grep)
**Line 3**: Task progress (completed/total | active | pending)
**Line 4**: Agent status (if any agents running)

**Manual configuration** (if needed):
```json
{
  "statusLine": {
    "type": "command",
    "command": "$HOME/.claude/plugins/marketplaces/lazyman-ian/dev-flow/scripts/statusline.sh",
    "padding": 0
  }
}
```

### Task Management

Bidirectional sync:
```bash
# Export from ledger to Task Management
/dev-flow:tasks export

# Sync from Task Management to ledger
/dev-flow:tasks sync
```

---

## Platform Support

### Built-in Platforms

| Platform | Detection | lint fix | lint check | test | verify |
|----------|-----------|----------|------------|------|--------|
| iOS | `*.xcodeproj`, `Podfile` | swiftlint --fix | swiftlint | xcodebuild test | swiftlint && xcodebuild build |
| Android | `build.gradle` | ktlint -F | ktlint | ./gradlew test | ktlintCheck && ./gradlew assembleDebug |

### Custom Platform

`.dev-flow.json`:
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

### Extend New Platform (Developers)

1. `mcp-server/src/detector.ts` - Add detection logic
2. `mcp-server/src/platforms/xxx.ts` - Implement command config

---

## Version History

### v3.13.0 (2026-01-27)

- **VDD**: Verification-Driven Development
- **Multi-Agent**: TaskCoordinator + HandoffHub
- **Knowledge Base**: Cross-project knowledge repository
- **New Commands**: /verify, /extract-knowledge
- **New Tools**: dev_coordinate, dev_handoff, dev_aggregate
- **Hook Enhancement**: Platform knowledge loading, bypass detection

### v3.11.0

- Meta-Iterate self-improvement
- Task Management bidirectional sync
- Reasoning records

---

## Contributing

Contributions welcome!

1. Fork the repo
2. Create branch: `git checkout -b feature/xxx`
3. Use dev-flow workflow:
   ```bash
   /dev-flow:start CONTRIB-001 "Add Python support"
   # ... develop ...
   /dev-flow:commit
   /dev-flow:pr
   ```
4. Wait for code review

### Extend Platforms

Most welcome contributions are new platform support:
- Python (ruff, black, mypy)
- Go (golangci-lint, gofmt)
- Rust (clippy, rustfmt)
- Node (eslint, prettier)

---

## License

MIT

---

> Questions? Open an issue: https://github.com/lazyman-ian/dev-flow/issues
