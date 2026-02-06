---
name: cross-platform-team
description: Orchestrates Agent Teams for parallel cross-platform development across multiple repositories (iOS/Android/Web). Composes existing skills (create-plan, implement-plan, dev commit, dev pr, research) instead of reimplementing. This skill should be used when user says "cross-platform", "跨平台开发", "multi-repo team", "同时开发", "parallel platform", "iOS Android Web 同时", "组队开发多仓库". Triggers on /cross-platform-team, 跨平台并行, 多仓库协作.
memory: user
context: fork
allowed-tools: [Read, Glob, Grep, Bash, Skill, Task, TeamCreate, TeamDelete, SendMessage, TaskCreate, TaskUpdate, TaskList, TaskGet, AskUserQuestion, mcp__Framelink_MCP_for_Figma__get_figma_data, mcp__plugin_dev-flow_dev-flow__*, mcp__apple-docs__*, mcp__sosumi__*, mcp__plugin_context7_context7__*]
---

# Cross-Platform Team

Cross-platform extension of the `agent-team` skill. Adds multi-repo platform resolution, shared contracts, plan review, and convention sync.

**Base orchestration** (team lifecycle, task graphs, model selection, teammate coordination): see `agent-team` skill.

## Skill Composition Map

```
/cross-platform-team orchestrates:
│
├─ Phase 1a (Lead)
│  ├─ /research          ← API/tech research if needed
│  └─ /create-plan       ← Generate cross-platform plan
│
├─ Phase 1b (Team, plan review)
│  ├─ ios-reviewer       ← Verify iOS section: files, API alignment, steps
│  ├─ android-reviewer   ← Verify Android section
│  └─ Lead merges fixes → iterate plan
│
├─ Phase 1c: User review (pre-vetted plan)
│
├─ Phase 2 (Lead)
│  └─ /dev start         ← Create branch + ledger per repo
│
├─ Phase 3 (Teammates, parallel)
│  ├─ /implement-plan    ← Execute platform section from plan
│  ├─ /dev commit        ← Commit per phase
│  ├─ /deslop            ← Clean AI slop
│  └─ /self-check        ← Quality verification
│
├─ Phase 4 (Lead)
│  ├─ /dev pr            ← Create PR per repo
│  └─ /describe          ← Generate PR description
│
└─ Phase 5 (Lead, auto)
   └─ Learn              ← Update stats + convention sync
```

## Documentation & Reference Tools

| Platform | Tool | Usage |
|----------|------|-------|
| iOS | `mcp__apple-docs__*` | choose_technology → search_symbols → get_documentation |
| iOS | `mcp__sosumi__*` | searchAppleDocumentation → fetchAppleDocumentation |
| Any | `mcp__plugin_context7_context7__*` | resolve-library-id → query-docs |
| iOS | `/swiftui-expert`, `/swift-concurrency`, `/ios-api-helper` | Platform skills |
| Android | context7: `kotlin`, `android`, `retrofit`, `hilt` | Kotlin/Android |
| Web | context7: `vue`, `pinia`, `vue-router`, `vite` | Vue ecosystem |

## Workflow

### Phase 1a: Draft Plan (Lead, opus)

1. Resolve platforms (see Platform Resolution)
2. Research if needed → spawn research agent (model: opus)
3. Verify key APIs via documentation tools
4. Create plan with per-platform sections → `/create-plan` or plan-agent (model: opus)
   - `/create-plan` generates frontmatter v2.0 with phases metadata per platform
   - Plan template: see `references/platform-templates.md`
5. Optional: validate tech choices → `Task(subagent_type="dev-flow:validate-agent")`

### Phase 1b: Team Plan Review (parallel, sonnet)

Platform-specific reviewers validate plan quality from each repo's perspective.

```
TeamCreate({ team_name: "TASK-{id}-review" })

Task({
  subagent_type: "Explore",         # Read-only, no edits
  team_name: "TASK-{id}-review",
  name: "{platform}-reviewer",
  prompt: <<PROMPT
Review {plan_path} section "Platform: {Platform}".
Repo: {repo_path}

## Checklist
1. File existence: do target files exist? (mark [NEW] for new files)
2. API alignment: Shared Contract fields match platform code?
3. Data models: type mappings correct? (iOS Bool vs Android Boolean)
4. Step completeness: missing i18n, push handling, UI entry?
5. Dependencies: prerequisite file changes?
6. Verify command: matches CLAUDE.md/Makefile?

## Output (SendMessage to lead)
- Pass items
- Items needing fix (with suggestions)
- Actual code locations (file:line)
PROMPT
})
```

Lead merges reviewer feedback → fixes plan → iterates until no warnings.

### Phase 1c: User Review

After team self-review, plan quality is higher. User focuses on:
- Business logic correctness
- Priority ordering
- Platform inclusion/exclusion

### Phase 2: Prepare (Lead)

Per target repo: `Skill("dev", "start TASK-{id}-{feature} in {repo_path}")`

### Phase 3: Implement (Team, parallel, sonnet)

Before spawning, detect cross-platform file conflicts:
```
dev_coordinate(action='plan', mode='fan-out', tasks=[
  { id: 'ios', targetFiles: ['{ios plan target_files}'] },
  { id: 'android', targetFiles: ['{android plan target_files}'] }
])
```

Spawn per-platform teammate using `agent-team` patterns:

```
TeamCreate({ team_name: "TASK-{id}" })

Task({
  subagent_type: "general-purpose",
  team_name: "TASK-{id}",
  name: "{platform}-dev",
  prompt: <<PROMPT
You are {platform} developer at {repo_path} implementing TASK-{id}.

## Steps
1. git -C {repo_path} checkout {branch}
2. Read {repo_path}/CLAUDE.md
3. /implement-plan — execute "Platform: {Platform}" section from {plan_path}
   (plan has frontmatter v2.0 — implement-plan auto-creates tasks from phases)
4. Each phase done → /dev commit
5. All done → /self-check
6. SendMessage lead: done + git diff --stat

## Code Cleanup
- /deslop after implementation
- Task(subagent_type="code-simplifier:code-simplifier") for deep simplification

## Platform Agents (optional)
- iOS: Task(subagent_type="ios-swift-plugin:concurrency-reviewer")
- iOS: Task(subagent_type="ios-swift-plugin:performance-auditor")
- All: Task(subagent_type="dev-flow:code-reviewer")
- All: Task(subagent_type="dev-flow:debug-agent")
- All: Task(subagent_type="codebase-pattern-finder")
- All: Task(subagent_type="research:research-agent")

## Rules
- Uncertain → SendMessage lead
- Verify fails → keep fixing, don't report done
PROMPT
})
```

### Phase 4: Close (Lead)

```
1. Review: git -C {repo} diff {base}..{branch} --stat
2. Issues → SendMessage teammate to fix
3. Aggregate all handoffs: dev_aggregate(action='pr_ready', taskId='TASK-{id}')
4. Per repo: /dev pr → auto-push + create PR
5. /describe → PR description (use aggregated summary)
6. Shutdown teammates → TeamDelete
7. Summary: PR links per platform
```

## Platform Resolution

| Priority | Method | Example |
|----------|--------|---------|
| 1 | Explicit | `只做 iOS 和 Android` |
| 2 | Preset | `mobile` → [ios, android] |
| 3 | Default | mobile (most common) |
| 4 | AskUserQuestion | If ambiguous |

**Presets**: `mobile` [ios,android] · `all` [ios,android,web] · `full-stack` [+backend]

## Memory: Conventions

Auto-populated on first use, updated by Phase 5.

**First run** → auto-discover from each repo:
1. Read `{repo_path}/CLAUDE.md` for tech stack, verify commands
2. `git symbolic-ref refs/remotes/origin/HEAD` for base branch
3. Check `Makefile` for fix/check targets
4. `AskUserQuestion` if repo paths not found

```yaml
repos:
  ios: {discovered_path}
  android: {discovered_path}
  web: {discovered_path}
conventions:
  ios: { base: master, verify: "make fix && make check" }
  android: { base: master, verify: "make fix && make check" }
  web: { base: develop, verify: "pnpm lint" }
branch_pattern: "feature/TASK-{id}-{feature}"
```

**Discovery priority**: Parent dir CLAUDE.md → Glob common patterns → AskUserQuestion

## Plan Structure (for create-plan)

```markdown
---
plan_version: "2.0"
status: draft
created: YYYY-MM-DD
ticket: TASK-{id}
phases:
  - id: 1
    name: "iOS Phase 1: {name}"
    complexity: medium
    model: sonnet
    parallelizable: true    # true = can run parallel with other platform
    depends_on: []
    target_files: ["ios/path/to/file.swift"]
    verify: ["make fix && make check"]
  - id: 2
    name: "Android Phase 1: {name}"
    complexity: medium
    model: sonnet
    parallelizable: true
    depends_on: []
    target_files: ["android/path/to/File.kt"]
    verify: ["make fix && make check"]
key_decisions: {}
---

# {Feature} Implementation Plan
## Overview
Ticket: TASK-{id} | Platforms: [iOS, Android]
## Shared Contract
### API Endpoints / Data Models / UI States
## Platform: iOS
### Alignment Table
### Phase 1-N: {description}
- Files: {paths}
- Steps: ...
### Verify: make fix && make check
## Platform: Android
### Alignment Table
### Phase 1-N
### Verify: make fix && make check
```

**Note**: `parallelizable: true` on cross-platform phases (different repos = no file overlap by default). `implement-plan` uses this metadata for auto-task creation.

## Usage Examples

### Standard
```
/cross-platform-team mobile
TASK-{id} implement {feature}
Requirements: #PRD-{feature}.md
```

### Sync from reference
```
/cross-platform-team android
iOS already implemented TASK-{id}, sync to Android
```

### Plan only
```
/cross-platform-team plan-only mobile
TASK-{id} implement {feature}
```

### Implement existing plan
```
/cross-platform-team implement
Plan: #thoughts/shared/plans/PLAN-TASK-{id}.md
```

## Phase 5: Learn (Lead, auto)

After each run, update `~/.claude/memory/cross-platform-stats.yaml`:
- Append run metrics (platforms, mode, results, issues)
- Detect convention changes (base branch, verify, commit style)
- Update memory if drifted

See `references/self-evolution.md` for full learning loop.

## Repo Convention Auto-Sync

Each run start: `git log -5, CLAUDE.md, Makefile → compare with memory`. If changed → update memory + warn user.

## Error Handling

| Situation | Action |
|-----------|--------|
| Repo path not found | AskUserQuestion → save to memory |
| Branch exists | Checkout existing |
| Teammate verify fails | Report, keep trying |
| Plan ambiguous | Teammate asks lead |
| Skill not available | Fallback to manual commands |
