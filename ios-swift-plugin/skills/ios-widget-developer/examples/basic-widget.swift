// MARK: - Basic Widget Example

import WidgetKit
import SwiftUI

// MARK: - Widget Entry

struct WeatherEntry: TimelineEntry {
    let date: Date
    let temperature: Int
    let condition: String
    let icon: String
}

// MARK: - Timeline Provider

struct WeatherProvider: TimelineProvider {
    func placeholder(in context: Context) -> WeatherEntry {
        WeatherEntry(
            date: Date(),
            temperature: 72,
            condition: "Sunny",
            icon: "sun.max.fill"
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (WeatherEntry) -> Void) {
        let entry = WeatherEntry(
            date: Date(),
            temperature: 72,
            condition: "Sunny",
            icon: "sun.max.fill"
        )
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<WeatherEntry>) -> Void) {
        // Generate timeline entries for next 4 hours
        let currentDate = Date()
        var entries: [WeatherEntry] = []

        for hourOffset in 0..<4 {
            let entryDate = Calendar.current.date(byAdding: .hour, value: hourOffset, to: currentDate)!
            let entry = WeatherEntry(
                date: entryDate,
                temperature: 72 - (hourOffset * 2),
                condition: conditions[hourOffset],
                icon: icons[hourOffset]
            )
            entries.append(entry)
        }

        let timeline = Timeline(entries: entries, policy: .atEnd)
        completion(timeline)
    }

    private let conditions = ["Sunny", "Partly Cloudy", "Cloudy", "Rain"]
    private let icons = ["sun.max.fill", "cloud.sun.fill", "cloud.fill", "cloud.rain.fill"]
}

// MARK: - Widget Views

struct WeatherWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    var entry: WeatherProvider.Entry

    var body: some View {
        switch family {
        case .systemSmall:
            SmallWeatherView(entry: entry)
        case .systemMedium:
            MediumWeatherView(entry: entry)
        case .systemLarge:
            LargeWeatherView(entry: entry)
        @unknown default:
            SmallWeatherView(entry: entry)
        }
    }
}

struct SmallWeatherView: View {
    let entry: WeatherEntry

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [.blue.opacity(0.7), .blue],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            VStack(spacing: 8) {
                Image(systemName: entry.icon)
                    .font(.system(size: 40))
                    .foregroundColor(.white)

                Text("\(entry.temperature)°")
                    .font(.system(size: 36, weight: .bold))
                    .foregroundColor(.white)

                Text(entry.condition)
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.9))
            }
            .padding()
        }
    }
}

struct MediumWeatherView: View {
    let entry: WeatherEntry

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [.blue.opacity(0.7), .blue],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            HStack(spacing: 20) {
                VStack(alignment: .leading, spacing: 8) {
                    Image(systemName: entry.icon)
                        .font(.system(size: 50))
                        .foregroundColor(.white)

                    Text("\(entry.temperature)°")
                        .font(.system(size: 48, weight: .bold))
                        .foregroundColor(.white)
                }

                Divider()
                    .background(Color.white.opacity(0.3))

                VStack(alignment: .leading, spacing: 8) {
                    Text(entry.condition)
                        .font(.headline)
                        .foregroundColor(.white)

                    Text("Updated")
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.7))

                    Text(entry.date, style: .time)
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.7))
                }
            }
            .padding()
        }
    }
}

struct LargeWeatherView: View {
    let entry: WeatherEntry

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [.blue.opacity(0.7), .blue],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            VStack(spacing: 20) {
                // Current weather
                VStack(spacing: 12) {
                    Image(systemName: entry.icon)
                        .font(.system(size: 60))
                        .foregroundColor(.white)

                    Text("\(entry.temperature)°")
                        .font(.system(size: 60, weight: .bold))
                        .foregroundColor(.white)

                    Text(entry.condition)
                        .font(.title3)
                        .foregroundColor(.white.opacity(0.9))
                }

                Divider()
                    .background(Color.white.opacity(0.3))

                // Details
                HStack(spacing: 30) {
                    DetailView(title: "Wind", value: "12 mph", icon: "wind")
                    DetailView(title: "Humidity", value: "65%", icon: "humidity")
                    DetailView(title: "UV Index", value: "5", icon: "sun.max")
                }
            }
            .padding()
        }
    }
}

struct DetailView: View {
    let title: String
    let value: String
    let icon: String

    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: icon)
                .font(.system(size: 20))
                .foregroundColor(.white)

            Text(value)
                .font(.headline)
                .foregroundColor(.white)

            Text(title)
                .font(.caption)
                .foregroundColor(.white.opacity(0.7))
        }
    }
}

// MARK: - Widget Configuration

@main
struct WeatherWidget: Widget {
    let kind: String = "WeatherWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: WeatherProvider()) { entry in
            WeatherWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Weather")
        .description("Stay updated with current weather conditions")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

// MARK: - Preview

#if DEBUG
struct WeatherWidget_Previews: PreviewProvider {
    static var previews: some View {
        let entry = WeatherEntry(
            date: Date(),
            temperature: 72,
            condition: "Sunny",
            icon: "sun.max.fill"
        )

        Group {
            WeatherWidgetEntryView(entry: entry)
                .previewContext(WidgetPreviewContext(family: .systemSmall))

            WeatherWidgetEntryView(entry: entry)
                .previewContext(WidgetPreviewContext(family: .systemMedium))

            WeatherWidgetEntryView(entry: entry)
                .previewContext(WidgetPreviewContext(family: .systemLarge))
        }
    }
}
#endif
