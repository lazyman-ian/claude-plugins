# Async Toolkit Patterns

10 essential Swift Concurrency tools beyond basic async/await. Source: Emerge Tools blog series.

## 1. withCheckedContinuation / withCheckedThrowingContinuation

Bridge callback-based APIs to async/await.

```swift
func fetchUser(id: String) async throws -> User {
    try await withCheckedThrowingContinuation { continuation in
        legacyAPI.fetchUser(id: id) { result in
            switch result {
            case .success(let user):
                continuation.resume(returning: user)
            case .failure(let error):
                continuation.resume(throwing: error)
            }
        }
    }
}
```

**Pitfall:** Continuation MUST be resumed exactly once. Resuming zero times = hang. Resuming twice = crash.

## 2. withTaskCancellationHandler

React to task cancellation while waiting on non-async work.

```swift
func download(url: URL) async throws -> Data {
    let session = URLSession.shared
    let request = URLRequest(url: url)

    return try await withTaskCancellationHandler {
        try await session.data(for: request).0
    } onCancel: {
        // Called on ANY thread when parent task is cancelled
        session.invalidateAndCancel()
    }
}
```

**Key:** `onCancel` runs concurrently with the operation — use thread-safe cleanup only.

## 3. TaskGroup / ThrowingTaskGroup

Fan-out pattern for parallel work with structured concurrency.

```swift
func fetchAllUsers(ids: [String]) async throws -> [User] {
    try await withThrowingTaskGroup(of: User.self) { group in
        for id in ids {
            group.addTask { try await api.fetchUser(id: id) }
        }

        var users: [User] = []
        for try await user in group {
            users.append(user)
        }
        return users
    }
}
```

**Error propagation:** First thrown error cancels all remaining child tasks automatically.

**Limit concurrency:** Use a semaphore pattern to avoid task explosion:

```swift
try await withThrowingTaskGroup(of: Void.self) { group in
    let maxConcurrent = 5
    for (index, item) in items.enumerated() {
        if index >= maxConcurrent {
            try await group.next()  // Wait for one to finish
        }
        group.addTask { try await process(item) }
    }
    try await group.waitForAll()
}
```

## 4. AsyncStream / AsyncThrowingStream

Convert push-based events into pull-based async sequences.

```swift
func locationUpdates() -> AsyncStream<CLLocation> {
    AsyncStream { continuation in
        let delegate = LocationDelegate { location in
            continuation.yield(location)
        }

        continuation.onTermination = { _ in
            delegate.stop()  // Cleanup resources
        }

        delegate.start()
    }
}

// Usage
for await location in locationUpdates() {
    updateMap(location)
}
```

**Always set `onTermination`** to avoid resource leaks.

## 5. async let

Structured concurrent binding — simpler than TaskGroup for fixed-count parallelism.

```swift
func loadDashboard() async throws -> Dashboard {
    async let profile = api.fetchProfile()
    async let stats = api.fetchStats()
    async let notifications = api.fetchNotifications()

    return try await Dashboard(
        profile: profile,
        stats: stats,
        notifications: notifications
    )
}
```

**Key difference from TaskGroup:** Number of tasks is known at compile time. All tasks cancelled if any throws.

## 6. Clock and Duration

Type-safe timing for delays, timeouts, and testing.

```swift
// Production code uses ContinuousClock
try await ContinuousClock().sleep(for: .seconds(1))

// Testable: inject clock protocol
func poll<C: Clock>(every interval: Duration, clock: C = ContinuousClock()) async throws
    where C.Duration == Duration
{
    while !Task.isCancelled {
        try await fetchLatest()
        try await clock.sleep(for: interval)
    }
}

// Test with instant clock (no actual waiting)
let testClock = TestClock()  // from swift-clocks
try await poll(every: .seconds(5), clock: testClock)
testClock.advance(by: .seconds(5))  // Instant
```

## 7. Task.isCancelled / Task.checkCancellation

Cooperative cancellation checks for long-running work.

```swift
func processLargeDataset(_ items: [Item]) async throws -> [Result] {
    var results: [Result] = []
    for item in items {
        try Task.checkCancellation()  // Throws if cancelled
        results.append(process(item))
    }
    return results
}

// Or non-throwing check
func processWithCleanup(_ items: [Item]) async -> [Result] {
    var results: [Result] = []
    for item in items {
        if Task.isCancelled { break }  // Graceful exit
        results.append(process(item))
    }
    return results
}
```

## 8. withTaskGroup + Dictionary Collect

Pattern for collecting keyed results from parallel tasks.

```swift
func fetchMetadata(for urls: [URL]) async -> [URL: Metadata] {
    await withTaskGroup(of: (URL, Metadata?).self) { group in
        for url in urls {
            group.addTask { (url, try? await fetch(url)) }
        }

        var results: [URL: Metadata] = [:]
        for await (url, metadata) in group {
            results[url] = metadata
        }
        return results
    }
}
```

## 9. AsyncSequence Operators

Transform async sequences like Combine publishers.

```swift
// Filter + Map
for await location in locationStream
    .filter { $0.horizontalAccuracy < 50 }
    .map { Coordinate(lat: $0.latitude, lng: $0.longitude) }
{
    updateMap(location)
}

// Debounce (from AsyncAlgorithms)
import AsyncAlgorithms

for await text in searchField.values.debounce(for: .milliseconds(300)) {
    await search(text)
}
```

## 10. Sendable and @Sendable Closures

Ensure data safety when crossing concurrency boundaries.

```swift
// Mark types crossing boundaries as Sendable
struct UserDTO: Sendable {
    let id: String
    let name: String
}

// Closure crossing to another task must be @Sendable
func onBackground(_ work: @Sendable @escaping () async -> Void) {
    Task.detached { await work() }
}
```

**Key rule:** If a type crosses an isolation boundary (actor → actor, task → task), it must be `Sendable`.

## Quick Reference

| Tool | Use Case | Concurrency |
|------|----------|-------------|
| `async let` | Fixed parallel tasks (2-5) | Structured |
| `TaskGroup` | Dynamic parallel tasks (N) | Structured |
| `AsyncStream` | Event → async sequence bridge | Unstructured source |
| `withCheckedContinuation` | Callback → async bridge | One-shot |
| `withTaskCancellationHandler` | Cleanup on cancel | Cooperative |
| `Clock.sleep` | Testable delays | Structured |
| `Task.checkCancellation` | Long-running loop exit | Cooperative |

## Sources

- [Emerge Tools: The Async/Await Toolkit](https://www.emergetools.com/blog/posts/swift-async-await-toolkit)
- [Apple: Swift Concurrency](https://developer.apple.com/documentation/swift/concurrency)
- [swift-async-algorithms](https://github.com/apple/swift-async-algorithms)
