# Compose Stability Reference

## How the Compiler Infers Stability

The Compose compiler statically analyzes each type used as a composable parameter and marks it as **stable** or **unstable**. A composable whose every parameter is stable can be **skipped** during recomposition if none of the values changed.

### Inference Rules

| Condition | Result |
|-----------|--------|
| Primitive: Boolean, Int, Long, Float, Double, Char, String | Stable |
| `@Immutable` annotated class | Stable (compiler trusts the contract) |
| `@Stable` annotated class | Stable (weaker contract, still skippable) |
| `data class` where all fields are stable val | Stable |
| `data class` with any `var` field | Unstable |
| `data class` with any unstable field type | Unstable |
| Abstract class / interface | Unstable (unknown implementation) |
| `kotlin.collections.List`, `Map`, `Set` | Unstable (mutable impl at runtime) |
| `kotlinx.collections.immutable.ImmutableList` | Stable |
| Enum | Stable |
| Lambda with stable captures | Stable (strong skipping memoizes automatically) |

The compiler does **not** look at actual runtime values — it only uses static type information.

## @Immutable vs @Stable

### @Immutable
Strongest guarantee: the annotated class will never change after construction.

```kotlin
@Immutable
data class UserProfile(
    val id: String,
    val name: String,
    val avatarUrl: String
)
```

- Compose skips recomposition if the reference is equal (no need to call `equals`)
- Use when the object is truly read-only after creation
- Appropriate for value objects, DTOs, snapshots

### @Stable
Weaker guarantee: if two instances are `equals`, they are considered identical. Mutable state is allowed IF Compose is notified of changes (e.g., via `MutableState`).

```kotlin
@Stable
class CartState {
    var itemCount by mutableStateOf(0)
        private set

    fun addItem() { itemCount++ }
}
```

- Compose compares via `equals()` between recompositions
- If `equals` returns true, the composable is skipped
- Use for observable stable objects with Compose-tracked mutation

### Choosing Between Them

| Scenario | Annotation |
|----------|-----------|
| Pure value / DTO | `@Immutable` |
| UI state holder with `mutableStateOf` | `@Stable` |
| Wrapper around `List` to stabilize it | `@Immutable` |
| Class with callbacks / lambdas | `@Stable` |

## Fixing Common Unstable Types

### kotlin.collections.List (and Map, Set)

The most common source of instability. At runtime these are `ArrayList` / `LinkedHashMap` — mutable and unstable.

**Option 1: kotlinx.collections.immutable**
```kotlin
// build.gradle.kts
implementation("org.jetbrains.kotlinx:kotlinx-collections-immutable:0.3.7")
```

```kotlin
// Before (unstable)
@Composable
fun ItemList(items: List<Item>) { ... }

// After (stable)
@Composable
fun ItemList(items: ImmutableList<Item>) { ... }

// Conversion at the ViewModel boundary
val items: StateFlow<ImmutableList<Item>> = _items
    .map { it.toImmutableList() }
    .stateIn(viewModelScope, SharingStarted.Lazily, persistentListOf())
```

**Option 2: @Immutable wrapper**
```kotlin
@Immutable
data class ItemListUiState(val items: List<Item>)

@Composable
fun ItemList(state: ItemListUiState) { ... }
```

### Interface Parameters

```kotlin
// Unstable — unknown concrete type
interface Animal
@Composable
fun AnimalCard(animal: Animal) { ... }

// Fix A: sealed class/interface (compiler knows all subtypes)
sealed interface Animal {
    data class Dog(val name: String) : Animal
    data class Cat(val name: String) : Animal
}

// Fix B: @Stable annotation on the interface
@Stable
interface Animal {
    val name: String
}
```

### Data class with unstable field

```kotlin
// Unstable because List<Tag> is unstable
data class Article(
    val id: String,
    val title: String,
    val tags: List<Tag>  // unstable
)

// Fix A: use ImmutableList
data class Article(
    val id: String,
    val title: String,
    val tags: ImmutableList<Tag>
)

// Fix B: wrap the whole thing
@Immutable
data class Article(
    val id: String,
    val title: String,
    val tags: List<Tag>  // contract: never mutated externally
)
```

## Strong Skipping Mode (Kotlin 2.0.20+)

Since Kotlin 2.0.20, strong skipping is enabled by default.

### What It Changes
- All composable functions are skippable, even those with unstable parameters
- Lambda parameters are auto-memoized (no `remember { }` needed for simple lambdas)
- Unstable parameters are compared by **reference** (not `equals`) — still causes recomposition if a new object is created

### What It Does NOT Fix
- Creating a new `List` on every recomposition still causes recomposition (reference differs)
- Unstable data classes that produce new instances on state change still recompose
- `kotlinx.collections.immutable` is still the recommended fix for collections

### Verifying Strong Skipping Is Active
```bash
# In compose compiler metrics output (*-composables.txt)
# You should see "skippable" on most composables
fun ItemRow (unstable item: Item) skippable <runtime stability>
```

## Stability Configuration File (Multi-Module)

When a class is in a module not processed by the Compose compiler (e.g., a data module), annotate it via configuration:

```
# stability-config.txt (in the consuming module)
com.example.data.Item
com.example.data.UserProfile
```

```kotlin
// build.gradle.kts
kotlinOptions {
    freeCompilerArgs += listOf(
        "-P", "plugin:androidx.compose.compiler.plugins.kotlin:stabilityConfigurationPath=${projectDir}/stability-config.txt"
    )
}
```

This tells the compiler to treat the listed classes as stable without modifying the source module.

## Compose Compiler Metrics Interpretation

Enable metrics in `build.gradle.kts`:
```kotlin
kotlinOptions {
    freeCompilerArgs += listOf(
        "-P", "plugin:androidx.compose.compiler.plugins.kotlin:reportsDestination=${buildDir}/compose_reports",
        "-P", "plugin:androidx.compose.compiler.plugins.kotlin:metricsDestination=${buildDir}/compose_metrics"
    )
}
```

### *-classes.txt — Type Stability
```
unstable class Article {
  stable val id: String
  unstable val tags: List<Tag>
  <runtime stability>
}
```
- `unstable class` → causes any composable with this param to be non-skippable (without strong skipping)
- Fields marked `unstable` are the culprits

### *-composables.txt — Function Skippability
```
restartable skippable scheme("[androidx.compose.ui.UiComposable]") fun ItemRow(
  stable modifier: Modifier? = @static Companion
  unstable item: Item
)
```

| Term | Meaning |
|------|---------|
| `restartable` | Can re-execute independently during recomposition |
| `skippable` | Will be skipped if all params unchanged |
| `unstable` param | This parameter is preventing optimal skipping |
| `<runtime stability>` | Stability resolved at runtime (strong skipping) |

### *-composables.csv — Summary Table
Columns: `name,skippable,restartable,readonly,unstableParams`
Use this to quickly scan for composables with `unstableParams > 0`.
