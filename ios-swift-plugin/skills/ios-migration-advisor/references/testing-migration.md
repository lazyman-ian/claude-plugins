# XCTest → Swift Testing Migration

Swift Testing available in Xcode 16+. Coexists with XCTest — migrate incrementally.

## Why Migrate

| XCTest | Swift Testing |
|--------|--------------|
| 40+ assertion methods (XCTAssertEqual, XCTAssertNil, ...) | 2 macros: `#expect` + `#require` |
| Class inheritance required (XCTestCase) | Struct, enum, actor, or free function |
| setUp/tearDown lifecycle | init/deinit (instance isolation) |
| No parameterized tests | Built-in `@Test(arguments:)` |
| Sequential by default | **Parallel by default** |
| Verbose test naming | `@Test("Human readable name")` |

## Migration Mapping

| XCTest | Swift Testing |
|--------|--------------|
| `class FooTests: XCTestCase` | `struct FooTests` or `@Suite struct FooTests` |
| `func testSomething()` | `@Test func something()` |
| `XCTAssertEqual(a, b)` | `#expect(a == b)` |
| `XCTAssertTrue(x)` | `#expect(x)` |
| `XCTAssertNil(x)` | `#expect(x == nil)` |
| `XCTAssertThrowsError(try f())` | `#expect(throws: MyError.self) { try f() }` |
| `XCTUnwrap(optional)` | `try #require(optional)` |
| `setUp() / tearDown()` | `init() / deinit` |
| `setUpWithError()` | `init() throws` |
| `XCTSkip("reason")` | `@Test(.disabled("reason"))` |
| `XCTExpectFailure` | `withKnownIssue { }` |
| N/A | `@Test(.timeLimit(.minutes(1)))` |

## Key Features

### Parameterized Tests

```swift
// BEFORE: Duplicate test methods
func testConvertUSD() { XCTAssertEqual(convert(100, .usd, .eur), 85) }
func testConvertGBP() { XCTAssertEqual(convert(100, .gbp, .eur), 117) }
func testConvertJPY() { XCTAssertEqual(convert(100, .jpy, .eur), 0.62) }

// AFTER: Single parameterized test
@Test("Currency conversion", arguments: [
    (100.0, Currency.usd, Currency.eur, 85.0),
    (100.0, .gbp, .eur, 117.0),
    (100.0, .jpy, .eur, 0.62),
])
func conversion(amount: Double, from: Currency, to: Currency, expected: Double) {
    #expect(convert(amount, from, to) == expected)
}
```

**Tip:** Implement `CustomTestStringConvertible` for readable test names:
```swift
extension Currency: CustomTestStringConvertible {
    var testDescription: String { rawValue.uppercased() }
}
// Shows: "Currency conversion — USD" instead of "argument 0"
```

**Warning:** Multiple `arguments:` arrays create cartesian product (exponential). Use `zip()` for one-to-one pairing.

### Nested Suites

```swift
@Suite("User Authentication")
struct AuthTests {
    @Suite("Login")
    struct LoginTests {
        @Test("Valid credentials succeed")
        func validLogin() async throws { ... }

        @Test("Invalid password fails")
        func invalidPassword() async throws { ... }
    }

    @Suite("Registration")
    struct RegistrationTests {
        @Test("New user can register")
        func newUser() async throws { ... }
    }
}
```

Peter Steinberger's migration: 91 → 49 files (46% reduction) using nested suites.

### Traits

```swift
@Test(.disabled("Server down for maintenance"))
func serverTest() { }

@Test(.bug("https://github.com/org/repo/issues/123", "Flaky on CI"))
func flakyTest() { }

@Test(.timeLimit(.seconds(30)))
func networkTest() async { }

@Suite(.serialized)  // Force sequential (for non-thread-safe tests)
struct DatabaseTests { }

@Test(.tags(.networking))
func apiTest() { }
```

### Soft vs Hard Assertions

```swift
// Soft: continues on failure (reports all failures)
#expect(user.name == "Alice")
#expect(user.age == 30)
#expect(user.isActive)

// Hard: stops test immediately
let user = try #require(fetchUser())  // Unwraps optional or fails
#expect(user.name == "Alice")
```

## Migration Strategy

### Phase 1: New Tests Only
Write all new tests with Swift Testing. Keep existing XCTest as-is.

### Phase 2: Leaf Tests
Migrate simple, self-contained test classes first (no shared state, no complex setup).

### Phase 3: Stateful Tests
Migrate tests with setUp/tearDown to init/deinit. Apply `.serialized` if they depend on shared state.

### Phase 4: Cleanup
Remove empty XCTestCase subclasses. Consolidate into nested suites.

## Handling Parallel Execution

Swift Testing runs tests in parallel by default. Legacy tests that share state will fail randomly.

```swift
// Temporary fix: serialize the suite
@Suite(.serialized)
struct LegacyDatabaseTests {
    // Migrate these to use instance isolation later
}
```

**Long-term fix:** Give each test its own database instance:
```swift
@Suite struct DatabaseTests {
    let db: TestDatabase

    init() async throws {
        db = try await TestDatabase.temporary()
    }

    @Test func insertUser() async throws {
        try await db.insert(User(name: "Alice"))
        #expect(await db.count(User.self) == 1)
    }
}
```

## Coexistence Rules

- XCTest and Swift Testing can live in the same target
- Do NOT use XCTest assertions inside Swift Testing tests (or vice versa)
- `swift test --enable-swift-testing` to run both
- `swift test --filter-tag .networking` to run tagged subset

## AI-Assisted Migration Tips

From Peter Steinberger's 700+ test migration:
1. Provide before/after examples to AI — don't let it blindly swap syntax
2. Compile → test → commit after each batch
3. Instruct "refactor to leverage Swift Testing patterns" not just "convert syntax"
4. Review parameterized test opportunities (repeated patterns)

## Sources

- [Peter Steinberger: Migrating 700+ Tests](https://steipete.me/posts/2025/migrating-700-tests-to-swift-testing)
- [东坡肘子: Mastering Swift Testing](https://fatbobman.com/en/posts/mastering-the-swift-testing-framework/)
- [Antoine van der Lee: Modern Unit Test](https://www.avanderlee.com/swift-testing/modern-unit-test/)
- [Apple: Swift Testing](https://developer.apple.com/xcode/swift-testing)
