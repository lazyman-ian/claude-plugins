# Risk Assessment Model

Per-task risk classification determines which quality gates run during execution.

## Risk Signals (priority order)

1. **Explicit plan field** — `risk: low|medium|high` in task frontmatter (highest priority)
2. **File path pattern** — inferred from `files.create` / `files.modify` paths
3. **Change type inference** — inferred from task description and file operations

When multiple signals conflict, take the highest risk level.

## File Path Pattern Rules

| Pattern | Risk | Rationale |
|---------|------|-----------|
| `auth/*`, `**/auth/**` | high | Authentication code — security critical |
| `migration/*`, `**/migration*`, `**/migrations/**` | high | Data model / schema changes |
| `security/*`, `**/security/**` | high | Security-sensitive code |
| `**/schema*`, `**/model*`, `**/database*` | high | Data model changes |
| `docs/*`, `**/docs/**` | low | Documentation only |
| `**/*.md` | low | Markdown files |
| `**/config/**`, `**/settings/**` | low | UI / feature config (not secrets/infra) |
| `**/styles/**`, `**/assets/**`, `**/icons/**` | low | Static UI resources |
| Everything else | medium | Feature code (default) |

**Note**: `secrets/`, `infra/`, `deploy/` config are NOT low — they remain medium or are classified by path pattern above.

## Change Type Inference

| Change Type | Risk |
|-------------|------|
| Delete file | low |
| Rename / move file | low |
| New API endpoint (path contains `routes`, `api`, `endpoint`) | medium |
| New data model / schema (path contains `schema`, `model`, `migration`) | high |

## Default Risk

When no explicit `risk` field and no pattern matches: **medium**.

## Gate Matrix

| Gate | low | medium | high |
|------|-----|--------|------|
| 1. Fresh Context (new subagent) | — | run | run |
| 2. Self-Review (11-point checklist) | run | run | run |
| 3. Spec Review (spec-reviewer agent) | — | — | run |
| 4. Quality Review (code-reviewer agent) | — | run | run |
| 5. Verify (run verify command) | run | run | run |

**Notes**:
- Gate 2 (Self-Review) always runs — it is built into implement-agent and cannot be skipped.
- Gate 5 (Verify) always runs — exit code 0 is the only completion signal.
- Gate 3 (Spec Review) only runs for high-risk tasks where correctness vs. spec is critical.
- Gate 4 (Quality Review) skipped for low-risk tasks (docs, config, renaming) to reduce latency.

## Gate Sequence

```
Task
  └─ [Gate 1: Fresh Subagent]   medium + high only
       └─ Gate 2: Self-Review   always
            └─ [Gate 3: Spec Review]   high only
                 └─ [Gate 4: Quality Review]   medium + high only
                      └─ Gate 5: Verify   always
                           └─ Complete
```

## Ledger Reporting

After each gate, the orchestrator calls:
```
dev_ledger(action='task_update', taskId, gate, result)
```

Gate result values: `pass` | `fail` | `skip` | `retry`

Both retry attempts are recorded as separate gate entries:
```
{ gate: "verify", result: "fail", detail: "...", attempt: 1 }
{ gate: "verify", result: "pass", detail: "...", attempt: 2 }
```
