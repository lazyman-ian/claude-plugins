# dev-flow Plugin Complete Guide

> Claude Code Development Workflow Automation | v6.0.0

## Table of Contents

- [Why dev-flow](#why-dev-flow)
- [Quick Start](#quick-start)
- [Core Workflow](#core-workflow)
- [Advanced Features](#advanced-features)
  - [Ledger State Management](#ledger-state-management)
  - [Knowledge Base](#knowledge-base)
  - [Memory System](#memory-system)
  - [Instinct System](#instinct-system) *(v6.0.0)*
  - [Notion Pipeline](#notion-pipeline) *(v6.0.0)*
  - [Product Brain](#product-brain) *(v6.0.0)*
  - [Rules Distribution](#rules-distribution) *(v6.0.0)*
  - [Multi-Agent Coordination](#multi-agent-coordination)
  - [Meta-Iterate Self-Improvement](#meta-iterate-self-improvement)
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
│               /dev-flow:brainstorm (optional)                    │
│       Socratic questioning → Generate options → Evaluate         │
│       → Decide → Persist decisions                               │
│       For: design exploration when requirements are unclear      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   /dev-flow:plan (optional)                      │
│              Research → Design → Iterate → Generate plan         │
│              v5.0: logic-task (2-5min) + ui-task (5-15min)       │
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
│              → Spec Review → Quality Review                      │
│              → Batch Checkpoint (every N tasks)                   │
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

### Memory System

4-tier progressive memory system, from zero-cost to semantic search:

| Tier | Features | Token Cost | Dependencies |
|------|----------|-----------|--------------|
| 0 | FTS5 full-text search + save/search/get | 0 (pure SQLite) | None |
| 1 | + Auto session summaries | ~$0.001/session | Optional API key |
| 2 | + ChromaDB semantic search | Same as Tier 1 | + chromadb |
| 3 | + Periodic observation capture | ~$0.005/session | Same as Tier 1 |

#### Knowledge Loop

```
┌─────────────────────────────────────────────────────────────┐
│                     Knowledge Loop                          │
│                                                             │
│  ┌──────────┐    auto-inject   ┌──────────────┐            │
│  │SessionStart│───────────────▶│ System Prompt │            │
│  │  hook     │  pitfalls +     │ (~2500 tokens)│            │
│  └──────────┘  last summary    └──────┬───────┘            │
│       ▲                               │                    │
│       │                               ▼                    │
│  ┌──────────┐              ┌──────────────────┐            │
│  │ Knowledge │◀────────────│  Skill / Agent   │            │
│  │    DB     │   save()    │  auto query()    │            │
│  │ (SQLite)  │             │  save on finding │            │
│  └──────────┘              └────────┬─────────┘            │
│       ▲                             │                      │
│       │                             ▼                      │
│  ┌──────────┐              ┌──────────────────┐            │
│  │ Stop hook │◀─────────── │   Session End    │            │
│  │ auto-sum  │  Tier 1     └──────────────────┘            │
│  └──────────┘                       │                      │
│       ▲                             ▼                      │
│  ┌──────────┐              ┌──────────────────┐            │
│  │PostToolUse│◀─────────── │  Every N tools   │            │
│  │ auto-obs  │  Tier 3     └──────────────────┘            │
│  └──────────┘                                              │
└─────────────────────────────────────────────────────────────┘
```

#### Automatic vs Manual

| Operation | Trigger | Description |
|-----------|---------|-------------|
| Knowledge injection | **Auto** SessionStart | Injects pitfalls + task knowledge + last summary each session |
| Skill/Agent query | **Auto** before work | debug/plan/implement/validate/review auto-query history |
| Skill/Agent save | **Semi-auto** after work | Saves when non-obvious patterns discovered |
| Session summary | **Auto** Stop hook | Tier 1+ auto-generates on session end |
| Observation capture | **Auto** PostToolUse | Tier 3 auto-classifies every N tool calls |
| Knowledge consolidation | **Manual** consolidate | Run once after major feature completion |
| Knowledge extraction | **Manual** extract | Run once for new project initialization |

#### Storage Locations

```
~/.claude/
├── knowledge/                      # Knowledge files (consolidate output)
│   ├── platforms/                   #   Platform-specific (ios/android)
│   ├── patterns/                    #   Generic patterns
│   └── discoveries/                 #   Exploration findings
└── cache/artifact-index/
    └── context.db                   # SQLite database (all FTS5 indexes)

<project>/
├── .dev-flow.json                   # Memory config (tier, options)
├── .claude/cache/artifact-index/
│   └── context.db                   # Project-level DB (preferred)
├── .git/claude/commits/<hash>/
│   └── reasoning.md                 # Commit reasoning records
└── thoughts/reasoning/
    └── <hash>-reasoning.md          # Reasoning copy (git-tracked)
```

| Data | Storage Location | Lifecycle |
|------|-----------------|-----------|
| Knowledge entries | `context.db` → `knowledge` table | Persistent, cross-session |
| Reasoning records | `context.db` → `reasoning` table + files | Persistent, git-tracked |
| Synonyms | `context.db` → `synonyms` table | Persistent, auto-seeded |
| Session summaries | `context.db` → `session_summaries` table | Persistent, Tier 1+ |
| Observations | `context.db` → `observations` table | Persistent, Tier 3 |
| Knowledge files | `~/.claude/knowledge/` | Persistent, cross-project |

#### Checking If It Works

```bash
# View memory status and statistics
dev_memory(action='status')

# List knowledge entries
dev_memory(action='list')

# Search specific knowledge
dev_memory(action='search', query='concurrency')

# Query SQLite directly
sqlite3 .claude/cache/artifact-index/context.db "SELECT COUNT(*) FROM knowledge;"
sqlite3 .claude/cache/artifact-index/context.db "SELECT id, title FROM session_summaries ORDER BY created_at_epoch DESC LIMIT 5;"
sqlite3 .claude/cache/artifact-index/context.db "SELECT type, title FROM observations ORDER BY created_at_epoch DESC LIMIT 5;"

# Check knowledge files
ls ~/.claude/knowledge/platforms/ ~/.claude/knowledge/patterns/ ~/.claude/knowledge/discoveries/
```

#### Tier 0: FTS5 Full-Text Search (Default)

Zero-cost, pure SQLite memory layer.

**What it does**:
- `save` — Save knowledge entries to `knowledge` table with automatic FTS5 indexing
- `search` — Lightweight search returning ID + title list (no full text, saves tokens)
- `get` — Retrieve full content by ID (search → get two-step pattern saves ~10x tokens)
- `consolidate` — Extract knowledge from CLAUDE.md, ledgers, reasoning into database
- SessionStart auto-injection: platform pitfalls + task-related knowledge + recent discoveries

**Synonym expansion**: Searching `crash` auto-expands to `(crash OR error OR exception OR panic OR abort)`, 8 built-in mapping groups.

**Data flow**:
```
User/Claude calls dev_memory(save) → knowledge table + FTS5 index
SessionStart hook → FTS5 query → inject into system prompt (~2000 tokens)
```

**Best for**: All users. Zero configuration, zero cost.

#### Tier 1: Auto Session Summaries

Automatically generates structured summaries when a session ends, so the next session can quickly understand what was done.

**What it does**:
- Stop hook triggers when session ends
- With API key → Haiku generates JSON summary (request/investigated/learned/completed/next_steps)
- Without API key → heuristic fallback: extracts `completed` from `git log --oneline`, `investigated` from `git diff --stat`
- Summary written to `session_summaries` table + FTS5 index
- Next SessionStart auto-injects last summary (~500 tokens budget)

**Data flow**:
```
Session ends → Stop hook → Haiku API / heuristic
    → session_summaries table + FTS5
    → Next SessionStart injects "Last time you were working on XXX, completed YYY, next step ZZZ"
```

**Best for**: Users who frequently switch sessions and want automatic context continuity.

#### Tier 2: ChromaDB Semantic Search

Adds vector semantic search on top of FTS5 keyword search — understands "similar meaning" not just "same words".

**What it does**:
- `save`/`consolidate` simultaneously writes to ChromaDB vector database (fire-and-forget, non-blocking)
- `memorySearchAsync` hybrid search: ChromaDB semantic + FTS5 keyword, results deduplicated and merged
- Graceful degradation when ChromaDB not installed → falls back to pure FTS5

**Data flow**:
```
dev_memory(save) → knowledge table + FTS5 + ChromaDB vectors
dev_memory(search) → FTS5 keyword search (sync, fast)
                   + ChromaDB semantic search (async, accurate)
                   → deduplicate & merge → return sorted results
```

**Dependency**: `pip install chromadb` (optional — not installing doesn't affect other features)

**Best for**: Users with large knowledge bases (100+ entries) who need fuzzy semantic search.

#### Tier 3: Periodic Observation Capture

Automatically records Claude's work process — not just "what is known" but "what was done".

**What it does**:
- PostToolUse hook triggers after every tool call, incrementing a counter
- Every N calls (default 10), triggers batch processing
- With API key → Haiku classifies tool log into structured observations (type: decision/bugfix/feature/refactor/discovery)
- Without API key → heuristic: Edit/Write → feature, Read-heavy → discovery
- Observations written to `observations` table + FTS5 index

**Data flow**:
```
Each tool call → PostToolUse hook → counter +1, tool info appended to log
Nth call → read log → Haiku classification / heuristic classification
        → observations table + FTS5
        → searchable via search/query
```

**Best for**: Users who want to auto-accumulate project history and look up "how was this type of problem solved last time".

#### New User Setup

After installing dev-flow, `claude --init` automatically:

1. Setup hook creates `.dev-flow.json` (includes `"memory": { "tier": 0 }`)
2. First `dev_memory` call auto-creates SQLite tables and FTS5 indexes
3. Default synonyms auto-seeded (8 groups: concurrency, auth, crash, etc.)

**Zero configuration needed for Tier 0**.

#### Existing User Migration

If you already have `.dev-flow.json` (setup hook won't recreate it), add `memory` field manually:

```json
{
  "platform": "ios",
  "commands": { "fix": "...", "check": "..." },
  "scopes": ["ui", "api"],
  "memory": { "tier": 0 }
}
```

> Not adding it is fine — `getMemoryConfig()` defaults to tier 0. Adding it enables explicit tier upgrades.

#### Tier Upgrade Path

```jsonc
// Tier 1: Auto session summaries (Stop hook → Haiku API or heuristic)
"memory": { "tier": 1, "sessionSummary": true }

// Tier 2: Semantic search (requires: pip install chromadb)
"memory": { "tier": 2, "sessionSummary": true, "chromadb": true }

// Tier 3: Periodic capture (auto-classify every N tool uses)
"memory": { "tier": 3, "sessionSummary": true, "chromadb": true, "periodicCapture": true, "captureInterval": 10 }
```

#### API Key Setup (Optional)

Tier 1/3 Haiku calls need an API key, but **work without one** (heuristic fallback extracts summaries from git log):

```bash
# Option 1: Register API account (console.anthropic.com), add $5 credit
export ANTHROPIC_API_KEY=sk-ant-...  # Add to ~/.zshrc

# Option 2: No key (auto-uses heuristic mode — lower quality but zero cost)
```

#### Using MCP Tools

```bash
# Save knowledge
dev_memory(action='save', text='@Sendable closures cannot capture mutable state', title='Swift concurrency pitfall', tags=['swift', 'concurrency'])

# Search (lightweight, returns ID + title)
dev_memory(action='search', query='concurrency pitfalls', limit=5)

# Get full content
dev_memory(action='get', ids=['knowledge-xxx'])

# Consolidate historical knowledge
dev_memory(action='consolidate')

# Check status
dev_memory(action='status')
```

#### Automatic Behaviors

| Tier | Automatic Behavior | Trigger |
|------|-------------------|---------|
| 0 | SessionStart knowledge injection (~2500 tokens) | Every session start |
| 1 | Generate session summary to DB | Stop hook (session end) |
| 2 | ChromaDB semantic index sync | On save/consolidate |
| 3 | Batch observation capture + classify | Every N tool uses |

#### Tips

**Memory Maintenance**

| Command | When to Use | Frequency |
|---------|-------------|-----------|
| `dev_memory(action='consolidate')` | Extract CLAUDE.md pitfalls, ledger decisions, reasoning patterns into DB | Run once after completing a major feature |
| `/dev-flow:extract-knowledge` | Scan project files for reusable knowledge (first-time or after major version) | Run once for new projects / after major upgrades |

> Daily use requires no manual calls — skills/agents auto-query and save knowledge, session summaries are generated automatically. The above two commands are only for periodic maintenance and one-time migrations.

**Claude Code CLI**

| Action | Command | Description |
|--------|---------|-------------|
| Initialize project | `claude` then `/init` | Triggers Setup hook, auto-creates `.dev-flow.json` (with memory config) |
| Clear context | `/clear` | Use when context > 70%, ledger auto-restores state |
| Compact context | `/compact` | Compress context keeping key info, auto-triggers PreCompact hook backup |
| Check plugin status | `/plugins` | Verify dev-flow loaded correctly |
| Check MCP tools | `claude mcp list` | Verify dev-flow MCP server connected |
| Delegate mode | `Shift+Tab` | Restrict lead to coordination-only with 3+ teammates |
| Reference file | `#filename` | Add file content to context, pairs well with memory queries |

#### Database Schema

All data in `.claude/cache/artifact-index/context.db`:

| Table | Purpose | Tier |
|-------|---------|------|
| knowledge + knowledge_fts | Knowledge entries | 0 |
| reasoning + reasoning_fts | Reasoning records | 0 |
| synonyms | Synonym expansion (FTS5 query enhancement) | 0 |
| session_summaries + _fts | Session summaries | 1 |
| observations + _fts | Observation records | 3 |

### Instinct System

Automatically extract reusable patterns from work observations. Once confidence reaches threshold, instincts can evolve into skills/rules/commands.

#### Prerequisites

Requires Tier 3 memory (`"memory": { "tier": 3 }` in `.dev-flow.json`), as instincts are extracted from the `observations` table.

#### How It Works

```
Sessions (Tier 3 observations) → observations table
    → dev_instinct(extract) → cluster into instincts
    → dev_instinct(list) → review high-confidence instincts
    → /dev evolve → evolve into skill/rule/command
```

#### Usage

```bash
# Extract instincts from observations (DBSCAN-style clustering)
dev_instinct(action='extract')

# List all instincts (by confidence, descending)
dev_instinct(action='list')

# Filter by domain
dev_instinct(action='list', domain='swift-style')
```

#### Confidence Mechanism

| Confidence | Meaning | Evolvable? |
|-----------|---------|------------|
| 0.3 | Initial (first cluster from 3+ observations) | No |
| 0.5-0.7 | Medium (reinforced by repeated extraction) | No |
| 0.8-0.89 | High (requires confirmation to evolve) | Confirm first |
| >= 0.9 | Very high (well validated) | Yes, directly |

Each `extract` call increments confidence by +0.1 for existing clusters (capped at 1.0).

#### Auto Domain Classification

| Domain | Keywords |
|--------|----------|
| swift-style | swift, guard, optional, closure, protocol |
| android-kotlin | kotlin, android, compose, coroutine, flow |
| typescript | typescript, type, interface, generic, async |
| git-workflow | commit, branch, merge, rebase, push |
| testing | test, mock, assert, spec, unit |
| performance | performance, memory, optimize, cache, slow |

#### Evolution (/dev evolve)

Convert high-confidence instincts into persistent assets:

| Instinct Type | Evolution Target | Registration |
|---------------|-----------------|-------------|
| Pattern/Rule | `.claude/rules/pattern-*.md` | Auto-discovered |
| Action | `skills/new-skill/SKILL.md` | Via plugin.json |
| Workflow | `commands/new-command.md` | Auto-discovered |
| Prevention | `.claude/rules/anti-pattern-*.md` | Auto-discovered |

### Notion Pipeline

Pull tasks from Notion databases, generate specs, and automate the requirements-to-implementation pipeline.

#### Configuration

Add Notion config in `.dev-flow.json`:

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
Notion DB → /dev inbox → select task → /dev spec → generate spec
    → human confirm → /dev create-plan → /dev implement-plan
```

#### /dev inbox — Task Triage

```bash
# View all tasks
/dev inbox

# Filter by priority
/dev inbox --priority High

# Filter by platform
/dev inbox --platform iOS
```

Example output:
```
| # | Title              | Priority | Platform | Status      |
|---|--------------------|----------|----------|-------------|
| 1 | Optimize user login | High     | iOS      | In Progress |
| 2 | Dark mode support   | Medium   | Android  | To Do       |
```

Select a task to automatically chain to `/dev spec`.

#### /dev spec — Spec Generation

```bash
# Generate spec from selected task
/dev spec {page_id}
```

**Auto-executes**:
1. Fetch page details via Notion MCP
2. Classify task type (Feature / Bug / Improvement / Tech-Debt)
3. Load corresponding template and fill content
4. Save to `thoughts/shared/specs/SPEC-{id}.md`
5. Human confirmation, then chain to `/dev create-plan`

### Product Brain

Extract, store, and query product architecture knowledge. Automatically captures domain knowledge after each implementation for future context.

#### Usage

```bash
# Auto-extract from recent commits
dev_product(action='extract')

# Extract with spec file for richer context
dev_product(action='extract', specPath='thoughts/shared/specs/SPEC-001.md')

# Query by domain
dev_product(action='query', domain='ios')

# Query by topic
dev_product(action='query', topic='authentication')

# Keyword search
dev_product(action='query', query='JWT token')

# Manually save a knowledge entry
dev_product(action='save', title='Auth architecture', content='Using JWT + refresh token...', domain='backend', topic='authentication')

# Write to Auto Memory topic files
dev_product(action='write_topics')
```

#### Auto Classification

File paths auto-infer domain and topic:

| Domain | Path Signals |
|--------|-------------|
| ios | `/ios/`, `.swift`, `xcodeproj` |
| android | `/android/`, `.kt`, `gradle` |
| web | `/web/`, `.tsx`, `.jsx` |
| backend | `/backend/`, `/api/`, `.go`, `.py` |

| Topic | Path Signals |
|-------|-------------|
| authentication | `auth`, `login`, `session` |
| navigation | `nav`, `router`, `route` |
| data-layer | `data`, `model`, `schema`, `db` |
| ui | `ui`, `view`, `component`, `screen` |
| networking | `network`, `api`, `request`, `http` |

#### Recommended Workflow

```
Spec → implement → commit
    → dev_product(extract, specPath: "specs/SPEC-X.md")  # capture knowledge
    → before next related work: dev_product(query, domain: "ios")  # retrieve context
```

### Rules Distribution

Platform-aware rule templates auto-installed to `.claude/rules/`.

#### Usage

```bash
# List all available templates
/dev rules list

# Auto-detect platform and install matching rules
/dev rules install

# Install all templates regardless of platform
/dev rules install --all

# Show diff between installed rules and templates
/dev rules diff

# Update installed rules to latest template versions
/dev rules sync
```

#### Available Templates (11)

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

#### Install Logic

1. Detect platform via `dev_config`
2. **Always install**: coding-style, testing, git-workflow, security, performance, agent-rules
3. **Platform-specific**: iOS → coding-style-swift + ios-pitfalls; Android → coding-style-kotlin + android-pitfalls; TypeScript → coding-style-typescript
4. Install to `.claude/rules/dev-flow/` (namespaced)

> `/dev init` automatically calls `/dev rules install` — no manual setup needed.

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

**Cause**: Project not configured and not iOS/Android/Web

**Solution** (recommended: `.dev-flow.json`, configures both platform and commands):

```json
{
  "platform": "python",
  "commands": {
    "fix": "black .",
    "check": "ruff . && mypy ."
  }
}
```

> The `platform` field also affects knowledge injection and `dev_memory` classification.

Or create `Makefile`:
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
| Setup | First init | Configure dev-flow environment + memory |
| SessionStart | Resume session | Load ledger + platform knowledge + last summary |
| PreCompact | Before compact | Backup transcript |
| Stop | Session end | Generate session summary (Tier 1+) |
| PostToolUse | After tool use | Tool counter + reminders + periodic capture (Tier 3) |

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

### Detection Priority

```
1. .dev-flow.json → Highest priority (explicit user config)
2. File-based detection → Auto-infer
   *.xcodeproj / Podfile / Package.swift → ios
   build.gradle → android
   package.json → web
   Otherwise → general
```

> **Mixed projects** (e.g., Svelte+Tauri with both `package.json` and `Cargo.toml`) should use `.dev-flow.json` to explicitly set the platform.

### Built-in Platforms

| Platform | Detection | lint fix | lint check | test | verify |
|----------|-----------|----------|------------|------|--------|
| iOS | `*.xcodeproj`, `Podfile` | swiftlint --fix | swiftlint | xcodebuild test | swiftlint && xcodebuild build |
| Android | `build.gradle` | ktlint -F | ktlint | ./gradlew test | ktlintCheck && ./gradlew assembleDebug |
| Web | `package.json` | (custom) | (custom) | (custom) | (custom) |

### Custom Platform

Use `.dev-flow.json` to specify platform and commands for any project, overriding auto-detection:

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

The `platform` field in `.dev-flow.json` also affects:
- `dev_config` command output
- Knowledge injection (SessionStart loads platform-specific pitfalls)
- `dev_memory` knowledge classification

### Extend New Platform (Developers)

1. `mcp-server/src/detector.ts` - Add detection logic (`detectPlatformSimple()` unified entry point)
2. `mcp-server/src/platforms/xxx.ts` - Implement command config

---

## Version History

### v6.0.0 (2026-02-27)

- **Instinct System**: Auto-extract patterns from observations, cluster into evolvable instincts (`dev_instinct` tool)
- **Notion Pipeline**: Task triage (`/dev inbox`), spec generation (`/dev spec`), post-merge status update hook
- **Product Brain**: Product knowledge extraction & query (`dev_product` tool), post-commit architecture extraction
- **Memory Architecture Alignment**: Auto Memory bidirectional sync (`syncToMemoryMd`), topic file output, path-scoped pitfalls
- **Rules Distribution**: 9 platform-aware rule templates + `/dev rules` command, `/dev init` auto-install
- **Structure Consistency**: All 5 plugins unified hooks/scripts/ path, added missing CLAUDE.md
- **Test Infrastructure**: vitest config + 6 test files 98 tests + validate-plugins.sh + CI workflow
- **Hook System Upgrade**: post-edit-format multi-formatter dispatch, context-warning strategic compaction, session-end cleanup
- **Security Scan Skill**: 10-category deny-rules detection + guardrails reference
- **Eval Harness Skill**: Session performance evaluation framework
- **Search-First / Skill-Stocktake**: Search-first thinking + skill audit
- **Checkpoint Command / Migration & Tech-Debt Checklists**: Manual checkpoints + plan template enhancement
- **Contributing Guide + PR Template**: Standardized contribution workflow

### v5.0.0 (2026-02-12)

- **5-Gate Execution Pipeline**: Per-task quality gates — Fresh Subagent → Self-Review (11-point) → Spec Review → Quality Review → Batch Checkpoint
- **brainstorm skill**: Independent pre-creative-work exploration via Socratic questioning
- **verify skill**: Internal skill enforcing "no completion claims without fresh verification evidence"
- **spec-reviewer agent**: Verifies implementation matches plan exactly
- **Adaptive Plan Granularity**: logic-task (2-5min, complete code) + ui-task (5-15min, Figma design_ref)
- **`/dev finish` command**: Branch completion with 4 options (merge/PR/keep/discard)
- **CSO Optimization**: All skill descriptions rewritten to state only triggering conditions
- **api-implementer absorbed**: Moved to create-plan/references/api-template.md

### v4.0.0 (2026-02-09)

- **4-Tier Memory System**: Progressive memory — Tier 0 (FTS5) → Tier 1 (Session summaries) → Tier 2 (ChromaDB) → Tier 3 (Observation capture)
- **New MCP Actions**: `dev_memory` adds save/search/get — 3-layer search (lightweight index → full content)
- **FTS5 Synonym Expansion**: 8 default synonym groups (concurrency, auth, crash, etc.), auto-expands queries
- **Session Summary (Stop hook)**: Haiku API or heuristic fallback (subscription users need no API key)
- **Periodic Observations (PostToolUse)**: Auto-classify every N tool uses as decision/bugfix/feature/discovery
- **ChromaDB Semantic Search**: Optional, graceful degradation (pure FTS5 when not installed)
- **Setup Hook Upgrade**: New projects auto-include `memory: { tier: 0 }` config
- **Context Injector Enhanced**: Last session summary injection (budget 2500 tokens)

### v3.17.0 (2026-02-09)

- **Knowledge Consolidation Engine**: `dev_memory` tool, closed-loop Distill → Consolidate → Inject
- **Smart Injection**: SessionStart auto-injects platform pitfalls and task-related knowledge (~500 tokens)
- **Reasoning Persistence**: Dual-write to `thoughts/reasoning/` + FTS5 index
- **Unified Platform Detection**: `detectPlatformSimple()` consolidates 4 detection implementations, `.dev-flow.json` takes highest priority
- **New Command**: /extract-knowledge fully implemented

### v3.16.0 (2026-02-07)

- **agent-team**: Generic Agent Team orchestration skill
- **cross-platform-team**: Refactored to extend agent-team
- **evaluate-agent**: Cross-session baselines + Task metrics integration

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
