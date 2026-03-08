---
description: "Execute plan autonomously via Ralph Loop"
argument-hint: "[plan-path] [--max-iterations N]"
---

# /dev ralph-implement - Autonomous Plan Execution

Bridge command: generates optimal Ralph prompt from a dev-flow plan and starts a Ralph Loop.

Works as both an explicit invocation and as the auto-degradation target when implement-plan hits context limits.

## Usage

```
/dev ralph-implement thoughts/shared/plans/2026-03-08-feature.md
/dev ralph-implement thoughts/shared/plans/2026-03-08-feature.md --max-iterations 30
```

If no plan path is given, the most recent plan in `thoughts/shared/plans/` is used.

## Auto-Degradation

When `implement-plan` detects context > 70%, it outputs a handoff and recommends:

```
/dev ralph-implement {plan_path}
```

In this case, Ralph continues from where implement-plan stopped — it reads the **ledger** (not just plan checkboxes) to find the correct next task and avoid re-running completed gates.

## Process

### Step 1: Read Plan

Parse `$ARGUMENTS` for the plan path (first positional argument).

If no path given, find the most recent plan:
```bash
ls -t thoughts/shared/plans/*.md 2>/dev/null | head -1
```

Read the plan file completely before proceeding.

### Step 2: Read Ledger Progress

Call `dev_ledger(action='status')` to check for in-progress tasks from a previous session.

If ledger shows completed tasks, the generated prompt instructs Ralph to skip them.

### Step 3: Extract Task Metadata

From the plan's YAML frontmatter, extract:

| Field | Source | Fallback |
|-------|--------|---------|
| Task count | Sum of all `tasks` arrays across phases | Count `- [ ]` checkboxes in body |
| Autonomy level | Highest `autonomy` value across tasks | `1` |
| Verify commands | Per-task `verify` field | `dev_config` platform verify |

### Step 4: Calculate Parameters

| Parameter | Rule |
|-----------|------|
| `max-iterations` | `--max-iterations` arg if provided, otherwise `task_count * 3` |
| `completion-promise` | Always `PLAN COMPLETE` |

### Step 5: Generate Ralph Prompt

Build the prompt string:

```
You are executing plan: {plan_path}

## Instructions

1. Call dev_ledger(action='status') to read progress from previous iterations
2. Read plan file to understand all tasks and their contracts
3. Find first incomplete task (not marked [x] in plan, cross-ref ledger)
4. Execute per contract (acceptance criteria)
5. Run verify command from the task
6. If pass: commit with task's commit message, mark [x] in plan,
   call dev_ledger(action='task_update', taskId, gate='verify', result='pass')
7. If fail: diagnose, fix code (NEVER modify verify), re-verify (max 2)
   Record both attempts via dev_ledger(action='task_update')
8. Check if ALL tasks done
9. If all done: <promise>PLAN COMPLETE</promise>
10. If not: continue to next task

## Rules
- Autonomy level: {autonomy} (1=milestone output per task, 2=final only)
- Max 2 retries per verify failure
- Stuck 3 iterations on same task: record guardrail in plan + ledger, skip to next
- Write proof to .proof/{task-id}.json after each verify pass
- NEVER modify verify commands, only fix implementation code
```

Replace `{plan_path}` and `{autonomy}` with actual extracted values.

### Step 6: Invoke Ralph Loop

```
/ralph-loop "{generated_prompt}" --max-iterations {max_iterations} --completion-promise "PLAN COMPLETE"
```

## Example

```
User: /dev ralph-implement thoughts/shared/plans/2026-03-08-auth.md

-> Reads plan: 5 tasks, autonomy: 2
-> Reads ledger: tasks 1.1, 1.2 already completed
-> max-iterations: 15 (5 * 3)
-> Generates prompt: skip completed tasks, start from 1.3
-> Invokes: /ralph-loop "..." --max-iterations 15 --completion-promise "PLAN COMPLETE"
-> Ralph executes remaining 3 tasks autonomously
-> Outputs: <promise>PLAN COMPLETE</promise>
```

## Options

| Option | Description |
|--------|-------------|
| `[plan-path]` | Path to plan file (default: most recent in `thoughts/shared/plans/`) |
| `--max-iterations N` | Override iteration cap (default: task_count * 3) |
