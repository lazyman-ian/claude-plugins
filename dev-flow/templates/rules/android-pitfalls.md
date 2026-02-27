---
paths:
  - "**/*.kt"
  - "**/*.kts"
  - "**/src/main/**"
---

# Android Development Pitfalls

Common Android/Kotlin pitfalls detected from project history.

## Compose
- remember {} with mutable state: use rememberSaveable for surviving config changes
- LaunchedEffect(Unit) runs once — use a proper key for re-triggering
- Avoid side effects in Composable functions — use LaunchedEffect/SideEffect

## Coroutines
- GlobalScope launches survive Activity — use viewModelScope or lifecycleScope
- Flow.collect in Activity: use repeatOnLifecycle to prevent leaks
- withContext(Dispatchers.Main) is redundant inside viewModelScope.launch

## Architecture
- Hilt @Inject constructor: don't forget @HiltViewModel on ViewModel classes
- Room @Entity: primary key auto-generate requires explicit @PrimaryKey(autoGenerate = true)
- Navigation: popBackStack() with inclusive=true removes the current destination too

## Build
- Gradle version catalog: use libs.versions.toml, not ext {} block
- R8 may strip classes used via reflection — add @Keep or proguard rules
- AGP 8.x: namespace must be in build.gradle, not AndroidManifest.xml
