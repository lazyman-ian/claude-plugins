---
name: ios-modern-apis
description: Provides reference for iOS 18+ new APIs including MeshGradient, scroll position tracking, animation presets (wiggle, breathe, bouncy), KeyframeAnimator, and accessibility enhancements. This skill should be used when adopting iOS 18+ features, implementing new animations, using scroll tracking APIs, or adding MeshGradient effects. Triggers on "iOS 18", "MeshGradient", "scroll position", "wiggle animation", "breathe animation", "KeyframeAnimator", "ScrollView position", "iOS 18 新 API", "网格渐变", "滚动位置", "新动画", "现代API", "新API", "iOS新特性", "最新API". Do NOT use for SwiftUI best practices or view composition — use swiftui-expert instead. Do NOT use for iOS 26 Liquid Glass — use swiftui-liquid-glass instead.
memory: project
allowed-tools: [Read, Glob, Grep, Edit, Write, mcp__xcode__*, mcp__apple-docs__*]
---

# iOS Modern APIs

iOS 18+ new SwiftUI and UIKit APIs.

## Scope Boundary

| This Skill | Other Skill |
|-----------|-------------|
| MeshGradient, scroll position, animations, SF Symbol effects, accessibility | - |
| Apple Intelligence APIs (18.1+) | - |
| - | swiftui-expert (view composition) |
| - | swiftui-performance-audit (rendering) |
| - | swiftui-liquid-glass (iOS 26 Liquid Glass) |
| - | swift-concurrency (actors, async/await) |

## iOS Version Feature Map

| iOS Version | Key Features |
|-------------|-------------|
| iOS 18 | MeshGradient, scroll position, animation presets, SF Symbol effects |
| iOS 18.1 | Apple Intelligence APIs, Writing Tools |
| iOS 18.2 | Image Playground, Genmoji |
| iOS 26 | Liquid Glass (use swiftui-liquid-glass skill) |

## Animation Framework

iOS 18 introduces built-in animation presets on any `View`:

```swift
// iOS 18+
Text("Notification")
    .wiggle(.forward, count: 3)

Image(systemName: "heart.fill")
    .breathe()

Button("Add") { }
    .bounce(.up)
```

See `references/animation-presets.md` for PhaseAnimator, KeyframeAnimator, and custom animations.

## Scroll Position

Track and control scroll position with the new `ScrollPosition` type:

```swift
// iOS 18+
@State private var position = ScrollPosition(edge: .top)

ScrollView {
    LazyVStack {
        ForEach(items) { item in
            ItemRow(item: item)
        }
    }
}
.scrollPosition($position)
.onChange(of: position) { oldValue, newValue in
    // React to scroll changes
}
```

Detect geometry changes:

```swift
ScrollView {
    content
}
.onScrollGeometryChange(for: CGFloat.self) { geometry in
    geometry.contentOffset.y
} action: { oldValue, newValue in
    showHeader = newValue < 100
}
```

See `references/scroll-position-guide.md` for parallax, sticky headers, and paging.

## MeshGradient Quick Start

```swift
// iOS 18+
MeshGradient(
    width: 3, height: 3,
    points: [
        [0.0, 0.0], [0.5, 0.0], [1.0, 0.0],
        [0.0, 0.5], [0.5, 0.5], [1.0, 0.5],
        [0.0, 1.0], [0.5, 1.0], [1.0, 1.0]
    ],
    colors: [
        .red,    .purple, .indigo,
        .orange, .cyan,   .blue,
        .yellow, .green,  .mint
    ]
)
.ignoresSafeArea()
```

See `references/meshgradient-guide.md` for animation and advanced usage.

## SF Symbol Effects

iOS 18 adds symbol effect modifiers:

```swift
Image(systemName: "bell.fill")
    .symbolEffect(.bounce, value: notificationCount)

Image(systemName: "wifi")
    .symbolEffect(.variableColor.iterative)

Image(systemName: "arrow.clockwise")
    .symbolEffect(.pulse)

// Replace with animation
Image(systemName: isPlaying ? "pause.fill" : "play.fill")
    .contentTransition(.symbolEffect(.replace))
```

## Availability Pattern

```swift
if #available(iOS 18, *) {
    MeshGradient(width: 3, height: 3, points: points, colors: colors)
} else {
    LinearGradient(colors: [.blue, .purple], startPoint: .top, endPoint: .bottom)
}
```

## References

| Category | File |
|----------|------|
| Animations | `references/animation-presets.md` |
| Scroll Position | `references/scroll-position-guide.md` |
| MeshGradient | `references/meshgradient-guide.md` |
| Accessibility | `references/accessibility-ios18.md` |

For topics not covered above, search Apple developer documentation via mcp__apple-docs.
