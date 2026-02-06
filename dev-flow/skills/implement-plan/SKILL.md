---
name: implement-plan
description: Executes implementation plans with TDD and agent orchestration. This skill should be used when user says "implement plan", "execute plan", "follow the plan", "start implementation", "按计划实现", "执行方案", "开始实现", "实现功能", or when using TDD with "use tdd", "test driven", "测试驱动", "red green refactor". Triggers on /implement_plan, 执行计划, 代码实现, TDD开发, 测试驱动.
model: opus
memory: project
context: fork
allowed-tools: [Read, Glob, Grep, Edit, Write, Bash, Task, TaskCreate, TaskUpdate, TaskList, TaskGet]
---

# Implement Plan

Execute approved technical plans from `thoughts/shared/plans/` with optional TDD mode.

## When to Use

- `/implement_plan [plan-path]`
- "implement plan", "execute plan", "follow the plan"
- 按计划实现, 执行方案
- "use tdd", "test driven", "测试驱动开发" (enables TDD mode)

## Execution Modes

| Mode | When to Use |
|------|-------------|
| **Direct** (default) | 1-3 tasks, quick focused work |
| **Agent Orchestration** | 4+ tasks, context preservation critical |
| **TDD Mode** | User requests test-driven development |

## TDD Mode (RED-GREEN-REFACTOR)

**Triggers**: "use tdd", "test driven", "测试驱动", "red green refactor"

When TDD mode is detected, follow this cycle for each feature:

### RED: Write Failing Test

1. Write a test for the next small behavior
2. Run the test - it should FAIL
3. Commit: `test(scope): add test for [feature]`

### GREEN: Make It Pass

1. Write minimal code to make the test pass
2. Run the test - it should PASS
3. Commit: `feat(scope): implement [feature]`

### REFACTOR: Clean Up

1. Improve code structure without changing behavior
2. Run all tests - they should still pass
3. Commit: `refactor(scope): [description]`

### TDD Principles

- **Small steps**: Each cycle 5-15 minutes
- **Fast feedback**: Tests should run quickly
- **No premature optimization**: Get it working first
- **Test behavior, not implementation**: Focus on what, not how

### TDD Checklist

- [ ] Test is written before implementation
- [ ] Test fails before implementation (RED)
- [ ] Minimal code to pass (GREEN)
- [ ] Refactor while tests pass
- [ ] All tests pass after refactor

## Getting Started

### Detect Mode

Check user input for TDD keywords:
- Contains "tdd", "test driven", "测试驱动" → **TDD Mode**
- Otherwise → **Standard Mode**

### Standard Mode Steps

1. Read plan completely (check existing `[x]` marks)
2. Read original ticket + all mentioned files (FULLY)
3. Create tasks with `TaskCreate` for each phase (set dependencies)
4. Start implementing (update task status as you go)

### TDD Mode Steps

1. Read plan and identify testable units
2. For each unit:
   - **RED**: Write failing test
   - **GREEN**: Implement to pass
   - **REFACTOR**: Clean up code
3. Verify all tests pass
4. Update plan checkboxes

## Reference Menu

| Reference | Load When |
|-----------|-----------|
| `references/task-management.md` | Task creation/tracking patterns |
| `references/agent-orchestration.md` | Using agent mode (4+ tasks) |
| `references/task-executor.md` | Single task TDD workflow |

## Direct Implementation

For small plans (≤3 tasks):

### Standard Mode

1. Implement each phase yourself
2. Run success criteria checks
3. Update checkboxes in plan
4. Pause for manual verification per phase

### TDD Mode

1. Break down into testable units
2. For each unit, cycle through RED-GREEN-REFACTOR
3. Commit after each phase (RED/GREEN/REFACTOR)
4. Run full test suite after refactor
5. Update checkboxes in plan

### Verification Flow

```
Phase N Complete - Ready for Manual Verification

Automated verification passed:
- [List automated checks]

Please perform manual verification:
- [List manual items from plan]

Let me know when ready for Phase N+1.
```

## Agent Orchestration

For larger plans (4+ tasks), use agent orchestration:

```
"I'll use agent orchestration for this plan"
```

Then follow `references/agent-orchestration.md`.

### Quick Setup

```bash
mkdir -p thoughts/handoffs/<session-name>
# See references/task-executor.md for TDD workflow
```

## Resuming Work

If plan has existing `[x]` marks:
- Trust completed work is done
- Pick up from first unchecked item
- Verify previous work only if something seems off

## If Things Don't Match

```
Issue in Phase [N]:
Expected: [what the plan says]
Found: [actual situation]
Why this matters: [explanation]

How should I proceed?
```

## Resumable Agents

Check `.claude/cache/agents/agent-log.jsonl` for agent IDs.

```
Task(
  resume="<agentId>",
  prompt="Phase 2 isn't matching. Can you clarify..."
)
```
