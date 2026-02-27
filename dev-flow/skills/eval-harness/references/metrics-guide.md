# Eval Harness - Metrics Guide

Detailed explanation of pass@k and pass^k metrics and their relationship to
Verification-Driven Development (VDD).

## Background

Traditional VDD (from `verification-driven.md`) requires exit code 0 as the only
acceptable completion signal. This is sufficient for deterministic tasks. However
some tasks have non-deterministic elements:

- LLM-generated code that may vary across runs
- Tests with timing sensitivity
- Integration tests with external state
- Agent-executed tasks that depend on reasoning quality

pass@k and pass^k extend VDD to handle these cases with statistical rigor.

## pass@k — Feasibility Metric

### Definition

pass@k = 1 if at least 1 of k independent attempts passes all criteria; otherwise
pass@k = pass_count / k.

### Interpretation

| pass@k | Meaning | Action |
|--------|---------|--------|
| 1.00 | Every attempt succeeded | Proceed with confidence |
| 0.67 | 2 of 3 succeeded | Acceptable — investigate failures |
| 0.33 | 1 of 3 succeeded | Marginal — approach may be fragile |
| 0.00 | No attempt succeeded | Task is infeasible as designed |

### When to Use

Use pass@k to answer: "Can this task succeed at all?"

Typical scenarios:
- New feature implementation where the approach is unproven
- Bug fix where the root cause is uncertain
- Exploratory tasks where multiple strategies were tried

### Example

Task: "Implement OAuth token refresh"
k = 3 (medium risk)

```
Attempt 1: build PASS, lint PASS, tests PASS  → PASS
Attempt 2: build PASS, lint PASS, tests FAIL  → FAIL (race condition in test)
Attempt 3: build PASS, lint PASS, tests PASS  → PASS

pass@3 = 0.67  — acceptable, but the test race condition needs investigation
```

## pass^k — Consistency Metric

### Definition

pass^k = 1 if ALL k attempts pass all criteria; 0 otherwise.

### Interpretation

| pass^k | Meaning | Action |
|--------|---------|--------|
| 1 | All attempts consistent | Required for high-risk tasks |
| 0 | At least one attempt failed | Do not ship — find the flakiness |

### When to Use

Use pass^k to answer: "Is this task reliably correct every time?"

Required for:
- Authentication and authorization logic
- Payment processing flows
- Data migrations (irreversible)
- Security-sensitive operations
- Public API contracts

### Example

Task: "Migrate user table schema"
k = 5 (high risk — migration is irreversible)

```
Attempt 1: PASS
Attempt 2: PASS
Attempt 3: PASS
Attempt 4: FAIL (constraint violation on edge case row)
Attempt 5: PASS

pass^5 = 0  — BLOCKED — migration has an unhandled edge case
```

## Relationship to VDD

### VDD Iron Law

> "No completion claims without fresh verification evidence."
> Exit code 0 is the only acceptable completion signal.

### Eval Harness Extension

Eval harness does not replace VDD — it adds a statistical layer on top:

```
VDD (single run)         Eval Harness (k runs)
─────────────────        ──────────────────────
exit code 0 → done   →   pass@k ≥ threshold → proceed
                          pass^k = 1 → required for high-risk
```

The single-run VDD check is still Gate 1. Eval harness is Gate 2 for tasks
that require additional confidence.

### When Single-Run VDD Is Sufficient

For most tasks, single-run VDD is enough:
- Deterministic build systems
- Pure unit tests with no external state
- Style/formatting fixes
- Documentation updates

Use eval-harness only when there is a reason to doubt single-run reliability.

## Choosing k

### Risk-Based Defaults

| Risk Level | k | Metric Required |
|------------|---|-----------------|
| Low | 1 | pass@1 (equivalent to VDD) |
| Medium | 3 | pass@3 >= 0.67 |
| High | 5 | pass^5 = 1 |

### Risk Classification Signals

| Signal | Risk |
|--------|------|
| Touches auth, payments, crypto | High |
| Irreversible operation (migration, delete) | High |
| New integration with external service | Medium |
| Refactor of core business logic | Medium |
| UI change, new endpoint | Low |
| Docs, comments, formatting | Low |

### Override in Plan Task

```yaml
tasks:
  - id: task-3
    title: Migrate user schema
    verify: "npm run db:test"
    risk: high     # triggers k=5, requires pass^5
    eval: true
```

## Thresholds and Gates

### Feasibility Thresholds

| Threshold | Behavior |
|-----------|----------|
| pass@k >= 0.67 | Proceed (default acceptable gate) |
| pass@k = 0.33 | Warning, require explicit override |
| pass@k = 0.00 | Block — task infeasible |

### Consistency Gate

pass^k is a binary gate for high-risk tasks. There is no partial credit:
- pass^k = 1: proceed
- pass^k = 0: blocked until all attempts succeed

### Custom Thresholds

```json
{
  "eval": {
    "passFeasibilityThreshold": 0.67,
    "requireConsistencyForRisk": ["high"]
  }
}
```

## Results Storage

Results are saved to `.claude/eval-results/<timestamp>-<task-id>.json`:

```json
{
  "taskId": "task-3",
  "k": 5,
  "mode": "checkpoint",
  "timestamp": "2026-02-27T12:34:56Z",
  "attempts": [
    {
      "index": 1,
      "result": "pass",
      "criteria": {
        "build": { "pass": true, "exitCode": 0, "durationMs": 4200 },
        "lint": { "pass": true, "exitCode": 0, "durationMs": 800 },
        "tests": { "pass": true, "exitCode": 0, "durationMs": 12300 }
      }
    }
  ],
  "passAtK": 1.0,
  "passConsistentK": 1,
  "recommendation": "consistent"
}
```

These results are also queryable via `dev_memory` for future reference:
```
dev_memory(action="query", query="eval results task-3")
```

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|--------------|---------|-----------------|
| Always use k=1 | Defeats the purpose | Use risk-based k |
| Ignore pass^k on migrations | One flaky run breaks data | Require pass^k=1 |
| Re-run until it passes | Cherry-picking | All k runs must be independent |
| Skip eval for "quick fixes" | Security bugs are often "quick fixes" | Use risk classification |
| Trust agent "it should be consistent" | Agent cannot verify this | Machine metrics only |
