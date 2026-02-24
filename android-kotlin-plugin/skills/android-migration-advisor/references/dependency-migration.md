# Dependency Migration Reference

Step-by-step guides for modernizing Android dependencies.

## Dagger → Hilt

Hilt is built on Dagger and reduces boilerplate by standardizing component hierarchy.

### Step 1: Add Hilt Dependencies

```kotlin
// build.gradle.kts (project)
plugins {
    id("com.google.dagger.hilt.android") version "2.51" apply false
}

// build.gradle.kts (app module)
plugins {
    id("com.google.dagger.hilt.android")
    id("com.google.devtools.ksp")
}

dependencies {
    implementation("com.google.dagger:hilt-android:2.51")
    ksp("com.google.dagger:hilt-android-compiler:2.51")
    // For ViewModel injection:
    implementation("androidx.hilt:hilt-navigation-compose:1.2.0")
}
```

### Step 2: Annotate Application

```kotlin
// Before (Dagger):
class MyApp : Application() {
    val appComponent: AppComponent = DaggerAppComponent.create()
}

// After (Hilt):
@HiltAndroidApp
class MyApp : Application()
// Hilt generates the component automatically
```

### Step 3: Annotate Entry Points

```kotlin
// Activities and Fragments:
@AndroidEntryPoint
class MainActivity : AppCompatActivity() { ... }

@AndroidEntryPoint
class HomeFragment : Fragment() {
    @Inject lateinit var analytics: AnalyticsService  // field injection still works
}
```

### Step 4: Migrate Modules

```kotlin
// Before (Dagger):
@Module
class NetworkModule {
    @Provides
    @Singleton
    fun provideOkHttpClient(): OkHttpClient = OkHttpClient.Builder().build()
}
@Component(modules = [NetworkModule::class])
interface AppComponent { ... }

// After (Hilt):
@Module
@InstallIn(SingletonComponent::class)  // replaces @Component declaration
object NetworkModule {
    @Provides
    @Singleton
    fun provideOkHttpClient(): OkHttpClient = OkHttpClient.Builder().build()
}
// No AppComponent needed — Hilt generates it
```

### Component Hierarchy Mapping

| Dagger Component | Hilt Component | Scope |
|-----------------|----------------|-------|
| AppComponent | `SingletonComponent` | App lifetime |
| ActivityComponent | `ActivityComponent` | Activity lifetime |
| FragmentComponent | `FragmentComponent` | Fragment lifetime |
| ViewModelComponent | `ViewModelComponent` | ViewModel lifetime |

### Step 5: Migrate ViewModels

```kotlin
// Before (Dagger):
class HomeViewModel @Inject constructor(
    private val repo: UserRepository
) : ViewModel()

// In Fragment:
class HomeFragment : Fragment() {
    @Inject lateinit var factory: ViewModelFactory
    private val viewModel by viewModels { factory }
}

// After (Hilt):
@HiltViewModel
class HomeViewModel @Inject constructor(
    private val repo: UserRepository
) : ViewModel()

// In Fragment — no factory needed:
@AndroidEntryPoint
class HomeFragment : Fragment() {
    private val viewModel: HomeViewModel by viewModels()
}
```

### Testing With HiltTestApplication

```kotlin
// Replace custom test app:
@HiltAndroidTest
class HomeFragmentTest {
    @get:Rule(order = 0) val hiltRule = HiltAndroidRule(this)
    @get:Rule(order = 1) val composeRule = createAndroidComposeRule<HiltTestActivity>()

    @BindValue
    val fakeRepo: UserRepository = FakeUserRepository()

    @Test
    fun showsUserName() { ... }
}
```

---

## SharedPreferences → DataStore

DataStore is async, type-safe, and crash-safe (no `apply()`/`commit()` ambiguity).

### Preferences DataStore (drop-in replacement)

```kotlin
// build.gradle.kts
implementation("androidx.datastore:datastore-preferences:1.1.1")

// Create singleton (once per process):
val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "settings")

// Keys replace string keys:
object PrefsKeys {
    val USERNAME = stringPreferencesKey("username")
    val DARK_MODE = booleanPreferencesKey("dark_mode")
    val LAUNCH_COUNT = intPreferencesKey("launch_count")
}

// Read (async, Flow-based):
val usernameFlow: Flow<String> = context.dataStore.data
    .map { prefs -> prefs[PrefsKeys.USERNAME] ?: "" }

// Write:
suspend fun setUsername(name: String) {
    context.dataStore.edit { prefs ->
        prefs[PrefsKeys.USERNAME] = name
    }
}
```

### SharedPreferencesMigration (preserve existing data)

```kotlin
val Context.dataStore: DataStore<Preferences> by preferencesDataStore(
    name = "settings",
    produceMigrations = { context ->
        listOf(SharedPreferencesMigration(context, "legacy_prefs"))
    }
)
// On first access, migrates all keys from "legacy_prefs" SharedPreferences automatically
```

### Proto DataStore (type-safe, schema-enforced)

```kotlin
// Define .proto file: src/main/proto/user_settings.proto
// message UserSettings { bool dark_mode = 1; string language = 2; }

// Serializer:
object UserSettingsSerializer : Serializer<UserSettings> {
    override val defaultValue: UserSettings = UserSettings.getDefaultInstance()
    override suspend fun readFrom(input: InputStream) = UserSettings.parseFrom(input)
    override suspend fun writeTo(t: UserSettings, output: OutputStream) = t.writeTo(output)
}

// Usage:
val Context.userSettingsStore by dataStore("user_settings.pb", UserSettingsSerializer)

context.userSettingsStore.updateData { current ->
    current.toBuilder().setDarkMode(true).build()
}
```

---

## kapt → KSP

KSP (Kotlin Symbol Processing) is 2x+ faster than kapt for supported libraries.

### Which Libraries Support KSP (2024)

| Library | kapt | KSP | Notes |
|---------|------|-----|-------|
| Room | Yes | Yes (preferred) | Full support |
| Hilt | Yes | Yes (preferred) | Full support |
| Moshi codegen | Yes | Yes | Full support |
| Glide | Yes | Yes | Full support |
| Koin | — | Yes | KSP-first |
| Dagger (no Hilt) | Yes | Partial | Hilt preferred |
| Retrofit (no codegen) | n/a | n/a | No annotation processing |

### Migration Steps

```kotlin
// build.gradle.kts (project)
plugins {
    id("com.google.devtools.ksp") version "2.0.0-1.0.21" apply false
}

// build.gradle.kts (module) — replace kapt with ksp:
plugins {
    // Remove: id("kotlin-kapt")
    id("com.google.devtools.ksp")  // Add
}

dependencies {
    // Room:
    // Remove: kapt("androidx.room:room-compiler:2.6.1")
    ksp("androidx.room:room-compiler:2.6.1")              // Add

    // Hilt:
    // Remove: kapt("com.google.dagger:hilt-android-compiler:2.51")
    ksp("com.google.dagger:hilt-android-compiler:2.51")   // Add
}
```

Build speed improvement: typically 40-60% faster incremental builds.

---

## LiveData → StateFlow

```kotlin
// Before — LiveData in ViewModel:
class SearchViewModel : ViewModel() {
    private val _results = MutableLiveData<List<Result>>()
    val results: LiveData<List<Result>> = _results

    fun search(query: String) {
        viewModelScope.launch {
            _results.value = repository.search(query)
        }
    }
}

// After — StateFlow:
class SearchViewModel : ViewModel() {
    private val _results = MutableStateFlow<List<Result>>(emptyList())
    val results: StateFlow<List<Result>> = _results.asStateFlow()

    fun search(query: String) {
        viewModelScope.launch {
            _results.value = repository.search(query)
        }
    }
}

// Collecting in Fragment (lifecycle-aware):
viewLifecycleOwner.lifecycleScope.launch {
    viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
        viewModel.results.collect { results -> adapter.submitList(results) }
    }
}

// asFlow() bridge for gradual migration (LiveData → Flow):
val flow: Flow<List<Result>> = viewModel.results.asFlow()
```

**When LiveData is still appropriate**: Only if consuming in Java code with no plans to migrate.

---

## Gson → kotlinx.serialization

```kotlin
// build.gradle.kts
plugins { kotlin("plugin.serialization") version "2.0.0" }
implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.1")

// Data class — annotate once:
@Serializable
data class User(
    val id: String,
    @SerialName("full_name") val name: String,  // JSON key rename
    val age: Int? = null                         // optional field
)

// Encode/Decode:
val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
val userJson = json.encodeToString(user)
val user = json.decodeFromString<User>(jsonString)

// Retrofit integration:
implementation("com.jakewharton.retrofit:retrofit2-kotlinx-serialization-converter:1.0.0")

val retrofit = Retrofit.Builder()
    .addConverterFactory(Json.asConverterFactory("application/json".toMediaType()))
    .build()
```

Custom serializer for sealed classes:

```kotlin
@Serializable
sealed class ApiResponse {
    @Serializable data class Success(val data: User) : ApiResponse()
    @Serializable data class Error(val message: String) : ApiResponse()
}
```

---

## Accompanist → Built-in Compose APIs

Accompanist is officially deprecated. Migrate to built-in alternatives:

### SystemUI → enableEdgeToEdge()

```kotlin
// Remove: accompanist-systemuicontroller
// Before:
val systemUiController = rememberSystemUiController()
systemUiController.setStatusBarColor(Color.Transparent)

// After (Activity):
override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()  // call before setContent
    super.onCreate(savedInstanceState)
    setContent { ... }
}

// Consume insets in Compose:
Box(modifier = Modifier.windowInsetsPadding(WindowInsets.statusBars)) { ... }
// Or safeDrawing for all system bars:
Scaffold(modifier = Modifier.fillMaxSize()) { innerPadding ->
    content(innerPadding)
}
```

### Pager → HorizontalPager / VerticalPager

```kotlin
// Remove: accompanist-pager
// Before: HorizontalPager from accompanist

// After (built into Compose Foundation):
val pagerState = rememberPagerState { pages.size }
HorizontalPager(state = pagerState) { page ->
    PageContent(pages[page])
}
// Tab indicator:
TabRow(selectedTabIndex = pagerState.currentPage) {
    pages.forEachIndexed { index, title ->
        Tab(
            selected = pagerState.currentPage == index,
            onClick = { scope.launch { pagerState.animateScrollToPage(index) } },
            text = { Text(title) }
        )
    }
}
```

### Navigation Animations → Built-in

```kotlin
// Remove: accompanist-navigation-animation
// AnimatedNavHost is now standard NavHost with built-in transitions (Compose 1.7+):
NavHost(
    navController = navController,
    startDestination = "home",
    enterTransition = { fadeIn(tween(300)) },
    exitTransition = { fadeOut(tween(300)) }
) {
    composable("home") { HomeScreen() }
    composable(
        "detail/{id}",
        enterTransition = { slideInHorizontally { it } }
    ) { DetailScreen() }
}
```

### Permissions → rememberLauncherForActivityResult

```kotlin
// Remove: accompanist-permissions
// After (standard Activity Result API):
val cameraPermission = rememberLauncherForActivityResult(
    ActivityResultContracts.RequestPermission()
) { isGranted ->
    if (isGranted) openCamera() else showRationale()
}

Button(onClick = { cameraPermission.launch(Manifest.permission.CAMERA) }) {
    Text("Open Camera")
}
```
