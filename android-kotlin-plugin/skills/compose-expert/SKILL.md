---
name: compose-expert
description: Writes, reviews, and improves Jetpack Compose code following best practices for state management, navigation, Material 3, and modern Compose APIs. This skill should be used when building new Compose features, refactoring existing composables, reviewing Compose code quality, or adopting modern patterns like type-safe navigation and strong skipping. Key capabilities include data flow design, composable extraction, deprecated API migration, and list identity optimization. Triggers on "Compose", "Jetpack Compose", "Composable", "@Composable", "state management", "remember", "ViewModel", "NavHost", "NavGraph", "Material3", "M3", "compose code", "Compose最佳实践", "组合式布局", "界面设计", "状态管理", "Compose导航", "Material3组件". Do NOT use for Compose performance profiling or recomposition analysis — use compose-performance-audit instead. Do NOT use when evaluating whether to migrate or choosing technology stacks — use android-migration-advisor instead.
memory: project
allowed-tools: [Read, Glob, Grep, Edit, Write]
---

# Compose Expert

Build, review, and improve Jetpack Compose features with modern best practices.

## Workflow

1. **Review Code** — check state management, modern APIs, composable structure, performance patterns
2. **Improve Code** — prefer modern patterns, extract complex composables, ensure stable identity
3. **Implement New** — design data flow first, use modern APIs, structure for optimal recomposition

## Core Guidelines

### State Management

| Pattern | Use When |
|---------|----------|
| `remember` | Derived/computed values within composition |
| `rememberSaveable` | State that survives config changes |
| `ViewModel + StateFlow` | Screen-level business state |
| `derivedStateOf` | Expensive computation from other state |
| `mutableStateOf` | Simple local UI state |
| `collectAsStateWithLifecycle()` | Collecting flows in Compose |

Rules:
- Hoist state to lowest common ancestor
- Use UDF: single UiState sealed class + events
- Never use `collectAsState()` — always `collectAsStateWithLifecycle()`
- `remember { mutableStateOf() }` for simple UI state

### Modern APIs

| Deprecated | Modern | Min API |
|------------|--------|---------|
| `accompanist-systemuicontroller` | `enableEdgeToEdge()` | — |
| `accompanist-pager` | `HorizontalPager`/`VerticalPager` | — |
| `accompanist-navigation-animation` | Built-in animated NavHost | — |
| String route navigation | Type-safe `@Serializable` routes | Nav 2.8+ |
| `BottomNavigation` (M2) | `NavigationBar` (M3) | — |
| `TopAppBar` (M2) | `TopAppBar` (M3) with `TopAppBarDefaults` | — |
| `rememberCoroutineScope` in click | Use `viewModelScope` | — |

### Navigation (Type-Safe)

```kotlin
@Serializable data class Profile(val userId: String)
@Serializable data object Home

NavHost(navController, startDestination = Home) {
    composable<Home> {
        HomeScreen(onNavigateToProfile = { navController.navigate(Profile(it)) })
    }
    composable<Profile> { backStackEntry ->
        ProfileScreen(backStackEntry.toRoute<Profile>())
    }
}
```

### Material 3

- Dynamic Color: `dynamicDarkColorScheme(context)` / `dynamicLightColorScheme(context)` (API 31+)
- Adaptive layouts: `NavigationSuiteScaffold`, `ListDetailPaneScaffold`
- Use `MaterialTheme.colorScheme` not `MaterialTheme.colors`

### Side Effects

| Effect | Use When |
|--------|----------|
| `LaunchedEffect(key)` | One-shot or key-dependent coroutine |
| `DisposableEffect(key)` | Register/unregister callbacks |
| `SideEffect` | Non-suspend side effect every recomposition |
| `rememberCoroutineScope()` | Event-driven coroutines (click handler) |
| `derivedStateOf` | Compute value from state, skip recomposition |
| `snapshotFlow` | Convert Compose state to Flow |

### Composable Ordering

```kotlin
@Composable
fun MyScreen(
    viewModel: MyViewModel = hiltViewModel(),  // 1. ViewModel
    onNavigateBack: () -> Unit,                // 2. Navigation callbacks
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()  // 3. State collection
    var localState by remember { mutableStateOf(false) }            // 4. Local state
    // 5. Effects
    LaunchedEffect(Unit) { ... }
    // 6. UI
    Scaffold { ... }
}
```

### Review Checklist

- Using `collectAsStateWithLifecycle()` not `collectAsState()`
- Using type-safe Navigation (not string routes)
- Using Material 3 (not Material 2)
- ForEach/LazyColumn uses stable `key`
- State hoisted properly (UDF pattern)
- No side effects in composition
- Composables kept small, body pure
- `@Stable`/`@Immutable` annotations where needed

## Quick Reference

| Category | File |
|----------|------|
| **State** | `references/state-management.md` |
| **Navigation** | `references/navigation.md` |
| **Material 3** | `references/material3.md` |
| **Side Effects** | `references/side-effects.md` |
| **Composables** | `references/composables.md` |
| **Testing** | `references/testing.md` |
| **Interop** | `references/interop.md` |
| **APIs** | `references/modern-apis.md` |
