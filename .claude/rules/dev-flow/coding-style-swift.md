---
paths:
  - "**/*.swift"
---

# Swift Coding Style

## Basics
- guard-let for early return, if-let for conditional binding
- Use trailing closure syntax for single-closure parameters
- Prefer value types (struct) over reference types (class) when possible
- Mark classes as final by default
- Use access control explicitly (private, internal, public)

## Concurrency
- Prefer @MainActor over DispatchQueue.main
- Use async/await over completion handlers for new code
- Prefer Mutex/Atomic (Synchronization library) over NSLock/os_unfair_lock for new code
- Use typed throws `throws(ErrorType)` when error type is known and finite

## Swift 6
- Enable strict concurrency checking progressively: targeted → complete → Swift 6 mode
- Prefer `@Observable` over `ObservableObject` (iOS 17+)
- Use `foregroundStyle()` not `foregroundColor()`, `clipShape(.rect(cornerRadius:))` not `cornerRadius()`
- Mark global variables as `@MainActor`, actor-isolated, or `let` constant — avoid `nonisolated(unsafe)`
- Use `@preconcurrency import` temporarily for non-updated dependencies, track removal
