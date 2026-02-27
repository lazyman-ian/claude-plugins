# iOS 18 Animation Presets

Complete guide to new animation APIs introduced in iOS 18.

## Animation Presets

iOS 18 adds preset animations directly on `View`.

### .wiggle

```swift
Text("Error")
    .wiggle(.forward, count: 3)
```

- `direction`: `.forward`, `.backward`, `.clockwise`, `.counterClockwise`
- `count`: Number of oscillations (default 1)

### .breathe

```swift
Circle()
    .frame(width: 40, height: 40)
    .breathe()

Image(systemName: "heart.fill")
    .breathe(.pulse)
```

- `style`: `.plain` (default), `.pulse`

### .bounce

```swift
Button("Add to Cart") { addItem() }
    .bounce(.up)
```

- `direction`: `.up`, `.down`
- `count`: Number of bounces

### .rotate

```swift
Image(systemName: "gear")
    .rotate(.clockwise)
```

- `direction`: `.clockwise`, `.counterClockwise`
- `anchor`: `UnitPoint` (default `.center`)

## PhaseAnimator

Drives multi-phase animations using an enum to define states.

```swift
enum BouncePhase: CaseIterable {
    case initial, scaled, rotated, final
    var scale: CGFloat { self == .scaled ? 1.5 : self == .rotated ? 1.2 : 1.0 }
    var rotation: Angle { self == .rotated ? .degrees(45) : .zero }
}

PhaseAnimator(BouncePhase.allCases) { phase in
    Image(systemName: "star.fill")
        .scaleEffect(phase.scale)
        .rotationEffect(phase.rotation)
} animation: { phase in
    switch phase {
    case .initial: .spring(duration: 0.3)
    case .scaled: .easeInOut(duration: 0.4)
    case .rotated: .spring(bounce: 0.5)
    case .final: .easeOut(duration: 0.3)
    }
}
```

Trigger on value change:

```swift
PhaseAnimator(BouncePhase.allCases, trigger: tapCount) { phase in
    // content
} animation: { _ in .spring }
```

## KeyframeAnimator

Precise keyframe-based animation with `KeyframeTrack`.

```swift
struct AnimationValues {
    var scale: CGFloat = 1.0
    var yOffset: CGFloat = 0.0
    var opacity: Double = 1.0
}

KeyframeAnimator(initialValue: AnimationValues(), trigger: isAnimating) { values in
    Image(systemName: "bubble.fill")
        .scaleEffect(values.scale)
        .offset(y: values.yOffset)
        .opacity(values.opacity)
} keyframes: { _ in
    KeyframeTrack(\.scale) {
        SpringKeyframe(1.5, duration: 0.3, spring: .bouncy)
        CubicKeyframe(1.0, duration: 0.2)
    }
    KeyframeTrack(\.yOffset) {
        LinearKeyframe(-20, duration: 0.2)
        SpringKeyframe(0, duration: 0.4, spring: .bouncy)
    }
    KeyframeTrack(\.opacity) {
        LinearKeyframe(0.5, duration: 0.1)
        LinearKeyframe(1.0, duration: 0.3)
    }
}
```

Keyframe types:
- `LinearKeyframe` -- constant velocity interpolation
- `SpringKeyframe` -- spring-driven motion
- `CubicKeyframe` -- cubic Bezier curve
- `MoveKeyframe` -- jump without interpolation

## Spring Presets

```swift
withAnimation(.spring(.bouncy))  { isExpanded.toggle() }
withAnimation(.spring(.smooth))  { offset = newOffset }
withAnimation(.spring(.snappy))  { selectedTab = newTab }
```

- `.bouncy` -- high bounce, playful feel
- `.smooth` -- no bounce, gentle deceleration
- `.snappy` -- minimal bounce, quick settle

## Transition Improvements

Matched geometry transitions for navigation:

```swift
NavigationLink(value: item) {
    ItemThumbnail(item)
        .matchedTransitionSource(id: item.id, in: namespace)
}

// Destination
ItemDetail(item)
    .navigationTransition(.zoom(sourceID: item.id, in: namespace))
```

## SF Symbol Effects

```swift
Image(systemName: "bell.fill")
    .symbolEffect(.bounce, value: count)

Image(systemName: "mic.fill")
    .symbolEffect(.pulse)

Image(systemName: "wifi")
    .symbolEffect(.variableColor.iterative.reversing)

Image(systemName: "bell.and.waves.left.and.right")
    .symbolEffect(.wiggle)

Image(systemName: isPlaying ? "pause.fill" : "play.fill")
    .contentTransition(.symbolEffect(.replace))
```

## Performance Considerations

- Prefer `.transaction` blocks over nested `withAnimation` calls
- PhaseAnimator re-renders for each phase -- keep phase count under 6
- KeyframeAnimator: fewer tracks = better performance
- Avoid animating views with heavy body computations
- Use `.drawingGroup()` for complex layered animations
- Profile with Instruments > Animation Hitches template when frame drops occur
