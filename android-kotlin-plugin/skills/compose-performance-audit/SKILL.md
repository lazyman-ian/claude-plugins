---
name: compose-performance-audit
description: Audits and optimizes Jetpack Compose rendering performance through code review and recomposition analysis. This skill should be used when diagnosing slow rendering, janky scrolling, excessive recomposition, unstable parameters, or layout thrash in Compose apps. Key capabilities include stability analysis, recomposition counting, lazy layout optimization, and Compose compiler metrics guidance. Triggers on "recomposition", "Compose performance", "stability", "@Stable", "@Immutable", "LazyColumn slow", "janky", "skippable", "restartable", "Compose lag", "Compose卡顿", "重组", "渲染性能", "重组分析", "跳过优化", "性能审计", "稳定性标记". Do NOT use for general Compose code writing or review — use compose-expert instead. Do NOT use for system-level performance (startup, memory, APK size) — use android-performance instead.
memory: project
allowed-tools: [Read, Glob, Grep]
---

# Compose Performance Audit

Audit Jetpack Compose rendering performance: stability, recomposition, lazy layouts, and compiler optimization.

## Workflow Decision Tree
- If user provides code → Code-First Review
- If user describes symptoms (janky scroll, slow rendering) → ask for code, then review
- If code review is inconclusive → Guide to Profile with Layout Inspector / Compose Compiler Metrics

## 1. Code-First Review

Collect:
- Target composable/feature code
- Data flow: state, ViewModel, parameters
- Symptoms and reproduction steps

Focus on:
- **Unstable parameters** causing unnecessary recomposition
- **Lambda re-allocation** in composition (non-remembered lambdas)
- **Heavy work in composition** (sorting, filtering, formatting)
- **LazyColumn/LazyRow** anti-patterns (missing keys, unstable items)
- **Layout thrash** (deep nesting, intrinsic measurements)
- **Unnecessary recomposition** from broad state reads

## 2. Guide to Profile

### Compose Compiler Metrics
```bash
# build.gradle.kts
kotlinOptions {
    freeCompilerArgs += listOf(
        "-P", "plugin:androidx.compose.compiler.plugins.kotlin:reportsDestination=${buildDir}/compose_reports",
        "-P", "plugin:androidx.compose.compiler.plugins.kotlin:metricsDestination=${buildDir}/compose_metrics"
    )
}
```
Analyze: `*-composables.txt`, `*-classes.txt` for skippable/restartable status

### Layout Inspector
- Android Studio → Layout Inspector → Enable recomposition counts
- Look for high recomposition count on composables that shouldn't update

### System Trace
- Record with Android Studio Profiler → CPU → System Trace
- Look for long composition/layout/draw phases

## 3. Stability Analysis

### What Makes a Type Stable
| Type | Stable? | Why |
|------|---------|-----|
| Primitive (Int, String, Boolean) | Yes | Immutable |
| `data class` with stable fields | Yes | Structural equality |
| `List<T>` (kotlin.collections) | No | Mutable implementation |
| `kotlinx.collections.immutableList` | Yes | Truly immutable |
| Class with `var` properties | No | Mutable |
| Interface/abstract class | No | Unknown implementation |
| `@Stable` annotated | Yes | Contract promise |
| `@Immutable` annotated | Yes | Stronger contract |

### Strong Skipping Mode (Default since Kotlin 2.0.20)
- ALL composables are skippable by default
- Lambdas are auto-memoized
- BUT: unstable parameters still compared by reference (not equals)
- kotlinx.collections.immutable still needed for collection params
- Strong skipping does NOT fix: mutable collections, unstable data classes

## 4. Common Code Smells (and Fixes)

### Unstable parameters causing recomposition
```kotlin
// Bad: List is unstable, recomposes every time
@Composable
fun ItemList(items: List<Item>) { ... }

// Fix: Use ImmutableList
@Composable
fun ItemList(items: ImmutableList<Item>) { ... }

// Or: annotate wrapper
@Immutable
data class ItemListState(val items: List<Item>)
```

### Lambda re-allocation
```kotlin
// Bad: new lambda every recomposition (pre-strong-skipping)
LazyColumn {
    items(list) { item ->
        ItemRow(onClick = { viewModel.onItemClick(item.id) })
    }
}

// Fix: method reference or remembered lambda
LazyColumn {
    items(list, key = { it.id }) { item ->
        ItemRow(onClick = remember(item.id) { { viewModel.onItemClick(item.id) } })
    }
}
```

### Heavy computation in composition
```kotlin
// Bad: sorts every recomposition
@Composable
fun SortedList(items: List<Item>) {
    val sorted = items.sortedBy { it.name } // runs every time
    LazyColumn { items(sorted) { ... } }
}

// Fix: derivedStateOf or ViewModel
@Composable
fun SortedList(items: List<Item>) {
    val sorted by remember(items) { derivedStateOf { items.sortedBy { it.name } } }
    LazyColumn { items(sorted) { ... } }
}
```

### LazyColumn anti-patterns
```kotlin
// Bad: no key, no contentType
LazyColumn {
    items(list) { item -> ItemRow(item) }
}

// Fix: stable key + contentType
LazyColumn {
    items(list, key = { it.id }, contentType = { it.type }) { item ->
        ItemRow(item)
    }
}
```

### Reading state too broadly
```kotlin
// Bad: entire state recomposes everything
@Composable
fun Screen(viewModel: MyViewModel) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    Header(state.title)    // recomposes when ANY field changes
    Content(state.items)   // recomposes when ANY field changes
}

// Fix: split state into separate flows in ViewModel
// titleFlow and itemsFlow emit independently
```

### Unnecessary animation recomposition
```kotlin
// Bad: animateFloatAsState triggers recomposition of entire parent
@Composable
fun AnimatedCard() {
    val alpha by animateFloatAsState(if (visible) 1f else 0f)
    Card(modifier = Modifier.alpha(alpha)) { HeavyContent() }
}

// Fix: use graphicsLayer (no recomposition, only re-draw)
@Composable
fun AnimatedCard() {
    val alpha by animateFloatAsState(if (visible) 1f else 0f)
    Card(modifier = Modifier.graphicsLayer { this.alpha = alpha }) { HeavyContent() }
}
```

## 5. Remediate

Apply targeted fixes:
- Add `@Stable`/`@Immutable` annotations to data classes
- Use `kotlinx.collections.immutable` for collection parameters
- Move computation to ViewModel or `derivedStateOf`
- Add `key` and `contentType` to LazyColumn/LazyRow items
- Use `graphicsLayer` for animation-only changes
- Split broad state into granular flows
- Use `Modifier.Node` instead of `composed` modifiers

## 6. Verify

Ask user to:
1. Re-run Layout Inspector with recomposition counts
2. Check Compose compiler metrics (skippable/restartable)
3. Compare frame timing (System Trace)

## Outputs
- Short metrics table (before/after if available)
- Top issues ordered by impact
- Proposed fixes with estimated effort

## References
| Category | Reference |
|----------|-----------|
| **Stability** | `references/stability.md` |
| **Recomposition** | `references/recomposition.md` |
| **Lazy Layouts** | `references/lazy-layouts.md` |
