# Kotlin Flow

## Cold Flow vs Hot Flow

**Cold Flow** — starts when collected, stops when collection ends. Each collector gets its own independent stream.
**Hot Flow (StateFlow, SharedFlow)** — active independently of collectors. Collectors receive current/future values.

```kotlin
// Cold: each call to collect() restarts the producer
val coldFlow: Flow<Int> = flow {
    println("Starting")     // runs for every collector
    emit(1)
    emit(2)
}

// Hot: single producer shared across all collectors
val hotFlow: StateFlow<Int> = MutableStateFlow(0)
```

## Flow Builders

```kotlin
// flow {} — general purpose cold flow builder
val networkFlow: Flow<Response> = flow {
    emit(api.fetch())           // suspend call inside flow {} is OK
    delay(1_000)
    emit(api.fetch())
}

// flowOf — emit a fixed set of values
val numbersFlow = flowOf(1, 2, 3)

// asFlow — convert Iterable, Sequence, or Array
val itemsFlow = listOf("a", "b", "c").asFlow()

// callbackFlow — wrap callback-based APIs
fun locationUpdates(): Flow<Location> = callbackFlow {
    val callback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            trySend(result.lastLocation ?: return)
        }
    }
    locationManager.requestUpdates(callback)
    awaitClose { locationManager.removeUpdates(callback) }
}
```

## Terminal Operators

Terminal operators trigger collection and return a result (or Unit).

```kotlin
val flow = flowOf(1, 2, 3, 4, 5)

flow.collect { value -> process(value) }             // Unit
val first = flow.first()                             // 1
val list = flow.toList()                             // [1,2,3,4,5]
val sum = flow.fold(0) { acc, v -> acc + v }         // 15
val product = flow.reduce { acc, v -> acc * v }      // 120
val exists = flow.any { it > 3 }                     // true
val count = flow.count { it % 2 == 0 }              // 2
```

## Intermediate Operators

Intermediate operators transform the stream without triggering collection. They return a new Flow.

```kotlin
flow
    .map { it * 2 }                          // transform each value
    .filter { it > 4 }                       // drop values not matching
    .take(3)                                 // take first N values
    .drop(1)                                 // skip first N values
    .onEach { log("emitting $it") }          // side effect without transform
    .distinctUntilChanged()                  // skip duplicate consecutive values
    .debounce(300)                           // wait 300ms after last emission
    .sample(1_000)                           // emit latest value every 1s
    .transform { v ->                        // general: emit 0..N values per input
        emit(v)
        emit(v * 10)
    }
```

## Combining Flows

```kotlin
val flowA = flowOf(1, 2, 3)
val flowB = flowOf("a", "b", "c")

// combine: emit latest pair whenever either source emits
combine(flowA, flowB) { a, b -> "$a$b" }.collect()
// 1a, 2a, 2b, 3b, 3c (or similar, depends on timing)

// zip: pair corresponding emissions, stops with shorter flow
flowA.zip(flowB) { a, b -> "$a$b" }.collect()
// 1a, 2b, 3c

// merge: interleave multiple flows of the same type
merge(flowOf(1, 3), flowOf(2, 4)).collect()
// order not guaranteed: 1, 2, 3, 4

// flatMapLatest: restart inner flow on each new upstream value
searchQuery
    .debounce(300)
    .flatMapLatest { query -> repository.search(query) }
    .collect { results -> updateUi(results) }

// flatMapConcat: collect inner flows sequentially
taskIds
    .flatMapConcat { id -> repository.getTask(id) }
    .collect()

// flatMapMerge: collect inner flows concurrently (default concurrency=16)
ids.flatMapMerge(concurrency = 4) { id -> fetchItem(id) }.collect()
```

## StateFlow

`StateFlow` is a hot flow that holds a single current value. New collectors immediately receive the current value.

```kotlin
// In ViewModel
class SearchViewModel(private val repo: SearchRepository) : ViewModel() {
    private val _query = MutableStateFlow("")
    val query: StateFlow<String> = _query.asStateFlow()

    val results: StateFlow<List<Result>> = _query
        .debounce(300)
        .distinctUntilChanged()
        .flatMapLatest { repo.search(it) }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5_000),
            initialValue = emptyList()
        )

    fun onQueryChanged(q: String) { _query.value = q }
}

// Reading current value synchronously
val current: String = viewModel.query.value

// Updating state safely from any thread
_state.update { currentState -> currentState.copy(loading = true) }
```

## SharedFlow

`SharedFlow` is a hot flow for events. Unlike StateFlow it has no initial value and can replay past emissions.

```kotlin
// For one-shot events (navigation, snackbar)
class EventViewModel : ViewModel() {
    private val _events = MutableSharedFlow<UiEvent>(
        replay = 0,                              // no replay for new collectors
        extraBufferCapacity = 1,                 // buffer 1 event
        onBufferOverflow = BufferOverflow.DROP_OLDEST
    )
    val events: SharedFlow<UiEvent> = _events.asSharedFlow()

    fun navigate(destination: String) {
        viewModelScope.launch {
            _events.emit(UiEvent.Navigate(destination))
        }
    }
}

// SharedFlow with replay for late subscribers
val replayFlow = MutableSharedFlow<Update>(replay = 3)
// New collectors receive last 3 emissions immediately
```

## stateIn / shareIn with SharingStarted

```kotlin
// WhileSubscribed(5_000) — recommended for ViewModel
// Keeps upstream active for 5s after last collector stops
// Handles config changes without restarting upstream
val state = upstream
    .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), Initial)

// Eagerly — starts immediately on scope start (avoid in ViewModel — wastes resources)
val eager = upstream.stateIn(viewModelScope, SharingStarted.Eagerly, Initial)

// Lazily — starts on first collector, never stops
val lazy = upstream.stateIn(viewModelScope, SharingStarted.Lazily, Initial)
```

## flowOn for Upstream Dispatcher

`flowOn` changes the dispatcher for all operators ABOVE it in the chain. Collect always runs on the calling coroutine's dispatcher.

```kotlin
// CORRECT: flowOn applies to map and the flow {} block above it
val processedFlow = flow {
    emit(readFromDisk())             // runs on IO
}
    .map { parse(it) }               // runs on Default
    .flowOn(Dispatchers.IO)          // affects everything above this line
    .map { transform(it) }           // runs on calling dispatcher (Main)

// WRONG: do not use flowOn below collect
flow { emit(heavyWork()) }
    .collect { updateUi(it) }        // UI update must be on Main
// flowOn(Dispatchers.IO)           <-- placing here does nothing useful
```

## Search-as-You-Type Pattern

```kotlin
class SearchViewModel(private val repo: SearchRepository) : ViewModel() {
    private val _query = MutableStateFlow("")

    val searchResults: StateFlow<SearchState> = _query
        .debounce(300)                           // wait for typing to stop
        .distinctUntilChanged()                  // skip redundant queries
        .filter { it.length >= 2 }               // minimum query length
        .flatMapLatest { query ->                // cancel previous search
            repo.search(query)
                .map { SearchState.Success(it) }
                .catch { emit(SearchState.Error(it.message)) }
        }
        .onStart { emit(SearchState.Idle) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), SearchState.Idle)

    fun onQueryChanged(query: String) { _query.value = query }
}
```

## callbackFlow for Callback APIs

```kotlin
// Wrapping a listener-based API
fun observeConnectivity(context: Context): Flow<Boolean> = callbackFlow {
    val manager = context.getSystemService(ConnectivityManager::class.java)
    val callback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) { trySend(true) }
        override fun onLost(network: Network) { trySend(false) }
    }
    manager.registerDefaultNetworkCallback(callback)
    // Emit initial state
    trySend(manager.activeNetwork != null)
    // Clean up when Flow is cancelled
    awaitClose { manager.unregisterNetworkCallback(callback) }
}
```
