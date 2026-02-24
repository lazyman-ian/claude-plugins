# Compose / View Interop

## ComposeView in XML Layouts

Use when migrating an existing XML screen incrementally.

```xml
<!-- fragment_profile.xml -->
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical">

    <!-- Keep existing XML views -->
    <Toolbar android:id="@+id/toolbar" ... />

    <!-- Add Compose section -->
    <androidx.compose.ui.platform.ComposeView
        android:id="@+id/compose_view"
        android:layout_width="match_parent"
        android:layout_height="0dp"
        android:layout_weight="1" />
</LinearLayout>
```

```kotlin
// Fragment
class ProfileFragment : Fragment() {
    override fun onCreateView(...): View {
        return inflater.inflate(R.layout.fragment_profile, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        val composeView = view.findViewById<ComposeView>(R.id.compose_view)
        composeView.apply {
            // CRITICAL: Set correct ViewCompositionStrategy
            setViewCompositionStrategy(
                ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed
            )
            setContent {
                AppTheme {
                    ProfileContent(viewModel = viewModel())
                }
            }
        }
    }
}
```

### ViewCompositionStrategy options

| Strategy | Use When |
|----------|----------|
| `DisposeOnViewTreeLifecycleDestroyed` | Fragment (default for Fragments) |
| `DisposeOnDetachedFromWindow` | Activity, custom View (default) |
| `DisposeOnLifecycleDestroyed(lifecycle)` | Custom lifecycle control |

## AndroidView in Compose

Use when you need a View that has no Compose equivalent.

```kotlin
// Embed MapView in Compose
@Composable
fun MapScreen(modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val mapView = remember { MapView(context) }

    AndroidView(
        factory = { mapView },
        modifier = modifier.fillMaxSize(),
        update = { view ->
            // Called when Compose recomposes
            view.getMapAsync { googleMap ->
                googleMap.moveCamera(...)
            }
        },
        onRelease = { view ->
            // Called when removed from composition
            view.onDestroy()
        },
    )
}

// Embed WebView
@Composable
fun WebContent(url: String, modifier: Modifier = Modifier) {
    AndroidView(
        factory = { context ->
            WebView(context).apply {
                settings.javaScriptEnabled = true
            }
        },
        update = { webView -> webView.loadUrl(url) },
        modifier = modifier,
    )
}
```

## Fragment + Compose Interop

### Compose-first with Fragment dialogs

```kotlin
// Show legacy fragment dialog from Compose
@Composable
fun ScreenWithDialog(fragmentManager: FragmentManager) {
    val showDialog = remember { mutableStateOf(false) }

    Button(onClick = { showDialog.value = true }) { Text("Show Dialog") }

    if (showDialog.value) {
        DisposableEffect(Unit) {
            val dialog = LegacyDialogFragment()
            dialog.show(fragmentManager, "legacy_dialog")
            onDispose { if (dialog.isAdded) dialog.dismiss() }
        }
    }
}
```

### Fragment in NavHost (bridge pattern)

```kotlin
// Use when a feature is still a Fragment but navigation is Compose
NavHost(navController, startDestination = HomeRoute) {
    composable<HomeRoute> { HomeScreen() }
    fragment<LegacyFeatureFragment, LegacyRoute>()
}
```

Requires `androidx.navigation:navigation-fragment-compose`.

## Bidirectional Theming

### M3 Theme in XML Activity (MDC-Android bridge)

```kotlin
// themes.xml — bridge MDC theme to Compose M3
<style name="Theme.App" parent="Theme.MaterialComponents.DayNight.NoActionBar">
    <item name="colorPrimary">@color/md_theme_primary</item>
    ...
</style>
```

```kotlin
// Use MdcTheme from accompanist as bridge (deprecated — prefer full M3 migration)
// Or use MaterialTheme3 directly in setContent

class MainActivity : AppCompatActivity() {
    override fun onCreate(...) {
        super.onCreate(...)
        setContent {
            AppTheme {  // Full M3 theme in Compose
                MyApp()
            }
        }
    }
}
```

## Migration Strategy (3 Phases)

### Phase 1: New screens in Compose

```kotlin
// Add Compose screens via fragments or NavHost
// Keep existing XML screens unchanged
// Share ViewModels between XML and Compose screens
```

### Phase 2: Component library in Compose

```kotlin
// Build shared UI components as Composables
// Embed via ComposeView in existing XML screens
// Validate design consistency
```

### Phase 3: Replace XML screens

```kotlin
// Migrate screen by screen, highest-value first
// Update navigation to use NavHost
// Remove ComposeView wrappers
// Delete XML layouts
```

## Common Gotchas

### Lifecycle

```kotlin
// ❌ ComposeView in RecyclerView without strategy — memory leaks
composeView.setContent { ... }  // Missing ViewCompositionStrategy

// ✅ Correct strategy for RecyclerView items
composeView.setViewCompositionStrategy(
    ViewCompositionStrategy.DisposeOnRecycled  // Available via accompanist
    // Or:
    ViewCompositionStrategy.DisposeOnDetachedFromWindow
)
```

### Focus and Keyboard

```kotlin
// Keyboard may not dismiss automatically when mixing View and Compose
// Force hide from Compose side
val focusManager = LocalFocusManager.current
Button(onClick = {
    focusManager.clearFocus()
    onSubmit()
}) { Text("Submit") }
```

### Scroll Nesting

```kotlin
// ❌ Nested scrollable Views + Compose — scroll conflicts
LazyColumn {
    item {
        AndroidView(factory = { RecyclerView(it) })  // Nested scroll conflict
    }
}

// ✅ Use Compose-native equivalents or NestedScrollConnection
val nestedScrollInterop = rememberNestedScrollInteropConnection()
AndroidView(
    factory = { RecyclerView(it) },
    modifier = Modifier.nestedScroll(nestedScrollInterop),
)
```
