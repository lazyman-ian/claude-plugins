# Ralph Loop Execution Mode

Reference for using the official Anthropic `ralph-loop` plugin as an implement-plan execution mode.

## How It Works

The Ralph Loop uses a **Stop hook** to create a self-referential iteration loop:

```
/ralph-loop "prompt" --max-iterations N --completion-promise "PLAN COMPLETE"
  -> Creates .claude/ralph-loop.local.md state file
  -> Agent works on tasks
  -> Agent tries to exit -> Stop hook blocks -> re-injects SAME prompt
  -> Agent sees previous work in files + git history
  -> Repeats until <promise>PLAN COMPLETE</promise> or max iterations
```

## When to Use

| Condition | Mode | Reason |
|-----------|------|--------|
| <= 3 tasks, simple | Direct | No overhead |
| Sequential, autonomy 2, clear verify | **Ralph Loop** | Zero orchestration, Stop hook drives |
| 4+ sequential, need quality gates | Agent Orchestration | 5-gate pipeline per task |
| 3+ parallel phases, no file overlap | Agent Teams | True parallelism |
| Sequential + autonomy 2 + TDD | Ralph Loop + TDD | Each iteration = RED-GREEN-REFACTOR |

## Prompt Template

The bridge command (`/dev ralph-implement`) generates this prompt from the plan:

```
You are executing plan: {plan_path}

## Instructions

1. Read the plan file to understand all tasks and their contracts
2. Check git log and file state to identify what's already done
3. Find the first incomplete task (not marked [x])
4. Execute the task per its contract (acceptance criteria)
5. Run the task's verify command
6. If verify passes: commit with the task's commit message, mark task done in plan
7. If verify fails: diagnose error, fix code (NEVER modify verify command), re-verify
8. After completing a task, check if ALL tasks are done
9. If all done: output <promise>PLAN COMPLETE</promise>
10. If not all done: continue to next task

## Rules

- Follow each task's `contract` field as acceptance criteria
- Output level: {autonomy_level} (1=milestone per task, 2=final only)
- Self-healing: max 2 retries per verify failure
- If stuck 3 iterations on same task: record guardrail in plan, skip to next
- Write proof to .proof/{task-id}.json after each verify pass
- NEVER modify verify commands, only fix implementation code
```

## Configuration

| Parameter | Value | Source |
|-----------|-------|--------|
| `--max-iterations` | tasks x 3 | Calculated from plan |
| `--completion-promise` | "PLAN COMPLETE" | Fixed |
| Prompt | Generated from plan | Bridge command |

## State File

Location: `.claude/ralph-loop.local.md`

Contains iteration count, prompt, completion promise, session ID. Managed by the ralph-loop plugin — do not modify directly.

## Guardrails

### Stuck Detection

If the same task fails verify 3 iterations in a row:
1. Record in plan: `<!-- GUARDRAIL: task {id} skipped after 3 failed iterations -->`
2. Skip to next task
3. Continue loop

### Context Rotation

Ralph Loop operates within a single session. If context approaches 70%:
1. The loop naturally ends (agent exits)
2. SessionStart auto-resume (Phase 5) picks up where left off
3. User can `/clear` and resume manually

### Safety Net

`--max-iterations` prevents infinite loops. Default: `tasks x 3`.

## Plugin Commands

| Command | Purpose |
|---------|---------|
| `/ralph-loop` | Start loop with custom prompt |
| `/cancel-ralph` | Cancel active loop (removes state file) |
| `/dev ralph-implement` | Bridge: generate prompt from plan + start loop |

## Integration Points

- **Task Contract**: Contract fields become verification criteria in the prompt
- **Proof Manifest**: Each successful verify writes `.proof/{task-id}.json`
- **Plan Checkboxes**: Tasks marked `[x]` in plan file after completion
- **Git History**: Each task committed separately (one commit per task)
