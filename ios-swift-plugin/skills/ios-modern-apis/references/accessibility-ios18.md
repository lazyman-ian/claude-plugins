# iOS 18 Accessibility Enhancements

New accessibility features and APIs in iOS 18.

## Eye Tracking

Built-in eye tracking using the front-facing camera. No additional hardware required.

- Works with standard UIKit and SwiftUI controls automatically
- Dwell Control: users look at an element and pause to activate
- Ensure interactive elements meet minimum 44x44pt touch targets

## Music Haptics

Syncs haptic feedback with audio for users who are deaf or hard of hearing. System-managed for Apple Music. For custom audio, provide a `CHHapticPattern` aligned with your audio track.

## Vocal Shortcuts

Users assign custom voice phrases to trigger App Intents:

```swift
import AppIntents

struct OpenFavoritesIntent: AppIntent {
    static var title: LocalizedStringResource = "Open Favorites"
    static var description = IntentDescription("Opens the favorites screen")

    func perform() async throws -> some IntentResult {
        NavigationManager.shared.navigate(to: .favorites)
        return .result()
    }
}
```

Users configure phrases in Settings > Accessibility > Vocal Shortcuts.

## Accessibility Announcements

```swift
AccessibilityNotification.Announcement("Item added to cart").post()
```

## SwiftUI Modifiers

### accessibilityZoomAction

```swift
PhotoView(image: photo)
    .accessibilityZoomAction { action in
        switch action.direction {
        case .zoomIn:  zoomLevel = min(zoomLevel + 0.5, 5.0)
        case .zoomOut: zoomLevel = max(zoomLevel - 0.5, 1.0)
        @unknown default: break
        }
    }
```

### Hover Effects (cross-platform)

```swift
Button("Action") { }
    .hoverEffect(.highlight)
```

### Dynamic Type Adaptive Layout

```swift
@Environment(\.dynamicTypeSize) var typeSize

var body: some View {
    if typeSize >= .accessibility1 {
        verticalLayout
    } else {
        horizontalLayout
    }
}
```

## Best Practices for iOS 18 Components

| Component | Accessibility Consideration |
|-----------|---------------------------|
| MeshGradient | Decorative: `.accessibilityHidden(true)` |
| ScrollPosition | Announce page changes for paging scroll views |
| Animation presets | Respect `.accessibilityReduceMotion` |
| SF Symbol effects | Provide text alternatives; effects are visual-only |

### Respecting Reduce Motion

```swift
@Environment(\.accessibilityReduceMotion) var reduceMotion

Image(systemName: "bell.fill")
    .symbolEffect(.bounce, value: count)
    .animation(reduceMotion ? nil : .default, value: count)
```

### MeshGradient Accessibility

```swift
ZStack {
    MeshGradient(width: 3, height: 3, points: points, colors: colors)
        .accessibilityHidden(true)
    Text("Welcome")
        .accessibilityAddTraits(.isHeader)
}
```
