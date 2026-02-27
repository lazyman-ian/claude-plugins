# Swift Testing Basics

Complete usage guide for Swift Testing framework (Xcode 16+, Swift 6.0+).

## Import

```swift
import Testing
```

Add to test target only. No additional package dependency needed in Xcode 16+.

## @Test Attribute

```swift
@Test func userCreation() { ... }                         // Basic (no test prefix needed)
@Test("User creation sets default role") func role() { }  // Display name
@Test(.tags(.networking)) func api() async throws { }     // Tagged
@Test(.tags(.networking, .slow)) func download() { }      // Multiple tags
```

### Conditions and traits

```swift
@Test(.enabled(if: env["CI"] != nil)) func ciOnly() { }   // Runtime condition
@Test(.disabled("Server down")) func serverTest() { }     // Always skip
@Test(.bug("https://...", "Flaky")) func flaky() { }      // Known bug
@Test(.timeLimit(.seconds(30))) func network() { }        // Timeout
```

`.enabled(if:)` evaluates at runtime. `.disabled` always skips. `.timeLimit` inheritable by suites.

### Tags

```swift
extension Tag {
    @Tag static var networking: Self
    @Tag static var database: Self
}
```

```bash
swift test --filter-tag .networking
```

## @Suite Attribute

```swift
@Suite("User Management")                         // Named group
struct UserTests {
    @Test func creation() { ... }
    @Test func deletion() { ... }
}

@Suite("Auth")
struct AuthTests {
    @Suite("Login") struct LoginTests {            // Nesting creates hierarchy
        @Test("Valid") func valid() { ... }
    }
}

@Suite(.serialized)                                // Sequential (default is parallel)
struct DatabaseTests { ... }
```

### Instance isolation

Each `@Test` gets a **fresh instance** of the struct. No shared mutable state.

### init / deinit

```swift
@Suite struct DatabaseTests {
    let db: TestDatabase

    init() async throws {                          // Replaces setUp()
        db = try await TestDatabase.temporary()
    }

    @Test func insertUser() async throws {
        try await db.insert(User(name: "Alice"))
        #expect(await db.count(User.self) == 1)
    }
}
```

`init()` can be `async throws`. `deinit` is sync only — use custom `TestScoping` trait for async teardown.

## #expect Macro

Soft assertion: records failure but continues the test.

```swift
#expect(isValid)                            // Boolean
#expect(user.name == "Alice")               // Equality
#expect(score > 80)                         // Comparison
#expect(result == nil)                      // Optional
#expect(message.contains("success"))        // Expression

// Throws specific error
#expect(throws: NetworkError.timeout) {
    try await client.fetch(url)
}

// Throws matching predicate
#expect {
    try decoder.decode(Model.self, from: data)
} throws: { error in
    guard let e = error as? DecodingError,
          case .keyNotFound(let key, _) = e else { return false }
    return key.stringValue == "id"
}
```

On failure, shows the expression with evaluated values automatically.

## #require Macro

Hard assertion: throws on failure, stopping the test immediately.

```swift
// Unwrap optional (replaces XCTUnwrap)
let user = try #require(fetchUser())
#expect(user.name == "Alice")

// Precondition
try #require(items.count > 0, "Need at least one item")
let first = items[0]

// Unwrap from collection
let config = try #require(configs.first(where: { $0.isDefault }))
```

Use `#require` when subsequent assertions depend on a value being non-nil or a condition being true.

## Issue.record and withKnownIssue

```swift
// Manual failure recording
Issue.record("Item \(index) failed: \(result.error)")

// Known issue — test passes even if assertions fail inside
withKnownIssue("Feature not yet implemented") {
    #expect(newFeature().isValid)
}
// When the issue is fixed, reports "unexpected pass" as reminder to remove

withKnownIssue("Intermittent", isIntermittent: true) {
    #expect(flakyBehavior())
}
```

## Parameterized Tests

```swift
// Single argument — each runs as separate test case
@Test("Validate email", arguments: [
    "user@example.com", "admin@test.org", "name+tag@domain.co",
])
func validEmail(email: String) {
    #expect(EmailValidator.isValid(email))
}

// Multiple arguments — cartesian product (6 combinations)
@Test(arguments: ["USD", "EUR"], [100, 200, 500])
func formatCurrency(code: String, amount: Int) {
    #expect(!CurrencyFormatter.format(amount, currency: code).isEmpty)
}

// Paired arguments — zip for one-to-one (5 pairs, not 25)
@Test("Squares", arguments: zip([1, 2, 3, 4, 5], [1, 4, 9, 16, 25]))
func squared(input: Int, expected: Int) {
    #expect(input * input == expected)
}

// Enum — CaseIterable for exhaustive coverage
@Test("Config loads", arguments: Environment.allCases)
func configLoads(env: Environment) throws {
    #expect(!try Config.load(for: env).apiURL.isEmpty)
}
```

### CustomTestStringConvertible

Implement for readable test names in Xcode results:

```swift
struct TestCase: CustomTestStringConvertible {
    let input: String
    let expected: Int
    var testDescription: String { "\(input) -> \(expected)" }
}
// Shows: "Parse integers — 42 -> 42" instead of "argument 0"
```

## Test Plan Configuration

In Xcode, create a `.xctestplan` file to:
- Include/exclude specific test targets
- Enable/disable specific tags
- Set environment variables per test configuration
- Configure code coverage targets

```bash
# Command-line tag filtering
swift test --filter-tag .networking
xcodebuild test -testPlan MyPlan -scheme MyApp
```

## Sources

- [Apple: Swift Testing](https://developer.apple.com/documentation/testing)
- [Apple: Meet Swift Testing (WWDC24)](https://developer.apple.com/videos/play/wwdc2024/10179)
- [Apple: Go further with Swift Testing (WWDC24)](https://developer.apple.com/videos/play/wwdc2024/10195)
- [fatbobman: Mastering Swift Testing](https://fatbobman.com/en/posts/mastering-the-swift-testing-framework/)
- [avanderlee: Modern Unit Test](https://www.avanderlee.com/swift-testing/modern-unit-test/)
