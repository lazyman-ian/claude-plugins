# Side Effects in Jetpack Compose

Side effects must be managed through the Compose effect APIs to stay in sync with the composition lifecycle.

## LaunchedEffect

Launches a coroutine scoped to the composable. Restarts when keys change. Cancels when composable leaves composition.

```kotlin
// One-shot on entry (key = Unit never changes)
LaunchedEffect(Unit) {
    viewModel.loadData()
}

// Restart when userId changes — cancel previous coroutine automatically
LaunchedEffect(userId) {
    viewModel.loadUser(userId)
}

// Multiple keys — restarts if any key changes
LaunchedEffect(userId, filter) {
    viewModel.loadFilteredData(userId, filter)
}

// Collecting one-shot effects (navigation, snackbar)
LaunchedEffect(viewModel) {
    viewModel.effects.collect { effect ->
        when (effect) {
            is Effect.NavigateTo -> onNavigate(effect.route)
            is Effect.ShowSnackbar -> snackbarHostState.showSnackbar(effect.message)
        }
    }
}
```

Key management rules:
- `Unit` — run once, never restart
- Stable value — restart when that value changes
- `true` — functionally equivalent to `Unit`
- Avoid lambda captures that change every recomposition as keys

## DisposableEffect

For effects with cleanup — registers a callback and disposes it when keys change or composable leaves.

```kotlin
// Register/unregister lifecycle observer
val lifecycleOwner = LocalLifecycleOwner.current
DisposableEffect(lifecycleOwner) {
    val observer = LifecycleEventObserver { _, event ->
        if (event == Lifecycle.Event.ON_RESUME) viewModel.onResume()
        if (event == Lifecycle.Event.ON_PAUSE) viewModel.onPause()
    }
    lifecycleOwner.lifecycle.addObserver(observer)

    onDispose {
        lifecycleOwner.lifecycle.removeObserver(observer)
    }
}

// Register broadcast receiver
val context = LocalContext.current
DisposableEffect(context) {
    val receiver = MyBroadcastReceiver()
    context.registerReceiver(receiver, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
    onDispose { context.unregisterReceiver(receiver) }
}
```

`onDispose` is required — the compiler will warn if missing.

## SideEffect

Runs after every successful recomposition. Use for non-suspend, non-coroutine side effects that must stay in sync with composition state.

```kotlin
// Sync Compose state to an external non-Compose object
val analytics = LocalAnalytics.current
SideEffect {
    analytics.setCurrentScreen(currentRoute)
}

// Update Firebase Analytics (common pattern)
val firebaseAnalytics = remember { FirebaseAnalytics.getInstance(context) }
SideEffect {
    firebaseAnalytics.setCurrentScreen(activity, screenName, null)
}
```

Use sparingly — runs every recomposition, not just on change.

## rememberCoroutineScope

Provides a CoroutineScope tied to the composable. Use for event-driven coroutines (button clicks, etc.) where you need coroutine control inside event handlers.

```kotlin
val scope = rememberCoroutineScope()
val snackbarHostState = remember { SnackbarHostState() }

Button(
    onClick = {
        // Can't use LaunchedEffect here — not in composition
        scope.launch {
            snackbarHostState.showSnackbar("Item deleted")
        }
    }
) { Text("Delete") }
```

Do not use for data loading — that belongs in ViewModel's `viewModelScope`.

## derivedStateOf

Memoizes a computed value. Only triggers recomposition of observers when the computed result changes, even if the input state changes more frequently.

```kotlin
val listState = rememberLazyListState()

// ❌ Recomposes on every scroll event
val showButton = listState.firstVisibleItemIndex > 0

// ✅ Recomposes only when the boolean value flips
val showButton by remember {
    derivedStateOf { listState.firstVisibleItemIndex > 0 }
}

// Expensive filter — only recomputes when items or filter changes
val filtered by remember(items, filter) {
    derivedStateOf { items.filter { it.matches(filter) } }
}
```

## snapshotFlow

Converts Compose snapshot state into a cold Flow. Useful for reacting to state changes with operators like `debounce`, `distinctUntilChanged`, `filter`.

```kotlin
val listState = rememberLazyListState()

LaunchedEffect(listState) {
    snapshotFlow { listState.firstVisibleItemIndex }
        .distinctUntilChanged()
        .collect { index -> viewModel.onScrollPositionChanged(index) }
}

// Debounce search input
val query by remember { mutableStateOf("") }
LaunchedEffect(Unit) {
    snapshotFlow { query }
        .debounce(300)
        .distinctUntilChanged()
        .collect { viewModel.search(it) }
}
```

## produceState

Converts any async data source (Flow, suspend, callback) into Compose State. Runs in a coroutine; cancels on leave.

```kotlin
// From suspend function
val image by produceState<Bitmap?>(initialValue = null) {
    value = loadImage(imageUrl)
}

// From Flow
val networkState by produceState(initialValue = NetworkState.Unknown) {
    networkMonitor.networkState.collect { value = it }
}
```

## Common Mistakes

```kotlin
// ❌ Side effect directly in composition body
@Composable
fun MyScreen(viewModel: MyViewModel) {
    viewModel.trackScreenView()  // Runs every recomposition!
    ...
}

// ✅ Wrap in SideEffect or LaunchedEffect
@Composable
fun MyScreen(viewModel: MyViewModel) {
    LaunchedEffect(Unit) { viewModel.trackScreenView() }
    ...
}

// ❌ Coroutine in wrong scope (Activity scope, not composition)
Button(onClick = {
    GlobalScope.launch { ... }  // Leaks!
})

// ✅ rememberCoroutineScope
val scope = rememberCoroutineScope()
Button(onClick = { scope.launch { ... } })

// ❌ LaunchedEffect with unstable key (lambda recreated each recomposition)
LaunchedEffect(onClick) {  // onClick is a lambda — new instance each time
    ...
}

// ✅ Stable key
LaunchedEffect(userId) { ... }
```
