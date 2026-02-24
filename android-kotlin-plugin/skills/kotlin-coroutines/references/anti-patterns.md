# Coroutine Anti-Patterns (Guard Rules)

## CK-COROUTINE-001: GlobalScope.launch Without Justification

**What to detect:** `GlobalScope.launch` or `GlobalScope.async` anywhere in application code without an explicit documented reason.

**Bad:**
```kotlin
class UserRepository {
    fun syncUser(id: String) {
        GlobalScope.launch {         // leaks — not tied to any lifecycle
            api.syncUser(id)
        }
    }
}
```

**Why it's problematic:**
- GlobalScope coroutines live for the entire app lifetime
- Cannot be cancelled by structured concurrency
- Leaks resources when the caller is no longer needed
- Makes testing impossible (no scope to cancel in teardown)

**Fix:**
```kotlin
class UserRepository(private val externalScope: CoroutineScope) {
    fun syncUser(id: String) {
        externalScope.launch {       // injected scope with proper lifecycle
            api.syncUser(id)
        }
    }
}
// In ViewModel: inject applicationScope from Hilt (tied to Application)
```

**Detection:** `GlobalScope\.(launch|async|actor|produce)`

---

## CK-COROUTINE-002: runBlocking on Main Thread

**What to detect:** `runBlocking` called in Activity, Fragment, ViewModel, or any code running on the Main thread.

**Bad:**
```kotlin
class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val user = runBlocking { userRepo.fetchUser() }  // blocks UI thread — ANR risk
        showUser(user)
    }
}
```

**Why it's problematic:**
- Blocks the calling thread until the coroutine completes
- On Main thread: causes ANR (Application Not Responding) if operation takes >5s
- Defeats the purpose of coroutines

**Fix:**
```kotlin
class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        lifecycleScope.launch {
            val user = userRepo.fetchUser()   // suspends, not blocks
            showUser(user)
        }
    }
}
```

**Detection:** `runBlocking\s*\{` in Activity/Fragment/ViewModel/Composable files

---

## CK-COROUTINE-003: Catching CancellationException

**What to detect:** `catch` blocks that catch `Exception`, `Throwable`, or `CancellationException` without re-throwing `CancellationException`.

**Bad:**
```kotlin
suspend fun doWork() {
    try {
        delay(5_000)
    } catch (e: Exception) {   // catches CancellationException — breaks cancellation
        log.e("error", e)
    }
}
```

**Why it's problematic:**
- `CancellationException` is the signal used to cancel coroutines
- Swallowing it prevents the coroutine from being cancelled
- Parent scope cannot cancel this coroutine — memory/resource leak

**Fix:**
```kotlin
suspend fun doWork() {
    try {
        delay(5_000)
    } catch (e: CancellationException) {
        throw e                // always re-throw
    } catch (e: Exception) {
        log.e("error", e)
    }
}

// Or: catch only specific exceptions
suspend fun doWork() {
    try {
        delay(5_000)
    } catch (e: IOException) { // does not catch CancellationException
        handleNetworkError(e)
    }
}
```

**Detection:** `catch\s*\(e:\s*(Exception|Throwable)\)` without `throw e` or `if.*CancellationException.*throw`

---

## CK-COROUTINE-004: launchWhenStarted/launchWhenResumed (Deprecated)

**What to detect:** `launchWhenStarted`, `launchWhenCreated`, or `launchWhenResumed` in any file.

**Bad:**
```kotlin
lifecycleScope.launchWhenStarted {
    viewModel.events.collect { handleEvent(it) }
    // Background: collection suspends but producer keeps running — backpressure builds
}
```

**Why it's problematic:**
- Deprecated in lifecycle 2.4.0
- Does not cancel the upstream producer when lifecycle drops below state
- Causes backpressure: events buffer up and are processed in burst when lifecycle resumes
- Can cause state inconsistency

**Fix:**
```kotlin
lifecycleScope.launch {
    repeatOnLifecycle(Lifecycle.State.STARTED) {
        viewModel.events.collect { handleEvent(it) }
        // Background: collector AND producer are cancelled — no buffering
    }
}
```

**Detection:** `\.(launchWhenStarted|launchWhenResumed|launchWhenCreated)\s*\{`

---

## CK-COROUTINE-005: Hardcoded Dispatchers.IO Without Injection

**What to detect:** `Dispatchers.IO` or `Dispatchers.Default` used directly in class bodies (not in companion objects or top-level defaults).

**Bad:**
```kotlin
class UserRepository {
    suspend fun loadUser(id: String): User = withContext(Dispatchers.IO) {
        // Hardcoded — impossible to control in tests
        db.userDao().getUser(id)
    }
}
```

**Why it's problematic:**
- Tests run on `Dispatchers.IO` which is a real thread pool
- Cannot use `TestDispatcher` to control execution order
- `StandardTestDispatcher` doesn't intercept `Dispatchers.IO`

**Fix:**
```kotlin
class UserRepository(
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
) {
    suspend fun loadUser(id: String): User = withContext(ioDispatcher) {
        db.userDao().getUser(id)
    }
}

// Test
val repo = UserRepository(ioDispatcher = UnconfinedTestDispatcher())
```

**Detection:** `withContext\(Dispatchers\.(IO|Default)\)` in non-default-parameter positions

---

## CK-COROUTINE-006: flow.collect in ViewModel init {}

**What to detect:** `.collect` called inside `init {}` block of a ViewModel class.

**Bad:**
```kotlin
class FeedViewModel(private val repo: FeedRepository) : ViewModel() {
    val feed = mutableListOf<Item>()

    init {
        viewModelScope.launch {
            repo.feedFlow.collect { items ->    // init{} blocks until collect completes (never)
                feed.addAll(items)
            }
        }
    }
}
```

**Why it's problematic:**
- `collect` is a terminal operator that suspends indefinitely for hot flows
- The ViewModel `init {}` never completes while collecting
- Blocks ViewModel initialization

**Fix:**
```kotlin
class FeedViewModel(private val repo: FeedRepository) : ViewModel() {
    val feed: StateFlow<List<Item>> = repo.feedFlow
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    // No collect needed — stateIn handles subscription
}
```

**Detection:** `init\s*\{[^}]*\.collect\s*\{` (multiline)

---

## CK-COROUTINE-007: collectAsState() Instead of collectAsStateWithLifecycle()

**What to detect:** `.collectAsState()` called on Flow or StateFlow in a Composable function.

**Bad:**
```kotlin
@Composable
fun ProfileScreen(viewModel: ProfileViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsState()   // collects in background
    // ...
}
```

**Why it's problematic:**
- `collectAsState()` has no lifecycle awareness
- Continues collecting when the app is backgrounded
- Wastes battery and may cause unwanted side effects

**Fix:**
```kotlin
@Composable
fun ProfileScreen(viewModel: ProfileViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()  // stops in background
    // Requires: implementation("androidx.lifecycle:lifecycle-runtime-compose:2.7.0")
    // ...
}
```

**Detection:** `\.collectAsState\(\)` in `*.kt` files containing `@Composable`

---

## CK-COROUTINE-008: Missing supervisorScope for Independent Parallel Tasks

**What to detect:** Multiple `launch` calls inside `coroutineScope` where each task is independent and should not cancel siblings on failure.

**Bad:**
```kotlin
suspend fun refreshDashboard() = coroutineScope {
    launch { syncNotifications() }   // if this fails, syncMessages is cancelled too
    launch { syncMessages() }
    launch { syncBadges() }
}
```

**Why it's problematic:**
- `coroutineScope` propagates any child failure to all siblings
- Independent operations that fail should not cancel unrelated operations
- User sees all features fail instead of just the one that had an error

**Fix:**
```kotlin
suspend fun refreshDashboard() = supervisorScope {
    launch {
        runCatching { syncNotifications() }
            .onFailure { log.w("notifications sync failed", it) }
    }
    launch {
        runCatching { syncMessages() }
            .onFailure { log.w("messages sync failed", it) }
    }
    launch {
        runCatching { syncBadges() }
            .onFailure { log.w("badges sync failed", it) }
    }
}
```

**Detection:** Multiple `launch\s*\{` blocks inside `coroutineScope\s*\{` without error handling

---

## CK-COROUTINE-009: Channel Without Proper close/cancel Handling

**What to detect:** `Channel<>()` creation without a corresponding `close()` in a `finally` block, or `for` loop over channel without structured cancellation.

**Bad:**
```kotlin
fun startProducer(scope: CoroutineScope): Channel<Data> {
    val channel = Channel<Data>(16)
    scope.launch {
        repeat(100) { channel.send(fetchData(it)) }
        // channel.close() missing — receiver loops forever
    }
    return channel
}
```

**Why it's problematic:**
- Receivers using `for (item in channel)` or `channel.receive()` loop indefinitely
- No signal to terminate — resource leak
- Channel backpressure builds up silently

**Fix:**
```kotlin
fun CoroutineScope.startProducer(): ReceiveChannel<Data> = produce {
    // produce {} automatically closes the channel when the block completes or throws
    repeat(100) { send(fetchData(it)) }
}

// Or manual: always close in finally
scope.launch {
    try {
        repeat(100) { channel.send(fetchData(it)) }
    } finally {
        channel.close()    // always close, even on exception
    }
}
```

**Detection:** `Channel<` without `.close()` or `produce\s*\{`

---

## CK-COROUTINE-010: stateIn(SharingStarted.Eagerly) in ViewModel

**What to detect:** `stateIn` or `shareIn` called with `SharingStarted.Eagerly` inside a ViewModel class.

**Bad:**
```kotlin
class FeedViewModel(private val repo: FeedRepository) : ViewModel() {
    val feed: StateFlow<List<Item>> = repo.feedFlow
        .stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())
    // Starts collecting immediately — even before any UI is attached
}
```

**Why it's problematic:**
- `Eagerly` starts the upstream immediately when the ViewModel is created
- Wastes resources when no UI is observing
- Network requests and DB queries run even before the screen is shown
- In tests, starts background work immediately, making test setup harder

**Fix:**
```kotlin
class FeedViewModel(private val repo: FeedRepository) : ViewModel() {
    val feed: StateFlow<List<Item>> = repo.feedFlow
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5_000),  // starts on first collector
            initialValue = emptyList()
        )
}
```

**Detection:** `stateIn\([^)]*SharingStarted\.Eagerly` or `shareIn\([^)]*SharingStarted\.Eagerly` inside ViewModel classes
