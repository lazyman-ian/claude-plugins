# Kotlin Coroutines Basics

## Suspend Functions

A `suspend` function can pause and resume without blocking the thread. It can only be called from another suspend function or a coroutine builder.

```kotlin
// Declaration
suspend fun fetchUser(id: String): User {
    return withContext(Dispatchers.IO) {
        api.getUser(id)
    }
}

// Calling from ViewModel
viewModelScope.launch {
    val user = fetchUser("123")  // suspends, does not block
    _state.value = UiState.Success(user)
}
```

## CoroutineScope, CoroutineContext, Job

Every coroutine runs inside a `CoroutineScope`. The scope holds a `CoroutineContext` which carries a `Job`, `Dispatcher`, and optional `CoroutineName`.

```kotlin
// CoroutineContext is a map of elements
val context: CoroutineContext = Dispatchers.IO + CoroutineName("fetch")

// Scope ties coroutines to a lifecycle
val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

// Job represents a cancellable unit of work
val job: Job = scope.launch { doWork() }
job.cancel()  // cancels the coroutine

// Parent-child relationship: cancel parent cancels all children
val parent = scope.launch {
    val child1 = launch { taskA() }
    val child2 = launch { taskB() }
    // cancelling parent cancels child1 and child2
}
```

## Dispatchers

| Dispatcher | Use For |
|------------|---------|
| `Dispatchers.Main` | UI updates, ViewModel logic |
| `Dispatchers.IO` | Network, disk, database operations |
| `Dispatchers.Default` | CPU-intensive work (sorting, parsing) |
| `Dispatchers.Unconfined` | Testing only — do not use in production |

```kotlin
// Always inject dispatchers for testability
class UserRepository(
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
) {
    suspend fun loadUser(id: String): User = withContext(ioDispatcher) {
        db.userDao().getUser(id)
    }
}
```

## coroutineScope vs supervisorScope

`coroutineScope` — failure of any child cancels all siblings and the parent.
`supervisorScope` — failure of one child does NOT cancel siblings.

```kotlin
// coroutineScope: atomic — all succeed or all cancel
suspend fun loadPageData(): PageData = coroutineScope {
    val profile = async { profileRepo.getProfile() }
    val feed = async { feedRepo.getFeed() }
    PageData(profile.await(), feed.await())
}

// supervisorScope: independent — failures are isolated
suspend fun refreshAll() = supervisorScope {
    launch {
        runCatching { syncNotifications() }
            .onFailure { log.e("notifications failed", it) }
    }
    launch {
        runCatching { syncMessages() }
            .onFailure { log.e("messages failed", it) }
    }
}
```

## async/await for Parallel Decomposition

```kotlin
// Sequential — total time = A + B
suspend fun sequential(): Pair<User, Posts> {
    val user = userRepo.getUser()
    val posts = postRepo.getPosts()
    return Pair(user, posts)
}

// Parallel — total time = max(A, B)
suspend fun parallel(): Pair<User, Posts> = coroutineScope {
    val user = async { userRepo.getUser() }
    val posts = async { postRepo.getPosts() }
    Pair(user.await(), posts.await())
}

// lazy async — start only when awaited
val deferred = async(start = CoroutineStart.LAZY) { expensiveOp() }
// deferred.await() starts it
```

## withContext for Dispatcher Switching

`withContext` switches the dispatcher for a block and returns a result. It is NOT a coroutine builder — it runs inline within the current coroutine.

```kotlin
// Recommended: single withContext at the boundary
suspend fun parseJson(json: String): Data = withContext(Dispatchers.Default) {
    gson.fromJson(json, Data::class.java)
}

// Avoid multiple nested withContext — single boundary is cleaner
suspend fun saveUser(user: User) {
    val serialized = withContext(Dispatchers.Default) { serialize(user) }
    withContext(Dispatchers.IO) { db.save(serialized) }
}
```

## Cancellation and Cooperative Cancellation

Coroutines are cancelled cooperatively. The coroutine must check for cancellation at suspension points or manually.

```kotlin
// Suspension points auto-check cancellation
suspend fun processItems(items: List<Item>) {
    for (item in items) {
        ensureActive()          // throws CancellationException if cancelled
        delay(10)               // also checks — any suspend fun checks
        process(item)
    }
}

// isActive for non-suspending loops
fun CoroutineScope.compute(): Job = launch {
    while (isActive) {
        val chunk = nextChunk()
        processChunk(chunk)
    }
}

// NEVER swallow CancellationException
try {
    suspendableWork()
} catch (e: CancellationException) {
    throw e   // always re-throw
} catch (e: Exception) {
    handleError(e)
}
```

## viewModelScope and lifecycleScope

Both are pre-configured scopes bound to lifecycle.

```kotlin
// viewModelScope: cancelled when ViewModel.onCleared() is called
class MyViewModel : ViewModel() {
    fun loadData() {
        viewModelScope.launch {
            val data = repository.fetch()
            _uiState.value = UiState.Success(data)
        }
    }
}

// lifecycleScope: cancelled when lifecycle is destroyed
class MyFragment : Fragment() {
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        // WRONG: launch directly in lifecycleScope collects even in background
        // lifecycleScope.launch { viewModel.flow.collect { ... } }

        // CORRECT: wrap with repeatOnLifecycle
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.uiState.collect { render(it) }
            }
        }
    }
}
```

## Gradle Setup

```kotlin
// build.gradle.kts
dependencies {
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.0")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.8.0")
}
```
