# Management Guide

Advanced team management patterns from production experience (7 agents, 9h, 9.6/10 quality).

## Pre-flight Check

Before any implementation, validate product direction first:

```
User Stories → Business Logic → Tech Design → Implement
```

**Checklist** (Phase 1, before creating tasks):

- [ ] Clear user stories / acceptance criteria defined?
- [ ] Business logic agreed (not just technical approach)?
- [ ] Plan reviewed AND re-reviewed after corrections?

**Key rule**: "Approved with corrections" ≠ Final Approval. Must re-review after corrections are applied.

**Cost of skipping**: 1.5h of rework observed when jumping directly to code.

## Dynamic Scaling

Adjust team size by project phase:

| Phase | Size | Model Mix | Notes |
|-------|------|-----------|-------|
| Setup | 2-3 | 1 opus + 1-2 sonnet | Architecture + scaffolding |
| Parallel | 5-7 | 1 opus + 4-6 sonnet | Max throughput |
| Closeout | 2-3 | 1 opus reviewer + 1-2 sonnet | Review + fixes |

### Teammate Lifecycle Decisions

| Event | Decision |
|-------|----------|
| Completed + related task available | Keep, assign next task |
| Completed + no related tasks | Shutdown, release resources |
| Idle > 30min | Shutdown, re-spawn if needed later |
| Context > 80% | Shutdown + re-spawn (fresh context) |

**Re-spawn guidelines**:
- Minimal context: only essential info + clear task (< 30min scope)
- If team-lead can answer instead, don't re-spawn
- Code reviewer: clear context every 3-5 reviews for objectivity

## Thinking Culture

Encourage **Why / What if / So what** framework in teammate prompts.

### Quality Evaluation Weights

| Dimension | Weight | Executor vs Thinker |
|-----------|--------|---------------------|
| Task completion | 40% | "Done" vs "Done, but I suggest..." |
| Thinking depth | 30% | "Did as told" vs "Compared 3 approaches" |
| User value | 20% | "Technically better" vs "User can feel the difference" |
| Proactiveness | 10% | Silent vs proactively raises improvements |

### Prompt Addition

Add to teammate prompt to enable thinking culture:

```
## Thinking Rules
- Before implementing, briefly consider alternatives (Why this approach?)
- If you find a better approach, propose it before proceeding (What if?)
- After completing, note any implications or follow-up needs (So what?)
```

## Autonomy Levels

Graduated trust based on task criticality:

| Level | Scope | Approval Required |
|-------|-------|-------------------|
| L1 | Syntax, config, simple bugs | Self-resolve |
| L2 | Design choices, performance | Ask team-lead |
| L3 | Architecture, breaking changes | Team-lead + broadcast |

### Escalation Protocol

| Signal | Action |
|--------|--------|
| Sonnet fails 3 times | Upgrade to opus |
| Opus fails 2 times | Change approach: simplify problem, lower precision, or write prototype to validate |

## Multi-Session Continuity

For teams spanning multiple sessions:

1. **Before `/clear`**: Each active teammate writes handoff via `dev_handoff`
2. **New session**: Lead reads handoff chain via `dev_handoff(action='chain', taskId=...)`
3. **Re-spawn**: Give new teammate the handoff context, not the full conversation

### Monitoring Cadence

Every 30 minutes, check:

- [ ] Active members making progress?
- [ ] Any idle > 10min?
- [ ] TaskList synchronized?
- [ ] Unresolved blockers?

## Dedicated Reviewer

Spawn a dedicated opus reviewer for quality-critical projects.

**ROI**: 84x (3h review investment prevents ~10.5 days of rework).

### Pattern

```
# Spawn after all implementation tasks complete
Task({
  subagent_type: "dev-flow:code-reviewer",
  team_name: "TASK-{id}",
  name: "reviewer",
  model: "opus",
  prompt: "Review all changes on branch {branch}. Check architecture, patterns, edge cases."
})
```

### Quality Gates

| Stage | Reviewer | Purpose |
|-------|----------|---------|
| Plan | Team broadcast | Catch direction errors early |
| Code | Dedicated opus reviewer | Architecture + correctness |
| Final | Acceptance test | User-facing validation |

## Hooks Quality Gates

Use `TeammateIdle` and `TaskCompleted` hooks to enforce quality automatically:

| Hook | Trigger | Action |
|------|---------|--------|
| `TeammateIdle` | Teammate about to go idle | Exit code 2 → send feedback, keep working |
| `TaskCompleted` | Task being marked complete | Exit code 2 → block completion with feedback |

Ready-to-use scripts in `scripts/`:
- `task-completed-gate.sh` — blocks completion if uncommitted changes or `make check` fails
- `teammate-idle-gate.sh` — blocks idle if uncommitted changes exist

See `docs/hooks-setup.md` § Agent Team Quality Gates for installation and customization.

## Task Sizing

Target **5-6 tasks per teammate** for optimal productivity:

| Size | Problem | Fix |
|------|---------|-----|
| Too small (1-2) | Coordination overhead > benefit | Combine into larger units |
| Too large (10+) | Long work without check-ins, risk of wasted effort | Break into 5-6 deliverable chunks |
| Right (5-6) | Self-contained units with clear deliverables | Each produces a function, test file, or review |

## Verifier Quality

> "The task verifier must be nearly perfect, otherwise Claude will solve the wrong problem."
> — C Compiler project (16 agents, $20K, Anthropic Engineering)

- Poor tests lead agents astray; comprehensive testing keeps them focused
- Include `--fast` / sampling mode for large test suites to prevent time-wasting
- Verify command must match actual acceptance criteria, not just "does it compile"

## Clean State Requirement

Every teammate must leave code in a working state when done:

- No broken builds or failing tests
- Orderly structure, clear naming
- A developer (or next agent) could start new work immediately
- If interrupted mid-task, commit WIP to a branch with clear description

## Lessons Learned

Top mistakes from production team management:

| Mistake | Cost | Lesson |
|---------|------|--------|
| Skipped product definition | 1.5h rework | Product definition is always step 0 |
| Mislabeled dependencies (serial → parallel) | Lost parallelism window | Maximize parallel opportunities |
| Teammate idle 30min | Wasted resources | Complete → assign or shutdown |
| Premature plan approval | Quality gaps | Re-review must complete before approval |
| Messaged shutdown teammate | Wasted waiting | Check member status before messaging |
| Skipped plan re-review | Quality risk | Updated plan must be re-reviewed |

## Success Metrics

| Metric | Baseline | Excellent |
|--------|----------|-----------|
| Quality score | > 8/10 | > 9/10 |
| Idle rate | < 20% | < 5% |
| Review coverage | 100% | 100% |
| Response time | < 30min | < 10min |
