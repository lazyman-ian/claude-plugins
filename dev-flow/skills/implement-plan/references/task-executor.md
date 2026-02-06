# Task Executor Reference

Single task execution with TDD workflow.

## Process

```
UNDERSTAND → IMPLEMENT (TDD) → CREATE HANDOFF → RETURN
```

### Step 1: Understand Context

- Read previous handoff (if provided)
- Note learnings and patterns to follow
- Understand where task fits in overall plan

### Step 2: Implement with TDD

**Iron Law: No production code without a failing test first.**

1. **RED**: Write failing test
2. **GREEN**: Minimal implementation to pass
3. **REFACTOR**: Clean up, keep tests green
4. **REPEAT**: For each behavior

### Step 3: Create Handoff

**Filename**: `task-NN-<short-description>.md`

```markdown
# Task [N] Handoff

## Status
[success/partial/blocked]

## Completed
- [x] What was done

## Files Changed
- `path/to/file.ts` - Description

## Decisions
- Decision and rationale

## Notes for Next Task
- Important context
```

### Step 4: Return

```
Task [N] Complete

Status: [success/partial/blocked]
Handoff: [path to handoff file]

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
