---
name: refactor
description: >-
  Performs structural code refactoring with behavior-preserving verification at each step.
  This skill should be used when extracting functions, splitting large files, improving naming,
  reorganizing modules, or applying design patterns while ensuring no behavior changes.
  Triggers on "refactor", "extract function", "split file", "rename", "reorganize",
  "improve structure", "重构", "提取方法", "拆分文件", "代码重组", "优化结构".
  Do NOT use for removing AI slop patterns — use "deslop" instead.
  Do NOT use for fixing bugs — use "debugging" instead.
model: sonnet
context: fork
memory: project
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

> Every refactoring step must be verifiable. Run tests after each change. If tests fail, revert and retry with a smaller step.

This is Verification-Driven Development (VDD): the machine judges correctness, not the agent.

## Workflow

### Step 1: Understand Current Structure

Read target files. Identify dependencies, callers, and test coverage.

```
Glob("src/**/*.ts")     # Find related files
Grep("functionName")    # Find all usages
Read(target_file)       # Understand current structure
```

### Step 2: Establish Baseline

Get verify command from `dev_config` and run existing tests.

```
dev_config()            # Get platform verify command
Bash("npm test")        # Run tests — ALL must pass
```

If tests fail before refactoring, STOP. Fix tests first or inform user.

### Step 3: Plan Refactoring Steps

Break the refactoring into small, atomic changes. Each step should be:
- **Independent**: Compiles and passes tests on its own
- **Reversible**: Easy to undo if something breaks
- **Focused**: One structural change per step

### Step 4: Apply ONE Step

Make exactly one structural change. Examples:
- Extract one function
- Rename one symbol across all files
- Move one function to a new module

### Step 5: Verify

Run the same tests from Step 2. All must pass.
- Pass: proceed to next step
- Fail: revert the change, try a smaller step or different approach

### Step 6: Repeat

Loop Steps 4-5 until refactoring is complete.

### Step 7: Final Verification + Summary

Run full verify. Query `dev_memory(action="search")` for related pitfalls before finishing. Provide summary:
- Files modified
- Structural changes made
- Test results (before/after)

## Common Refactoring Types

| Type | When to Use | Risk |
|------|-------------|------|
| Extract Function | Function > 30 lines, or repeated logic | Low |
| Extract Class/Module | Class has multiple responsibilities | Medium |
| Split File | File > 300 lines with distinct sections | Medium |
| Inline Function | Wrapper adds no value | Low |
| Rename Symbol | Name doesn't reflect purpose | Low |
| Move Function | Function used more by another module | Medium |
| Replace Conditional with Polymorphism | Complex switch/if-else on type | High |
| Introduce Parameter Object | 3+ params passed together | Low |

See `references/refactoring-catalog.md` for detailed patterns.

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
