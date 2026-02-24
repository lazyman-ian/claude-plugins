# Compose Migration Reference

Detailed patterns for incremental XML → Jetpack Compose migration.

## ComposeView Setup in XML Layouts

Embed Compose in an existing XML layout using `ComposeView`:

```xml
<!-- fragment_home.xml -->
<LinearLayout ...>
    <TextView android:id="@+id/legacy_title" ... />

    <androidx.compose.ui.platform.ComposeView
        android:id="@+id/compose_section"
        android:layout_width="match_parent"
        android:layout_height="wrap_content" />
</LinearLayout>
```

```kotlin
// HomeFragment.kt
override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
    super.onViewCreated(view, savedInstanceState)
    binding.composeSection.apply {
        setViewCompositionStrategy(
            ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed
        )
        setContent {
            AppTheme {
                HomeCardSection(viewModel = viewModel)
            }
        }
    }
}
```

## ViewCompositionStrategy Options

| Strategy | When to Use |
|----------|-------------|
| `DisposeOnViewTreeLifecycleDestroyed` | Fragments — disposes when Fragment view is destroyed |
| `DisposeOnDetachedFromWindow` | Custom Views, Activities — disposes on detach |
| `DisposeOnLifecycleDestroyed(lifecycle)` | Manual lifecycle control |
| `ReusableContent` | RecyclerView items — reuses composition across rebinds |

**Default for Fragments**: Always use `DisposeOnViewTreeLifecycleDestroyed` to avoid
memory leaks from retained Fragment instances.

```kotlin
// RecyclerView item with Compose
class ProductViewHolder(val binding: ItemProductBinding) : RecyclerView.ViewHolder(binding.root) {
    init {
        binding.composeContent.setViewCompositionStrategy(
            ViewCompositionStrategy.ReusableContent
        )
    }

    fun bind(product: Product) {
        binding.composeContent.setContent {
            AppTheme { ProductCard(product = product) }
        }
    }
}
```

## AndroidView: Embedding XML in Compose

Use `AndroidView` when a legacy View has no Compose equivalent:

```kotlin
// Embedding a MapView or custom chart inside Compose
@Composable
fun LegacyMapSection(modifier: Modifier = Modifier) {
    AndroidView(
        factory = { context ->
            MapView(context).apply {
                // One-time setup
                onCreate(null)
                onResume()
            }
        },
        update = { mapView ->
            // Called on recomposition — update state here
            mapView.getMapAsync { googleMap ->
                googleMap.moveCamera(...)
            }
        },
        modifier = modifier
    )
}
```

```kotlin
// Embedding a WebView
@Composable
fun WebContent(url: String, modifier: Modifier = Modifier) {
    AndroidView(
        factory = { context ->
            WebView(context).apply {
                settings.javaScriptEnabled = true
                webViewClient = WebViewClient()
            }
        },
        update = { webView -> webView.loadUrl(url) },
        modifier = modifier.fillMaxSize()
    )
}
```

## Theme Interop: Material 3 + AppCompat Bridge

When migrating theme, bridge AppCompat XML theme → Compose Material 3:

```kotlin
// In your Compose theme, read colors from the XML theme:
@Composable
fun AppTheme(
    dynamicColor: Boolean = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S,
    content: @Composable () -> Unit
) {
    val colorScheme = when {
        dynamicColor -> dynamicLightColorScheme(LocalContext.current)
        else -> LightColorScheme  // your defined scheme
    }
    MaterialTheme(
        colorScheme = colorScheme,
        typography = AppTypography,
        content = content
    )
}
```

For Views that must read Compose theme colors (bridge direction):

```kotlin
// Read Material 3 color in a legacy View via CompositionLocal
val color = MaterialTheme.colorScheme.primary
// Pass to View via binding or AndroidView update lambda
```

## Fragment + Compose Coexistence

Full-screen Compose Fragment (replaces XML layout entirely):

```kotlin
class ProfileFragment : Fragment() {
    private val viewModel: ProfileViewModel by viewModels()

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View = ComposeView(requireContext()).apply {
        setViewCompositionStrategy(
            ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed
        )
        setContent {
            AppTheme {
                ProfileScreen(
                    viewModel = viewModel,
                    onNavigateBack = { findNavController().popBackStack() }
                )
            }
        }
    }
}
```

## Navigation Interop

### NavHostFragment + Compose NavHost coexistence

```kotlin
// Option 1: Add a Compose destination inside existing NavHostFragment graph
// In nav_graph.xml, add a fragment that hosts a full Compose screen:
// <fragment android:name="com.example.ProfileFragment" ... />

// Option 2: Replace NavHostFragment with Compose NavHost incrementally
// Main activity: old screens via NavHostFragment, new screen as overlay ComposeView
```

### Deep link handling during migration

```kotlin
// Keep existing deep link handling in NavHostFragment,
// pass args to Compose screen via ViewModel
class ProductFragment : Fragment() {
    private val args: ProductFragmentArgs by navArgs()
    private val viewModel: ProductViewModel by viewModels()

    override fun onViewCreated(...) {
        viewModel.loadProduct(args.productId)  // bridge nav args → ViewModel
        binding.composeView.setContent {
            AppTheme { ProductScreen(viewModel = viewModel) }
        }
    }
}
```

## Shared ViewModel Between Compose and XML Screens

```kotlin
// ViewModel shared via activity scope
class CartViewModel : ViewModel() {
    private val _items = MutableStateFlow<List<CartItem>>(emptyList())
    val items: StateFlow<List<CartItem>> = _items.asStateFlow()

    fun addItem(item: CartItem) { ... }
}

// XML Fragment observing same ViewModel
class CartSummaryFragment : Fragment() {
    private val viewModel: CartViewModel by activityViewModels()

    override fun onViewCreated(...) {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.items.collect { items ->
                binding.itemCount.text = items.size.toString()
            }
        }
    }
}

// Compose screen observing same ViewModel
@Composable
fun CartScreen(viewModel: CartViewModel = viewModel()) {
    val items by viewModel.items.collectAsStateWithLifecycle()
    // ...
}
```

## Testing Strategy During Migration

```kotlin
// Test Compose screens independently of Fragment container
@RunWith(AndroidJUnit4::class)
class ProfileScreenTest {
    @get:Rule val composeTestRule = createComposeRule()

    @Test
    fun displaysUserName() {
        composeTestRule.setContent {
            AppTheme { ProfileScreen(uiState = ProfileUiState(name = "Alice")) }
        }
        composeTestRule.onNodeWithText("Alice").assertIsDisplayed()
    }
}

// Test Fragment + Compose interop
@HiltAndroidTest
class ProfileFragmentTest {
    @get:Rule val hiltRule = HiltAndroidRule(this)
    @get:Rule val composeTestRule = createAndroidComposeRule<HiltTestActivity>()

    @Test
    fun fragmentHostsComposeCorrectly() {
        launchFragmentInHiltContainer<ProfileFragment>()
        composeTestRule.onNodeWithTag("profile_name").assertExists()
    }
}
```

## Handling Configuration Changes

```kotlin
// rememberSaveable persists across config changes
@Composable
fun SearchBar() {
    var query by rememberSaveable { mutableStateOf("") }
    TextField(value = query, onValueChange = { query = it })
}

// For complex state, use ViewModel (survives config changes automatically)
@Composable
fun SearchScreen(viewModel: SearchViewModel = viewModel()) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    // uiState persists across rotation
}
```

## Performance Considerations During Interop

- Each `ComposeView` has its own Composition — minimize the number of ComposeView instances
- Avoid creating `ComposeView` in `onBindViewHolder` without `ReusableContent`
- Use `derivedStateOf` to prevent unnecessary recompositions at interop boundaries
- Profile with Layout Inspector → Recomposition highlighting during migration

```kotlin
// Expensive calculation at XML/Compose boundary — use derivedStateOf
@Composable
fun PriceDisplay(rawPriceString: String) {
    val formattedPrice by remember(rawPriceString) {
        derivedStateOf { formatCurrency(rawPriceString) }
    }
    Text(text = formattedPrice)
}
```

## Migration Checklist Per Screen

- [ ] Identify all data sources (XML attributes, intent extras, shared prefs)
- [ ] Create or extend ViewModel with StateFlow/UiState
- [ ] Write Compose screen @Composable in isolation with preview
- [ ] Test Compose screen with unit + compose UI tests
- [ ] Replace XML layout with ComposeView (or full ComposeView Fragment)
- [ ] Verify navigation args/deep links still work
- [ ] Verify back stack behavior
- [ ] Remove old XML layout file and view binding class
- [ ] Update screenshot tests
