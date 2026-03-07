---
name: verify
description: >-
  Enforces the verification-driven development (VDD) iron law: no completion claims without fresh
  verification evidence. This skill should be used when any task, phase, or feature needs final
  verification before being marked complete. Runs platform-specific build, lint, and test commands
  and requires exit code 0 as the only acceptable completion signal. Invoked internally by
  implement-plan, agent-team, and debugging — not directly by users.
  Triggers on "verify completion", "run verification", "check done", "验证完成", "检查通过", "确认完成", "验证测试".
  Do NOT use for pre-commit linting only — use "self-check" instead.
user-invocable: false
allowed-tools: [Bash, Read, Glob, Grep]
---

# Verify - Verification Before Completion

Internal skill that enforces the Iron Law: "No completion claims without fresh verification evidence."

## When Referenced

- implement-plan: after each task completion
- agent-team: Phase 4 Close before TeamDelete
- debugging: Phase 5 VERIFY after fix applied

## Core Rules

1. Claims of completion MUST be accompanied by fresh verification evidence
2. Verification must be CURRENT — not referencing previous runs
3. Forbidden language: "should work", "probably fine", "seems to", "I believe"
4. Do not trust agent success reports — run verification independently
5. Exit code 0 is the only acceptable completion signal

## Verification Gate

```
1. IDENTIFY: Get verification command
   - From plan task `verify` field (preferred)
   - From `dev_config()` platform commands (fallback)
   - From explicit user instruction

2. RUN: Execute verification command
   - Full output, no truncation
   - Capture exit code

3. READ: Analyze output
   - Exit code 0? → proceed
   - Exit code non-0? → STOP, report failure

4. VERIFY: Output confirms claimed state?
   - Tests actually pass (not "test suite found")?
   - Build succeeds (not just "build started")?
   - Lint clean (not "lint found 0 errors in 0 files")?

5. ONLY THEN: Claim completion with evidence
```

## Common Failure Patterns

| Pattern | Problem | Correct |
|---------|---------|---------|
| "Tests passed earlier" | Stale evidence | Run tests NOW |
| "The fix should work" | No verification | Run and show output |
| "Linter only has warnings" | Unverified claim | Show linter output |
| "Build succeeded" (no output) | Unverified claim | Show build log |
| Trusting agent "done" report | May be false | Run verify independently |

## Proof Manifest

After every successful verification, write `.proof/{task-id}.json`:

```json
{
  "task_id": "TASK-123",
  "timestamp": "2026-03-08T10:00:00Z",
  "verdict": "pass",
  "commands": [
    { "cmd": "npm test", "exit_code": 0, "key_metrics": "42 tests passed" }
  ],
  "diff_stats": { "files": 3, "insertions": 47, "deletions": 12 }
}
```

Rules:
- `task_id`: from plan task field or `dev_ledger` current task
- `diff_stats`: from `git diff --stat HEAD` at verify time
- `verdict`: `pass` only when all commands exit 0; otherwise `fail`
- Write proof AFTER verification, never before
- Proof is additive — does not replace or modify the verify command

## Self-Healing Retry

On verify failure (max 2 retries):

```
1. DIAGNOSE: Analyze failure output → identify root cause
2. FIX: Patch implementation code to address root cause
3. RE-VERIFY: Re-run the original verify command unchanged
4. If still failing after 2 retries → STOP, report with diagnosis
```

Guardrails:
- NEVER modify the verify command itself
- NEVER lower the success bar (no `|| true`, no exit code suppression)
- Only fix implementation code, not tests or verify scripts
- If fix requires changing test expectations → escalate to user

## Integration Points

### implement-plan
After each task's quality review (Gate 5):
```
Task complete → verify skill → pass → write .proof/{task-id}.json → handoff + TaskUpdate
                             → fail → self-heal (max 2) → pass or report
```

### agent-team
Phase 4 Close:
```
All tasks done → verify skill (full suite) → pass → write .proof/{task-id}.json → aggregate + shutdown
                                            → fail → SendMessage teammate to fix
```

### debugging
Phase 5 VERIFY:
```
Fix applied → verify skill → pass → write .proof/{task-id}.json → document + close
                            → fail → self-heal (max 2) → pass or back to FIX phase
```
