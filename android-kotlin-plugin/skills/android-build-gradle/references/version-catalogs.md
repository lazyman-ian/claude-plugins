# Version Catalogs (libs.versions.toml)

## Overview

Version catalogs centralize all dependency versions in `gradle/libs.versions.toml`. Available since Gradle 7.4, stable in 7.6+. All AGP 8.x projects should use this by default.

## File Structure

```
[versions]      # Version strings, referenced by other sections
[libraries]     # Library coordinates (group:name:version)
[bundles]       # Named groups of libraries
[plugins]       # Gradle plugin IDs with versions
```

## Complete Example

```toml
[versions]
agp = "8.7.0"
kotlin = "2.1.0"
ksp = "2.1.0-1.0.29"
compose-bom = "2025.01.00"
compose-compiler = "1.5.10"
hilt = "2.51.1"
room = "2.7.0"
retrofit = "2.11.0"
okhttp = "4.12.0"
coroutines = "1.8.1"
lifecycle = "2.8.7"
navigation = "2.8.5"
coil = "2.7.0"
timber = "5.0.1"
junit = "4.13.2"
junit5 = "5.10.2"
mockk = "1.13.12"

[libraries]
# Compose BOM — controls all compose versions
compose-bom = { group = "androidx.compose", name = "compose-bom", version.ref = "compose-bom" }
compose-ui = { group = "androidx.compose.ui", name = "ui" }
compose-ui-graphics = { group = "androidx.compose.ui", name = "ui-graphics" }
compose-ui-tooling = { group = "androidx.compose.ui", name = "ui-tooling" }
compose-ui-tooling-preview = { group = "androidx.compose.ui", name = "ui-tooling-preview" }
compose-ui-test-junit4 = { group = "androidx.compose.ui", name = "ui-test-junit4" }
compose-ui-test-manifest = { group = "androidx.compose.ui", name = "ui-test-manifest" }
compose-material3 = { group = "androidx.compose.material3", name = "material3" }
compose-material-icons-extended = { group = "androidx.compose.material", name = "material-icons-extended" }
compose-activity = { group = "androidx.activity", name = "activity-compose", version = "1.9.3" }

# Hilt
hilt-android = { group = "com.google.dagger", name = "hilt-android", version.ref = "hilt" }
hilt-compiler = { group = "com.google.dagger", name = "hilt-android-compiler", version.ref = "hilt" }
hilt-navigation-compose = { group = "androidx.hilt", name = "hilt-navigation-compose", version = "1.2.0" }

# Room
room-runtime = { group = "androidx.room", name = "room-runtime", version.ref = "room" }
room-ktx = { group = "androidx.room", name = "room-ktx", version.ref = "room" }
room-compiler = { group = "androidx.room", name = "room-compiler", version.ref = "room" }

# Retrofit + OkHttp
retrofit-core = { group = "com.squareup.retrofit2", name = "retrofit", version.ref = "retrofit" }
retrofit-kotlin-serialization = { group = "com.squareup.retrofit2", name = "converter-kotlinx-serialization", version.ref = "retrofit" }
okhttp-core = { group = "com.squareup.okhttp3", name = "okhttp", version.ref = "okhttp" }
okhttp-logging = { group = "com.squareup.okhttp3", name = "logging-interceptor", version.ref = "okhttp" }

# Coroutines
coroutines-core = { group = "org.jetbrains.kotlinx", name = "kotlinx-coroutines-core", version.ref = "coroutines" }
coroutines-android = { group = "org.jetbrains.kotlinx", name = "kotlinx-coroutines-android", version.ref = "coroutines" }
coroutines-test = { group = "org.jetbrains.kotlinx", name = "kotlinx-coroutines-test", version.ref = "coroutines" }

# Lifecycle
lifecycle-viewmodel-ktx = { group = "androidx.lifecycle", name = "lifecycle-viewmodel-ktx", version.ref = "lifecycle" }
lifecycle-viewmodel-compose = { group = "androidx.lifecycle", name = "lifecycle-viewmodel-compose", version.ref = "lifecycle" }
lifecycle-runtime-ktx = { group = "androidx.lifecycle", name = "lifecycle-runtime-ktx", version.ref = "lifecycle" }

# Testing
junit = { group = "junit", name = "junit", version.ref = "junit" }
mockk = { group = "io.mockk", name = "mockk", version.ref = "mockk" }
turbine = { group = "app.cash.turbine", name = "turbine", version = "1.2.0" }

[bundles]
compose = [
    "compose-ui",
    "compose-ui-graphics",
    "compose-ui-tooling-preview",
    "compose-material3",
    "compose-activity",
]
compose-debug = ["compose-ui-tooling", "compose-ui-test-manifest"]
retrofit = ["retrofit-core", "retrofit-kotlin-serialization", "okhttp-core", "okhttp-logging"]
room = ["room-runtime", "room-ktx"]
lifecycle = ["lifecycle-viewmodel-ktx", "lifecycle-viewmodel-compose", "lifecycle-runtime-ktx"]
coroutines = ["coroutines-core", "coroutines-android"]
testing = ["junit", "mockk", "coroutines-test", "turbine"]

[plugins]
android-application = { id = "com.android.application", version.ref = "agp" }
android-library = { id = "com.android.library", version.ref = "agp" }
kotlin-android = { id = "org.jetbrains.kotlin.android", version.ref = "kotlin" }
kotlin-compose = { id = "org.jetbrains.kotlin.plugin.compose", version.ref = "kotlin" }
kotlin-serialization = { id = "org.jetbrains.kotlin.plugin.serialization", version.ref = "kotlin" }
hilt = { id = "com.google.dagger.hilt.android", version.ref = "hilt" }
ksp = { id = "com.google.devtools.ksp", version.ref = "ksp" }
```

## Naming Conventions

Dots and dashes in TOML keys become camelCase accessors:

| TOML key | Kotlin accessor |
|----------|----------------|
| `compose-bom` | `libs.compose.bom` |
| `hilt-android` | `libs.hilt.android` |
| `retrofit-kotlin-serialization` | `libs.retrofit.kotlin.serialization` |
| `bundles.compose` | `libs.bundles.compose` |
| `plugins.kotlin-android` | `libs.plugins.kotlin.android` |

## Usage in build.gradle.kts

```kotlin
plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.hilt)
    alias(libs.plugins.ksp)
}

dependencies {
    // BOM — controls compose versions
    implementation(platform(libs.compose.bom))
    implementation(libs.bundles.compose)
    debugImplementation(libs.bundles.compose.debug)

    // Hilt
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)

    // Room
    implementation(libs.bundles.room)
    ksp(libs.room.compiler)

    // Testing
    testImplementation(libs.bundles.testing)
    androidTestImplementation(platform(libs.compose.bom))
    androidTestImplementation(libs.compose.ui.test.junit4)
}
```

## BOM Integration

BOMs control versions for a family of libraries. No version needed in `[libraries]` when using BOM:

```toml
# BOM entry — has version
compose-bom = { group = "androidx.compose", name = "compose-bom", version.ref = "compose-bom" }
# Members — no version (controlled by BOM)
compose-ui = { group = "androidx.compose.ui", name = "ui" }
compose-material3 = { group = "androidx.compose.material3", name = "material3" }
```

```kotlin
// In build.gradle.kts
implementation(platform(libs.compose.bom))
implementation(libs.compose.ui)          // version from BOM
implementation(libs.compose.material3)   // version from BOM
```

## Multiple Catalogs

For large monorepos or shared catalogs:

```kotlin
// settings.gradle.kts
dependencyResolutionManagement {
    versionCatalogs {
        create("libs") {
            from(files("gradle/libs.versions.toml"))
        }
        create("testLibs") {
            from(files("gradle/test-libs.versions.toml"))
        }
    }
}
```

Access: `libs.hilt.android` and `testLibs.mockk`

## IDE Support

Android Studio provides full autocomplete for catalog entries. If autocomplete is missing:
1. File > Sync Project with Gradle Files
2. Check `gradle/libs.versions.toml` is at the correct path
3. Verify Gradle 7.4+ is in use

## Migration from ext {}

```kotlin
// Before (buildSrc/src/main/kotlin/Versions.kt or ext in build.gradle)
ext {
    kotlin_version = "2.1.0"
    compose_version = "1.6.0"
}
dependencies {
    implementation("androidx.compose.ui:ui:${rootProject.ext.compose_version}")
}

// After (libs.versions.toml)
[versions]
kotlin = "2.1.0"
compose-bom = "2025.01.00"

// build.gradle.kts
implementation(platform(libs.compose.bom))
implementation(libs.compose.ui)
```

## Common Anti-patterns

| Anti-pattern | Fix |
|-------------|-----|
| Version strings in build.gradle.kts | Move to `[versions]` in TOML |
| Duplicate library entries | Use `[bundles]` or single entry |
| Using `version =` instead of `version.ref =` | Use `version.ref` to reference `[versions]` entries |
| Mixed BOM + explicit versions | Let BOM control — remove explicit versions |
| No `[bundles]` for related libs | Group compose, retrofit, etc. into bundles |
