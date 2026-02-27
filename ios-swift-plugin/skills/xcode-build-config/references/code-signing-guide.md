# Code Signing Guide

## Core Concepts

| Concept | What It Is | Where It Lives |
|---------|-----------|----------------|
| Signing Certificate | Identity (public + private key) | Keychain Access |
| Provisioning Profile | Bundle ID + Certificate + Device IDs + Entitlements | ~/Library/MobileDevice/Provisioning Profiles/ |
| Entitlements | App capability declarations | .entitlements file in project |
| App ID | Bundle ID registered with Apple | Apple Developer Portal |
| Team ID | 10-character team identifier | Developer account |

A signed app = code signature (from certificate) + embedded provisioning profile (authorizing the app to run).

## Automatic vs Manual Signing

| Aspect | Automatic | Manual |
|--------|-----------|--------|
| Profile management | Xcode handles | You download/select |
| Certificate management | Xcode handles | You install manually |
| Device registration | Xcode registers | You add in portal |
| Best for | Development | Distribution, CI/CD |
| Build setting | `CODE_SIGN_STYLE = Automatic` | `CODE_SIGN_STYLE = Manual` |

Use automatic for development. Switch to manual for distribution or CI/CD where Xcode cannot manage profiles interactively.

## Development Workflow

1. Set `CODE_SIGN_STYLE = Automatic` and `DEVELOPMENT_TEAM = XXXXXXXXXX`
2. Xcode creates/downloads an Apple Development certificate
3. Xcode generates a provisioning profile matching your bundle ID and device
4. Build and run on device

No manual steps needed for development with automatic signing.

## Distribution Signing

### Ad Hoc (TestFlight alternative, direct install)
```
CODE_SIGN_STYLE = Manual
CODE_SIGN_IDENTITY = Apple Distribution
PROVISIONING_PROFILE_SPECIFIER = MyApp Ad Hoc Profile
```

### App Store
```
CODE_SIGN_STYLE = Manual
CODE_SIGN_IDENTITY = Apple Distribution
PROVISIONING_PROFILE_SPECIFIER = MyApp App Store Profile
```

### Enterprise (In-House)
```
CODE_SIGN_STYLE = Manual
CODE_SIGN_IDENTITY = Apple Distribution
PROVISIONING_PROFILE_SPECIFIER = MyApp Enterprise Profile
```

## CI/CD Signing

### Option 1: fastlane match (recommended for teams)

match stores certificates and profiles in a git repo or cloud storage, shared across the team.

```ruby
# Matchfile
git_url("https://github.com/company/certificates")
type("appstore")
app_identifier("com.company.app")
```

```bash
fastlane match appstore --readonly
```

CI environment variables:
```
MATCH_PASSWORD=encryption-password
MATCH_GIT_BASIC_AUTHORIZATION=base64-encoded-token
```

### Option 2: Manual certificate installation

```bash
# Import certificate to temporary keychain
security create-keychain -p "" build.keychain
security default-keychain -s build.keychain
security unlock-keychain -p "" build.keychain
security import certificate.p12 -k build.keychain -P "$CERT_PASSWORD" -T /usr/bin/codesign
security set-key-partition-list -S apple-tool:,apple: -s -k "" build.keychain

# Install provisioning profile
mkdir -p ~/Library/MobileDevice/Provisioning\ Profiles/
cp profile.mobileprovision ~/Library/MobileDevice/Provisioning\ Profiles/
```

### xcodebuild signing flags

```bash
xcodebuild archive \
    -project MyApp.xcodeproj \
    -scheme MyApp \
    -archivePath build/MyApp.xcarchive \
    CODE_SIGN_STYLE=Manual \
    CODE_SIGN_IDENTITY="Apple Distribution" \
    PROVISIONING_PROFILE_SPECIFIER="MyApp App Store Profile" \
    DEVELOPMENT_TEAM=XXXXXXXXXX
```

For export:
```bash
xcodebuild -exportArchive \
    -archivePath build/MyApp.xcarchive \
    -exportPath build/export \
    -exportOptionsPlist ExportOptions.plist
```

ExportOptions.plist:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store</string>
    <key>teamID</key>
    <string>XXXXXXXXXX</string>
    <key>signingStyle</key>
    <string>manual</string>
    <key>provisioningProfiles</key>
    <dict>
        <key>com.company.app</key>
        <string>MyApp App Store Profile</string>
    </dict>
</dict>
</plist>
```

## App Store Connect API Keys

For automated uploads without Apple ID credentials:

1. Create API key in App Store Connect > Users and Access > Integrations > App Store Connect API
2. Download the .p8 key file (only downloadable once)
3. Note the Key ID and Issuer ID

```bash
xcodebuild -exportArchive \
    -archivePath build/MyApp.xcarchive \
    -exportPath build/export \
    -exportOptionsPlist ExportOptions.plist \
    -authenticationKeyPath path/to/AuthKey.p8 \
    -authenticationKeyID KEY_ID \
    -authenticationKeyIssuerID ISSUER_ID
```

Or with `altool`/`notarytool` for upload:
```bash
xcrun notarytool submit build/export/MyApp.ipa \
    --key path/to/AuthKey.p8 \
    --key-id KEY_ID \
    --issuer ISSUER_ID \
    --wait
```

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| "No signing certificate" | Certificate not in keychain or expired | Download from Developer Portal, double-click to install |
| "Profile doesn't include signing certificate" | Profile was created with a different cert | Regenerate profile in portal with current cert |
| "Provisioning profile doesn't match bundle ID" | Bundle ID mismatch | Check `PRODUCT_BUNDLE_IDENTIFIER` matches profile |
| "A valid provisioning profile was not found" | Profile expired or not installed | Re-download from portal or run `match` |
| "The entitlements in your app bundle are not valid" | Entitlements not in profile | Enable capability in portal, regenerate profile |
| "codesign failed with exit code 1" | Keychain locked or cert untrusted | Unlock keychain, trust cert in Keychain Access |

### Reset signing state

```bash
# List installed profiles
ls ~/Library/MobileDevice/Provisioning\ Profiles/

# Remove all profiles (re-download needed)
rm ~/Library/MobileDevice/Provisioning\ Profiles/*.mobileprovision

# List signing identities
security find-identity -v -p codesigning

# Verify app signature
codesign -vvv --deep --strict MyApp.app
```
