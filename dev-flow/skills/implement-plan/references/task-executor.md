# Task Executor Reference

Per-task execution with 5-gate quality pipeline.

## Process

```
PREPARE → IMPLEMENT → SELF-REVIEW → SPEC REVIEW → QUALITY REVIEW → COMPLETE
```

### Step 1: Prepare Context

- Read plan task (embed full text, not file reference)
- Read prev handoff summary: `dev_handoff(action='chain', taskId='...')`
- Query knowledge: `dev_memory(action="query", query="<task-keywords> pitfalls")`

### Step 2: Spawn Fresh Implementer

Each task gets a **fresh subagent** (context isolation, anti-corruption):

```python
Task(
  subagent_type="dev-flow:implement-agent",
  model=per_task_model,  # from plan frontmatter
  prompt="""
  Implement this task:

  {task_text_embedded_fully}

  Previous handoff summary:
  {prev_handoff_summary}

  Known pitfalls:
  {dev_memory_results}

  Files to create/modify:
  {task.files}

  Verify command: {task.verify}
  """
)
```

**Anti-corruption rule**: MUST be fresh context. Never reuse a subagent across tasks.

### Step 3: Implementer Self-Review

The implement-agent includes an 11-point self-review checklist:
- Completeness (3 items): All requirements, edge cases, no silent skips
- Quality (3 items): Clear names, maintainable, no hacks
- Discipline (3 items): YAGNI, existing patterns, no over-abstraction
- Testing (2 items): Real behavior tests, comprehensive coverage

If any item fails → implementer fixes before reporting back.

### Step 4: Spec Review

After implementer reports success, spawn spec-reviewer:

```python
Task(
  subagent_type="dev-flow:spec-reviewer",
  model="sonnet",
  prompt="""
  Review this implementation against spec:

  ## Spec (from plan):
  {task_text}

  ## Changes (git diff):
  {git_diff_of_task_changes}

  Verify: Is the implementation exactly what was requested?
  Nothing more, nothing less.
  """
)
```

**Decisions**:
- APPROVED → proceed to Step 5
- REQUEST CHANGES → back to Step 2 (fresh implementer with feedback)
- Max 2 iterations → escalate to user if still failing

### Step 5: Quality Review

Only after spec review passes. Spawn code-reviewer:

```python
Task(
  subagent_type="dev-flow:code-reviewer",
  model="sonnet",
  prompt="Commit-gate review mode. Check staged changes for P0-P3 issues."
)
```

**Decisions**:
- P0/P1 found → block, fix, re-review
- P2/P3 found → note and continue
- Append to review session log

### Step 6: Complete Task

1. Create handoff: `dev_handoff(action='write', handoff={...})`
2. Update task: `TaskUpdate(status: 'completed')`
3. Check batch checkpoint (every N tasks, see implement-plan SKILL.md)

## DO / DON'T

| DO | DON'T |
|----|-------|
| Use fresh subagent per task | Reuse context across tasks |
| Embed full task text | Reference file paths only |
| Include prev handoff summary | Assume agent has context |
| Run all 5 gates | Skip spec review |
| Escalate after 2 retries | Loop indefinitely |

## If Blocked

1. Document blocker in handoff (status: "blocked")
2. Describe what's needed to unblock
3. Return to orchestrator for user intervention
