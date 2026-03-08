# Execution Engine — Detailed Mechanics

Detailed reference for the adaptive execution engine used by implement-plan.

## Orchestrator Bootstrap

1. Call `dev_ledger(action='status')` — read ledger for any in-progress tasks from previous session
2. Read plan file completely (check `[x]` marks + frontmatter)
3. Reconcile: ledger is authoritative for gate results; plan checkboxes are authoritative for task completion
4. Pick the first incomplete task (no `[x]` in plan)

## Per-Task Execution Loop

```
for each incomplete task:
  1. Assess risk (see risk-assessment.md)
  2. Determine gate set from gate matrix
  3. Run gate 1 (Fresh Subagent) if medium/high risk
  4. Agent runs gate 2 (Self-Review) internally
  5. Run gate 3 (Spec Review) if high risk
  6. Run gate 4 (Quality Review) if medium/high risk
  7. Run gate 5 (Verify)
  8. After each gate: dev_ledger(action='task_update', taskId, gate, result)
  9. On verify pass: commit, mark [x] in plan, continue to next task
  11. On verify fail: diagnose → fix → re-verify (max 2 attempts, both recorded)
  12. On verify fail 2x: stop + escalate to human

When ALL tasks complete → return to orchestrator (do NOT start Review Gate Loop from inside implement-plan fork)
```

## Risk-Adaptive Gate Set

| Risk | Gates Run |
|------|-----------|
| low  | Self-Review, Verify |
| medium | Fresh Subagent, Self-Review, Quality Review, Verify |
| high | Fresh Subagent, Self-Review, Spec Review, Quality Review, Verify |

Full gate matrix in `risk-assessment.md`.

## Ledger Integration

### Reading Progress

```
dev_ledger(action='status')
```

Returns current task states. Use to resume after context rotation without re-running completed gates.

### Writing Gate Results

```
dev_ledger(action='task_update', taskId='<id>', gate='verify', result='pass', detail='...', duration_ms=1200)
```

Call after **every gate** (including passing gates). This enables the orchestrator to:
- Resume from exact failure point after context rotation

- Track gate latency across the plan

### Gate Result Values

| Value | Meaning |
|-------|---------|
| `pass` | Gate completed successfully |
| `fail` | Gate failed (details required) |
| `skip` | Gate not applicable for this risk level |
| `retry` | Re-attempt in progress (set before re-run, update to pass/fail after) |

## Context Rotation Protocol

When context reaches 70%:

1. Write current task state to ledger:
   ```
   dev_ledger(action='task_update', taskId, gate='checkpoint', result='context_rotation', detail='Context at 70%')
   ```
2. Generate Ralph prompt from current plan path + ledger state
3. Output handoff instructions:
   ```
   Context limit approaching. Handoff:
   - Plan: {plan_path}
   - Completed: tasks [x] in plan
   - In progress: {current_task_id} (gate: {last_gate})
   - Resume: /dev ralph-implement {plan_path}
     or: new session → /dev implement-plan {plan_path} (ledger auto-resume)
   ```

## Ralph Mode: Persistence Fallback

Ralph Loop (`/dev ralph-implement`) is not an alternative execution path — it is a **persistence fallback** for when context limits prevent completing the plan in a single session.

Differences from standard agentic loop:

| Aspect | Standard Loop | Ralph (persistence fallback) |
|--------|---------------|------------------------------|
| Context | Single session | Multiple sessions via Stop hook |
| Gate set | Risk-adaptive (1-5 gates) | Verify + self-healing only |
| Ledger reads | Bootstrap + after each gate | Each iteration reads ledger for progress |
| Quality gates | Full pipeline | Minimal (verify-only) |
| Use when | Normal execution | Plan exceeds single context window |

## Self-Healing Retry

```
verify fail
  → read error output
  → diagnose root cause
  → fix implementation (NEVER modify verify command)
  → re-verify
    → pass: record both attempts in ledger, continue
    → fail: stop + escalate (do not retry a 3rd time)
```

Both attempts recorded in ledger:
```
{ gate: "verify", result: "fail", attempt: 1, detail: "<error>" }
{ gate: "verify", result: "pass", attempt: 2, detail: "fixed: <what changed>" }
```

## Completion Evidence

Gate results are persisted in the ledger via `dev_ledger(action='task_update')`. No separate proof files needed — the ledger is the single source of truth for task completion evidence.

## Execution Strategy Selection

| Condition | Strategy |
|-----------|----------|
| ≤3 tasks | Direct — orchestrator executes inline |
| 4+ tasks, sequential | Subagent per task — fresh context isolation |
| 3+ tasks, parallelizable, no file overlap | Agent Teams — true parallelism |

For Agent Teams: use `dev_coordinate(action='plan', mode='fan-out')` to detect `target_files` overlaps before spawning teammates.

## Plan Frontmatter v2.1 Changes

Tasks gain optional `risk` field:

```yaml
tasks:
  - id: "1.1"
    type: logic-task
    description: "..."
    risk: high        # NEW: low | medium | high (default: medium if omitted)
    contract: |
      - criterion one
    verify: "make test"
    commit: "feat(scope): ..."
```

Plans without `risk` field are v2.0 backward compatible — missing `risk` = medium default.

## Decision Agent Routing

Runtime uncertainty (not covered by contract) → spawn decision-agent (Sonnet, fork context):
- Ambiguous requirement → decision-agent → answer → continue
- Security/architecture question → escalate to Human

Never block on uncertainty — route it.

## Review Gate Loop (Independent Post-Implementation Stage)

The Review Gate Loop runs in the **orchestrator's context** after implement-plan fork returns. It is a separate stage, not part of the per-task loop.

### Flow

```
implement-plan fork returns (all tasks done)
  → Record BASE_COMMIT in state file and ledger:
      BASE_COMMIT=$(git log --oneline -1 --before="$(cat .claude/cache/.auto-pipeline-{task_id}.json | jq -r .implement_start_time)" | awk '{print $1}')
      dev_ledger(action='task_update', taskName='review-gate', gate='init', gateResult='pass', gateDetail="BASE_COMMIT=${BASE_COMMIT}")
  → dev_aggregate(action='pr_ready')
  → Check ledger for existing round-* gate entries to recover review_rounds count after context rotation
  → spawn code-reviewer with BASE_COMMIT (Round 1: full branch diff master...HEAD)
  → parse findings
    → P0/P1 → generate fix tasks → execute (5-gate pipeline) → re-review with same BASE_COMMIT
    → P2/P3 → record in pr_notes
    → clean pass → /dev pr
```

### BASE_COMMIT Recording

Before spawning the first code-reviewer round, record the commit just before implementation began:

```bash
# Recorded in state file during implement stage transition
BASE_COMMIT=$(git rev-parse HEAD~$(git log --oneline master..HEAD | wc -l))

# Also persist to ledger for context rotation recovery
dev_ledger(action='task_update', taskName='review-gate', gate='init', gateResult='pass', gateDetail="BASE_COMMIT=${BASE_COMMIT}")
```

### Round Tracking (Ledger-Persisted)

After each review round, persist to ledger — do NOT rely on in-context variables:

```
dev_ledger(action='task_update', taskName='review-gate', gate='round-N', gateResult='pass|fail', gateDetail='P0:X P1:Y findings')
```

On context rotation recovery: read ledger for gate entries matching `round-*` to reconstruct `review_rounds` count.

```bash
# Recover round count from ledger after context rotation
REVIEW_ROUNDS=$(dev_ledger(action='status') | jq '[.tasks[] | select(.name=="review-gate") | .gates[] | select(.gate | startswith("round-"))] | length')
```

Max 3 rounds enforced from ledger state, not in-context variable.

### Spawning code-reviewer with BASE_COMMIT

Include `BASE_COMMIT` in the spawn prompt so the agent uses fix-diff mode:

- Round 1: spawn with `BASE_COMMIT=<hash>` → agent reviews `git diff <BASE_COMMIT>..HEAD` (full branch from before implementation)
- Round 2+: spawn with same `BASE_COMMIT=<hash>` → agent reviews all changes since that base commit (includes all fixes)

This ensures the reviewer always sees the complete implementation delta while preventing re-flagging of pre-existing code.

### Fix Task Generation

P0/P1 findings become new tasks with `risk: high`:

```yaml
- id: "fix-r1.1"
  type: logic-task
  risk: high
  description: "Fix P0: SQL injection in user query"
  contract: |
    - Parameterize all user-supplied values in SQL queries
  verify: "make test"
  commit: "fix(db): parameterize user query inputs"
```

### Escalation

| Condition | Action |
|-----------|--------|
| review_rounds > 3 (from ledger) | Stop + escalate to human |
| P0 in same location 2x | Stop + escalate (likely design issue) |
| All P0/P1 resolved | Continue to /dev pr |
