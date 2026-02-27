---
plan_version: "2.0"
status: completed
created: 2026-02-27
phases:
  - id: 1
    name: "MCP Zero-Config Bundle"
    complexity: low
    model: sonnet
    parallelizable: false
    depends_on: []
    target_files: ["ios-swift-plugin/.mcp.json"]
    verify: ["cat ios-swift-plugin/.mcp.json | python3 -c 'import json,sys;d=json.load(sys.stdin);assert len(d[\"mcpServers\"])==3'"]
  - id: 2
    name: "swift-testing skill"
    complexity: medium
    model: sonnet
    parallelizable: true
    depends_on: [1]
    target_files:
      - "ios-swift-plugin/skills/swift-testing/SKILL.md"
      - "ios-swift-plugin/skills/swift-testing/references/"
    verify: ["test -f ios-swift-plugin/skills/swift-testing/SKILL.md"]
  - id: 3
    name: "swift-6-guide skill"
    complexity: medium
    model: sonnet
    parallelizable: true
    depends_on: [1]
    target_files:
      - "ios-swift-plugin/skills/swift-6-guide/SKILL.md"
      - "ios-swift-plugin/skills/swift-6-guide/references/"
    verify: ["test -f ios-swift-plugin/skills/swift-6-guide/SKILL.md"]
  - id: 4
    name: "ios-modern-apis skill"
    complexity: medium
    model: sonnet
    parallelizable: true
    depends_on: [1]
    target_files:
      - "ios-swift-plugin/skills/ios-modern-apis/SKILL.md"
      - "ios-swift-plugin/skills/ios-modern-apis/references/"
    verify: ["test -f ios-swift-plugin/skills/ios-modern-apis/SKILL.md"]
  - id: 5
    name: "xcode-build-config skill"
    complexity: medium
    model: sonnet
    parallelizable: true
    depends_on: [1]
    target_files:
      - "ios-swift-plugin/skills/xcode-build-config/SKILL.md"
      - "ios-swift-plugin/skills/xcode-build-config/references/"
    verify: ["test -f ios-swift-plugin/skills/xcode-build-config/SKILL.md"]
  - id: 6
    name: "swift-testing-reviewer agent"
    complexity: low
    model: sonnet
    parallelizable: true
    depends_on: [1]
    target_files: ["ios-swift-plugin/agents/swift-testing-reviewer.md"]
    verify: ["test -f ios-swift-plugin/agents/swift-testing-reviewer.md"]
  - id: 7
    name: "Existing skill enhancement"
    complexity: low
    model: sonnet
    parallelizable: false
    depends_on: [2, 3]
    target_files:
      - "ios-swift-plugin/skills/ios-debugger/SKILL.md"
      - "ios-swift-plugin/skills/swift-concurrency/SKILL.md"
    verify: ["grep -q ExecuteSnippet ios-swift-plugin/skills/ios-debugger/SKILL.md"]
  - id: 8
    name: "Version bump 1.3.0"
    complexity: low
    model: haiku
    parallelizable: false
    depends_on: [2, 3, 4, 5, 6, 7]
    target_files:
      - "ios-swift-plugin/.claude-plugin/plugin.json"
      - ".claude-plugin/marketplace.json"
      - "ios-swift-plugin/README.md"
    verify: ["grep -q '1.3.0' ios-swift-plugin/.claude-plugin/plugin.json"]
key_decisions:
  mcp_bundle: "Bundle apple-docs + sosumi + xcode into .mcp.json for zero-config"
  swift_6_guide: "Independent skill (not merged into swift-concurrency) — language features vs concurrency patterns"
  modern_apis_scope: "iOS 18+ full coverage (not just iOS 26)"
  testing_agent: "swift-testing-reviewer agent based on concurrency-reviewer pattern"
---

# ios-swift-plugin v1.3.0 Implementation Plan

## Overview

将 ios-swift-plugin 从 1.2.0 升级到 1.3.0，核心变更：
1. MCP 零配置 — bundle apple-docs + sosumi，用户装插件即用
2. 4 个新 skills — swift-testing, swift-6-guide, ios-modern-apis, xcode-build-config
3. 1 个新 agent — swift-testing-reviewer
4. 现有 skill 增强 — ios-debugger + swift-concurrency

## Current State Analysis

**ios-swift-plugin v1.2.0**：12 skills, 2 agents, 4 commands, 2 hooks

MCP 依赖问题：
- `mcp__apple-docs__*` 被 10/12 skills 使用，但用户需自行安装
- `mcp__sosumi__*` 被 2 skills 使用，也需自行安装
- `mcp__xcode__*` 刚 bundle（本次 commit ab3e3ae）

Skill 缺口：
- 无 Swift Testing 支持（Swift 6 时代新标准）
- 无 Swift 6 语言特性指导（typed throws, strict concurrency mode）
- 无 iOS 18+ 新 API 指南（MeshGradient, scroll position, animations）
- 无 Xcode 项目配置指导（.xcconfig, Info.plist, signing）

## Desired End State

- 16 skills, 3 agents, .mcp.json 包含 3 个 MCP server
- 用户安装 ios-swift-plugin 后零配置即可使用所有 MCP 工具
- 覆盖 Swift 6 + iOS 18+ + Swift Testing 的完整开发工具链

## What We're NOT Doing

- 不重写现有 skills（仅增强 ios-debugger 和 swift-concurrency）
- 不修改 hooks 或 commands
- 不做跨插件整合（android-kotlin-plugin 保持独立）
- 不处理 XcodeBuildMCP bundle（第三方维护，保持外部依赖）

---

## Phase 1: MCP Zero-Config Bundle

### Overview
将 apple-docs 和 sosumi MCP server 加入 .mcp.json，实现零配置。

### Changes Required:

**File**: `ios-swift-plugin/.mcp.json`

当前只有 xcode，加入另外两个：

```json
{
  "mcpServers": {
    "xcode": {
      "type": "stdio",
      "command": "xcrun",
      "args": ["mcpbridge"]
    },
    "apple-docs": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@kimsungwhee/apple-docs-mcp"]
    },
    "sosumi": {
      "type": "http",
      "url": "https://sosumi.ai/mcp"
    }
  }
}
```

### Success Criteria:
- [ ] .mcp.json 包含 3 个 MCP server
- [ ] JSON 格式正确

---

## Phase 2: swift-testing Skill

### Overview
覆盖 Swift Testing 框架（@Test, @Suite, #expect），替代 XCTest 的新标准。

### Changes Required:

**File**: `ios-swift-plugin/skills/swift-testing/SKILL.md` (~120 lines)

Frontmatter:
```yaml
---
name: swift-testing
description: Writes, reviews, and migrates tests using Swift Testing framework (@Test, @Suite, #expect). This skill should be used when writing new tests, converting XCTest to Swift Testing, using parameterized tests, or implementing custom test traits. Triggers on "Swift Testing", "@Test", "@Suite", "#expect", "#require", "parameterized test", "test trait", "Swift 测试", "单元测试", "迁移测试". Do NOT use for XCTest-only patterns or UITest automation — use ios-build-test instead.
memory: project
allowed-tools: [Read, Glob, Grep, Edit, Write, mcp__xcode__*, mcp__apple-docs__*]
---
```

Core sections:
1. Quick Decision Tree (@Test vs XCTest)
2. Core APIs table (@Test, @Suite, #expect, #require, Issue.record)
3. Parameterized tests pattern
4. XCTest → Swift Testing migration map
5. Anti-patterns (struct vs class, setUp→init, isolation)
6. References table

**References** (4 files):
| File | Content |
|------|---------|
| `swift-testing-basics.md` | @Test/@Suite 完整用法、参数化测试、tags |
| `xctest-migration.md` | XCTest → Swift Testing 逐项对照 + 迁移 checklist |
| `async-testing-patterns.md` | 异步测试隔离、actor isolation、并发陷阱 |
| `custom-traits.md` | 自定义 trait、条件执行、项目级分类 |

---

## Phase 3: swift-6-guide Skill

### Overview
Swift 6 语言特性指南，与 swift-concurrency（并发模式）互补，覆盖语言升级全路径。

### Changes Required:

**File**: `ios-swift-plugin/skills/swift-6-guide/SKILL.md` (~130 lines)

Frontmatter:
```yaml
---
name: swift-6-guide
description: Guides Swift 5 to Swift 6 language migration including typed throws, strict concurrency mode, Sendable protocol patterns, and Synchronization library. This skill should be used when enabling Swift 6 language mode, fixing concurrency warnings, adopting typed throws, or using Mutex/Atomic. Triggers on "Swift 6", "typed throws", "strict concurrency", "Sendable", "Swift migration", "@preconcurrency", "language mode", "region-based isolation", "Swift 6 迁移", "严格并发", "类型化抛出". Do NOT use for async/await patterns or actor design — use swift-concurrency instead. Do NOT use for test writing — use swift-testing instead.
memory: project
allowed-tools: [Read, Glob, Grep, Edit, Write, mcp__xcode__*, mcp__apple-docs__*]
---
```

Core sections:
1. Swift 5 → 6 Migration Roadmap (4 steps)
2. Typed Throws (SE-0413) patterns
3. Strict Concurrency Quick Fixes table
4. Sendable Decision Tree
5. Synchronization Library (Mutex vs Atomic)
6. @preconcurrency strategies
7. References table

**References** (5 files):
| File | Content |
|------|---------|
| `migration-checklist.md` | 逐步迁移流程（warnings → fixes → Swift 6 mode） |
| `typed-throws-guide.md` | SE-0413 语法、穷举错误处理、改造现有类型 |
| `sendable-patterns.md` | Value/Reference 类型、actor isolation、自定义 Sendable |
| `synchronization-library.md` | Mutex、Atomic 使用场景、vs actors 选择 |
| `preconcurrency-strategies.md` | 渐进式采用、框架兼容层 |

---

## Phase 4: ios-modern-apis Skill

### Overview
iOS 18+ 新 SwiftUI/UIKit API 速查，覆盖动画、滚动、MeshGradient、无障碍等。

### Changes Required:

**File**: `ios-swift-plugin/skills/ios-modern-apis/SKILL.md` (~120 lines)

Frontmatter:
```yaml
---
name: ios-modern-apis
description: Provides reference for iOS 18+ new APIs including MeshGradient, scroll position tracking, animation presets (wiggle, breathe, bouncy), KeyframeAnimator, and accessibility enhancements. This skill should be used when adopting iOS 18+ features, implementing new animations, using scroll tracking APIs, or adding MeshGradient effects. Triggers on "iOS 18", "MeshGradient", "scroll position", "wiggle animation", "breathe animation", "KeyframeAnimator", "ScrollView position", "iOS 18 新 API", "网格渐变", "滚动位置", "新动画". Do NOT use for SwiftUI best practices or view composition — use swiftui-expert instead. Do NOT use for iOS 26 Liquid Glass — use swiftui-liquid-glass instead.
memory: project
allowed-tools: [Read, Glob, Grep, Edit, Write, mcp__xcode__*, mcp__apple-docs__*]
---
```

Core sections:
1. iOS Version → Feature Map table
2. Animation Framework (wiggle, breathe, bouncy, PhaseAnimator)
3. Scroll Position APIs
4. MeshGradient quick start
5. Accessibility iOS 18+ enhancements
6. References table

**References** (4 files):
| File | Content |
|------|---------|
| `animation-presets.md` | wiggle/breathe/bouncy + PhaseAnimator + KeyframeAnimator |
| `scroll-position-guide.md` | scrollPosition, onScrollGeometryChange, visibility |
| `meshgradient-guide.md` | 2D gradient 设计模式、动画、性能 |
| `accessibility-ios18.md` | Eye tracking、Music Haptics、Voice Commands |

---

## Phase 5: xcode-build-config Skill

### Overview
Xcode 项目配置最佳实践：.xcconfig、Info.plist、签名、Capabilities。

### Changes Required:

**File**: `ios-swift-plugin/skills/xcode-build-config/SKILL.md` (~130 lines)

Frontmatter:
```yaml
---
name: xcode-build-config
description: Provides best practices for Xcode project configuration including .xcconfig files, Info.plist migration, build configurations, code signing, and capabilities setup. This skill should be used when setting up build environments, configuring signing, managing Info.plist keys, or creating custom build configurations. Triggers on "xcconfig", "Info.plist", "build settings", "code signing", "provisioning profile", "capabilities", "entitlements", "build configuration", "Xcode 配置", "签名", "构建设置", "环境配置". Do NOT use for Swift code patterns — use swiftui-expert or swift-concurrency instead.
memory: project
allowed-tools: [Read, Glob, Grep, Edit, Write, Bash, mcp__xcode__*]
---
```

Core sections:
1. .xcconfig File Organization pattern
2. Info.plist Migration (XML → Build Settings)
3. Build Configurations (Debug/Release/Staging)
4. Code Signing Decision Tree
5. Capabilities Setup checklist
6. Common Pitfalls table (URL "//", $(inherited))
7. References table

**References** (5 files):
| File | Content |
|------|---------|
| `xcconfig-best-practices.md` | 文件组织、继承、变量替换、注释陷阱 |
| `info-plist-migration.md` | XML → Build Settings 迁移步骤 |
| `build-configurations.md` | Debug/Release/Custom、per-config 覆盖 |
| `code-signing-guide.md` | 签名身份、Provisioning Profile、CI/CD |
| `capabilities-entitlements.md` | Push、iCloud、Sign in with Apple、App Groups |

---

## Phase 6: swift-testing-reviewer Agent

### Overview
扫描测试文件的 Swift Testing 反模式，对标 concurrency-reviewer。

### Changes Required:

**File**: `ios-swift-plugin/agents/swift-testing-reviewer.md` (~90 lines)

```yaml
---
name: swift-testing-reviewer
description: Review Swift test files for Swift Testing anti-patterns, XCTest/Swift Testing mixing issues, and test isolation problems. Triggers on "test review", "check tests", "Swift Testing issues", "测试检查", "测试审查".
model: sonnet
color: cyan
---
```

Rules (ST-001 to ST-008):
| ID | Rule |
|----|------|
| ST-001 | XCTest 和 Swift Testing 在同一 class 混用 |
| ST-002 | @Suite 用 class 而非 struct |
| ST-003 | 使用 XCTAssert 而非 #expect |
| ST-004 | #require 误用（应为 #expect 的场景） |
| ST-005 | 缺少参数化（重复测试逻辑） |
| ST-006 | setUp()/tearDown() 而非 init/deinit |
| ST-007 | 共享可变状态（非 actor 隔离） |
| ST-008 | 缺少 tags 分类 |

---

## Phase 7: Existing Skill Enhancement

### 7a. ios-debugger: 添加 ExecuteSnippet

**File**: `ios-swift-plugin/skills/ios-debugger/SKILL.md`

在 Core Workflow 前加 Step 0:

```markdown
### 0) Quick Logic Verify (optional)
If user wants to test a code snippet before full build:
- Call `mcp__xcode__ExecuteSnippet(code: "...")` for Swift REPL-like execution
- Faster than full build cycle, useful for algorithm verification
```

### 7b. swift-concurrency: 补充 Swift 6

**File**: `ios-swift-plugin/skills/swift-concurrency/SKILL.md`

在 references 列表中加入：
- `references/swift-6-strict-mode.md` — 严格并发检查、region-based isolation
- 在 Quick Decision Tree 加入 "Swift 6 mode 报错 → swift-6-guide skill" 转导

---

## Phase 8: Version Bump 1.3.0

### Changes Required:

| File | Change |
|------|--------|
| `ios-swift-plugin/.claude-plugin/plugin.json` | `"version": "1.3.0"` |
| `.claude-plugin/marketplace.json` | ios-swift-plugin version → `1.3.0` |
| `ios-swift-plugin/README.md` | Badge version |

---

## Testing Strategy

### Automated:
- [ ] JSON validity: `.mcp.json`, `plugin.json`, `marketplace.json`
- [ ] SKILL.md 存在且 < 500 lines
- [ ] References 文件都存在
- [ ] Agent frontmatter valid (name, description, model)
- [ ] grep 确认 version 为 1.3.0

### Manual:
- [ ] `claude plugins remove ios-swift-plugin@lazyman-ian && claude plugins add ios-swift-plugin@lazyman-ian`
- [ ] 验证 3 个 MCP server 注册（`claude mcp list`）
- [ ] 触发测试：输入 "Swift Testing" → swift-testing skill 激活
- [ ] 触发测试：输入 "Swift 6 migration" → swift-6-guide skill 激活

## Implementation Strategy

Phase 2-6 可并行（无文件冲突），推荐 Agent Team fan-out 模式：
- Lead: 创建 Phase 1 + Phase 8
- 5 个 sonnet agents 并行：各创建一个 skill/agent（Phase 2-6）
- Phase 7 在 Phase 2+3 完成后串行执行

预估总文件数：~30 files（4 SKILL.md + 18 references + 1 agent + 3 config + 修改 4 existing）

## References

- Brainstorm session: ios-swift-plugin MCP 整合与完善
- Research: Swift Testing framework, Swift 6 features, iOS 18+ APIs, Xcode config
- Pattern: ios-swift-plugin skill structure (12 existing skills analyzed)
