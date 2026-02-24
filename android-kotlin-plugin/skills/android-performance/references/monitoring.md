# Android Performance Monitoring

## Firebase Performance SDK

### Setup

```kotlin
// app/build.gradle.kts
plugins {
    id("com.google.firebase.firebase-perf")
}

dependencies {
    implementation(platform("com.google.firebase:firebase-bom:32.7.0"))
    implementation("com.google.firebase:firebase-perf-ktx")
}
```

### Custom Traces

```kotlin
// Manual trace for a critical code path
val trace = Firebase.performance.newTrace("checkout_flow")

suspend fun processCheckout(cart: Cart): Result<Order> {
    trace.start()
    trace.putAttribute("item_count", cart.items.size.toString())

    return try {
        val order = orderRepository.submit(cart)
        trace.putMetric("order_value_cents", order.totalCents)
        trace.putAttribute("payment_method", order.paymentMethod)
        Result.success(order)
    } catch (e: Exception) {
        trace.putAttribute("error_type", e::class.simpleName ?: "unknown")
        Result.failure(e)
    } finally {
        trace.stop()
    }
}
```

### Annotation-Based Traces (simpler)

```kotlin
// Automatically traces the annotated method
@AddTrace(name = "loadUserProfile", enabled = true)
suspend fun loadUserProfile(userId: String): UserProfile {
    return userRepository.getProfile(userId)
}
```

### Network Monitoring

Firebase Performance automatically monitors all HTTP/HTTPS calls. For custom HTTP clients:

```kotlin
// OkHttp integration
val client = OkHttpClient.Builder()
    .addInterceptor(FirebasePerformance.getInstance().newHttpMetric(
        "https://api.example.com",
        FirebasePerformance.HttpMethod.GET
    ).let { metric ->
        Interceptor { chain ->
            metric.requestPayloadSize = chain.request().body?.contentLength() ?: 0
            metric.start()
            val response = chain.proceed(chain.request())
            metric.httpResponseCode = response.code
            metric.responsePayloadSize = response.body?.contentLength() ?: 0
            metric.stop()
            response
        }
    })
    .build()
```

## Android Vitals

No SDK required — data collected automatically by Play Store from opted-in users.

### Key Metrics & Thresholds

| Metric | Bad Threshold | Why It Matters |
|--------|--------------|----------------|
| ANR rate | > 0.47% of sessions | App unresponsive, dialog shown |
| Crash rate | > 1.09% of sessions | Unexpected app exit |
| Cold startup | > 5 seconds P95 | Core user experience |
| Slow frames | > 50% slow frames | Janky UI |
| Frozen frames | > 0.1% frozen frames | Complete UI freeze |
| Excessive wakeups | > 10/hour | Battery drain |
| Excessive wake locks | > 1 hour held | Battery drain |

### Accessing Android Vitals

Play Console → Android Vitals → Overview

Enable alerts: Play Console → Setup → Manage alerts → Android Vitals alerts

### Interpreting ANR Data

```bash
# Pull ANR traces from device
adb pull /data/anr/

# Common ANR causes to look for in traces:
# "waiting to lock" — deadlock
# "DALVIK THREADS" section with "main" thread blocked
# "Binder" calls on main thread
```

## ApplicationExitInfo (API 30+)

Get detailed exit reasons for debugging crashes and ANRs without Firebase.

```kotlin
class ExitReasonAnalyzer {
    fun analyzeRecentExits(context: Context) {
        val activityManager = context.getSystemService(ActivityManager::class.java)
        val exitReasons = activityManager.getHistoricalProcessExitReasons(
            context.packageName,
            0,   // start from most recent
            10   // max count
        )

        exitReasons.forEach { info ->
            val reason = when (info.reason) {
                ApplicationExitInfo.REASON_ANR -> "ANR"
                ApplicationExitInfo.REASON_CRASH -> "Crash"
                ApplicationExitInfo.REASON_CRASH_NATIVE -> "Native crash"
                ApplicationExitInfo.REASON_LOW_MEMORY -> "Low memory (OOM)"
                ApplicationExitInfo.REASON_MEMORY_PRESSURE -> "Memory pressure"
                ApplicationExitInfo.REASON_USER_REQUESTED -> "User killed"
                else -> "Other (${info.reason})"
            }

            Log.d("ExitReason", "Exit: $reason | ${info.description} | " +
                  "Importance: ${info.importance} | Time: ${info.timestamp}")

            // For ANR, you can get the full trace
            if (info.reason == ApplicationExitInfo.REASON_ANR) {
                info.traceInputStream?.use { stream ->
                    val trace = stream.bufferedReader().readText()
                    Log.d("ANRTrace", trace.take(2000))  // first 2000 chars
                }
            }
        }
    }
}
```

## StrictMode (Debug Builds)

Detect violations at development time — never enable in production.

```kotlin
class MyApplication : Application() {
    override fun onCreate() {
        if (BuildConfig.DEBUG) {
            StrictMode.setThreadPolicy(
                StrictMode.ThreadPolicy.Builder()
                    .detectDiskReads()
                    .detectDiskWrites()
                    .detectNetwork()        // catches any network on main thread
                    .detectCustomSlowCalls()
                    .penaltyLog()           // log violations (use in CI)
                    .penaltyFlashScreen()   // visual indicator in dev builds
                    // .penaltyDeath()      // crash on violation (aggressive but effective)
                    .build()
            )

            StrictMode.setVmPolicy(
                StrictMode.VmPolicy.Builder()
                    .detectLeakedSqlLiteObjects()
                    .detectLeakedClosableObjects()
                    .detectActivityLeaks()
                    .detectFileUriExposure()
                    .penaltyLog()
                    .build()
            )
        }
        super.onCreate()
    }
}
```

## Macrobenchmark in CI

```kotlin
// benchmark/src/androidTest/java/CriticalFlowBenchmark.kt
@RunWith(AndroidJUnit4::class)
class CriticalFlowBenchmark {
    @get:Rule
    val benchmarkRule = MacrobenchmarkRule()

    @Test
    fun homeScreenScrolling() = benchmarkRule.measureRepeated(
        packageName = "com.example.app",
        metrics = listOf(
            FrameTimingMetric(),
            StartupTimingMetric()
        ),
        compilationMode = CompilationMode.Partial(),
        iterations = 5,
        startupMode = StartupMode.WARM,
    ) {
        startActivityAndWait()
        val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        device.findObject(By.scrollable(true)).scroll(Direction.DOWN, 5f)
    }
}
```

```yaml
# CI — fail if benchmark regresses > 10%
- name: Run Macrobenchmarks
  run: |
    ./gradlew :benchmark:connectedBenchmarkAndroidTest
    python3 scripts/check_benchmark_regression.py --threshold 10
```

## Custom Metrics Collection

```kotlin
// Performance event logger for custom dashboards
object PerfMetrics {
    private val traces = mutableMapOf<String, Long>()

    fun start(name: String) {
        traces[name] = SystemClock.elapsedRealtime()
    }

    fun end(name: String): Long {
        val start = traces.remove(name) ?: return -1
        val duration = SystemClock.elapsedRealtime() - start
        // Send to your analytics backend
        Analytics.logEvent("perf_$name", bundleOf("duration_ms" to duration))
        return duration
    }
}

// Usage in Activity
override fun onCreate(savedInstanceState: Bundle?) {
    PerfMetrics.start("activity_create_to_first_frame")
    super.onCreate(savedInstanceState)
    // ...
}

override fun onWindowFocusChanged(hasFocus: Boolean) {
    if (hasFocus) PerfMetrics.end("activity_create_to_first_frame")
}
```

## Alerting Thresholds

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Cold startup | > 2s | > 5s | Profile with Macrobenchmark |
| ANR rate | > 0.2% | > 0.47% | Check main thread work |
| Crash rate | > 0.5% | > 1.09% | Review Firebase Crashlytics |
| Slow frames | > 30% | > 50% | System Trace + fix jank |
| APK size | +5MB release | +10MB release | R8 audit, APK Analyzer |

## Production Debugging Workflow

1. **Android Vitals alert** → identify affected device/API level
2. **Firebase Performance** → narrow to specific trace/network call
3. **ApplicationExitInfo** → check for ANR trace or OOM
4. **Reproduce locally** with StrictMode enabled
5. **Profile** with Android Studio (CPU/Memory/Network tab)
6. **Fix** → verify with Macrobenchmark before/after
7. **Deploy** → monitor Android Vitals for improvement

## Checklist

- [ ] Firebase Performance SDK added and initialized
- [ ] Custom traces on all critical user flows (checkout, search, login)
- [ ] Android Vitals alerts configured in Play Console
- [ ] ApplicationExitInfo analyzed on app start (debug+staging)
- [ ] StrictMode enabled in debug builds
- [ ] Macrobenchmark suite running in CI
- [ ] Performance regression thresholds defined and enforced
