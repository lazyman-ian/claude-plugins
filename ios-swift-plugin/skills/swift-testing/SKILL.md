---
name: swift-testing
description: Writes, reviews, and migrates tests using Swift Testing framework (@Test, @Suite, #expect). This skill should be used when writing new tests, converting XCTest to Swift Testing, using parameterized tests, or implementing custom test traits. Triggers on "Swift Testing", "@Test", "@Suite", "#expect", "#require", "parameterized test", "test trait", "Swift 测试", "单元测试", "迁移测试". Do NOT use for XCTest-only patterns or UITest automation — use ios-build-test instead.
memory: project
allowed-tools: [Read, Glob, Grep, Edit, Write, mcp__xcode__*, mcp__apple-docs__*]
---

# Swift Testing

Write, review, and migrate tests using the Swift Testing framework (Xcode 16+, Swift 6.0+).

## Quick Decision Tree

| Need | Use |
|------|-----|
| Writing new unit tests | Swift Testing (`@Test`, `#expect`) |
| Migrating existing XCTest | This skill + `references/xctest-migration.md` |
| Parameterized / data-driven tests | `@Test(arguments:)` |
| Custom test conditions | Custom traits (`references/custom-traits.md`) |
| Testing async code | `references/async-testing-patterns.md` |
| UI tests (XCUITest) | ios-build-test (keep XCTest) |
| Performance benchmarks | ios-build-test (keep XCTest `measure {}`) |

## Core APIs

| API | Purpose | Example |
|-----|---------|---------|
| `@Test` | Mark a test function | `@Test func userLoads() { }` |
| `@Test("name")` | Test with display name | `@Test("User loads successfully") func ...` |
| `@Suite` | Group tests | `@Suite struct AuthTests { }` |
| `#expect(...)` | Soft assertion (continues) | `#expect(user.name == "Alice")` |
| `#require(...)` | Hard assertion (stops test) | `let user = try #require(fetchUser())` |
| `Issue.record` | Manual failure | `Issue.record("Unexpected state")` |
| `withKnownIssue` | Expected failure | `withKnownIssue { #expect(broken()) }` |
| `await confirmation` | Async callback assertion | Replaces `XCTestExpectation` |

## Basic Example

```swift
import Testing

@Suite("User Authentication")
struct AuthTests {
    @Test("Valid credentials return user")
    func validLogin() async throws {
        let service = AuthService()
        let user = try await service.login(email: "test@example.com", password: "valid")
        #expect(user.email == "test@example.com")
        #expect(user.isActive)
    }

    @Test("Invalid password throws error")
    func invalidPassword() async {
        let service = AuthService()
        await #expect(throws: AuthError.invalidCredentials) {
            try await service.login(email: "test@example.com", password: "wrong")
        }
    }
}
```

## Parameterized Tests

Eliminate duplicate test methods with `@Test(arguments:)`.

```swift
@Test("Status code mapping", arguments: [
    (200, HTTPStatus.ok),
    (404, HTTPStatus.notFound),
    (500, HTTPStatus.serverError),
])
func statusCode(code: Int, expected: HTTPStatus) {
    #expect(HTTPStatus(rawValue: code) == expected)
}
```

Multiple argument arrays create a cartesian product. Use `zip()` for one-to-one pairing:

```swift
let inputs = [1, 2, 3]
let expected = [2, 4, 6]

@Test("Double values", arguments: zip(inputs, expected))
func doubleValue(input: Int, expected: Int) {
    #expect(input * 2 == expected)
}
```

Implement `CustomTestStringConvertible` for readable test names in Xcode.

## XCTest to Swift Testing Migration Map

| XCTest | Swift Testing |
|--------|--------------|
| `class FooTests: XCTestCase` | `@Suite struct FooTests` |
| `func testSomething()` | `@Test func something()` |
| `XCTAssertEqual(a, b)` | `#expect(a == b)` |
| `XCTAssertTrue(x)` | `#expect(x)` |
| `XCTAssertFalse(x)` | `#expect(!x)` |
| `XCTAssertNil(x)` | `#expect(x == nil)` |
| `XCTAssertNotNil(x)` | `#expect(x != nil)` |
| `XCTAssertThrowsError(try f())` | `#expect(throws: E.self) { try f() }` |
| `XCTUnwrap(optional)` | `try #require(optional)` |
| `setUp() / tearDown()` | `init() / deinit` |
| `setUpWithError() throws` | `init() throws` |
| `XCTSkip("reason")` | `@Test(.disabled("reason"))` |
| `XCTExpectFailure` | `withKnownIssue { }` |
| `expectation + fulfill + wait` | `await confirmation { confirm in ... }` |
| `measure { }` | Keep XCTest (no Swift Testing equivalent) |

> See `references/xctest-migration.md` for step-by-step migration strategy.

## Anti-Patterns

| Pattern | Problem | Fix |
|---------|---------|-----|
| `class` for `@Suite` | Shared mutable state between tests | Use `struct` (each test gets own instance) |
| `static var` in suite | State leaks across parallel tests | Instance property in `init()` |
| `setUp()` override | Not a Swift Testing concept | Use `init()` or custom trait |
| Missing `.serialized` | Parallel tests sharing resources fail randomly | `@Suite(.serialized)` for shared state |
| `XCTAssert` in `@Test` | Wrong framework, silent failures | Use `#expect` / `#require` |
| Giant `@Test(arguments:)` | Cartesian product = exponential tests | Use `zip()` or split into groups |

## Integration

| With | How |
|------|-----|
| ios-build-test | Run tests via Xcode MCP or xcodebuild |
| swift-concurrency | Async test patterns, actor isolation |
| ios-migration-advisor | XCTest migration planning and prioritization |

## References

| Category | File |
|----------|------|
| Framework basics | `references/swift-testing-basics.md` |
| XCTest migration | `references/xctest-migration.md` |
| Async patterns | `references/async-testing-patterns.md` |
| Custom traits | `references/custom-traits.md` |
