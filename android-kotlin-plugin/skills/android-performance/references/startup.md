# Android App Startup Optimization

## Startup Types

| Type | Trigger | Typical Duration |
|------|---------|-----------------|
| Cold | Process not in memory | Slowest (500ms–5s) |
| Warm | Process alive, Activity destroyed | Medium (200ms–1s) |
| Hot | Activity in back stack | Fastest (< 100ms) |

## Key Metrics

- **TTID** (Time To Initial Display): First frame rendered. Reported automatically by Android.
- **TTFD** (Time To Full Display): All content loaded. Requires `reportFullyDrawn()` call.

```kotlin
class MainActivity : AppCompatActivity() {
    override fun onResume() {
        super.onResume()
        // Call once content is ready (after data loads)
        reportFullyDrawn()
    }
}
```

## App Startup Library

Replaces content provider hacks and manual initialization ordering.

### Dependency

```kotlin
// build.gradle.kts
implementation("androidx.startup:startup-runtime:1.1.1")
```

### Initializer Pattern

```kotlin
// WorkManagerInitializer.kt
class WorkManagerInitializer : Initializer<WorkManager> {
    override fun create(context: Context): WorkManager {
        val config = Configuration.Builder().build()
        WorkManager.initialize(context, config)
        return WorkManager.getInstance(context)
    }

    override fun dependencies(): List<Class<out Initializer<*>>> = emptyList()
}

// AnalyticsInitializer.kt — depends on WorkManager
class AnalyticsInitializer : Initializer<AnalyticsClient> {
    override fun create(context: Context): AnalyticsClient {
        return AnalyticsClient.init(context)
    }

    override fun dependencies(): List<Class<out Initializer<*>>> =
        listOf(WorkManagerInitializer::class.java)
}
```

### Register in Manifest

```xml
<provider
    android:name="androidx.startup.InitializationProvider"
    android:authorities="${applicationId}.androidx-startup"
    android:exported="false"
    tools:node="merge">
    <meta-data
        android:name="com.example.WorkManagerInitializer"
        android:value="androidx.startup" />
</provider>
```

### Disable Automatic Init (for manual/lazy init)

```xml
<meta-data
    android:name="com.example.AnalyticsInitializer"
    android:value="androidx.startup"
    tools:node="remove" />
```

```kotlin
// Trigger lazily when first needed
AppInitializer.getInstance(context)
    .initializeComponent(AnalyticsInitializer::class.java)
```

## Lazy Initialization Patterns

### Kotlin `by lazy`

```kotlin
class MyApplication : Application() {
    // Initialized only on first access
    val database: AppDatabase by lazy {
        Room.databaseBuilder(this, AppDatabase::class.java, "app.db").build()
    }

    val retrofit: Retrofit by lazy {
        Retrofit.Builder()
            .baseUrl("https://api.example.com")
            .build()
    }

    override fun onCreate() {
        super.onCreate()
        // Minimal init here — don't touch database or retrofit
    }
}
```

### Dagger/Hilt Lazy Injection

```kotlin
// Inject Lazy<T> to defer construction
class MainActivity : AppCompatActivity() {
    @Inject
    lateinit var heavyService: Lazy<HeavyService>

    fun onUserAction() {
        // HeavyService constructed only when first accessed
        heavyService.get().doWork()
    }
}
```

## ContentProvider Optimization

ContentProviders run before `Application.onCreate()`. Audit them:

```bash
# Find all ContentProviders registered in your merged manifest
./gradlew app:mergeDebugManifests
grep -n "provider" app/build/intermediates/merged_manifest/debug/AndroidManifest.xml
```

Remove or lazy-initialize any ContentProvider not needed at startup. Firebase's old `FirebaseInitProvider` has been replaced by App Startup in recent SDKs.

## Splash Screen API (Android 12+)

```kotlin
// SplashActivity / themes — use SplashScreen compat
// build.gradle.kts
implementation("androidx.core:core-splashscreen:1.0.1")
```

```xml
<!-- themes.xml -->
<style name="Theme.App.Starting" parent="Theme.SplashScreen">
    <item name="windowSplashScreenBackground">@color/background</item>
    <item name="windowSplashScreenAnimatedIcon">@drawable/ic_splash</item>
    <item name="windowSplashScreenAnimationDuration">300</item>
    <item name="postSplashScreenTheme">@style/Theme.App</item>
</style>
```

```kotlin
class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        val splashScreen = installSplashScreen()
        super.onCreate(savedInstanceState)
        // Keep splash visible until data is ready
        splashScreen.setKeepOnScreenCondition { !viewModel.isReady }
        setContentView(R.layout.main)
    }
}
```

## Tracing for Profiling

Add custom trace sections visible in Android Studio System Trace:

```kotlin
import android.os.Trace

class MyApplication : Application() {
    override fun onCreate() {
        Trace.beginSection("App.onCreate")
        super.onCreate()
        Trace.beginSection("App.initDatabase")
        initDatabase()
        Trace.endSection()
        Trace.beginSection("App.initAnalytics")
        initAnalytics()
        Trace.endSection()
        Trace.endSection() // App.onCreate
    }
}
```

AndroidX tracing alternative (works on API 14+):

```kotlin
import androidx.tracing.trace

fun initDatabase() = trace("App.initDatabase") {
    // traced block
    Room.databaseBuilder(...).build()
}
```

## Macrobenchmark for Startup

```kotlin
// benchmark/build.gradle.kts
plugins {
    id("com.android.test")
}
android {
    targetProjectPath = ":app"
    defaultConfig {
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }
}
dependencies {
    implementation("androidx.benchmark:benchmark-macro-junit4:1.2.4")
    implementation("androidx.test.ext:junit:1.1.5")
    implementation("androidx.test:runner:1.5.2")
}
```

```kotlin
// StartupBenchmark.kt
@RunWith(AndroidJUnit4::class)
class StartupBenchmark {
    @get:Rule
    val benchmarkRule = MacrobenchmarkRule()

    @Test
    fun startup() = benchmarkRule.measureRepeated(
        packageName = "com.example.app",
        metrics = listOf(StartupTimingMetric()),
        iterations = 5,
        startupMode = StartupMode.COLD,
    ) {
        pressHome()
        startActivityAndWait()
    }
}
```

Run with: `./gradlew :benchmark:connectedBenchmarkAndroidTest`

## Checklist

- [ ] Application.onCreate() completes in < 50ms
- [ ] No synchronous network/disk calls in init
- [ ] ContentProviders audited and minimized
- [ ] App Startup library used for ordered initialization
- [ ] `reportFullyDrawn()` called after content loads
- [ ] SplashScreen API implemented for Android 12+
- [ ] Macrobenchmark added to CI for regression detection
