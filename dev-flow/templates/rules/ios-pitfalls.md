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

## SwiftUI
- ForEach requires stable Identifiable IDs — UUID() in init causes infinite re-renders
- NavigationStack path binding must be @State, not computed
- .sheet(isPresented:) captures stale state — prefer .sheet(item:)

## UIKit
- guard-let preferred over if-let for early return pattern
- viewDidLoad runs once — don't put recurring setup here
- Retain cycles in closures: use [weak self] with completion handlers

## Build
- SwiftFormat and SwiftLint configs may conflict — run SwiftLint after SwiftFormat
- Xcode build cache invalidation: clean DerivedData when switching branches with scheme changes
