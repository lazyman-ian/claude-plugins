# Synchronization Library

Swift's `Synchronization` module (SE-0433) provides low-level concurrency primitives: `Mutex` and `Atomic`.

```swift
import Synchronization
```

Available in Swift 6.0+ (Xcode 16+, iOS 18+, macOS 15+).

## Mutex

`Mutex<Value>` protects mutable state with an `os_unfair_lock` under the hood.

### Basic Usage

```swift
let counter = Mutex<Int>(0)

// Read
let current = counter.withLock { $0 }

// Write
counter.withLock { $0 += 1 }

// Read-modify-return
let previous = counter.withLock { value -> Int in
    let old = value
    value += 1
    return old
}
```

### Protecting Complex State

```swift
struct CacheState {
    var items: [String: Data] = [:]
    var hitCount: Int = 0
}

final class Cache: @unchecked Sendable {
    private let state = Mutex<CacheState>(.init())

    func get(_ key: String) -> Data? {
        state.withLock { state in
            state.hitCount += 1
            return state.items[key]
        }
    }

    func set(_ key: String, data: Data) {
        state.withLock { $0.items[key] = data }
    }
}
```

### Thread-Safe Singleton

```swift
final class ServiceLocator: @unchecked Sendable {
    static let shared = ServiceLocator()

    private let registry = Mutex<[String: Any]>([:])

    func register<T>(_ type: T.Type, instance: T) {
        let key = String(describing: type)
        registry.withLock { $0[key] = instance }
    }

    func resolve<T>(_ type: T.Type) -> T? {
        let key = String(describing: type)
        return registry.withLock { $0[key] as? T }
    }
}
```

## Atomic

`Atomic<Value>` provides lock-free atomic operations on simple types conforming to `AtomicRepresentable`.

### Supported Types

Built-in `AtomicRepresentable` types:
- Integer types: `Int`, `UInt`, `Int8`...`Int64`, `UInt8`...`UInt64`
- `Bool`
- `Optional<Wrapped>` where Wrapped is AtomicRepresentable
- Raw-value enums (via `RawRepresentable`)

### Basic Usage

```swift
let counter = Atomic<Int>(0)

// Load
let value = counter.load(ordering: .relaxed)

// Store
counter.store(42, ordering: .relaxed)

// Add
let old = counter.wrappingAdd(1, ordering: .acquiringAndReleasing)

// Compare and exchange
let (exchanged, original) = counter.compareExchange(
    expected: 0,
    desired: 1,
    ordering: .acquiringAndReleasing
)
```

### Atomic Bool Flag

```swift
final class TaskRunner: @unchecked Sendable {
    private let isRunning = Atomic<Bool>(false)

    func start() -> Bool {
        let (exchanged, _) = isRunning.compareExchange(
            expected: false,
            desired: true,
            ordering: .acquiringAndReleasing
        )
        return exchanged // true if we started, false if already running
    }

    func stop() {
        isRunning.store(false, ordering: .releasing)
    }
}
```

### Atomic Enum

```swift
enum ConnectionState: Int, AtomicRepresentable {
    case disconnected = 0
    case connecting = 1
    case connected = 2
}

let state = Atomic<ConnectionState>(.disconnected)
state.store(.connecting, ordering: .sequentiallyConsistent)
```

### Memory Ordering

| Ordering | Use Case | Performance |
|----------|----------|-------------|
| `.relaxed` | Counters, statistics (no ordering guarantee) | Fastest |
| `.acquiring` | Reading shared state (pairs with `.releasing`) | Fast |
| `.releasing` | Publishing shared state (pairs with `.acquiring`) | Fast |
| `.acquiringAndReleasing` | Read-modify-write (most common) | Moderate |
| `.sequentiallyConsistent` | Total ordering across all threads | Slowest |

Rule of thumb: use `.acquiringAndReleasing` for read-modify-write, `.relaxed` for counters where ordering does not matter.

## When to Use Which

| Need | Choice | Why |
|------|--------|-----|
| Simple counter/flag | `Atomic` | Lock-free, minimal overhead |
| Mutable struct/dict | `Mutex` | Groups multiple reads/writes atomically |
| Complex state + async | `actor` | Compiler-enforced isolation, async-compatible |
| Legacy interop | `NSLock` / `DispatchQueue` | Existing code, not worth migrating |

## Performance Comparison

| Primitive | Lock-Free | Contention Behavior | Overhead |
|-----------|-----------|--------------------|---------|
| `Atomic` | Yes | Spin (brief) | Lowest |
| `Mutex` | No (os_unfair_lock) | Block (efficient) | Low |
| `actor` | N/A (task-based) | Suspend + resume | Moderate |
| `NSLock` | No | Block (pthread) | Moderate |
| `DispatchQueue` | No | GCD scheduling | Higher |

## Migration from Legacy Primitives

### From os_unfair_lock

```swift
// Before
private var lock = os_unfair_lock()
private var value: Int = 0

func increment() {
    os_unfair_lock_lock(&lock)
    value += 1
    os_unfair_lock_unlock(&lock)
}

// After
private let value = Mutex<Int>(0)

func increment() {
    value.withLock { $0 += 1 }
}
```

### From NSLock

```swift
// Before
private let lock = NSLock()
private var cache: [String: Data] = [:]

func get(_ key: String) -> Data? {
    lock.lock()
    defer { lock.unlock() }
    return cache[key]
}

// After
private let cache = Mutex<[String: Data]>([:])

func get(_ key: String) -> Data? {
    cache.withLock { $0[key] }
}
```

### From DispatchQueue (sync barrier)

```swift
// Before
private let queue = DispatchQueue(label: "cache", attributes: .concurrent)
private var storage: [String: Data] = [:]

func get(_ key: String) -> Data? {
    queue.sync { storage[key] }
}
func set(_ key: String, data: Data) {
    queue.async(flags: .barrier) { self.storage[key] = data }
}

// After: Mutex (if async not needed)
private let storage = Mutex<[String: Data]>([:])

func get(_ key: String) -> Data? {
    storage.withLock { $0[key] }
}
func set(_ key: String, data: Data) {
    storage.withLock { $0[key] = data }
}

// After: Actor (if async access is acceptable)
actor Storage {
    private var data: [String: Data] = [:]
    func get(_ key: String) -> Data? { data[key] }
    func set(_ key: String, value: Data) { data[key] = value }
}
```
