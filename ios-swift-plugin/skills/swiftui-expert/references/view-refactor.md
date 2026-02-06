# SwiftUI View Refactor Reference

Systematic approach to refactoring SwiftUI views for consistency, readability, and performance.

## When to Refactor

| Signal | Action |
|--------|--------|
| File > 300 lines | Split into extensions or subviews |
| `body` > 50 lines | Extract subviews |
| 3+ responsibilities | Separate concerns |
| Duplicate patterns | Extract reusable component |
| Optional ViewModel | Make non-optional |
| @ViewBuilder > 20 lines | Extract to struct |

## Property Ordering (Canonical)

```swift
struct MyView: View {
    // 1. Environment (injected dependencies)
    @Environment(\.dismiss) private var dismiss
    @Environment(AppTheme.self) private var theme
    @Environment(DataClient.self) private var client

    // 2. Stored Properties (let/var, public before private)
    let item: Item
    var onComplete: () -> Void
    private let config: Config

    // 3. State (internal view state)
    @State private var isLoading = false
    @State private var error: Error?
    @Binding var selection: Int

    // 4. Computed Properties (non-view)
    private var isValid: Bool {
        !item.name.isEmpty
    }

    // 5. Initializer (if custom)
    init(item: Item, selection: Binding<Int>) {
        self.item = item
        self._selection = selection
    }

    // 6. body
    var body: some View {
        // ...
    }

    // 7. View Builders (private)
    private var headerSection: some View {
        // ...
    }

    // 8. Helper Functions
    private func save() async {
        // ...
    }
}
```

## Body Splitting Strategy

### When to Extract

| Criteria | Extract to |
|----------|-----------|
| Reused in multiple places | Separate `View` struct |
| Complex but single-use | File-local computed property |
| Logical section (header/content/footer) | `// MARK:` + computed property |
| Contains independent state | Separate `View` struct |
| Performance sensitive | Separate `View` struct |

### Before

```swift
var body: some View {
    VStack {
        // Header - 30 lines
        HStack {
            Image(user.avatar)
            VStack(alignment: .leading) {
                Text(user.name)
                Text(user.bio)
            }
            Spacer()
            Button("Follow") { /* ... */ }
        }

        // Content - 50 lines
        ScrollView {
            LazyVStack {
                ForEach(posts) { post in
                    // Complex post rendering
                }
            }
        }

        // Footer - 20 lines
        HStack {
            // Tab bar
        }
    }
}
```

### After

```swift
var body: some View {
    VStack {
        headerSection
        contentSection
        footerSection
    }
}

// MARK: - Sections

private var headerSection: some View {
    HStack {
        // ...
    }
}

private var contentSection: some View {
    ScrollView {
        // ...
    }
}

private var footerSection: some View {
    HStack {
        // ...
    }
}
```

## Large File Handling (>300 lines)

### Strategy 1: Extension Grouping

```swift
// MyView.swift - Main file
struct MyView: View {
    // Properties + body only
    var body: some View { ... }
}

// MyView+Sections.swift
extension MyView {
    var headerSection: some View { ... }
    var contentSection: some View { ... }
}

// MyView+Actions.swift
extension MyView {
    func save() async { ... }
    func delete() async { ... }
}
```

### Strategy 2: MARK Grouping (same file)

```swift
struct MyView: View {
    // MARK: - Properties
    @Environment(\.dismiss) private var dismiss
    @State private var isLoading = false

    // MARK: - Body
    var body: some View { ... }

    // MARK: - Sections
    private var headerSection: some View { ... }
    private var contentSection: some View { ... }

    // MARK: - Actions
    private func save() async { ... }
}
```

## ViewModel Handling (If You Must)

### Problem: Optional ViewModel

```swift
// BAD - Optional creates complexity
struct MyView: View {
    @State private var viewModel: MyViewModel?

    var body: some View {
        if let viewModel {
            ContentView(viewModel: viewModel)
        } else {
            ProgressView()
        }
    }

    func bootstrapIfNeeded() {
        if viewModel == nil {
            viewModel = MyViewModel(client: client)
        }
    }
}
```

### Solution: Non-Optional with DI

```swift
// GOOD - Initialize via init with dependency injection
struct MyView: View {
    @State private var viewModel: MyViewModel

    init(client: DataClient) {
        _viewModel = State(initialValue: MyViewModel(client: client))
    }

    var body: some View {
        ContentView(viewModel: viewModel)
            .task { await viewModel.load() }
    }
}
```

### Better Solution: No ViewModel

```swift
// BEST - Views own their state
struct MyView: View {
    @Environment(DataClient.self) private var client
    @State private var items: [Item] = []
    @State private var isLoading = false

    var body: some View {
        List(items) { item in
            ItemRow(item: item)
        }
        .task { await loadItems() }
    }

    private func loadItems() async {
        isLoading = true
        items = try? await client.fetchItems() ?? []
        isLoading = false
    }
}
```

## @Observable Patterns

### Root View: @State

```swift
// Root view owns the observable
struct RootView: View {
    @State private var appState = AppState()

    var body: some View {
        ChildView()
            .environment(appState)
    }
}
```

### Child View: @Environment

```swift
// Child accesses via environment
struct ChildView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        Text(appState.user.name)
    }
}
```

### Binding from @Observable

```swift
struct EditView: View {
    @Bindable var user: User  // @Observable type

    var body: some View {
        TextField("Name", text: $user.name)
    }
}
```

## Refactor Checklist

### Before Refactoring

- [ ] Identify file line count (>300 = split)
- [ ] Identify body line count (>50 = extract)
- [ ] List responsibilities (>3 = separate)
- [ ] Check for optional ViewModels

### During Refactoring

- [ ] Apply canonical property ordering
- [ ] Extract complex sections to computed properties
- [ ] Extract reusable components to structs
- [ ] Replace optional ViewModel with non-optional or remove
- [ ] Add MARK comments for sections
- [ ] Keep related code together

### After Refactoring

- [ ] `body` is readable at a glance
- [ ] Each extracted view has single responsibility
- [ ] No @ViewBuilder functions > 20 lines
- [ ] No optional ViewModels
- [ ] File < 300 lines (or split into extensions)

## Anti-Patterns to Fix

| Anti-Pattern | Fix |
|--------------|-----|
| Optional ViewModel | DI via init or remove VM |
| @ViewBuilder > 20 lines | Extract to struct |
| File > 300 lines | Split to extensions |
| Mixed concerns in body | Extract sections |
| Passing closures to subviews | Pass data + environment actions |
| Manual state sync | Use @Observable + @Environment |
| Massive body | Aggressive extraction |
