# Deprecated Ecosystem Guide

Outdated → Modern replacements for iOS 15+ codebases.

## Libraries: Outdated → Modern

### Fully Obsolete (Remove)

| Library | Era | Replacement | Notes |
|---------|-----|-------------|-------|
| AFNetworking | ObjC | URLSession async/await | Native since iOS 15 |
| Masonry | ObjC Auto Layout | SnapKit / SwiftUI | SwiftUI for new screens |
| SDWebImage | ObjC image loading | Kingfisher / AsyncImage | AsyncImage for simple cases (iOS 15+) |
| FMDB | ObjC SQLite | GRDB.swift / SwiftData | SwiftData for iOS 17+ |
| JSONModel / MJExtension | ObjC JSON | Codable | Native since Swift 4 |
| ReactiveCocoa (ObjC) | ObjC Rx | Combine / AsyncSequence | Both native |
| MBProgressHUD | ObjC indicator | SwiftUI overlay / ProgressView | Native |
| IQKeyboardManager | ObjC keyboard | `.scrollDismissesKeyboard` / keyboard avoidance | SwiftUI built-in (iOS 15+) |
| FDStackView | Backport UIStackView | UIStackView (native since iOS 9) | Completely unnecessary |

### Transitioning (Migrate When Convenient)

| Library | Replacement | Migration Path |
|---------|-------------|---------------|
| RxSwift | Combine + @Observable + AsyncSequence | Gradual per module |
| Moya | URLSession async + Result | Replace network layer |
| SnapKit | SwiftUI (new screens) | Keep for existing UIKit |
| Kingfisher | AsyncImage (simple) / keep (complex) | Depends on needs |
| Alamofire | URLSession async | Keep if using advanced features |
| R.swift | Xcode Asset Catalog + ImageResource | iOS 16+ ImageResource |
| SwiftGen | Xcode-generated type-safe resources | Xcode 15+ native |

### Still Valuable

| Library | Why Keep |
|---------|---------|
| GRDB.swift | Superior to SwiftData for complex queries |
| Kingfisher (complex cases) | Animated images, transformations, prefetch |
| KeychainAccess | No native Keychain wrapper |
| Lottie | No native animation format equivalent |
| Firebase | No Apple replacement |

## Patterns: Legacy → Modern

### Communication Patterns

| Legacy | Modern | Min iOS |
|--------|--------|---------|
| KVO (`addObserver:forKeyPath:`) | Combine `publisher(for:)` / @Observable | 13 / 17 |
| NSNotificationCenter (selector-based) | Combine `.onReceive` / `AsyncSequence` | 13 / 15 |
| Heavy delegate + protocol | Closure / AsyncStream | 15 |
| Target-action (UIKit) | SwiftUI declarative | 15 |
| Completion handlers | async/await | 15 |
| DispatchQueue.main.async | @MainActor / MainActor.run | 15 |
| GCD (DispatchQueue) | Swift Concurrency (Task, async let) | 15 |

### Architecture Patterns

| Legacy | Modern | Notes |
|--------|--------|-------|
| Singleton everywhere | @Environment / DI | Testability + isolation |
| CTMediator (ObjC routing) | NavigationStack + Coordinator | Type-safe |
| URL Scheme routing | NavigationStack + deep link handler | Compile-time safe |
| Storyboard segues | NavigationStack programmatic | Merge-conflict free |
| MVC (Massive View Controller) | @Observable direct / MVVM | Per project size |
| VIPER | Clean Architecture (simplified) | Less boilerplate |
| NSObject subclassing | Swift structs / protocols | Value types preferred |

### UI Patterns

| Legacy | Modern | Min iOS |
|--------|--------|---------|
| UIKit programmatic layout | SwiftUI (new screens) | 15 |
| NavigationView | NavigationStack | 16 |
| UIAlertController | `.alert` modifier | 15 |
| UIActivityIndicatorView | ProgressView | 15 |
| UIPageViewController | TabView(.page) | 15 |
| UICollectionViewFlowLayout | LazyVGrid / LazyHGrid | 15 |
| UISearchController | `.searchable` modifier | 15 |
| UIRefreshControl | `.refreshable` modifier | 15 |

### Data & Persistence

| Legacy | Modern | Min iOS |
|--------|--------|---------|
| UserDefaults (heavy use) | @AppStorage / SwiftData | 15 / 17 |
| Core Data (new projects) | SwiftData | 17 |
| NSCoding / NSKeyedArchiver | Codable | Native |
| plist files (data storage) | SwiftData / JSON | 17 |
| ObservableObject | @Observable | 17 |

## Tools: Legacy → Modern

| Legacy | Modern | Notes |
|--------|--------|-------|
| Carthage | SPM | SPM is standard since Xcode 11 |
| CocoaPods | SPM (when possible) | Some pods still need CocoaPods |
| OCLint | SwiftLint + SwiftFormat | Swift-native |
| Sourcery (some uses) | Swift Macros (5.9+) | Built-in metaprogramming |
| xcconfig manual | XcodeGen / Tuist | Build config automation |
| Instruments (manual) | MetricKit (production) | Combine both |
| XCTest (new tests) | Swift Testing | Xcode 16+ |

## Performance Techniques: What Changed

### Still Know But Don't Hand-Write

| Technique | Modern Alternative | Why Still Know |
|-----------|--------------------|---------------|
| fishhook (runtime hooking) | Not needed in Swift | Understand for debugging 3rd-party code |
| `__TEXT` segment migration | Not needed (dyld4 handles) | Historical context |
| Method swizzling | Swift extensions / protocol | Understand ObjC runtime behavior |
| `+load` / `+initialize` | `@UIApplicationDelegateAdaptor` | Know why they're slow |
| Manual RunLoop management | Combine / async-await | Know for debugging hangs |
| Manual image decoding pipeline | Kingfisher / system optimizations | Know for profiling |
| Binary reordering | Profile-Guided Optimization | PGO is automated |

### Still Relevant

| Technique | Modern Usage |
|-----------|-------------|
| Image downsampling | Still critical: 4000x3000 → 100x75 saves 160x memory |
| `shadowPath` explicit | Still faster than computed shadow |
| Opaque views (`isOpaque = true`) | Still reduces GPU blending |
| Pre-main optimization (static linking) | 35% startup reduction |
| Memory leak detection | [weak self] still essential |
| os_unfair_lock | Still best synchronous lock (replaces OSSpinLock) |

## "Red Flags" in Legacy Code

When reviewing existing codebases, flag these for migration:

| Red Flag | Priority | Risk |
|----------|----------|------|
| `import AFNetworking` | High | Security updates stopped |
| `@objc dynamic` (for KVO) | Medium | Use Combine or @Observable |
| `performSelector` | High | Type-unsafe, crash-prone |
| `NSURLConnection` | Critical | Removed in iOS 15 |
| `UIWebView` | Critical | App Store rejection |
| `UIAlertView` / `UIActionSheet` | Medium | Deprecated since iOS 8 |
| `dispatch_once` (ObjC) | Low | Use Swift static let |
| `NSLock` for simple cases | Low | Consider os_unfair_lock or Actor |
| `Notification.Name` rawValue strings | Low | Use typed constants |

## Migration Priority Matrix

| Migration | Breaking Risk | User Impact | Effort | Score | Action |
|-----------|:---:|:---:|:---:|:---:|--------|
| UIWebView → WKWebView | Low=3 | High=3 | Low=3 | **9** | Now |
| AFNetworking → URLSession | Low=3 | Med=2 | Med=2 | **7** | Next cycle |
| RxSwift → Combine/Async | Med=2 | Med=2 | High=1 | **5** | Defer |
| Core Data → SwiftData | High=1 | Low=1 | High=1 | **3** | Defer |
| Storyboard → SwiftUI | Med=2 | Low=1 | High=1 | **4** | Defer |
| ObservableObject → @Observable | Low=3 | Med=2 | Low=3 | **8** | Next cycle |
| XCTest → Swift Testing | Low=3 | Low=1 | Low=3 | **7** | Next cycle |
| NavigationView → NavigationStack | Low=3 | Med=2 | Med=2 | **7** | Next cycle |

**Score: 9+ → Now | 6-8 → Next cycle | <6 → Defer**

## Sources

- [戴铭: iOS 开发者十年之路](https://ming1016.github.io/2026/02/23/ioser-ming/)
- [ibireme: 不再安全的 OSSpinLock](https://blog.ibireme.com/2016/01/16/spinlock_is_unsafe_in_ios/)
- [Apple: Modernizing Your UI](https://developer.apple.com/documentation/uikit/updating-your-app)
- [Antoine van der Lee: @Observable Performance](https://www.avanderlee.com/swiftui/observable-macro-performance-increase-observableobject/)
