# Testing Coroutines and Flow

## Dependencies

```kotlin
// build.gradle.kts
testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.8.0")
testImplementation("app.cash.turbine:turbine:1.1.0")
```

## runTest for Suspend Functions

`runTest` is the standard test coroutine builder. It automatically advances virtual time so `delay()` completes instantly.

```kotlin
class UserRepositoryTest {
    @Test
    fun `fetch user returns success`() = runTest {
        val repo = UserRepository(fakeApi)
        val user = repo.fetchUser("123")    // suspend call — works inside runTest
        assertEquals("Alice", user.name)
    }

    @Test
    fun `fetch user handles network error`() = runTest {
        val repo = UserRepository(failingApi)
        val result = runCatching { repo.fetchUser("123") }
        assertTrue(result.isFailure)
        assertIs<IOException>(result.exceptionOrNull())
    }
}
```

## StandardTestDispatcher vs UnconfinedTestDispatcher

| Dispatcher | Behavior | Use For |
|------------|----------|---------|
| `StandardTestDispatcher` | Does NOT auto-run coroutines. Requires `advanceUntilIdle()` or `runCurrent()`. | Precise control over execution order |
| `UnconfinedTestDispatcher` | Runs coroutines eagerly on the current thread. | Simple tests where order doesn't matter |

```kotlin
// StandardTestDispatcher (default in runTest)
@Test
fun `state transitions are ordered`() = runTest {
    val vm = MyViewModel(repo, testDispatcher)
    vm.loadData()
    // coroutine hasn't run yet
    assertEquals(UiState.Loading, vm.uiState.value)

    advanceUntilIdle()  // run all pending coroutines
    assertEquals(UiState.Success(data), vm.uiState.value)
}

// UnconfinedTestDispatcher — eager execution
@Test
fun `state is immediately set`() = runTest(UnconfinedTestDispatcher()) {
    val vm = MyViewModel(repo)
    vm.loadData()
    // coroutine ran synchronously — no advanceUntilIdle needed
    assertEquals(UiState.Success(data), vm.uiState.value)
}
```

## advanceTimeBy and advanceUntilIdle

```kotlin
@Test
fun `debounce delays emission`() = runTest {
    val dispatcher = StandardTestDispatcher(testScheduler)
    val vm = SearchViewModel(repo, dispatcher)

    vm.onQueryChanged("ko")
    vm.onQueryChanged("kot")
    vm.onQueryChanged("kotl")

    // No search yet — debounce pending
    verify(repo, never()).search(any())

    advanceTimeBy(300)       // advance 300ms
    runCurrent()             // execute pending coroutines at current time
    verify(repo).search("kotl")    // only latest query searched
}

@Test
fun `retry succeeds after two failures`() = runTest {
    val api = FakeApi(failCount = 2)
    val repo = UserRepository(api)

    val result = repo.fetchWithRetry("123")   // contains backoff delays
    // runTest auto-advances virtual time through delays
    assertTrue(result.isSuccess)
    assertEquals(3, api.callCount)
}
```

## Turbine for Flow Testing

Turbine provides `test {}` extension for Flow, with `awaitItem()`, `awaitComplete()`, `awaitError()`.

```kotlin
@Test
fun `uiState emits loading then success`() = runTest {
    val vm = MyViewModel(fakeRepo)

    vm.uiState.test {
        assertEquals(UiState.Loading, awaitItem())    // initial value

        vm.loadData()
        advanceUntilIdle()

        assertEquals(UiState.Success(testData), awaitItem())
        cancelAndIgnoreRemainingEvents()
    }
}

@Test
fun `search results update on query`() = runTest {
    val vm = SearchViewModel(fakeRepo)

    vm.results.test {
        assertEquals(emptyList(), awaitItem())        // initial state

        vm.onQueryChanged("kotlin")
        advanceTimeBy(300)
        runCurrent()

        val results = awaitItem()
        assertTrue(results.isNotEmpty())
        cancelAndIgnoreRemainingEvents()
    }
}

@Test
fun `flow emits error on network failure`() = runTest {
    val repo = FailingRepository()

    repo.dataFlow().test {
        awaitError().also { error ->
            assertIs<NetworkException>(error)
        }
    }
}
```

## Testing StateFlow Emissions

```kotlin
@Test
fun `viewModel emits expected states`() = runTest {
    val vm = ProfileViewModel(fakeRepo)

    val states = mutableListOf<ProfileState>()
    val job = launch(UnconfinedTestDispatcher()) {
        vm.profileState.toList(states)
    }

    vm.loadProfile("user-1")
    advanceUntilIdle()
    job.cancel()

    assertEquals(ProfileState.Loading, states[0])
    assertEquals(ProfileState.Success(testProfile), states[1])
}
```

## Injecting Dispatchers for Testing

Always inject dispatchers so tests can provide `TestDispatcher`.

```kotlin
// Production code
class ProfileRepository(
    private val api: ProfileApi,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
) {
    suspend fun fetch(id: String): Profile = withContext(ioDispatcher) {
        api.getProfile(id)
    }
}

// ViewModel with injected dispatcher
class ProfileViewModel(
    private val repo: ProfileRepository,
    private val mainDispatcher: CoroutineDispatcher = Dispatchers.Main.immediate
) : ViewModel() {
    // ...
}

// Test
@Test
fun `profile loads successfully`() = runTest {
    val testDispatcher = StandardTestDispatcher(testScheduler)
    val repo = ProfileRepository(fakeApi, ioDispatcher = testDispatcher)
    val vm = ProfileViewModel(repo, mainDispatcher = testDispatcher)

    vm.loadProfile("user-1")
    advanceUntilIdle()

    assertEquals(ProfileState.Success(testProfile), vm.state.value)
}
```

## Testing Cancellation Behavior

```kotlin
@Test
fun `in-flight request is cancelled on new query`() = runTest {
    var fetchCount = 0
    val slowRepo = object : SearchRepository {
        override fun search(query: String) = flow {
            fetchCount++
            delay(1_000)
            emit(listOf("result"))
        }
    }
    val vm = SearchViewModel(slowRepo)

    vm.onQueryChanged("a")
    advanceTimeBy(100)         // search "a" started but not complete

    vm.onQueryChanged("ab")   // new query — flatMapLatest cancels "a" search
    advanceUntilIdle()

    // Only one result — "a" search was cancelled
    assertEquals(1, fetchCount.coerceAtLeast(1))
}
```

## Integration Testing with Hilt

```kotlin
@HiltAndroidTest
class SearchIntegrationTest {
    @get:Rule
    val hiltRule = HiltAndroidRule(this)

    @Inject lateinit var repo: SearchRepository

    @Test
    fun `end to end search returns results`() = runTest {
        hiltRule.inject()
        val vm = SearchViewModel(repo)

        vm.uiState.test {
            assertEquals(SearchState.Idle, awaitItem())
            vm.onQueryChanged("kotlin")
            advanceTimeBy(300)
            runCurrent()
            val result = awaitItem()
            assertIs<SearchState.Success>(result)
            cancelAndIgnoreRemainingEvents()
        }
    }
}
```
