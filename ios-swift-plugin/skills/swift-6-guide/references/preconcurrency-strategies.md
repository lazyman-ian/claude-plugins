# @preconcurrency Strategies

Gradual adoption strategies for Swift 6 strict concurrency when working with dependencies that have not yet adopted Sendable.

## @preconcurrency import

Suppress Sendable warnings from an entire module:

```swift
@preconcurrency import UIKit
@preconcurrency import ThirdPartyNetworking

// UIKit types (UIImage, UIColor, etc.) won't trigger Sendable warnings
// ThirdPartyNetworking types won't trigger either
```

### What It Does

| Without @preconcurrency | With @preconcurrency |
|------------------------|---------------------|
| `UIImage` crossing isolation boundary = error | Warning only (or suppressed) |
| Non-Sendable type from module in `@Sendable` closure = error | Suppressed |
| Module's protocol conformances not checked for Sendable | Suppressed |

### What It Does NOT Do

- Does not make types actually Sendable
- Does not prevent real data races at runtime
- Does not affect your own code's Sendable checks

## @preconcurrency Protocol Conformance

When your type conforms to a protocol from a module that lacks Sendable:

```swift
@preconcurrency import AnalyticsKit

// AnalyticsKit.Tracker protocol doesn't require Sendable
// But your conforming type crosses isolation boundaries
class AppTracker: @preconcurrency Tracker {
    // Sendable warnings from Tracker protocol methods suppressed
    func track(event: Event) { /* ... */ }
}
```

## @preconcurrency on Protocol Declarations

When you own a protocol that external non-Sendable types conform to:

```swift
// Your module's protocol
@preconcurrency protocol DataSource {
    func fetchItems() async throws -> [Item]
}

// External non-Sendable type can conform without Sendable errors
// Remove @preconcurrency once all known conformers are Sendable
```

## Module-by-Module Adoption Order

Adopt strict concurrency in **leaf modules first**, adding `@preconcurrency` as needed:

```
Step 1: Leaf modules (no internal dependencies)
  Models/         → make all types Sendable
  Extensions/     → mostly pure functions, easy

Step 2: Service modules
  Networking/     → @preconcurrency import ThirdPartyHTTP
  Storage/        → actor for Core Data / SwiftData

Step 3: Feature modules
  Auth/           → depends on Networking, Storage
  Profile/        → same

Step 4: App target
  App/            → @preconcurrency import FeatureModules (if needed)
```

At each step:
1. Enable `StrictConcurrency=complete` for the module
2. Fix what you can
3. Add `@preconcurrency import` for dependencies not yet migrated
4. Move to the next module

## Marking Your Own APIs as @preconcurrency

If you publish a library and cannot migrate all types to Sendable at once:

```swift
// Allows consumers to use @preconcurrency import YourLib
// to suppress warnings from your not-yet-Sendable types

// Mark specific types
@preconcurrency
public class LegacyNetworkClient { /* ... */ }

// Better: migrate to Sendable and remove @preconcurrency
public final class NetworkClient: Sendable { /* ... */ }
```

## Removal Timeline

Track `@preconcurrency` annotations as technical debt:

| Dependency | @preconcurrency Added | Remove When |
|------------|----------------------|-------------|
| `UIKit` | Always needed | Apple adds Sendable (partial in iOS 18) |
| `ThirdPartyLib` | v2.0 migration | Lib releases Swift 6 support |
| Internal `OldModule` | Sprint 12 | Module migrated to complete concurrency |

### Tracking Script

```bash
# Count @preconcurrency usage across codebase
grep -rn "@preconcurrency" --include="*.swift" Sources/ | \
    /usr/bin/sed 's/:.*@preconcurrency import \(.*\)/: \1/' | \
    sort | uniq -c | sort -rn
```

## Compatibility Shims for Mixed Swift 5/6

When a module must compile under both Swift 5 and Swift 6:

### Compiler Version Check

```swift
#if compiler(>=6.0)
// Swift 6: full Sendable conformance
extension MyType: Sendable {}
#else
// Swift 5: no-op, Sendable not enforced
#endif
```

### Feature Flag Check

```swift
#if hasFeature(StrictConcurrency)
// Strict concurrency enabled
@preconcurrency import LegacyModule
#else
import LegacyModule
#endif
```

### Dual-Mode Protocol

```swift
#if compiler(>=6.0)
public protocol ThreadSafeCache: Sendable {
    func get(_ key: String) -> Data?
}
#else
public protocol ThreadSafeCache {
    func get(_ key: String) -> Data?
}
#endif
```

## Common Pitfalls

| Pitfall | Fix |
|---------|-----|
| `@preconcurrency import` on your own module | Fix your module's types instead |
| Using @preconcurrency to silence all warnings | Only for external dependencies you cannot modify |
| Forgetting to remove after dependency updates | Track in a list, review each release |
| @preconcurrency on Foundation/Swift stdlib | Usually not needed — stdlib types are Sendable |
| Mixing @preconcurrency levels in same target | One import statement per module, consistent across files |

## Decision Flowchart

```
Warning from external dependency type?
├── Yes → Can you modify the dependency?
│   ├── Yes → Make it Sendable, submit PR
│   └── No → @preconcurrency import
└── No → Warning from your own code
    ├── Can make type Sendable? → Do it
    ├── Need actor isolation? → Use actor
    └── Temporary? → @unchecked Sendable + safety comment + TODO
```
