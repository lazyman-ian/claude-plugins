// MARK: - Live Activity Example: Pizza Delivery Tracking

import ActivityKit
import WidgetKit
import SwiftUI

// MARK: - Activity Attributes

struct PizzaDeliveryAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var status: DeliveryStatus
        var estimatedArrival: Date
        var driverName: String?
        var currentStep: Int

        enum DeliveryStatus: String, Codable, Hashable {
            case orderReceived = "Order Received"
            case preparing = "Preparing"
            case baking = "Baking"
            case outForDelivery = "Out for Delivery"
            case delivered = "Delivered"

            var icon: String {
                switch self {
                case .orderReceived: return "checkmark.circle"
                case .preparing: return "clock"
                case .baking: return "flame"
                case .outForDelivery: return "car"
                case .delivered: return "checkmark.circle.fill"
                }
            }
        }
    }

    var orderId: String
    var restaurantName: String
    var items: [String]
}

// MARK: - Activity Manager

class PizzaDeliveryActivityManager {
    static let shared = PizzaDeliveryActivityManager()
    private var currentActivity: Activity<PizzaDeliveryAttributes>?

    private init() {}

    func startTracking(orderId: String, restaurantName: String, items: [String]) {
        let attributes = PizzaDeliveryAttributes(
            orderId: orderId,
            restaurantName: restaurantName,
            items: items
        )

        let initialState = PizzaDeliveryAttributes.ContentState(
            status: .orderReceived,
            estimatedArrival: Date().addingTimeInterval(2700), // 45 minutes
            driverName: nil,
            currentStep: 1
        )

        do {
            currentActivity = try Activity<PizzaDeliveryAttributes>.request(
                attributes: attributes,
                contentState: initialState,
                pushType: nil
            )
            print("✅ Started tracking order: \(orderId)")
        } catch {
            print("❌ Failed to start activity: \(error)")
        }
    }

    func updateStatus(
        status: PizzaDeliveryAttributes.ContentState.DeliveryStatus,
        eta: Date,
        driverName: String? = nil,
        step: Int
    ) {
        Task {
            guard let activity = currentActivity else { return }

            let updatedState = PizzaDeliveryAttributes.ContentState(
                status: status,
                estimatedArrival: eta,
                driverName: driverName,
                currentStep: step
            )

            await activity.update(using: updatedState)
            print("✅ Updated to: \(status.rawValue)")
        }
    }

    func updateWithAlert(
        status: PizzaDeliveryAttributes.ContentState.DeliveryStatus,
        eta: Date,
        driverName: String? = nil,
        step: Int
    ) {
        Task {
            guard let activity = currentActivity else { return }

            let updatedState = PizzaDeliveryAttributes.ContentState(
                status: status,
                estimatedArrival: eta,
                driverName: driverName,
                currentStep: step
            )

            await activity.update(
                using: updatedState,
                alertConfiguration: .init(
                    title: "Order Update",
                    body: status.rawValue,
                    sound: .default
                )
            )
        }
    }

    func completeDelivery() {
        Task {
            guard let activity = currentActivity else { return }

            let finalState = PizzaDeliveryAttributes.ContentState(
                status: .delivered,
                estimatedArrival: Date(),
                driverName: activity.contentState.driverName,
                currentStep: 5
            )

            await activity.end(
                using: finalState,
                dismissalPolicy: .default
            )

            currentActivity = nil
            print("✅ Delivery completed")
        }
    }
}

// MARK: - Live Activity Widget

@main
struct PizzaDeliveryActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: PizzaDeliveryAttributes.self) { context in
            // Lock screen / banner UI
            PizzaDeliveryLockScreenView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded UI
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: context.state.status.icon)
                        .font(.title2)
                        .foregroundColor(.orange)
                }

                DynamicIslandExpandedRegion(.trailing) {
                    VStack(alignment: .trailing, spacing: 4) {
                        Text("ETA")
                            .font(.caption2)
                            .foregroundColor(.secondary)

                        Text(context.state.estimatedArrival, style: .timer)
                            .font(.title3)
                            .fontWeight(.semibold)
                            .foregroundColor(.orange)
                    }
                }

                DynamicIslandExpandedRegion(.center) {
                    VStack(spacing: 4) {
                        Text(context.state.status.rawValue)
                            .font(.headline)

                        if let driverName = context.state.driverName {
                            Text("Driver: \(driverName)")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                }

                DynamicIslandExpandedRegion(.bottom) {
                    ProgressTracker(currentStep: context.state.currentStep)
                }
            } compactLeading: {
                Image(systemName: "box.truck.fill")
                    .foregroundColor(.orange)
            } compactTrailing: {
                Text(context.state.estimatedArrival, style: .timer)
                    .font(.caption2)
                    .foregroundColor(.orange)
            } minimal: {
                Image(systemName: context.state.status.icon)
                    .foregroundColor(.orange)
            }
            .keylineTint(.orange)
        }
    }
}

// MARK: - Lock Screen View

struct PizzaDeliveryLockScreenView: View {
    let context: ActivityViewContext<PizzaDeliveryAttributes>

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack {
                Image(systemName: "box.truck.fill")
                    .foregroundColor(.orange)

                Text(context.attributes.restaurantName)
                    .font(.headline)

                Spacer()

                Text(context.state.estimatedArrival, style: .timer)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            // Status
            HStack {
                Image(systemName: context.state.status.icon)
                    .foregroundColor(.orange)

                Text(context.state.status.rawValue)
                    .font(.subheadline)
                    .fontWeight(.medium)

                Spacer()

                if let driverName = context.state.driverName {
                    Text(driverName)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            // Progress
            ProgressTracker(currentStep: context.state.currentStep)

            // Items
            if !context.attributes.items.isEmpty {
                Divider()

                HStack {
                    Text("Items:")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    Text(context.attributes.items.joined(separator: ", "))
                        .font(.caption)
                        .lineLimit(1)
                }
            }
        }
        .padding()
    }
}

// MARK: - Progress Tracker

struct ProgressTracker: View {
    let currentStep: Int
    let totalSteps = 5

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                // Background
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color.secondary.opacity(0.2))
                    .frame(height: 8)

                // Progress
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color.orange)
                    .frame(width: geometry.size.width * progress, height: 8)
                    .animation(.easeInOut, value: currentStep)
            }
        }
        .frame(height: 8)
    }

    private var progress: CGFloat {
        CGFloat(currentStep) / CGFloat(totalSteps)
    }
}

// MARK: - Usage Example

/*
// In your app:

// 1. Start tracking
PizzaDeliveryActivityManager.shared.startTracking(
    orderId: "12345",
    restaurantName: "Pizza Palace",
    items: ["Margherita Pizza", "Garlic Bread"]
)

// 2. Update status
PizzaDeliveryActivityManager.shared.updateStatus(
    status: .preparing,
    eta: Date().addingTimeInterval(2400),
    step: 2
)

// 3. Driver assigned
PizzaDeliveryActivityManager.shared.updateWithAlert(
    status: .outForDelivery,
    eta: Date().addingTimeInterval(900),
    driverName: "John Doe",
    step: 4
)

// 4. Complete delivery
PizzaDeliveryActivityManager.shared.completeDelivery()
*/

// MARK: - Preview

#if DEBUG
struct PizzaDeliveryActivityWidget_Previews: PreviewProvider {
    static var previews: some View {
        let attributes = PizzaDeliveryAttributes(
            orderId: "12345",
            restaurantName: "Pizza Palace",
            items: ["Margherita Pizza", "Garlic Bread"]
        )

        let contentState = PizzaDeliveryAttributes.ContentState(
            status: .outForDelivery,
            estimatedArrival: Date().addingTimeInterval(900),
            driverName: "John Doe",
            currentStep: 4
        )

        PizzaDeliveryLockScreenView(
            context: ActivityViewContext(
                state: contentState,
                attributes: attributes
            )
        )
        .previewContext(WidgetPreviewContext(family: .systemMedium))
        .previewDisplayName("Lock Screen")
    }
}
#endif
