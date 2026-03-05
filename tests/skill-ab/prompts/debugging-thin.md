# Debugging (Thin)

Debug systematically:

1. Query historical patterns: `dev_memory(action="query", query="<error-keyword> pitfalls")`
2. Investigate root cause (logs, stack traces, recent git changes)
3. Fix the issue
4. Verify fix: `dev_config()` → get verify command → run it → exit code 0 required
5. Save novel pitfall: `dev_memory(action="save", title="...", text="...", tags="pitfall,...")`

For complex issues, spawn parallel subagents with different hypotheses.

Output to `thoughts/debugging/DEBUG-<issue>-<date>.md`.
