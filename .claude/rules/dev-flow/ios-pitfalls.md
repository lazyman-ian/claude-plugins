---
paths:
  - "**/*.swift"
  - "**/Sources/**"
---

# iOS Development Pitfalls

Common iOS/Swift pitfalls detected from project history.

## Concurrency
- @MainActor should not be applied to protocols — use on conforming types instead
- `Task { await ... }` in viewDidLoad creates unstructured concurrency — use task groups or .task modifier
- Avoid `DispatchQueue.main.async` in SwiftUI — use @MainActor instead

## Swift 6
- `@unchecked Sendable` requires documented safety invariant — don't use as a silencer
- Sendable conformance on class requires all stored properties to be immutable or synchronized
- `nonisolated(unsafe)` is almost always wrong — use Mutex or actor instead
- Typed throws: don't over-specify — use `throws(MyError)` only when callers benefit from exhaustive catch

## SwiftUI
- ForEach requires stable Identifiable IDs — UUID() in init causes infinite re-renders
- NavigationStack path binding must be @State, not computed
- .sheet(isPresented:) captures stale state — prefer .sheet(item:)

## Swift Testing
- Never mix XCTest assertions (XCTAssert*) and Swift Testing (#expect) in same type
- @Suite should use struct, not class — class prevents parallel test execution
- Use `confirmation {}` not XCTestExpectation in Swift Testing async tests
- setUp()/tearDown() don't work in @Suite — use init/deinit instead

## UIKit
- guard-let preferred over if-let for early return pattern
- viewDidLoad runs once — don't put recurring setup here
- Retain cycles in closures: use [weak self] with completion handlers

## Build & Config
- SwiftFormat and SwiftLint configs may conflict — run SwiftLint after SwiftFormat
- Xcode build cache invalidation: clean DerivedData when switching branches with scheme changes
- xcconfig: always include `$(inherited)` in FRAMEWORK_SEARCH_PATHS, OTHER_LDFLAGS, etc.
- xcconfig: `#include` paths are relative to the file, not the project root
- Info.plist: privacy keys (NSCameraUsageDescription etc.) must have non-empty description strings
