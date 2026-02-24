# Architecture Selection Guide (2025)

## Decision Tree

```
Project Size?
├── Small (1-3 devs, solo/pair)
│   └── SwiftUI + @Observable directly
│       Minimal boilerplate, fast iteration
│
├── Medium (3-8 devs, small team)
│   └── MVVM variant + SPM modules
│       Testable, familiar, clear ownership
│
├── Large (8+ devs, multiple teams)
│   └── Clean Architecture or TCA
│       Enforced boundaries, scalable
│
└── Existing UIKit
    └── Hybrid UIKit + SwiftUI per screen
        Incremental, low risk
```

## Pattern Comparison

| Factor | @Observable Direct | MVVM Variant | Clean Architecture | TCA |
|--------|-------------------|-------------|-------------------|-----|
| Boilerplate | Minimal | Low-Medium | High | High |
| Testability | Medium | High | Very High | Very High |
| Learning curve | Low | Low | Medium | High |
| Team scalability | 1-3 | 3-8 | 8+ | 8+ |
| State management | SwiftUI native | Manual | Manual | Store-based |
| Navigation | NavigationStack | Coordinator | Coordinator | Reducer |
| Dependency injection | @Environment | Protocol/DI | Protocol/DI | @Dependency |
| Min iOS | 17 | 15 | 15 | 15 |

## @Observable Direct (Small Projects)

"Classic MVVM is dead" for simple apps — @Observable eliminates the need for separate ViewModels in many cases.

```swift
// For simple screens, no ViewModel needed
@Observable
class AppState {
    var user: User?
    var items: [Item] = []
    var isLoading = false

    func loadItems() async throws {
        isLoading = true
        defer { isLoading = false }
        items = try await api.fetchItems()
    }
}

struct ItemListView: View {
    @Environment(AppState.self) var state

    var body: some View {
        List(state.items) { item in
            ItemRow(item: item)
        }
        .task { try? await state.loadItems() }
    }
}
```

**When to upgrade:** When you need testable business logic separate from UI state, or team grows beyond 3.

## MVVM Variant (Medium Projects)

Modern MVVM uses @Observable instead of ObservableObject. Key difference from classic: ViewModel is a plain class, not protocol-heavy.

```swift
@Observable
class ItemListViewModel {
    var items: [Item] = []
    var isLoading = false
    var error: Error?

    private let repository: ItemRepository

    init(repository: ItemRepository = .live) {
        self.repository = repository
    }

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            items = try await repository.fetchAll()
        } catch {
            self.error = error
        }
    }
}

// Testable via protocol
protocol ItemRepository {
    func fetchAll() async throws -> [Item]
}
```

## Clean Architecture (Large Projects)

3-layer separation: Domain → Data → Presentation.

```
┌─────────────┐
│ Presentation │  SwiftUI Views + ViewModels
├─────────────┤
│   Domain     │  Use Cases + Entities (pure Swift, no framework imports)
├─────────────┤
│    Data      │  Repositories + Network + Persistence
└─────────────┘
```

```swift
// Domain layer — pure Swift
protocol FetchItemsUseCase {
    func execute() async throws -> [Item]
}

struct FetchItemsUseCaseImpl: FetchItemsUseCase {
    let repository: ItemRepository

    func execute() async throws -> [Item] {
        try await repository.fetchAll()
    }
}

// Data layer
struct ItemRepositoryImpl: ItemRepository {
    let api: APIClient
    let cache: CacheStore

    func fetchAll() async throws -> [Item] {
        if let cached = try? await cache.get([Item].self, key: "items") {
            return cached
        }
        let items = try await api.request(ItemsEndpoint.list)
        try? await cache.set(items, key: "items")
        return items
    }
}
```

Reference: [nalexn/clean-architecture-swiftui](https://github.com/nalexn/clean-architecture-swiftui)

## TCA (The Composable Architecture)

Best for: Large teams needing strict state management and testability.

```swift
@Reducer
struct ItemListFeature {
    @ObservableState
    struct State: Equatable {
        var items: [Item] = []
        var isLoading = false
    }

    enum Action {
        case onAppear
        case itemsLoaded(Result<[Item], Error>)
    }

    @Dependency(\.itemClient) var itemClient

    var body: some ReducerOf<Self> {
        Reduce { state, action in
            switch action {
            case .onAppear:
                state.isLoading = true
                return .run { send in
                    await send(.itemsLoaded(Result { try await itemClient.fetchAll() }))
                }
            case .itemsLoaded(.success(let items)):
                state.isLoading = false
                state.items = items
                return .none
            case .itemsLoaded(.failure):
                state.isLoading = false
                return .none
            }
        }
    }
}
```

**Trade-off:** Very testable and predictable, but significant learning curve and boilerplate.

## NavigationStack + Coordinator

Modern navigation replaces UIKit-era Coordinator pattern with NavigationStack:

```swift
@Observable
class AppRouter {
    var path = NavigationPath()

    func push(_ destination: Destination) {
        path.append(destination)
    }

    func pop() {
        path.removeLast()
    }

    func popToRoot() {
        path.removeLast(path.count)
    }
}

enum Destination: Hashable {
    case itemDetail(Item.ID)
    case settings
    case profile(User.ID)
}

struct RootView: View {
    @State private var router = AppRouter()

    var body: some View {
        NavigationStack(path: $router.path) {
            ItemListView()
                .navigationDestination(for: Destination.self) { dest in
                    switch dest {
                    case .itemDetail(let id): ItemDetailView(id: id)
                    case .settings: SettingsView()
                    case .profile(let id): ProfileView(id: id)
                    }
                }
        }
        .environment(router)
    }
}
```

**Note:** NavigationView is deprecated (iOS 16+). NavigationStack is the only modern option.

## SPM Modularization

40% build time reduction reported with proper modularization.

```
MyApp/
├── Packages/
│   ├── Core/              # Shared types, extensions, utilities
│   ├── Networking/        # API client, endpoints
│   ├── Persistence/       # SwiftData/CoreData
│   ├── FeatureAuth/       # Login, registration
│   ├── FeatureHome/       # Home screen
│   └── DesignSystem/      # Shared UI components
└── MyApp/                 # App target (thin shell)
```

```swift
// Package.swift
let package = Package(
    name: "FeatureHome",
    platforms: [.iOS(.v17)],
    products: [.library(name: "FeatureHome", targets: ["FeatureHome"])],
    dependencies: [
        .package(path: "../Core"),
        .package(path: "../Networking"),
        .package(path: "../DesignSystem"),
    ],
    targets: [
        .target(name: "FeatureHome", dependencies: ["Core", "Networking", "DesignSystem"]),
        .testTarget(name: "FeatureHomeTests", dependencies: ["FeatureHome"]),
    ]
)
```

### Modularization Benefits

| Benefit | Impact |
|---------|--------|
| Incremental builds | 40% faster (only changed modules rebuild) |
| Clear ownership | Each team owns specific modules |
| Test isolation | Module tests run independently |
| Access control | `internal` enforces module boundaries |
| Dependency clarity | Explicit Package.swift dependencies |

### Migration Strategy

1. Extract `Core` (shared types, no dependencies)
2. Extract `Networking` (depends on Core)
3. Extract `DesignSystem` (shared UI, depends on Core)
4. Extract features one by one (highest-traffic first)
5. App target becomes thin shell importing features

## UIKit → SwiftUI Hybrid

For existing UIKit apps, migrate screen by screen:

| Strategy | Use When |
|----------|----------|
| New screens in SwiftUI | Default for all new features |
| `UIHostingController` | Embed SwiftUI in UIKit navigation |
| `UIViewControllerRepresentable` | Wrap UIKit in SwiftUI (rare) |
| Keep UIKit | Complex custom layouts, performance-critical lists |

```swift
// Embed SwiftUI screen in UIKit navigation
let swiftUIView = ItemDetailView(item: item)
let hostingController = UIHostingController(rootView: swiftUIView)
navigationController?.pushViewController(hostingController, animated: true)
```

**Rule:** Never rewrite working UIKit screens unless adding significant new functionality.

## Sources

- [nalexn: Clean Architecture for SwiftUI](https://nalexn.github.io/clean-architecture-swiftui/)
- [pointfree.co: The Composable Architecture](https://github.com/pointfreeco/swift-composable-architecture)
- [Apple: Migrating to NavigationStack](https://developer.apple.com/documentation/swiftui/migrating-to-new-navigation-types)
- [Jesse Squires: @Observable is NOT a drop-in replacement](https://www.jessesquires.com/blog/2024/09/09/swift-observable-macro/)
