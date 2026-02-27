# Capabilities and Entitlements

## How Capabilities Work

```
Xcode Target
  > Signing & Capabilities
    > + Capability
      1. Adds entry to .entitlements file
      2. Enables capability on App ID in Developer Portal (automatic signing)
      3. Regenerates provisioning profile
```

For manual signing, step 2 must be done manually in the Developer Portal, and profiles must be re-downloaded.

## Entitlements File Structure

The `.entitlements` file is a plist:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>aps-environment</key>
    <string>development</string>
    <key>com.apple.developer.applesignin</key>
    <array>
        <string>Default</string>
    </array>
</dict>
</plist>
```

Build setting: `CODE_SIGN_ENTITLEMENTS = MyApp/MyApp.entitlements`

## Common Capabilities

### Push Notifications

Entitlements key: `aps-environment`

Setup:
1. Enable Push Notifications capability in Xcode
2. Create APNs key in Developer Portal (Keys section) or APNs certificate
3. Configure server with APNs key (.p8 file) -- key works for all apps in the team
4. Request permission in code:

```swift
UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
    // Handle
}
UIApplication.shared.registerForRemoteNotifications()
```

The entitlements file has `development` for debug and `production` for release. Xcode manages this automatically with separate entitlements or build settings.

### Sign in with Apple

Entitlements key: `com.apple.developer.applesignin`

Setup:
1. Enable Sign in with Apple capability
2. Add Sign in with Apple to your App ID in Developer Portal
3. Configure Services ID if using web-based sign-in

```swift
import AuthenticationServices

let request = ASAuthorizationAppleIDProvider().createRequest()
request.requestedScopes = [.fullName, .email]
let controller = ASAuthorizationController(authorizationRequests: [request])
controller.delegate = self
controller.performRequests()
```

### iCloud

Entitlements keys:
- `com.apple.developer.icloud-services` -- CloudKit, Key-Value Storage
- `com.apple.developer.icloud-container-identifiers` -- container IDs
- `com.apple.developer.ubiquity-kvstore-identifier` -- KV store ID

CloudKit setup:
1. Enable iCloud capability, check CloudKit
2. Create CloudKit container (iCloud.com.company.app)
3. Define schema in CloudKit Dashboard
4. Use `CKContainer.default()` in code

Key-Value Storage:
1. Enable iCloud capability, check Key-Value Storage
2. Use `NSUbiquitousKeyValueStore.default` in code
3. Observe `NSUbiquitousKeyValueStore.didChangeExternallyNotification`

### App Groups

Entitlements key: `com.apple.security.application-groups`

Setup:
1. Enable App Groups capability
2. Add group identifier (format: `group.com.company.app`)
3. Enable same group on all targets that share data (app, extension, widget)

```swift
// Shared UserDefaults
let defaults = UserDefaults(suiteName: "group.com.company.app")

// Shared file storage
let containerURL = FileManager.default.containerURL(
    forSecurityApplicationGroupIdentifier: "group.com.company.app"
)
```

### Associated Domains (Universal Links)

Entitlements key: `com.apple.developer.associated-domains`

Setup:
1. Enable Associated Domains capability
2. Add domain: `applinks:example.com`
3. Host `apple-app-site-association` file on your server at `https://example.com/.well-known/apple-app-site-association`

```json
{
    "applinks": {
        "apps": [],
        "details": [{
            "appIDs": ["TEAMID.com.company.app"],
            "paths": ["/product/*", "/user/*"]
        }]
    }
}
```

4. Handle in app:

```swift
func application(_ application: UIApplication,
                 continue userActivity: NSUserActivity,
                 restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
    guard userActivity.activityType == NSUserActivityTypeBrowsingWeb,
          let url = userActivity.webpageURL else { return false }
    // Route URL
    return true
}
```

### Background Modes

Entitlements key: `com.apple.developer.background-modes` (via UIBackgroundModes in Info.plist)

Common modes:
- `audio` -- music/podcast playback
- `fetch` -- background fetch (deprecated, use BGAppRefreshTask)
- `processing` -- BGProcessingTask for heavy work
- `remote-notification` -- silent push triggers background work
- `location` -- continuous location updates

```swift
// Register background tasks
BGTaskScheduler.shared.register(forTaskWithIdentifier: "com.company.app.refresh", using: nil) { task in
    handleAppRefresh(task: task as! BGAppRefreshTask)
}
```

### In-App Purchase

Entitlements key: `com.apple.developer.in-app-payments`

Setup:
1. Enable In-App Purchase capability
2. Create products in App Store Connect
3. Use StoreKit 2 API:

```swift
let products = try await Product.products(for: ["com.company.app.premium"])
if let product = products.first {
    let result = try await product.purchase()
}
```

## Per-Target Entitlements

Different targets (app, widget extension, notification extension) need separate entitlements files:

| Target | Entitlements File | Typical Capabilities |
|--------|-------------------|---------------------|
| Main App | MyApp.entitlements | All capabilities |
| Widget Extension | WidgetExtension.entitlements | App Groups |
| Notification Extension | NotificationExtension.entitlements | App Groups |
| Share Extension | ShareExtension.entitlements | App Groups |

Set per-target: `CODE_SIGN_ENTITLEMENTS = Extensions/Widget/Widget.entitlements`

Shared capabilities (like App Groups) must be enabled on all participating targets with the same group identifier.

## Debugging Entitlements

```bash
# View entitlements of a built app
codesign -d --entitlements - MyApp.app

# View entitlements of a provisioning profile
security cms -D -i profile.mobileprovision | xmllint --xpath "//key[text()='Entitlements']/following-sibling::dict[1]" -

# Verify profile contains required entitlements
security cms -D -i profile.mobileprovision
```

## Simulator vs Device

| Capability | Simulator | Device |
|-----------|-----------|--------|
| Push Notifications | Limited (iOS 16+ simulated) | Full |
| Sign in with Apple | Works | Works |
| iCloud | Works (with signed-in account) | Works |
| App Groups | Works | Works |
| Associated Domains | Does not work | Works |
| Background Modes | Limited | Full |
| In-App Purchase | StoreKit Testing | Full |

Use StoreKit Configuration File (.storekit) for testing purchases in simulator and Xcode previews.
