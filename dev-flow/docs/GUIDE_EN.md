# dev-flow Plugin Complete Guide

> Claude Code Development Workflow Automation | v7.1.0

## Table of Contents

- [Why dev-flow](#why-dev-flow)
- [Quick Start](#quick-start)
- [Core Workflow](#core-workflow)
  - [Standard Flow](#standard-flow)
  - [Autonomous Pipeline](#autonomous-pipeline) *(v7.1.0)* ★ NEW
  - [Command Details](#command-details)
- [Advanced Features](#advanced-features)
  - [Agentic Engineering](#agentic-engineering) *(v6.3.0)*
  - [5-Gate Execution Pipeline](#5-gate-execution-pipeline)
  - [Review System](#review-system)
  - [Knowledge Vault](#knowledge-vault)
  - [Ledger State Management](#ledger-state-management)
  - [Multi-Agent Coordination](#multi-agent-coordination)
  - [Notion Pipeline](#notion-pipeline) *(v6.0.0)*
  - [Rules Distribution](#rules-distribution) *(v6.0.0)*
  - [Meta-Iterate Self-Improvement](#meta-iterate-self-improvement)
  - [Ralph Loop](#ralph-loop)
- [Platform Support](#platform-support)
- [Best Practices](#best-practices)
- [FAQ](#faq)
- [Claude Code Integration](#claude-code-integration)
- [Version History](#version-history)

---

## Why dev-flow

### Traditional Development vs dev-flow

| Traditional | dev-flow |
|-------------|----------|
| Manual `git add && git commit` | `/dev commit` auto-format + scope inference |
| Hand-write commit messages | Auto-generate conventional commits |
| Manual PR creation | `/dev pr` auto-push + description + code review |
| Manual code quality checks | `/dev verify` auto lint + test |
| Context loss across sessions | Ledger persists task state |
| Agent judges completion | VDD: exit code 0 judges completion |
| Repetitive boilerplate | Autonomous Pipeline handles spec → plan → implement → PR |

### Core Value

1. **Reduce repetition**: One command completes lint → commit → push
2. **Maintain context**: Ledger persists state across sessions
3. **Quality assurance**: Auto-run platform-specific checks at every gate
4. **Autonomous execution**: `--auto` flag drives the full pipeline with human oversight only at entry and exit

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

Expected output:
```
STARTING|✅0|checkout
```

### Project Initialization

Run once per project to create `.dev-flow.json` and `thoughts/` directories:

```bash
/dev-flow:init
```

For monorepo projects, set platform explicitly in `.dev-flow.json`:
```json
{ "platform": "monorepo" }
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

Or go fully autonomous:
```bash
/dev start "Implement user login with OAuth2" --auto
```

---

## Core Workflow

### Standard Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     /dev-flow:start                              │
│              Create branch TASK-XXX-xxx                          │
│              Create Ledger for state tracking                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│               /dev-flow:brainstorm (optional)                    │
│       Socratic questioning → Generate options → Evaluate         │
│       → Decide → Persist decisions                               │
│       For: design exploration when requirements are unclear      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   /dev-flow:plan (optional)                      │
│              Research → Design → Iterate → Generate plan         │
│              logic-task (2-5min) + ui-task (5-15min)             │
│              Output: thoughts/shared/plans/xxx.md                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                 /dev-flow:validate (optional)                    │
│              Validate tech choices against best practices        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              /dev-flow:implement (5-Gate Pipeline)               │
│    Per-task: Fresh Subagent → Self-Review (11-point)             │
│              → Spec Review → Quality Review → Verify             │
│              verify pass → .proof/ → commit → next task          │
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
│       3. code review (P0/P1 blocks commit)                       │
│       4. git commit (auto scope + message)                       │
│       5. reasoning record                                        │
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
│              /dev-flow:finish or /dev-flow:release               │
│       finish: merge/PR/keep/discard (4 options)                  │
│       release: Version suggestion → Tag → Release Notes          │
└─────────────────────────────────────────────────────────────────┘
```

### Autonomous Pipeline

*(v7.1.0)* Fully autonomous execution pipeline — human only at entry (provide requirements) and exit (PR review + merge).

#### Usage

```bash
# Full autonomous mode
/dev start "Implement user login with OAuth2" --auto

# From Notion task
/dev start "https://notion.so/page-id" --auto

# From requirements file
/dev start --spec path/to/requirements.md --auto
```

#### Complete Flow

```
/dev start "requirements" --auto
    │
    ▼
┌────────────────────────────────────────────────┐
│  Source Detection                               │
│  Notion URL → Notion MCP │ File → Read          │
│  URL → WebFetch │ Plain text → pass-through     │
└─────────────────────┬──────────────────────────┘
                      ▼
┌────────────────────────────────────────────────┐
│  spec-generator (pure function, source-agnostic)│
│  Text → classify → template → SPEC.md           │
└─────────────────────┬──────────────────────────┘
                      ▼
┌────────────────────────────────────────────────┐
│  spec-validator (deterministic)                │
│  validate-spec.sh: 5 quality checks            │
│  detect-escalation.sh: 5 escalation rules      │
│  ├─ ALL PASS → continue                       │
│  ├─ FAIL → self-heal (max 2x)                 │
│  └─ ESCALATE → stop, wait human               │
└─────────────────────┬──────────────────────────┘
                      ▼
┌────────────────────────────────────────────────┐
│  create-plan (research → structured plan)      │
│  └─ validate-agent (mandatory)                 │
│     ├─ VALIDATED → continue                    │
│     ├─ NEEDS REVIEW → auto-fix (max 2x)       │
│     └─ MUST CHANGE → stop, wait human          │
└─────────────────────┬──────────────────────────┘
                      ▼
┌────────────────────────────────────────────────┐
│  implement-plan (5-gate pipeline)              │
│  Per-task: subagent → self-review →            │
│    spec-review → quality-review → verify        │
│  verify pass → .proof/ → commit → next         │
└─────────────────────┬──────────────────────────┘
                      ▼
┌────────────────────────────────────────────────┐
│  Review Gate Loop                              │
│  code-reviewer (full branch diff)              │
│  ├─ P0/P1 → generate fix tasks → re-review    │
│  │          (max 3 rounds)                     │
│  ├─ P2/P3 → record in PR notes                │
│  └─ clean → /dev pr                           │
└─────────────────────┬──────────────────────────┘
                      ▼
            Human: PR Review + Merge
```

#### Key Design Decisions

| Decision | Description |
|----------|-------------|
| `--auto` propagation | Via prompt context (not CLI parsing), default off (backward compatible) |
| Deterministic scripts | `validate-spec.sh` + `detect-escalation.sh`, zero token cost |
| L3 escalation | Security/architecture is the only path that pulls in human mid-pipeline (false positives expected) |
| Review Gate | Pre-requisite for PR creation, not a post-PR step |
| Proof Manifest | `.proof/` enforced by TaskCompleted hook — tasks cannot complete without it |

### Command Details

#### /dev-flow:start — Start Task

```bash
# Basic usage
/dev-flow:start TASK-001 "Implement user login"

# From existing branch
/dev-flow:start --branch feature/auth
```

Auto-executes:
1. Create branch `TASK-001-implement-user-login`
2. Create Ledger `thoughts/ledgers/TASK-001-xxx.md`
3. Set initial state

#### /dev-flow:commit — Smart Commit

```bash
/dev-flow:commit              # Auto mode
/dev-flow:commit --scope auth # Specify scope
/dev-flow:commit --type fix   # Specify type
```

Auto-executes:
1. `lint fix` — Auto-format code
2. `lint check` — Validate no errors
3. `git diff --stat` — Analyze changes
4. `dev_defaults` — Infer scope
5. `git commit` — Generate message (no Claude attribution)
6. `dev_ledger` — Update state

#### /dev-flow:pr — Create PR

```bash
/dev-flow:pr                       # Auto mode
/dev-flow:pr --reviewer @team-lead # Specify reviewers
```

Auto-executes:
1. Check uncommitted → auto `/dev-flow:commit`
2. Check unpushed → `git push -u`
3. Collect commit history
4. Aggregate reasoning
5. `gh pr create` (with description)
6. Auto code review

#### /dev-flow:verify — VDD Verification

```bash
/dev-flow:verify            # Full verification
/dev-flow:verify --test-only
/dev-flow:verify --lint-only
```

**VDD Principle**: Machine judges completion, not Agent.

| Traditional | VDD |
|-------------|-----|
| "Fix this bug" | "Fix bug, `npm test auth` should pass" |
| Agent says "done" | exit code 0 says "done" |

---

## Advanced Features

### Agentic Engineering

*(v6.3.0)* Three-layer decision architecture that enables autonomous execution without human intervention except at defined escalation points.

#### Decision Architecture

| Layer | Who | When | Cost |
|-------|-----|------|------|
| L1 Environment | hooks, verify exit code, scope check | Always | Zero |
| L2 Decision Agent | Sonnet, fork context, runtime uncertainty | When L1 insufficient | Low |
| L3 Human | PR review, security/architecture escalation | Rare | High |

#### Continue vs Stop Signals

**Continue** (ALL must be true):
- verify passes (exit 0)
- Changes within task scope (files listed in contract)
- Context < 70%

**Stop** (ANY triggers stop):
- verify fails 2x after diagnosis
- Changes outside declared scope
- Context > 80%
- Security/architecture decision (escalate to Human)

#### Task Contracts + Proof Manifest

Each plan task includes a `contract:` block with explicit acceptance criteria:

```markdown
## Task: Implement OAuth2 login
contract:
  - OAuth2 flow completes end-to-end
  - Unit tests cover success + error paths
  - verify: npm test auth (exit 0)
autonomy: 1
```

On task completion, `.proof/{task-id}.json` is created:
```json
{
  "verdict": "pass",
  "commands": ["npm test auth"],
  "diff_stats": { "files": 3, "insertions": 87 }
}
```

The TaskCompleted hook enforces proof manifest existence — tasks cannot be marked complete without it.

#### Self-Healing Retry

```
verify fail
    → diagnose (read error output)
    → fix code (NEVER modify verify command)
    → re-verify
        pass → continue + record guardrail in knowledge vault
        fail → stop + escalate (max 2 attempts)
```

#### Silent Execution

| Autonomy Level | Output |
|----------------|--------|
| Level 1 (milestone) | `[Task N/M] name done (X files, verify pass)` |
| Level 2 (final only) | `Done: N/M tasks, X files, all pass. Proof: .proof/` |

No explanatory text during implementation ("let me read...", "I'll now...").

### 5-Gate Execution Pipeline

Per-task quality gates in `/dev implement-plan`. Risk-adaptive: gates activate based on task complexity.

#### Gate Matrix

| Gate | low | medium | high |
|------|-----|--------|------|
| 0. Figma Pre-fetch | — | — | ✓ (ui-task) |
| 1. Fresh Subagent | — | ✓ | ✓ |
| 2. Self-Review (11-point) | ✓ | ✓ | ✓ |
| 3. Spec Review | — | — | ✓ |
| 3.5 UI Verify | — | — | ✓ (ui-task) |
| 4. Quality Review | — | ✓ | ✓ |
| 5. Verify (exit 0) | ✓ | ✓ | ✓ |

#### Gate Descriptions

| Gate | Agent/Skill | Purpose |
|------|-------------|---------|
| Figma Pre-fetch | Figma MCP (orchestrator) | Fetch design specs for ui-task, inject into subagent prompt |
| Fresh Subagent | implement-agent | Context isolation, anti-corruption |
| Self-Review | (built-in) | 11-point checklist before reporting done |
| Spec Review | spec-reviewer | Implementation matches plan exactly |
| UI Verify | ui-verify skill | Measure rendered CSS vs Figma specs |
| Quality Review | code-reviewer | P0-P3 code quality check |
| Batch Checkpoint | (orchestrator) | Pause every N tasks for coherence check |

### Review System

Multi-layer automated code review with P0-P3 severity, integrated at 4 workflow points.

#### Severity Levels

| Severity | Meaning | Action |
|----------|---------|--------|
| P0 | Critical: security/data loss | Blocks commit and PR |
| P1 | High: functional regression | Blocks commit and PR |
| P2 | Medium: code quality | Recorded in PR notes |
| P3 | Low: style/suggestion | Recorded in PR notes |

#### Integration Points

```
/dev commit           → code-reviewer (P0/P1 blocks commit)
/dev commit --simplify → simplify → code-reviewer → commit
/dev review           → dev-flow reviewer + specialist agents
/dev pr               → dev-flow reviewer + specialist agents + GH comment
Agent Team            → reviewer teammate (persistent, cross-module)
```

#### Review Gate Loop

After implement-plan completes, before PR creation:

```
code-reviewer (full branch diff)
    │
    ├─ P0/P1 found → generate fix tasks → implement → re-review
    │               (max 3 rounds)
    │
    ├─ P2/P3 only → record in PR notes
    │
    └─ clean → /dev pr
```

Review decisions are made by `code-reviewer` agent in isolated context (not main agent), preventing skip-bias.

**Review Session Log**: `.git/claude/review-session-{branch}.md` — accumulates review context across commits, enabling cross-commit issue detection.

### Knowledge Vault

Markdown-first knowledge storage with SQLite FTS5 search index. Human-editable, git-tracked, session-injected.

#### Vault Structure

```
thoughts/knowledge/
├── pitfalls/      # Common pitfalls (auto-injected at session start)
├── patterns/      # Reusable patterns
├── decisions/     # Architecture decisions
└── habits/        # Workflow habits
```

#### Entry Format

Each `.md` file uses YAML frontmatter:

```yaml
---
type: pitfall          # pitfall | pattern | decision | habit
priority: critical     # critical | important | reference
platform: ios          # ios | android | web | general
tags: [swift, concurrency]
created: 2026-01-15
access_count: 0
---

# @Sendable Closures Cannot Capture Mutable State

Swift concurrency rule: @Sendable closures passed across actor boundaries
must not capture var-declared properties...
```

#### Priority + Decay Scoring

- Score: `priority_weight × temporal_decay(30-day half-life)`
- Auto-promote: `access_count >= 3` → critical
- Auto-demote: `important + 0 access + >90 days` → reference
- Auto-archive: `reference + 0 access + >90 days` → `.archive/`

#### Read vs Write

**Write triggers** (all pass through quality gate + smart dedup):
- Stop hook (session end)
- Commit time
- AI proactive save (non-obvious pattern found)
- User manual save

**Read**:
- SessionStart injects `priority='critical'` entries only (context diet)
- On-demand: `dev_memory(action='search', query='...')`

#### Quality Gate

Rejects vague entries using regex + Type-Token Ratio (no LLM cost). Must pass before writing to vault.

#### MCP Tool Usage

```bash
# Save knowledge
dev_memory(action='save', text='@Sendable closures cannot capture mutable state',
           title='Swift concurrency pitfall', tags=['swift', 'concurrency'])

# Search (lightweight, returns file paths + titles)
dev_memory(action='search', query='concurrency pitfalls', limit=5)

# Get full content by ID
dev_memory(action='get', ids=['pitfalls/swift-sendable'])

# Check status and entry counts
dev_memory(action='status')
```

#### Configuration

```json
{
  "memory": {
    "vault": "thoughts/knowledge"
  }
}
```

### Ledger State Management

Ledger tracks task state across sessions.

```bash
/dev-flow:ledger status           # View current ledger
/dev-flow:ledger create --branch TASK-001
/dev-flow:ledger update --commit abc123 --message "Complete login UI"
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
- [x] Phase 1: UI Design (verified: npm test auth ✓)
- [→] Phase 2: API Integration
- [ ] Phase 3: Testing

## Open Questions
- [ ] Refresh token strategy?
```

### Multi-Agent Coordination

Complex tasks auto-decomposed to multiple agents.

```bash
# Plan task decomposition
dev_coordinate(action="plan", task="Implement complete auth system")

# Create handoff between agents
dev_handoff(action="create", from="plan-agent", to="implement-agent")

# Aggregate results for PR
dev_aggregate(sources=["agent-1", "agent-2"])
```

| Tool | Function |
|------|----------|
| `dev_coordinate` | Task planning, dispatch, conflict detection |
| `dev_handoff` | Inter-agent handoff documents |
| `dev_aggregate` | Aggregate multi-agent results |

### Notion Pipeline

Pull tasks from Notion databases, generate specs, and automate the requirements-to-implementation pipeline.

#### Configuration

```json
{
  "notion": {
    "database_id": "your-database-id",
    "status_field": "Status",
    "priority_field": "Priority",
    "type_field": "Type",
    "platform_field": "Platform"
  }
}
```

> Requires Notion MCP server installed and authorized.

#### Full Pipeline

```
Notion DB → /dev inbox → select task → /dev spec → SPEC.md
    → spec-validator → /dev create-plan → validate-agent
    → /dev implement-plan (--auto continues automatically)
```

#### /dev inbox — Task Triage

```bash
/dev inbox                   # All tasks
/dev inbox --priority High   # Filter by priority
/dev inbox --platform iOS    # Filter by platform
```

Example output:
```
| # | Title              | Priority | Platform | Status      |
|---|--------------------|----------|----------|-------------|
| 1 | Optimize user login | High     | iOS      | In Progress |
| 2 | Dark mode support   | Medium   | Android  | To Do       |
```

#### /dev spec — Spec Generation

```bash
/dev spec {page_id}          # From Notion task
/dev spec --from-clipboard   # From clipboard
/dev spec --interactive      # Interactive input
```

Auto-executes:
1. Extract content to plain text (Notion MCP / clipboard / interactive)
2. Delegate to `spec-generator` (source-agnostic pure function): classify → template → SPEC.md
3. Auto-trigger `spec-validator` for quality verification
4. Save to `thoughts/shared/specs/SPEC-{id}.md`
5. Validation pass → chain to `/dev create-plan` (`--auto` mode continues automatically)

### Rules Distribution

Platform-aware rule templates auto-installed to `.claude/rules/`.

```bash
/dev rules list          # List all available templates
/dev rules install       # Auto-detect platform and install matching rules
/dev rules install --all # Install all templates regardless of platform
/dev rules diff          # Show diff between installed rules and templates
/dev rules sync          # Update installed rules to latest template versions
```

#### Available Templates (12)

| Template | Scope | Description |
|----------|-------|-------------|
| `coding-style.md` | Global | General coding style |
| `coding-style-swift.md` | `**/*.swift` | Swift coding conventions |
| `coding-style-kotlin.md` | `**/*.kt` | Kotlin coding conventions |
| `coding-style-typescript.md` | `**/*.ts` | TypeScript coding conventions |
| `ios-pitfalls.md` | `**/*.swift` | iOS common pitfalls |
| `android-pitfalls.md` | `**/*.kt` | Android common pitfalls |
| `testing.md` | Global | Testing standards |
| `git-workflow.md` | Global | Git workflow |
| `security.md` | Global | Security rules |
| `performance.md` | Global | Performance optimization |
| `agent-rules.md` | Global | Agent behavior rules |
| `agentic-engineering.md` | Global | Agentic execution principles |

#### Install Logic

1. Detect platform via `dev_config`
2. **Always install**: coding-style, testing, git-workflow, security, performance, agent-rules
3. **Platform-specific**: iOS → coding-style-swift + ios-pitfalls; Android → coding-style-kotlin + android-pitfalls; TypeScript → coding-style-typescript
4. Install to `.claude/rules/dev-flow/` (namespaced)

> `/dev init` automatically calls `/dev rules install` — no manual setup needed.

### Meta-Iterate Self-Improvement

Analyze session performance, continuously optimize prompts.

```bash
/dev-flow:meta-iterate                        # Complete 5-phase flow
/dev-flow:meta-iterate evaluate --recent 20  # Evaluate recent sessions
/dev-flow:meta-iterate diagnose              # Diagnose failure patterns
/dev-flow:meta-iterate propose               # Propose improvements
/dev-flow:meta-iterate apply                 # Apply (requires approval)
/dev-flow:meta-iterate verify                # Verify improvement
/dev-flow:meta-iterate discover              # Discover new skill opportunities
```

**5-Phase Flow**:
```
evaluate → diagnose → propose → [approve] → apply → verify
```

### Ralph Loop

An alternative implementation mode using Stop hook re-injection for iterative task completion.

```bash
# Generate Ralph prompt from plan
/dev ralph-implement [plan-path]
```

The bridge command reads the plan, extracts tasks and contracts, and generates a Ralph prompt for Stop hook-driven execution.

Reference: `skills/implement-plan/references/ralph-loop-mode.md`

---

## Platform Support

### Detection Priority

```
1. .dev-flow.json → Highest priority (explicit user config)
2. File-based detection → Auto-infer
   *.xcodeproj / Podfile / Package.swift → ios
   build.gradle / AndroidManifest.xml → android
   package.json → web
   Otherwise → general
```

> **Mixed projects** (e.g., Svelte+Tauri with both `package.json` and `Cargo.toml`) should use `.dev-flow.json` to explicitly set the platform.

### Built-in Platforms

| Platform | Detection | lint fix | lint check | verify |
|----------|-----------|----------|------------|--------|
| iOS | `*.xcodeproj`, `Podfile` | swiftlint --fix | swiftlint | swiftlint && xcodebuild build |
| Android | `build.gradle` | ktlint -F | ktlint | ktlintCheck && ./gradlew assembleDebug |
| Web | `package.json` | (custom) | (custom) | (custom) |

### Custom Platform

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

The `platform` field also affects knowledge injection (SessionStart loads platform-specific pitfalls).

### Extend New Platform (Developers)

1. `mcp-server/src/detector.ts` — Add detection logic (`detectPlatformSimple()` unified entry)
2. `mcp-server/src/platforms/xxx.ts` — Implement command config

---

## Best Practices

### 1. Task Granularity

| Size | Recommendation |
|------|----------------|
| Small (< 3 files) | Execute directly, no plan needed |
| Medium (3-10 files) | `/dev-flow:plan` → `/dev-flow:implement` |
| Large (> 10 files) | Split into multiple TASKs, Multi-Agent |
| Full feature | `/dev start --auto` for autonomous execution |

### 2. Commit Frequency

```bash
# Recommended: Small commits
/dev-flow:commit  # Commit after each feature point

# Not recommended: Accumulate large changes then commit all at once
```

### 3. Context Management

| Signal | Action |
|--------|--------|
| Context > 70% | Update ledger → `/clear` |
| Complete subtask | New session |
| Agent repeating | New session |

Ledger auto-restores state on session resume.

### 4. VDD Practice

Always include a verification command in task definitions:

```bash
"Fix login bug, verify: npm test auth should pass"

/dev-flow:verify  # exit code 0 = truly done
```

### 5. Knowledge Accumulation

```bash
# Extract knowledge after major feature completion
dev_memory(action='consolidate')

# Knowledge auto-saves from Stop hook — no manual action needed for daily use
```

---

## FAQ

### Q: dev_config returns "unknown"

**Cause**: Project not configured and not iOS/Android/Web.

**Solution** (recommended: `.dev-flow.json`):

```json
{
  "platform": "python",
  "commands": {
    "fix": "black .",
    "check": "ruff . && mypy ."
  }
}
```

Or create a `Makefile` with `fix:` and `check:` targets.

### Q: Ledger out of sync

```bash
/dev-flow:tasks sync
```

### Q: Commit blocked by hook

**Common causes**: lint check failed, or `--no-verify` attempted (always blocked).

**Solution**:
```bash
/dev-flow:verify  # Fix issues first
/dev-flow:commit  # Then commit
```

### Q: Multi-Agent task conflict

```bash
dev_coordinate(action="check_conflicts")
dev_coordinate(action="replan")
```

### Q: Autonomous Pipeline stops mid-run

The pipeline stops at L3 escalation points (security/architecture decisions). Check the ledger for the escalation reason:

```bash
/dev-flow:ledger status
```

Resolve the flagged concern and resume with `/dev implement-plan`.

### Q: Knowledge vault entries not appearing at session start

Only `priority='critical'` entries are injected at session start (context diet). To check entries:

```bash
dev_memory(action='status')
dev_memory(action='search', query='your topic')
```

---

## Claude Code Integration

### Hooks Integration

dev-flow auto-enables these hooks:

| Hook | Trigger | Function |
|------|---------|----------|
| PreToolUse | Before `git commit` | Block raw git commit, enforce /dev commit |
| PreToolUse | Before `git commit` (chained) | Pre-commit knowledge pitfall check |
| SessionStart | Resume session | Warn if not initialized + load ledger + inject critical knowledge + detect resume directive |
| UserPromptSubmit | User sends prompt | Auto-retrieve relevant knowledge (temporal decay scoring) |
| PreCompact | Before compact | Backup transcript |
| Stop | Session end | Save session learnings to knowledge vault (quality-gate filtered) |
| PostToolUse | After tool use | Tool counter + dev reminders |
| TaskCompleted | Task marked done | Enforce proof manifest existence |
| SubagentStart | Subagent spawns | Inject platform context |

### Recommended Rules

dev-flow works best with:

| Rule | Function |
|------|----------|
| `agentic-engineering.md` | Autonomous execution principles |
| `verification-driven.md` | VDD principles |
| `failure-detection.md` | Loop/bypass detection |
| `scope-control.md` | Prevent scope drift |
| `workflow.md` | Context management |

### StatusLine

Multi-line display:

```
████████░░ 76% | main | ↑2↓0 | !3M +2A | 15m
✓ Read ×12 | ✓ Edit ×3 | ✓ Bash ×5
Tasks: 2/5 (40%) | → 1 active | 2 pending
```

**Line 1**: Context usage | Branch | ahead/behind | File stats | Session duration
**Line 2**: Tool usage stats
**Line 3**: Task progress
**Line 4**: Agent status (if agents running)

### Task Management

Bidirectional sync:
```bash
/dev-flow:tasks export  # Export from ledger to Task Management
/dev-flow:tasks sync    # Sync from Task Management to ledger
```

---

## Version History

### v7.1.0 (2026-03-08)

- **Autonomous Pipeline**: `/dev start --auto` — requirements → spec → validate → plan → implement → review gate → PR, human only at entry and exit
- **spec-generator refactor**: Source-agnostic pure function (Notion / file / URL / plain text)
- **spec-validator agent**: Calls `validate-spec.sh` (5 checks) + `detect-escalation.sh` (5 rules) with self-healing
- **Review Gate Loop**: Post-implement, pre-PR quality gate (P0/P1 fix → re-review, max 3 rounds)
- **Proof Manifest enforcement**: TaskCompleted hook blocks completion without `.proof/{task-id}.json`
- **`/dev spec` refactor**: Now a Notion adapter, all spec processing delegated to spec-generator

### v7.0.0 (2026-03-01)

- **Closed-Loop Learning Engine**: Ledger v2 with gate tracking + retry counts + timestamps
- **Adaptive Execution Engine**: L1/L2/L3 decision architecture, task contracts, proof manifests
- **Execution Report**: `.proof/execution-report.md` from ledger gate data (task completion, gate pass rates, self-healing stats)

### v6.3.0 (2026-02-28)

- **Agentic Engineering**: Task contracts, proof manifests, decision-agent routing
- **Self-Healing Retry**: verify fail → diagnose → fix → re-verify (max 2)
- **Silent Execution**: No explanatory text during implementation
- **Auto-Resume**: `thoughts/ledgers/.resume-directive.md` + SessionStart injection

### v6.0.0 (2026-02-27)

- **Notion Pipeline**: `/dev inbox` (task triage) + `/dev spec` (spec generation) + post-merge hook
- **Knowledge Vault**: Markdown-first `thoughts/knowledge/` + SQLite FTS5 + priority/decay scoring
- **Rules Distribution**: 12 platform-aware rule templates + `/dev rules` command
- **Test Infrastructure**: vitest + 176 tests across 12 files + validate-plugins.sh + CI

### v5.0.0 (2026-02-12)

- **5-Gate Execution Pipeline**: Fresh Subagent → Self-Review → Spec Review → Quality Review → Verify
- **brainstorm skill**: Socratic questioning for design exploration
- **verify skill**: Internal skill enforcing no completion claims without verification evidence
- **Adaptive Plan Granularity**: logic-task (2-5min) + ui-task (5-15min)

### v4.0.0–v3.x (2026-01-27 to 2026-02-09)

- v4.0.0: Memory system (later superseded by Markdown-first vault in v6.0.0)
- v3.17.0: Knowledge consolidation engine, smart injection
- v3.16.0: agent-team, cross-platform-team, evaluate-agent
- v3.13.0: VDD, Multi-Agent coordination, Knowledge Base

---

## Contributing

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

Most welcome contributions: new platform support (Python, Go, Rust, Node).

---

## License

MIT

---

> Questions? Open an issue: https://github.com/lazyman-ian/dev-flow/issues
