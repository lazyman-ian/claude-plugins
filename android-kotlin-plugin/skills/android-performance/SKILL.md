---
name: android-performance
description: Provides comprehensive guidance on Android system-level performance optimization including app startup, memory management, binary size reduction, baseline profiles, battery efficiency, and production monitoring. This skill should be used when diagnosing slow startup, high memory usage, large APK size, battery drain, ANR issues, or setting up performance monitoring. Key capabilities include startup trace analysis, memory leak investigation, R8 optimization, baseline profile generation, and Firebase/Android Vitals integration. Triggers on "performance", "startup", "ANR", "memory leak", "APK size", "battery", "baseline profile", "LeakCanary", "R8", "Macrobenchmark", "Android Vitals", "性能优化", "启动速度", "内存泄漏", "包体积", "耗电", "卡顿分析", "电量优化", "性能分析". Do NOT use for Compose-specific rendering or recomposition issues — use compose-performance-audit instead. Do NOT use for general Compose code writing — use compose-expert instead.
memory: project
allowed-tools: [Read, Glob, Grep, Edit]
---

# Android Performance Guide

System-level Android performance optimization: startup, memory, binary size, battery, and monitoring.

## Workflow Decision Tree

- If user provides code/config → Code-First Review
- If user describes symptoms (slow, OOM, large APK) → ask for specific metrics, then review
- If code review is inconclusive → Guide to Profile with Android Studio Profiler / Macrobenchmark

## 1. Code-First Review

Focus areas:
- App startup: Application.onCreate() complexity, ContentProvider initialization, lazy init patterns
- Memory: Bitmap handling, leak patterns (static context, inner class, unregistered listeners)
- Binary size: R8 configuration, resource shrinking, unused dependencies
- Battery: Background work patterns, wake locks, location updates
- ANR: Main thread blocking, IPC calls, disk IO on main

## 2. Guide to Profile

### Startup Profiling
- Use Android Studio Profiler (CPU tab → System Trace)
- Or Macrobenchmark: `@Rule val benchmarkRule = MacrobenchmarkRule()`
- Capture TTID (Time To Initial Display) and TTFD (Time To Full Display)
- Target: Cold < 500ms TTID, Warm < 200ms

### Memory Profiling
- LeakCanary for debug builds (auto-detect leaks)
- Android Studio Memory Profiler for heap analysis
- `adb shell dumpsys meminfo <package>` for runtime stats

### Binary Size Analysis
- APK Analyzer in Android Studio
- `./gradlew app:dependencies` for dependency tree
- R8 mapping file analysis

## 3. Performance Targets

| Metric | Target | Tool |
|--------|--------|------|
| Cold startup TTID | < 500ms | Macrobenchmark |
| Warm startup | < 200ms | Macrobenchmark |
| Frame rendering | < 16ms (60fps) | System Trace |
| ANR rate | < 0.47% | Android Vitals |
| Crash rate | < 1.09% | Android Vitals |
| APK size | minimize | APK Analyzer |
| Memory (PSS) | < heap limit | Profiler |

## 4. Common Issues & Fixes

### Startup

| Issue | Fix |
|-------|-----|
| Heavy Application.onCreate() | Use App Startup library, lazy init |
| ContentProvider init | Remove unused, defer with App Startup |
| Dagger/Hilt graph build | Use @InstallIn carefully, avoid @Singleton overuse |
| Large splash resources | Compress, use vector drawables |
| Synchronous network/DB in init | Move to background, use placeholder UI |

### Memory

| Issue | Fix |
|-------|-----|
| Bitmap not recycled | Use Coil/Glide with lifecycle, HARDWARE config |
| Activity leak via inner class | Use WeakReference or static + weak ref |
| Fragment leak via view binding | Null out binding in onDestroyView |
| Large Bitmap in memory | Downsample with BitmapFactory.Options |
| Collection growth | Use LruCache, trim in onTrimMemory() |

### Binary Size

| Issue | Fix |
|-------|-----|
| No R8 optimization | Enable `minifyEnabled true`, `shrinkResources true` |
| Unused code/resources | R8 full mode (AGP 8.0+ default), resource shrinking |
| Large native libraries | Use App Bundle for ABI split |
| Duplicate dependencies | Check `./gradlew dependencies`, exclude transitives |
| Large images | WebP format, vector drawables for icons |

### Battery

| Issue | Fix |
|-------|-----|
| Background network polling | Use WorkManager with constraints |
| Wake locks held too long | Release in finally block, use timeout |
| GPS always-on | Use fused location, reduce update frequency |
| Excessive alarms | Batch with AlarmManager.setWindow() |

## 5. Baseline Profiles

```kotlin
// benchmark/src/main/java/com/example/BaselineProfileGenerator.kt
@OptIn(ExperimentalBaselineProfilesApi::class)
class BaselineProfileGenerator {
    @get:Rule
    val rule = BaselineProfileRule()

    @Test
    fun generateProfile() {
        rule.collect(packageName = "com.example.app") {
            startActivityAndWait()
            // Critical user journey
            device.findObject(By.text("Home")).click()
        }
    }
}
```

Benefits: 15-30% startup improvement, AOT compilation at install time.
ProfileInstaller provides API 24-27 compatibility.

## 6. Monitoring

| Tool | Use For |
|------|---------|
| Firebase Performance | Custom traces, network monitoring |
| Android Vitals | ANR, crash, startup metrics |
| ApplicationExitInfo | Detailed exit reasons (API 30+) |
| StrictMode | Debug-only disk/network violations |
| Macrobenchmark | CI-integrated benchmarks |

## Outputs

- Metrics table (before/after if available)
- Top issues ordered by impact
- Proposed fixes with estimated effort

## References

| Category | Reference |
|----------|-----------|
| Startup | `references/startup.md` |
| Memory | `references/memory.md` |
| Binary Size | `references/binary-size.md` |
| Baseline Profiles | `references/baseline-profiles.md` |
| Monitoring | `references/monitoring.md` |
