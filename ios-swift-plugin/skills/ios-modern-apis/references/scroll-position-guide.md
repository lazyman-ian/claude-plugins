# Scroll Position APIs (iOS 18+)

Guide to scroll position tracking and control in SwiftUI.

## ScrollPosition Type

### Identity-Based Tracking

```swift
@State private var position = ScrollPosition(idType: Item.ID.self)

ScrollView {
    LazyVStack {
        ForEach(items) { item in
            ItemRow(item: item)
        }
    }
}
.scrollPosition(id: $position)
```

### Offset-Based Tracking

```swift
@State private var position = ScrollPosition(edge: .top)

ScrollView { content }
    .scrollPosition($position)

let currentY = position.point?.y ?? 0
```

### Programmatic Scrolling

```swift
position.scrollTo(id: targetItem.id)
position.scrollTo(edge: .top)
position.scrollTo(point: CGPoint(x: 0, y: 500))
position.scrollTo(id: targetItem.id, anchor: .center)
```

## onScrollGeometryChange

```swift
ScrollView { content }
    .onScrollGeometryChange(for: CGFloat.self) { geometry in
        geometry.contentOffset.y
    } action: { oldValue, newValue in
        showNavBar = newValue > 50
    }
```

Available properties: `contentOffset` (CGPoint), `contentSize` (CGSize), `contentInsets` (EdgeInsets), `containerSize` (CGSize), `visibleRect` (CGRect).

## onScrollVisibilityChange

```swift
LazyVStack {
    ForEach(items) { item in
        ItemRow(item: item)
            .onScrollVisibilityChange(threshold: 0.5) { isVisible in
                if isVisible { analyticsTracker.trackImpression(item.id) }
            }
    }
}
```

## scrollTargetBehavior

```swift
// View-aligned scrolling
ScrollView(.horizontal) {
    LazyHStack(spacing: 16) {
        ForEach(cards) { card in
            CardView(card: card)
                .containerRelativeFrame(.horizontal)
        }
    }
    .scrollTargetLayout()
}
.scrollTargetBehavior(.viewAligned)

// Paging
ScrollView(.horizontal) { content }
    .scrollTargetBehavior(.paging)
```

## ScrollTransition

Apply visual effects based on scroll phase:

```swift
ScrollView(.horizontal) {
    LazyHStack(spacing: 16) {
        ForEach(items) { item in
            ItemCard(item: item)
                .scrollTransition { content, phase in
                    content
                        .opacity(phase.isIdentity ? 1.0 : 0.5)
                        .scaleEffect(phase.isIdentity ? 1.0 : 0.85)
                }
        }
    }
}
```

Phase values: `.identity` (fully visible), `.topLeading` (approaching), `.bottomTrailing` (leaving).

## Practical Examples

### Sticky Header

```swift
@State private var showCompactHeader = false

ZStack(alignment: .top) {
    ScrollView {
        VStack {
            Text("Full Header").font(.largeTitle).frame(height: 200)
            LazyVStack { /* content */ }
        }
    }
    .onScrollGeometryChange(for: Bool.self) { geo in
        geo.contentOffset.y > 150
    } action: { _, isScrolled in
        withAnimation(.easeInOut(duration: 0.2)) { showCompactHeader = isScrolled }
    }

    if showCompactHeader {
        CompactHeaderView()
            .transition(.move(edge: .top).combined(with: .opacity))
    }
}
```

### Infinite Scroll

```swift
@State private var isLoadingMore = false

ScrollView {
    LazyVStack {
        ForEach(items) { item in ItemRow(item: item) }
        if isLoadingMore { ProgressView() }
    }
}
.onScrollGeometryChange(for: Bool.self) { geo in
    geo.contentSize.height - geo.contentOffset.y - geo.containerSize.height < 100
} action: { _, isNearBottom in
    guard isNearBottom, !isLoadingMore else { return }
    isLoadingMore = true
    Task {
        await loadMoreItems()
        isLoadingMore = false
    }
}
```
