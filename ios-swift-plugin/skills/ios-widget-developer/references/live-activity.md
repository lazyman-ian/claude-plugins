# Live Activities Deep Dive

## Requirements

- iOS 16.1+
- Info.plist: `NSSupportsLiveActivities = YES`
- ActivityKit framework

## Activity Attributes

### Basic Structure

```swift
import ActivityKit

struct DeliveryActivityAttributes: ActivityAttributes {
    // Static data (never changes)
    public struct ContentState: Codable, Hashable {
        // Dynamic data (updates during activity)
        var status: String
        var estimatedTime: Date
        var driverLocation: CLLocationCoordinate2D?
    }

    var orderId: String
    var restaurantName: String
}
```

### Custom Types in ContentState

```swift
struct ContentState: Codable, Hashable {
    var progress: Progress
    var metrics: Metrics

    struct Progress: Codable, Hashable {
        var current: Int
        var total: Int

        var percentage: Double {
            Double(current) / Double(total)
        }
    }

    struct Metrics: Codable, Hashable {
        var speed: Double
        var distance: Double
    }
}
```

## Starting Activities

### Basic Start

```swift
func startDeliveryTracking(orderId: String) {
    let attributes = DeliveryActivityAttributes(
        orderId: orderId,
        restaurantName: "Pizza Place"
    )

    let initialState = DeliveryActivityAttributes.ContentState(
        status: "Preparing",
        estimatedTime: Date().addingTimeInterval(1800),
        driverLocation: nil
    )

    do {
        let activity = try Activity<DeliveryActivityAttributes>.request(
            attributes: attributes,
            contentState: initialState,
            pushType: nil
        )
        print("Activity started: \(activity.id)")
    } catch {
        print("Failed to start activity: \(error)")
    }
}
```

### With Push Notifications

```swift
func startWithPush(orderId: String, pushToken: String) {
    let attributes = DeliveryActivityAttributes(
        orderId: orderId,
        restaurantName: "Pizza Place"
    )

    let initialState = DeliveryActivityAttributes.ContentState(
        status: "Preparing",
        estimatedTime: Date().addingTimeInterval(1800),
        driverLocation: nil
    )

    do {
        let activity = try Activity<DeliveryActivityAttributes>.request(
            attributes: attributes,
            contentState: initialState,
            pushType: .token
        )

        // Send push token to server
        Task {
            for await pushToken in activity.pushTokenUpdates {
                let token = pushToken.map { String(format: "%02x", $0) }.joined()
                await sendTokenToServer(token: token, orderId: orderId)
            }
        }
    } catch {
        print("Failed to start activity: \(error)")
    }
}
```

## Updating Activities

### Local Update

```swift
func updateDeliveryStatus(status: String, eta: Date) async {
    for activity in Activity<DeliveryActivityAttributes>.activities {
        let updatedState = DeliveryActivityAttributes.ContentState(
            status: status,
            estimatedTime: eta,
            driverLocation: getCurrentLocation()
        )

        await activity.update(using: updatedState)
    }
}
```

### Alert Update

```swift
func updateWithAlert(status: String) async {
    for activity in Activity<DeliveryActivityAttributes>.activities {
        let updatedState = DeliveryActivityAttributes.ContentState(
            status: status,
            estimatedTime: Date().addingTimeInterval(300),
            driverLocation: nil
        )

        await activity.update(
            using: updatedState,
            alertConfiguration: .init(
                title: "Status Update",
                body: status,
                sound: .default
            )
        )
    }
}
```

### Push Update (APNs)

```json
{
  "aps": {
    "timestamp": 1234567890,
    "event": "update",
    "content-state": {
      "status": "Out for delivery",
      "estimatedTime": 1234567890,
      "driverLocation": {
        "latitude": 37.7749,
        "longitude": -122.4194
      }
    },
    "alert": {
      "title": "Your order is on the way!",
      "body": "Driver will arrive in 10 minutes"
    }
  }
}
```

## Ending Activities

### Normal End

```swift
func endDelivery() async {
    for activity in Activity<DeliveryActivityAttributes>.activities {
        let finalState = DeliveryActivityAttributes.ContentState(
            status: "Delivered",
            estimatedTime: Date(),
            driverLocation: nil
        )

        await activity.end(using: finalState, dismissalPolicy: .default)
    }
}
```

### Immediate Dismissal

```swift
await activity.end(using: finalState, dismissalPolicy: .immediate)
```

### After Date

```swift
let dismissalDate = Date().addingTimeInterval(3600) // 1 hour
await activity.end(using: finalState, dismissalPolicy: .after(dismissalDate))
```

## Live Activity Widget

### Complete Configuration

```swift
import ActivityKit
import WidgetKit
import SwiftUI

@main
struct DeliveryActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: DeliveryActivityAttributes.self) { context in
            // Lock screen / banner UI
            LockScreenView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded view
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: "takeoutbag.and.cup.and.straw")
                        .foregroundColor(.orange)
                }

                DynamicIslandExpandedRegion(.trailing) {
                    VStack(alignment: .trailing) {
                        Text(context.state.estimatedTime, style: .timer)
                            .font(.title2)
                            .foregroundColor(.secondary)
                    }
                }

                DynamicIslandExpandedRegion(.center) {
                    Text(context.state.status)
                        .font(.headline)
                }

                DynamicIslandExpandedRegion(.bottom) {
                    ProgressBar(status: context.state.status)
                }
            } compactLeading: {
                Image(systemName: "takeoutbag.and.cup.and.straw")
            } compactTrailing: {
                Text(context.state.estimatedTime, style: .timer)
                    .font(.caption2)
            } minimal: {
                Image(systemName: "takeoutbag.and.cup.and.straw")
            }
            .keylineTint(.orange)
        }
    }
}

struct LockScreenView: View {
    let context: ActivityViewContext<DeliveryActivityAttributes>

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "takeoutbag.and.cup.and.straw")
                Text(context.attributes.restaurantName)
                    .font(.headline)
                Spacer()
                Text(context.state.estimatedTime, style: .timer)
                    .font(.caption)
            }

            Text(context.state.status)
                .font(.subheadline)
                .foregroundColor(.secondary)

            ProgressView(value: progressValue(for: context.state.status))
                .tint(.orange)
        }
        .padding()
    }

    func progressValue(for status: String) -> Double {
        switch status {
        case "Preparing": return 0.33
        case "Out for delivery": return 0.66
        case "Delivered": return 1.0
        default: return 0.0
        }
    }
}
```

## Activity Management

### Query Active Activities

```swift
func listActiveActivities() {
    let activities = Activity<DeliveryActivityAttributes>.activities
    print("Active activities: \(activities.count)")

    for activity in activities {
        print("Order: \(activity.attributes.orderId)")
        print("Status: \(activity.contentState.status)")
    }
}
```

### Monitor Activity State

```swift
func monitorActivity() {
    Task {
        for activity in Activity<DeliveryActivityAttributes>.activities {
            for await state in activity.activityStateUpdates {
                switch state {
                case .active:
                    print("Activity is active")
                case .ended:
                    print("Activity ended")
                case .dismissed:
                    print("Activity dismissed")
                @unknown default:
                    break
                }
            }
        }
    }
}
```

### Monitor Content Updates

```swift
func monitorContentUpdates() {
    Task {
        for activity in Activity<DeliveryActivityAttributes>.activities {
            for await contentState in activity.contentStateUpdates {
                print("Status updated: \(contentState.status)")
                updateUI(with: contentState)
            }
        }
    }
}
```

## Best Practices

### 1. Lifecycle Management

```swift
class ActivityManager {
    private var currentActivity: Activity<DeliveryActivityAttributes>?

    func start(orderId: String) {
        // End existing activity first
        Task {
            await endCurrentActivity()

            let attributes = DeliveryActivityAttributes(
                orderId: orderId,
                restaurantName: "Pizza Place"
            )

            let initialState = DeliveryActivityAttributes.ContentState(
                status: "Preparing",
                estimatedTime: Date().addingTimeInterval(1800),
                driverLocation: nil
            )

            do {
                currentActivity = try Activity<DeliveryActivityAttributes>.request(
                    attributes: attributes,
                    contentState: initialState,
                    pushType: nil
                )
            } catch {
                print("Failed to start: \(error)")
            }
        }
    }

    func endCurrentActivity() async {
        guard let activity = currentActivity else { return }

        let finalState = DeliveryActivityAttributes.ContentState(
            status: "Completed",
            estimatedTime: Date(),
            driverLocation: nil
        )

        await activity.end(using: finalState, dismissalPolicy: .default)
        currentActivity = nil
    }
}
```

### 2. Error Handling

```swift
func startActivitySafely() {
    guard ActivityAuthorizationInfo().areActivitiesEnabled else {
        print("Activities are not enabled")
        return
    }

    do {
        let activity = try Activity<DeliveryActivityAttributes>.request(
            attributes: attributes,
            contentState: initialState,
            pushType: nil
        )
        currentActivity = activity
    } catch {
        if let activityError = error as? ActivityError {
            switch activityError {
            case .notAuthorized:
                print("User has not authorized activities")
            case .tooManyActivities:
                print("Too many active activities")
            @unknown default:
                print("Unknown error: \(error)")
            }
        }
    }
}
```

### 3. Background Updates

```swift
// In app delegate / scene delegate
func handleBackgroundUpdate(orderId: String, status: String) {
    Task {
        for activity in Activity<DeliveryActivityAttributes>.activities
            where activity.attributes.orderId == orderId {

            let updatedState = DeliveryActivityAttributes.ContentState(
                status: status,
                estimatedTime: calculateETA(),
                driverLocation: getLocation()
            )

            await activity.update(using: updatedState)
        }
    }
}
```

## Testing

### Preview

```swift
#if DEBUG
struct DeliveryActivityWidget_Previews: PreviewProvider {
    static var previews: some View {
        let attributes = DeliveryActivityAttributes(
            orderId: "12345",
            restaurantName: "Pizza Place"
        )

        let contentState = DeliveryActivityAttributes.ContentState(
            status: "Preparing",
            estimatedTime: Date().addingTimeInterval(1800),
            driverLocation: nil
        )

        return Group {
            // Lock screen
            contentState
                .previewContext(attributes, contentState: contentState)
                .previewDisplayName("Lock Screen")

            // Dynamic Island
            contentState
                .previewContext(attributes, contentState: contentState)
                .previewDisplayName("Dynamic Island")
        }
    }
}
#endif
```

## Common Issues

### Activity Not Starting

- Check `NSSupportsLiveActivities` in Info.plist
- Verify iOS version (16.1+)
- Check authorization: `ActivityAuthorizationInfo().areActivitiesEnabled`
- Limit: 8 concurrent activities per app

### Push Updates Not Working

- Verify push notification entitlement
- Send push token to server immediately
- Use correct APNs payload format
- Check push environment (development/production)

### Activity Not Updating

```swift
// Wrong: Creating new state
let state = DeliveryActivityAttributes.ContentState(...)
await activity.update(using: state)

// Right: Modify existing state
var state = activity.contentState
state.status = "Updated"
await activity.update(using: state)
```
