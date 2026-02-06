---
name: ios-widget-developer
description: Provides iOS WidgetKit development expertise with best practices for Timeline Providers, Widget Configuration, Live Activities, and App Intents. This skill should be used when user asks to create widgets, implement widget features, debug widget issues, or optimize widget performance. Triggers on "widget", "WidgetKit", "Timeline", "Live Activity", "小组件", "桌面组件", "widget 开发".
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash, mcp__apple-docs__*]
model: sonnet
---

# iOS Widget Developer

Expert guidance for iOS WidgetKit development.

## When to Use

- Creating new widgets
- Implementing Timeline Providers
- Adding Live Activities (iOS 16.1+)
- Integrating App Intents (iOS 16+)
- Debugging widget refresh issues
- Optimizing widget performance

## Quick Reference

| Task | Reference |
|------|-----------|
| Widget structure, Provider, Size classes | `references/basics.md` |
| Timeline patterns (advanced) | `references/timeline.md` |
| Interactive widgets (buttons) | `references/app-intents.md` |
| Live Activity | `references/live-activity.md` |
| Debugging | `references/debugging.md` |
| Examples | `examples/` directory |

## Minimal Widget Template

```swift
import WidgetKit
import SwiftUI

struct MyWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MyWidget", provider: Provider()) { entry in
            MyWidgetEntryView(entry: entry)
        }
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> Entry { Entry(date: .now) }
    func getSnapshot(in context: Context, completion: @escaping (Entry) -> ()) { completion(Entry(date: .now)) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
        completion(Timeline(entries: [Entry(date: .now)], policy: .atEnd))
    }
}

struct Entry: TimelineEntry { let date: Date }
struct MyWidgetEntryView: View {
    var entry: Entry
    var body: some View { Text(entry.date, style: .time) }
}
```

## Performance Best Practices

1. **Keep Timeline Short** - 5-10 entries max
2. **Placeholder Instant** - Return synchronously, no async
3. **Snapshot Quick** - < 1 second
4. **Cache Data** - Use App Group shared storage
5. **Minimize Network** - Fetch in app, share via App Group

## Common Issues (Quick Fixes)

| Issue | Fix |
|-------|-----|
| Widget not updating | Call `WidgetCenter.shared.reloadAllTimelines()` |
| Stale data | Check App Group identifier |
| Placeholder blank | Must return synchronously |
| Live Activity fails | Add `NSSupportsLiveActivities = YES` to Info.plist |

## Creating a Widget

1. Define `TimelineEntry` struct
2. Create `TimelineProvider` (placeholder, snapshot, timeline)
3. Build Widget view for each size
4. Configure `WidgetConfiguration`
5. Set up App Group (if sharing data)
6. Test across all sizes
7. Implement deep linking

## Resources

Load reference files as needed:

- **`references/basics.md`** - Widget structure, Provider, Size classes, Data sharing
- **`references/timeline.md`** - Advanced timeline patterns, Background URL, Error handling
- **`references/app-intents.md`** - Interactive widgets, Buttons, Intent configuration
- **`references/live-activity.md`** - Live Activity attributes, Updates, Dynamic Island
- **`references/debugging.md`** - Common issues, Testing checklist, Constraints
