# Advanced Timeline Patterns

## Timeline Refresh Strategies

### 1. Fixed Interval Updates

```swift
func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
    let currentDate = Date()
    var entries: [SimpleEntry] = []

    // Update every 15 minutes
    for minuteOffset in stride(from: 0, to: 60, by: 15) {
        let entryDate = Calendar.current.date(byAdding: .minute, value: minuteOffset, to: currentDate)!
        let entry = SimpleEntry(date: entryDate, data: fetchData())
        entries.append(entry)
    }

    let timeline = Timeline(entries: entries, policy: .atEnd)
    completion(timeline)
}
```

### 2. Time-Specific Updates

```swift
func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
    let calendar = Calendar.current
    let currentDate = Date()
    var entries: [SimpleEntry] = []

    // Update at specific hours: 9 AM, 12 PM, 3 PM, 6 PM
    let updateHours = [9, 12, 15, 18]

    for hour in updateHours {
        if let entryDate = calendar.date(bySettingHour: hour, minute: 0, second: 0, of: currentDate),
           entryDate > currentDate {
            let entry = SimpleEntry(date: entryDate, data: fetchData(for: hour))
            entries.append(entry)
        }
    }

    // Add next day's first update
    if let tomorrow = calendar.date(byAdding: .day, value: 1, to: currentDate),
       let firstUpdate = calendar.date(bySettingHour: updateHours[0], minute: 0, second: 0, of: tomorrow) {
        let entry = SimpleEntry(date: firstUpdate, data: fetchData(for: updateHours[0]))
        entries.append(entry)
    }

    let timeline = Timeline(entries: entries, policy: .atEnd)
    completion(timeline)
}
```

### 3. Event-Based Updates

```swift
func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
    fetchUpcomingEvents { events in
        var entries: [SimpleEntry] = []

        for event in events {
            // Entry before event
            if let preEventDate = Calendar.current.date(byAdding: .minute, value: -30, to: event.startDate) {
                entries.append(SimpleEntry(date: preEventDate, data: .upcoming(event)))
            }

            // Entry at event start
            entries.append(SimpleEntry(date: event.startDate, data: .active(event)))

            // Entry at event end
            entries.append(SimpleEntry(date: event.endDate, data: .completed(event)))
        }

        let timeline = Timeline(entries: entries.sorted { $0.date < $1.date }, policy: .atEnd)
        completion(timeline)
    }
}
```

## Background URL Session

```swift
class TimelineProvider: TimelineProvider {
    let session: URLSession = {
        let config = URLSessionConfiguration.background(withIdentifier: "com.app.widget.background")
        config.isDiscretionary = false
        return URLSession(configuration: config)
    }()

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
        fetchDataWithBackground { result in
            switch result {
            case .success(let data):
                let entry = SimpleEntry(date: Date(), data: data)
                let timeline = Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(900)))
                completion(timeline)
            case .failure:
                // Fallback entry
                let entry = SimpleEntry(date: Date(), data: .placeholder)
                let timeline = Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(300)))
                completion(timeline)
            }
        }
    }

    private func fetchDataWithBackground(completion: @escaping (Result<MyData, Error>) -> Void) {
        let task = session.dataTask(with: URL(string: "https://api.example.com/data")!) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }

            guard let data = data else {
                completion(.failure(URLError(.badServerResponse)))
                return
            }

            do {
                let decoded = try JSONDecoder().decode(MyData.self, from: data)
                completion(.success(decoded))
            } catch {
                completion(.failure(error))
            }
        }
        task.resume()
    }
}
```

## Conditional Timeline

```swift
func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
    let calendar = Calendar.current
    let currentDate = Date()
    let hour = calendar.component(.hour, from: currentDate)

    var entries: [SimpleEntry] = []

    if hour >= 6 && hour < 22 {
        // Daytime: Update every 15 minutes
        for minuteOffset in stride(from: 0, to: 60, by: 15) {
            let entryDate = calendar.date(byAdding: .minute, value: minuteOffset, to: currentDate)!
            entries.append(SimpleEntry(date: entryDate, data: fetchData()))
        }
    } else {
        // Nighttime: Update every 2 hours
        for hourOffset in stride(from: 0, to: 8, by: 2) {
            let entryDate = calendar.date(byAdding: .hour, value: hourOffset, to: currentDate)!
            entries.append(SimpleEntry(date: entryDate, data: fetchData()))
        }
    }

    let timeline = Timeline(entries: entries, policy: .atEnd)
    completion(timeline)
}
```

## Intent Configuration Timeline

```swift
struct Provider: IntentTimelineProvider {
    func timeline(for configuration: ConfigurationIntent, in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
        let selectedCity = configuration.city ?? "San Francisco"

        fetchWeather(for: selectedCity) { weather in
            var entries: [SimpleEntry] = []
            let currentDate = Date()

            for hourOffset in 0..<12 {
                let entryDate = Calendar.current.date(byAdding: .hour, value: hourOffset, to: currentDate)!
                let entry = SimpleEntry(
                    date: entryDate,
                    city: selectedCity,
                    temperature: weather.forecast[hourOffset]
                )
                entries.append(entry)
            }

            let timeline = Timeline(entries: entries, policy: .atEnd)
            completion(timeline)
        }
    }
}
```

## Handling Errors

```swift
func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
    fetchData { result in
        let entries: [SimpleEntry]
        let policy: TimelineReloadPolicy

        switch result {
        case .success(let data):
            // Success: Normal update schedule
            entries = generateEntries(from: data)
            policy = .after(Date().addingTimeInterval(900)) // 15 minutes

        case .failure(let error):
            // Error: Show error state and retry sooner
            let errorEntry = SimpleEntry(
                date: Date(),
                data: .error(error.localizedDescription)
            )
            entries = [errorEntry]
            policy = .after(Date().addingTimeInterval(60)) // 1 minute retry
        }

        let timeline = Timeline(entries: entries, policy: policy)
        completion(timeline)
    }
}
```

## Memory Optimization

```swift
func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
    // Limit entries based on widget family
    let maxEntries: Int
    switch context.family {
    case .systemSmall:
        maxEntries = 5
    case .systemMedium:
        maxEntries = 10
    default:
        maxEntries = 20
    }

    var entries: [SimpleEntry] = []
    let currentDate = Date()

    for index in 0..<maxEntries {
        let entryDate = Calendar.current.date(byAdding: .minute, value: index * 15, to: currentDate)!
        let entry = SimpleEntry(date: entryDate, data: fetchData())
        entries.append(entry)
    }

    let timeline = Timeline(entries: entries, policy: .atEnd)
    completion(timeline)
}
```

## Testing Timeline

```swift
#if DEBUG
extension TimelineProvider {
    static func previewTimeline() -> Timeline<SimpleEntry> {
        let entries = (0..<5).map { index in
            SimpleEntry(
                date: Date().addingTimeInterval(Double(index) * 900),
                data: .sample(index)
            )
        }
        return Timeline(entries: entries, policy: .never)
    }
}
#endif
```
