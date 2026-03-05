# Test Generator (Thin)

Generate tests for existing code:

1. Detect framework: `dev_config()` → platform → framework mapping
2. Find existing tests: `Glob("**/*Test*", "**/*test*")` → read 1 file for style reference
3. Write tests matching project style, covering: happy path, edge cases, error handling
4. Run tests: platform-specific command from `dev_config()` → fix until green
5. Query pitfalls: `dev_memory(action="query", query="testing <module> pitfalls")`

Report: N tests in M files, coverage areas, skipped items.
