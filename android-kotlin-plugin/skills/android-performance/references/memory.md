# Android Memory Management

## Android Memory Model

| Term | Meaning |
|------|---------|
| **PSS** (Proportional Set Size) | Most accurate; shared memory divided proportionally between processes |
| **RSS** (Resident Set Size) | All physical pages, including shared; overcounts |
| **Private Dirty** | RAM unique to your process; most impactful for OOM |
| **Heap Size** | Dalvik/ART heap allocated; per-process limit (typically 192–512MB) |

```bash
# Runtime memory stats
adb shell dumpsys meminfo com.example.app

# Total device memory pressure
adb shell cat /proc/meminfo
```

## Bitmap Memory Management

Bitmaps are the most common memory issue. Default `ARGB_8888` = 4 bytes/pixel.

### Config Selection

```kotlin
// HARDWARE: GPU memory (fastest, read-only, no software access)
val options = BitmapFactory.Options().apply {
    inPreferredConfig = Bitmap.Config.HARDWARE
}

// RGB_565: 2 bytes/pixel — good for no-alpha images (half the memory)
val options = BitmapFactory.Options().apply {
    inPreferredConfig = Bitmap.Config.RGB_565
}
```

### Downsampling Large Images

```kotlin
fun decodeSampledBitmap(
    res: Resources,
    resId: Int,
    reqWidth: Int,
    reqHeight: Int
): Bitmap {
    return BitmapFactory.Options().run {
        inJustDecodeBounds = true
        BitmapFactory.decodeResource(res, resId, this)

        inSampleSize = calculateInSampleSize(this, reqWidth, reqHeight)
        inJustDecodeBounds = false
        BitmapFactory.decodeResource(res, resId, this)
    }
}

fun calculateInSampleSize(
    options: BitmapFactory.Options,
    reqWidth: Int,
    reqHeight: Int
): Int {
    val (height, width) = options.run { outHeight to outWidth }
    var inSampleSize = 1
    if (height > reqHeight || width > reqWidth) {
        val halfHeight = height / 2
        val halfWidth = width / 2
        while (halfHeight / inSampleSize >= reqHeight &&
               halfWidth / inSampleSize >= reqWidth) {
            inSampleSize *= 2
        }
    }
    return inSampleSize
}
```

### Use Coil/Glide for Lifecycle-Aware Loading

```kotlin
// Coil (recommended for Kotlin/Compose projects)
// build.gradle.kts
implementation("io.coil-kt:coil:2.6.0")

// Usage — automatically handles lifecycle, caching, downsampling
imageView.load("https://example.com/image.jpg") {
    crossfade(true)
    placeholder(R.drawable.placeholder)
    size(400, 300)  // explicit size avoids loading original resolution
}
```

## Common Leak Patterns

### 1. Static Activity/Context Reference

```kotlin
// BAD — Activity never garbage collected
object MySingleton {
    var context: Context? = null  // holds Activity
}

// GOOD — use Application context
object MySingleton {
    lateinit var appContext: Context

    fun init(context: Context) {
        appContext = context.applicationContext  // safe
    }
}
```

### 2. Non-Static Inner Class (Handler/AsyncTask)

```kotlin
// BAD — inner class holds implicit reference to outer Activity
class MyActivity : Activity() {
    private val handler = object : Handler(Looper.getMainLooper()) {
        override fun handleMessage(msg: Message) {
            // 'this@MyActivity' captured implicitly
            updateUI()
        }
    }
}

// GOOD — static class with WeakReference
class MyActivity : Activity() {
    private val handler = MyHandler(WeakReference(this))

    private class MyHandler(
        private val activityRef: WeakReference<MyActivity>
    ) : Handler(Looper.getMainLooper()) {
        override fun handleMessage(msg: Message) {
            activityRef.get()?.updateUI()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacksAndMessages(null)
    }
}
```

### 3. Fragment View Binding Leak

```kotlin
// BAD — binding holds view reference beyond fragment lifetime
class MyFragment : Fragment(R.layout.fragment_my) {
    private lateinit var binding: FragmentMyBinding  // leaks!
}

// GOOD — null out binding in onDestroyView
class MyFragment : Fragment(R.layout.fragment_my) {
    private var _binding: FragmentMyBinding? = null
    private val binding get() = _binding!!

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        _binding = FragmentMyBinding.bind(view)
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null  // prevents leak
    }
}
```

### 4. Unregistered Listeners/Observers

```kotlin
// BAD — BroadcastReceiver never unregistered
class MyActivity : Activity() {
    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) { }
    }

    override fun onStart() {
        super.onStart()
        registerReceiver(receiver, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
    }
    // Missing onStop unregister!
}

// GOOD — symmetric register/unregister
class MyActivity : Activity() {
    override fun onStart() {
        super.onStart()
        registerReceiver(receiver, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
    }

    override fun onStop() {
        super.onStop()
        unregisterReceiver(receiver)  // symmetric
    }
}

// BETTER — use lifecycle-aware LiveData/Flow instead of broadcast receivers
class MyViewModel : ViewModel() {
    val batteryState: StateFlow<BatteryState> = batteryRepository.state
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), BatteryState.Unknown)
}
```

### 5. Anonymous Class Holding Activity Reference

```kotlin
// BAD — lambda/anonymous class captures Activity
class MyActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        SomeLibrary.registerCallback(object : Callback {
            override fun onEvent() {
                // 'this@MyActivity' captured — if SomeLibrary holds callback, Activity leaks
                updateUI()
            }
        })
    }
}

// GOOD — unregister in onDestroy
override fun onDestroy() {
    super.onDestroy()
    SomeLibrary.unregisterCallback(callback)
}
```

## LeakCanary Setup

```kotlin
// build.gradle.kts — debug only, no prod overhead
debugImplementation("com.squareup.leakcanary:leakcanary-android:2.14")
```

No code changes needed — LeakCanary auto-hooks into `ActivityLifecycleCallbacks`.

### Custom Objects Watched

```kotlin
// Watch any object you expect to be GC'd
class MyPresenter(private val view: MyView) {
    fun detach() {
        // LeakCanary will check this object is GC'd after detach
        AppWatcher.objectWatcher.expectWeaklyReachable(this, "presenter detached")
    }
}
```

### Ignore Known Leaks

```kotlin
// leakcanary-leak-config.kt (debug sourceSet)
class MyLeakConfig : LeakCanary.Config by LeakCanary.config.copy(
    referenceMatchers = AndroidReferenceMatchers.appDefaults +
        listOf(
            IgnoredReferenceMatcher(
                pattern = InstanceFieldPattern("com.third.party.Sdk", "context")
            )
        )
)
```

## onTrimMemory() Responses

```kotlin
class MyApplication : Application() {
    override fun onTrimMemory(level: Int) {
        super.onTrimMemory(level)
        when (level) {
            TRIM_MEMORY_UI_HIDDEN -> {
                // App moved to background — release UI caches
                imageCache.trimToSize(imageCache.size() / 2)
            }
            TRIM_MEMORY_RUNNING_MODERATE,
            TRIM_MEMORY_RUNNING_LOW -> {
                // Still visible but memory pressure — release non-critical caches
                thumbnailCache.evictAll()
            }
            TRIM_MEMORY_RUNNING_CRITICAL,
            TRIM_MEMORY_COMPLETE -> {
                // Severe pressure — release everything possible
                imageCache.evictAll()
                thumbnailCache.evictAll()
                clearInMemoryData()
            }
        }
    }
}
```

## LruCache for Efficient Caching

```kotlin
class ImageCache {
    // Use 1/8 of available heap
    private val maxMemory = (Runtime.getRuntime().maxMemory() / 1024).toInt()
    private val cacheSize = maxMemory / 8

    private val cache = object : LruCache<String, Bitmap>(cacheSize) {
        override fun sizeOf(key: String, bitmap: Bitmap): Int {
            return bitmap.byteCount / 1024
        }
    }

    fun getBitmap(key: String): Bitmap? = cache.get(key)
    fun putBitmap(key: String, bitmap: Bitmap) = cache.put(key, bitmap)
}
```

## Large Heap Considerations

```xml
<!-- AndroidManifest.xml — avoid unless absolutely necessary -->
<application android:largeHeap="true">
```

Requesting large heap:
- Does NOT guarantee allocation
- Increases GC pressure and pause times
- Signals poor memory management to the OS
- Fix root cause instead

## Process Priority & Low-Memory Killer

Android kills processes in this order under memory pressure:

| Priority | Process State | Likelihood of Kill |
|----------|--------------|-------------------|
| 1 | Empty (cached) | First |
| 2 | Background | High |
| 3 | Service | Medium |
| 4 | Perceptible | Low |
| 5 | Foreground | Almost never |

Keep foreground services to essential work only to avoid unnecessary priority promotion.

## Checklist

- [ ] Bitmaps use `HARDWARE` config or loaded via Coil/Glide
- [ ] No static Activity/Context references
- [ ] Fragment view binding nulled in `onDestroyView()`
- [ ] All listeners/receivers unregistered symmetrically
- [ ] LeakCanary in debug builds
- [ ] `onTrimMemory()` implemented in Application class
- [ ] Image/data caches use LruCache with size limits
