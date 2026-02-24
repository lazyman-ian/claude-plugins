---
type: plan
version: "2.0"
status: draft
created: 2026-02-24
scope: ios-swift-plugin
estimated-files: 14
risk: low
---

# Plan: ios-performance-guide + ios-migration-advisor Skills

## Overview

为 ios-swift-plugin 新增两个 skill，基于对戴铭十年回顾文章 + 30+ 外部博客 + 20+ 深度技术文章的完整研究成果。所有内容已过滤至 iOS 15+ 基线。

## Current State

- ios-swift-plugin 有 10 个 skills，77 个 reference 文件
- **Gap: 系统级性能** — swiftui-performance-audit 只覆盖 SwiftUI 视图层，不覆盖启动/内存/包体积/监控
- **Gap: 迁移指南** — swift-concurrency 覆盖并发迁移，但缺少 @Observable、SwiftData、Testing、架构选型的迁移指导
- 无 overlap 冲突（已验证 77 个 reference 文件）

## Phase 1: ios-performance-guide (7 files)

### 1.1 SKILL.md (~150 lines)

```
ios-swift-plugin/skills/ios-performance-guide/SKILL.md
```

Frontmatter:
- name: ios-performance-guide
- description: 包含 EN+CN 触发词（startup, memory, binary size, MetricKit, 启动优化, 内存泄漏, 包体积, 性能监控）
- 负面触发：Do NOT use for SwiftUI view performance — use swiftui-performance-audit
- allowed-tools: [Read, Glob, Grep, Bash, mcp__apple-docs__*]
- memory: project

内容结构:
1. Overview — 定位：系统级 iOS 性能（非 SwiftUI 视图层）
2. Diagnostic Workflow — 症状→领域→诊断→修复→验证
3. Quick Decision Tree — 症状→reference 文件映射表
4. Key Metrics — 启动 <400ms、内存峰值、OOM 率、包体积
5. Tool Selection — MetricKit/Instruments/Xcode Organizer 对照表
6. References Index — 5 个 reference 文件索引

### 1.2 references/ (5 files)

| File | ~Lines | Content |
|------|--------|---------|
| `startup-optimization.md` | 250 | pre-main（dyld4/静态链接/DYLD_PRINT_STATISTICS）+ post-main（Task 编排/延迟初始化）+ 测量（XCTApplicationLaunchMetric/Xcode Organizer）+ 目标 400ms |
| `memory-management.md` | 200 | 4 大泄漏源（闭包/delegate/timer/notification）+ [weak self] 决策树 + struct vs class 选择 + autoreleasepool 现代用法 + 生产检测（MetricKit + canary 对象）|
| `binary-size.md` | 150 | App Thinning + ODR + SPM 静态库 vs 动态库 + Asset Catalog 优化 + Swift 元数据 strip |
| `monitoring-tools.md` | 200 | MetricKit（MXMetricPayload/MXDiagnosticPayload/实现代码）+ Instruments 模板选择 + Xcode Organizer + XCTest 性能基准 + 能耗分析 |
| `rendering-performance.md` | 150 | CPU 优化（布局预计算/图片后台解码/CoreText）+ GPU 优化（离屏渲染避免/opaque 标记）+ 锁选型（os_unfair_lock/NSLock/Actor）— 补充 swiftui-performance-audit 覆盖不到的 UIKit/Core Animation 层 |

### Success Criteria
- [ ] SKILL.md < 200 lines
- [ ] 每个 reference < 300 lines
- [ ] 与 swiftui-performance-audit 无内容重叠
- [ ] 触发词不与现有 skill 冲突

## Phase 2: ios-migration-advisor (7 files)

### 2.1 SKILL.md (~160 lines)

```
ios-swift-plugin/skills/ios-migration-advisor/SKILL.md
```

Frontmatter:
- name: ios-migration-advisor
- description: 包含 EN+CN 触发词（migrate, migration, upgrade, 迁移, 升级, 技术选型, 过时, deprecated）
- 负面触发：Do NOT use for concurrency migration — use swift-concurrency. Do NOT use for SwiftUI code — use swiftui-expert
- allowed-tools: [Read, Glob, Grep, mcp__apple-docs__*, mcp__sosumi__*]
- memory: project

内容结构:
1. Overview — 定位：技术迁移决策与路径指导
2. Migration Assessment — 评估当前项目 → 识别过时技术 → 优先级排序
3. Quick Decision Tree — 迁移需求→reference 文件映射
4. Ecosystem Map — 过时库→现代替代速查表（内联）
5. Architecture Selection — 项目规模→架构推荐决策树（内联）
6. References Index — 5 个 reference 文件索引

### 2.2 references/ (5 files)

| File | ~Lines | Content |
|------|--------|---------|
| `observable-migration.md` | 200 | ObservableObject→@Observable 完整迁移：属性级追踪原理 + @State 陷阱（重复初始化/内存泄漏）+ App 顶层持有模式 + @Bindable 替代 @ObservedObject + @ObservationIgnored |
| `swiftdata-adoption.md` | 250 | SwiftData 注意事项：基础类型约束 + 云同步陷阱（非实时/账号切换清数据/迁移锁定）+ Core Data 共存（命名空间）+ VersionedSchema + 性能排名（SQLite > Core Data > SwiftData）+ 决策：何时用 SwiftData vs 保留 Core Data |
| `testing-migration.md` | 200 | XCTest→Swift Testing：#expect/#require 统一断言 + 参数化测试 + 嵌套 Suite（减46%文件）+ .serialized 处理旧测试 + --filter-tag 加速 + AI 辅助迁移要点 + 与 XCTest 共存策略 |
| `architecture-selection.md` | 200 | 2025 架构选型：项目规模决策树（小→@Observable 直接用/中→MVVM 变体/大→Clean Architecture 或 TCA）+ Clean Architecture 3层 + NavigationStack Coordinator + SPM 模块化（减40%构建时间）|
| `deprecated-ecosystem.md` | 150 | 完整过时技术对照表：ObjC 库→Swift 替代 + 过时模式→现代模式 + 工具链演进 + "仍需了解但不再手写"的知识清单 |

### Success Criteria
- [ ] SKILL.md < 200 lines
- [ ] 每个 reference < 300 lines
- [ ] 与 swift-concurrency 的 migration.md 无重叠（并发迁移指向 swift-concurrency）
- [ ] 与 swiftui-expert 的 state-management.md 无重叠（@Observable 代码模式指向 swiftui-expert）

## Phase 3: Integration (1 file update)

- 更新 `plugin.json` version: 1.1.1 → 1.2.0（新增 2 个 skills = minor bump）
- 更新 `.claude-plugin/marketplace.json` version 同步

## Implementation Order

```
Phase 1 (ios-performance-guide):
  1.1 SKILL.md
  1.2 references/startup-optimization.md
  1.3 references/memory-management.md
  1.4 references/binary-size.md
  1.5 references/monitoring-tools.md
  1.6 references/rendering-performance.md

Phase 2 (ios-migration-advisor):
  2.1 SKILL.md
  2.2 references/observable-migration.md
  2.3 references/swiftdata-adoption.md
  2.4 references/testing-migration.md
  2.5 references/architecture-selection.md
  2.6 references/deprecated-ecosystem.md

Phase 3 (Integration):
  3.1 Update plugin.json + marketplace.json version
```

## Testing Strategy

- Triggering test: 确认 10-20 个测试查询正确触发对应 skill
- 负面触发 test: 确认不会抢占现有 skill 的触发词
- Reference 加载 test: 确认所有 reference 路径正确
- 行数 check: SKILL.md < 200, reference < 300

## Risk Assessment

- **Low**: 纯新增文件，不修改任何现有 skill
- **Overlap risk**: 已通过 77 个 reference 分析确认无重叠，每个 SKILL.md 包含负面触发词
