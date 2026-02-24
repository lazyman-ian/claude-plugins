# Architecture Layers — Deep Dive

## UI Layer

### ViewModel State Management

Prefer `stateIn` over manual `MutableStateFlow` for state derived from data sources:

```kotlin
@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val getUserUseCase: GetUserUseCase,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val userId: String = checkNotNull(savedStateHandle["userId"])

    // Cold flow → StateFlow, auto-cancels with WhileSubscribed
    val uiState: StateFlow<ProfileUiState> = getUserUseCase(userId)
        .map { user -> ProfileUiState.Success(user) }
        .catch { e -> emit(ProfileUiState.Error(e.toUserMessage())) }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5_000),
            initialValue = ProfileUiState.Loading,
        )
}
```

### UiState Design

**Sealed interface** for mutually exclusive states:
```kotlin
sealed interface SearchUiState {
    data object Idle : SearchUiState
    data object Loading : SearchUiState
    data class Success(
        val query: String,
        val results: ImmutableList<SearchResult>,
    ) : SearchUiState
    data class Error(val message: String) : SearchUiState
}
```

**Data class** for screens with always-present state + loading overlay:
```kotlin
data class FeedUiState(
    val posts: ImmutableList<Post> = persistentListOf(),
    val isLoading: Boolean = false,
    val isRefreshing: Boolean = false,
    val errorMessage: String? = null,
)
```

Rule: use sealed interface when states are mutually exclusive; data class when state always exists.

### One-Shot Events (Navigation, Snackbars)

Use `Channel` for events consumed exactly once:
```kotlin
@HiltViewModel
class LoginViewModel @Inject constructor(
    private val loginUseCase: LoginUseCase,
) : ViewModel() {

    private val _events = Channel<LoginEvent>(Channel.BUFFERED)
    val events: Flow<LoginEvent> = _events.receiveAsFlow()

    fun login(email: String, password: String) {
        viewModelScope.launch {
            loginUseCase(email, password)
                .onSuccess { _events.send(LoginEvent.NavigateToHome) }
                .onFailure { e -> _events.send(LoginEvent.ShowError(e.message ?: "Login failed")) }
        }
    }
}

sealed interface LoginEvent {
    data object NavigateToHome : LoginEvent
    data class ShowError(val message: String) : LoginEvent
}

// Screen collects events
@Composable
fun LoginScreen(viewModel: LoginViewModel = hiltViewModel(), onNavigateHome: () -> Unit) {
    val lifecycleOwner = LocalLifecycleOwner.current
    LaunchedEffect(viewModel.events, lifecycleOwner) {
        viewModel.events.flowWithLifecycle(lifecycleOwner.lifecycle).collect { event ->
            when (event) {
                LoginEvent.NavigateToHome -> onNavigateHome()
                is LoginEvent.ShowError -> { /* show snackbar */ }
            }
        }
    }
}
```

Avoid `SharedFlow` for one-shot events — replay and buffering cause re-delivery on recomposition.

### SavedStateHandle for Process Death

```kotlin
@HiltViewModel
class SearchViewModel @Inject constructor(
    private val searchUseCase: SearchUseCase,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    // Survives process death; type must be Parcelable or primitive
    var query by savedStateHandle.saveable { mutableStateOf("") }

    val results: StateFlow<SearchUiState> = snapshotFlow { query }
        .debounce(300)
        .filter { it.length >= 2 }
        .flatMapLatest { q -> searchUseCase(q) }
        .map { SearchUiState.Success(it.toImmutableList()) }
        .catch { emit(SearchUiState.Error(it.message ?: "")) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), SearchUiState.Idle)
}
```

---

## Domain Layer

### UseCase Conventions

```kotlin
// Operator invoke — single entry point
class GetUserUseCase @Inject constructor(
    private val userRepository: UserRepository,
) {
    // Flow-returning for continuous observation
    operator fun invoke(userId: String): Flow<User> =
        userRepository.getUser(userId)
}

// Suspend for one-shot operations
class UpdateProfileUseCase @Inject constructor(
    private val userRepository: UserRepository,
    private val analyticsRepository: AnalyticsRepository,
) {
    suspend operator fun invoke(profile: ProfileUpdate): Result<Unit> {
        return userRepository.updateProfile(profile)
            .onSuccess { analyticsRepository.trackProfileUpdate() }
    }
}
```

### When to Add Domain Layer

Decision tree:
```
Is the logic reused by 2+ ViewModels?
    YES → UseCase
Is it complex enough to need unit testing in isolation?
    YES → UseCase
Does it combine results from 2+ repositories?
    YES → UseCase
Is it a simple repository passthrough?
    NO → Call repository directly from ViewModel
```

### Domain Model vs DTO vs Entity

```kotlin
// core-model: Domain model — no framework dependencies
data class User(
    val id: String,
    val name: String,
    val email: String,
    val avatarUrl: String?,
)

// core-network: DTO — matches API response shape
@Serializable
data class UserDto(
    val id: String,
    @SerialName("display_name") val displayName: String,
    val email: String,
    @SerialName("avatar_url") val avatarUrl: String? = null,
)

// core-database: Entity — Room table definition
@Entity(tableName = "users")
data class UserEntity(
    @PrimaryKey val id: String,
    val name: String,
    val email: String,
    val avatarUrl: String?,
    val cachedAt: Long,
)

// Mappers keep conversion logic co-located with the type
fun UserDto.toDomain(): User = User(id = id, name = displayName, email = email, avatarUrl = avatarUrl)
fun UserEntity.toDomain(): User = User(id = id, name = name, email = email, avatarUrl = avatarUrl)
fun User.toEntity(cachedAt: Long = System.currentTimeMillis()): UserEntity =
    UserEntity(id = id, name = name, email = email, avatarUrl = avatarUrl, cachedAt = cachedAt)
```

---

## Data Layer

### Repository Pattern — Offline-First

```kotlin
interface UserRepository {
    fun getUser(userId: String): Flow<User>
    suspend fun refreshUser(userId: String): Result<Unit>
}

class UserRepositoryImpl @Inject constructor(
    private val remoteDataSource: UserRemoteDataSource,
    private val localDataSource: UserLocalDataSource,
) : UserRepository {

    // Emit local first, refresh in background
    override fun getUser(userId: String): Flow<User> = flow {
        // 1. Emit cached value immediately
        val cached = localDataSource.getUser(userId)
        if (cached != null) emit(cached.toDomain())

        // 2. Fetch fresh data
        remoteDataSource.getUser(userId)
            .onSuccess { dto ->
                localDataSource.upsertUser(dto.toEntity())
                emit(dto.toDomain())
            }
            .onFailure { e ->
                if (cached == null) throw e  // No cache to fall back on
            }
    }

    override suspend fun refreshUser(userId: String): Result<Unit> = runCatching {
        val dto = remoteDataSource.getUser(userId).getOrThrow()
        localDataSource.upsertUser(dto.toEntity())
    }
}
```

### Data Source Abstraction

```kotlin
interface UserRemoteDataSource {
    suspend fun getUser(userId: String): Result<UserDto>
    suspend fun updateProfile(userId: String, request: UpdateProfileRequest): Result<UserDto>
}

class UserRemoteDataSourceImpl @Inject constructor(
    private val api: UserApi,
) : UserRemoteDataSource {
    override suspend fun getUser(userId: String): Result<UserDto> = runCatching {
        api.getUser(userId)
    }
}

interface UserLocalDataSource {
    fun observeUser(userId: String): Flow<UserEntity?>
    suspend fun getUser(userId: String): UserEntity?
    suspend fun upsertUser(entity: UserEntity)
    suspend fun deleteUser(userId: String)
}

class UserLocalDataSourceImpl @Inject constructor(
    private val dao: UserDao,
) : UserLocalDataSource {
    override fun observeUser(userId: String): Flow<UserEntity?> = dao.observeById(userId)
    override suspend fun getUser(userId: String): UserEntity? = dao.getById(userId)
    override suspend fun upsertUser(entity: UserEntity) = dao.upsert(entity)
    override suspend fun deleteUser(userId: String) = dao.deleteById(userId)
}
```

### Error Handling at Data Layer

Use `Result<T>` to surface errors without exceptions crossing layer boundaries:

```kotlin
// Define domain errors in core-model
sealed class AppError : Exception() {
    data class Network(val code: Int, override val message: String) : AppError()
    data class NotFound(val resource: String) : AppError()
    data class Unauthorized(override val message: String = "Session expired") : AppError()
    data class Unknown(override val cause: Throwable? = null) : AppError()
}

// Map HTTP errors to domain errors in remote data source
class UserRemoteDataSourceImpl @Inject constructor(private val api: UserApi) : UserRemoteDataSource {
    override suspend fun getUser(userId: String): Result<UserDto> = runCatching {
        api.getUser(userId)
    }.mapHttpErrors()
}

// Extension to map retrofit errors
fun <T> Result<T>.mapHttpErrors(): Result<T> = mapFailure { throwable ->
    when (throwable) {
        is HttpException -> when (throwable.code()) {
            401 -> AppError.Unauthorized()
            404 -> AppError.NotFound("user")
            else -> AppError.Network(throwable.code(), throwable.message())
        }
        is IOException -> AppError.Network(-1, "No internet connection")
        else -> AppError.Unknown(throwable)
    }
}
```

---

## Cross-Layer Rules

| Rule | Reason |
|------|--------|
| Domain layer has NO Android imports | Testable without instrumentation |
| Data layer returns domain models at repository boundary | UI/domain layers don't know about DTOs |
| ViewModel doesn't import data layer directly | Only through domain or repository interfaces |
| No business logic in Composables | Composables are pure rendering functions |
| Coroutine scope: viewModelScope in ViewModel | Cancels with ViewModel lifecycle |
| Coroutine scope: none in repository | Repository functions are suspend/Flow |
