---
name: kotlin-coroutines
description: Provides expert guidance on Kotlin Coroutines and Flow patterns, implementation, and issue remediation. This skill should be used when working with suspend functions, Flow collection, StateFlow, SharedFlow, structured concurrency, lifecycle-aware collection, or fixing coroutine-related issues. Key capabilities include flow operator design, error handling strategy, structured concurrency patterns, and testing guidance. Triggers on "Coroutines", "Flow", "StateFlow", "SharedFlow", "suspend", "coroutineScope", "viewModelScope", "lifecycleScope", "repeatOnLifecycle", "协程", "数据流", "异步", "异步编程", "并发处理", "协程作用域", "结构化并发". Do NOT use for app startup, binary size, or memory profiling — use android-performance instead. Do NOT use for RxJava→Coroutines migration — use android-migration-advisor instead.
memory: project
allowed-tools: [Read, Glob, Grep, Edit, Write]
---

# Kotlin Coroutines

Expert guidance on Kotlin Coroutines: suspend functions, Flow, structured concurrency, and lifecycle-aware collection.

## Agent Behavior Contract
1. Check project coroutine version and dependencies first
2. Identify scope boundary before proposing fixes (viewModelScope, lifecycleScope, custom)
3. Don't blanket GlobalScope — justify why unstructured is needed
4. Prefer structured concurrency — coroutineScope/supervisorScope over launch
5. Escape hatches require justification — GlobalScope, Dispatchers.IO.limitedParallelism()
6. Minimal blast radius — small, reviewable changes

## Quick Decision Tree
| Need | Reference |
|------|-----------|
| Anti-pattern detection | `references/anti-patterns.md` |
| Starting with coroutines | `references/basics.md` |
| Reactive data streams | `references/flow.md` |
| One-to-one communication | `references/channels.md` |
| Error handling strategy | `references/error-handling.md` |
| Lifecycle-aware collection | `references/lifecycle.md` |
| Testing async code | `references/testing.md` |

## Anti-Patterns (Coroutine Guard)
| Rule | Block If |
|------|----------|
| CK-COROUTINE-001 | `GlobalScope.launch` without justification |
| CK-COROUTINE-002 | `runBlocking` on Main thread |
| CK-COROUTINE-003 | Catching `CancellationException` |
| CK-COROUTINE-004 | `launchWhenStarted`/`launchWhenResumed` (deprecated) |
| CK-COROUTINE-005 | Hardcoded `Dispatchers.IO` without injection |
| CK-COROUTINE-006 | `flow.collect` in `init {}` of ViewModel |
| CK-COROUTINE-007 | `collectAsState()` instead of `collectAsStateWithLifecycle()` |
| CK-COROUTINE-008 | Missing `supervisorScope` for independent parallel tasks |
| CK-COROUTINE-009 | `Channel` without proper close/cancel handling |
| CK-COROUTINE-010 | `stateIn(SharingStarted.Eagerly)` in ViewModel |

## Triage Common Errors
| Error | Action |
|-------|--------|
| "Job was cancelled" | Check cancellation propagation → `references/error-handling.md` |
| "Cannot collect flow in init" | Move to repeatOnLifecycle → `references/lifecycle.md` |
| "Flow emission from different context" | Use flowOn for upstream → `references/flow.md` |
| "Suspend function can only be called from coroutine" | Check scope → `references/basics.md` |

## Core Patterns

### Structured Concurrency
```kotlin
suspend fun fetchData(): Result {
    return coroutineScope {
        val user = async { userRepo.getUser() }
        val posts = async { postRepo.getPosts() }
        Result(user.await(), posts.await())
    }
}
```

### StateFlow in ViewModel
```kotlin
class MyViewModel(private val repo: MyRepository) : ViewModel() {
    val uiState: StateFlow<UiState> = repo.dataFlow
        .map { UiState.Success(it) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), UiState.Loading)
}
```

### Lifecycle-Aware Collection (View)
```kotlin
lifecycleOwner.lifecycleScope.launch {
    lifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
        viewModel.uiState.collect { state -> updateUi(state) }
    }
}
```

### Lifecycle-Aware Collection (Compose)
```kotlin
val uiState by viewModel.uiState.collectAsStateWithLifecycle()
```

### Error Handling
```kotlin
suspend fun safeFetch(): Result<Data> = runCatching {
    withContext(Dispatchers.IO) { api.fetchData() }
}.onFailure { if (it is CancellationException) throw it }
```

## Best Practices
1. Structured concurrency — coroutineScope/supervisorScope over unstructured launch
2. flowOn for dispatcher switching — never collect on IO
3. WhileSubscribed(5_000) for ViewModel StateFlows
4. Handle cancellation — never catch CancellationException
5. Inject dispatchers for testing
6. Use Turbine for Flow testing

## References
| Category | Files |
|----------|-------|
| **Guard** | `anti-patterns.md` (10 rules) |
| **Basics** | `basics.md` |
| **Reactive** | `flow.md`, `channels.md` |
| **Safety** | `error-handling.md` |
| **Lifecycle** | `lifecycle.md` |
| **Testing** | `testing.md` |
