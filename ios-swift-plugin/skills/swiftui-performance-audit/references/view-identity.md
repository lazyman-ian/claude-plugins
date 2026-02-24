# View Identity in SwiftUI

Understanding view identity is foundational to SwiftUI performance. Most performance issues trace back to identity instability.

## Two Types of Identity

### Structural Identity (Default)

SwiftUI assigns identity based on a view's **position in the view hierarchy**. No explicit `.id()` needed.

```swift
VStack {
    Text("Hello")   // Identity = VStack.child[0]
    Text("World")   // Identity = VStack.child[1]
}
```

**Breaks when:** Conditional branches change the structure.

```swift
// PROBLEM: SwiftUI sees TWO different views at position 0
if isLoggedIn {
    HomeView()      // Structural identity A
} else {
    LoginView()     // Structural identity B — transition destroys A
}
```

**Fix for conditional content:** Use `opacity` or `overlay` to preserve identity:

```swift
HomeView()
    .opacity(isLoggedIn ? 1 : 0)
LoginView()
    .opacity(isLoggedIn ? 0 : 1)
```

### Explicit Identity

Assigned via `.id()` modifier or `ForEach` key path.

```swift
ForEach(items, id: \.stableID) { item in
    Row(item: item)
}

Text("Counter")
    .id(counter)  // Identity changes when counter changes → view is DESTROYED and recreated
```

## Why Identity Matters for Performance

| Stable Identity | Unstable Identity |
|----------------|-------------------|
| SwiftUI diffs properties, updates in-place | SwiftUI destroys and recreates view |
| Animations interpolate smoothly | Animations break (jump cuts) |
| @State preserved | @State lost |
| O(diff) cost | O(create) cost |

## Common Identity Mistakes

### 1. `UUID()` in ForEach

```swift
// CATASTROPHIC — every render creates new IDs → all rows destroyed & recreated
ForEach(items, id: \.self) { item in  // if Item doesn't have stable Hashable
    Row(item: item)
}

// FIX: Use a stable identifier
struct Item: Identifiable {
    let id: UUID  // Created ONCE, not per render
    var name: String
}
ForEach(items) { item in  // Uses item.id automatically
    Row(item: item)
}
```

### 2. `.id()` with changing value

```swift
// BAD — .id(date) changes every second → view destroyed each time
Text(date, style: .timer)
    .id(date)

// GOOD — use .id() only for intentional identity reset
ScrollView {
    content
}
.id(selectedTab)  // Reset scroll position when tab changes (intentional)
```

### 3. `AnyView` erases identity

```swift
// BAD — AnyView hides the concrete type, breaking SwiftUI's diffing
func makeView() -> AnyView {
    if condition {
        return AnyView(Text("A"))
    } else {
        return AnyView(Image("B"))
    }
}

// GOOD — use @ViewBuilder
@ViewBuilder
func makeView() -> some View {
    if condition {
        Text("A")
    } else {
        Image("B")
    }
}
```

### 4. ForEach with `.indices`

```swift
// BAD — index identity is position-based, breaks on insert/delete
ForEach(items.indices, id: \.self) { index in
    Row(item: items[index])
}

// GOOD — use item identity
ForEach(items) { item in
    Row(item: item)
}
```

## Equatable Optimization

When a view conforms to `Equatable`, SwiftUI can skip `body` re-evaluation entirely if properties haven't changed.

```swift
struct ExpensiveRow: View, Equatable {
    let item: Item
    let isSelected: Bool

    static func == (lhs: Self, rhs: Self) -> Bool {
        lhs.item.id == rhs.item.id && lhs.isSelected == rhs.isSelected
    }

    var body: some View {
        // Expensive rendering — only called when == returns false
        HStack {
            ComplexChart(data: item.data)
            Text(item.name)
        }
    }
}

// Apply the optimization
ForEach(items) { item in
    ExpensiveRow(item: item, isSelected: item.id == selectedID)
        .equatable()  // Enables Equatable check before body eval
}
```

**When to use:**
- Views with expensive `body` computation
- Views in lists/grids that rarely change individually
- Views receiving broad state changes where most properties stay the same

**When NOT to use:**
- Simple views (overhead of `==` check > body cost)
- Views where all properties change together anyway

**Risk:** If `==` returns `true` incorrectly, the view becomes stale (shows old data). Only include properties that affect the visual output.

## Debugging Identity

1. **Instruments SwiftUI template** → shows view identity changes and body evaluations
2. **`let _ = Self._printChanges()`** in body → prints which properties triggered re-evaluation
3. **`let _ = print("body evaluated")`** → count how often body runs

```swift
var body: some View {
    let _ = Self._printChanges()  // Debug only — remove before shipping
    Text(item.name)
}
```

## Sources

- [Apple WWDC22: Demystify SwiftUI](https://developer.apple.com/videos/play/wwdc2022/10052/)
- [Apple WWDC23: Demystify SwiftUI performance](https://developer.apple.com/videos/play/wwdc2023/10160/)
- [Majid: View Identity in SwiftUI](https://swiftwithmajid.com/2021/12/09/structural-identity-in-swiftui/)
