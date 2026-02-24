# Convention Plugins

## Why Convention Plugins

| Problem | Solution |
|---------|---------|
| Duplicate build config across modules | Single plugin, apply everywhere |
| Groovy `apply from:` fragility | Type-safe Kotlin code |
| No IDE support in shared scripts | Full Kotlin IDE support |
| Cache invalidation | Isolated cache per included build |
| Config drift between modules | Enforced consistency |

Convention plugins replace copy-pasted build logic with composable, type-safe plugins. The [Now in Android](https://github.com/android/nowinandroid) reference app uses this pattern.

## build-logic Setup

### Directory Structure

```
build-logic/
├── settings.gradle.kts
├── convention/
│   ├── build.gradle.kts
│   └── src/main/kotlin/
│       ├── AndroidApplicationConventionPlugin.kt
│       ├── AndroidLibraryConventionPlugin.kt
│       ├── AndroidComposeConventionPlugin.kt
│       ├── AndroidHiltConventionPlugin.kt
│       ├── AndroidFeatureConventionPlugin.kt
│       ├── AndroidTestConventionPlugin.kt
│       └── KotlinAndroidConventionPlugin.kt
```

### Root settings.gradle.kts

```kotlin
pluginManagement {
    includeBuild("build-logic")    // Register as included build
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
```

### build-logic/settings.gradle.kts

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

### build-logic/convention/build.gradle.kts

```kotlin
plugins {
    `kotlin-dsl`
}

group = "com.example.buildlogic"

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

dependencies {
    compileOnly(libs.android.gradlePlugin)
    compileOnly(libs.kotlin.gradlePlugin)
    compileOnly(libs.ksp.gradlePlugin)
}

gradlePlugin {
    plugins {
        register("androidApplication") {
            id = "myapp.android.application"
            implementationClass = "AndroidApplicationConventionPlugin"
        }
        register("androidApplicationCompose") {
            id = "myapp.android.application.compose"
            implementationClass = "AndroidApplicationComposeConventionPlugin"
        }
        register("androidLibrary") {
            id = "myapp.android.library"
            implementationClass = "AndroidLibraryConventionPlugin"
        }
        register("androidLibraryCompose") {
            id = "myapp.android.library.compose"
            implementationClass = "AndroidLibraryComposeConventionPlugin"
        }
        register("androidFeature") {
            id = "myapp.android.feature"
            implementationClass = "AndroidFeatureConventionPlugin"
        }
        register("androidHilt") {
            id = "myapp.android.hilt"
            implementationClass = "AndroidHiltConventionPlugin"
        }
        register("androidTest") {
            id = "myapp.android.test"
            implementationClass = "AndroidTestConventionPlugin"
        }
    }
}
```

Add build-logic plugins to version catalog:

```toml
# libs.versions.toml [libraries] section
android-gradlePlugin = { group = "com.android.tools.build", name = "gradle", version.ref = "agp" }
kotlin-gradlePlugin = { group = "org.jetbrains.kotlin", name = "kotlin-gradle-plugin", version.ref = "kotlin" }
ksp-gradlePlugin = { group = "com.google.devtools.ksp", name = "com.google.devtools.ksp.gradle.plugin", version.ref = "ksp" }
```

## Plugin Implementations

### AndroidApplicationConventionPlugin.kt

```kotlin
import com.android.build.api.dsl.ApplicationExtension
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.kotlin.dsl.configure

class AndroidApplicationConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) = with(target) {
        with(pluginManager) {
            apply("com.android.application")
            apply("org.jetbrains.kotlin.android")
        }

        extensions.configure<ApplicationExtension> {
            compileSdk = 35
            defaultConfig {
                minSdk = 26
                targetSdk = 35
                testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
            }
            compileOptions {
                sourceCompatibility = JavaVersion.VERSION_17
                targetCompatibility = JavaVersion.VERSION_17
                isCoreLibraryDesugaringEnabled = true
            }
            buildTypes {
                release {
                    isMinifyEnabled = true
                    isShrinkResources = true
                    proguardFiles(
                        getDefaultProguardFile("proguard-android-optimize.txt"),
                        "proguard-rules.pro"
                    )
                }
                debug {
                    applicationIdSuffix = ".debug"
                    isDebuggable = true
                }
            }
            packaging {
                resources {
                    excludes += "/META-INF/{AL2.0,LGPL2.1}"
                }
            }
        }

        configureKotlinAndroid(this)
    }
}
```

### AndroidLibraryConventionPlugin.kt

```kotlin
import com.android.build.gradle.LibraryExtension
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.kotlin.dsl.configure

class AndroidLibraryConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) = with(target) {
        with(pluginManager) {
            apply("com.android.library")
            apply("org.jetbrains.kotlin.android")
        }

        extensions.configure<LibraryExtension> {
            compileSdk = 35
            defaultConfig {
                minSdk = 26
                testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
                consumerProguardFiles("consumer-rules.pro")
            }
            compileOptions {
                sourceCompatibility = JavaVersion.VERSION_17
                targetCompatibility = JavaVersion.VERSION_17
            }
            // Disable unused features for library modules
            buildTypes {
                release { isMinifyEnabled = false }
            }
        }

        configureKotlinAndroid(this)
    }
}
```

### AndroidComposeConventionPlugin.kt

```kotlin
import com.android.build.api.dsl.CommonExtension
import org.gradle.api.Project
import org.gradle.api.plugins.ExtensionAware
import org.gradle.kotlin.dsl.dependencies
import org.gradle.kotlin.dsl.getByType
import org.jetbrains.kotlin.gradle.dsl.KotlinAndroidProjectExtension

class AndroidComposeConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) = with(target) {
        pluginManager.apply("org.jetbrains.kotlin.plugin.compose")

        val extension = extensions.getByType<CommonExtension<*, *, *, *, *, *>>()
        extension.buildFeatures.compose = true

        dependencies {
            val bom = libs.findLibrary("compose-bom").get()
            add("implementation", platform(bom))
            add("androidTestImplementation", platform(bom))
            add("debugImplementation", libs.findLibrary("compose-ui-tooling").get())
            add("debugImplementation", libs.findLibrary("compose-ui-test-manifest").get())
        }
    }
}
```

### AndroidHiltConventionPlugin.kt

```kotlin
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.kotlin.dsl.dependencies

class AndroidHiltConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) = with(target) {
        with(pluginManager) {
            apply("com.google.dagger.hilt.android")
            apply("com.google.devtools.ksp")
        }

        dependencies {
            add("implementation", libs.findLibrary("hilt-android").get())
            add("ksp", libs.findLibrary("hilt-compiler").get())
        }
    }
}
```

### AndroidFeatureConventionPlugin.kt

```kotlin
// Combines: library + compose + hilt + navigation
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.kotlin.dsl.dependencies

class AndroidFeatureConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) = with(target) {
        with(pluginManager) {
            apply("myapp.android.library")
            apply("myapp.android.library.compose")
            apply("myapp.android.hilt")
        }

        dependencies {
            add("implementation", libs.findLibrary("hilt-navigation-compose").get())
            add("implementation", libs.findLibrary("lifecycle-viewmodel-compose").get())
            add("implementation", libs.findLibrary("lifecycle-runtime-ktx").get())
        }
    }
}
```

### AndroidTestConventionPlugin.kt

```kotlin
import com.android.build.gradle.TestExtension
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.kotlin.dsl.configure
import org.gradle.kotlin.dsl.dependencies

class AndroidTestConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) = with(target) {
        with(pluginManager) {
            apply("com.android.test")
            apply("org.jetbrains.kotlin.android")
        }

        extensions.configure<TestExtension> {
            compileSdk = 35
            defaultConfig {
                minSdk = 26
                testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
            }
        }

        dependencies {
            add("implementation", libs.findLibrary("junit").get())
            add("implementation", libs.findLibrary("mockk").get())
            add("implementation", libs.findLibrary("coroutines-test").get())
            add("implementation", libs.findLibrary("turbine").get())
        }
    }
}
```

### Shared Kotlin Configuration (KotlinAndroid.kt)

```kotlin
// Shared helper used by multiple plugins
import org.gradle.api.Project
import org.gradle.kotlin.dsl.configure
import org.gradle.kotlin.dsl.dependencies
import org.jetbrains.kotlin.gradle.dsl.KotlinAndroidProjectExtension

internal fun Project.configureKotlinAndroid(project: Project) {
    project.extensions.configure<KotlinAndroidProjectExtension> {
        jvmToolchain(17)
        compilerOptions {
            freeCompilerArgs.addAll(
                "-opt-in=kotlin.RequiresOptIn",
                "-opt-in=kotlinx.coroutines.ExperimentalCoroutinesApi",
            )
        }
    }
}
```

## Using Convention Plugins in Modules

```kotlin
// app/build.gradle.kts
plugins {
    id("myapp.android.application")
    id("myapp.android.application.compose")
    id("myapp.android.hilt")
}

android {
    namespace = "com.example.app"
    defaultConfig {
        applicationId = "com.example.app"
        versionCode = 1
        versionName = "1.0.0"
    }
}
```

```kotlin
// feature/home/build.gradle.kts
plugins {
    id("myapp.android.feature")    // library + compose + hilt in one line
}

android {
    namespace = "com.example.feature.home"
}

dependencies {
    implementation(project(":core:data"))
    implementation(project(":core:ui"))
}
```

## Testing Convention Plugins

```kotlin
// build-logic/convention/src/test/kotlin/AndroidLibraryConventionPluginTest.kt
class AndroidLibraryConventionPluginTest {
    @get:Rule
    val projectDir = TemporaryFolder()

    @Test
    fun `plugin applies android library configuration`() {
        projectDir.newFile("settings.gradle.kts").writeText("")
        projectDir.newFile("build.gradle.kts").writeText("""
            plugins { id("myapp.android.library") }
            android { namespace = "com.example.test" }
        """.trimIndent())

        val result = GradleRunner.create()
            .withProjectDir(projectDir.root)
            .withPluginClasspath()
            .withArguments("help")
            .build()

        assertTrue(result.output.contains("BUILD SUCCESSFUL"))
    }
}
```

## Common Pitfalls

| Pitfall | Fix |
|---------|-----|
| `ClassNotFoundException` for plugin | Verify `implementationClass` matches actual class name and package |
| `Extension not found` | Plugin that provides the extension must be applied first |
| Version catalog in build-logic | Use `versionCatalogs { create("libs") { from(...) } }` in build-logic settings |
| `compileOnly` vs `implementation` | Use `compileOnly` for AGP/Kotlin plugins in build-logic — they're provided at runtime |
| Circular includeBuild | build-logic cannot depend on the root project |
| IDE not resolving `libs.*` | Sync project; verify catalog path is `../gradle/libs.versions.toml` |
