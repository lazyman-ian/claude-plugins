# ObservableObject → @Observable Migration

Requires iOS 17+. For iOS 15-16 targets, keep ObservableObject.

## Why Migrate

| ObservableObject | @Observable |
|-----------------|-------------|
| Object-level change notification | **Property-level** tracking |
| ANY @Published change redraws ALL observing views | Only views reading changed property redraw |
| Requires @Published on every property | Just declare `var` — macro handles tracking |
| @StateObject / @ObservedObject / @EnvironmentObject | @State / @Bindable / @Environment |

## Step-by-Step Migration

### 1. Replace Protocol Conformance

```swift
// BEFORE
class ViewModel: ObservableObject {
    @Published var name = ""
    @Published var count = 0
    @Published var isLoading = false
}

// AFTER
@Observable
class ViewModel {
    var name = ""
    var count = 0
    var isLoading = false
}
```

### 2. Update Property Wrappers in Views

| Before | After | Notes |
|--------|-------|-------|
| `@StateObject var vm = VM()` | `@State var vm = VM()` | Owner creates |
| `@ObservedObject var vm: VM` | `var vm: VM` (plain property) or `@Bindable var vm: VM` | For bindings |
| `@EnvironmentObject var vm: VM` | `@Environment(VM.self) var vm` | Type-based lookup |

### 3. Handle Properties That Should NOT Trigger Updates

```swift
@Observable
class ViewModel {
    var name = ""
    @ObservationIgnored var internalCache: [String: Data] = [:]  // No UI updates
}
```

### 4. Update Environment Injection

```swift
// BEFORE
ContentView()
    .environmentObject(viewModel)

// AFTER
ContentView()
    .environment(viewModel)
```

## Critical Pitfalls

### Pitfall 1: @State Repeated Initialization

`@StateObject` uses `@autoclosure` — initializer runs once.
`@State` receives value directly — initializer runs on EVERY view rebuild.

```swift
// DANGEROUS: ViewModel created multiple times
struct MyView: View {
    @State var vm = ViewModel()  // init() called on each rebuild!
}
```

**Fix:** Hold @State at the **highest stable view** (App struct or tab root):

```swift
@main
struct MyApp: App {
    @State private var vm = ViewModel()  // Created once, stable

    var body: some Scene {
        WindowGroup {
            ContentView(vm: vm)
        }
    }
}
```

### Pitfall 2: Memory Leaks from Lingering Instances

When SwiftUI rebuilds views, intermediate @State objects may linger in memory indefinitely. If these objects hold notification observers, they respond to events even after being "replaced."

**Fix:** Same as Pitfall 1 — hold state at stable parent.

### Pitfall 3: Bindings Require @Bindable

```swift
// BEFORE (ObservableObject)
struct EditView: View {
    @ObservedObject var vm: ViewModel
    var body: some View {
        TextField("Name", text: $vm.name)  // $ works directly
    }
}

// AFTER (@Observable)
struct EditView: View {
    @Bindable var vm: ViewModel  // Need @Bindable for $ syntax
    var body: some View {
        TextField("Name", text: $vm.name)
    }
}
```

### Pitfall 4: Computed Properties Now Tracked

With @Observable, accessing a computed property in body causes the view to update when any stored property the computed property reads changes. This can cause unexpected updates.

```swift
@Observable class VM {
    var items: [Item] = []
    var count: Int { items.count }  // Reading 'count' tracks 'items'
}
```

## Incremental Migration Strategy

For large codebases, migrate incrementally:

1. **New code** → Use @Observable from the start
2. **Leaf views** → Migrate simple ViewModels first (fewer dependencies)
3. **Shared state** → Migrate last (most connections, highest risk)
4. **Keep both** → ObservableObject and @Observable can coexist in the same app

### Availability Wrapper for iOS 15-17 Support

```swift
// Wrapper for gradual migration
#if canImport(Observation)
@available(iOS 17, *)
@Observable
class ModernViewModel {
    var name = ""
}
#endif

// Legacy fallback
class LegacyViewModel: ObservableObject {
    @Published var name = ""
}
```

## Verification Checklist

- [ ] All @Published annotations removed (replaced by @Observable macro)
- [ ] @StateObject → @State (at stable parent level)
- [ ] @ObservedObject → plain property or @Bindable (if bindings needed)
- [ ] @EnvironmentObject → @Environment with type-based lookup
- [ ] No @State initialization in frequently-rebuilt views
- [ ] @ObservationIgnored on non-UI properties
- [ ] Test view update counts with Instruments SwiftUI template

## Sources

- [Apple: Migrating from ObservableObject to Observable](https://developer.apple.com/documentation/SwiftUI/Migrating-from-the-observable-object-protocol-to-the-observable-macro)
- [Antoine van der Lee: @Observable Performance](https://www.avanderlee.com/swiftui/observable-macro-performance-increase-observableobject/)
- [Jesse Squires: @Observable is NOT a drop-in replacement](https://www.jessesquires.com/blog/2024/09/09/swift-observable-macro/)
