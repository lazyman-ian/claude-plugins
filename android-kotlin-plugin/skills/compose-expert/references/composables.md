# Composable Design Patterns

## Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Composable that emits UI | PascalCase noun | `UserProfile`, `SearchBar` |
| Composable returning value | camelCase verb | `rememberScrollState()` |
| Extension composable | camelCase | `Modifier.shimmer()` |
| Preview | `Preview` suffix | `UserProfilePreview` |

```kotlin
// ✅ Noun — emits UI
@Composable
fun UserProfile(userId: String, modifier: Modifier = Modifier) { ... }

// ✅ Verb — returns value (not UI-emitting)
@Composable
fun rememberFormState(): FormState { ... }

// ❌ Verb for UI-emitting composable
@Composable
fun showUserProfile(userId: String) { ... }
```

## Modifier Parameter Convention

Every composable that emits UI must accept a `modifier` parameter as the first optional parameter after required params.

```kotlin
// ✅ Correct signature
@Composable
fun ArticleCard(
    title: String,
    author: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,  // Always last optional, always default to Modifier
) {
    Card(modifier = modifier) {    // Pass modifier to the root element only
        ...
    }
}

// ❌ Don't add size to modifier inside — let caller decide
@Composable
fun ArticleCard(modifier: Modifier = Modifier) {
    Card(modifier = modifier.fillMaxWidth()) { ... }  // Opinionated — remove fillMaxWidth
}
```

## Slot API Pattern

Use content lambdas to allow callers to customize sections without exposing internal state.

```kotlin
// Slot API — caller controls specific regions
@Composable
fun ProfileCard(
    modifier: Modifier = Modifier,
    header: @Composable () -> Unit = {},
    content: @Composable ColumnScope.() -> Unit,
    actions: @Composable RowScope.() -> Unit = {},
) {
    Card(modifier = modifier) {
        Column {
            header()
            Column(content = content)
            Row(content = actions)
        }
    }
}

// Usage — caller customizes each slot
ProfileCard(
    header = { AsyncImage(model = avatarUrl, contentDescription = null) },
    content = {
        Text(name, style = MaterialTheme.typography.titleLarge)
        Text(bio, style = MaterialTheme.typography.bodyMedium)
    },
    actions = {
        TextButton(onClick = onFollow) { Text("Follow") }
        TextButton(onClick = onMessage) { Text("Message") }
    }
)
```

## Stateless vs Stateful Composables

Prefer stateless composables for composability and testability.

```kotlin
// Stateless — easy to test, preview, and reuse
@Composable
fun CounterButton(
    count: Int,
    onIncrement: () -> Unit,
    onDecrement: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(modifier = modifier, verticalAlignment = Alignment.CenterVertically) {
        IconButton(onClick = onDecrement) { Icon(Icons.Default.Remove, "-") }
        Text("$count")
        IconButton(onClick = onIncrement) { Icon(Icons.Default.Add, "+") }
    }
}

// Stateful wrapper — convenient but less reusable
@Composable
fun CounterButtonStateful(modifier: Modifier = Modifier) {
    var count by remember { mutableIntStateOf(0) }
    CounterButton(
        count = count,
        onIncrement = { count++ },
        onDecrement = { count-- },
        modifier = modifier,
    )
}
```

## @Stable and @Immutable Annotations

Help the Compose compiler skip recomposition when parameters haven't changed.

```kotlin
// @Immutable — all public properties are read-only and will never change
@Immutable
data class UserProfile(
    val id: String,
    val name: String,
    val avatarUrl: String,
)

// @Stable — reads are safe during composition; writes notify Compose
@Stable
class SearchState(initialQuery: String = "") {
    var query by mutableStateOf(initialQuery)
    var isLoading by mutableStateOf(false)
}

// Unstable class — Compose will ALWAYS recompose (even if data hasn't changed)
data class UserProfile(
    val id: String,
    val tags: List<String>,  // List is not @Stable — makes whole class unstable
)

// Fix 1: Use @Immutable (if truly immutable)
@Immutable data class UserProfile(val id: String, val tags: List<String>)

// Fix 2: Use ImmutableList (kotlinx.collections.immutable)
data class UserProfile(val id: String, val tags: ImmutableList<String>)
```

Requires `compose.compiler.generateFunctionKeyMetaAnnotations=true` to inspect stability.

## Composable Extraction Strategy

Extract when a composable block:
- Is reused in 2+ places
- Has its own distinct state or logic
- Exceeds ~40 lines (subjective — use judgment)
- Can be independently previewed or tested

```kotlin
// ❌ One giant composable
@Composable
fun ArticleScreen(...) {
    Column {
        // 20 lines of header
        Row { AsyncImage(...); Column { Text(title); Text(author) } }
        // 30 lines of body
        LazyColumn { items(paragraphs) { Text(it) } }
        // 15 lines of footer
        Row { LikeButton(...); ShareButton(...); BookmarkButton(...) }
    }
}

// ✅ Extracted into meaningful units
@Composable
fun ArticleScreen(...) {
    Column {
        ArticleHeader(title = title, author = author, imageUrl = imageUrl)
        ArticleBody(paragraphs = paragraphs)
        ArticleActions(onLike = onLike, onShare = onShare, onBookmark = onBookmark)
    }
}
```

## Default Parameter Patterns

```kotlin
// Provide sensible defaults to simplify call sites
@Composable
fun StatusBadge(
    status: Status,
    modifier: Modifier = Modifier,
    style: TextStyle = MaterialTheme.typography.labelSmall,
    shape: Shape = CircleShape,
    contentPadding: PaddingValues = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
) { ... }

// Minimal call site
StatusBadge(status = Status.Active)

// Customized call site
StatusBadge(status = Status.Active, modifier = Modifier.align(Alignment.End))
```

## Preview Best Practices

```kotlin
// ✅ Preview stateless component with fake data
@Preview(showBackground = true)
@Composable
private fun ArticleCardPreview() {
    AppTheme {
        ArticleCard(
            title = "Preview Title",
            author = "Jane Doe",
            onClick = {},
        )
    }
}

// ✅ Light + Dark in one annotation
@PreviewLightDark
@Composable
private fun ArticleCardThemePreview() {
    AppTheme { ArticleCard(...) }
}

// ✅ Multiple screen sizes
@PreviewScreenSizes
@Composable
private fun ArticleScreenPreview() {
    AppTheme { ArticleScreen(...) }
}

// ✅ Multiple font scales
@PreviewFontScale
@Composable
private fun ArticleCardFontPreview() {
    AppTheme { ArticleCard(...) }
}

// Custom multi-preview annotation
@Preview(name = "Phone", device = Devices.PHONE)
@Preview(name = "Tablet", device = Devices.TABLET)
annotation class DevicePreviews

@DevicePreviews
@Composable
private fun HomeScreenPreview() {
    AppTheme { HomeScreen() }
}
```
