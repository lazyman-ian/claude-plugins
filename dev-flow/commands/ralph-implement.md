---
description: "Execute plan autonomously via Ralph Loop"
argument-hint: "[plan-path] [--max-iterations N]"
---

# /dev ralph-implement - Autonomous Plan Execution

Bridge command: generates optimal Ralph prompt from a dev-flow plan and starts a Ralph Loop.

## Usage

```
/dev ralph-implement thoughts/shared/plans/2026-03-08-feature.md
/dev ralph-implement thoughts/shared/plans/2026-03-08-feature.md --max-iterations 30
```

If no plan path is given, the most recent plan in `thoughts/shared/plans/` is used.

## Process

### Step 1: Read Plan

Parse `$ARGUMENTS` for the plan path (first positional argument).

If no path given, find the most recent plan:
```bash
ls -t thoughts/shared/plans/*.md 2>/dev/null | head -1
```

Read the plan file completely before proceeding.

### Step 2: Extract Task Metadata

From the plan's YAML frontmatter, extract:

| Field | Source | Fallback |
|-------|--------|---------|
| Task count | Sum of all `tasks` arrays across phases | Count `- [ ]` checkboxes in body |
| Autonomy level | Highest `autonomy` value across tasks | `1` |
| Verify commands | Per-task `verify` field | `dev_config` platform verify |

### Step 3: Calculate Parameters

| Parameter | Rule |
|-----------|------|
| `max-iterations` | `--max-iterations` arg if provided, otherwise `task_count * 3` |
| `completion-promise` | Always `PLAN COMPLETE` |

### Step 4: Generate Ralph Prompt

Build the prompt string:

```
You are executing plan: {plan_path}

## Instructions

1. Read the plan file to understand all tasks and their contracts
2. Check git log and file state to identify completed tasks
3. Find the first incomplete task (not marked [x] in plan)
4. Execute per its contract (acceptance criteria)
5. Run verify command from the task
6. If pass: commit with task's commit message, mark [x] in plan
7. If fail: diagnose, fix code (NEVER modify verify), re-verify (max 2)
8. Check if ALL tasks done
9. If all done: <promise>PLAN COMPLETE</promise>
10. If not: continue to next task

## Rules
- Autonomy level: {autonomy} (1=milestone output, 2=final only)
- Max 2 retries per verify failure
- Stuck 3 iterations on same task: skip + record guardrail
- Write proof to .proof/{task-id}.json
```

Replace `{plan_path}` and `{autonomy}` with actual extracted values.

### Step 5: Invoke Ralph Loop

```
/ralph-loop "{generated_prompt}" --max-iterations {max_iterations} --completion-promise "PLAN COMPLETE"
```

## Example

```
User: /dev ralph-implement thoughts/shared/plans/2026-03-08-auth.md

-> Reads plan: 5 tasks, autonomy: 2
-> max-iterations: 15 (5 * 3)
-> Generates prompt with plan path + task instructions
-> Invokes: /ralph-loop "..." --max-iterations 15 --completion-promise "PLAN COMPLETE"
-> Ralph Loop executes all 5 tasks autonomously
-> Outputs: <promise>PLAN COMPLETE</promise>
```

## Options

| Option | Description |
|--------|-------------|
| `[plan-path]` | Path to plan file (default: most recent in `thoughts/shared/plans/`) |
| `--max-iterations N` | Override iteration cap (default: task_count * 3) |
