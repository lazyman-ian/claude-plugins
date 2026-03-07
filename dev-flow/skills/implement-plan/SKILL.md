---
name: implement-plan
description: Executes approved implementation plans from thoughts/shared/plans/ using an adaptive execution engine with risk-based quality gates. This skill should be used when the user has an approved plan and wants to implement it step-by-step with verification gates (fresh subagent, self-review, spec review, quality review). Triggers on "implement plan", "execute plan", "follow the plan", "run the plan", "start implementation", "use tdd", "test driven", "按计划实现", "执行方案", "按计划执行", "测试驱动", "执行计划", "实施方案", "分阶段实现". Do NOT use for general development workflow (commit/PR/release) — use "dev" instead.
model: opus
memory: project
context: fork
allowed-tools: [Read, Glob, Grep, Edit, Write, Bash, Task, TaskCreate, TaskUpdate, TaskList, TaskGet, mcp__plugin_dev-flow_dev-flow__*, mcp__figma__get_design_context, mcp__figma__get_screenshot, mcp__figma__get_metadata]
---

# Implement Plan

Execute approved technical plans from `thoughts/shared/plans/` with adaptive quality gates.

## When to Use

- `/implement_plan [plan-path]`
- "implement plan", "execute plan", "follow the plan"
- 按计划实现, 执行方案
- "use tdd", "test driven", "测试驱动开发" (enables TDD mode)

## Execution Engine

Single entry point for all plan execution. The orchestrator:

1. Call `dev_ledger(action='status')` — check for in-progress tasks from previous session
2. Read plan file completely (check `[x]` marks + frontmatter tasks array)
3. Pick the first incomplete task
4. Assess risk per task → determine gate set → run gates
5. After each gate: `dev_ledger(action='task_update', taskId, gate, result)`
6. Verify pass → commit → mark `[x]` → continue
7. Context > 70% → save state to ledger → generate Ralph prompt → output handoff

**Continue** (ALL AND): verify pass + changes within scope + context < 70%
**Stop** (ANY OR): verify fail 2x + out-of-scope changes + context > 80% + security/architecture issue

**Uncertainty**: Runtime questions → spawn Decision Agent → answer → continue. Security/architecture → escalate to Human.

See `references/execution-engine.md` for detailed engine mechanics.

## Risk-Adaptive Gates

Each task's risk level (explicit `risk:` field > file path pattern > change type) determines which gates run:

| Gate | low | medium | high |
|------|-----|--------|------|
| 1. Fresh Subagent | — | run | run |
| 2. Self-Review | run | run | run |
| 3. Spec Review | — | — | run |
| 4. Quality Review | — | run | run |
| 5. Verify | run | run | run |

Default risk when not specified: **medium**.

See `references/risk-assessment.md` for file path patterns and change type inference rules.

## Plan Frontmatter v2.1

Tasks gain optional `risk` field (backward compatible — missing = medium):

```yaml
tasks:
  - id: "1.1"
    type: logic-task
    risk: high        # optional: low | medium | high
    contract: |
      - Acceptance criterion
    verify: "make test"
    commit: "feat(scope): description"
```

Plans without `risk` field follow v2.0 format — no changes needed.

## Execution Strategy

| Condition | Strategy |
|-----------|----------|
| ≤3 tasks | Direct — orchestrator executes inline |
| 4+ tasks, sequential | Subagent per task — fresh context isolation |
| 3+ tasks, parallelizable, no file overlap | Agent Teams — true parallelism |

For Agent Teams: `dev_coordinate(action='plan', mode='fan-out')` detects `target_files` overlaps before spawning.

## Output Levels (from task `autonomy` field)

| Level | Output |
|-------|--------|
| 1 (milestone) | `[Task N/M] name done (X files, verify pass)` |
| 2 (final only) | `Done: N/M tasks, X files, all pass. Proof: .proof/` |

## Ralph: Persistence Fallback

Ralph Loop is not an alternative path — it is a **fallback for when context limits prevent completing the plan in a single session**.

When context approaches 70%, the orchestrator saves state to ledger and outputs:
```
Context limit approaching. Resume options:
  /dev ralph-implement {plan_path}    ← continues via Stop hook across sessions
  new session → /dev implement-plan {plan_path}  ← ledger auto-resume
```

`/dev ralph-implement` as explicit invocation works the same way — it reads ledger progress to find the next task.

See `references/ralph-loop-mode.md` for Stop hook mechanics and configuration.

## TDD Mode (RED-GREEN-REFACTOR)

**Triggers**: "use tdd", "test driven", "测试驱动", "red green refactor"

For each feature:

### RED: Write Failing Test
1. Write test for the next small behavior
2. Run — it MUST fail
3. Commit: `test(scope): add test for [feature]`

### GREEN: Make It Pass
1. Write minimal code to pass the test
2. Run — it MUST pass
3. Commit: `feat(scope): implement [feature]`

### REFACTOR: Clean Up
1. Improve structure, no behavior change
2. Run all tests — still pass
3. Commit: `refactor(scope): [description]`

**TDD Principles**: Small steps (5-15 min cycles). Test behavior, not implementation. No premature optimization.

## Getting Started

### Standard Mode

1. Check `dev_ledger(action='status')` for resume state
2. Read plan completely (check existing `[x]` marks)
3. If plan has `plan_version: "2.0"` or `"2.1"`: auto-create tasks from phases `tasks` array
4. Create TaskCreate entries for phases, set dependencies
5. Execute per engine loop (see above)

### TDD Mode

1. Read plan, identify testable units
2. For each unit: RED → GREEN → REFACTOR
3. Verify all tests pass after each cycle
4. Update plan checkboxes

## Progress Tracking

After each task:
```
[Task N/M] name done (X files, verify pass)
```

After each phase:
```
Phase 2/5 complete (40%)
- [x] Phase 1: Schema
- [x] Phase 2: API endpoints
- [ ] Phase 3: UI components
```

Update plan checkboxes and `TaskUpdate(status: 'completed')` for each finished phase.

## Resuming Work

If plan has existing `[x]` marks:
- Trust completed work is done
- Pick up from first unchecked item
- Cross-reference ledger state for gate results

## Conflict Detection

Before parallel execution:
```
dev_coordinate(action='plan', mode='fan-out', tasks=[
  { id: 't1', targetFiles: ['src/auth.ts'] },
  { id: 't2', targetFiles: ['src/auth.ts'] }  // conflict → serialize
])
```
Conflicting phases: `TaskUpdate({ taskId: 't2', addBlockedBy: ['t1'] })`.

## Agent Teams Mode

**Trigger**: 3+ phases with `parallelizable: true` in frontmatter, no `target_files` overlap.

1. `dev_coordinate(action='plan', mode='fan-out')` → confirm no conflicts
2. Confirm with user: "3 phases are parallelizable. Use Agent Teams?"
3. `TeamCreate` → spawn teammates → assign phases via `TaskUpdate(owner)`
4. Each teammate: implement → `dev_handoff(action='write')` → complete
5. `dev_aggregate(action='pr_ready', taskId=...)` → unified summary
6. `SendMessage(type='shutdown_request')` → `TeamDelete`

## If Things Don't Match

```
Issue in Task [N]:
Expected: [what the contract says]
Found: [actual situation]
→ Route to Decision Agent for resolution
```

## Plan Closure

When all tasks complete:
1. Update plan frontmatter `status: completed`
2. `dev_aggregate(action='pr_ready', taskId=...)` → final summary
3. Auto-commit after final verify pass

## Reference Menu

| Reference | Load When |
|-----------|-----------|
| `references/execution-engine.md` | Engine mechanics, ledger API, proof manifest format |
| `references/risk-assessment.md` | Risk signals, file path patterns, gate matrix |
| `references/task-management.md` | Task creation/tracking patterns |
| `references/agent-orchestration.md` | Agent mode (4+ tasks) |
| `references/task-executor.md` | Single task TDD workflow |
| `references/receiving-review.md` | How to handle review feedback |
| `references/ralph-loop-mode.md` | Ralph Loop Stop hook mechanics |
