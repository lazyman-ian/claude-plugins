# Android Binary Size Reduction

## R8 Optimization

R8 is the mandatory shrinker/obfuscator/optimizer since AGP 3.4. Full mode is default in AGP 8.0+.

### Enable in Release Builds

```kotlin
// app/build.gradle.kts
android {
    buildTypes {
        release {
            isMinifyEnabled = true          // R8 code shrinking
            isShrinkResources = true        // Remove unused resources
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
}
```

### R8 Full Mode (AGP 8.0+ default)

Full mode enables more aggressive optimizations:
- Class merging and inlining
- Argument removal
- More dead code elimination

```kotlin
// gradle.properties — explicitly opt in for older AGP
android.enableR8.fullMode=true
```

### Common ProGuard Rules

```proguard
# Keep data classes used with Gson/Moshi (reflection-based)
-keepclassmembers class com.example.data.** {
    <fields>;
}

# Keep Retrofit interface methods
-keepattributes Signature
-keepattributes *Annotation*
-keep interface com.example.api.** { *; }

# Keep enum values (R8 can remove them)
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# Keep Parcelable implementations
-keep class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator *;
}

# Keep custom views (referenced from XML)
-keep public class * extends android.view.View {
    public <init>(android.content.Context);
    public <init>(android.content.Context, android.util.AttributeSet);
}
```

### @Keep Annotation (preferred over ProGuard rules)

```kotlin
// Keep specific class/method from R8 shrinking
@Keep
data class ApiResponse(
    val id: String,
    val name: String
)

@Keep
fun criticalMethod() { ... }
```

## Resource Shrinking

```kotlin
// Runs after R8 — removes unreferenced resources
isShrinkResources = true  // requires isMinifyEnabled = true
```

### Keep Specific Resources

```xml
<!-- res/raw/keep.xml — explicitly keep dynamically loaded resources -->
<resources xmlns:tools="http://schemas.android.com/tools"
    tools:keep="@layout/dynamic_*, @drawable/runtime_icon"
    tools:discard="@layout/unused_layout" />
```

### Strict Resource Shrinking

```kotlin
// build.gradle.kts
android {
    androidResources {
        // Remove ALL resources not referenced in code (including via reflection)
        // Test thoroughly before enabling
        noCompress += "fonts"
    }
}
```

## App Bundle

Android App Bundle (`.aab`) lets Play Store deliver device-optimized APKs.

```kotlin
// build.gradle.kts — enable splits via bundleConfig
android {
    bundle {
        language { enableSplit = true }  // Download only device language
        density { enableSplit = true }   // Download only matching DPI resources
        abi { enableSplit = true }       // Download only matching ABI (arm64-v8a, etc.)
    }
}
```

Build with: `./gradlew bundleRelease`

Size impact: Typically 15–50% smaller download size vs universal APK.

## APK Analyzer

Use Android Studio → Build → Analyze APK, or command line:

```bash
# Analyze APK from command line
$ANDROID_HOME/tools/bin/apkanalyzer apk summary app-release.apk
$ANDROID_HOME/tools/bin/apkanalyzer dex packages --defined-only app-release.apk | head -50
$ANDROID_HOME/tools/bin/apkanalyzer files list app-release.apk | grep "\.png\|\.jpg\|\.webp" | sort -k2 -rn | head -20
```

Largest contributors to look for:
- `classes.dex` — code (R8 should shrink this)
- `res/drawable*/` — images
- `lib/` — native `.so` files
- `assets/` — bundled assets

## Dependency Audit

```bash
# Full dependency tree
./gradlew app:dependencies --configuration releaseRuntimeClasspath > deps.txt

# Find duplicate transitive dependencies
./gradlew app:dependencies --configuration releaseRuntimeClasspath | grep "(*)" | sort | uniq

# Check total count of dependencies
./gradlew app:dependencies --configuration releaseRuntimeClasspath | grep "+---" | wc -l
```

### Exclude Duplicate/Unused Transitives

```kotlin
// build.gradle.kts
dependencies {
    implementation("com.example:library:1.0") {
        exclude(group = "org.jetbrains.kotlin", module = "kotlin-stdlib-jdk7")
        exclude(group = "androidx.lifecycle", module = "lifecycle-livedata")
    }
}

// Force specific version to resolve conflicts
configurations.all {
    resolutionStrategy {
        force("org.jetbrains.kotlin:kotlin-stdlib:1.9.22")
    }
}
```

## Image Optimization

### WebP Conversion

WebP provides ~30% smaller files vs PNG/JPEG with equal quality.

```bash
# Convert in Android Studio: right-click drawable → Convert to WebP
# Or command line with cwebp
cwebp -q 80 input.png -o output.webp
```

Use `webp` for photos and complex images, `VectorDrawable` for icons/illustrations.

### Vector Drawables

```xml
<!-- res/drawable/ic_arrow.xml — scales to any density, tiny file size -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
    <path
        android:fillColor="#FF000000"
        android:pathData="M8,5v14l11,-7z" />
</vector>
```

Replace PNG launcher icons with Adaptive Icons (API 26+) using vectors.

## Code Removal Strategies

```kotlin
// Feature flags for dead code elimination
// R8 can inline constants and remove dead branches
object FeatureFlags {
    const val ENABLE_LEGACY_FLOW = false  // R8 removes branches where this is false
}

fun doWork() {
    if (FeatureFlags.ENABLE_LEGACY_FLOW) {
        legacyWork()  // R8 eliminates this entire block
    } else {
        newWork()
    }
}
```

### Remove Debug-Only Code from Release

```kotlin
// build.gradle.kts
android {
    buildTypes {
        release {
            buildConfigField("Boolean", "DEBUG_LOGGING", "false")
        }
        debug {
            buildConfigField("Boolean", "DEBUG_LOGGING", "true")
        }
    }
}

// Usage — R8 removes false branches
if (BuildConfig.DEBUG_LOGGING) {
    Log.d(TAG, "expensive debug log: ${computeExpensiveData()}")
}
```

## Size Monitoring in CI

```bash
# Track APK size regression in CI
MAX_SIZE_MB=20
ACTUAL_SIZE=$(du -m app/build/outputs/apk/release/app-release.apk | cut -f1)
if [ "$ACTUAL_SIZE" -gt "$MAX_SIZE_MB" ]; then
    echo "APK size ${ACTUAL_SIZE}MB exceeds limit ${MAX_SIZE_MB}MB"
    exit 1
fi
```

## Checklist

- [ ] `isMinifyEnabled = true` and `isShrinkResources = true` in release
- [ ] ProGuard/Keep rules audited for over-keeping
- [ ] App Bundle (`.aab`) used for Play Store distribution
- [ ] APK Analyzer run to identify largest contributors
- [ ] No unused large dependencies
- [ ] PNG images converted to WebP or VectorDrawable
- [ ] APK size budget enforced in CI
