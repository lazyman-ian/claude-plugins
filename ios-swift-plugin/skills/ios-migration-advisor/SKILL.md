---
name: ios-migration-advisor
description: Guides iOS technology migration decisions and provides step-by-step migration paths for modernizing codebases. This skill should be used when evaluating whether to adopt new technologies, planning migration from deprecated APIs, choosing between architectural patterns, or identifying outdated dependencies. Key capabilities include migration risk assessment, step-by-step upgrade paths, and technology selection guidance. Triggers on "migrate", "migration", "upgrade", "modernize", "deprecated", "replace", "adopt SwiftData", "adopt Observable", "adopt Swift Testing", "architecture choice", "技术选型", "迁移", "升级", "过时", "替代方案", "架构选择". Do NOT use for Swift Concurrency migration — use swift-concurrency instead. Do NOT use for SwiftUI code patterns — use swiftui-expert instead. Do NOT use for performance issues — use ios-performance-guide instead.
allowed-tools: [Read, Glob, Grep, mcp__apple-docs__*, mcp__sosumi__*]
memory: project
---

# iOS Migration Advisor

Technology migration decisions and step-by-step modernization paths for iOS 15+ codebases.

## Scope Boundary

| Domain | This Skill | Other Skill |
|--------|-----------|-------------|
| @Observable adoption path | YES | - |
| SwiftData vs Core Data decision | YES | - |
| XCTest → Swift Testing migration | YES | - |
| Architecture pattern selection | YES | - |
| Deprecated library replacement | YES | - |
| async/await migration details | - | swift-concurrency |
| SwiftUI view patterns | - | swiftui-expert |
| Performance diagnostics | - | ios-performance-guide |

## Migration Assessment Workflow

1. **Scan** — Identify deprecated APIs, outdated libraries, legacy patterns in the codebase
2. **Assess** — Evaluate risk, effort, and benefit for each migration
3. **Prioritize** — Rank by: breaking risk (low first) → user impact (high first) → effort (low first)
4. **Plan** — Step-by-step migration path with rollback strategy
5. **Execute** — Incremental migration, verify at each step

## Quick Decision Tree

| Migration Need | Reference |
|---------------|-----------|
| ObservableObject → @Observable | `references/observable-migration.md` |
| Core Data → SwiftData (or coexistence) | `references/swiftdata-adoption.md` |
| XCTest → Swift Testing | `references/testing-migration.md` |
| Choosing app architecture (MVVM/TCA/Clean) | `references/architecture-selection.md` |
| Replacing outdated libraries/patterns | `references/deprecated-ecosystem.md` |

## Ecosystem Quick Reference

### Libraries: Outdated → Modern

| Outdated | Replacement | Notes |
|----------|------------|-------|
| AFNetworking | URLSession async / Alamofire | Native async/await sufficient for most |
| Masonry (ObjC) | SnapKit / SwiftUI | SwiftUI preferred for new screens |
| SDWebImage | Kingfisher / AsyncImage | AsyncImage for simple cases (iOS 15+) |
| FMDB | GRDB.swift / SwiftData | SwiftData for iOS 17+ |
| JSONModel / MJExtension | Codable | Native since Swift 4 |
| ReactiveCocoa (ObjC) | Combine / AsyncSequence | Combine = transition, AsyncSequence = future |
| RxSwift | Combine / @Observable + AsyncSequence | Gradual migration viable |
| Carthage | SPM | SPM is now standard |
| CocoaPods | SPM (when possible) | Some pods still need CocoaPods |

### Patterns: Legacy → Modern

| Legacy | Modern | Min iOS |
|--------|--------|---------|
| KVO (addObserver:forKeyPath:) | Combine publisher(for:) / @Observable | 13 / 17 |
| NSNotificationCenter (selector) | Combine / .onReceive in SwiftUI | 13 / 15 |
| Delegate + protocol (heavy) | Closure / AsyncStream | 15 |
| Singleton everywhere | @Environment / DI | 15 |
| Storyboard segues | NavigationStack + Coordinator | 16 |
| UIKit programmatic layout | SwiftUI (new screens) | 15 |
| Core Data | SwiftData (new models) | 17 |
| XCTest | Swift Testing (new tests) | Xcode 16 |
| ObservableObject | @Observable | 17 |
| NavigationView | NavigationStack | 16 |

### Tools: Legacy → Modern

| Legacy | Modern |
|--------|--------|
| Carthage | SPM |
| OCLint | SwiftLint + SwiftFormat |
| R.swift | Xcode Asset Catalog + ImageResource (iOS 16+) |
| Sourcery (some uses) | Swift Macros (5.9+) |
| xcconfig manual | XcodeGen / Tuist |

## Architecture Selection (Quick Guide)

| Project Size | Team | Recommended | Why |
|-------------|------|-------------|-----|
| Small (1-3 devs) | Solo/pair | SwiftUI + @Observable directly | Minimal boilerplate |
| Medium (3-8 devs) | Small team | MVVM variant + SPM modules | Testable, familiar |
| Large (8+ devs) | Multiple teams | Clean Architecture or TCA | Scalable, enforced boundaries |
| Existing UIKit | Migrating | Hybrid UIKit + SwiftUI per screen | Incremental, low risk |

→ See `references/architecture-selection.md` for detailed decision trees.

## Migration Priority Framework

Rate each potential migration:

| Factor | Score |
|--------|-------|
| **Breaking risk** | Low=3, Medium=2, High=1 |
| **User impact** | High=3, Medium=2, Low=1 |
| **Developer velocity gain** | High=3, Medium=2, Low=1 |
| **Effort** | Low=3, Medium=2, High=1 |

**Total 9+** → Migrate now. **6-8** → Plan for next cycle. **<6** → Defer.

## References

| Category | File |
|----------|------|
| @Observable | `references/observable-migration.md` |
| SwiftData | `references/swiftdata-adoption.md` |
| Testing | `references/testing-migration.md` |
| Architecture | `references/architecture-selection.md` |
| Ecosystem | `references/deprecated-ecosystem.md` |

For topics not covered above, search authoritative iOS blogs listed in the plugin CLAUDE.md.
