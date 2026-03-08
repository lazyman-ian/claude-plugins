# Ralph Loop Execution Mode

Ralph Loop is a **persistence fallback** for implement-plan — not an alternative execution path.

Use it when a plan exceeds a single context window, or as an explicit autonomous execution mode via `/dev ralph-implement`.

## How It Works

The Ralph Loop uses a **Stop hook** to create a self-referential iteration loop:

```
/ralph-loop "prompt" --max-iterations N --completion-promise "PLAN COMPLETE"
  -> Creates .claude/ralph-loop.local.md state file
  -> Agent works on tasks
  -> Agent tries to exit -> Stop hook blocks -> re-injects SAME prompt
  -> Agent reads ledger + git history to find next incomplete task
  -> Repeats until <promise>PLAN COMPLETE</promise> or max iterations
```

## Standard Loop vs Ralph (Persistence Fallback)

| Aspect | Standard Agentic Loop | Ralph (persistence fallback) |
|--------|----------------------|------------------------------|
| Context | Single session | Multiple sessions via Stop hook |
| Gate set | Risk-adaptive (gates 1-5) | Verify + self-healing only |
| Ledger reads | Bootstrap + after each gate | Each iteration reads ledger for progress |
| Quality gates | Full pipeline | Minimal (verify-only) |
| Use when | Normal execution | Plan exceeds single context window |

## When to Use

| Condition | Mode |
|-----------|------|
| ≤3 tasks, simple | Direct (no overhead) |
| Sequential, context may overflow | **Ralph Loop** — persistence fallback |
| 4+ sequential, need full quality gates | Agentic Loop (standard) |
| 3+ parallel phases, no file overlap | Agent Teams |
| Context hits 70% mid-plan | Auto-degrade to Ralph via handoff |

## Auto-Degradation

When implement-plan detects context > 70%:

1. Save state to ledger:
   ```
   dev_ledger(action='task_update', taskId, gate='checkpoint', result='context_rotation')
   ```
2. Output handoff:
   ```
   Context limit approaching. Resume options:
     /dev ralph-implement {plan_path}    ← Stop hook persistence
     new session → /dev implement-plan {plan_path}  ← ledger auto-resume
   ```

Ralph prompt reads ledger state (not just plan checkboxes) to find the correct next task and avoid re-running completed gates.

## Prompt Template

The `/dev ralph-implement` command generates this prompt:

```
You are executing plan: {plan_path}

## Instructions

1. Call dev_ledger(action='status') to read progress from previous iterations
2. Read plan file to understand all tasks and contracts
3. Find first incomplete task (not marked [x] in plan, cross-ref ledger)
4. Execute per contract (acceptance criteria)
5. Run verify command
6. If pass: commit with task's commit message, mark [x] in plan,
   call dev_ledger(action='task_update', taskId, gate='verify', result='pass')
7. If fail: diagnose, fix code (NEVER modify verify), re-verify (max 2)
   Record both attempts: dev_ledger(action='task_update', taskId, gate='verify', result='fail'/'pass', attempt=1/2)
8. Check if ALL tasks done
9. If all done: <promise>PLAN COMPLETE</promise>
10. If not: continue to next task

## Rules
- Autonomy level: {autonomy} (1=milestone output per task, 2=final only)
- Max 2 retries per verify failure
- Stuck 3 iterations on same task: record guardrail in plan, skip to next
- Write proof to .proof/{task-id}.json after each verify pass
- NEVER modify verify commands, only fix implementation code
```

## Configuration

| Parameter | Value | Source |
|-----------|-------|--------|
| `--max-iterations` | tasks × 3 | Calculated from plan |
| `--completion-promise` | `PLAN COMPLETE` | Fixed |
| Prompt | Generated from plan | `/dev ralph-implement` bridge |

## State File

Location: `.claude/ralph-loop.local.md`

Contains iteration count, prompt, completion promise, session ID. Managed by the ralph-loop plugin — do not modify directly.

## Guardrails

### Stuck Detection

If the same task fails verify 3 iterations in a row:
1. Record in plan: `<!-- GUARDRAIL: task {id} skipped after 3 failed iterations -->`
2. Record in ledger: `dev_ledger(action='task_update', taskId, gate='verify', result='guardrail')`
3. Skip to next task

### Safety Net

`--max-iterations` prevents infinite loops. Default: `tasks × 3`.

## Plugin Commands

| Command | Purpose |
|---------|---------|
| `/ralph-loop` | Start loop with custom prompt |
| `/cancel-ralph` | Cancel active loop (removes state file) |
| `/dev ralph-implement` | Bridge: generate prompt from plan + start loop |

## Integration Points

- **Ledger**: Each iteration reads `dev_ledger(status)` to resume from correct task/gate
- **Task Contract**: Contract fields become verification criteria in the prompt
- **Proof Manifest**: Each successful verify writes `.proof/{task-id}.json`
- **Plan Checkboxes**: Tasks marked `[x]` after completion
- **Git History**: Each task committed separately (one commit per task)
