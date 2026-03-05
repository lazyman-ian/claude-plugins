# Brainstorm — Design Exploration

Explore design options and clarify requirements before committing to a plan.

## Process

```
CLARIFY → EXPLORE → GENERATE → EVALUATE → DECIDE → PERSIST
```

### Integration Points

- **Query memory**: `dev_memory(action="query", query="<feature-keyword> <platform>")`
- **Multiple choice**: Use `AskUserQuestion` with 2-4 options (not open-ended)
- **Persist decisions**: `dev_handoff(action='write', handoff={ agent_id: 'brainstorm', task_id: '<id>', status: 'success', decisions: {...}, for_next_agent: 'Create implementation plan' })`

### Constraints

- One question at a time (prevent user overwhelm)
- 200-300 word segments, verify after each
- YAGNI strict for every option

## Transition

After decisions: suggest `/create-plan` (references handoff automatically).
