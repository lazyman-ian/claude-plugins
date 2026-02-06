---
name: xcode-test
description: Quick build and test for iOS projects
argument-hint: [scheme]
allowed-tools: [Bash, Read, Glob]
model: haiku
---

# Xcode Build & Test

Build and run tests for the iOS project.

## Target

Scheme: $1 (auto-detect if not specified)

## Workflow

### 1. Detect Project

Find workspace/project:
```bash
ls *.xcworkspace 2>/dev/null || ls *.xcodeproj 2>/dev/null
```

### 2. List Schemes (if not specified)

```bash
xcodebuild -list -json 2>/dev/null | head -50
```

### 3. Build for Testing

```bash
xcodebuild build-for-testing \
  -scheme "$1" \
  -destination "platform=iOS Simulator,name=iPhone 15" \
  -quiet \
  2>&1 | tail -20
```

### 4. Run Tests

```bash
xcodebuild test-without-building \
  -scheme "$1" \
  -destination "platform=iOS Simulator,name=iPhone 15" \
  -resultBundlePath TestResults.xcresult \
  2>&1 | grep -E "(Test Suite|Test Case|passed|failed|error:)" | tail -50
```

## Output

Report:
- Build status (success/failure)
- Test summary (passed/failed counts)
- Failed test details with file:line references
- Suggestions for fixing failures

## On Failure

If build fails:
1. Show relevant error lines
2. Identify the failing file
3. Suggest common fixes

If tests fail:
1. List failed test cases
2. Show assertion messages
3. Point to relevant source files
