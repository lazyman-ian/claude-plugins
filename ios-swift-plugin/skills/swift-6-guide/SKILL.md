---
name: swift-6-guide
description: Guides Swift 5 to Swift 6 language migration including typed throws, strict concurrency mode, Sendable protocol patterns, and Synchronization library. This skill should be used when enabling Swift 6 language mode, fixing concurrency warnings, adopting typed throws, or using Mutex/Atomic. Triggers on "Swift 6", "typed throws", "strict concurrency", "Sendable", "Swift migration", "@preconcurrency", "language mode", "region-based isolation", "Swift 6 迁移", "严格并发", "类型化抛出", "数据隔离", "Swift迁移". Do NOT use for async/await patterns or actor design — use swift-concurrency instead. Do NOT use for test writing — use swift-testing instead.
memory: project
allowed-tools: [Read, Glob, Grep, Edit, Write, mcp__xcode__*, mcp__apple-docs__*]
---

# Swift 6 Guide

Swift 5 to Swift 6 language migration: typed throws, strict concurrency, Sendable patterns, and Synchronization library.

## Swift 5 to 6 Migration Roadmap

| Step | Build Setting | Goal |
|------|--------------|------|
| 1. Enable warnings | `SWIFT_STRICT_CONCURRENCY = targeted` | Surface concurrency issues in your code |
| 2. Fix warnings | Keep `targeted` | Resolve warnings module by module, bottom-up |
| 3. Strict mode | `SWIFT_STRICT_CONCURRENCY = complete` | Catch all concurrency issues as warnings |
| 4. Swift 6 mode | `SWIFT_VERSION = 6` | Warnings become errors, full enforcement |

Each step is independently shippable. Do not skip to step 4.

> See `references/migration-checklist.md` for the full step-by-step process.

## Typed Throws (SE-0413)

Swift 6 introduces typed throws, allowing functions to declare specific error types.

```swift
enum NetworkError: Error {
    case timeout
    case unauthorized
    case serverError(statusCode: Int)
}

func fetch(url: URL) throws(NetworkError) -> Data {
    let (data, response) = try await URLSession.shared.data(from: url)
    guard let http = response as? HTTPURLResponse else {
        throw .timeout
    }
    switch http.statusCode {
    case 200..<300: return data
    case 401: throw .unauthorized
    default: throw .serverError(statusCode: http.statusCode)
    }
}

// Exhaustive catch — no default needed
do {
    let data = try fetch(url: endpoint)
} catch .timeout {
    retry()
} catch .unauthorized {
    refreshToken()
} catch .serverError(let code) {
    log("Server error: \(code)")
}
```

| Aspect | `throws` (untyped) | `throws(E)` (typed) |
|--------|--------------------|--------------------|
| Catch clause | Requires `catch` / `catch let e as T` | Pattern match directly |
| Exhaustiveness | Compiler cannot check | Compiler enforces all cases |
| API clarity | Caller reads docs | Error type in signature |
| Best for | Public/evolving APIs | Internal/stable error domains |

> See `references/typed-throws-guide.md` for generics, rethrows interaction, and conversion patterns.

## Strict Concurrency Quick Fixes

| Warning | Recommended Fix | Escape Hatch |
|---------|----------------|--------------|
| "non-Sendable type captured" | Make type Sendable or use actor | `@preconcurrency import` |
| "mutable property not Sendable" | Use `let` or actor isolation | `nonisolated(unsafe)` |
| "global var is not concurrency-safe" | `@MainActor` or actor-isolated | `nonisolated(unsafe) let` |
| "call to main actor-isolated from nonisolated" | Add `await`, move to @MainActor | `MainActor.assumeIsolated` |
| "sending value risks data race" | Transfer ownership or copy | `@unchecked Sendable` |
| "protocol does not conform to Sendable" | Add Sendable constraint | `@preconcurrency protocol` |

> See `references/migration-checklist.md` for per-warning fix patterns with code examples.

## Sendable Decision Tree

| Type | Sendable? | Action |
|------|----------|--------|
| `struct` / `enum` (all stored properties Sendable) | Auto | Nothing needed |
| `struct` / `enum` (non-Sendable property) | No | Make property Sendable or use `@unchecked Sendable` |
| Immutable `class` (`let`-only properties, all Sendable) | Manual | Conform to `Sendable` explicitly |
| Mutable `class` | No | Convert to actor, or use `Mutex<State>` + `@unchecked Sendable` |
| `@MainActor class` | Auto | Isolation provides safety |
| Closure | No | Mark parameter `@Sendable` |
| Generic type | Conditional | `extension Container: Sendable where Element: Sendable {}` |

> See `references/sendable-patterns.md` for patterns, global variable strategies, and protocol conformance.

## Synchronization Library

Swift 6 introduces `import Synchronization` for low-level thread-safe primitives.

```swift
import Synchronization

let counter = Atomic<Int>(0)
counter.wrappingAdd(1, ordering: .relaxed)

let cache = Mutex<[String: Data]>([:])
let value = cache.withLock { $0["key"] }
```

| Primitive | Use Case | Async-Safe | Performance |
|-----------|----------|-----------|-------------|
| `Mutex<V>` | Protect mutable state | No (blocking) | Fast (os_unfair_lock) |
| `Atomic<V>` | Counters, flags, simple values | Yes | Fastest |
| `actor` | Complex state + async access | Yes | Moderate (task switching) |
| `DispatchQueue` | Legacy code | No | Moderate |

> See `references/synchronization-library.md` for migration from NSLock/os_unfair_lock and code examples.

## @preconcurrency Strategies

Use `@preconcurrency` to suppress warnings from dependencies that have not adopted Sendable.

```swift
@preconcurrency import ThirdPartyLib
```

| Strategy | When to Use |
|----------|------------|
| `@preconcurrency import` | Third-party module lacks Sendable conformance |
| `@preconcurrency protocol` | Your protocol extended by non-Sendable external types |
| `@preconcurrency conformance` | Existing conformance cannot be updated yet |

Removal timeline: remove `@preconcurrency` once the dependency ships Sendable conformance.

> See `references/preconcurrency-strategies.md` for module-by-module adoption order and compatibility shims.

## Routing

| Situation | Skill |
|-----------|-------|
| async/await patterns, actor design | `swift-concurrency` |
| Swift 6 language mode errors, typed throws, Sendable | This skill |
| Writing tests with Swift Testing | `swift-testing` |
| Deprecated API migration (non-concurrency) | `ios-migration-advisor` |

## References

| Topic | File |
|-------|------|
| Full migration process | `references/migration-checklist.md` |
| Typed throws deep dive | `references/typed-throws-guide.md` |
| Sendable conformance patterns | `references/sendable-patterns.md` |
| Synchronization primitives | `references/synchronization-library.md` |
| @preconcurrency adoption | `references/preconcurrency-strategies.md` |
