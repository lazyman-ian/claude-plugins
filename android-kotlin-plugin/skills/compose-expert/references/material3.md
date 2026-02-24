# Material 3 in Jetpack Compose

Requires: `androidx.compose.material3:material3`

## Theme Setup

```kotlin
@Composable
fun AppTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = true,  // Android 12+ (API 31+)
    content: @Composable () -> Unit,
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context)
            else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = AppTypography,
        shapes = AppShapes,
        content = content,
    )
}

private val DarkColorScheme = darkColorScheme(
    primary = Purple80,
    secondary = PurpleGrey80,
    tertiary = Pink80,
)

private val LightColorScheme = lightColorScheme(
    primary = Purple40,
    secondary = PurpleGrey40,
    tertiary = Pink40,
)
```

## Color Scheme Roles

| Role | Use For |
|------|---------|
| `primary` | Key components (FAB, buttons, checkboxes) |
| `onPrimary` | Text/icons on primary |
| `primaryContainer` | Tonal button fill, chip fill |
| `secondary` | Less prominent components |
| `tertiary` | Contrasting accents |
| `surface` | Card, sheet, menu backgrounds |
| `surfaceVariant` | Chips, input fields |
| `error` | Error states |
| `outline` | Input borders, dividers |

```kotlin
// ✅ Use semantic color roles
Text(text = "Hello", color = MaterialTheme.colorScheme.primary)
Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant))

// ❌ Never hardcode colors in composables
Text(text = "Hello", color = Color(0xFF6750A4))
```

## Typography Scale

```kotlin
val AppTypography = Typography(
    displayLarge = TextStyle(fontFamily = RobotoFlex, fontWeight = FontWeight.Normal, fontSize = 57.sp),
    headlineLarge = TextStyle(fontFamily = RobotoFlex, fontWeight = FontWeight.Normal, fontSize = 32.sp),
    titleLarge = TextStyle(fontFamily = RobotoFlex, fontWeight = FontWeight.Normal, fontSize = 22.sp),
    bodyLarge = TextStyle(fontFamily = Roboto, fontWeight = FontWeight.Normal, fontSize = 16.sp),
    labelLarge = TextStyle(fontFamily = Roboto, fontWeight = FontWeight.Medium, fontSize = 14.sp),
)

// Usage
Text("Headline", style = MaterialTheme.typography.headlineLarge)
Text("Body text", style = MaterialTheme.typography.bodyMedium)
```

## M2 → M3 Component Migration

| Material 2 | Material 3 | Notes |
|-----------|-----------|-------|
| `TopAppBar` | `TopAppBar` / `CenterAlignedTopAppBar` / `LargeTopAppBar` | Different scroll behavior |
| `BottomNavigation` | `NavigationBar` | NavigationBarItem instead of BottomNavigationItem |
| `NavigationRail` | `NavigationRail` | Largely same API |
| `Button` | `Button` / `FilledTonalButton` / `OutlinedButton` / `TextButton` | More variants |
| `FloatingActionButton` | `FloatingActionButton` / `LargeFloatingActionButton` / `SmallFloatingActionButton` | — |
| `Card` | `Card` / `ElevatedCard` / `OutlinedCard` | Elevation changed to shadow semantics |
| `AlertDialog` | `AlertDialog` | New slot-based icon parameter |
| `Scaffold` | `Scaffold` | `contentWindowInsets` parameter added |
| `MaterialTheme.colors` | `MaterialTheme.colorScheme` | Completely different color roles |
| `primaryVariant` | `primaryContainer` | Renamed |

## Adaptive Layouts

### NavigationSuiteScaffold (adapts phone/tablet/desktop)

```kotlin
// Requires: androidx.compose.material3.adaptive:adaptive-navigation-suite
@Composable
fun AdaptiveScreen(navController: NavHostController) {
    NavigationSuiteScaffold(
        navigationSuiteItems = {
            item(
                selected = true,
                icon = { Icon(Icons.Default.Home, "Home") },
                label = { Text("Home") },
                onClick = {},
            )
            item(
                selected = false,
                icon = { Icon(Icons.Default.Search, "Search") },
                label = { Text("Search") },
                onClick = {},
            )
        }
    ) {
        // Screen content
    }
}
```

### ListDetailPaneScaffold

```kotlin
// Requires: androidx.compose.material3.adaptive:adaptive
@Composable
fun ListDetailScreen() {
    val navigator = rememberListDetailPaneScaffoldNavigator<Nothing>()

    BackHandler(navigator.canNavigateBack()) { navigator.navigateBack() }

    ListDetailPaneScaffold(
        directive = navigator.scaffoldDirective,
        value = navigator.scaffoldValue,
        listPane = {
            AnimatedPane {
                ItemList(onItemClick = { navigator.navigateTo(ListDetailPaneScaffoldRole.Detail) })
            }
        },
        detailPane = {
            AnimatedPane {
                ItemDetail()
            }
        },
    )
}
```

## Dark Theme

```kotlin
// In composable, read current theme
val isDark = isSystemInDarkTheme()

// Adjust elevation for dark mode
val elevation = if (isDark) 0.dp else 4.dp

// Use tonal elevation (M3 approach — avoids elevation overlays in dark mode)
Card(
    colors = CardDefaults.elevatedCardColors(),  // handles dark automatically
    elevation = CardDefaults.elevatedCardElevation(defaultElevation = 4.dp),
) { ... }
```

## Custom Theme Tokens

```kotlin
// Extend MaterialTheme with custom tokens
data class AppColorScheme(
    val brand: Color,
    val brandContainer: Color,
)

val LocalAppColorScheme = staticCompositionLocalOf {
    AppColorScheme(brand = Color.Unspecified, brandContainer = Color.Unspecified)
}

val MaterialTheme.appColors: AppColorScheme
    @Composable get() = LocalAppColorScheme.current

// Wrap theme provider
CompositionLocalProvider(LocalAppColorScheme provides lightAppColors) {
    MaterialTheme(...) { content() }
}

// Usage
Text(color = MaterialTheme.appColors.brand, text = "Brand text")
```
