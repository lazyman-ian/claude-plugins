# Baseline Profiles

## What Baseline Profiles Do

Android apps run interpreted on first launch (JIT compilation). Baseline Profiles pre-compile
critical code paths to native via AOT (Ahead-Of-Time) compilation at install time.

| Phase | Without Profiles | With Profiles |
|-------|-----------------|---------------|
| Install | Fast | +2–3 seconds for AOT compilation |
| First cold start | JIT (slow) | AOT (fast) |
| Subsequent starts | JIT-warmed | AOT (consistently fast) |
| Typical improvement | baseline | 15–30% startup improvement |

## ProfileInstaller (API 24–27 Compatibility)

Play Store delivers profile-guided compilation on API 28+. For older devices, use ProfileInstaller:

```kotlin
// app/build.gradle.kts
implementation("androidx.profileinstaller:profileinstaller:1.3.1")
```

No code changes needed — it installs the profile automatically on app start.

## Module Setup

### app/build.gradle.kts

```kotlin
plugins {
    id("com.android.application")
    id("androidx.baselineprofile")  // AGP 8.0+
}

dependencies {
    implementation("androidx.profileinstaller:profileinstaller:1.3.1")
    baselineProfile(project(":benchmark"))
}
```

### benchmark/build.gradle.kts

```kotlin
plugins {
    id("com.android.test")
    id("androidx.baselineprofile")
}

android {
    targetProjectPath = ":app"
    experimentalProperties["android.experimental.self-instrumenting"] = true

    defaultConfig {
        minSdk = 28  // BaselineProfileRule requires API 28+
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        create("benchmark") {
            isDebuggable = false
            signingConfig = signingConfigs.getByName("debug")
        }
    }
}

dependencies {
    implementation("androidx.benchmark:benchmark-macro-junit4:1.2.4")
    implementation("androidx.test.ext:junit:1.1.5")
    implementation("androidx.test:runner:1.5.2")
    implementation("androidx.test.uiautomator:uiautomator:2.3.0")
}
```

## Writing Profile Generator Tests

Focus on the most critical user journeys — these paths are AOT-compiled.

### Basic Startup Profile

```kotlin
// benchmark/src/main/java/com/example/BaselineProfileGenerator.kt
@RunWith(AndroidJUnit4::class)
class BaselineProfileGenerator {
    @get:Rule
    val rule = BaselineProfileRule()

    @Test
    fun generateStartupProfile() {
        rule.collect(packageName = "com.example.app") {
            pressHome()
            startActivityAndWait()
        }
    }
}
```

### Critical User Journey Profile

```kotlin
@RunWith(AndroidJUnit4::class)
class FullBaselineProfileGenerator {
    @get:Rule
    val rule = BaselineProfileRule()

    @Test
    fun generateFullProfile() {
        rule.collect(
            packageName = "com.example.app",
            includeInStartupProfile = true  // These paths also in startup profile
        ) {
            // Journey 1: Cold startup to home
            pressHome()
            startActivityAndWait()

            // Journey 2: Navigate to search
            val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
            device.findObject(By.res("com.example.app:id/search_fab")).click()
            device.waitForIdle()

            // Journey 3: Open detail screen
            device.findObject(By.res("com.example.app:id/first_result")).click()
            device.waitForIdle()

            // Journey 4: Navigate back
            device.pressBack()
            device.waitForIdle()
        }
    }
}
```

## Generating Profiles

```bash
# Run on a physical device (API 28+, NOT emulator for best results)
./gradlew :benchmark:connectedBenchmarkAndroidTest \
    -Pandroid.testInstrumentationRunnerArguments.androidx.benchmark.enabledRules=BaselineProfile

# AGP 8.0+ Gradle task
./gradlew generateBaselineProfile
```

Generated output: `app/src/main/baseline-prof.txt`

```
# baseline-prof.txt (example)
HSPLcom/example/app/MainActivity;->onCreate(Landroid/os/Bundle;)V
HSPLcom/example/app/viewmodel/HomeViewModel;->init()V
Lcom/example/app/data/UserRepository;
```

Prefix meanings:
- `H` — Hot (compiled to native code)
- `S` — Startup (included in startup profile)
- `P` — Post-startup (compiled after startup)
- `L` — Class (layout hint)

## Startup Profiles vs Baseline Profiles

| | Startup Profile | Baseline Profile |
|-|----------------|-----------------|
| Content | Critical startup paths only | All critical user journeys |
| File | `startup-prof.txt` (subset) | `baseline-prof.txt` |
| When compiled | At install, before first launch | At install |
| API minimum | 28 | 24 (with ProfileInstaller) |

## Measuring Improvement

```kotlin
@RunWith(AndroidJUnit4::class)
class StartupBenchmark {
    @get:Rule
    val benchmarkRule = MacrobenchmarkRule()

    // Run WITHOUT baseline profile
    @Test
    fun startupWithoutProfile() = benchmarkRule.measureRepeated(
        packageName = "com.example.app",
        metrics = listOf(StartupTimingMetric()),
        compilationMode = CompilationMode.None(),  // No AOT
        iterations = 5,
        startupMode = StartupMode.COLD
    ) {
        pressHome()
        startActivityAndWait()
    }

    // Run WITH baseline profile
    @Test
    fun startupWithProfile() = benchmarkRule.measureRepeated(
        packageName = "com.example.app",
        metrics = listOf(StartupTimingMetric()),
        compilationMode = CompilationMode.Partial(
            baselineProfileMode = BaselineProfileMode.Require
        ),
        iterations = 5,
        startupMode = StartupMode.COLD
    ) {
        pressHome()
        startActivityAndWait()
    }
}
```

## CI Integration

```yaml
# .github/workflows/generate-profiles.yml
name: Generate Baseline Profiles
on:
  push:
    branches: [main]

jobs:
  baseline-profiles:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up Android Emulator (API 33)
        uses: reactivecircus/android-emulator-runner@v2
        with:
          api-level: 33
          target: google_apis
          arch: x86_64
          script: ./gradlew generateBaselineProfile
      - name: Commit generated profiles
        run: |
          git add app/src/main/baseline-prof.txt
          git commit -m "chore: regenerate baseline profiles" || echo "No changes"
          git push
```

## Common Pitfalls

| Pitfall | Fix |
|---------|-----|
| Running on emulator | Emulators don't support AOT; use physical device |
| Missing ProfileInstaller dep | Add to `app/build.gradle.kts` for API < 28 |
| Profile not included in AAB | Verify `baseline-prof.txt` in `src/main/` |
| Journeys too short | Cover all critical flows — search, detail, checkout |
| Outdated profile | Regenerate after major code changes |
| Debug build testing | Test on release/benchmark build type only |

## Checklist

- [ ] `benchmark` module created with correct target
- [ ] `ProfileInstaller` dependency added to app module
- [ ] BaselineProfileGenerator covers cold startup journey
- [ ] Additional critical user journeys included
- [ ] Profile generated on physical device (not emulator)
- [ ] `baseline-prof.txt` committed to source control
- [ ] Macrobenchmark shows before/after improvement
- [ ] CI task regenerates profile on profile-code changes
