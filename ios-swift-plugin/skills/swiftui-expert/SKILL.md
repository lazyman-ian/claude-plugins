---
name: swiftui-expert
description: Writes, reviews, and improves SwiftUI code following best practices for state management, view composition, performance, and modern APIs. This skill should be used when building new SwiftUI features, refactoring existing views, reviewing code quality, or adopting modern SwiftUI patterns. Triggers on "SwiftUI", "view composition", "state management", "@Observable", "@State", "NavigationStack", "TabView", "sheet", "refactor view", "SwiftUI最佳实践", "视图优化", "界面设计", "创建视图".
memory: project
allowed-tools: [Read, Glob, Grep, Edit, Write, mcp__apple-docs__*]
---

# SwiftUI Expert

Build, review, and improve SwiftUI features with modern best practices.

## Workflow

### 1) Review Code
- Check property wrappers → `references/state-management.md`
- Verify modern APIs → `references/modern-apis.md`
- Check view composition → `references/view-structure.md`
- Check performance → `references/performance-patterns.md`
- Verify list patterns → `references/list-patterns.md`

### 2) Improve Code
- Prefer `@Observable` over `ObservableObject`
- Replace deprecated APIs with modern equivalents
- Extract complex views into subviews
- Ensure ForEach uses stable identity

### 3) Implement New
- Design data flow first (owned vs injected state)
- Use modern APIs (no deprecated patterns)
- Structure views for optimal diffing
- Separate business logic into testable models

## Core Guidelines

### State Management
| Wrapper | Use When |
|---------|----------|
| `@State` | Internal view state (private), or owned `@Observable` |
| `@Binding` | Child modifies parent's state |
| `@Bindable` | Injected `@Observable` needing bindings |
| `let` | Read-only value from parent |

- **Prefer `@Observable` over `ObservableObject`** for new code
- **Mark `@State`/`@StateObject` as `private`**
- **Never declare passed values as `@State`**

### Modern APIs
| Deprecated | Modern |
|------------|--------|
| `foregroundColor()` | `foregroundStyle()` |
| `cornerRadius()` | `clipShape(.rect(cornerRadius:))` |
| `NavigationView` | `NavigationStack` |
| `tabItem()` | `Tab` API |
| `onTapGesture()` | `Button` |
| `GeometryReader` | `containerRelativeFrame()` |

### View Composition
- **Prefer modifiers over conditional views** (maintains view identity)
- Extract complex views into subviews
- Keep `body` simple and pure (no side effects)
- Use `.task` for async work with auto-cancellation

### Performance
- Pass only needed values (avoid large config objects)
- Check for value changes before assigning state
- Use `LazyVStack`/`LazyHStack` for large lists
- Use stable identity for `ForEach` (never `.indices`)
- Avoid `AnyView` in list rows

## View Ordering

```swift
struct MyView: View {
    @Environment(\.dismiss) private var dismiss  // 1. Environment
    let item: Item                                // 2. let properties
    @State private var isLoading = false         // 3. @State
    private var isValid: Bool { ... }            // 4. Computed
    init(item: Item) { ... }                     // 5. init
    var body: some View { ... }                  // 6. body
    private var header: some View { ... }        // 7. View builders
    private func save() async { ... }            // 8. Functions
}
```

## Sheet Pattern

```swift
@State private var selectedItem: Item?

.sheet(item: $selectedItem) { item in
    EditItemSheet(item: item)  // Sheet owns its actions
}
```

## Quick Reference

| Category | References |
|----------|------------|
| **Refactor** | `view-refactor.md` (splitting, ordering, large files) |
| **State** | `state-management.md` |
| **Views** | `view-structure.md`, `mv-patterns.md` |
| **Performance** | `performance-patterns.md`, `list-patterns.md` |
| **APIs** | `modern-apis.md`, `text-formatting.md` |
| **Navigation** | `navigationstack.md`, `tabview.md`, `sheets.md` |
| **Layout** | `layout-best-practices.md`, `grids.md`, `scrollview.md` |
| **Components** | `components-index.md`, `form.md`, `controls.md` |
| **App Setup** | `app-wiring.md` |
| **iOS 26+** | `liquid-glass.md` |

## Refactor Triggers

| Signal | Action | Reference |
|--------|--------|-----------|
| File > 300 lines | Split to extensions | `view-refactor.md` |
| `body` > 50 lines | Extract subviews | `view-refactor.md` |
| Optional ViewModel | Make non-optional or remove | `view-refactor.md` |
| @ViewBuilder > 20 lines | Extract to struct | `view-structure.md` |
| 3+ responsibilities | Separate concerns | `view-refactor.md` |

## Review Checklist

- [ ] Using `@Observable` (not `ObservableObject`) for new code
- [ ] `@State`/`@StateObject` marked `private`
- [ ] Using `foregroundStyle()` (not `foregroundColor()`)
- [ ] Using `NavigationStack` (not `NavigationView`)
- [ ] Using `Button` (not `onTapGesture()`)
- [ ] ForEach uses stable identity
- [ ] Views kept small, `body` pure
- [ ] `.sheet(item:)` for model-based sheets
- [ ] No optional ViewModels
- [ ] File < 300 lines (or split)
