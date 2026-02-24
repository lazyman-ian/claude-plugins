# Lifecycle-Aware Coroutine Collection

## The Problem with Direct lifecycleScope.launch

Collecting a flow directly in `lifecycleScope.launch` keeps the coroutine alive even when the UI is in the background, causing unnecessary resource usage and potential crashes on UI updates.

```kotlin
// WRONG: collects in background (Activity/Fragment stopped but not destroyed)
lifecycleScope.launch {
    viewModel.uiState.collect { render(it) }
    // Still running when Activity is stopped — UI update may crash
}

// CORRECT: suspends collection when lifecycle drops below STARTED
lifecycleScope.launch {
    repeatOnLifecycle(Lifecycle.State.STARTED) {
        viewModel.uiState.collect { render(it) }
    }
}
```

## repeatOnLifecycle

`repeatOnLifecycle(state)` launches a new coroutine each time lifecycle enters `state` and cancels it when it drops below `state`. The outer coroutine suspends until the lifecycle is destroyed.

```kotlin
// Activity
class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                // Starts when STARTED, cancels when STOPPED
                viewModel.uiState.collect { state -> render(state) }
            }
            // Code here runs after lifecycle is DESTROYED
        }
    }
}

// Fragment — use viewLifecycleOwner, NOT this
class MyFragment : Fragment() {
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.uiState.collect { render(it) }
            }
        }
    }
}
```

## Lifecycle States Reference

| State | Active When |
|-------|-------------|
| `CREATED` | After onCreate, before onDestroy |
| `STARTED` | After onStart, before onStop — recommended for UI |
| `RESUMED` | After onResume, before onPause |
| `DESTROYED` | After onDestroy |

Use `STARTED` for most UI collection. Use `RESUMED` only when you need the flow active strictly while the user interacts.

## Why launchWhenStarted is Deprecated

`launchWhenStarted` and `launchWhenResumed` suspend emission when the lifecycle drops below the state, but they keep the upstream **producing** values which pile up in a buffer — a backpressure problem.

```kotlin
// DEPRECATED (backpressure issue)
lifecycleScope.launchWhenStarted {
    viewModel.events.collect { handleEvent(it) }
    // When background: producer keeps emitting, buffer fills up
}

// CORRECT: repeatOnLifecycle cancels the collector (and backpressure with it)
lifecycleScope.launch {
    repeatOnLifecycle(Lifecycle.State.STARTED) {
        viewModel.events.collect { handleEvent(it) }
        // When background: collector is cancelled, producer is also cancelled (if cold)
    }
}
```

## collectAsStateWithLifecycle() in Compose

In Compose, always use `collectAsStateWithLifecycle()` from `lifecycle-runtime-compose`. It ties collection to the Composition's lifecycle.

```kotlin
// build.gradle.kts
implementation("androidx.lifecycle:lifecycle-runtime-compose:2.7.0")

// Composable
@Composable
fun MyScreen(viewModel: MyViewModel = hiltViewModel()) {
    // CORRECT: respects lifecycle, stops collecting in background
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    // WRONG: collectAsState() collects even in background
    // val uiState by viewModel.uiState.collectAsState()

    when (uiState) {
        is UiState.Loading -> LoadingSpinner()
        is UiState.Success -> Content(uiState.data)
        is UiState.Error -> ErrorView(uiState.message)
    }
}
```

## flowWithLifecycle() Helper

For cases where `repeatOnLifecycle` structure is inconvenient, `flowWithLifecycle()` wraps a flow to only emit when lifecycle is at or above the given state.

```kotlin
// For a single flow — simpler than repeatOnLifecycle
val lifecycleAwareFlow = viewModel.uiState
    .flowWithLifecycle(lifecycle, Lifecycle.State.STARTED)

lifecycleScope.launch {
    lifecycleAwareFlow.collect { render(it) }
}

// Prefer repeatOnLifecycle when collecting multiple flows
// (avoids creating multiple wrapper objects)
lifecycleScope.launch {
    repeatOnLifecycle(Lifecycle.State.STARTED) {
        launch { viewModel.state.collect { renderState(it) } }
        launch { viewModel.events.collect { handleEvent(it) } }
    }
}
```

## Activity vs Fragment Lifecycle Considerations

```kotlin
// Activity: use this as lifecycle owner
class DetailActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.detail.collect { showDetail(it) }
            }
        }
    }
}

// Fragment: ALWAYS use viewLifecycleOwner (not this)
// Fragment lifecycle != View lifecycle — using `this` leaks the view
class DetailFragment : Fragment() {
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        // viewLifecycleOwner is destroyed when fragment view is destroyed
        // this (Fragment) outlives its views in the back stack
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.detail.collect { showDetail(it) }
            }
        }
    }
}
```

## WhileSubscribed(5_000) Timeout for Config Changes

`SharingStarted.WhileSubscribed(stopTimeoutMillis)` keeps the upstream alive for a short period after the last collector cancels. This survives configuration changes (rotation) without restarting the upstream.

```kotlin
class ProfileViewModel(private val repo: ProfileRepository) : ViewModel() {
    val profile: StateFlow<Profile> = repo.observeProfile()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5_000),  // 5s grace period
            initialValue = Profile.Loading
        )
    // During rotation: old Activity stops (collector cancels), new Activity starts
    // within ~1s, so the 5s timeout is never reached → upstream never restarts
}
```

## Process Death Handling with SavedStateHandle

`StateFlow` and in-memory state are lost on process death. Use `SavedStateHandle` to survive it.

```kotlin
class SearchViewModel(
    savedStateHandle: SavedStateHandle,
    private val repo: SearchRepository
) : ViewModel() {

    // Persists across process death via Bundle
    private val savedQuery = savedStateHandle.getStateFlow("query", "")

    val results: StateFlow<List<Result>> = savedQuery
        .debounce(300)
        .flatMapLatest { repo.search(it) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    fun onQueryChanged(query: String) {
        savedStateHandle["query"] = query
    }
}
```
