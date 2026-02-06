---
description: Check for outdated dependencies
---

Check dependency health for the current project.

## Instructions

1. **Detect platform**:
   ```
   dev_config
   ```
   Get platform type (ios/android/node/rust/go)

2. **Check dependencies by platform**:

   **iOS (CocoaPods)**:
   ```bash
   pod outdated 2>/dev/null | head -20
   ```

   **Android (Gradle)**:
   ```bash
   ./gradlew dependencyUpdates 2>/dev/null | grep -A 50 "The following dependencies"
   ```

   **Node.js (npm)**:
   ```bash
   npm outdated 2>/dev/null
   ```

   **Rust (Cargo)**:
   ```bash
   cargo outdated 2>/dev/null | head -20
   ```

   **Go (modules)**:
   ```bash
   go list -u -m all 2>/dev/null | grep '\[' | head -20
   ```

3. **Output format**:
   ```
   🔍 Dependency Health Check
   Platform: ios

   ## Outdated Dependencies

   ⚠️  X outdated package(s) found:

     Package         Current    Latest
     ─────────────────────────────────
     Alamofire       5.6.4      5.8.0
     SnapKit         5.6.0      5.7.1
     Kingfisher      7.9.1      7.10.0

   💡 To update:
      pod update           # Update all
      pod update Alamofire # Update specific

   ## Security Advisories
   ✅ No known vulnerabilities
   ```

4. **If no outdated deps**:
   ```
   ✅ All dependencies up to date!
   ```
