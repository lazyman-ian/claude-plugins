# Team Patterns Reference

Detailed patterns for Agent Team orchestration.

## Collaboration Modes

### Fan-out (Parallel Independent)

Best for: independent modules with no shared files.

```
Lead
├── Agent A (Module 1) ─── parallel
├── Agent B (Module 2) ─── parallel
└── Agent C (Module 3) ─── parallel
         ↓
    Lead aggregates
```

### Fan-out + Continuous Review (Recommended for 3+ agents)

Best for: 3+ agents with cross-module interactions or security-sensitive code.

```
Lead
├── Agent A (Module 1) ──┐
├── Agent B (Module 2) ──┼── parallel impl
├── Agent C (Module 3) ──┘
│                         ↕ SendMessage after each commit
└── Reviewer (opus) ────── persistent, accumulates cross-module context
         ↓
    Reviewer final summary → Lead aggregates
```

**Key advantage over one-shot Phase 4 review**: Reviewer accumulates context incrementally. When reviewer sees Agent B's CORS change after already reviewing Agent A's Auth change, it can spot the Auth+CORS interaction issue immediately — not 30 minutes later in batch review.

**Setup**:
```
TeamCreate({ team_name: "TASK-{id}" })

# Implementation tasks
TaskCreate({ subject: "Module 1: Auth guards" })
TaskCreate({ subject: "Module 2: API + SSE endpoints" })
TaskCreate({ subject: "Module 3: CORS + middleware config" })

# Reviewer task (no blockedBy — reviewer is always available)
TaskCreate({ subject: "Continuous review: cross-module audit" })

# Spawn implementers (parallel)
Task({ name: "auth-dev", prompt: "..." })
Task({ name: "api-dev", prompt: "..." })
Task({ name: "config-dev", prompt: "..." })

# Spawn reviewer (opus, persistent)
Task({
  subagent_type: "dev-flow:code-reviewer",
  team_name: "TASK-{id}",
  name: "reviewer",
  model: "opus",
  prompt: "{See Reviewer Prompt Template in SKILL.md}"
})
TaskUpdate({ taskId: "4", owner: "reviewer" })
```

**Interaction flow**:
```
Timeline:
  t1: auth-dev commits guard changes
      → SendMessage reviewer "committed auth guard, files: src/auth/guard.ts"
      → reviewer reads diff, notes auth patterns ✅

  t2: config-dev commits CORS config
      → SendMessage reviewer "committed CORS config, files: src/config/cors.ts"
      → reviewer reads diff, cross-references with auth guard
      → 🔴 FINDS: "OPTIONS preflight not excluded from AuthGuard!"
      → SendMessage auth-dev "P1: AuthGuard blocks OPTIONS, fix guard.ts"
      → SendMessage config-dev "P1: CORS preflight needs guard exclusion"

  t3: api-dev commits SSE endpoint with reply.hijack()
      → SendMessage reviewer "committed SSE, files: src/api/sse.controller.ts"
      → reviewer cross-references with CORS config
      → 🔴 FINDS: "reply.hijack() discards CORS headers set by middleware!"
      → SendMessage api-dev "P1: flush CORS headers before hijack()"

  t4: Lead requests final summary
      → reviewer produces full P0-P3 report with accumulated context
```

**Cost**: ~1.2x cost of basic fan-out (reviewer opus context). ROI: catches cross-cutting bugs that would cost 3x in post-merge fixes.

**When NOT to use**: Single-module changes, all agents work on independent features with zero shared infrastructure (rare).


**Setup**:
```
TeamCreate({ team_name: "TASK-{id}" })

# Create all tasks (no dependencies)
TaskCreate({ subject: "Module 1" })
TaskCreate({ subject: "Module 2" })
TaskCreate({ subject: "Module 3" })

# Spawn all teammates in parallel
Task({ name: "mod1-dev", prompt: "..." })
Task({ name: "mod2-dev", prompt: "..." })
Task({ name: "mod3-dev", prompt: "..." })
```

**Conflict Detection**: Before dispatching, check file overlap:
```
dev_coordinate(action='plan', mode='fan-out', tasks=[
  { id: 't1', targetFiles: ['src/auth.ts'] },
  { id: 't2', targetFiles: ['src/auth.ts'] }  // Conflict!
])
# → Serialize: TaskUpdate({ taskId: 't2', addBlockedBy: ['t1'] })
```

### Pipeline (Sequential Phases)

Best for: tasks where each phase depends on the previous.

```
Plan → Implement → Test → Review
  ↓        ↓         ↓       ↓
Agent A  Agent B   Agent C  Agent D
```

**Setup**:
```
TaskCreate({ subject: "Phase 1: Plan" })
TaskCreate({ subject: "Phase 2: Implement" })
TaskCreate({ subject: "Phase 3: Test" })

TaskUpdate({ taskId: "2", addBlockedBy: ["1"] })
TaskUpdate({ taskId: "3", addBlockedBy: ["2"] })

# Spawn Agent A for Phase 1
# When Phase 1 completes → spawn Agent B for Phase 2
# Handoff context via dev_handoff
```

**Handoff Chain**:
```
# Agent A writes handoff
dev_handoff(action='write', handoff={
  agent_id: 'planner',
  task_id: 'TASK-001',
  status: 'success',
  summary: 'Plan created at thoughts/plans/PLAN-TASK-001.md',
  for_next_agent: 'Implement Phase 1-3 from plan'
})

# Agent B reads previous handoff
dev_handoff(action='read', handoffId='...')
```

### Master-Worker (Batch Tasks)

Best for: many similar tasks (e.g., migrate 20 files, update 15 tests).

```
Lead (Master)
├── Worker 1: files 1-5
├── Worker 2: files 6-10
├── Worker 3: files 11-15
└── Worker 4: files 16-20
```

**Setup**:
```
# Create task per batch
for batch in batches:
  TaskCreate({ subject: f"Migrate batch {batch.id}: {batch.files}" })

# Spawn workers
for i, batch in enumerate(batches):
  Task({ name: f"worker-{i}", prompt: f"Migrate these files: {batch.files}" })
```

### Review-Chain (Code Review)

Best for: code that needs review before merge, especially cross-module changes.

```
Implementer → Reviewer (P0-P3) → (fix P0/P1) → Done
```

**Note**: Per-commit review is automatic via `/dev commit` Step 2.5. This pattern adds a dedicated cross-module reviewer for changes spanning multiple modules.

**Setup**:
```
TaskCreate({ subject: "Implement feature" })
TaskCreate({ subject: "Cross-module review (P0-P3)" })

TaskUpdate({ taskId: "2", addBlockedBy: ["1"] })

# Spawn implementer (commit review is built-in)
Task({ name: "impl-dev", prompt: "Implement ..." })

# After impl done → spawn dedicated reviewer (opus for depth)
Task({
  subagent_type: "dev-flow:code-reviewer",
  name: "reviewer",
  model: "opus",
  prompt: "Full branch review (all dimensions, P0-P3).
           Branch diff: git diff master...HEAD
           Focus on cross-cutting concerns: Auth+CORS, Guard ordering,
           SSE+Headers, module boundary mismatches.
           Report format: P0-P3 with file:line references.
           Save novel findings: dev_memory(action='save', ...)"
})
```

**Review Results**:
| Severity | Action |
|----------|--------|
| P0/P1 | SendMessage impl-dev to fix, re-review after |
| P2/P3 | Record in handoff for PR description |
| Clean | Proceed to merge |

### Evaluator-Optimizer (Iterative Refinement)

Best for: tasks with clear evaluation criteria that benefit from feedback cycles (code quality, translation, complex refactoring).

```
Generator → Evaluator (P0-P3) → (feedback loop, max 3 rounds) → Done
  Agent A      Agent B
```

**Setup**:
```
TaskCreate({ subject: "Generate implementation" })
TaskCreate({ subject: "Evaluate and provide feedback" })

# Spawn generator
Task({ name: "generator", prompt: "Implement {feature}. When done, SendMessage evaluator." })

# Spawn evaluator (uses P0-P3 severity for concrete feedback)
Task({
  subagent_type: "dev-flow:code-reviewer",
  name: "evaluator",
  model: "opus",
  prompt: "Review generator's work using P0-P3 severity across all 4 dimensions
           (Design, Security, Performance, Error Handling).
           Evaluation criteria: {criteria}
           Round limit: 3 iterations max.
           Each round: P0-P3 report → SendMessage generator with specific fixes.
           Pass condition: zero P0/P1 findings.
           Save novel findings: dev_memory(action='save', ...)"
})
```

**Key**: The evaluator uses P0-P3 severity for concrete, actionable feedback — not vague "looks good" checks. Pass condition = zero P0/P1. Limit to 3 rounds to prevent infinite loops.

## Review Integration

Multi-layer review ensures quality at every stage of team work:

```
Teammate commits → /dev commit Step 2.5 → per-file P0/P1 gate (auto)
All tasks done   → Phase 4 reviewer      → cross-module P0-P3 (lead spawns)
PR created       → /dev pr Step 7         → full branch P0-P3 (auto)
```

| Layer | Scope | Catches | Who |
|-------|-------|---------|-----|
| **Per-commit** (auto) | Single teammate's staged changes | Per-file bugs, security, pitfalls | code-reviewer (sonnet) |
| **Cross-module** (Phase 4) | All teammates' combined work | Module boundary mismatches, cross-cutting concerns | code-reviewer (opus) |
| **PR review** (auto) | Full branch vs base | Architectural drift, missed interactions | code-reviewer (sonnet/opus) |

**Why all 3 layers?**
- Per-commit review catches obvious P0/P1 per file
- But cross-cutting issues (Auth+CORS+SSE) span multiple files from different teammates
- Only the Phase 4 cross-module reviewer sees the full picture

**When to skip layers**:
- Small team (1-2 agents), single module → per-commit + PR review sufficient
- Large team (3+ agents), cross-module → all 3 layers recommended

## Teammate Prompt Best Practices

### DO

- Include specific file paths or directories to work in
- Specify the verify command (`make check`, `npm test`, etc.)
- List available skills the teammate can use
- Set clear completion criteria (verify passes, tests green)
- Include the branch name and repo path

### DON'T

- Leave scope vague ("implement the feature")
- Skip verification commands (teammate won't know when they're done)
- Overload a single teammate with unrelated tasks
- Assume teammates share context (each has independent context)

### Four Essential Elements

Every teammate prompt must include these (from Anthropic multi-agent research):

| Element | Purpose | Example |
|---------|---------|---------|
| **Objective** | Clear goal statement | "Implement JWT auth service in src/auth/" |
| **Output Format** | What to deliver | "Commit with passing tests + SendMessage summary" |
| **Tool Guidance** | Available tools/skills | "/implement-plan, /dev commit, debug-agent" |
| **Task Boundaries** | What NOT to do | "Only modify src/auth/. Do not touch src/api/" |

### Template Structure

```
You are {role} working on {specific_task}.

## Objective
{one sentence describing the clear, measurable goal}

## Context
- Repo: {path}
- Branch: {branch}
- Plan: {plan_path} (section: {section})

## Output Format
- Passing verification: {verify_command}
- Committed code: /dev commit
- Summary to lead: SendMessage with files changed + decisions made

## Steps
1. {specific step 1}
2. {specific step 2}
...
N. Verify: {verify_command}
N+1. /dev commit
N+2. SendMessage lead: done + summary

## Task Boundaries
- Only modify files in: {directory_scope}
- Do NOT modify: {excluded_files_or_dirs}
- If scope needs expansion → ask lead first

## Rules
- Uncertain → ask lead
- Verify fails → keep fixing
```

## Common Mistakes

| Mistake | Impact | Fix |
|---------|--------|-----|
| No file conflict check | Teammates overwrite each other | Use `dev_coordinate` to detect conflicts |
| Vague teammate prompts | Teammate goes off-scope | Include specific files, verify command |
| No verify command | Teammate reports done prematurely | Always specify verify |
| Too many teammates | Token cost explosion | Max 3-4 concurrent teammates |
| No handoff between phases | Context lost between pipeline stages | Use `dev_handoff` |
| Forgetting shutdown | Orphaned teammate processes | Always `shutdown_request` + `TeamDelete` |
| Skipped product definition | 1.5h rework | Validate user stories before tech work |
| Premature plan approval | Quality gaps | "Approved with corrections" ≠ done — must re-review |
| Mislabeled dependencies | Lost parallelism | Analyze carefully, maximize parallel opportunities |
| Messaged shutdown teammate | Wasted waiting | Check member status before messaging |
| Teammate idle >30min | Resource waste | Complete → assign next task or shutdown |
| Skipped plan re-review | Quality risk | Updated plans must be re-reviewed before approval |
| Skipped cross-module review | Cross-cutting bugs ship | Always run Phase 4 reviewer for 3+ agent teams |
| Teammate bypasses review | P0/P1 in production | `/dev commit` review gate is mandatory, no `--no-review` for teams |

## Sizing Guide

| Task Complexity | Recommended Team Size | Mode |
|----------------|----------------------|------|
| 2-3 independent modules | 2-3 agents | Fan-out |
| 4+ independent modules | 3-4 agents (batch) | Master-Worker |
| Sequential phases | 1 agent at a time | Pipeline |
| Impl + review | 2 agents | Review-Chain |
| Single complex module | 1 agent (no team needed) | N/A |

## Cost Estimation

Each teammate has independent context, so costs scale linearly:

| Teammates | Approximate Cost Multiplier |
|-----------|---------------------------|
| 1 (no team) | 1x |
| 2 | ~2.2x (overhead) |
| 3 | ~3.3x |
| 4 | ~4.5x |

Use teams when parallelism saves significant wall-clock time.
