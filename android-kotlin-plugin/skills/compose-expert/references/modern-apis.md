# Modern Compose APIs

## Accompanist → Built-in Replacements

| Accompanist Library | Built-in Replacement | Since | Migration Notes |
|--------------------|---------------------|-------|-----------------|
| `accompanist-systemuicontroller` | `Activity.enableEdgeToEdge()` + `WindowInsetsController` | API 21+ | Call in `onCreate`, before `setContent` |
| `accompanist-pager` | `HorizontalPager` / `VerticalPager` (foundation) | Compose 1.4 | API nearly identical |
| `accompanist-pager-indicators` | `PagerState` + custom indicator | Compose 1.4 | Build custom with `pagerState.currentPage` |
| `accompanist-navigation-animation` | `NavHost` animated transitions (built-in) | Nav 2.7 | `enterTransition`/`exitTransition` params |
| `accompanist-flowlayout` | `FlowRow` / `FlowColumn` (foundation) | Compose 1.5 | `maxItemsInEachRow` instead of `mainAxisSpacing` |
| `accompanist-swiperefresh` | `PullToRefreshBox` / `PullToRefreshContainer` (M3) | M3 1.2 | Wrap content in `PullToRefreshBox` |
| `accompanist-placeholder` | `Modifier.shimmer()` (custom) or `LoadingPainter` | — | Build with `InfiniteTransition` |
| `accompanist-permissions` | Still recommended (no built-in yet) | — | `rememberPermissionState` |
| `accompanist-webview` | Still recommended | — | `WebView` via `AndroidView` |

### Edge-to-Edge Migration

```kotlin
// ❌ Old accompanist approach
val systemUiController = rememberSystemUiController()
SideEffect {
    systemUiController.setStatusBarColor(Color.Transparent, darkIcons = !darkTheme)
}

// ✅ Modern approach
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()  // Call BEFORE super.onCreate or setContent
        super.onCreate(savedInstanceState)
        setContent {
            AppTheme {
                Scaffold(modifier = Modifier.fillMaxSize()) { innerPadding ->
                    // innerPadding contains window insets
                    MyApp(modifier = Modifier.padding(innerPadding))
                }
            }
        }
    }
}
```

### HorizontalPager Migration

```kotlin
// ❌ Accompanist Pager
val pagerState = rememberPagerState()
HorizontalPager(count = pages.size, state = pagerState) { page -> ... }

// ✅ Foundation Pager
val pagerState = rememberPagerState(pageCount = { pages.size })
HorizontalPager(state = pagerState) { page -> ... }

// Page indicator
Row(horizontalArrangement = Arrangement.Center) {
    repeat(pagerState.pageCount) { index ->
        Box(
            modifier = Modifier
                .size(if (pagerState.currentPage == index) 10.dp else 8.dp)
                .clip(CircleShape)
                .background(if (pagerState.currentPage == index) Primary else Secondary)
        )
    }
}
```

## Modifier.Node API

Replaces the older `composed` modifier for custom modifiers. More performant — allocated once, not per recomposition.

```kotlin
// ❌ Old composed modifier (re-allocated every recomposition)
fun Modifier.myCustomModifier(color: Color) = composed {
    val animatedColor by animateColorAsState(color)
    background(animatedColor)
}

// ✅ New Modifier.Node API
class ColorNode(var color: Color) : DrawModifierNode, Modifier.Node() {
    override fun ContentDrawScope.draw() {
        drawRect(color)
        drawContent()
    }
}

data class ColorElement(val color: Color) : ModifierNodeElement<ColorNode>() {
    override fun create() = ColorNode(color)
    override fun update(node: ColorNode) { node.color = color }
}

fun Modifier.colorBackground(color: Color) = this then ColorElement(color)
```

## Strong Skipping Mode

Default since Kotlin 2.0.20 (Compose 1.7+). Composables skip recomposition when their parameters have not changed — even for unstable (non-`@Stable`) lambda parameters.

```kotlin
// With Strong Skipping, these recompose correctly even without @Stable
@Composable
fun ItemRow(
    item: Item,               // Even if Item is not @Stable
    onClick: () -> Unit,      // Lambda — previously always caused recomposition
) {
    // Composes correctly; will skip if item and onClick haven't changed
}
```

Check mode: in `build.gradle.kts`:
```kotlin
composeOptions {
    kotlinCompilerExtensionVersion = "..."
}
// Strong skipping is ON by default in Kotlin 2.0.20+
// To disable: add -P plugin:androidx.compose.compiler.plugins.kotlin:strongSkipping=false
```

## LazyLayout Enhancements

```kotlin
// contentType — helps Compose reuse item compositions across different item types
LazyColumn {
    items(
        items = mixedList,
        key = { it.id },
        contentType = { item ->
            when (item) {
                is HeaderItem -> "header"
                is ContentItem -> "content"
                is AdItem -> "ad"
                else -> "default"
            }
        }
    ) { item -> ItemComposable(item) }
}

// Pinned headers with stickyHeader
LazyColumn {
    groupedItems.forEach { (letter, items) ->
        stickyHeader {
            Text(letter, modifier = Modifier.background(MaterialTheme.colorScheme.surface))
        }
        items(items, key = { it.id }) { item -> ItemRow(item) }
    }
}
```

## Shared Element Transitions

```kotlin
// Requires: androidx.compose.animation:animation (1.7+)
@Composable
fun SharedTransitionDemo() {
    SharedTransitionLayout {
        AnimatedContent(targetState = showDetail) { isDetail ->
            if (!isDetail) {
                // List item
                Image(
                    painter = ...,
                    modifier = Modifier.sharedElement(
                        rememberSharedContentState(key = "image-$id"),
                        animatedVisibilityScope = this@AnimatedContent,
                    )
                )
            } else {
                // Detail screen
                Image(
                    painter = ...,
                    modifier = Modifier.sharedElement(
                        rememberSharedContentState(key = "image-$id"),
                        animatedVisibilityScope = this@AnimatedContent,
                    )
                )
            }
        }
    }
}
```

## WindowSizeClass for Responsive Design

```kotlin
// build.gradle.kts
implementation("androidx.compose.material3.adaptive:adaptive")

@Composable
fun AdaptiveLayout() {
    val windowSizeClass = currentWindowAdaptiveInfo().windowSizeClass

    when (windowSizeClass.windowWidthSizeClass) {
        WindowWidthSizeClass.COMPACT -> {
            // Phone — single column
            SingleColumnLayout()
        }
        WindowWidthSizeClass.MEDIUM -> {
            // Unfolded foldable or small tablet
            TwoColumnLayout()
        }
        WindowWidthSizeClass.EXPANDED -> {
            // Tablet or desktop
            ThreeColumnLayout()
        }
    }
}
```

## Predictive Back Gesture

```kotlin
// Custom back animation (Android 14+)
val backHandler = BackHandler(enabled = true) {
    // Handle back
}

// BackHandler with animation state
var showExitDialog by remember { mutableStateOf(false) }
BackHandler(enabled = !showExitDialog) {
    showExitDialog = true
}

// SeekableTransitionState for predictive back animation
val transition = rememberTransition(...)
// See: PredictiveBackHandler for full implementation
```
