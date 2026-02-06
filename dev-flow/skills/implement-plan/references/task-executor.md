# Task Executor Reference

Single task execution with TDD workflow.

## Process

```
UNDERSTAND → IMPLEMENT (TDD) → CREATE HANDOFF → RETURN
```

### Step 1: Understand Context

- Read previous handoff: `dev_handoff(action='read', handoffId='...')` or `dev_handoff(action='chain', taskId='...')` to see all prior handoffs
- Note learnings and patterns to follow
- Understand where task fits in overall plan

### Step 2: Implement with TDD

**Iron Law: No production code without a failing test first.**

1. **RED**: Write failing test
2. **GREEN**: Minimal implementation to pass
3. **REFACTOR**: Clean up, keep tests green
4. **REPEAT**: For each behavior

### Step 3: Create Handoff

Use `dev_handoff(action='write')` to persist the handoff:

```python
dev_handoff(action='write', handoff=json.dumps({
  "version": "2.0",
  "agent_id": "implement-agent-NNN",
  "task_id": "TASK-XXX",
  "status": "success",           # success | partial | blocked
  "summary": "Implemented X with Y approach",
  "changes_made": ["path/to/file.ts:1-50"],
  "decisions": {"key": "rationale"},
  "verification": ["Tests pass", "Lint clean"],
  "for_next_agent": "Continue with Z",
  "open_questions": []
}))
```

### Step 4: Return

Return the handoff ID from `dev_handoff` response:

```
Task [N] Complete

Status: [success/partial/blocked]
Handoff ID: [returned by dev_handoff]

Summary: [1-2 sentences]
```

## DO / DON'T

| DO | DON'T |
|----|-------|
| Write tests FIRST | Write code before tests |
| Watch tests fail before implementing | Skip the failing test step |
| Read files completely | Use limit/offset |
| Follow existing patterns | Over-engineer |
| Create handoff (even if blocked) | Skip handoff |
| Keep changes focused | Expand scope |

## If Blocked

1. Document blocker in handoff
2. Set status to "blocked"
3. Describe what's needed to unblock
4. Return to orchestrator
