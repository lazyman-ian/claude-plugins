# Dependency Injection with Hilt

## Setup

### Gradle Dependencies
```toml
# libs.versions.toml
[versions]
hilt = "2.51.1"

[libraries]
hilt-android = { group = "com.google.dagger", name = "hilt-android", version.ref = "hilt" }
hilt-compiler = { group = "com.google.dagger", name = "hilt-android-compiler", version.ref = "hilt" }
hilt-navigation-compose = { group = "androidx.hilt", name = "hilt-navigation-compose", version = "1.2.0" }
hilt-work = { group = "androidx.hilt", name = "hilt-work", version = "1.2.0" }
hilt-work-compiler = { group = "androidx.hilt", name = "hilt-compiler", version = "1.2.0" }

[plugins]
hilt = { id = "com.google.dagger.hilt.android", version.ref = "hilt" }
ksp = { id = "com.google.devtools.ksp", version = "2.0.0-1.0.21" }
```

```kotlin
// app/build.gradle.kts
plugins {
    alias(libs.plugins.hilt)
    alias(libs.plugins.ksp)
}
dependencies {
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    implementation(libs.hilt.navigation.compose)
}
```

### Application and Entry Points
```kotlin
@HiltAndroidApp
class MyApplication : Application()

// All Android entry points need @AndroidEntryPoint
@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { MyApp() }
    }
}

// In Compose NavHost — no @AndroidEntryPoint needed for Composables
@Composable
fun HomeScreen(viewModel: HomeViewModel = hiltViewModel()) { ... }
```

## Component Hierarchy and Scoping

```
SingletonComponent          (@Singleton)        — app lifetime
├── ActivityRetainedComponent (@ActivityRetainedScoped) — survives rotation
│   ├── ViewModelComponent  (@ViewModelScoped)  — ViewModel lifetime
│   └── ActivityComponent   (@ActivityScoped)   — Activity lifetime
│       └── FragmentComponent (@FragmentScoped) — Fragment lifetime
│           └── ViewComponent (@ViewScoped)     — View lifetime
└── ServiceComponent        (@ServiceScoped)    — Service lifetime
```

Scope annotation controls how long an instance lives when injected into that component:

```kotlin
@Singleton           // One instance for entire app — use sparingly (startup cost)
@ActivityRetainedScoped  // Survives rotation — for ViewModel-adjacent state
@ViewModelScoped     // One per ViewModel — shared between ViewModel and its children
@ActivityScoped      // One per Activity instance
```

## @Module, @InstallIn, @Provides, @Binds

### @Binds — interface to implementation (preferred, no code generated)
```kotlin
@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {
    // No body — Hilt generates the binding
    @Binds
    @Singleton
    abstract fun bindUserRepository(impl: UserRepositoryImpl): UserRepository

    @Binds
    @Singleton
    abstract fun bindPostRepository(impl: PostRepositoryImpl): PostRepository
}
```

### @Provides — for types you don't own (Retrofit, Room, etc.)
```kotlin
@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideJson(): Json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }

    @Provides
    @Singleton
    fun provideOkHttpClient(): OkHttpClient = OkHttpClient.Builder()
        .addInterceptor(HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) BODY else NONE
        })
        .build()

    @Provides
    @Singleton
    fun provideRetrofit(client: OkHttpClient, json: Json): Retrofit = Retrofit.Builder()
        .baseUrl(BuildConfig.BASE_URL)
        .client(client)
        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
        .build()

    @Provides
    @Singleton
    fun provideUserApi(retrofit: Retrofit): UserApi = retrofit.create(UserApi::class.java)
}
```

### Mixing @Binds and @Provides
```kotlin
// Split abstract class + companion object when module needs both
@Module
@InstallIn(SingletonComponent::class)
abstract class DataModule {

    @Binds
    abstract fun bindUserRepository(impl: UserRepositoryImpl): UserRepository

    companion object {
        @Provides
        @Singleton
        fun provideDatabase(@ApplicationContext context: Context): AppDatabase =
            Room.databaseBuilder(context, AppDatabase::class.java, "app.db")
                .fallbackToDestructiveMigration()
                .build()

        @Provides
        fun provideUserDao(database: AppDatabase): UserDao = database.userDao()
    }
}
```

## Qualifier Annotations

When you have two bindings of the same type:
```kotlin
@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class AuthenticatedClient

@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class UnauthenticatedClient

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {
    @Provides
    @Singleton
    @AuthenticatedClient
    fun provideAuthenticatedClient(authInterceptor: AuthInterceptor): OkHttpClient =
        OkHttpClient.Builder().addInterceptor(authInterceptor).build()

    @Provides
    @Singleton
    @UnauthenticatedClient
    fun provideUnauthenticatedClient(): OkHttpClient = OkHttpClient.Builder().build()
}

// Injection site
class UserRepositoryImpl @Inject constructor(
    @AuthenticatedClient private val httpClient: OkHttpClient,
) : UserRepository
```

## Assisted Injection

For dependencies known only at runtime (e.g., IDs passed at creation):

```kotlin
// The class
class ItemDetailViewModel @AssistedInject constructor(
    @Assisted val itemId: String,
    private val getItemUseCase: GetItemUseCase,
) : ViewModel() {
    @AssistedFactory
    interface Factory {
        fun create(itemId: String): ItemDetailViewModel
    }
}

// In Compose with hiltViewModel
@Composable
fun ItemDetailScreen(itemId: String) {
    val viewModel = hiltViewModel<ItemDetailViewModel, ItemDetailViewModel.Factory>(
        creationCallback = { factory -> factory.create(itemId) }
    )
}
```

## Testing with Hilt

### @HiltAndroidTest for instrumented tests
```kotlin
@HiltAndroidTest
@RunWith(AndroidJUnit4::class)
class UserRepositoryTest {

    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    @Inject
    lateinit var repository: UserRepository

    @Before
    fun setUp() {
        hiltRule.inject()
    }

    @Test
    fun getUser_returnsUserFromRemote() = runTest {
        // test
    }
}
```

### @UninstallModules + @BindValue for replacing bindings
```kotlin
@UninstallModules(RepositoryModule::class)
@HiltAndroidTest
@RunWith(AndroidJUnit4::class)
class HomeScreenTest {

    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    // Replace real implementation with test double
    @BindValue
    @JvmField
    val fakeUserRepository: UserRepository = FakeUserRepository()

    @Before
    fun setUp() {
        hiltRule.inject()
    }
}
```

### Unit tests — no Hilt needed
```kotlin
// ViewModels tested without Hilt; inject fakes directly
class HomeViewModelTest {
    private val fakeRepository = FakeUserRepository()
    private lateinit var viewModel: HomeViewModel

    @Before
    fun setUp() {
        viewModel = HomeViewModel(GetItemsUseCase(fakeRepository))
    }

    @Test
    fun uiState_loadsItemsOnInit() = runTest {
        val states = mutableListOf<HomeUiState>()
        val job = launch { viewModel.uiState.toList(states) }
        advanceUntilIdle()
        assertTrue(states.last() is HomeUiState.Success)
        job.cancel()
    }
}
```

## @EntryPoint for Non-Hilt Classes

For classes Hilt doesn't manage (ContentProviders, legacy non-Hilt classes):
```kotlin
@EntryPoint
@InstallIn(SingletonComponent::class)
interface AnalyticsEntryPoint {
    fun analyticsService(): AnalyticsService
}

class LegacyClass(private val context: Context) {
    private val analytics: AnalyticsService by lazy {
        EntryPointAccessors.fromApplication(context, AnalyticsEntryPoint::class.java)
            .analyticsService()
    }
}
```

## Multi-Module Hilt Setup

Hilt modules in library modules just need `@InstallIn` — no extra config:

```kotlin
// core-data module
@Module
@InstallIn(SingletonComponent::class)
abstract class CoreDataModule {
    @Binds
    abstract fun bindUserRepository(impl: UserRepositoryImpl): UserRepository
}
// Hilt aggregates all @Module classes across modules automatically
```

## WorkManager with Hilt

```kotlin
@HiltWorker
class SyncWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val syncRepository: SyncRepository,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result =
        syncRepository.sync()
            .fold(onSuccess = { Result.success() }, onFailure = { Result.retry() })
}

// Application setup
@HiltAndroidApp
class MyApplication : Application(), Configuration.Provider {
    @Inject lateinit var workerFactory: HiltWorkerFactory

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder().setWorkerFactory(workerFactory).build()
}
```

## Navigation with hiltViewModel()

```kotlin
// Requires androidx.hilt:hilt-navigation-compose
@Composable
fun AppNavHost(navController: NavHostController) {
    NavHost(navController = navController, startDestination = "home") {
        composable("home") {
            // ViewModel scoped to "home" back stack entry
            val viewModel: HomeViewModel = hiltViewModel()
            HomeScreen(viewModel = viewModel)
        }
        composable("profile/{userId}") { backStackEntry ->
            // ViewModel receives SavedStateHandle with "userId" automatically
            val viewModel: ProfileViewModel = hiltViewModel()
            ProfileScreen(viewModel = viewModel)
        }
    }
}
```

## Common Mistakes

| Mistake | Problem | Fix |
|---------|---------|-----|
| `@Singleton` on every binding | Slow app startup, high memory | Only for expensive singletons (Retrofit, DB) |
| `@Provides` for interface bindings | Extra code generated | Use `@Binds` |
| Missing `@InstallIn` | Compile error | Always pair `@Module` with `@InstallIn` |
| Injecting into `object` | Hilt doesn't support Kotlin objects | Use `class` with `@Inject constructor` |
| `@HiltViewModel` without `@AndroidEntryPoint` on activity | Runtime crash | Ensure entry point is annotated |
| Circular dependency | Compile/runtime crash | Introduce interface or break cycle with lazy injection |
| Direct field injection in ViewModel | Anti-pattern | Use constructor injection |
