# Custom Traits

Build reusable test conditions, scoping, and organization with custom traits.

## Built-in Traits

| Trait | Purpose |
|-------|---------|
| `.disabled("reason")` | Skip unconditionally |
| `.enabled(if: condition)` | Skip based on runtime condition |
| `.bug("url", "title")` | Document known bug |
| `.tags(.name)` | Categorize for filtering |
| `.timeLimit(.seconds(n))` | Fail if exceeded |
| `.serialized` | Force sequential execution (suite only) |

## TestTrait Protocol

Custom conditions for individual tests:

```swift
struct RequiresNetwork: TestTrait {
    func prepare(for test: Test) async throws {
        let monitor = NWPathMonitor()
        let path = await withCheckedContinuation { c in
            monitor.pathUpdateHandler = { c.resume(returning: $0) ; monitor.cancel() }
            monitor.start(queue: .global())
        }
        guard path.status == .satisfied else {
            throw SkipInfo("No network connection")
        }
    }
}

extension TestTrait where Self == RequiresNetwork {
    static var requiresNetwork: Self { RequiresNetwork() }
}

@Test(.requiresNetwork) func apiCall() async throws { ... }
```

Throw `SkipInfo` from `prepare(for:)` to skip (not fail) a test.

## TestScoping (Async Setup/Teardown)

For async setup and teardown, implement `TestScoping`:

```swift
struct DatabaseScope: TestTrait, TestScoping {
    func provideScope(
        for test: Test,
        testCase: Test.Case?,
        performing function: @Sendable () async throws -> Void
    ) async throws {
        let db = try await TestDatabase.create()
        try await TestContext.$database.withValue(db) {
            try await db.migrate()
            try await function()      // Run the test
            try await db.cleanup()    // Async teardown
        }
    }
}

enum TestContext {
    @TaskLocal static var database: TestDatabase!
}

extension TestTrait where Self == DatabaseScope {
    static var withDatabase: Self { DatabaseScope() }
}

@Test(.withDatabase) func insertUser() async throws {
    try await TestContext.database.insert(User(name: "Alice"))
    #expect(await TestContext.database.count(User.self) == 1)
}
```

Each `Test.Case` (parameterized argument) gets its own scope.

## Custom Skip Conditions

```swift
// OS version
@Test(.requiresOS(18)) func ios18Feature() { ... }

// CI skip
@Test(.skipOnCI) func localOnlyTest() { ... }

// Feature flag
@Test(.requiresFeature("new-checkout")) func checkout() async throws { ... }
```

Implementation pattern: check condition in `prepare(for:)`, throw `SkipInfo` to skip.

## Custom Tags

```swift
extension Tag {
    @Tag static var unit: Self
    @Tag static var integration: Self
    @Tag static var slow: Self
}

@Test(.tags(.unit)) func pureLogic() { ... }
@Test(.tags(.integration, .slow)) func fullPipeline() async throws { ... }
```

```bash
swift test --filter-tag .unit
swift test --filter-tag .integration
```

## Trait Composition

Combine multiple traits on a single test or suite:

```swift
@Test(.requiresNetwork, .timeLimit(.seconds(30)), .tags(.integration))
func apiEndToEnd() async throws { ... }

@Suite(.serialized, .withDatabase, .tags(.integration))
struct OrderTests {
    @Test func createOrder() async throws { ... }
}
```

Suite traits are inherited by tests unless overridden.

## Sources

- [Apple: Go further with Swift Testing (WWDC24)](https://developer.apple.com/videos/play/wwdc2024/10195)
- [Apple: Custom test traits](https://developer.apple.com/documentation/testing/traits)
- [fatbobman: Mastering Swift Testing](https://fatbobman.com/en/posts/mastering-the-swift-testing-framework/)
