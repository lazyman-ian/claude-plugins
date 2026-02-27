# Swift 6 Migration Checklist

Step-by-step process for migrating a Swift 5 codebase to Swift 6 language mode.

## Pre-Migration Audit

Before starting, verify these prerequisites:

| Check | How | Required |
|-------|-----|----------|
| Xcode version | Xcode 16+ | Yes |
| Swift toolchain | `swift --version` >= 6.0 | Yes |
| Dependencies updated | Check SPM/CocoaPods for Swift 6 support | Yes |
| CI runs warnings | `-warnings-as-errors` not enabled yet | Recommended |
| Baseline tests pass | `cmd+U` or `swift test` | Yes |

### Dependency Audit

```bash
# Check which dependencies declare Sendable conformance
# In Package.resolved or Podfile.lock, review each dependency's changelog
```

Dependencies without Sendable support need `@preconcurrency import` (see `preconcurrency-strategies.md`).

## Step 1: Enable Targeted Concurrency Checking

### Xcode

Build Settings > Swift Compiler - Upcoming Features:
- Set `SWIFT_STRICT_CONCURRENCY` to `targeted`

### SwiftPM

```swift
// Package.swift
.target(
    name: "MyTarget",
    swiftSettings: [
        .enableExperimentalFeature("StrictConcurrency=targeted")
    ]
)
```

### What `targeted` Checks

- Explicit Sendable conformances are enforced
- `@Sendable` closures are checked
- Global variables accessed from multiple isolation domains
- Does NOT check implicit Sendable or protocol conformance

## Step 2: Fix Warnings Module by Module

### Module Order

Fix in **bottom-up dependency order** — leaf modules first:

```
Networking (leaf)     → fix first
  ↑
Domain (depends on Networking) → fix second
  ↑
App (depends on Domain)        → fix last
```

### Per-Warning Fix Patterns

#### "Non-Sendable type 'X' captured in @Sendable closure"

```swift
// Before: warning
let formatter = DateFormatter()
Task {
    let str = formatter.string(from: Date()) // captured non-Sendable
}

// Fix A: Make Sendable (if you own the type)
struct DateFormat: Sendable {
    func string(from date: Date) -> String { /* ... */ }
}

// Fix B: Copy before capture
let result = formatter.string(from: Date())
Task {
    process(result) // String is Sendable
}

// Fix C: Actor isolation
@MainActor func format() {
    let str = formatter.string(from: Date())
    Task { @MainActor in process(str) }
}
```

#### "Mutable property 'X' is not concurrency-safe"

```swift
// Before: warning
class Cache {
    var items: [String: Data] = [:] // mutable, not isolated
}

// Fix A: Actor
actor Cache {
    var items: [String: Data] = [:]
}

// Fix B: Mutex (synchronous access needed)
import Synchronization
struct Cache: @unchecked Sendable {
    private let items = Mutex<[String: Data]>([:])
    func get(_ key: String) -> Data? {
        items.withLock { $0[key] }
    }
}
```

#### "Global variable is not concurrency-safe"

```swift
// Before: warning
var globalConfig = Config()

// Fix A: @MainActor (if UI-related)
@MainActor var globalConfig = Config()

// Fix B: Constant
let globalConfig = Config() // if truly immutable

// Fix C: nonisolated(unsafe) (last resort, requires manual safety proof)
nonisolated(unsafe) var globalConfig = Config()
```

#### "Call to main actor-isolated function from nonisolated context"

```swift
// Before: warning
func updateUI() {
    label.text = "Done" // label is @MainActor
}

// Fix A: Mark caller @MainActor
@MainActor func updateUI() {
    label.text = "Done"
}

// Fix B: Use await
func updateUI() async {
    await MainActor.run { label.text = "Done" }
}
```

#### "Sending value of non-Sendable type risks data race"

```swift
// Before: warning
let viewModel = ViewModel()
Task {
    await viewModel.load() // sending non-Sendable across boundary
}

// Fix: Transfer ownership (don't use after sending)
let viewModel = ViewModel()
Task {
    await viewModel.load()
}
// Don't access viewModel here after sending to Task
```

## Step 3: Upgrade to Complete Checking

Once all `targeted` warnings are resolved:

```swift
// Package.swift
.enableExperimentalFeature("StrictConcurrency=complete")
```

Or in Xcode: `SWIFT_STRICT_CONCURRENCY = complete`

### Additional Checks in `complete`

- All types crossing isolation boundaries must be Sendable
- Protocol conformances checked for Sendable
- Implicit Sendable inference enforced
- Global and static variables fully checked

Expect a new wave of warnings. Fix using the same patterns above.

## Step 4: Enable Swift 6 Language Mode

Once all `complete` warnings are resolved:

### Xcode

Build Settings > Swift Language Version: **Swift 6**

### SwiftPM

```swift
// Package.swift — top level
// swift-tools-version: 6.0

// Or per-target:
.target(
    name: "MyTarget",
    swiftSettings: [
        .swiftLanguageMode(.v6)
    ]
)
```

### What Changes

- All concurrency warnings become **errors**
- `Sendable` checking is mandatory
- Default isolation rules apply (nonisolated by default, or `@MainActor` if configured)
- No behavioral change at runtime — same code, stricter compiler

## Rollback Strategy

Each step is independently revertible:

| Step | Rollback |
|------|----------|
| targeted → off | Remove `StrictConcurrency` setting |
| complete → targeted | Change `complete` to `targeted` |
| Swift 6 → Swift 5 | Change `SWIFT_VERSION` back to `5` |

Keep the Sendable conformances and actor changes even when rolling back — they are safe under Swift 5.

## CI Integration

### Progressive Adoption in CI

```yaml
# Phase 1: Warnings only (don't break CI)
- name: Build with concurrency warnings
  run: swift build 2>&1 | tee build.log
  # Count warnings for tracking
  - grep -c "concurrency" build.log || true

# Phase 2: Warnings as errors for resolved modules
- name: Strict modules
  run: swift build -Xswiftc -strict-concurrency=complete -Xswiftc -target MyResolvedModule
```

### Tracking Progress

Track warning count per module over time:

```bash
# Count concurrency warnings per module
swift build 2>&1 | grep "warning:.*concurrency\|warning:.*Sendable" | \
    /usr/bin/sed 's/.*\/Sources\/\([^/]*\)\/.*/\1/' | sort | uniq -c | sort -rn
```

## Third-Party Dependency Compatibility

| Status | Action |
|--------|--------|
| Ships Sendable conformance | Use directly |
| No Sendable but maintained | `@preconcurrency import`, file issue |
| Unmaintained | `@preconcurrency import` + plan replacement |
| Blocks migration | Pin version, wrap in actor/Mutex |

Check the Swift Package Index for Swift 6 readiness: https://swiftpackageindex.com
