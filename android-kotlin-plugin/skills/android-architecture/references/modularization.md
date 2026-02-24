# Modularization

## Why Modularize

| Benefit | Detail |
|---------|--------|
| Build speed | Gradle caches unchanged modules; only dirty modules recompile |
| Parallel compilation | Modules with no interdependency compile simultaneously |
| Ownership | Teams own specific modules; smaller review surface |
| Reusability | `core-ui` components shared across features |
| Testability | Each module tested in isolation with fake dependencies |
| Scalability | New features added as new modules without touching existing code |

## Module Types

### `app` Module
- Minimal: wiring, DI graph assembly, navigation host, `Application` class
- Depends on all feature modules and core modules
- No business logic

### `feature/*` Modules
- Contains one user-facing feature (screen, ViewModel, local navigation)
- Depends only on `core/*` modules
- Never imports another `feature/*` module

### `core/*` Modules
| Module | Contents | Key Dependencies |
|--------|---------|-----------------|
| `core-model` | Domain data classes, sealed errors | None |
| `core-data` | Repository interfaces + implementations | core-network, core-database, core-model |
| `core-domain` | Use cases, business logic | core-model |
| `core-network` | Retrofit/Ktor setup, API interfaces, DTOs | core-model |
| `core-database` | Room database, DAOs, entities | core-model |
| `core-ui` | Shared Compose components, themes, icons | core-model |
| `core-common` | Extensions, utils, constants | None |
| `core-testing` | Fakes, test rules, shared fixtures | core-model, core-data |

### `build-logic` Module
- Convention plugins (composable Gradle build scripts)
- Eliminates `buildSrc` limitations; each convention plugin is independently cacheable

## Convention Plugins

Replace per-module `build.gradle.kts` boilerplate with reusable plugins:

```kotlin
// build-logic/convention/src/main/kotlin/AndroidFeatureConventionPlugin.kt
class AndroidFeatureConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) {
        with(target) {
            pluginManager.apply {
                apply("com.android.library")
                apply("org.jetbrains.kotlin.android")
                apply("com.google.devtools.ksp")
                apply("dagger.hilt.android.plugin")
            }
            extensions.configure<LibraryExtension> {
                configureAndroidCompose(this)
                defaultConfig.targetSdk = 35
            }
            dependencies {
                add("implementation", project(":core:core-ui"))
                add("implementation", project(":core:core-model"))
                add("implementation", libs.findLibrary("hilt.android").get())
                add("ksp", libs.findLibrary("hilt.compiler").get())
            }
        }
    }
}
```

```kotlin
// feature module build.gradle.kts — minimal, all config from convention plugin
plugins {
    alias(libs.plugins.myapp.android.feature)
}

android {
    namespace = "com.example.feature.home"
}

dependencies {
    implementation(project(":core:core-data"))
    // feature-specific only; common deps come from convention plugin
}
```

## Build Speed Impact

| Change | Without Modules | With Modules |
|--------|----------------|--------------|
| Edit feature-home ViewModel | Recompile app module | Recompile feature-home only |
| Edit core-ui component | Recompile all | Recompile core-ui + dependents |
| Edit core-model | Recompile all | Recompile all (minimize this module) |
| No change in module | Compile | Skip (cache hit) |

**Minimize `core-model` surface** — every project module depends on it, so changes invalidate everything.

## Version Catalogs (libs.versions.toml)

```toml
[versions]
kotlin = "2.0.0"
hilt = "2.51.1"
room = "2.6.1"
retrofit = "2.11.0"

[libraries]
hilt-android = { group = "com.google.dagger", name = "hilt-android", version.ref = "hilt" }
hilt-compiler = { group = "com.google.dagger", name = "hilt-android-compiler", version.ref = "hilt" }
room-runtime = { group = "androidx.room", name = "room-runtime", version.ref = "room" }
room-ktx = { group = "androidx.room", name = "room-ktx", version.ref = "room" }
room-compiler = { group = "androidx.room", name = "room-compiler", version.ref = "room" }

[plugins]
android-application = { id = "com.android.application", version.ref = "agp" }
android-library = { id = "com.android.library", version.ref = "agp" }
kotlin-android = { id = "org.jetbrains.kotlin.android", version.ref = "kotlin" }
hilt = { id = "com.google.dagger.hilt.android", version.ref = "hilt" }
```

## Gradle: `api` vs `implementation`

```kotlin
// core-data/build.gradle.kts
dependencies {
    // implementation: not exposed to modules depending on core-data
    implementation(project(":core:core-network"))
    implementation(project(":core:core-database"))

    // api: exposed — callers of core-data can also use core-model types
    api(project(":core:core-model"))
}
```

Rule: use `api` only when the type appears in the module's public API (function parameters/return types). Prefer `implementation`.

## Module Creation Checklist

```
[ ] Create directory: feature/feature-<name>/ or core/core-<name>/
[ ] Add build.gradle.kts with correct namespace
[ ] Apply appropriate convention plugin
[ ] Add to settings.gradle.kts: include(":feature:feature-<name>")
[ ] Create AndroidManifest.xml (library modules need minimal manifest)
[ ] Add Hilt @Module if needed
[ ] Add to app module's dependencies if it's a feature module
[ ] Add navigation route to app's NavHost
```

## Common Pitfalls

| Pitfall | Problem | Fix |
|---------|---------|-----|
| Circular dependency | Module A depends on B, B depends on A | Extract shared type to `core-model` |
| Over-modularization | 50+ modules for small app | Start with 5-10 modules; split when teams grow |
| Fat `core-model` | All data classes in one module | Split by domain (core-user-model, core-feed-model) |
| Feature-to-feature import | feature-home imports feature-profile | Use shared navigation contract in core |
| `api` overuse | All dependencies leaked | Default to `implementation` |
| Missing test fixtures | Each module re-creates fakes | Put fakes in `core-testing`, apply test convention |

## Monolith to Modular Migration

Gradual extraction strategy:

```
Phase 1: Create core-model, move data classes (no logic changes)
Phase 2: Create core-network, move Retrofit/API (update imports only)
Phase 3: Create core-database, move Room (update imports only)
Phase 4: Create core-data, move repositories (now depends on core-network + core-database)
Phase 5: Create feature modules one-by-one, starting with least-coupled feature
Phase 6: Create core-domain, extract use cases from ViewModels
Phase 7: Slim down app module to wiring only
```

Key: each phase should be independently releasable with no behavior change.

## Inter-Feature Navigation Contract

```kotlin
// core-common or dedicated core-navigation module
object FeatureRoutes {
    const val PROFILE = "profile/{userId}"
    fun profileRoute(userId: String) = "profile/$userId"

    const val SETTINGS = "settings"
}

// feature-home: emit navigation event, don't import feature-profile
HomeEvent.ProfileClicked -> _events.send(HomeNavigationEvent.ToProfile(userId))

// app module: wire navigation
composable(FeatureRoutes.PROFILE) { backStack ->
    val userId = backStack.arguments?.getString("userId") ?: return@composable
    ProfileScreen(userId = userId)
}
```
