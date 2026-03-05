---
name: ios-build-test
description: Provides token-efficient iOS build and test commands with minimal output. This skill should be used when building Xcode projects, running unit tests, checking build status, or iterating on test failures until they pass. Key capabilities include Xcode MCP native tools (Xcode 26.3+) and xcodebuild fallback. Triggers on "build", "test", "xcodebuild", "compile", "verify build", "run tests", "fix tests", "构建", "编译", "测试", "运行测试", "修复测试", "iOS构建", "Xcode编译", "构建配置". Do NOT use for running apps on simulator or runtime debugging — use ios-debugger instead.
memory: project
allowed-tools: [Bash, Read, Grep, mcp__xcode__*, mcp__apple-docs__*]
---

# iOS Build & Test

## Tool Selection

| 条件 | 工具 |
|------|------|
| Xcode 26.3+ 已打开项目 | `mcp__xcode__*` (推荐) |
| Xcode < 26.3 或无 MCP | `Bash` + `xcodebuild` |

## Xcode MCP 方式（推荐）

### 构建

```
mcp__xcode__BuildProject(scheme: "MyApp")
```

如果失败，用 `GetBuildLog` 获取详情：

```
mcp__xcode__GetBuildLog()
```

查看 Issue 面板错误：

```
mcp__xcode__XcodeListNavigatorIssues()
```

获取特定文件的编译诊断：

```
mcp__xcode__XcodeRefreshCodeIssuesInFile(filePath: "path/to/File.swift")
```

### 测试

```
# 列出所有测试
mcp__xcode__GetTestList()

# 运行全部测试
mcp__xcode__RunAllTests()

# 运行特定测试（类或方法）
mcp__xcode__RunSomeTests(tests: ["MyTestClass", "MyTestClass/testMethod"])
```

## Bash 方式（Xcode < 26.3 fallback）

### 构建检查

```bash
xcodebuild build -workspace X.xcworkspace -scheme "Scheme" -quiet 2>&1 | grep -E "error:|warning:|SUCCEED|FAILED"; echo "EXIT: $?"
```

### 分离构建和测试（token 高效）

```bash
# Phase 1: 构建一次
xcodebuild build-for-testing \
  -workspace X.xcworkspace -scheme UnitTests \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro' \
  -derivedDataPath ./DerivedData -quiet

# Phase 2: 测试（可重复，不重新构建）
xcodebuild test-without-building \
  -workspace X.xcworkspace -scheme UnitTests \
  -derivedDataPath ./DerivedData -quiet 2>&1 \
  | grep -E "passed|failed|SUCCEED|FAILED"
```

### 特定测试

```bash
xcodebuild test-without-building \
  -only-testing:UnitTests/MyTestClass/testMethod -quiet
```

## 常见问题

### 模块找不到

```bash
rm -rf Pods Podfile.lock DerivedData && pod install
```

### 多个同名模拟器

```bash
xcrun simctl list devices | grep "iPhone 16 Pro"
# 用 -destination 'id=...'
```
