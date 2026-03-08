---
name: test-generator
description: >-
  Generates comprehensive tests for existing code with platform-aware test framework selection
  and style matching from existing test files. This skill should be used when writing unit tests,
  integration tests, or adding test coverage for untested code paths.
  Triggers on "generate tests", "write tests for", "add unit tests", "test coverage",
  "add tests", "create test file", "生成测试", "补充测试", "写单元测试", "增加测试覆盖",
  "写测试", "单元测试", "测试用例".
  Do NOT use for running existing tests — use "self-check" instead.
  Do NOT use for test-driven development during implementation — use "implement-plan" instead.
model: sonnet
context: fork
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep, mcp__plugin_dev-flow_dev-flow__dev_config, mcp__plugin_dev-flow_dev-flow__dev_memory]
---

# Test Generator - Platform-Aware Test Creation

Generate tests for existing code by detecting the project's test framework and matching the style of existing test files.

## When to Use

- Adding tests to existing untested code
- Improving test coverage for specific modules
- Creating test files for new source files
- Backfilling tests after a bug fix

## Workflow

### Step 1: Detect Framework

`dev_config()` → platform. Also check config files (`vitest.config.*`, `jest.config.*`, etc.) and existing test imports.

### Step 2: Match Existing Style

`Glob("**/*Test*", "**/*test*", "**/*.spec.*")` → read 1-2 existing test files for import style, assertion patterns, naming conventions, mock/stub approach.

If no existing tests, see `references/test-patterns.md` for platform defaults.

### Step 3: Generate Tests

Read target code. Write tests matching project style:
- Cover happy path, edge cases, error handling
- Test behavior, not implementation
- One file per source file, descriptive test names

### Step 4: Run and Fix

`dev_config()` → test command → run generated tests only → fix failures until green.

### Step 5: Report

```
Tests generated: N in M files | Passed: X/N | Coverage: [areas] | Skipped: [why]
```

## Memory Integration

- Before: `dev_memory(action="query", query="testing <module> pitfalls")`
- After: `dev_memory(action="save")` if novel testing pattern discovered

See `references/test-patterns.md` for platform-specific patterns.
