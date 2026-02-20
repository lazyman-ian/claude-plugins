---
name: test-generator
description: >-
  Generates comprehensive tests for existing code with platform-aware test framework selection
  and style matching from existing test files. This skill should be used when writing unit tests,
  integration tests, or adding test coverage for untested code paths.
  Triggers on "generate tests", "write tests for", "add unit tests", "test coverage",
  "add tests", "create test file", "生成测试", "补充测试", "写单元测试", "增加测试覆盖".
  Do NOT use for running existing tests — use "self-check" instead.
  Do NOT use for test-driven development during implementation — use "implement-plan" instead.
model: sonnet
context: fork
memory: project
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

### Step 1: Detect Platform and Test Framework

Query `dev_config` to identify the project platform. Map to the correct test framework:

| Platform | Framework | Test Runner | File Pattern |
|----------|-----------|-------------|--------------|
| iOS/Swift | XCTest / Swift Testing | `xcodebuild test` | `*Tests.swift` |
| Android/Kotlin | JUnit5 + MockK | `./gradlew test` | `*Test.kt` |
| Python | pytest | `pytest` | `test_*.py` |
| Node/TypeScript | Vitest or Jest | `npx vitest run` / `npx jest` | `*.test.ts`, `*.spec.ts` |
| Go | testing | `go test ./...` | `*_test.go` |

**Framework detection priority**:
1. `dev_config` platform field
2. Config files: `vitest.config.*`, `jest.config.*`, `pytest.ini`, `Package.swift`
3. Existing test file imports

### Step 2: Find Existing Test Files for Style Reference

```
Glob("**/*Test*", "**/*Spec*", "**/*_test*", "**/*.test.*")
```

Read 1-2 existing test files to extract:
- Import style and test organization
- Assertion patterns (XCTAssert vs expect vs assert)
- Setup/teardown conventions
- Naming conventions (camelCase vs snake_case for test names)
- Mock/stub patterns used in the project

If no existing tests found, use platform defaults from `references/test-patterns.md`.

### Step 3: Analyze Target Code

Read the target source file(s). Identify:
- Public functions and methods (test surface)
- Input parameters and return types
- Error paths and edge cases
- Dependencies that need mocking
- State mutations and side effects

### Step 4: Design Test Cases

For each function/method, plan:

| Category | What to Test |
|----------|-------------|
| Happy path | Normal input produces expected output |
| Edge cases | Empty input, boundary values, nil/null |
| Error handling | Invalid input, thrown errors, failure states |
| State | Before/after mutations, idempotency |

Skip trivial getters/setters. Focus on logic-bearing code.

### Step 5: Generate Tests

Write test file(s) matching the project's existing style. Follow these rules:

**Structure**:
- One test file per source file
- Group related tests (by method or behavior)
- Use descriptive test names that explain the scenario

**Quality**:
- Test behavior, not implementation details
- No mocking of the unit under test
- Prefer real objects over mocks when practical
- Each test is independent (no shared mutable state)
- Use factory functions or fixtures for test data

**Naming**: Match the project convention. Examples:
- Swift: `test_fetchUser_returnsUserOnSuccess()`
- Kotlin: `fetchUser returns user on success`
- Python: `test_fetch_user_returns_user_on_success`
- TypeScript: `it('returns user on success')`
- Go: `TestFetchUser_ReturnsUserOnSuccess`

### Step 6: Run Tests

Execute the test runner for the generated files only:

```bash
# Platform-specific — get command from dev_config
# Run just the new test file, not the entire suite
```

If tests fail:
1. Read the failure output
2. Fix the test (not the source code)
3. Re-run until green

### Step 7: Report Summary

Provide a brief summary:

```
Tests generated: N tests in M files
Passed: X / N
Coverage areas: [list of functions/methods covered]
Not covered: [anything intentionally skipped and why]
```

## Test Quality Rules

1. **No implementation mocking** — mock dependencies, not the unit under test
2. **Test behavior** — assert on outputs and side effects, not internal calls
3. **Deterministic** — no flaky tests, no time-dependent assertions without control
4. **Self-contained** — each test sets up its own state
5. **Readable** — a failing test name should explain what broke

## Memory Integration

Before generating tests, query `dev_memory` for:
- Known test pitfalls in the project
- Previously discovered patterns

After generating, save novel patterns via `dev_memory(save)` if the project uses an unusual testing approach.

## Reference

For platform-specific test patterns and examples, see `references/test-patterns.md`.
