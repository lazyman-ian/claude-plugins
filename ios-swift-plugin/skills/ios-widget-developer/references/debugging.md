# Widget Debugging

## Debugging Setup

### Widget Extension Scheme

1. Edit Scheme → Run → Executable → Choose Widget Extension
2. Set breakpoints in Timeline Provider
3. Run and select widget in widget gallery

### Console Logging

```swift
import os

let logger = Logger(subsystem: "com.app.widget", category: "timeline")

func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
    logger.debug("Generating timeline")
    logger.info("Context family: \(context.family.description)")
    // ...
}
```

## Common Issues

### Widget Not Updating

1. Check timeline policy
2. Verify App Group identifier
3. Call `WidgetCenter.shared.reloadAllTimelines()`
4. Check system widget budget (limited updates per day)

### Placeholder Not Showing

```swift
// Must return synchronously - NO async calls
func placeholder(in context: Context) -> SimpleEntry {
    return SimpleEntry(date: Date(), data: .placeholder)
}
```

### Live Activity Not Starting

1. Enable "Supports Live Activities" in Info.plist (`NSSupportsLiveActivities = YES`)
2. Check `Activity.activities` array for existing activities
3. Verify push notification entitlement (if using push)
4. Limit: 8 concurrent activities per app

### Widget Shows Stale Data

```swift
// Force refresh from app
func applicationDidBecomeActive(_ application: UIApplication) {
    WidgetCenter.shared.reloadAllTimelines()
}

// Or after data changes
func dataDidUpdate() {
    WidgetCenter.shared.reloadTimelines(ofKind: "MyWidget")
}
```

### Timeline Not Generating

```swift
func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
    // Always call completion - even on error
    guard let data = fetchData() else {
        let fallback = SimpleEntry(date: Date(), data: .empty)
        completion(Timeline(entries: [fallback], policy: .after(Date().addingTimeInterval(300))))
        return
    }

    let entry = SimpleEntry(date: Date(), data: data)
    completion(Timeline(entries: [entry], policy: .atEnd))
}
```

## Testing Checklist

- [ ] All size classes render correctly
- [ ] Placeholder loads instantly (no async)
- [ ] Snapshot completes < 1 second
- [ ] Timeline generates valid entries
- [ ] Deep links work from widget
- [ ] Data sharing via App Group works
- [ ] Widget updates when app updates data
- [ ] No crashes in timeline provider
- [ ] Handles network failures gracefully
- [ ] Memory usage is reasonable

## SwiftUI Widget Constraints

1. **No State/Binding** - Widgets are stateless snapshots
2. **No Animations** - Use static views only
3. **No User Input** - Except buttons/links (iOS 16+)
4. **View Hierarchy Limit** - Keep shallow
5. **Use Environment** - Access widget family, display scale

## Memory Debugging

```swift
func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
    // Limit entries based on widget family
    let maxEntries: Int
    switch context.family {
    case .systemSmall: maxEntries = 5
    case .systemMedium: maxEntries = 10
    default: maxEntries = 20
    }

    // Don't generate too many entries
    var entries: [SimpleEntry] = []
    for index in 0..<maxEntries {
        let entryDate = Calendar.current.date(byAdding: .minute, value: index * 15, to: Date())!
        entries.append(SimpleEntry(date: entryDate, data: fetchData()))
    }

    completion(Timeline(entries: entries, policy: .atEnd))
}
```

## Simulator vs Device

- **Simulator**: Widget updates more freely
- **Device**: System budget limits updates
- Always test on real device before release
