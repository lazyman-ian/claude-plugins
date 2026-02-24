# Coroutine Error Handling

## try/catch in Coroutines

`try/catch` works the same inside coroutines as in regular code, but only for the coroutine that wraps it.

```kotlin
viewModelScope.launch {
    try {
        val data = repository.fetch()
        _state.value = UiState.Success(data)
    } catch (e: IOException) {
        _state.value = UiState.Error(e.message)
    }
}

// WRONG: try/catch around launch does NOT catch coroutine exceptions
try {
    viewModelScope.launch {         // launch installs its own exception handler
        throw RuntimeException()   // this escapes the try/catch
    }
} catch (e: Exception) {
    // Never reached
}
```

## CoroutineExceptionHandler

Catches uncaught exceptions from `launch` (not `async`). Acts as a last-resort handler.

```kotlin
val handler = CoroutineExceptionHandler { _, exception ->
    log.e("Uncaught coroutine exception", exception)
    _state.value = UiState.Error("Unexpected error")
}

val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main + handler)

scope.launch {
    riskyOperation()    // exception caught by handler
}

// With viewModelScope: install handler at launch site
viewModelScope.launch(handler) {
    riskyOperation()
}

// Note: CoroutineExceptionHandler does NOT work with async {}
// Exceptions from async propagate to the parent on await()
val deferred = scope.async(handler) { riskyOp() }  // handler ignored here
deferred.await()  // exception thrown here — wrap await in try/catch
```

## supervisorScope for Independent Failure Isolation

With `coroutineScope`, any child failure cancels all siblings. Use `supervisorScope` when children should fail independently.

```kotlin
// coroutineScope: one failure cancels all
suspend fun loadPageData(): PageData = coroutineScope {
    val a = async { fetchProfile() }
    val b = async { fetchFeed() }
    // if fetchProfile() throws, fetchFeed() is also cancelled
    PageData(a.await(), b.await())
}

// supervisorScope: failures are isolated
suspend fun refreshDashboard() = supervisorScope {
    val notificationsJob = launch {
        runCatching { syncNotifications() }
            .onFailure { log.w("notifications failed: ${it.message}") }
    }
    val messagesJob = launch {
        runCatching { syncMessages() }
            .onFailure { log.w("messages failed: ${it.message}") }
    }
    // both run even if one fails
}
```

## Never Catch CancellationException

`CancellationException` is the mechanism coroutines use to propagate cancellation. Catching and swallowing it breaks structured concurrency.

```kotlin
// WRONG: swallowing CancellationException prevents cancellation
suspend fun broken() {
    try {
        delay(1_000)
    } catch (e: Exception) {     // catches CancellationException too!
        log.e("error", e)        // swallowed — coroutine keeps running
    }
}

// CORRECT: re-throw CancellationException
suspend fun correct() {
    try {
        delay(1_000)
    } catch (e: CancellationException) {
        throw e                  // always re-throw
    } catch (e: Exception) {
        log.e("error", e)
    }
}

// CORRECT: catch only specific exceptions
suspend fun specific() {
    try {
        delay(1_000)
    } catch (e: IOException) {
        handleNetworkError(e)    // does not catch CancellationException
    }
}
```

## runCatching with CancellationException Re-throw

`runCatching` from stdlib catches ALL exceptions including `CancellationException`. Always re-throw it.

```kotlin
// WRONG: runCatching swallows CancellationException
suspend fun unsafe(): Result<Data> = runCatching {
    api.fetch()
}

// CORRECT: re-throw CancellationException
suspend fun safe(): Result<Data> = runCatching {
    api.fetch()
}.also { result ->
    result.exceptionOrNull()?.let {
        if (it is CancellationException) throw it
    }
}

// Extension function to make this reusable
inline fun <T> Result<T>.rethrowCancellation(): Result<T> = also {
    it.exceptionOrNull()?.let { e ->
        if (e is CancellationException) throw e
    }
}

suspend fun safeFetch(): Result<Data> = runCatching { api.fetch() }.rethrowCancellation()
```

## Result Type for Safe Error Propagation

Using `Result<T>` as a return type makes error handling explicit at call sites.

```kotlin
// Repository returns Result
class UserRepository {
    suspend fun getUser(id: String): Result<User> = runCatching {
        api.fetchUser(id)
    }.rethrowCancellation()
}

// ViewModel handles Result
viewModelScope.launch {
    _state.value = UiState.Loading
    repository.getUser(userId)
        .onSuccess { user -> _state.value = UiState.Success(user) }
        .onFailure { e -> _state.value = UiState.Error(e.message ?: "Unknown error") }
}
```

## Retry Patterns with Exponential Backoff

```kotlin
suspend fun <T> retryWithBackoff(
    times: Int = 3,
    initialDelay: Long = 100,
    maxDelay: Long = 1_000,
    factor: Double = 2.0,
    block: suspend () -> T
): T {
    var currentDelay = initialDelay
    repeat(times - 1) {
        try {
            return block()
        } catch (e: Exception) {
            if (e is CancellationException) throw e
        }
        delay(currentDelay)
        currentDelay = (currentDelay * factor).toLong().coerceAtMost(maxDelay)
    }
    return block()  // last attempt, let exception propagate
}

// Usage
val data = retryWithBackoff(times = 3) { api.fetchData() }
```

## Flow Error Handling: catch, retry, retryWhen

```kotlin
// catch: handle errors mid-stream, can emit fallback values
repository.getDataFlow()
    .catch { e ->
        if (e is NetworkException) emit(cachedData)
        else throw e             // re-throw unexpected errors
    }
    .collect { updateUi(it) }

// retry: simple count-based retry
repository.getDataFlow()
    .retry(3) { e -> e is IOException }
    .collect { updateUi(it) }

// retryWhen: backoff retry
repository.getDataFlow()
    .retryWhen { cause, attempt ->
        if (cause is IOException && attempt < 3) {
            delay(100L * (attempt + 1))
            true    // retry
        } else {
            false   // don't retry, propagate error
        }
    }
    .collect { updateUi(it) }
```

## onCompletion for Cleanup

`onCompletion` runs whether the flow completed normally, was cancelled, or threw an error.

```kotlin
repository.getDataFlow()
    .onStart { _loading.value = true }
    .onCompletion { cause ->
        _loading.value = false
        if (cause != null) log.w("Flow ended with error: $cause")
    }
    .catch { e -> _error.value = e.message }
    .collect { data -> _data.value = data }
```
