# MeshGradient Guide (iOS 18+)

Reference for creating and animating mesh gradients in SwiftUI.

## Constructor

```swift
MeshGradient(
    width: Int,              // columns
    height: Int,             // rows
    points: [SIMD2<Float>],  // positions (0.0...1.0 normalized)
    colors: [Color]          // one color per point
)
```

- `points.count` must equal `width * height`
- Edge points should be at 0.0 or 1.0 to fill the frame
- Points are in row-major order (left to right, top to bottom)

## Grid Examples

### 2x2 Grid

```swift
MeshGradient(width: 2, height: 2, points: [
    [0.0, 0.0], [1.0, 0.0],
    [0.0, 1.0], [1.0, 1.0]
], colors: [.blue, .purple, .cyan, .pink])
```

### 3x3 Grid

```swift
MeshGradient(width: 3, height: 3, points: [
    [0.0, 0.0], [0.5, 0.0], [1.0, 0.0],
    [0.0, 0.5], [0.5, 0.5], [1.0, 0.5],
    [0.0, 1.0], [0.5, 1.0], [1.0, 1.0]
], colors: [
    .red,    .purple, .indigo,
    .orange, .cyan,   .blue,
    .yellow, .green,  .mint
])
```

## Animating Points

Move interior control points for organic motion. Keep edge points fixed.

```swift
struct AnimatedMeshView: View {
    @State private var isAnimating = false

    var points: [SIMD2<Float>] {
        let offset: Float = isAnimating ? 0.15 : -0.15
        return [
            [0.0, 0.0], [0.5, 0.0],                     [1.0, 0.0],
            [0.0, 0.5], [0.5 + offset, 0.5 + offset],   [1.0, 0.5],
            [0.0, 1.0], [0.5, 1.0],                     [1.0, 1.0]
        ]
    }

    var body: some View {
        MeshGradient(width: 3, height: 3, points: points, colors: [
            .red,    .purple, .indigo,
            .orange, .cyan,   .blue,
            .yellow, .green,  .mint
        ])
        .onAppear {
            withAnimation(.easeInOut(duration: 3).repeatForever(autoreverses: true)) {
                isAnimating = true
            }
        }
        .ignoresSafeArea()
    }
}
```

## Animating Colors

```swift
@State private var usePalette2 = false

let palette1: [Color] = [.blue, .purple, .indigo, .cyan, .teal, .blue, .mint, .green, .cyan]
let palette2: [Color] = [.orange, .red, .pink, .yellow, .orange, .red, .mint, .yellow, .orange]

MeshGradient(width: 3, height: 3, points: fixedPoints, colors: usePalette2 ? palette2 : palette1)
    .onAppear {
        withAnimation(.easeInOut(duration: 4).repeatForever(autoreverses: true)) {
            usePalette2 = true
        }
    }
```

## Combining with Effects

```swift
// Blur overlay for backgrounds
ZStack {
    MeshGradient(width: 3, height: 3, points: points, colors: colors)
        .blur(radius: 30)
    Text("Welcome").font(.largeTitle).foregroundStyle(.white)
}

// Card background using fill
RoundedRectangle(cornerRadius: 20)
    .fill(MeshGradient(width: 2, height: 2, points: [
        [0.0, 0.0], [1.0, 0.0],
        [0.0, 1.0], [1.0, 1.0]
    ], colors: [.blue, .purple, .cyan, .indigo]))
    .frame(height: 200)
```

## Performance

- Prefer 3x3 grids; 4x4 is the practical maximum
- Animating both points and colors simultaneously increases GPU work
- Use `.drawingGroup()` when layering multiple mesh gradients
- Avoid mesh gradients inside frequently re-rendered list cells

## Compatibility

Available: iOS 18+, macOS 15+, visionOS 2+. Not available on watchOS.

```swift
if #available(iOS 18, *) {
    MeshGradient(width: 3, height: 3, points: points, colors: colors)
} else {
    LinearGradient(colors: [.blue, .purple], startPoint: .topLeading, endPoint: .bottomTrailing)
}
```
