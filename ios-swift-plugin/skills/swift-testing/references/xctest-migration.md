# XCTest to Swift Testing Migration

Incremental migration guide. Both frameworks coexist in the same test target.

## Side-by-Side Comparison

| Concept | XCTest | Swift Testing |
|---------|--------|--------------|
| Test class/struct | `class FooTests: XCTestCase` | `@Suite struct FooTests` |
| Test method | `func testFoo()` | `@Test func foo()` |
| Assert equal | `XCTAssertEqual(a, b)` | `#expect(a == b)` |
| Assert true | `XCTAssertTrue(x)` | `#expect(x)` |
| Assert false | `XCTAssertFalse(x)` | `#expect(!x)` |
| Assert nil | `XCTAssertNil(x)` | `#expect(x == nil)` |
| Assert not nil | `XCTAssertNotNil(x)` | `#expect(x != nil)` |
| Assert throws | `XCTAssertThrowsError(try f())` | `#expect(throws: E.self) { try f() }` |
| Assert no throw | `XCTAssertNoThrow(try f())` | `#expect(throws: Never.self) { try f() }` |
| Unwrap optional | `let x = try XCTUnwrap(opt)` | `let x = try #require(opt)` |
| Skip test | `throw XCTSkip("reason")` | `@Test(.disabled("reason"))` |
| Expected failure | `XCTExpectFailure { }` | `withKnownIssue { }` |
| Async expectation | `expectation + fulfill + wait` | `await confirmation { c in }` |
| Setup | `override func setUp()` | `init()` |
| Async setup | `override func setUp() async throws` | `init() async throws` |
| Teardown | `override func tearDown()` | `deinit` (sync only) |
| Async teardown | `override func tearDown() async throws` | Custom trait with `TestScoping` |
| Performance test | `measure { }` | Not available (keep XCTest) |
| UI test | `XCUIApplication` | Not available (keep XCTest) |

## Full Before/After Example

```swift
// BEFORE (XCTest)
class UserTests: XCTestCase {
    var service: UserService!
    override func setUp() { service = UserService() }

    func testCreateUser() {
        let user = service.create(name: "Alice")
        XCTAssertEqual(user.name, "Alice")
        XCTAssertNotNil(user.id)
    }
}

// AFTER (Swift Testing)
import Testing

@Suite("User Operations")
struct UserTests {
    let service = UserService()  // Fresh per test (struct)

    @Test("Create user sets name and generates ID")
    func createUser() {
        let user = service.create(name: "Alice")
        #expect(user.name == "Alice")
        #expect(user.id != nil)
    }
}
```

### Key conversions

```swift
// Expectations → Confirmations
await confirmation { confirm in
    observer.onEvent = { confirm() }
    trigger.fire()
}
// Multiple: await confirmation(expectedCount: 3) { confirm in ... }

// XCTSkip → Traits
@Test(.disabled("Not ready"))  func feature() { }    // Compile-time
@Test(.enabled(if: flag))      func feature() { }    // Runtime
```

## Migration Checklist

- [ ] Start with leaf test classes (no shared state, simple assertions)
- [ ] Convert one file at a time, compile and run after each
- [ ] Replace `XCTestCase` subclass with `@Suite struct`
- [ ] Replace `setUp` with `init`, `tearDown` with `deinit`
- [ ] Replace all `XCTAssert*` with `#expect` / `#require`
- [ ] Replace `XCTestExpectation` with `await confirmation`
- [ ] Add `.serialized` to suites that previously relied on sequential execution
- [ ] Replace `XCTSkip` with `.disabled` or `.enabled(if:)`
- [ ] Replace `XCTExpectFailure` with `withKnownIssue`
- [ ] Identify parameterized test opportunities (repeated patterns)
- [ ] Remove `import XCTest` once file is fully migrated
- [ ] Keep `XCTestCase` for: UI tests, performance tests, tests using KIF/EarlGrey

## Coexistence Rules

- XCTest and Swift Testing tests can live in the **same target**
- Do NOT mix assertion frameworks within a single test method
- Both frameworks run when you press "Run All Tests"
- `swift test --enable-swift-testing` runs both from command line
- XCTest classes and Swift Testing suites can reference the same test helpers

## Migration Strategy

### Phase 1: New tests only

Write all new tests with Swift Testing. Do not touch existing XCTest files.

### Phase 2: Leaf tests

Migrate simple, self-contained test classes:
- No `setUp` / `tearDown` or simple setup
- No shared mutable state
- Pure assertion-based tests

### Phase 3: Stateful tests

Migrate tests with setup/teardown:
- Convert `setUp` to `init`
- Apply `.serialized` if tests share external resources
- Convert to instance properties for test isolation

### Phase 4: Cleanup

- Remove empty `XCTestCase` subclasses
- Consolidate related tests into nested `@Suite` structures
- Look for parameterized test opportunities across the converted tests

## Common Pitfalls

| Pitfall | Symptom | Fix |
|---------|---------|-----|
| Forgetting `.serialized` | Random test failures after migration | Add `@Suite(.serialized)` for shared state |
| Using `class` instead of `struct` | Shared mutable state leaks | Convert to `struct` |
| Mixing XCTAssert with #expect | Silent assertion failures | Use one framework per test method |
| Async teardown in deinit | Compiler error (deinit is sync) | Use custom `TestScoping` trait |
| `test` prefix kept | Test runs twice (XCTest and Swift Testing) | Remove `test` prefix, add `@Test` |
| setUp not converted | setUp never called (not a Swift Testing concept) | Convert to `init()` |

## What to Keep in XCTest

| Feature | Reason |
|---------|--------|
| `XCUITest` (UI tests) | No Swift Testing equivalent |
| `measure { }` (performance) | No Swift Testing equivalent |
| KIF / EarlGrey tests | Framework requires XCTestCase |
| Tests using `addUIInterruptionMonitor` | XCTest-only API |
| Tests using `XCTActivity` | No direct equivalent |

## Sources

- [Peter Steinberger: Migrating 700+ Tests](https://steipete.me/posts/2025/migrating-700-tests-to-swift-testing)
- [Antoine van der Lee: Modern Unit Test](https://www.avanderlee.com/swift-testing/modern-unit-test/)
- [Apple: Migrating a test to Swift Testing](https://developer.apple.com/documentation/testing/migratingfromxctest)
