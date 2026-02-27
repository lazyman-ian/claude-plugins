---
name: xcode-build-config
description: Provides best practices for Xcode project configuration including .xcconfig files, Info.plist migration, build configurations, code signing, and capabilities setup. This skill should be used when setting up build environments, configuring signing, managing Info.plist keys, or creating custom build configurations. Triggers on "xcconfig", "Info.plist", "build settings", "code signing", "provisioning profile", "capabilities", "entitlements", "build configuration", "Xcode 配置", "签名", "构建设置", "环境配置". Do NOT use for Swift code patterns — use swiftui-expert or swift-concurrency instead.
memory: project
allowed-tools: [Read, Glob, Grep, Edit, Write, Bash, mcp__xcode__*]
---

# Xcode Build Config

Configure Xcode projects with xcconfig files, build configurations, code signing, and capabilities.

## Workflow

### 1) Audit Existing Config
- Check xcconfig files → `references/xcconfig-best-practices.md`
- Check Info.plist setup → `references/info-plist-migration.md`
- Check build configurations → `references/build-configurations.md`
- Check signing → `references/code-signing-guide.md`
- Check entitlements → `references/capabilities-entitlements.md`

### 2) Set Up Build Environments
- Create xcconfig hierarchy (Base + per-environment)
- Map configurations to xcconfig files in project settings
- Define environment-specific values (API URLs, bundle IDs)

### 3) Configure Signing and Capabilities
- Choose automatic vs manual signing
- Set up entitlements file
- Enable required capabilities in target

## .xcconfig File Organization

```
Config/
├── Base.xcconfig           // Shared settings
├── Debug.xcconfig          // #include "Base.xcconfig"
├── Release.xcconfig        // #include "Base.xcconfig"
└── Staging.xcconfig        // #include "Base.xcconfig"
```

Each environment file includes Base and overrides only what differs:

```
// Debug.xcconfig
#include "Base.xcconfig"

SWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG
PRODUCT_BUNDLE_IDENTIFIER = com.company.app.debug
API_BASE_URL = https:\/\/api-dev.example.com
```

Key rules:
- Always include `$(inherited)` in search path settings
- Use `#include` (not `#import`) for xcconfig includes
- Variable substitution: `$(PRODUCT_NAME)`, `$(inherited)`

## Info.plist Migration

Xcode 15+ can generate Info.plist from build settings. Set `GENERATE_INFOPLIST_FILE = YES` and move keys to `INFOPLIST_KEY_*` build settings.

| Can Move to Build Settings | Must Stay in Info.plist |
|---------------------------|------------------------|
| CFBundleDisplayName | Custom URL schemes |
| UILaunchScreen | Complex dictionaries |
| UISupportedInterfaceOrientations | App Transport Security |
| CFBundleShortVersionString | Exported/Imported UTIs |

See `references/info-plist-migration.md` for step-by-step process and privacy manifest requirements.

## Build Configurations

| Configuration | Optimization | Signing | Bundle ID Suffix | Use |
|---------------|-------------|---------|-------------------|-----|
| Debug | None (-Onone) | Automatic | `.debug` | Local development |
| Staging | Size (-Osize) | Manual | `.staging` | QA / beta testing |
| Release | Speed (-O) | Manual | (none) | App Store |

Add custom configurations via Project > Info > Configurations. Map each to an xcconfig file.

Key per-config settings:
- `SWIFT_ACTIVE_COMPILATION_CONDITIONS`: feature flags
- `PRODUCT_BUNDLE_IDENTIFIER`: separate installs per environment
- `ASSETCATALOG_COMPILER_APPICON_NAME`: different app icons

See `references/build-configurations.md` for schemes, user-defined settings, and conditional build phases.

## Code Signing Decision Tree

| Scenario | Identity | Provisioning Profile |
|----------|----------|---------------------|
| Development | Apple Development | Automatic |
| Ad Hoc | Apple Distribution | Manual |
| App Store | Apple Distribution | Manual |
| Enterprise | Apple In-House | Manual |

Automatic signing works for development. Switch to manual for distribution builds or CI/CD.

CI/CD signing options:
- fastlane match (recommended for teams)
- Manual certificate + profile installation
- xcodebuild flags: `CODE_SIGN_IDENTITY`, `PROVISIONING_PROFILE_SPECIFIER`

See `references/code-signing-guide.md` for troubleshooting and App Store Connect API keys.

## Common Pitfalls

| Pitfall | Fix |
|---------|-----|
| Missing `$(inherited)` | Always include in `FRAMEWORK_SEARCH_PATHS`, `OTHER_LDFLAGS`, etc. |
| URL scheme with `://` in xcconfig | Escape as `:\/\/` (forward slashes need backslash) |
| Info.plist not found after migration | Set `INFOPLIST_FILE` build setting to correct path |
| Wrong config for Archive | Check scheme > Archive > Build Configuration |
| Signing cert expired | Revoke in Developer Portal, re-download in Xcode |
| Profile/entitlements mismatch | Regenerate profile after adding capabilities |
| CocoaPods overrides xcconfig | Add `#include "Pods/Target Support Files/..."` in your xcconfig |
| `$(inherited)` in wrong position | Place at beginning for search paths, end for flags |

## Capabilities Setup

When adding a capability:

1. Enable in Xcode: Target > Signing & Capabilities > + Capability
2. Verify entitlements file is created/updated (`.entitlements`)
3. Enable matching capability in Apple Developer Portal (App ID)
4. Regenerate provisioning profiles if using manual signing
5. Test on device (some capabilities require device, not simulator)

Common capabilities: Push Notifications, Sign in with Apple, iCloud, App Groups, Associated Domains, Background Modes.

See `references/capabilities-entitlements.md` for per-capability setup details.

## Quick Reference

| Category | Reference |
|----------|-----------|
| **xcconfig** | `xcconfig-best-practices.md` |
| **Info.plist** | `info-plist-migration.md` |
| **Configurations** | `build-configurations.md` |
| **Signing** | `code-signing-guide.md` |
| **Capabilities** | `capabilities-entitlements.md` |

## Review Checklist

- [ ] xcconfig hierarchy: Base + per-environment
- [ ] `$(inherited)` present in all search path settings
- [ ] Info.plist keys migrated where possible
- [ ] Privacy manifest (PrivacyInfo.xcprivacy) present if using required reason APIs
- [ ] Each build configuration mapped to correct xcconfig
- [ ] Signing identity and profile match distribution method
- [ ] Entitlements file matches enabled capabilities
- [ ] Scheme configurations correct (Run=Debug, Archive=Release)
