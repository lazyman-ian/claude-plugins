# iOS Swift Plugin 完整指南

> Claude Code iOS/Swift 开发工具包 | v1.1.0

## 目录

- [为什么使用 ios-swift-plugin](#为什么使用-ios-swift-plugin)
- [快速开始](#快速开始)
- [Skills 详解](#skills-详解)
- [Commands 详解](#commands-详解)
- [最佳实践](#最佳实践)
- [常见问题](#常见问题)

---

## 为什么使用 ios-swift-plugin

### 传统开发 vs ios-swift-plugin

| 传统方式 | ios-swift-plugin |
|---------|------------------|
| 手动查阅 Apple 文档 | `/ios-api-helper` 直接获取最佳实践 |
| 猜测 SwiftUI 写法 | `/swiftui-expert` 提供现代 API 指导 |
| Concurrency 编译错误反复尝试 | `/swift-concurrency` 精准解决 Sendable 问题 |
| Widget 开发从零摸索 | `/ios-widget-developer` 完整模板 + 示例 |
| 性能问题不知从何下手 | `/swiftui-performance-audit` 自动诊断 |
| Build 命令冗长 | `/ios-build-test` token 高效命令 |

### 核心价值

1. **减少查文档时间**: 内置 100+ 参考文档，直接获取答案
2. **避免常见错误**: ConcurrencyGuard 自动拦截反模式
3. **现代 API 优先**: 始终推荐 iOS 17+ 最佳实践
4. **性能导向**: 自动审计 SwiftUI 性能问题

---

## 快速开始

### 安装

**方式一：从 Marketplace 安装（推荐）**

```bash
# 添加 marketplace（一次性）
/plugin marketplace add lazyman-ian/claude-plugins

# 安装插件
/plugin install ios-swift-plugin@lazyman-ian
```

**方式二：本地开发**

```bash
claude plugins add /path/to/ios-swift-plugin
```

### 验证安装

```bash
# 查看已安装插件
/plugin list

# 测试 skill
/ios-build-test
```

看到 skill 加载即表示安装成功。

### 可选依赖

以下 MCP 服务器可增强插件功能：

**Apple Documentation MCP（推荐）**

为 `/ios-api-helper` 提供 Symbol/API 精准查询。

```bash
# 安装
npm install -g @anthropic/apple-docs-mcp

# 或在 ~/.claude/settings.json 中配置
{
  "mcpServers": {
    "apple-docs": {
      "command": "npx",
      "args": ["-y", "apple-doc-mcp-server@latest"]
    }
  }
}
```

**Sosumi MCP（HIG 指南）**

为 `/ios-api-helper` 提供完整文档页面和 Human Interface Guidelines。

```json
// 在 ~/.claude/settings.json 中配置
{
  "mcpServers": {
    "sosumi": {
      "type": "http",
      "url": "https://sosumi.ai/mcp"
    }
  }
}
```

**XcodeBuildMCP（模拟器调试）**

为 `/ios-debugger` 提供模拟器控制、UI 交互、截图和日志捕获。

```bash
# 安装 - 参考 https://github.com/anthropics/xcodebuild-mcp
npm install -g @anthropic/xcodebuild-mcp

# 或在 ~/.claude/settings.json 中配置
{
  "mcpServers": {
    "XcodeBuildMCP": {
      "command": "npx",
      "args": ["-y", "@anthropic/xcodebuild-mcp"]
    }
  }
}
```

| MCP | 用途 | 相关 Skill |
|-----|------|-----------|
| apple-docs | Symbol/API 精准查询 | ios-api-helper, ios-ui-docs |
| sosumi | 完整文档、HIG 指南 | ios-api-helper |
| XcodeBuildMCP | 模拟器控制 | ios-debugger |

### 5 分钟上手

```bash
# 1. 构建项目
/ios-build-test build MyApp

# 2. 询问 SwiftUI 问题
/swiftui-expert "如何实现下拉刷新？"

# 3. 解决并发问题
/swift-concurrency "修复 Sendable 警告"

# 4. 创建 Widget
/ios-widget-developer "天气 Timeline Provider"
```

---

## Skills 详解

### swiftui-expert - SwiftUI 专家

SwiftUI 最佳实践、视图组合、状态管理。

**触发词**: SwiftUI, @State, @Observable, NavigationStack, sheet, TabView

**覆盖内容**:

| 主题 | 参考文档 |
|------|----------|
| 状态管理 | @State, @Observable, @Environment |
| 导航模式 | NavigationStack, sheets, split views |
| 列表优化 | List, LazyVStack, ForEach |
| 网格布局 | LazyVGrid, GridItem |
| 滚动视图 | ScrollView, scroll patterns |
| 表单 | Form, validation |
| 搜索 | searchable modifier |
| 主题 | theming, dark mode |
| 过渡动画 | matchedGeometryEffect |
| 性能 | performance patterns |

**示例用法**:

```
User: SwiftUI 如何实现无限滚动列表？

Claude: [加载 swiftui-expert skill]
推荐使用 LazyVStack + onAppear 触发加载...
```

### swift-concurrency - Swift 并发专家

async/await、actors、Sendable、Swift 6 迁移。

**触发词**: async, await, actor, @MainActor, Sendable, Task, concurrency, Swift 6

**覆盖内容**:

| 主题 | 参考文档 |
|------|----------|
| 基础 | async/await basics |
| Actor | actor isolation, @MainActor |
| Sendable | conformance patterns |
| Task | Task management, cancellation |
| AsyncSequence | for await, AsyncStream |
| 测试 | testing async code |
| 性能 | performance optimization |
| 迁移 | Swift 6 migration guide |
| 内存管理 | memory in async contexts |
| Core Data | background contexts |

**示例用法**:

```
User: 如何让自定义类型符合 Sendable？

Claude: [加载 swift-concurrency skill]
根据类型特点选择策略：
1. 值类型 → 自动 Sendable
2. 引用类型 + 不可变 → 添加 @unchecked Sendable
3. 引用类型 + 可变 → 使用 actor 隔离
...
```

### ios-widget-developer - Widget 开发专家

WidgetKit、Timeline Providers、Live Activities、App Intents。

**触发词**: widget, WidgetKit, Timeline, Live Activity, 小组件, 桌面组件

**覆盖内容**:

| 主题 | 参考文档 |
|------|----------|
| 基础 | Widget basics, configuration |
| Timeline | TimelineProvider, entries |
| Live Activities | ActivityKit integration |
| App Intents | interactive widgets |
| 调试 | debugging techniques |

**示例代码**:

```swift
// 基础 Widget
struct SimpleWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(
            kind: "SimpleWidget",
            provider: SimpleProvider()
        ) { entry in
            SimpleWidgetView(entry: entry)
        }
        .configurationDisplayName("简单组件")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct SimpleProvider: TimelineProvider {
    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(date: .now)
    }

    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> Void) {
        completion(SimpleEntry(date: .now))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SimpleEntry>) -> Void) {
        let entries = [SimpleEntry(date: .now)]
        let timeline = Timeline(entries: entries, policy: .after(.now.addingTimeInterval(3600)))
        completion(timeline)
    }
}
```

### ios-build-test - 构建测试专家

Token 高效的 xcodebuild 命令。

**触发词**: build, test, xcodebuild, compile, 构建, 编译, 测试

**命令模板**:

```bash
# 构建
xcodebuild -scheme MyApp -destination 'platform=iOS Simulator,name=iPhone 16' build 2>&1 | tail -20

# 测试
xcodebuild -scheme MyApp -destination 'platform=iOS Simulator,name=iPhone 16' test 2>&1 | xcpretty

# 只运行特定测试
xcodebuild test -scheme MyApp -only-testing:MyAppTests/AuthTests
```

### ios-api-helper - API 查询助手

Apple 文档查询、iOS 实现指南。

**触发词**: iOS API, how to implement, SwiftUI pattern, Apple docs, 如何实现, 什么API

**集成 MCP**:

| MCP | 用途 |
|-----|------|
| `apple-docs` | Symbol/API 精准查询 |
| `sosumi` | 完整文档页面、HIG 指南 |

### ios-debugger - 调试专家

模拟器控制、UI 交互、日志捕获。

**触发词**: run app, simulator, debug, 运行应用, 模拟器, 调试

**依赖**: 需要 `XcodeBuildMCP` (`xclaude-plugin`)。

### ios-ui-docs - UIKit 文档

UIKit 组件、Auto Layout 指南。

**触发词**: UIButton, UITableView, UICollectionView, Auto Layout, 按钮, 布局, 列表

### swiftui-liquid-glass - Liquid Glass 专家

iOS 26+ 毛玻璃效果 API。

**触发词**: Liquid Glass, glassEffect, GlassEffectContainer, 玻璃效果, 毛玻璃

### swiftui-performance-audit - 性能审计

SwiftUI 性能诊断与优化。

**触发词**: performance, slow, janky, lag, 性能优化, 卡顿, 掉帧

**诊断清单**:

| 问题 | 检查点 |
|------|--------|
| 过度重绘 | @State 粒度是否过粗 |
| 列表卡顿 | 是否使用 LazyVStack |
| 启动慢 | 是否有同步初始化 |
| 内存高 | 图片是否缓存/压缩 |
| CPU 占用 | 是否有不必要的计算 |

### macos-spm-app-packaging - macOS 打包专家

SwiftPM macOS 应用打包、签名、公证。

**触发词**: SwiftPM app, package macOS, app bundle, notarize, 打包应用

---

## Commands 详解

### /swift-audit - 并发审计

扫描代码中的并发违规。

```bash
/swift-audit Sources/
```

**检查规则**:

| Code | 规则 | 严重性 |
|------|------|--------|
| CC-CONC-001 | 禁止 `Task.detached` | Error |
| CC-CONC-002 | 禁止在 init 中创建 Task | Error |
| CC-CONC-003 | 禁止在 body/layout 中创建 Task | Error |
| CC-CONC-004 | AsyncStream 需要 onTermination | Warning |
| CC-CONC-005 | 单函数最多 3 个并发 Task | Warning |
| CC-CONC-008 | 禁止 `.background` 优先级的 `for await` | Error |

### /xcode-test - 快速测试

Token 高效的构建和测试。

```bash
# 构建
/xcode-test build MyApp

# 测试
/xcode-test test MyApp

# 指定模拟器
/xcode-test test MyApp --device "iPhone 16 Pro"
```

### /swift-fix-issue - 修复 Issue

端到端 GitHub Issue 解决流程。

```bash
/swift-fix-issue 42
```

**流程**:
1. 读取 Issue #42 内容
2. 分析问题
3. 定位代码
4. 实现修复
5. 验证
6. 创建 PR

### /app-changelog - 生成更新日志

从 git 历史生成 App Store 更新日志。

```bash
# 从上个 tag 开始
/app-changelog

# 指定起始 tag
/app-changelog v1.1.0
```

**输出示例**:

```markdown
## What's New

### Features
- 新增深色模式支持
- 添加 Widget 桌面组件

### Improvements
- 优化列表滚动性能
- 改进搜索体验

### Bug Fixes
- 修复登录偶发失败问题
- 解决内存泄漏
```

---

## 最佳实践

### 1. Skill 触发优化

明确使用触发词，让 Claude 准确加载对应 skill：

| 需求 | 推荐写法 | 不推荐 |
|------|----------|--------|
| SwiftUI 问题 | "SwiftUI 如何实现 X" | "如何实现 X" |
| 并发问题 | "Swift Concurrency Sendable 错误" | "这个编译错误" |
| Widget | "WidgetKit Timeline Provider" | "桌面小部件" |

### 2. 性能优先开发

开发 SwiftUI 时，始终考虑性能：

```swift
// ❌ 不推荐
struct ListView: View {
    var body: some View {
        ScrollView {
            VStack {  // 一次性加载所有
                ForEach(items) { item in
                    ItemRow(item: item)
                }
            }
        }
    }
}

// ✅ 推荐
struct ListView: View {
    var body: some View {
        ScrollView {
            LazyVStack {  // 懒加载
                ForEach(items) { item in
                    ItemRow(item: item)
                }
            }
        }
    }
}
```

### 3. 并发安全

遵循 ConcurrencyGuard 规则：

```swift
// ❌ 禁止
init() {
    Task {  // CC-CONC-002
        await loadData()
    }
}

// ✅ 推荐
func onAppear() {
    Task {
        await loadData()
    }
}
```

```swift
// ❌ 禁止
var body: some View {
    VStack {
        Task { await refresh() }  // CC-CONC-003
    }
}

// ✅ 推荐
var body: some View {
    VStack { ... }
        .task { await refresh() }
}
```

### 4. 现代 API 优先

始终使用最新稳定 API：

| 旧 API | 新 API (iOS 17+) |
|--------|------------------|
| `@StateObject` | `@State` + `@Observable` |
| `NavigationView` | `NavigationStack` |
| `onChange(of:perform:)` | `onChange(of:initial:_:)` |
| `UIViewRepresentable` | 原生 SwiftUI (如可用) |

---

## 常见问题

### Q: Skill 没有自动加载？

检查触发词是否明确。尝试直接调用：

```bash
/swiftui-expert "问题描述"
```

### Q: ConcurrencyGuard 报错如何处理？

1. 查看具体规则代码 (CC-CONC-XXX)
2. 参考上方规则表修复
3. 必要时使用 `/swift-concurrency` 获取详细指导

### Q: apple-docs MCP 如何配置？

```json
// .claude/mcp.json
{
  "mcpServers": {
    "apple-docs": {
      "command": "npx",
      "args": ["-y", "@anthropic/apple-docs-mcp"]
    }
  }
}
```

### Q: 如何贡献新 Skill？

1. Fork 仓库
2. 在 `skills/` 下创建目录
3. 编写 `SKILL.md` (参考现有 skill)
4. 添加 `references/` 参考文档
5. 提交 PR

---

## 与 dev-flow 配合使用

ios-swift-plugin 可以与 [dev-flow](https://github.com/lazyman-ian/dev-flow) 插件配合使用：

```bash
# 1. 开始 iOS 任务
/dev-flow:start TASK-001 "实现 Widget"

# 2. 使用 ios-swift-plugin 获取指导
/ios-widget-developer "Timeline Provider 模板"

# 3. 实现代码...

# 4. 使用 dev-flow 提交
/dev-flow:commit

# 5. 创建 PR
/dev-flow:pr
```

---

## 更新日志

### v1.1.0 (2025-01-29)

- 初始版本
- 10 个 Skills
- 4 个 Commands
- 2 个 Agents
- 2 个 Hooks
- ConcurrencyGuard 静态分析器

---

<p align="center">
  <sub>Built with Claude Code</sub>
</p>
