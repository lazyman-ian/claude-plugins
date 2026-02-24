# Gradle KTS (Kotlin DSL) Migration Guide

## Why Migrate to KTS

| Benefit | Details |
|---------|---------|
| Type safety | Compile-time errors instead of runtime |
| IDE support | Full autocomplete, refactoring, navigation |
| Consistency | Same language as app code |
| Toolchain | Native Kotlin toolchain integration |

KTS is the default since Android Studio Giraffe (2023.1) and AGP 8.0+. All new projects use KTS.

## File Renaming

```
build.gradle             → build.gradle.kts
settings.gradle          → settings.gradle.kts
build.gradle (buildSrc)  → build.gradle.kts
```

## Syntax Differences

### Plugin Application

```kotlin
// Groovy
apply plugin: 'com.android.application'
apply plugin: 'kotlin-android'

// KTS — preferred block syntax
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    alias(libs.plugins.hilt)          // via version catalog
}
```

### String Quotes

```kotlin
// Groovy — single OR double quotes
implementation 'androidx.core:core-ktx:1.12.0'

// KTS — double quotes ONLY
implementation("androidx.core:core-ktx:1.12.0")
```

### String Interpolation

```kotlin
// Groovy
def appVersion = "1.0.0"
versionName "$appVersion-debug"

// KTS
val appVersion = "1.0.0"
versionName = "$appVersion-debug"
```

### Property Assignment

```kotlin
// Groovy — no equals sign needed
compileSdkVersion 35
minSdkVersion 26

// KTS — equals sign required
compileSdk = 35
minSdk = 26
```

### Method Calls

```kotlin
// Groovy
buildConfigField "String", "BASE_URL", '"https://api.example.com"'

// KTS
buildConfigField("String", "BASE_URL", "\"https://api.example.com\"")
```

### Collections

```kotlin
// Groovy
exclude group: 'org.junit', module: 'junit'

// KTS
exclude(group = "org.junit", module = "junit")
```

## settings.gradle.kts Configuration

```kotlin
pluginManagement {
    includeBuild("build-logic")           // convention plugins
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "MyApp"
include(":app")
include(":core:network")
include(":feature:home")
```

## Type-Safe Accessors

KTS generates type-safe accessors for extensions and configurations:

```kotlin
// Accessing android extension
android {                           // type: ApplicationExtension
    compileSdk = 35
    defaultConfig {                 // type: DefaultConfig
        applicationId = "com.example.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }
    buildTypes {
        release {                   // type: BuildType
            isMinifyEnabled = true
        }
        debug {
            applicationIdSuffix = ".debug"
        }
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
}
```

## buildSrc vs build-logic

| | buildSrc | build-logic (included build) |
|--|----------|------------------------------|
| Cache | Invalidates entire cache on change | Isolated cache, only changes rebuild |
| IDE support | Good | Better (full project) |
| Sharing | Cannot share outside project | Can be used by multiple projects |
| Recommended | Legacy | Preferred for new projects |

### build-logic setup

Root `settings.gradle.kts`:
```kotlin
pluginManagement {
    includeBuild("build-logic")
    // ...
}
```

`build-logic/settings.gradle.kts`:
```kotlin
dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
    }
    versionCatalogs {
        create("libs") {
            from(files("../gradle/libs.versions.toml"))
        }
    }
}
rootProject.name = "build-logic"
include(":convention")
```

## Plugin Management Block

```kotlin
// settings.gradle.kts
pluginManagement {
    resolutionStrategy {
        eachPlugin {
            when (requested.id.id) {
                "com.android.application" ->
                    useModule("com.android.tools.build:gradle:${requested.version}")
            }
        }
    }
    repositories {
        gradlePluginPortal()
        google()
        mavenCentral()
    }
}
```

## Common Migration Gotchas

| Groovy | KTS Fix |
|--------|---------|
| `ext.kotlin_version = "..."` | Use version catalog or `extra["kotlin_version"]` |
| `def` variable declaration | Use `val` or `var` |
| `project.ext` access | `extra` or version catalog |
| `configurations.all { resolutionStrategy {...} }` | Same, but with parentheses |
| Dynamic task creation `task foo {...}` | `tasks.register("foo") {...}` |
| `android.sourceSets.main.java.srcDirs` | `android.sourceSets["main"].java.srcDirs` |
| Groovy closures | Kotlin lambdas `{ }` — no `->` needed for last param |

## Performance Note

KTS files are cached after first compilation. IDE startup with large KTS scripts can be slower on first open, but subsequent builds are equivalent. Use `--configuration-cache` to minimize this overhead.

## Verification

After migration, verify:
```bash
./gradlew help --configuration-cache   # Check cache compatibility
./gradlew assembleDebug                # Full build
./gradlew :app:dependencies            # Dependency resolution
```
