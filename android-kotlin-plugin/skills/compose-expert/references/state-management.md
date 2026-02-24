# State Management in Jetpack Compose

## remember vs rememberSaveable vs ViewModel

| Holder | Survives Recomposition | Survives Config Change | Survives Process Death |
|--------|----------------------|----------------------|----------------------|
| `remember` | Yes | No | No |
| `rememberSaveable` | Yes | Yes | Yes (if type is saveable) |
| `ViewModel` | Yes | Yes | No (unless SavedStateHandle) |
| `SavedStateHandle` | Yes | Yes | Yes |

```kotlin
// remember — local, ephemeral
var expanded by remember { mutableStateOf(false) }

// rememberSaveable — survives rotation
var query by rememberSaveable { mutableStateOf("") }

// ViewModel — screen-level business state
@HiltViewModel
class SearchViewModel @Inject constructor(
    private val repo: SearchRepository,
    private val savedStateHandle: SavedStateHandle,
) : ViewModel() {
    private val _uiState = MutableStateFlow(SearchUiState())
    val uiState: StateFlow<SearchUiState> = _uiState.asStateFlow()
}
```

## UDF Pattern: UiState + UiEvent + Effect

```kotlin
// Single sealed UiState for the screen
data class SearchUiState(
    val query: String = "",
    val results: List<SearchResult> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
)

// Events from UI to ViewModel (one-way)
sealed interface SearchUiEvent {
    data class QueryChanged(val query: String) : SearchUiEvent
    data object SearchSubmitted : SearchUiEvent
    data class ResultClicked(val id: String) : SearchUiEvent
}

// One-shot effects (navigation, snackbar) via Channel
sealed interface SearchEffect {
    data class NavigateToDetail(val id: String) : SearchEffect
    data class ShowError(val message: String) : SearchEffect
}

@HiltViewModel
class SearchViewModel @Inject constructor(...) : ViewModel() {
    private val _uiState = MutableStateFlow(SearchUiState())
    val uiState: StateFlow<SearchUiState> = _uiState.asStateFlow()

    private val _effects = Channel<SearchEffect>(Channel.BUFFERED)
    val effects: Flow<SearchEffect> = _effects.receiveAsFlow()

    fun onEvent(event: SearchUiEvent) = when (event) {
        is SearchUiEvent.QueryChanged -> _uiState.update { it.copy(query = event.query) }
        is SearchUiEvent.SearchSubmitted -> search()
        is SearchUiEvent.ResultClicked -> viewModelScope.launch {
            _effects.send(SearchEffect.NavigateToDetail(event.id))
        }
    }
}

// Screen composable
@Composable
fun SearchScreen(
    viewModel: SearchViewModel = hiltViewModel(),
    onNavigateToDetail: (String) -> Unit,
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.effects.collect { effect ->
            when (effect) {
                is SearchEffect.NavigateToDetail -> onNavigateToDetail(effect.id)
                is SearchEffect.ShowError -> { /* show snackbar */ }
            }
        }
    }

    SearchContent(
        uiState = uiState,
        onEvent = viewModel::onEvent,
    )
}
```

## collectAsStateWithLifecycle()

Always prefer over `collectAsState()` — stops collecting when the composable is not visible.

```kotlin
// ❌ Collects even when app is in background
val uiState by viewModel.uiState.collectAsState()

// ✅ Lifecycle-aware, stops at Lifecycle.State.STARTED
val uiState by viewModel.uiState.collectAsStateWithLifecycle()

// Custom lifecycle state
val uiState by viewModel.uiState.collectAsStateWithLifecycle(
    minActiveState = Lifecycle.State.RESUMED
)
```

Requires: `androidx.lifecycle:lifecycle-runtime-compose`

## derivedStateOf

Use when a computed value depends on other state and is expensive to calculate, or to avoid unnecessary recompositions.

```kotlin
// ❌ Recomposes every time list changes, even if "show button" hasn't changed
val showScrollToTop = listState.firstVisibleItemIndex > 0

// ✅ Only recomposes ShowScrollToTopButton when the boolean flips
val showScrollToTop by remember {
    derivedStateOf { listState.firstVisibleItemIndex > 0 }
}

// ❌ Recomputes sorted list on every recomposition
val sortedItems = items.sortedBy { it.name }

// ✅ Only recomputes when items changes
val sortedItems by remember(items) {
    derivedStateOf { items.sortedBy { it.name } }
}
```

## snapshotFlow

Bridge Compose state into a Flow for side effects.

```kotlin
// Monitor scroll position and emit events
val listState = rememberLazyListState()

LaunchedEffect(listState) {
    snapshotFlow { listState.firstVisibleItemIndex }
        .distinctUntilChanged()
        .filter { it > 5 }
        .collect { viewModel.onScrolledPastHeader() }
}

// Track derived scroll state
LaunchedEffect(listState) {
    snapshotFlow { listState.isScrollInProgress }
        .distinctUntilChanged()
        .collect { isScrolling ->
            if (!isScrolling) viewModel.onScrollStopped()
        }
}
```

## State Hoisting Patterns

### Stateless composable (preferred for reuse)

```kotlin
// Stateless — fully controlled by caller, easy to test and preview
@Composable
fun EmailField(
    value: String,
    onValueChange: (String) -> Unit,
    isError: Boolean,
    modifier: Modifier = Modifier,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        isError = isError,
        modifier = modifier,
    )
}

// Stateful wrapper — convenient for simple use cases
@Composable
fun EmailFieldStateful(modifier: Modifier = Modifier) {
    var email by rememberSaveable { mutableStateOf("") }
    EmailField(
        value = email,
        onValueChange = { email = it },
        isError = email.isNotEmpty() && !email.contains("@"),
        modifier = modifier,
    )
}
```

### Hoisting to shared ancestor

```kotlin
// ❌ State duplicated in siblings — gets out of sync
@Composable fun ParentScreen() {
    TabRow() // has its own selectedTab
    ContentArea() // has its own selectedTab
}

// ✅ State hoisted to parent, passed down
@Composable fun ParentScreen() {
    var selectedTab by remember { mutableStateOf(0) }
    TabRow(selectedTab = selectedTab, onTabSelected = { selectedTab = it })
    ContentArea(selectedTab = selectedTab)
}
```

## Molecule Pattern (Compose-based Presenter)

Alternative to ViewModel for logic-heavy screens using Compose runtime.

```kotlin
@Composable
fun searchPresenter(
    events: Flow<SearchEvent>,
    repo: SearchRepository,
): SearchUiState {
    var query by remember { mutableStateOf("") }
    var results by remember { mutableStateOf(emptyList<SearchResult>()) }

    LaunchedEffect(Unit) {
        events.collect { event ->
            when (event) {
                is SearchEvent.QueryChanged -> query = event.query
                is SearchEvent.Search -> results = repo.search(query)
            }
        }
    }

    return SearchUiState(query = query, results = results)
}
```

Requires: `app.cash.molecule:molecule-runtime`
