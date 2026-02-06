---
name: ios-build-test
description: Provides token-efficient iOS build and test commands. This skill should be used when building Xcode projects, running unit tests, checking build status, or iterating on test failures until they pass. Triggers on "build", "test", "xcodebuild", "compile", "verify build", "check if it builds", "does this compile", "make sure it builds", "run tests", "fix tests", "构建", "编译", "测试", "运行测试", "测试通过", "修复测试", "跑测试", "直到通过", "验证构建", "能编译吗".
memory: project
allowed-tools: [Bash, Read, Grep, mcp__apple-docs__*]
---

# iOS Build & Test (Token Optimized)

## When to Use

- Building Xcode projects (`xcodebuild build`)
- Running unit tests (`xcodebuild test`)
- Verifying build status before commit
- Iterating on test failures until all pass
- Need token-efficient output (use `-quiet`, `grep`)

## 核心原则

| 策略 | Token 节省 | 说明 |
|------|-----------|------|
| `-quiet` flag | 80-90% | 只输出警告和错误 |
| `build-for-testing` + `test-without-building` | 50%+ | 分离构建和测试 |
| `-only-testing` | 30-50% | 只运行特定测试 |
| `grep` 过滤 | 90%+ | 只提取关键结果 |

## 推荐命令

### 1. 构建检查 (最简)

```bash
# 只看成功/失败
xcodebuild build -workspace X.xcworkspace -scheme "Scheme" -quiet 2>&1 | grep -E "SUCCEED|FAILED"; echo "EXIT: $?"
```

### 2. 分离构建和测试

```bash
# Phase 1: 构建 (一次)
xcodebuild build-for-testing \
  -workspace X.xcworkspace \
  -scheme UnitTests \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro' \
  -derivedDataPath ./DerivedData \
  -quiet

# Phase 2: 测试 (可多次，无需重新构建)
xcodebuild test-without-building \
  -workspace X.xcworkspace \
  -scheme UnitTests \
  -derivedDataPath ./DerivedData \
  -quiet 2>&1 | grep -E "passed|failed|SUCCEED|FAILED"
```

### 3. 只提取错误

```bash
# 构建错误
xcodebuild build ... 2>&1 | grep -E "error:|FAILED"

# 测试结果摘要
xcodebuild test ... 2>&1 | grep -E "Test Case|passed|failed|SUCCEED|FAILED" | tail -20
```

### 4. 特定测试

```bash
# 只运行一个测试类
xcodebuild test-without-building \
  -only-testing:UnitTests/MyTestClass \
  -quiet

# 只运行一个测试方法
xcodebuild test-without-building \
  -only-testing:UnitTests/MyTestClass/testMethod \
  -quiet
```

## 输出过滤模式

| 需求 | 命令后缀 |
|------|---------|
| 成功/失败 | `\| grep -E "SUCCEED\|FAILED"` |
| 错误详情 | `\| grep -E "error:\|fatal"` |
| 测试结果 | `\| grep -E "passed\|failed" \| tail -30` |
| 警告统计 | `\| grep -c "warning:"` |

## 模拟器指定

```bash
# 列出可用模拟器
xcrun simctl list devices available | grep -E "iPhone|iPad"

# 使用 ID 避免歧义
-destination 'id=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX'
```

## 后台运行 (长时间构建)

```bash
# 后台运行，返回任务 ID
xcodebuild build ... &

# 检查结果
tail -20 /tmp/build.log
```

## 常见问题

### 模块找不到

```bash
# 清理 + 重装 pods
rm -rf Pods Podfile.lock DerivedData
pod install
```

### 多个同名模拟器

```bash
# 用 ID 指定
xcrun simctl list devices | grep "iPhone 16 Pro"
# 然后用 -destination 'id=...'
```

## Makefile 集成

```makefile
# 推荐添加到项目 Makefile
test:
	@xcodebuild test-without-building \
		-workspace $(WORKSPACE) \
		-scheme UnitTests \
		-derivedDataPath ./DerivedData \
		-quiet 2>&1 | grep -E "passed|failed|SUCCEED|FAILED"

build-test:
	@xcodebuild build-for-testing \
		-workspace $(WORKSPACE) \
		-scheme UnitTests \
		-derivedDataPath ./DerivedData \
		-quiet
```
