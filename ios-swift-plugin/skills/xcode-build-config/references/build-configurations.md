# Build Configurations

## Default Configurations

Every Xcode project starts with:
- **Debug** -- unoptimized, testability enabled, assertions active
- **Release** -- optimized, testability disabled, assertions stripped

## Adding Custom Configurations

1. Select project (not target) in navigator
2. Info tab > Configurations
3. Click "+" > Duplicate "Debug" or "Release"
4. Name it (e.g., Staging, Beta, QA)

Duplicate from:
- Debug -- for configurations that need debugger attachment and testability
- Release -- for configurations that should be optimized

## Per-Configuration Compiler Flags

Use `SWIFT_ACTIVE_COMPILATION_CONDITIONS` for compile-time checks:

```
// Base.xcconfig
SWIFT_ACTIVE_COMPILATION_CONDITIONS =

// Debug.xcconfig
SWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG

// Staging.xcconfig
SWIFT_ACTIVE_COMPILATION_CONDITIONS = STAGING

// Release.xcconfig
SWIFT_ACTIVE_COMPILATION_CONDITIONS =
```

Usage in Swift:
```swift
#if DEBUG
let apiURL = "https://api-dev.example.com"
#elseif STAGING
let apiURL = "https://api-staging.example.com"
#else
let apiURL = "https://api.example.com"
#endif
```

Prefer xcconfig-based API URLs (readable from Info.plist) over compiler flags for values that are just strings.

## Per-Configuration Bundle Identifiers

Separate installs on the same device:

```
// Debug.xcconfig
PRODUCT_BUNDLE_IDENTIFIER = com.company.app.debug

// Staging.xcconfig
PRODUCT_BUNDLE_IDENTIFIER = com.company.app.staging

// Release.xcconfig
PRODUCT_BUNDLE_IDENTIFIER = com.company.app
```

Each bundle ID needs its own App ID in the Developer Portal if using capabilities (push notifications, etc.).

## Per-Configuration App Icons

```
// Debug.xcconfig
ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon-Debug

// Staging.xcconfig
ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon-Staging

// Release.xcconfig
ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon
```

Create matching icon sets in Assets.xcassets. Add a visual indicator (banner, color overlay) for non-production icons.

## Per-Configuration Display Names

```
// Debug.xcconfig
INFOPLIST_KEY_CFBundleDisplayName = MyApp Dev

// Staging.xcconfig
INFOPLIST_KEY_CFBundleDisplayName = MyApp QA

// Release.xcconfig
INFOPLIST_KEY_CFBundleDisplayName = MyApp
```

## Schemes and Configuration Mapping

Each scheme maps actions to configurations:

| Action | Typical Configuration |
|--------|----------------------|
| Run | Debug |
| Test | Debug |
| Profile | Release |
| Analyze | Debug |
| Archive | Release (or Staging for TestFlight) |

Create separate schemes for different workflows:
- **MyApp** -- Run=Debug, Archive=Release
- **MyApp Staging** -- Run=Staging, Archive=Staging

Mark schemes as "Shared" (Manage Schemes > Shared checkbox) to commit them to version control.

## User-Defined Build Settings

Custom settings not built into Xcode:

In xcconfig:
```
API_BASE_URL = https:\/\/api.example.com
ANALYTICS_ENABLED = YES
FEATURE_FLAG_NEW_UI = NO
```

Reference in Info.plist as `$(API_BASE_URL)`.

Read in code:
```swift
guard let url = Bundle.main.object(forInfoDictionaryKey: "APIBaseURL") as? String else {
    fatalError("APIBaseURL not configured")
}
```

## Configuration to xcconfig Mapping

In Xcode project settings:

1. Select project in navigator
2. Info tab > Configurations
3. Expand each configuration
4. Set xcconfig file for project and each target

| Configuration | Project xcconfig | Target xcconfig |
|---------------|-----------------|-----------------|
| Debug | Config/Debug.xcconfig | (None or target-specific) |
| Staging | Config/Staging.xcconfig | (None or target-specific) |
| Release | Config/Release.xcconfig | (None or target-specific) |

Target-level xcconfig overrides project-level. Use project-level for shared settings, target-level only when targets need different values.

## Conditional Build Phases

Run Script phases can check the configuration:

```bash
if [ "${CONFIGURATION}" = "Release" ]; then
    # Upload dSYMs, run Crashlytics script, etc.
    "${BUILD_DIR%/Build/*}/SourcePackages/checkouts/firebase-ios-sdk/Crashlytics/run"
fi
```

Common conditional actions:
- Upload dSYMs only for Release/Staging
- Strip debug symbols only for Release
- Run SwiftLint only for Debug (faster CI builds)

## Optimization Levels

| Setting | Debug | Staging | Release |
|---------|-------|---------|---------|
| `SWIFT_OPTIMIZATION_LEVEL` | `-Onone` | `-Osize` | `-O` |
| `SWIFT_COMPILATION_MODE` | `singlefile` | `wholemodule` | `wholemodule` |
| `ENABLE_TESTABILITY` | `YES` | `NO` | `NO` |
| `DEBUG_INFORMATION_FORMAT` | `dwarf` | `dwarf-with-dsym` | `dwarf-with-dsym` |
| `GCC_OPTIMIZATION_LEVEL` | `0` | `s` | `s` |

Staging uses `-Osize` to balance performance testing with binary size. Release uses `-O` for maximum speed.
