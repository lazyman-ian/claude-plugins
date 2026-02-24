# Startup Optimization

Target: cold launch < 400ms to first frame (Apple recommendation).

## Launch Phases

```
App Tap → dyld → Runtime Init → UIKit Init → didFinishLaunching → First Frame
         ├─ pre-main ─┤              ├────── post-main ──────────┤
```

### Pre-main Phase

Measured via `DYLD_PRINT_STATISTICS=1` environment variable in Xcode scheme.

| Stage | What Happens | Optimization |
|-------|-------------|-------------|
| dylib loading | Dynamic libraries mapped into memory | Convert dynamic → static (SPM: `.static`) |
| Rebase/Bind | Pointer fix-ups for ASLR | Reduce ObjC metadata (fewer classes/selectors) |
| ObjC setup | Register classes, categories | Minimize `+load` methods, use `+initialize` |
| Initializers | C++ static constructors, `__attribute__((constructor))` | Move to lazy init or `didFinishLaunching` |

**Key wins:**
- Dynamic → static linking: 35% dyld reduction in benchmarks
- dyld4 (iOS 16+) has pre-built closures but static linking still faster
- Pure Swift projects naturally avoid `+load` overhead

### Post-main Phase

```swift
func application(_ application: UIApplication,
                 didFinishLaunchingWithOptions launchOptions: ...) -> Bool {
    // CRITICAL: Only essential setup here
    // Everything else → deferred
}
```

**Task orchestration strategy:**
1. Defer ALL non-essential tasks initially
2. Identify which truly need to run before first frame
3. Independent tasks → concurrent batch (async let)
4. Dependent tasks → sequential chain
5. Everything else → after first frame (DispatchQueue.main.async or Task)

```swift
// Modern async launch pattern
func setupApp() async {
    // Phase 1: Must complete before UI (sequential)
    await configureDatabase()

    // Phase 2: Parallel non-blocking
    async let analytics = setupAnalytics()
    async let pushSetup = registerPushNotifications()
    async let cacheWarm = warmCaches()
    _ = await (analytics, pushSetup, cacheWarm)
}
```

**Common post-main bottlenecks:**
- Core Data stack initialization → move to background, show placeholder
- Network requests blocking UI → never block launch on network
- Third-party SDK init → audit with Instruments, defer non-essential
- JSON parsing large config → cache parsed result, load async

### What NOT to Do at Launch

| Anti-pattern | Problem | Fix |
|-------------|---------|-----|
| Synchronous network call | Blocks indefinitely on bad network | Async + cached fallback |
| `UIFont.registerFont` for many fonts | Each registration is expensive | Register only needed fonts lazily |
| Full database migration | Can take seconds | Background migration + progress UI |
| `String(describing:)` for IDs | Slow reflection | Use `ObjectIdentifier` |
| `NSBundle.allFrameworks` | Iterates all frameworks | Cache or avoid |

## Measurement

### Development: Instruments

Use **App Launch** template:
1. Profile (Cmd+I) → App Launch
2. Cold launch = kill app + wait 3 sec + launch
3. Check "Time to First Frame" metric
4. Drill into Time Profiler call tree for hotspots

### CI: XCTApplicationLaunchMetric

```swift
func testLaunchPerformance() throws {
    measure(metrics: [XCTApplicationLaunchMetric()]) {
        XCUIApplication().launch()
    }
}
```

Run on real device, release configuration, multiple iterations. Set baseline in Xcode.

### Production: MetricKit + Xcode Organizer

- `MXAppLaunchMetric` provides histogram of launch durations
- Xcode Organizer shows 50th/90th percentile across app versions
- App Store Connect API for automated tracking

### Debug: DYLD_PRINT_STATISTICS

Xcode → Edit Scheme → Run → Arguments → Environment Variables:
- `DYLD_PRINT_STATISTICS` = `1` (summary)
- `DYLD_PRINT_STATISTICS_DETAILS` = `1` (detailed breakdown)

## Static Linking Checklist

When converting dynamic frameworks to static:

- [ ] SPM: Set `type: .static` in Package.swift
- [ ] Check for ObjC runtime dependency (some need `-ObjC` linker flag)
- [ ] Verify no duplicate symbols across static libs
- [ ] Re-measure with `DYLD_PRINT_STATISTICS`
- [ ] Test on minimum deployment target device

## Sources

- [Apple: Reducing your app's launch time](https://developer.apple.com/documentation/xcode/reducing-your-app-s-launch-time)
- [SwiftLee: App Launch Time Optimization](https://www.avanderlee.com/optimization/launch-time-performance-optimization/)
- [Emerge Tools: Improve iOS App Startup Times](https://www.emergetools.com/blog/posts/improve-popular-iOS-app-startup-times)
- [WWDC 2019: Optimizing App Launch](https://developer.apple.com/videos/play/wwdc2019/423/)
- 戴铭: 启动速度优化思考
