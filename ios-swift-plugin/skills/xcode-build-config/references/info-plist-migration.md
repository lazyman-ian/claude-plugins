# Info.plist Migration

## Why Migrate

Xcode 15+ supports generating Info.plist entries from build settings. Benefits:
- Fewer merge conflicts (build settings per config vs single plist)
- Per-configuration values without scripting
- Cleaner project structure
- Build settings are diffable text in xcconfig files

## Enable Generation

Set in xcconfig or build settings:
```
GENERATE_INFOPLIST_FILE = YES
```

When enabled, Xcode generates Info.plist at build time from `INFOPLIST_KEY_*` build settings plus any remaining Info.plist file entries.

## Migration Process

1. Enable `GENERATE_INFOPLIST_FILE = YES`
2. Move supported keys to build settings (see table below)
3. Remove migrated keys from Info.plist
4. Keep keys that require complex values in Info.plist
5. Set `INFOPLIST_FILE` to the (now smaller) Info.plist path, or remove it if empty

## Keys That Can Move to Build Settings

| Info.plist Key | Build Setting |
|---------------|---------------|
| CFBundleDisplayName | `INFOPLIST_KEY_CFBundleDisplayName` |
| CFBundleShortVersionString | `MARKETING_VERSION` |
| CFBundleVersion | `CURRENT_PROJECT_VERSION` |
| UILaunchScreen | `INFOPLIST_KEY_UILaunchScreen_Generation = YES` |
| UISupportedInterfaceOrientations | `INFOPLIST_KEY_UISupportedInterfaceOrientations_iPhone` |
| UIStatusBarStyle | `INFOPLIST_KEY_UIStatusBarStyle` |
| LSApplicationCategoryType | `INFOPLIST_KEY_LSApplicationCategoryType` |
| NSHumanReadableCopyright | `INFOPLIST_KEY_NSHumanReadableCopyright` |
| UIApplicationSceneManifest | `INFOPLIST_KEY_UIApplicationSceneManifest_Generation = YES` |
| UIApplicationSupportsIndirectInputEvents | `INFOPLIST_KEY_UIApplicationSupportsIndirectInputEvents` |

## Keys That Must Stay in Info.plist

- Custom URL schemes (`CFBundleURLTypes`)
- App Transport Security (`NSAppTransportSecurity`)
- Exported/Imported UTIs (`UTExportedTypeDeclarations`)
- Complex dictionary values
- Document types (`CFBundleDocumentTypes`)
- Background modes (`UIBackgroundModes`) -- unless using capability auto-generation
- Custom keys not matching `INFOPLIST_KEY_*` pattern

## Privacy Usage Descriptions

Privacy keys work as build settings:
```
INFOPLIST_KEY_NSCameraUsageDescription = This app uses the camera to scan documents
INFOPLIST_KEY_NSLocationWhenInUseUsageDescription = This app uses location to show nearby listings
INFOPLIST_KEY_NSPhotoLibraryUsageDescription = This app accesses photos for your profile picture
```

## Privacy Manifest (PrivacyInfo.xcprivacy)

Starting 2024, apps must declare:
- Required Reason APIs (accessing device signals like disk space, user defaults, file timestamps)
- Tracking domains
- Data collection types
- Data use purposes

Create `PrivacyInfo.xcprivacy` in your target:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>NSPrivacyAccessedAPITypes</key>
    <array>
        <dict>
            <key>NSPrivacyAccessedAPIType</key>
            <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
            <key>NSPrivacyAccessedAPITypeReasons</key>
            <array>
                <string>CA92.1</string>
            </array>
        </dict>
    </array>
    <key>NSPrivacyTracking</key>
    <false/>
    <key>NSPrivacyTrackingDomains</key>
    <array/>
    <key>NSPrivacyCollectedDataTypes</key>
    <array/>
</dict>
</plist>
```

Required Reason API categories:
- `NSPrivacyAccessedAPICategoryFileTimestamp` -- file creation/modification dates
- `NSPrivacyAccessedAPICategorySystemBootTime` -- `ProcessInfo.processInfo.systemUptime`
- `NSPrivacyAccessedAPICategoryDiskSpace` -- `FileManager` volume capacity
- `NSPrivacyAccessedAPICategoryUserDefaults` -- `UserDefaults`
- `NSPrivacyAccessedAPICategoryActiveKeyboards` -- installed keyboard list

Third-party SDKs must also include their own privacy manifests. Check SDK documentation for their declarations.

## Versioning via Build Settings

Instead of editing Info.plist for version bumps:
```
MARKETING_VERSION = 2.1.0
CURRENT_PROJECT_VERSION = 42
```

Reference in Info.plist (if still present):
```xml
<key>CFBundleShortVersionString</key>
<string>$(MARKETING_VERSION)</string>
<key>CFBundleVersion</key>
<string>$(CURRENT_PROJECT_VERSION)</string>
```

Bump from command line:
```bash
agvtool new-marketing-version 2.2.0
agvtool new-version -all 43
```
