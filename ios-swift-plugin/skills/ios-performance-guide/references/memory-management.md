# Memory Management

Memory issues are the #1 cause of production crashes in iOS apps.

## 4 Common Leak Sources

### 1. Closure Retain Cycles

```swift
// LEAK: self → closure → self
class ViewModel {
    var onComplete: (() -> Void)?
    func setup() {
        onComplete = { self.finish() } // strong capture
    }
}

// FIX: [weak self]
onComplete = { [weak self] in self?.finish() }
```

**Decision tree for `[weak self]`:**
- Escaping closure stored as property → `[weak self]`
- Escaping closure passed to framework (URLSession, NotificationCenter) → `[weak self]`
- Non-escaping closure (map, filter, forEach) → no capture needed
- Task { } in SwiftUI .task modifier → no capture needed (auto-cancelled)
- Async method on actor → no capture needed (actor manages lifetime)

### 2. Delegate Retain Cycles

```swift
// LEAK: parent → child → parent
class Parent {
    let child = Child()
    func setup() { child.delegate = self }
}

// FIX: weak delegate
protocol ChildDelegate: AnyObject { }
class Child {
    weak var delegate: ChildDelegate?
}
```

### 3. Timer Retain Cycles

```swift
// LEAK: RunLoop → Timer → self
timer = Timer.scheduledTimer(timeInterval: 1, target: self,
                             selector: #selector(tick), userInfo: nil, repeats: true)

// FIX: Block-based API (iOS 10+)
timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
    self?.tick()
}
// Always invalidate in appropriate lifecycle
deinit { timer?.invalidate() }
```

### 4. NotificationCenter

```swift
// LEAK (pre-iOS 9): observer retained
NotificationCenter.default.addObserver(self, selector: #selector(handle), ...)

// FIX: Block-based with weak capture
let token = NotificationCenter.default.addObserver(
    forName: .someNotification, object: nil, queue: .main
) { [weak self] notification in
    self?.handle(notification)
}
// Store token and remove in deinit
```

**Modern alternative:** In SwiftUI, use `.onReceive(NotificationCenter.default.publisher(for:))`.

## Value Types vs Reference Types

| Criteria | struct (value) | class (reference) |
|----------|---------------|-------------------|
| Size < 16 bytes | Preferred (register-passed) | Overkill |
| Immutable data | Preferred | Unnecessary |
| Shared mutable state | Inefficient (copies) | Appropriate |
| Identity needed | Not applicable | Required |
| ARC overhead | None | Retain/release cost |

**Rule:** Default to struct. Use class only when you need reference semantics or inheritance.

## Autorelease Pool

Still relevant in specific scenarios with iOS 15+:

```swift
// Batch processing large datasets
func processLargeDataset(_ items: [Data]) {
    for item in items {
        autoreleasepool {
            let image = UIImage(data: item)
            let processed = applyFilter(image)
            saveToCache(processed)
            // Temporary objects released here, not accumulated
        }
    }
}
```

**When needed:**
- Loops creating many temporary ObjC objects (UIImage, NSString bridging)
- Background import/export operations
- JSON processing large arrays

**When NOT needed:**
- Pure Swift value types (no autorelease)
- Small operations (overhead > benefit)
- Inside SwiftUI body (framework handles this)

## Production Leak Detection

### MetricKit

```swift
// Monitor memory footprint
func didReceive(_ payloads: [MXMetricPayload]) {
    for payload in payloads {
        if let memoryMetrics = payload.memoryMetrics {
            analytics.log("peak_memory", memoryMetrics.peakMemoryUsage)
        }
        if let exitMetrics = payload.applicationExitMetrics {
            let bg = exitMetrics.backgroundExitData
            analytics.log("oom_bg", bg.cumulativeMemoryPressureExitCount)
        }
    }
}
```

### Canary Objects

Place lightweight sentinel objects in critical paths:

```swift
class MemoryCanary {
    let label: String
    init(_ label: String) { self.label = label }
    deinit {
        // If this never fires, the owner is leaking
        print("Canary deallocated: \(label)")
    }
}
```

### Xcode Memory Graph Debugger

1. Run app → reproduce suspected leak
2. Debug Navigator → Memory icon → click camera icon
3. Filter by your module name
4. Look for unexpected retain cycles (purple ! icons)
5. Inspect backtrace for allocation site

## Sources

- [iOS Memory Management 2025](https://www.alimertgulec.com/en/blog/ios-memory-management-performance-2025)
- [WWDC 2025: Improve memory usage with Swift](https://developer.apple.com/videos/play/wwdc2025/312/)
- [Swift by Sundell: Memory Management](https://www.swiftbysundell.com/basics/memory-management/)
- ibireme: iOS 界面流畅技巧 (内存部分)
