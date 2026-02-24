# Coroutines Migration Reference

Operator-by-operator and type-by-type guide for RxJava → Kotlin Coroutines/Flow.

## Type Mapping

| RxJava Type | Coroutines Equivalent | Notes |
|-------------|----------------------|-------|
| `Observable<T>` | `Flow<T>` | Cold, multiple values |
| `Flowable<T>` | `Flow<T>` with `.buffer()` | Backpressure-aware |
| `Single<T>` | `suspend fun(): T` | One value or error |
| `Maybe<T>` | `suspend fun(): T?` | Zero or one value |
| `Completable` | `suspend fun()` | Completion signal only |
| `BehaviorSubject<T>` | `MutableStateFlow<T>` | Current + future values |
| `PublishSubject<T>` | `MutableSharedFlow<T>` | Future values only |
| `ReplaySubject<T>` | `MutableSharedFlow(replay=N)` | N cached values |
| `Disposable` | `Job` | Cancellation handle |
| `CompositeDisposable` | `CoroutineScope` | Group cancellation |

## Observable → Flow

```kotlin
// RxJava
fun getProducts(): Observable<List<Product>> =
    Observable.fromCallable { database.getAllProducts() }
        .subscribeOn(Schedulers.io())
        .observeOn(AndroidSchedulers.mainThread())

// Coroutines
fun getProducts(): Flow<List<Product>> = flow {
    emit(database.getAllProducts())
}.flowOn(Dispatchers.IO)
// No observeOn needed — collect on the desired scope's dispatcher
```

## Single → suspend fun

```kotlin
// RxJava
fun fetchUser(id: String): Single<User> =
    Single.fromCallable { api.getUser(id) }
        .subscribeOn(Schedulers.io())

// Coroutines
suspend fun fetchUser(id: String): User = withContext(Dispatchers.IO) {
    api.getUser(id)
}
```

## Completable → suspend fun

```kotlin
// RxJava
fun saveUser(user: User): Completable =
    Completable.fromAction { database.insert(user) }
        .subscribeOn(Schedulers.io())

// Coroutines
suspend fun saveUser(user: User) = withContext(Dispatchers.IO) {
    database.insert(user)
}
```

## Maybe → suspend fun (nullable)

```kotlin
// RxJava
fun findUser(id: String): Maybe<User> =
    Maybe.fromCallable { database.findById(id) }

// Coroutines
suspend fun findUser(id: String): User? = withContext(Dispatchers.IO) {
    database.findById(id)
}
```

## Subject → StateFlow / SharedFlow

```kotlin
// BehaviorSubject — keeps last value
val subject = BehaviorSubject.createDefault(0)
subject.onNext(1)
subject.value  // reads current

// MutableStateFlow
val stateFlow = MutableStateFlow(0)
stateFlow.value = 1
stateFlow.value  // reads current

// PublishSubject — no replay
val subject = PublishSubject.create<Event>()
subject.onNext(Event.Click)

// MutableSharedFlow
val sharedFlow = MutableSharedFlow<Event>()
sharedFlow.emit(Event.Click)  // suspend
sharedFlow.tryEmit(Event.Click)  // non-suspend, may drop if no collectors
```

## Comprehensive Operator Table

| RxJava Operator | Flow / Coroutines |
|-----------------|-------------------|
| `.map { }` | `.map { }` |
| `.filter { }` | `.filter { }` |
| `.flatMap { }` | `.flatMapConcat { }` (sequential) |
| `.flatMap { }.concatMap` | `.flatMapConcat { }` |
| `.switchMap { }` | `.flatMapLatest { }` |
| `.concatMapEager` | `.flatMapMerge(concurrency=N) { }` |
| `.debounce(300)` | `.debounce(300)` |
| `.throttleFirst(300)` | No direct equiv — use custom operator |
| `.distinctUntilChanged()` | `.distinctUntilChanged()` |
| `.take(n)` | `.take(n)` |
| `.takeUntil(other)` | `.takeWhile { }` or `.transformWhile` |
| `.skip(n)` | `.drop(n)` |
| `.toList()` | `.toList()` |
| `.reduce()` | `.reduce()` |
| `.scan()` | `.scan()` |
| `.buffer(n)` | `.chunked(n)` (or `buffer()`) |
| `.window(n)` | `.chunked(n)` |
| `.zip(other)` | `.zip(other)` |
| `.combineLatest(a, b)` | `combine(a, b) { x, y -> }` |
| `.merge(a, b)` | `merge(a, b)` |
| `.concat(a, b)` | `a + b` (flow concatenation) |
| `.startWith(value)` | `flowOf(value) + original` |
| `.withLatestFrom(other)` | `combine` + `distinctUntilChanged` |
| `.retry(n)` | `.retry(n)` |
| `.retryWhen { }` | `.retryWhen { cause, attempt -> }` |
| `.onErrorReturn { }` | `.catch { emit(fallback) }` |
| `.onErrorResumeNext { }` | `.catch { emitAll(fallbackFlow) }` |
| `.doOnNext { }` | `.onEach { }` |
| `.doOnError { }` | `.catch { e -> ... ; throw e }` |
| `.doOnComplete { }` | `.onCompletion { }` |
| `.doOnDispose { }` | flow builder's `try/finally` |
| `.timeout(n)` | `withTimeoutOrNull(n)` wrapping collect |
| `.subscribeOn(io())` | `.flowOn(Dispatchers.IO)` |
| `.observeOn(main())` | collect in `lifecycleScope` / `Dispatchers.Main` |
| `.share()` | `.shareIn(scope, SharingStarted.Lazily)` |
| `.replay(1).refCount()` | `.stateIn(scope, SharingStarted.Lazily, initial)` |
| `.publish().refCount()` | `.shareIn(scope, SharingStarted.WhileSubscribed(5000))` |

## Disposable → Job / CoroutineScope

```kotlin
// RxJava — manual lifecycle
class MyViewModel : ViewModel() {
    private val disposables = CompositeDisposable()

    fun load() {
        disposables += repository.getUser()
            .subscribe({ user -> _uiState.value = user }, { e -> ... })
    }

    override fun onCleared() {
        disposables.clear()
    }
}

// Coroutines — scope-based auto-cancellation
class MyViewModel : ViewModel() {
    fun load() {
        viewModelScope.launch {
            try {
                val user = repository.getUser()
                _uiState.value = user
            } catch (e: Exception) { ... }
        }
        // No manual dispose — viewModelScope cancelled in onCleared() automatically
    }
}
```

## Error Handling

```kotlin
// RxJava
observable
    .onErrorReturn { e -> defaultValue }
    .onErrorResumeNext { e -> fallbackObservable }
    .retry(3)

// Flow
flow
    .catch { e -> emit(defaultValue) }          // onErrorReturn
    .catch { e -> emitAll(fallbackFlow) }       // onErrorResumeNext
    .retry(3)

// With conditional retry:
.retryWhen { cause, attempt ->
    if (cause is IOException && attempt < 3) {
        delay(1000 * (attempt + 1))
        true
    } else false
}
```

## Scheduler → Dispatcher Mapping

| RxJava Scheduler | Coroutines Dispatcher |
|------------------|-----------------------|
| `Schedulers.io()` | `Dispatchers.IO` |
| `Schedulers.computation()` | `Dispatchers.Default` |
| `AndroidSchedulers.mainThread()` | `Dispatchers.Main` |
| `Schedulers.single()` | `Dispatchers.IO.limitedParallelism(1)` |
| `Schedulers.newThread()` | `Dispatchers.IO` (uses thread pool) |
| `Schedulers.trampoline()` | No direct equiv — use `runBlocking` in tests |
| `TestScheduler` | `TestCoroutineScheduler` |

## Testing: TestScheduler → TestCoroutineScheduler

```kotlin
// RxJava test
@Test
fun testDebounce() {
    val scheduler = TestScheduler()
    val subject = PublishSubject.create<String>()
    val results = mutableListOf<String>()

    subject.debounce(300, TimeUnit.MILLISECONDS, scheduler)
        .subscribe { results.add(it) }

    subject.onNext("a")
    scheduler.advanceTimeBy(200, TimeUnit.MILLISECONDS)
    subject.onNext("b")
    scheduler.advanceTimeBy(300, TimeUnit.MILLISECONDS)

    assertThat(results).containsExactly("b")
}

// Coroutines test
@Test
fun testDebounce() = runTest {
    val results = mutableListOf<String>()
    val flow = MutableSharedFlow<String>()

    val job = launch {
        flow.debounce(300).collect { results.add(it) }
    }

    flow.emit("a")
    advanceTimeBy(200)
    flow.emit("b")
    advanceTimeBy(300)
    runCurrent()

    assertThat(results).containsExactly("b")
    job.cancel()
}
```

## Bridging: rxjava3-coroutines Adapter

For gradual migration, use `org.jetbrains.kotlinx:kotlinx-coroutines-rx3`:

```kotlin
// Existing RxJava code → Flow (for consumption in Coroutines code)
val flow: Flow<User> = rxObservable.asFlow()
val flow: Flow<User> = rxFlowable.asFlow()
suspend fun result() = rxSingle.await()
suspend fun result() = rxMaybe.awaitSingleOrNull()

// Coroutines code → RxJava (for legacy consumption)
val observable: Observable<User> = flow.asObservable()
val single: Single<User> = suspend { fetchUser() }.asSingle(Dispatchers.IO)
```

This lets you migrate production code in layers without a flag day.

## Common Gotchas

| Gotcha | Explanation | Fix |
|--------|-------------|-----|
| Cold vs Hot | Flow is cold (no backpressure), StateFlow is hot | Use `shareIn`/`stateIn` when needed |
| `emit` must be called from coroutine | Can't call `emit` from non-coroutine context | Use `MutableSharedFlow.tryEmit` or `runBlocking` in tests |
| `flatMapLatest` cancels in-flight | Unlike `switchMap` cancels happen at suspension points | Test cancellation behavior |
| Thread safety of `MutableStateFlow` | Value updates are atomic but `update { }` is needed for compare-and-set | Use `stateFlow.update { it.copy(...) }` |
| Backpressure | Flow has no built-in backpressure; use `buffer()`, `conflate()`, `collectLatest()` | Profile slow collectors |
| `SharedFlow` replay cache | Default `replay=0` — late subscribers miss emissions | Set `replay=1` for state-like behavior |
