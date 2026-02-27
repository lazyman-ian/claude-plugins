---
paths:
  - "**/*Test*.swift"
  - "**/*Tests*/**/*.swift"
  - "**/*Spec*.swift"
---

# Swift Testing Coding Style

Rules for test files. Prefer Swift Testing over XCTest for new tests.

## Structure
- Use `@Suite struct` (not class) for test grouping
- Use `init`/`deinit` for setup/teardown (not setUp/tearDown methods)
- One `@Test` per behavior — name describes expected outcome
- Group related tests in nested `@Suite`

## Assertions
- `#expect(a == b)` over `XCTAssertEqual(a, b)` — better diagnostics
- `#require(try expression)` only when test cannot continue without the value
- `#expect(throws: ErrorType.self)` for error testing
- Never force-unwrap in tests — use `#require` to unwrap

## Async
- `await confirmation { confirm in ... }` over XCTestExpectation
- Use `.timeLimit(.minutes(1))` trait for timeout instead of waitForExpectations
- Mark actor-isolated tests explicitly: `@Test @MainActor func testUI()`

## Organization
- Use `@Tag` for cross-suite classification (e.g., .integration, .slow, .network)
- Use `@Test(arguments:)` for parameterized tests — avoid copy-paste test methods
- Use `.serialized` trait on @Suite only when tests share mutable state

## Coexistence
- XCTest and Swift Testing can coexist in the same target
- Do NOT mix in the same type — one file, one framework
- Keep UITests and performance tests in XCTest (Swift Testing does not support them yet)
