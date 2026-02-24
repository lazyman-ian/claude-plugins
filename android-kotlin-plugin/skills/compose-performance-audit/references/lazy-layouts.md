# Lazy Layouts Reference

## Core Concepts

`LazyColumn`, `LazyRow`, and `LazyVerticalGrid` only compose and lay out items that are currently visible (plus a small prefetch buffer). Performance depends on:
1. Items can be **skipped** (stable, skippable composables)
2. Items can be **recycled** (correct `contentType`)
3. Items have **stable identity** (correct `key`)
4. Item layout is **cheap** (no intrinsic measurements, minimal nesting)

## key Parameter

The `key` parameter gives each item a stable identity across data changes. Without it, Compose uses position — causing unnecessary recompositions when items are inserted, removed, or reordered.

```kotlin
// Bad: position-based identity
LazyColumn {
    items(users) { user ->
        UserRow(user)
    }
}

// Good: stable ID-based identity
LazyColumn {
    items(users, key = { it.id }) { user ->
        UserRow(user)
    }
}
```

Key rules:
- Must be stable (primitive, String, or parcelable)
- Must be unique within the list
- Must be consistent across recompositions
- Enables animated item placement (`Modifier.animateItem()`)

```kotlin
// Animated reordering requires keys
LazyColumn {
    items(sortedItems, key = { it.id }) { item ->
        ItemRow(
            item = item,
            modifier = Modifier.animateItem()
        )
    }
}
```

## contentType Parameter

`contentType` tells Compose which item composables can share the same composition slot (recycling). Without it, every distinct position gets its own slot.

```kotlin
sealed class FeedItem {
    data class Post(val id: String, val text: String) : FeedItem()
    data class Ad(val id: String, val imageUrl: String) : FeedItem()
    data class Header(val title: String) : FeedItem()
}

LazyColumn {
    items(
        items = feedItems,
        key = { item ->
            when (item) {
                is FeedItem.Post -> "post_${item.id}"
                is FeedItem.Ad -> "ad_${item.id}"
                is FeedItem.Header -> "header_${item.title}"
            }
        },
        contentType = { item ->
            when (item) {
                is FeedItem.Post -> "post"
                is FeedItem.Ad -> "ad"
                is FeedItem.Header -> "header"
            }
        }
    ) { item ->
        when (item) {
            is FeedItem.Post -> PostItem(item)
            is FeedItem.Ad -> AdItem(item)
            is FeedItem.Header -> HeaderItem(item)
        }
    }
}
```

## Stable Items for Skipping

Each item composable should be skippable. For this, item data must be stable.

```kotlin
// Bad: Item is unstable (List field), recomposes every time
data class Post(val id: String, val tags: List<String>)

@Composable
fun PostItem(post: Post) { ... }  // non-skippable

// Good: stable item
@Immutable
data class Post(val id: String, val tags: ImmutableList<String>)

@Composable
fun PostItem(post: Post) { ... }  // skippable
```

## rememberLazyListState

Use `rememberLazyListState` to control scroll position and observe scroll state.

```kotlin
@Composable
fun ScrollableList(items: ImmutableList<Item>) {
    val listState = rememberLazyListState()
    val scope = rememberCoroutineScope()

    LazyColumn(state = listState) {
        items(items, key = { it.id }) { item ->
            ItemRow(item)
        }
    }

    // Scroll to top button
    val showButton by remember {
        derivedStateOf { listState.firstVisibleItemIndex > 0 }
    }
    if (showButton) {
        ScrollToTopButton(onClick = {
            scope.launch { listState.animateScrollToItem(0) }
        })
    }
}
```

Key properties:
- `firstVisibleItemIndex` — index of first fully visible item
- `firstVisibleItemScrollOffset` — pixel offset of first visible item
- `isScrollInProgress` — true during active scroll

## Prefetch and Layout Optimization

Lazy layouts prefetch items just outside the visible area. Long item layout time blocks the prefetch thread.

Keep item layout fast:
- Avoid `Modifier.fillMaxWidth()` with unconstrained height — forces full measure
- Avoid `intrinsicSize` measurements (triggers double measure pass)
- Avoid deep nesting — each nesting level adds layout overhead
- Fixed-height items are cheapest (no wrap_content measure)

```kotlin
// Bad: intrinsic measurement forces double-measure pass
Row(modifier = Modifier.height(IntrinsicSize.Min)) {
    Divider(modifier = Modifier.fillMaxHeight())
    Text("Content")
}

// Good: explicit height avoids intrinsic measurement
Row(modifier = Modifier.height(48.dp)) {
    Divider(modifier = Modifier.fillMaxHeight())
    Text("Content", modifier = Modifier.align(Alignment.CenterVertically))
}
```

## Nested Scrolling Considerations

Nested scrollable layouts (LazyColumn inside ScrollColumn) are prohibited — both try to control scroll.

```kotlin
// Bad: LazyColumn in vertically scrollable Column — crash
Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
    LazyColumn { ... }  // IllegalStateException
}

// Good: use a single LazyColumn with sections
LazyColumn {
    // Header content
    item { HeaderSection() }
    item { AnotherSection() }

    // Dynamic list items
    items(list, key = { it.id }) { ItemRow(it) }
}
```

For complex mixed layouts, use `LazyColumn` DSL sections:
```kotlin
LazyColumn {
    item(key = "header") { PageHeader() }
    item(key = "promo") { PromoBanner() }

    stickyHeader(key = "section-title") { SectionTitle("Items") }

    items(items, key = { it.id }, contentType = { "item" }) {
        ItemRow(it)
    }

    item(key = "footer") { Footer() }
}
```

## Sticky Headers

```kotlin
LazyColumn {
    groupedItems.forEach { (group, items) ->
        stickyHeader(key = "header_$group") {
            GroupHeader(title = group)
        }
        items(items, key = { it.id }) { item ->
            ItemRow(item)
        }
    }
}
```

`stickyHeader` pins to the top of the visible area until the next sticky header scrolls into view.

## Paging 3 Integration

Paging 3 integrates directly with LazyColumn via `collectAsLazyPagingItems`.

```kotlin
@Composable
fun PagedList(viewModel: ListViewModel) {
    val lazyItems = viewModel.pager.collectAsLazyPagingItems()

    LazyColumn {
        items(
            count = lazyItems.itemCount,
            key = lazyItems.itemKey { it.id },
            contentType = lazyItems.itemContentType { "item" }
        ) { index ->
            val item = lazyItems[index]
            if (item != null) {
                ItemRow(item)
            } else {
                PlaceholderItem()
            }
        }

        // Load state handling
        when (val state = lazyItems.loadState.append) {
            is LoadState.Loading -> item { LoadingIndicator() }
            is LoadState.Error -> item { ErrorItem(state.error, lazyItems::retry) }
            else -> {}
        }
    }
}
```

Use `lazyItems.itemKey` and `lazyItems.itemContentType` helpers — they handle null placeholders correctly.

## LazyVerticalGrid

```kotlin
LazyVerticalGrid(
    columns = GridCells.Adaptive(minSize = 180.dp),
    contentPadding = PaddingValues(16.dp),
    horizontalArrangement = Arrangement.spacedBy(8.dp),
    verticalArrangement = Arrangement.spacedBy(8.dp)
) {
    items(
        items = photos,
        key = { it.id },
        contentType = { "photo" }
    ) { photo ->
        PhotoCard(photo)
    }
}
```

`GridCells.Adaptive(minSize)` — as many columns as fit while each is at least `minSize`.
`GridCells.Fixed(count)` — always `count` columns.

## Custom LazyLayout (Advanced)

For highly customized layouts (e.g., staggered grid, radial list), implement `LazyLayout`:

```kotlin
@Composable
fun StaggeredGrid(
    items: ImmutableList<Item>,
    modifier: Modifier = Modifier
) {
    val itemProvider = rememberLazyItemProvider(items)

    LazyLayout(
        itemProvider = itemProvider,
        modifier = modifier
    ) { constraints ->
        // Custom measurement and placement
        val columnWidth = constraints.maxWidth / 2
        // measure and place items manually
    }
}
```

Use `LazyLayoutItemProvider` to supply composable items and `LazyLayoutPrefetchState` to hint prefetch.

## Performance Checklist

| Check | Issue if missing |
|-------|-----------------|
| `key = { it.id }` on all items | Position-based identity, broken animations |
| `contentType` for mixed lists | No slot recycling across types |
| Stable item data classes | Items not skippable, recompose every scroll |
| No intrinsic measurements in items | Double-measure pass, slow scroll |
| No nested LazyColumn in ScrollColumn | Crash or disabled scrolling |
| `rememberLazyListState` for scroll control | Can't scroll programmatically |
| Fixed or bounded item height | Unbounded measure pass |
