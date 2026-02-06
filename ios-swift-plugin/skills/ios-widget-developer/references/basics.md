# Widget Basics

## Widget Structure

```swift
import WidgetKit
import SwiftUI

struct MyWidget: Widget {
    let kind: String = "MyWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            MyWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("My Widget")
        .description("Widget description")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

struct MyWidgetEntryView: View {
    var entry: Provider.Entry

    var body: some View {
        // Widget UI
    }
}
```

## Timeline Provider

```swift
struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(date: Date(), data: placeholderData)
    }

    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> ()) {
        let entry = SimpleEntry(date: Date(), data: snapshotData)
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
        var entries: [SimpleEntry] = []
        let currentDate = Date()

        for hourOffset in 0 ..< 5 {
            let entryDate = Calendar.current.date(byAdding: .hour, value: hourOffset, to: currentDate)!
            let entry = SimpleEntry(date: entryDate, data: fetchData())
            entries.append(entry)
        }

        let timeline = Timeline(entries: entries, policy: .atEnd)
        completion(timeline)
    }
}

struct SimpleEntry: TimelineEntry {
    let date: Date
    let data: MyData
}
```

## Size Classes

```swift
struct MyWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    var entry: Provider.Entry

    var body: some View {
        switch family {
        case .systemSmall:
            SmallWidgetView(entry: entry)
        case .systemMedium:
            MediumWidgetView(entry: entry)
        case .systemLarge:
            LargeWidgetView(entry: entry)
        case .systemExtraLarge:
            ExtraLargeWidgetView(entry: entry)
        @unknown default:
            SmallWidgetView(entry: entry)
        }
    }
}
```

## Data Sharing (App Group)

```swift
// Info.plist - Add App Group
// com.yourcompany.yourapp.shared

// UserDefaults
let sharedDefaults = UserDefaults(suiteName: "group.com.yourcompany.yourapp.shared")
sharedDefaults?.set(value, forKey: "key")

// FileManager
let containerURL = FileManager.default.containerURL(
    forSecurityApplicationGroupIdentifier: "group.com.yourcompany.yourapp.shared"
)
```

## Timeline Refresh Policies

```swift
.atEnd              // Refresh when timeline ends
.after(date)        // Refresh after specific date
.never              // Never auto-refresh

let timeline = Timeline(entries: entries, policy: .atEnd)
```

## Manual Refresh

```swift
import WidgetKit

WidgetCenter.shared.reloadAllTimelines()
WidgetCenter.shared.reloadTimelines(ofKind: "MyWidget")
```

## Background Refresh

```swift
func scheduleBackgroundRefresh() {
    let request = BGAppRefreshTaskRequest(identifier: "com.app.refresh")
    request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)
    try? BGTaskScheduler.shared.submit(request)
}
```

## Common Patterns

### Placeholder (Must Be Synchronous)

```swift
func placeholder(in context: Context) -> SimpleEntry {
    SimpleEntry(
        date: Date(),
        data: MyData.placeholder // Static, instant
    )
}
```

### Snapshot (Widget Gallery)

```swift
func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> ()) {
    if context.isPreview {
        completion(SimpleEntry(date: Date(), data: .sample))
    } else {
        fetchData { data in
            completion(SimpleEntry(date: Date(), data: data))
        }
    }
}
```

### Deep Link

```swift
struct MyWidgetEntryView: View {
    var entry: Provider.Entry

    var body: some View {
        Link(destination: URL(string: "myapp://detail/\(entry.id)")!) {
            // Widget content
        }
    }
}
```
