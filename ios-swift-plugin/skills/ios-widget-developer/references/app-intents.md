# App Intent Integration (iOS 16+)

Interactive widgets with buttons and toggles.

## Basic App Intent

```swift
import AppIntents

struct ToggleIntent: AppIntent {
    static var title: LocalizedStringResource = "Toggle State"

    @Parameter(title: "Item ID")
    var itemId: String

    func perform() async throws -> some IntentResult {
        // Update data
        return .result()
    }
}
```

## Interactive Button

```swift
struct MyWidgetEntryView: View {
    var entry: Provider.Entry

    var body: some View {
        Button(intent: ToggleIntent(itemId: entry.id)) {
            Text("Toggle")
        }
        .buttonStyle(.plain)
    }
}
```

## Intent with Confirmation

```swift
struct DeleteIntent: AppIntent {
    static var title: LocalizedStringResource = "Delete Item"

    @Parameter(title: "Item ID")
    var itemId: String

    static var isDiscoverable: Bool { false }

    func perform() async throws -> some IntentResult {
        await DataManager.shared.delete(itemId)
        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}
```

## Intent Configuration (Customizable Widgets)

```swift
import AppIntents

struct ConfigurationIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Configure Widget"

    @Parameter(title: "City")
    var city: String?

    @Parameter(title: "Units")
    var units: TemperatureUnit
}

enum TemperatureUnit: String, AppEnum {
    case celsius, fahrenheit

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Temperature Unit"
    static var caseDisplayRepresentations: [TemperatureUnit: DisplayRepresentation] = [
        .celsius: "Celsius",
        .fahrenheit: "Fahrenheit"
    ]
}
```

## Intent Timeline Provider

```swift
struct Provider: AppIntentTimelineProvider {
    func timeline(for configuration: ConfigurationIntent, in context: Context) async -> Timeline<SimpleEntry> {
        let city = configuration.city ?? "San Francisco"
        let weather = await fetchWeather(for: city)

        let entry = SimpleEntry(date: Date(), weather: weather)
        return Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(3600)))
    }

    func snapshot(for configuration: ConfigurationIntent, in context: Context) async -> SimpleEntry {
        SimpleEntry(date: Date(), weather: .sample)
    }

    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(date: Date(), weather: .placeholder)
    }
}
```

## Widget with Intent Configuration

```swift
struct MyWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(
            kind: "MyWidget",
            intent: ConfigurationIntent.self,
            provider: Provider()
        ) { entry in
            MyWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("My Widget")
        .description("Customizable widget")
    }
}
```

## Multiple Buttons

```swift
struct MyWidgetEntryView: View {
    var entry: Provider.Entry

    var body: some View {
        HStack {
            Button(intent: IncrementIntent()) {
                Image(systemName: "plus")
            }

            Text("\(entry.count)")

            Button(intent: DecrementIntent()) {
                Image(systemName: "minus")
            }
        }
        .buttonStyle(.plain)
    }
}
```

## Best Practices

1. **Keep intents fast** - UI freezes during execution
2. **Reload timeline after state change** - `WidgetCenter.shared.reloadAllTimelines()`
3. **Use App Groups** - Share data between app and widget
4. **Handle errors gracefully** - Return meaningful results
5. **Limit button count** - Too many interactions confuse users
