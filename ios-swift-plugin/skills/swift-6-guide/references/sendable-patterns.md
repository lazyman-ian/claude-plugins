# Sendable Patterns

Practical patterns for conforming types to `Sendable` in Swift 6 strict concurrency.

## Value Types: Automatic Conformance

Structs and enums automatically conform to `Sendable` when all stored properties are Sendable:

```swift
// Auto-Sendable: all properties are Sendable (String, Int, Bool)
struct UserProfile {
    let name: String
    let age: Int
    var isActive: Bool
}

// NOT auto-Sendable: UIImage is not Sendable
struct Avatar {
    let image: UIImage // blocks auto-conformance
}
```

### Fixing Non-Sendable Value Types

```swift
// Option A: Replace non-Sendable property with Sendable equivalent
struct Avatar: Sendable {
    let imageData: Data // Data is Sendable
}

// Option B: @unchecked Sendable with safety invariant
struct Avatar: @unchecked Sendable {
    // SAFETY: UIImage is immutable after initialization.
    // This instance is created once and never mutated.
    let image: UIImage
}
```

## Reference Types: Manual Conformance

Classes require explicit conformance and must meet strict requirements:

### Immutable Class (Safe)

```swift
// All stored properties must be `let` and Sendable
final class Endpoint: Sendable {
    let url: URL
    let method: String
    let headers: [String: String]

    init(url: URL, method: String, headers: [String: String]) {
        self.url = url
        self.method = method
        self.headers = headers
    }
}
```

Requirements:
- `final` class (no subclassing)
- All stored properties are `let`
- All stored property types are Sendable

### Mutable Class with Mutex

```swift
import Synchronization

final class Counter: @unchecked Sendable {
    // SAFETY: All access to `state` is protected by Mutex.
    private let state = Mutex<Int>(0)

    var value: Int {
        state.withLock { $0 }
    }

    func increment() {
        state.withLock { $0 += 1 }
    }
}
```

### Actor (Preferred for Complex State)

```swift
actor ImageCache {
    private var cache: [URL: Data] = [:]

    func get(_ url: URL) -> Data? { cache[url] }
    func set(_ url: URL, data: Data) { cache[url] = data }
}
```

## @unchecked Sendable

Tells the compiler to trust your safety claim without verification.

### When to Use

| Situation | Appropriate |
|-----------|------------|
| Wrapping thread-safe C/ObjC type | Yes |
| Mutex/lock-protected mutable state | Yes |
| Immutable class with non-Sendable stored property (e.g., UIImage) | Yes, with `let` |
| Avoiding effort to make type properly Sendable | No |
| Silencing warnings without analysis | No |

### Required Safety Invariant

Always document WHY `@unchecked Sendable` is safe:

```swift
// SAFETY: All mutable state is protected by `lock`.
// `lock` itself is thread-safe (os_unfair_lock wrapper).
final class ThreadSafeArray<Element>: @unchecked Sendable {
    private let lock = NSLock()
    private var storage: [Element] = []

    func append(_ element: Element) {
        lock.lock()
        defer { lock.unlock() }
        storage.append(element)
    }
}
```

## @Sendable Closures

Mark closure parameters as `@Sendable` when they cross isolation boundaries:

```swift
func performAsync(_ work: @Sendable () async -> Void) {
    Task { await work() }
}

// Compiler checks that captured values are Sendable
let name = "test" // String is Sendable
performAsync {
    print(name) // OK
}

let formatter = DateFormatter() // NOT Sendable
performAsync {
    formatter.string(from: Date()) // ERROR: captured non-Sendable
}
```

### @Sendable in Protocol Requirements

```swift
protocol EventHandler {
    func handle(_ event: Event, completion: @Sendable (Result<Void, Error>) -> Void)
}
```

## Conditional Sendable Conformance

Generics can conditionally conform to Sendable:

```swift
struct Box<T> {
    let value: T
}

// Sendable only when T is Sendable
extension Box: Sendable where T: Sendable {}

// Usage
let intBox = Box(value: 42)           // Sendable (Int is Sendable)
let fmtBox = Box(value: DateFormatter()) // NOT Sendable
```

### Protocol + Sendable

```swift
protocol Repository: Sendable {
    associatedtype Item: Sendable
    func fetch(id: String) async throws -> Item
}

// Conforming type must also be Sendable
final class UserRepository: Repository {
    // Must be Sendable — all properties immutable or actor-isolated
    let client: HTTPClient // HTTPClient must be Sendable

    func fetch(id: String) async throws -> User { /* ... */ }
}
```

## Global Variables

Global and static variables must be concurrency-safe in Swift 6:

| Pattern | When to Use |
|---------|------------|
| `let constant = Value()` | Truly immutable, Sendable type |
| `@MainActor var state = ...` | UI-related global state |
| `nonisolated(unsafe) var legacy = ...` | Legacy code, manual safety guarantee |
| Actor-isolated static | Shared mutable state |

```swift
// Constant (preferred)
let defaultTimeout: TimeInterval = 30

// MainActor-isolated
@MainActor var currentTheme = Theme.light

// Actor-isolated static
actor AppState {
    static let shared = AppState()
    private var config: Config = .default
}

// nonisolated(unsafe) — last resort
// SAFETY: Set once during app launch, read-only after.
nonisolated(unsafe) var appConfig: Config!
```

## Common Patterns Summary

| Type | Pattern | Safety |
|------|---------|--------|
| Value type, all Sendable properties | Automatic | Compiler-verified |
| Value type, non-Sendable property | `@unchecked Sendable` + comment | Manual |
| Immutable `final class` | Explicit `Sendable` | Compiler-verified |
| Mutable class | `Mutex` + `@unchecked Sendable` | Manual |
| Complex mutable state | `actor` | Compiler-verified |
| Closure parameter | `@Sendable` annotation | Compiler-verified |
| Generic container | Conditional conformance | Compiler-verified |
| Global variable | `let`, `@MainActor`, or actor | Depends on choice |
