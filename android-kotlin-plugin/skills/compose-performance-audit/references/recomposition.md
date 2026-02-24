# Recomposition Reference

## How Recomposition Works

Compose uses a **snapshot system** to track state reads. When a composable reads a `State<T>` (e.g., `mutableStateOf`), the snapshot system records that dependency. When the state changes, the snapshot system schedules **recomposition** — re-running the composable function to produce an updated UI tree.

### Recomposition Scope

Compose does not recompose the entire tree. It finds the smallest enclosing **restart scope** that reads the changed state and re-runs only that scope.

```kotlin
@Composable
fun Parent() {
    var count by remember { mutableStateOf(0) }
    // count is read here — this entire lambda is the restart scope
    Text("Count: $count")
    // Button does not read count — not recomposed
    Button(onClick = { count++ }) { Text("Increment") }
}
```

Moving the state read deeper reduces the recomposition scope:

```kotlin
// Better: CountText is its own restart scope
@Composable
fun Parent() {
    var count by remember { mutableStateOf(0) }
    CountText(count)
    Button(onClick = { count++ }) { Text("Increment") }
}

@Composable
fun CountText(count: Int) {
    Text("Count: $count")
}
```

## Smart Recomposition and Skipping

When a composable is re-invoked during recomposition, Compose checks if its parameters have changed. If all parameters are equal (and the function is skippable), Compose **skips** execution entirely — the previous composition is reused.

Equality check depends on stability:
- Stable params: compared via `equals()`
- Unstable params (without strong skipping): compared by reference identity only

## State Reads and Their Scope

Where you read state determines what gets recomposed.

### Read in Composition (Widest Scope)
```kotlin
@Composable
fun Item(viewModel: ItemViewModel) {
    val price = viewModel.price.value  // read in composition
    Text(text = "$$price")            // whole composable restarts on price change
}
```

### Read in a Lambda (Narrower Scope — Deferred)
```kotlin
@Composable
fun Item(viewModel: ItemViewModel) {
    Text(
        text = { "$ ${viewModel.price.value}" }  // read deferred to draw phase
        // Only the draw phase re-runs, not the full composable
    )
    // Note: Text doesn't accept a lambda — this is illustrative
    // Use Modifier.drawWithContent or graphicsLayer for real deferred reads
}
```

### Read in Modifier.graphicsLayer (Draw Phase Only)
```kotlin
@Composable
fun FadingItem(alpha: State<Float>) {
    Box(
        modifier = Modifier.graphicsLayer {
            this.alpha = alpha.value  // read in draw phase, no recomposition
        }
    ) {
        HeavyContent()
    }
}
```

## derivedStateOf — Computed State

Use `derivedStateOf` when a computed value depends on state but changes less frequently than the source state.

```kotlin
// Bad: filter runs every recomposition even when query didn't change
@Composable
fun SearchResults(query: String, allItems: List<Item>) {
    val filtered = allItems.filter { it.name.contains(query) }
    LazyColumn { items(filtered) { ItemRow(it) } }
}

// Good: only recomposes when filtered result actually changes
@Composable
fun SearchResults(query: String, allItems: List<Item>) {
    val filtered by remember(query, allItems) {
        derivedStateOf { allItems.filter { it.name.contains(query) } }
    }
    LazyColumn { items(filtered) { ItemRow(it) } }
}
```

### derivedStateOf vs remember with keys

| Scenario | Use |
|----------|-----|
| Filtering/sorting a list | `derivedStateOf` |
| Threshold check on frequently-changing state | `derivedStateOf` |
| Simple transformation called infrequently | `remember(key) { ... }` |
| Value computed once from stable input | `remember { ... }` |

```kotlin
// derivedStateOf: recomposes only when list crosses threshold
val isListEmpty by remember { derivedStateOf { list.isEmpty() } }

// remember with key: recomputes when sortOrder changes (expected to be rare)
val sorted = remember(sortOrder, items) { items.sortedWith(sortOrder.comparator) }
```

## remember Keys

`remember` caches a value and recomputes when its keys change. Choose keys carefully.

```kotlin
// No key: computed once, never invalidated (correct for constants)
val formatter = remember { DateTimeFormatter.ofPattern("MMM d, yyyy") }

// Key = id: recomputes when the item changes
val formattedDate = remember(item.createdAt) {
    formatter.format(item.createdAt)
}

// Multiple keys
val displayName = remember(user.firstName, user.lastName) {
    "${user.firstName} ${user.lastName}"
}
```

Avoid using unstable objects as keys — they may produce unnecessary recomputations:
```kotlin
// Bad: list is a new instance every time (even if content is same)
val sorted = remember(list) { list.sortedBy { it.name } }

// Better: use ImmutableList or move sorting to ViewModel
```

## Layout Inspector: Recomposition Counts

Android Studio → Layout Inspector → Enable "Highlight recomposing composables"

Interpret counts:
- Count 0: Never recomposed (cold start)
- Count 1-5 over interaction: Expected
- Count 100+ during scroll: Likely a stability issue
- Rapidly incrementing on a composable that isn't changing data: State read too broad

## Compose Compiler Reports Interpretation

`*-composables.txt` example:
```
restartable skippable fun ProductCard(
  stable modifier: Modifier
  unstable product: Product     <- root cause
)
```

`product: Product` is unstable → ProductCard recomposes even when product data didn't change.

Fix: annotate `Product` with `@Immutable` or use a stable wrapper.

## graphicsLayer for Animation Without Recomposition

Animations that only affect visual properties (alpha, scale, rotation, translation) should use `graphicsLayer` to avoid recomposing the subtree.

```kotlin
// Triggers recomposition on every animation frame
@Composable
fun SlideIn(visible: Boolean, content: @Composable () -> Unit) {
    val offset by animateDpAsState(if (visible) 0.dp else (-100).dp)
    Box(modifier = Modifier.offset(y = offset)) { content() }
}

// No recomposition — only graphics layer updated each frame
@Composable
fun SlideIn(visible: Boolean, content: @Composable () -> Unit) {
    val offsetPx by animateFloatAsState(if (visible) 0f else -300f)
    Box(modifier = Modifier.graphicsLayer { translationY = offsetPx }) { content() }
}
```

`graphicsLayer` properties: `alpha`, `scaleX`, `scaleY`, `rotationZ`, `translationX`, `translationY`, `shadowElevation`, `clip`.

## Common Patterns That Cause Unnecessary Recomposition

### 1. Object creation in composition
```kotlin
// Bad: new Color object every recomposition
Text(color = Color(0xFF123456))

// Good: hoisted constant
private val MyColor = Color(0xFF123456)
Text(color = MyColor)
```

### 2. ViewModel passed directly
```kotlin
// Bad: ViewModel is unstable, recomposes every parent recomposition
@Composable
fun Screen(viewModel: MyViewModel) {
    Content(viewModel)  // unstable ref
}

// Good: pass derived state
@Composable
fun Screen(viewModel: MyViewModel) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    Content(state)  // stable data class
}
```

### 3. Reading entire UiState when only one field is needed
```kotlin
// Bad: recomposes Header when items change, Content when title changes
@Composable
fun Screen(state: ScreenUiState) {
    Header(state.title)
    Content(state.items)
}

// Better: split ViewModel state into separate StateFlows
val titleFlow: StateFlow<String>
val itemsFlow: StateFlow<ImmutableList<Item>>
```

### 4. Modifier.composed (deprecated)
```kotlin
// Bad: composed creates a new modifier on every recomposition
fun Modifier.highlight() = composed {
    val color = LocalHighlightColor.current
    background(color)
}

// Good: Modifier.Node — allocated once
class HighlightNode(var color: Color) : DrawModifierNode, Modifier.Node() {
    override fun ContentDrawScope.draw() {
        drawRect(color)
        drawContent()
    }
}
```
