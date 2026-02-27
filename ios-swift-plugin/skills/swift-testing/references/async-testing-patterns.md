# Async Testing Patterns

Patterns for testing async code with Swift Testing.

## Async @Test Functions

```swift
@Test func fetchUser() async throws {
    let user = try await UserService().fetch(id: "123")
    #expect(user.name == "Alice")
}
```

No special setup. Mark the function `async` and `await` as usual.

## Actor Isolation in Tests

```swift
// @MainActor — mark test when SUT is MainActor-isolated
@Test @MainActor
func viewModelUpdates() async {
    let vm = ViewModel()
    await vm.loadData()
    #expect(vm.items.count > 0)
}

// Custom actor — just await actor-isolated calls
@Test func actorState() async {
    let cache = DataCache()
    await cache.set("key", value: "value")
    #expect(await cache.get("key") == "value")
}
```

## Confirmation (Replacing XCTestExpectation)

```swift
// Basic — waits until confirm() is called
@Test func delegateCallback() async {
    await confirmation { confirm in
        manager.onComplete = { _ in confirm() }
        await manager.download(url)
    }
}

// Multiple — expects exactly N calls
@Test func batchProcessing() async {
    await confirmation(expectedCount: 3) { confirm in
        processor.onItemProcessed = { _ in confirm() }
        await processor.process(items: ["a", "b", "c"])
    }
}

// Zero — fails if confirm() IS called
@Test func noUnexpectedCalls() async {
    await confirmation(expectedCount: 0) { confirm in
        handler.onError = { _ in confirm() }
        await handler.processValid(event)
    }
}
```

| Pattern | Use When |
|---------|----------|
| `confirmation` | Testing callbacks, delegates, notifications |
| `withCheckedContinuation` | Bridging callback-based API to async |

## Testing Streams and AsyncSequence

```swift
// Collect all values
@Test func streamEmitsValues() async {
    var collected: [Int] = []
    for await value in NumberGenerator.stream(count: 3) {
        collected.append(value)
    }
    #expect(collected == [1, 2, 3])
}

// Prefix for infinite streams
@Test func streamPrefix() async {
    var values: [Int] = []
    for await value in InfiniteCounter.stream().prefix(5) {
        values.append(value)
    }
    #expect(values.count == 5)
}
```

## Timeout Patterns

```swift
@Test(.timeLimit(.seconds(5)))
func networkRequest() async throws {
    let data = try await client.fetch(url)
    #expect(!data.isEmpty)
}

// Suite-level — inherited by all tests, overridable
@Suite(.timeLimit(.minutes(1)))
struct IntegrationTests {
    @Test func apiCall() async throws { ... }
    @Test(.timeLimit(.seconds(5))) func quickCheck() async throws { ... }
}
```

## Cancellation Testing

```swift
// Verify cancellation throws
@Test func cancellationStopsWork() async {
    let task = Task { try await DataProcessor().processLargeDataset() }
    task.cancel()
    await #expect(throws: CancellationError.self) {
        try await task.value
    }
}

// Verify cleanup after cancellation
@Test func cancellationCleansUp() async {
    let resource = ManagedResource()
    let task = Task { try await resource.performWork() }
    task.cancel()
    _ = try? await task.value
    #expect(resource.isCleanedUp)
}
```

## Deterministic Testing with swift-concurrency-extras

For observing intermediate states, use [swift-concurrency-extras](https://github.com/pointfreeco/swift-concurrency-extras):

```swift
import ConcurrencyExtras

@Test @MainActor
func loadingState() async throws {
    try await withMainSerialExecutor {
        let vm = ViewModel()
        let task = Task { try await vm.load() }
        await Task.yield()
        #expect(vm.isLoading == true)   // Intermediate state observable
        try await task.value
        #expect(vm.isLoading == false)
    }
}
```

Requirements:
- `@Suite(.serialized)` when using main serial executor
- `await Task.yield()` to advance execution step by step

## Memory and Retain Cycle Testing

```swift
@Test func viewModelDeallocates() async {
    var vm: ViewModel? = ViewModel()
    weak var weakVM = vm
    await vm?.startWork()
    vm = nil
    #expect(weakVM == nil)
}
```

## Common Mistakes

| Mistake | Symptom | Fix |
|---------|---------|-----|
| Missing `await` in confirmation | Confirmation never fires | `await` async work inside block |
| No `@MainActor` on test | Actor isolation error | Add `@MainActor` when testing MainActor types |
| `Task.sleep` for timing | Flaky on CI | Use `confirmation` or `withMainSerialExecutor` |
| Not cancelling tasks | Test hangs | Cancel tasks or use `.timeLimit` |
| Async cleanup in `deinit` | Compiler error | Use custom trait with `TestScoping` |

## Sources

- [Apple: Testing in Xcode (WWDC24)](https://developer.apple.com/videos/play/wwdc2024/10179)
- [Swift Concurrency Extras](https://github.com/pointfreeco/swift-concurrency-extras)
- [Donny Wals: Testing async code](https://www.donnywals.com/testing-your-async-await-code/)
