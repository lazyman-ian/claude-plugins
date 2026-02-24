---
name: android-build-gradle
description: Provides expert guidance on Android build system including Gradle KTS, version catalogs, convention plugins, AGP configuration, R8 optimization, KSP setup, and CI/CD pipelines. This skill should be used when configuring Gradle build files, optimizing build speed, setting up version catalogs, creating convention plugins, configuring R8/ProGuard, migrating kapt to KSP, or setting up CI/CD for Android. Key capabilities include build performance optimization, dependency management, multi-module build configuration, and release pipeline setup. Triggers on "Gradle", "build.gradle", "build.gradle.kts", "version catalog", "libs.versions.toml", "convention plugin", "AGP", "R8", "ProGuard", "KSP", "kapt", "CI/CD", "build speed", "构建", "Gradle配置", "版本目录", "构建优化". Do NOT use for app architecture or modularization strategy — use android-architecture instead. Do NOT use for APK size optimization — use android-performance instead.
memory: project
allowed-tools: [Read, Glob, Grep, Edit, Write]
---

# Android Build & Gradle

Expert guidance on Android build system: Gradle KTS, version catalogs, convention plugins, and build optimization.

## Quick Reference

| Task | Reference |
|------|-----------|
| Migrate to Gradle KTS | `references/gradle-kts.md` |
| Set up version catalog | `references/version-catalogs.md` |
| Create convention plugins | `references/convention-plugins.md` |

## Gradle KTS (Kotlin DSL)

Default since Android Studio Giraffe (2023.1). Key differences from Groovy:

| Groovy | Kotlin DSL |
|--------|-----------|
| `apply plugin: 'com.android.application'` | `plugins { id("com.android.application") }` |
| `implementation 'lib:1.0'` | `implementation("lib:1.0")` |
| `buildConfigField "String", "KEY", '"val"'` | `buildConfigField("String", "KEY", "\"val\"")` |
| Single quotes | Double quotes only |
| Dynamic typing | Type-safe accessors |

## Version Catalogs (libs.versions.toml)

```toml
[versions]
kotlin = "2.1.0"
compose-bom = "2025.01.00"
hilt = "2.51.1"
room = "2.7.0"

[libraries]
compose-bom = { group = "androidx.compose", name = "compose-bom", version.ref = "compose-bom" }
compose-ui = { group = "androidx.compose.ui", name = "ui" }
compose-material3 = { group = "androidx.compose.material3", name = "material3" }
hilt-android = { group = "com.google.dagger", name = "hilt-android", version.ref = "hilt" }
hilt-compiler = { group = "com.google.dagger", name = "hilt-android-compiler", version.ref = "hilt" }
room-runtime = { group = "androidx.room", name = "room-runtime", version.ref = "room" }
room-compiler = { group = "androidx.room", name = "room-compiler", version.ref = "room" }

[bundles]
compose = ["compose-ui", "compose-material3", "compose-ui-tooling-preview"]

[plugins]
android-application = { id = "com.android.application", version.ref = "agp" }
kotlin-android = { id = "org.jetbrains.kotlin.android", version.ref = "kotlin" }
kotlin-compose = { id = "org.jetbrains.kotlin.plugin.compose", version.ref = "kotlin" }
hilt = { id = "com.google.dagger.hilt.android", version.ref = "hilt" }
ksp = { id = "com.google.devtools.ksp", version.ref = "ksp" }
```

Usage in build.gradle.kts:
```kotlin
dependencies {
    implementation(platform(libs.compose.bom))
    implementation(libs.bundles.compose)
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
}
```

## Convention Plugins

### Structure
```
build-logic/
├── convention/
│   ├── build.gradle.kts
│   └── src/main/kotlin/
│       ├── AndroidApplicationConventionPlugin.kt
│       ├── AndroidLibraryConventionPlugin.kt
│       ├── AndroidComposeConventionPlugin.kt
│       ├── AndroidHiltConventionPlugin.kt
│       └── AndroidFeatureConventionPlugin.kt
├── settings.gradle.kts
└── gradle.properties
```

### Example Convention Plugin
```kotlin
class AndroidLibraryConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) = with(target) {
        pluginManager.apply("com.android.library")
        pluginManager.apply("org.jetbrains.kotlin.android")

        extensions.configure<LibraryExtension> {
            compileSdk = 35
            defaultConfig { minSdk = 26 }
            compileOptions {
                sourceCompatibility = JavaVersion.VERSION_17
                targetCompatibility = JavaVersion.VERSION_17
            }
        }

        extensions.configure<KotlinAndroidProjectExtension> {
            jvmToolchain(17)
        }
    }
}
```

Register in `build-logic/convention/build.gradle.kts`:
```kotlin
gradlePlugin {
    plugins {
        register("androidLibrary") {
            id = "myapp.android.library"
            implementationClass = "AndroidLibraryConventionPlugin"
        }
    }
}
```

## AGP 8.x Key Changes

| Feature | Default | Impact |
|---------|---------|--------|
| R8 full mode | Default (AGP 8.0+) | Better optimization, stricter rules |
| Namespace in build.gradle | Required | No more `package` in manifest |
| Non-transitive R classes | Default | Faster builds, explicit imports |
| BuildConfig generation | Disabled by default | Enable if needed |
| Configuration cache | Compatible | 30-85% config time reduction |

## Build Performance

### Quick Wins
| Action | Impact |
|--------|--------|
| Enable configuration cache | 30-85% config phase |
| Use `--parallel` | Parallel module compilation |
| `org.gradle.caching=true` | Task output caching |
| Increase `org.gradle.jvmargs=-Xmx4g` | Avoid GC thrashing |
| kapt → KSP migration | 2x annotation processing |
| File system watching | `org.gradle.vfs.watch=true` |
| Non-transitive R classes | Faster resource compilation |

### gradle.properties
```properties
org.gradle.jvmargs=-Xmx4g -XX:+UseParallelGC
org.gradle.parallel=true
org.gradle.caching=true
org.gradle.configuration-cache=true
org.gradle.vfs.watch=true
kotlin.incremental=true
```

## kapt → KSP Migration

| Library | KSP Support |
|---------|-------------|
| Room | ✅ (since 2.6.0) |
| Hilt | ✅ (since 2.48+) |
| Moshi | ✅ (moshi-kotlin-codegen) |
| Glide | ✅ (ksp) |
| Kotlin Serialization | ✅ (compiler plugin, no kapt needed) |

```kotlin
// Before (kapt)
plugins { id("kotlin-kapt") }
dependencies { kapt(libs.hilt.compiler) }

// After (KSP)
plugins { id("com.google.devtools.ksp") }
dependencies { ksp(libs.hilt.compiler) }
```

## R8 Configuration

```kotlin
android {
    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
}
```

### Common R8 Rules
```proguard
# Keep data classes for serialization
-keepclassmembers class * implements java.io.Serializable { *; }

# Retrofit
-keepattributes Signature
-keepattributes *Annotation*

# kotlinx.serialization
-keepattributes *Annotation*, InnerClasses
-keep,includedescriptorclasses class com.example.**$$serializer { *; }
```

## CI/CD

### GitHub Actions Example
```yaml
name: Android CI
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: { distribution: temurin, java-version: 17 }
      - uses: gradle/actions/setup-gradle@v4
      - run: ./gradlew check
      - run: ./gradlew assembleRelease
```

## Review Checklist
- [ ] Using Gradle KTS (not Groovy)
- [ ] Version catalog (libs.versions.toml) for all dependencies
- [ ] Convention plugins for shared build logic
- [ ] KSP instead of kapt where supported
- [ ] R8 enabled for release builds
- [ ] Configuration cache compatible
- [ ] gradle.properties optimized
- [ ] No hardcoded versions in build files

## References
| Category | Reference |
|----------|-----------|
| **KTS** | `references/gradle-kts.md` |
| **Catalogs** | `references/version-catalogs.md` |
| **Convention** | `references/convention-plugins.md` |
