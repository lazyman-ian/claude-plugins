---
name: refactor
description: >-
  Performs structural code refactoring with behavior-preserving verification at each step.
  This skill should be used when extracting functions, splitting large files, improving naming,
  reorganizing modules, or applying design patterns while ensuring no behavior changes.
  Triggers on "refactor", "extract function", "split file", "rename", "reorganize",
  "improve structure", "重构", "提取方法", "拆分文件", "代码重组", "优化结构",
  "重构代码", "提取函数", "代码重组".
  Do NOT use for removing AI slop patterns — use "deslop" instead.
  Do NOT use for fixing bugs — use "debugging" instead.
model: sonnet
context: fork
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep, mcp__plugin_dev-flow_dev-flow__dev_config, mcp__plugin_dev-flow_dev-flow__dev_memory]
---

# Refactor - Behavior-Preserving Structural Changes

Restructure code in small, verified steps. Each step must pass existing tests before proceeding.

## When to Use

- Extract function/method from long code blocks
- Split large files into focused modules
- Rename symbols for clarity
- Reorganize module structure
- Remove duplication (DRY)
- Apply design patterns to simplify logic
- Flatten deep nesting or simplify conditionals

## Core Principle

Every step must be verified. Run tests after each change. Fail → revert and try smaller step.

## Workflow

1. **Baseline**: `dev_config()` → verify command → run tests. All must pass before starting.
2. **Apply one atomic change** → verify → pass: continue, fail: revert
3. **Repeat** until complete
4. **Final verify** + summary (files modified, changes made, test results)

## Integration Points

- **Before**: `dev_memory(action="query", query="refactoring <module> pitfalls")`
- **After**: `dev_memory(action="save")` if novel pitfall discovered
- See `references/refactoring-catalog.md` for detailed patterns

## Memory Integration

- **Before**: `dev_memory(action="query", query="refactoring pitfalls for [module]")`
- **After**: `dev_memory(action="save", text="[novel finding]", tags="refactoring,pattern")` if a new pitfall or pattern is discovered

## Scope Control

- Only modify files directly related to the refactoring target
- If refactoring reveals a needed change in an unrelated module, record it (`dev_memory save`) but do NOT modify it
- Ask user before expanding scope beyond the original request

## Anti-Patterns

| Do NOT | Instead |
|--------|---------|
| Refactor + add features simultaneously | One concern per pass |
| Skip test verification between steps | Every step must verify |
| Rename across the entire codebase at once | Rename in one module, verify, then expand |
| Refactor without existing tests | Write tests first, then refactor |
| Make "improvements" beyond what was asked | Stick to requested scope |
