# Concurrency Guard Rules

Deterministic blocking rules for Swift Concurrency anti-patterns that **compilers cannot catch**.

## Quick Reference

| Rule | Issue | Severity |
|------|-------|----------|
| CC-CONC-001 | Task.detached usage | BLOCK |
| CC-CONC-002 | Task in init | BLOCK |
| CC-CONC-003 | Async in render path | BLOCK |
| CC-CONC-004 | Stream cancel safety | BLOCK |
| CC-CONC-005 | Thundering herd (function) | BLOCK |
| CC-CONC-007 | Blocking IO on MainActor | BLOCK |
| CC-CONC-008 | .background for loops | BLOCK |
| CC-CONC-009 | View .task direct load | BLOCK |
| CC-CONC-010 | Auth without choke point | BLOCK |
| CC-CONC-011 | Startup without phase gate | BLOCK |

---

## Blocker Rules

### CC-CONC-001: No Task.detached

**Problem**: Unstructured tasks cause priority inversions and are hard to cancel.

**Detection**:
```swift
// BLOCKED
Task.detached {
    await heavyWork()
}
```

**Fix**:
```swift
// Store handle for cancellation
private var workTask: Task<Void, Never>?

func startWork() {
    workTask = Task {
        await heavyWork()
    }
}

deinit {
    workTask?.cancel()
}
```

---

### CC-CONC-002: No Task in init

**Problem**: Actor hops during synchronous initialization trigger launch hangs.

**Applies to**: App, Scene, AppShellState, ViewModels, Coordinators, Services

**Detection**:
```swift
// BLOCKED
class ViewModel {
    init() {
        Task { await loadData() }  // Actor hop in init
    }
}
```

**Fix**:
```swift
class ViewModel {
    init() {
        // Keep init lightweight
    }

    func start() async {
        await loadData()
    }
}

// In SwiftUI
.task { await vm.start() }
```

---

### CC-CONC-003: No Async in Render/Layout Paths

**Problem**: Task spawning during rendering causes transaction commit hangs.

**Detection** (forbidden locations):
- `var body: some View { }` builder
- `layoutSubviews()`
- `updateUIView()` / `updateNSView()`
- `draw(_:)`

```swift
// BLOCKED
var body: some View {
    VStack {
        Task { await load() }  // In body builder!
    }
}
```

**Fix**:
```swift
var body: some View {
    VStack { ... }
        .task { await load() }  // Outside body builder
}
```

---

### CC-CONC-004: Streams Must Be Cancel-Safe

**Problem**: Unmanaged tasks within cancelled streams leak and cause unbounded growth.

**Detection**:
```swift
// BLOCKED - no termination handler
AsyncStream { continuation in
    Task {
        for item in items {
            continuation.yield(item)
        }
    }
}
```

**Fix**:
```swift
AsyncStream { continuation in
    let task = Task {
        for item in items {
            try Task.checkCancellation()
            continuation.yield(item)
        }
    }

    continuation.onTermination = { _ in
        task.cancel()
    }
}
```

---

### CC-CONC-005: No Thundering Herd (Function Level)

**Problem**: Executor starvation + actor contention from 9+ parallel loads.

**Limits**:
- Max 3 `Task {}` per function
- Max 4 `group.addTask` calls

**Detection**:
```swift
// BLOCKED - 5 parallel tasks
func loadAll() {
    Task { await load1() }
    Task { await load2() }
    Task { await load3() }
    Task { await load4() }
    Task { await load5() }
}
```

**Fix**:
```swift
func loadAll() async {
    // Max-parallel pump (3-4 concurrent)
    await withTaskGroup(of: Void.self) { group in
        var pending = items[...]

        // Start initial batch
        for _ in 0..<3 {
            guard let item = pending.popFirst() else { break }
            group.addTask { await load(item) }
        }

        // Replenish as tasks complete
        for await _ in group {
            if let item = pending.popFirst() {
                group.addTask { await load(item) }
            }
        }
    }
}
```

---

### CC-CONC-007: No Blocking IO on @MainActor

**Problem**: Synchronous I/O operations block UI thread.

**Forbidden operations in @MainActor context**:
- `JSONDecoder().decode()`
- `SecItemCopyMatching()`
- `Data(contentsOf:)`
- `FileManager` write operations

**Detection**:
```swift
// BLOCKED
@MainActor
class ViewModel {
    func load() {
        let data = try! Data(contentsOf: url)  // Blocking on main!
    }
}
```

**Fix**:
```swift
@MainActor
class ViewModel {
    func load() async {
        let data = await Task.detached(priority: .utility) {
            try Data(contentsOf: url)
        }.value
    }
}
```

---

### CC-CONC-008: No .background for Long-Lived Loops

**Problem**: Background-priority tasks with loops starve higher-priority work.

**Detection**:
```swift
// BLOCKED
Task(priority: .background) {
    for await event in eventStream {
        handle(event)
    }
}
```

**Fix**:
```swift
// Elevate to .utility
Task(priority: .utility) {
    for await event in eventStream {
        // Keep handler cheap
        await actor.enqueue(event)
    }
}
```

---

## Systemic Thundering Herd Prevention

### CC-CONC-009: View .task Must Not Directly Trigger Network

**Problem**: 24+ SwiftUI views each with `.task { await vm.load() }` creates thundering herd.

**Detection**:
```swift
// BLOCKED
.task {
    await viewModel.loadData()  // Direct network call
}
```

**Fix**:
```swift
// Route through orchestrator
.task {
    await loadOrchestrator.ensure(.userData)
}

// Or phase gate
.task {
    await phaseGate.waitUntil(.dataReady)
    // Then use cached data
}
```

---

### CC-CONC-010: Auth Through Single Choke Point

**Problem**: Multiple call sites hitting auth provider cause concurrent token refresh storms.

**Detection**:
```swift
// BLOCKED - direct auth call outside allowlist
let token = await tokenProvider.getToken()
```

**Fix**:
```swift
// All auth through APIClient
let response = await apiClient.requestAuthed(endpoint)
```

---

### CC-CONC-011: Startup Services Must Be Phase-Gated

**Problem**: Eager initialization of watchers/reconnection loops causes contention.

**Detection**:
```swift
// BLOCKED
class AppShellState {
    init() {
        startWatcher()           // Forbidden in init
        installObserver()        // Forbidden in init
        refreshPeriodically()    // Forbidden in init
    }
}
```

**Fix**:
```swift
class AppShellState {
    init() {
        // Keep init lightweight - no async work
    }

    func bootstrap() async {
        await phaseGate.waitUntil(.coreReady)
        startWatcher()
        installObserver()
    }
}
```

---

## Self-Check Before Commit

When editing Swift concurrency code, verify:

- [ ] No `Task.detached` (use structured Task with stored handle)
- [ ] No `Task {}` in `init()` (defer to `.task` or `start()`)
- [ ] No async in `body` builder (use `.task` modifier)
- [ ] AsyncStream has `onTermination` handler
- [ ] Max 3 parallel tasks per function
- [ ] No blocking IO on @MainActor
- [ ] No `.background` priority for `for await` loops
- [ ] Network loads go through orchestrator, not direct `.task`
- [ ] Auth through single choke point
- [ ] Startup work in `bootstrap()`, not `init()`
