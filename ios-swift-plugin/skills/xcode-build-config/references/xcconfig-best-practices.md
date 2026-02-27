# .xcconfig Best Practices

## File Syntax

```
// Comment
KEY = value
KEY = value with spaces
KEY[config=Debug] = debug-only-value
KEY[sdk=iphonesimulator*] = sim-value
KEY[platform=ios] = ios-value
#include "Other.xcconfig"
```

Rules:
- One setting per line
- No quotes around values (quotes become part of the value)
- `//` for comments (C-style, not `#`)
- `#include` for file inclusion (not `#import`)
- No trailing semicolons

## Variable Substitution

```
PRODUCT_BUNDLE_IDENTIFIER = com.company.$(PRODUCT_NAME:rfc1034identifier)
OTHER_LDFLAGS = $(inherited) -framework UIKit
FRAMEWORK_SEARCH_PATHS = $(inherited) $(SRCROOT)/Frameworks
```

| Syntax | Meaning |
|--------|---------|
| `$(VAR)` | Substitute variable value |
| `$(inherited)` | Inherit from higher-level setting |
| `$(VAR:rfc1034identifier)` | Transform to DNS-safe identifier |
| `$()` | Empty value (clear a setting) |

## Conditional Settings

```
// Per configuration
SWIFT_OPTIMIZATION_LEVEL[config=Debug] = -Onone
SWIFT_OPTIMIZATION_LEVEL[config=Release] = -O

// Per SDK
EXCLUDED_ARCHS[sdk=iphonesimulator*] = arm64
SUPPORTED_PLATFORMS[sdk=iphoneos*] = iphoneos

// Per platform (Xcode 15+)
SUPPORTED_PLATFORMS[platform=ios] = iphoneos iphonesimulator
SUPPORTS_MACCATALYST[platform=macos] = NO
```

Multiple conditions can combine:
```
OTHER_LDFLAGS[config=Debug][sdk=iphonesimulator*] = $(inherited) -framework XCTest
```

## Layering and Precedence

Settings resolve in this order (last wins):

1. Platform defaults (Xcode built-in)
2. Project-level xcconfig file
3. Project-level build settings (UI)
4. Target-level xcconfig file
5. Target-level build settings (UI)

UI settings override xcconfig. To use xcconfig exclusively, delete the corresponding setting from the Xcode Build Settings UI (select row, press Delete).

## Recommended Hierarchy

```
Config/
├── Base.xcconfig
├── Debug.xcconfig
├── Release.xcconfig
└── Staging.xcconfig
```

### Base.xcconfig
```
IPHONEOS_DEPLOYMENT_TARGET = 16.0
SWIFT_VERSION = 5.9
TARGETED_DEVICE_FAMILY = 1,2
ENABLE_BITCODE = NO
SWIFT_STRICT_CONCURRENCY = complete

CODE_SIGN_STYLE = Automatic
DEVELOPMENT_TEAM = XXXXXXXXXX
```

### Debug.xcconfig
```
#include "Base.xcconfig"

SWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG
SWIFT_OPTIMIZATION_LEVEL = -Onone
ENABLE_TESTABILITY = YES
PRODUCT_BUNDLE_IDENTIFIER = com.company.app.debug
API_BASE_URL = https:\/\/api-dev.example.com
```

### Release.xcconfig
```
#include "Base.xcconfig"

SWIFT_ACTIVE_COMPILATION_CONDITIONS =
SWIFT_OPTIMIZATION_LEVEL = -O
ENABLE_TESTABILITY = NO
PRODUCT_BUNDLE_IDENTIFIER = com.company.app
API_BASE_URL = https:\/\/api.example.com
CODE_SIGN_STYLE = Manual
PROVISIONING_PROFILE_SPECIFIER = App Store Profile
```

## Environment-Specific API URLs

Define in xcconfig:
```
API_BASE_URL = https:\/\/api-dev.example.com
```

Reference in Info.plist:
```xml
<key>APIBaseURL</key>
<string>$(API_BASE_URL)</string>
```

Read in code:
```swift
let url = Bundle.main.object(forInfoDictionaryKey: "APIBaseURL") as? String
```

Forward slashes in URLs must be escaped as `\/` in xcconfig files.

## Common Settings Reference

| Setting | Purpose | Example |
|---------|---------|---------|
| `SWIFT_VERSION` | Swift language version | `5.9` |
| `IPHONEOS_DEPLOYMENT_TARGET` | Minimum iOS version | `16.0` |
| `PRODUCT_BUNDLE_IDENTIFIER` | App bundle ID | `com.company.app` |
| `TARGETED_DEVICE_FAMILY` | Device types | `1,2` (iPhone, iPad) |
| `SWIFT_ACTIVE_COMPILATION_CONDITIONS` | Compiler flags | `DEBUG STAGING` |
| `OTHER_SWIFT_FLAGS` | Additional Swift flags | `-enable-bare-slash-regex` |
| `DEVELOPMENT_TEAM` | Team ID | `XXXXXXXXXX` |
| `CODE_SIGN_IDENTITY` | Signing certificate | `Apple Development` |
| `ASSETCATALOG_COMPILER_APPICON_NAME` | App icon set name | `AppIcon` |

## Common Mistakes

| Mistake | Problem | Fix |
|---------|---------|-----|
| Space in `#include` path | Build error | `#include "Sub Dir/File.xcconfig"` works, but avoid spaces in paths |
| Missing `$(inherited)` | Breaks CocoaPods/SPM flags | Always include for `OTHER_LDFLAGS`, `FRAMEWORK_SEARCH_PATHS`, `HEADER_SEARCH_PATHS` |
| Circular `#include` | Silent infinite loop | Ensure A includes B but B does not include A |
| Quotes around values | Quotes become literal | `KEY = value` not `KEY = "value"` |
| Setting in both UI and xcconfig | UI silently overrides xcconfig | Delete the row in Build Settings UI |
| Trailing whitespace | Value includes whitespace | Trim trailing spaces |

## CocoaPods Integration

CocoaPods generates xcconfig files. Include them in your xcconfig:

```
#include "Pods/Target Support Files/Pods-MyApp/Pods-MyApp.debug.xcconfig"

// Your overrides below
SWIFT_VERSION = 5.9
```

After `pod install`, check that your xcconfig still references the Pods xcconfig. CocoaPods warns if the project-level xcconfig doesn't include the generated one.

SPM does not generate xcconfig files. SPM linker flags are managed by Xcode automatically.
