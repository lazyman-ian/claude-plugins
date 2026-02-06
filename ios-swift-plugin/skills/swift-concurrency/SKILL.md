---
name: swift-concurrency
description: Provides expert guidance on Swift Concurrency patterns, implementation, and issue remediation. This skill should be used when working with async/await, actors, tasks, Sendable conformance, fixing concurrency compiler errors, or migrating to Swift 6. Triggers on "Swift Concurrency", "async/await", "actor", "@MainActor", "Sendable", "data race", "concurrency", "Swift 6", "并发", "线程安全", "异步", "Swift 并发".
memory: project
allowed-tools: [Read, Glob, Grep, Edit, mcp__apple-docs__*]
---

# Swift Concurrency

Expert guidance on Swift Concurrency: async/await, actors, Sendable, and Swift 6 migration.

## Agent Behavior Contract

1. **Check project settings first** - Swift version, strict concurrency level, default actor isolation
2. **Identify isolation boundary** before proposing fixes (`@MainActor`, actor, `nonisolated`)
3. **Don't blanket @MainActor** - Justify why main-actor isolation is correct
4. **Prefer structured concurrency** - Task groups over unstructured tasks
5. **Escape hatches require justification** - `@preconcurrency`, `@unchecked Sendable`, `nonisolated(unsafe)` need safety invariant + follow-up ticket
6. **Minimal blast radius** - Small, reviewable changes for migration

## Quick Decision Tree

| Need | Reference |
|------|-----------|
| **Anti-pattern detection** | `references/concurrency-guard.md` |
| Starting with async code | `references/async-await-basics.md` |
| Parallel operations | `references/tasks.md` |
| Protecting shared state | `references/actors.md` |
| Thread-safe value passing | `references/sendable.md` |
| Streaming data | `references/async-sequences.md` |
| Swift 6 migration | `references/migration.md` |
| Swift 6.2+ fixes | `references/swift-6-2-concurrency.md` |
| Approachable concurrency | `references/approachable-concurrency.md` |
| SwiftUI + concurrency | `references/swiftui-concurrency-tour-wwdc.md` |
| Core Data integration | `references/core-data.md` |
| Performance issues | `references/performance.md` |
| Testing async code | `references/testing.md` |
| Lint warnings | `references/linting.md` |

## Concurrency Guard (Anti-Patterns)

**Compiler cannot catch these** - runtime issues that cause hangs, leaks, or starvation.

| Rule | Block If |
|------|----------|
| CC-CONC-001 | `Task.detached` without justification |
| CC-CONC-002 | `Task {}` in `init()` of VM/Service/Coordinator |
| CC-CONC-003 | Task in `body`, `layoutSubviews`, `updateUIView` |
| CC-CONC-004 | AsyncStream without `onTermination` handler |
| CC-CONC-005 | >3 `Task {}` or >4 `group.addTask` per function |
| CC-CONC-007 | Blocking IO (`Data(contentsOf:)`, `JSONDecoder`) on @MainActor |
| CC-CONC-008 | `.background` priority with `for await` loop |
| CC-CONC-009 | `.task { vm.load() }` direct network call |
| CC-CONC-010 | Auth call outside single choke point |
| CC-CONC-011 | `startWatcher()` in `init()` instead of `bootstrap()` |

→ See `references/concurrency-guard.md` for detection patterns and fixes.

## Triage Common Errors

| Error | Action |
|-------|--------|
| "non-Sendable type risks data races" | Identify isolation boundary → `references/sendable.md` |
| "Main actor-isolated cannot be used from nonisolated" | Decide if truly needs @MainActor → `references/actors.md` |
| "async_without_await" lint | Remove async or narrow suppression → `references/linting.md` |
| XCTest async errors | Use `await fulfillment(of:)` → `references/testing.md` |
| Core Data concurrency warnings | Use DAO pattern → `references/core-data.md` |

## Swift 6.2+ Fix Workflow

1. Capture exact compiler diagnostics
2. Check: Swift version, strict concurrency level, default actor isolation
3. Identify actor context (`@MainActor`, `actor`, `nonisolated`)
4. Apply smallest safe fix:
   - UI-bound types → `@MainActor`
   - Protocol conformance → isolated extension
   - Global state → `@MainActor` or actor
   - Background work → `@concurrent` async function
   - Sendable errors → prefer value types

## Project Settings Discovery

```bash
# SwiftPM
Read Package.swift for:
- .defaultIsolation(MainActor.self)
- .enableUpcomingFeature("NonisolatedNonsendingByDefault")
- .enableExperimentalFeature("StrictConcurrency=targeted")

# Xcode
Grep project.pbxproj for:
- SWIFT_DEFAULT_ACTOR_ISOLATION
- SWIFT_STRICT_CONCURRENCY
- SWIFT_UPCOMING_FEATURE_
```

## Core Patterns

### async/await
```swift
func fetchUser() async throws -> User {
    try await networkClient.get("/user")
}
```

### async let (parallel)
```swift
async let user = fetchUser()
async let posts = fetchPosts()
let profile = try await (user, posts)
```

### Actor
```swift
actor DataCache {
    private var cache: [String: Data] = [:]
    func get(_ key: String) -> Data? { cache[key] }
}
```

### @MainActor
```swift
@MainActor
class ViewModel: ObservableObject {
    @Published var data: String = ""
}
```

## Best Practices

1. **Structured concurrency** - Task groups over unstructured tasks
2. **Minimize suspension points** - Keep actor-isolated sections small
3. **@MainActor judiciously** - Only for truly UI-related code
4. **Handle cancellation** - Check `Task.isCancelled` in long operations
5. **Never block** - No semaphores or locks in async contexts

## References

| Category | Files |
|----------|-------|
| **Guard** | `concurrency-guard.md` (11 anti-pattern rules) |
| **Basics** | `async-await-basics.md`, `tasks.md`, `threading.md` |
| **Safety** | `actors.md`, `sendable.md`, `memory-management.md` |
| **Swift 6** | `migration.md`, `swift-6-2-concurrency.md`, `approachable-concurrency.md` |
| **Advanced** | `async-sequences.md`, `async-algorithms.md`, `performance.md` |
| **Integration** | `core-data.md`, `testing.md`, `linting.md`, `swiftui-concurrency-tour-wwdc.md` |
| **Reference** | `glossary.md` |
