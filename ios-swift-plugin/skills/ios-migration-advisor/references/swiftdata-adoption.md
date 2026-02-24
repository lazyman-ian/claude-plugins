# SwiftData Adoption Guide

Requires iOS 17+. For iOS 15-16, continue with Core Data.

## Decision: SwiftData vs Core Data

| Factor | SwiftData | Core Data |
|--------|-----------|-----------|
| New project (iOS 17+) | Preferred | Only if needing advanced features |
| Existing Core Data app | Coexist or gradual migration | Keep maintaining |
| CloudKit sync | Supported (with limitations) | More mature, fewer restrictions |
| Batch operations | Not yet supported | Supported |
| Complex predicates | Limited | Full NSPredicate |
| Performance | SQLite > Core Data > SwiftData | Better raw performance |
| Boilerplate | Minimal (macros) | Significant |
| Unique constraints | Supported (iOS 17+) | Supported |
| Undo/redo | Not built-in | Built-in |

**Rule of thumb:** New project + simple models → SwiftData. Complex data layer or iOS <17 → Core Data.

## SwiftData Fundamentals

### Model Definition

```swift
import SwiftData

@Model
class Item {
    var name: String
    var timestamp: Date
    var category: Category?  // Optional relationship

    init(name: String, timestamp: Date = .now) {
        self.name = name
        self.timestamp = timestamp
    }
}
```

### Safe Data Types

Use only these in @Model properties:

| Safe | Risky | Avoid |
|------|-------|-------|
| String, Int, Double, Float | Custom Codable structs (can't modify later) | Complex nested Codable |
| Bool, Date, URL, UUID, Data | Enum with raw value | Enum with associated values |
| Optional of above | Array of basic types | Dictionary with custom keys |
| Relationships (@Model) | - | Transformable |

### Container Setup

```swift
@main
struct MyApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .modelContainer(for: [Item.self, Category.self])
    }
}
```

## Critical Pitfalls

### Pitfall 1: Custom Codable Types Are Frozen

Once deployed with iCloud sync, custom Codable properties cannot be changed without breaking migration.

```swift
// DANGEROUS: Can't add fields later if using CloudKit
@Model class Item {
    var metadata: CustomMetadata  // Codable struct — frozen schema
}

// SAFER: Use basic types
@Model class Item {
    var metadataJSON: Data?  // Parse/serialize manually
}
```

### Pitfall 2: Cloud Sync Is NOT Real-Time

- Apple adjusts sync frequency based on network, battery, user settings
- Don't design UX assuming instant cross-device sync
- No partial sync — all or nothing per model container

### Pitfall 3: iCloud Account Switching Clears Data

When user switches iCloud accounts, **local data for the original account is cleared** and replaced with new account's data. No merge.

### Pitfall 4: Cloud Sync Migration Lock

Once cloud sync is enabled:
- Cannot use unique constraints
- Cannot use deny delete rules
- Cannot make relationships non-optional
- Any schema change must be lightweight-migration compatible

### Pitfall 5: Relationship Property in init()

```swift
// BUG: SwiftData creates object before inserting into context
@Model class Parent {
    var child: Child

    init(child: Child) {
        self.child = child  // Child has no context yet → crash or corruption
    }
}

// FIX: Make relationship optional, assign after insertion
@Model class Parent {
    var child: Child?

    init() { }
}
// Then: parent.child = child (after both are in context)
```

## Schema Versioning

```swift
enum SchemaV1: VersionedSchema {
    static var versionIdentifier = Schema.Version(1, 0, 0)
    static var models: [any PersistentModel.Type] { [Item.self] }

    @Model class Item {
        var name: String
        init(name: String) { self.name = name }
    }
}

enum SchemaV2: VersionedSchema {
    static var versionIdentifier = Schema.Version(2, 0, 0)
    static var models: [any PersistentModel.Type] { [Item.self] }

    @Model class Item {
        var name: String
        var category: String?  // Added field
        init(name: String) { self.name = name }
    }
}

enum ItemMigrationPlan: SchemaMigrationPlan {
    static var schemas: [any VersionedSchema.Type] { [SchemaV1.self, SchemaV2.self] }
    static var stages: [MigrationStage] {
        [.lightweight(fromVersion: SchemaV1.self, toVersion: SchemaV2.self)]
    }
}
```

**Lightweight migration handles:** Adding/removing properties, renaming, changing optionality (to optional).
**Custom migration needed:** Data transformation, splitting/merging models.

## Core Data Coexistence

For gradual migration, both can share the same SQLite store:

1. Namespace model classes to avoid collision
2. Use `NSPersistentContainer` for Core Data, `ModelContainer` for SwiftData
3. Point both at the same store URL
4. Migrate one entity at a time

```swift
// SwiftData container sharing Core Data store
let url = NSPersistentContainer.defaultDirectoryURL()
    .appending(path: "Model.sqlite")
let config = ModelConfiguration(url: url)
let container = try ModelContainer(for: NewModel.self, configurations: config)
```

## iOS Version Strategy

| Target | Approach |
|--------|----------|
| iOS 15-16 only | Core Data only |
| iOS 15+ with iOS 17 path | Core Data now, SwiftData for new models behind `if #available` |
| iOS 17+ only | SwiftData for new, coexist with existing Core Data |
| New project iOS 17+ | SwiftData from start |

## Sources

- [东坡肘子: Key Considerations Before Using SwiftData](https://fatbobman.com/en/posts/key-considerations-before-using-swiftdata/)
- [Michael Tsai: SwiftData at WWDC25](https://mjtsai.com/blog/2025/06/19/swiftdata-and-core-data-at-wwdc25/)
- [Apple: Migrate to SwiftData (WWDC23)](https://developer.apple.com/videos/play/wwdc2023/10189/)
- [Donny Wals: SwiftData Migrations](https://www.donnywals.com/)
