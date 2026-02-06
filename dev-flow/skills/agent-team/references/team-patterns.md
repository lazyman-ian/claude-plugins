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
  summary: 'Plan created at thoughts/shared/plans/PLAN-TASK-001.md',
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

Best for: code that needs review before merge.

```
Implementer → Reviewer → (fix if needed) → Done
```

**Setup**:
```
TaskCreate({ subject: "Implement feature" })
TaskCreate({ subject: "Review implementation" })

TaskUpdate({ taskId: "2", addBlockedBy: ["1"] })

# Spawn implementer
Task({ name: "impl-dev", prompt: "Implement ..." })

# After impl done → spawn reviewer
Task({
  subagent_type: "dev-flow:code-reviewer",
  name: "reviewer",
  prompt: "Review changes in {branch}"
})
```

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

### Template Structure

```
You are {role} working on {specific_task}.

## Context
- Repo: {path}
- Branch: {branch}
- Plan: {plan_path} (section: {section})

## Steps
1. {specific step 1}
2. {specific step 2}
...
N. Verify: {verify_command}
N+1. /dev commit
N+2. SendMessage lead: done + summary

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
