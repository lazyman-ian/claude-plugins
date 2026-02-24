---
name: android-architecture
description: Provides expert guidance on modern Android app architecture including UI layer, domain layer, data layer, dependency injection with Hilt, modularization strategies, and UDF (Unidirectional Data Flow) patterns. This skill should be used when designing app architecture, structuring modules, implementing clean architecture layers, setting up Hilt DI, or adopting MVI/MVVM with UDF. Key capabilities include layer boundary design, module dependency management, ViewModel patterns, and repository design. Triggers on "architecture", "MVVM", "MVI", "UDF", "clean architecture", "modularization", "Hilt", "dependency injection", "repository pattern", "use case", "ViewModel", "架构", "模块化", "依赖注入", "分层架构". Do NOT use for Compose UI code — use compose-expert instead. Do NOT use for Coroutines/Flow patterns — use kotlin-coroutines instead.
memory: project
allowed-tools: [Read, Glob, Grep, Edit, Write]
---

# Android Architecture

Modern Android app architecture: layers, UDF, modularization, and dependency injection.

## Architecture Overview

Google's recommended architecture (Now in Android reference):

```
┌─────────────────────────────────┐
│         UI Layer                │  Compose screens, ViewModels
│  (State holders + UI elements)  │
├─────────────────────────────────┤
│       Domain Layer (optional)   │  Use cases, business rules
├─────────────────────────────────┤
│         Data Layer              │  Repositories, data sources
│  (Repositories + Data sources)  │
└─────────────────────────────────┘
```

## Layer Responsibilities

### UI Layer
| Component | Responsibility |
|-----------|---------------|
| Composable/Screen | Render UI from state, emit events |
| ViewModel | Hold UI state, process events, call domain/data |
| UiState | Single sealed class/data class for screen state |
| UiEvent | Sealed interface for user actions |

### Domain Layer (Optional)
| Component | Responsibility |
|-----------|---------------|
| UseCase | Single business operation, reusable across ViewModels |
| Model | Domain models (independent of data/UI) |

When to add domain layer:
- Logic reused by multiple ViewModels
- Complex business rules
- Needs to combine multiple repositories

### Data Layer
| Component | Responsibility |
|-----------|---------------|
| Repository | Single source of truth, coordinate data sources |
| RemoteDataSource | API calls (Retrofit/Ktor) |
| LocalDataSource | Room/DataStore operations |
| Model/Entity | Data transfer objects, DB entities |
| Mapper | DTO ↔ Domain model conversion |

## UDF (Unidirectional Data Flow) Pattern

```kotlin
// UiState
sealed interface HomeUiState {
    data object Loading : HomeUiState
    data class Success(val items: ImmutableList<Item>) : HomeUiState
    data class Error(val message: String) : HomeUiState
}

// UiEvent
sealed interface HomeEvent {
    data class ItemClicked(val id: String) : HomeEvent
    data object Refresh : HomeEvent
    data object RetryClicked : HomeEvent
}

// ViewModel
@HiltViewModel
class HomeViewModel @Inject constructor(
    private val getItemsUseCase: GetItemsUseCase,
) : ViewModel() {

    val uiState: StateFlow<HomeUiState> = getItemsUseCase()
        .map<List<Item>, HomeUiState> { HomeUiState.Success(it.toImmutableList()) }
        .catch { emit(HomeUiState.Error(it.message ?: "Unknown error")) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), HomeUiState.Loading)

    fun onEvent(event: HomeEvent) {
        when (event) {
            is HomeEvent.ItemClicked -> navigateToDetail(event.id)
            HomeEvent.Refresh -> refresh()
            HomeEvent.RetryClicked -> retry()
        }
    }
}

// Screen
@Composable
fun HomeScreen(viewModel: HomeViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    HomeContent(uiState = uiState, onEvent = viewModel::onEvent)
}
```

## Dependency Injection with Hilt

### Setup
```kotlin
// Application
@HiltAndroidApp
class MyApplication : Application()

// Activity
@AndroidEntryPoint
class MainActivity : ComponentActivity()

// ViewModel
@HiltViewModel
class MyViewModel @Inject constructor(
    private val repository: MyRepository,
    private val savedStateHandle: SavedStateHandle,
) : ViewModel()
```

### Module Organization
| Scope | @InstallIn | Lifetime |
|-------|-----------|----------|
| App-wide singletons | `SingletonComponent` | App lifecycle |
| Activity-scoped | `ActivityComponent` | Activity lifecycle |
| ViewModel-scoped | `ViewModelComponent` | ViewModel lifecycle |
| Fragment-scoped | `FragmentComponent` | Fragment lifecycle |

```kotlin
@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {
    @Binds
    abstract fun bindUserRepository(impl: UserRepositoryImpl): UserRepository
}

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {
    @Provides
    @Singleton
    fun provideRetrofit(): Retrofit = Retrofit.Builder()
        .baseUrl(BASE_URL)
        .addConverterFactory(Json.asConverterFactory("application/json".toMediaType()))
        .build()
}
```

### Hilt Best Practices
- Use `@Binds` over `@Provides` for interface→impl binding
- Avoid `@Singleton` overuse (increases startup cost)
- Use `@ViewModelScoped` for ViewModel-shared dependencies
- Qualifier annotations for same-type dependencies
- `@EntryPoint` for non-Hilt classes

## Modularization

### Module Structure (Now in Android pattern)
```
app/                          # App module (minimal, wiring only)
├── feature/
│   ├── feature-home/         # Home feature
│   ├── feature-profile/      # Profile feature
│   └── feature-settings/     # Settings feature
├── core/
│   ├── core-data/           # Repositories, data sources
│   ├── core-domain/         # Use cases, domain models
│   ├── core-network/        # Retrofit, API definitions
│   ├── core-database/       # Room, DAOs
│   ├── core-ui/             # Shared Compose components
│   ├── core-model/          # Shared data models
│   ├── core-common/         # Utilities, extensions
│   └── core-testing/        # Test utilities, fakes
└── build-logic/             # Convention plugins
```

### Module Dependency Rules
| Module | Can Depend On | Cannot Depend On |
|--------|--------------|------------------|
| app | feature/*, core/* | - |
| feature/* | core/* | other feature/* |
| core-data | core-network, core-database, core-model | feature/*, core-ui |
| core-domain | core-model | feature/*, core-data |
| core-ui | core-model | feature/*, core-data |
| core-network | core-model | feature/*, core-data |

### Inter-Feature Communication
- Navigation contracts (shared route definitions)
- Shared core-model types
- Event bus (for rare cross-feature events)
- NO direct feature-to-feature imports

## Review Checklist
- [ ] ViewModel uses UDF (single UiState + events)
- [ ] Repository is single source of truth
- [ ] No Android framework imports in domain layer
- [ ] Hilt modules scoped correctly
- [ ] Feature modules don't depend on each other
- [ ] Data layer errors mapped to domain errors
- [ ] StateFlow with WhileSubscribed(5_000)
- [ ] UseCase is single-responsibility (if used)

## References
| Category | Reference |
|----------|-----------|
| **Layers** | `references/layers.md` |
| **Modularization** | `references/modularization.md` |
| **DI** | `references/dependency-injection.md` |
