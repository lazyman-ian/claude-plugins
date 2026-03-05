---
name: eval-harness
description: >-
  Runs structured evaluation of agent task completion using pass@k and pass^k metrics.
  Supports checkpoint-based and continuous evaluation modes with configurable criteria.
  This skill should be used when task feasibility or consistency needs to be measured
  across multiple attempts, or when a quality gate requires statistical confidence.
  Triggers on "evaluate", "eval harness", "run evaluation", "pass@k", "pass^k",
  "评估", "运行评估", "质量评估", "多次评估", "统计验证",
  "评估测试", "质量检测", "Agent评估", "评估框架".
  Do NOT use for single-run code review — use "code-reviewer" agent instead.
  Do NOT use for skill/workflow improvement cycles — use "meta-iterate" instead.
  Do NOT use for simple one-shot verification — use "verify" skill instead.
allowed-tools: [Read, Bash, Glob, Grep, Write]
model: sonnet
memory: project
---

# Eval Harness - Structured Task Evaluation

Wraps the verify skill with pass@k / pass^k metrics to measure task feasibility and
consistency across multiple attempts.

## When to Use

| Signal | Mode |
|--------|------|
| Plan defines explicit verification points | Checkpoint-based |
| Continuous integration with agent teams | Continuous |
| Need confidence that fix is robust, not lucky | pass^k |
| Exploratory: does any approach succeed? | pass@k |

## Evaluation Modes

### Checkpoint-Based

Triggered at explicit verification points defined in a plan task's `verify` field or
at `/dev checkpoint` tags.

```
Plan task → checkpoint reached → eval-harness → k attempts → metric result
```

### Continuous

Triggered automatically after N tool calls (default: 10) or after any Write/Edit
that touches a file marked as critical in `.dev-flow.json`.

```json
{
  "eval": {
    "continuousTrigger": 10,
    "criticalFiles": ["src/auth/**", "src/payments/**"]
  }
}
```

## Metrics

### pass@k — Feasibility

At least 1 of k independent attempts succeeds. Measures whether the task is solvable.

```
pass@k = 1 - (failed_attempts / k)
k=3: 1/3 succeed → pass@3 = 0.33 → MARGINAL
k=3: 2/3 succeed → pass@3 = 0.67 → ACCEPTABLE
k=3: 3/3 succeed → pass@3 = 1.00 → ROBUST
```

**Use when**: Task is new or high-risk. One success confirms the approach works.

### pass^k — Consistency

ALL k independent attempts succeed. Measures reliability.

```
pass^k = (success_count == k) ? 1 : 0
k=3: 2/3 succeed → pass^3 = 0  → NOT CONSISTENT
k=3: 3/3 succeed → pass^3 = 1  → CONSISTENT
```

**Use when**: Task must be deterministic (auth flows, data migrations, critical fixes).

### Default k

| Risk Level | k |
|------------|---|
| Low (style, docs) | 1 |
| Medium (feature logic) | 3 |
| High (security, payments, migrations) | 5 |

Override with `--k <n>` or set in `.dev-flow.json`:
```json
{ "eval": { "defaultK": 3, "highRiskK": 5 } }
```

## Evaluation Criteria

Each attempt runs the full criteria set (stop on first failure per attempt):

| Criterion | Command Source | Pass Condition |
|-----------|---------------|----------------|
| Build | `dev_config → buildCmd` | exit code 0 |
| Lint | `dev_config → lintCheck` | exit code 0 |
| Tests | `dev_config → testCmd` | exit code 0 |
| No regressions | `git diff <base> --stat` | no deleted passing tests |
| Custom | plan task `verify` field | exit code 0 |

## Execution Flow

```
1. CONFIGURE
   - Read k from args / .dev-flow.json / risk-based default
   - Identify criteria set (build + lint + tests + custom)
   - Identify attempt scope (full suite or targeted)

2. FOR each attempt i in 1..k:
   a. Run full criteria set via verify skill
   b. Record: pass/fail per criterion + elapsed time + exit code
   c. On first full pass: record attempt index

3. COMPUTE METRICS
   - pass@k = (at least 1 attempt fully passed) ? 1 : pass_count/k
   - pass^k = (all k attempts passed) ? 1 : 0

4. REPORT
   - Print results table (see Output Format)
   - If pass@k < threshold → block completion
   - Save results to .claude/eval-results/<timestamp>.json

5. GATE
   - pass@k >= 0.33 → proceed with warning
   - pass@k >= 0.67 → proceed
   - pass@k = 1.0  → verified
   - pass^k = 1    → fully consistent (required for high-risk tasks)
```

## Output Format

```
Eval Harness Results (k=3, mode=checkpoint)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Criterion        Attempt 1   Attempt 2   Attempt 3
──────────────   ─────────   ─────────   ─────────
build            PASS        PASS        PASS
lint             PASS        PASS        FAIL
tests            PASS        FAIL        -
no-regressions   PASS        -           -

Attempt result   PASS        FAIL        FAIL

pass@3  = 0.33  (1/3 succeeded) — MARGINAL
pass^3  = 0     (inconsistent)

Recommendation: Lint is flaky on attempt 3. Investigate before marking complete.
Results saved to .claude/eval-results/2026-02-27T12:34:56-lint-check.json
```

## Integration

### With verify skill

eval-harness calls verify internally for each attempt. It does not re-implement
the verification logic.

### With implement-plan (Gate 5)

After all 5 gates pass, implement-plan optionally invokes eval-harness for
high-risk tasks (determined by the `risk` field in the plan task).

### With /dev checkpoint

`/dev checkpoint verify <name>` feeds the checkpoint diff into eval-harness
as the regression criterion, comparing against the saved checkpoint state.

## Configuration (.dev-flow.json)

```json
{
  "eval": {
    "defaultK": 3,
    "highRiskK": 5,
    "continuousTrigger": 10,
    "passFeasibilityThreshold": 0.67,
    "requireConsistencyForRisk": ["high"],
    "criticalFiles": [],
    "saveResults": true
  }
}
```

## Reference

See `references/metrics-guide.md` for detailed metric explanations, examples,
and relationship to VDD.
