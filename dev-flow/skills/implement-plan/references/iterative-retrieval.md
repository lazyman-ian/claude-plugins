# Iterative Retrieval Pattern

When a subagent needs context beyond its initial prompt, use this 4-phase retrieval loop (max 3 iterations).

## Phase 1: DISPATCH

- Start with the initial query from the task description
- Use `dev_memory(query)` to get related knowledge and patterns
- Use `Grep`/`Glob` tools to find relevant files
- Identify file list + key functions/classes to examine

## Phase 2: EVALUATE

- Assess whether retrieved context is sufficient
- Ask: Do I have enough to implement? Are there gaps in understanding?
- If sufficient: proceed to implementation
- If gaps exist: proceed to Phase 3

## Phase 3: REFINE

- Narrow or broaden the search based on identified gaps
- Try alternative keywords, related concepts, or adjacent modules
- Check imports, tests, config files, and dependencies
- Re-run `dev_memory(query)` with refined keywords

## Phase 4: LOOP

- Return to Phase 1 with refined search terms
- Maximum 3 iterations to prevent infinite exploration
- If still insufficient after 3 rounds: proceed with best-effort implementation + flag unknowns in reasoning

## When to Use

- Complex agents working on unfamiliar modules
- Tasks involving cross-module interactions and dependencies
- Debug sessions requiring root cause analysis
- Refactoring tasks spanning multiple files

## When NOT to Use

- Simple file edits with clear, specified context
- Tasks where exact files are already provided
- Quick fixes with obvious, localized solutions

## Integration Points

Reference this pattern in agent prompts:

```
implement-agent: "For context gathering, follow references/iterative-retrieval.md"
debug-agent: "Use iterative retrieval pattern for root cause analysis"
code-reviewer: "When reviewing cross-module changes, apply iterative retrieval to verify connections"
```

## Example Flow

```
Task: Fix race condition in async auth token refresh

Phase 1: DISPATCH
- Query: "async token refresh race condition"
- Find: auth.ts, token-manager.ts, tests/

Phase 2: EVALUATE
- Know how tokens are stored? ✓
- Know all callers of refresh? ✗ (gap)

Phase 3: REFINE
- Query: "token refresh callers concurrent"
- Check: imports of refreshToken(), concurrent calls

Phase 4: LOOP
- Now understand call patterns
- Proceed with mutex/semaphore implementation
```

## Token Budget

Each iteration should be efficient:
- Phase 1/3: Grep/Glob queries (< 1K tokens)
- Phase 2: Assessment (< 500 tokens)
- Max per loop: 2-3K tokens total
- 3 iterations max: 6-9K tokens total budget

This keeps subagent context lean while gathering necessary information.
