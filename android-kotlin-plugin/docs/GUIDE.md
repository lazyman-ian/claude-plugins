# Android Kotlin Plugin 使用指南

Claude Code 的 Android/Kotlin 开发工具包。

## 安装

```bash
claude plugins add android-kotlin-plugin@lazyman-ian
```

## Skills 一览

| Skill | 用途 | 触发词 |
|-------|------|--------|
| compose-expert | Compose 代码编写/审查/改进 | "Compose", "Composable", "state management" |
| kotlin-coroutines | 协程/Flow 模式与问题修复 | "Coroutines", "Flow", "StateFlow", "suspend" |
| android-performance | 系统级性能优化（启动/内存/包体积/电量） | "performance", "startup", "memory leak", "ANR" |
| compose-performance-audit | Compose 渲染性能审计 | "recomposition", "stability", "Compose卡顿" |
| android-migration-advisor | 技术迁移评估与规划 | "migrate", "XML to Compose", "Java to Kotlin" |
| android-architecture | 架构设计/模块化/DI | "architecture", "MVVM", "Hilt", "modularization" |
| android-build-gradle | 构建系统/Gradle/CI | "Gradle", "version catalog", "KSP", "R8" |

## Agents

| Agent | 用途 | 触发词 |
|-------|------|--------|
| coroutine-reviewer | 协程反模式审查（10条规则） | "coroutine review", "协程检查" |
| migration-scanner | 废弃API/库扫描 | "migration scan", "deprecated scan", "迁移扫描" |

## Commands

| Command | 用途 |
|---------|------|
| `/android-kotlin-plugin:kotlin-audit` | Kotlin 代码质量扫描 |
| `/android-kotlin-plugin:app-changelog` | 生成 Google Play 更新日志 |

## 使用场景

### 场景 1: 新 Compose 功能开发
```
"用 Compose 实现一个带搜索功能的用户列表页面"
→ 触发 compose-expert skill
→ 自动使用 type-safe navigation, Material 3, UDF 模式
```

### 场景 2: 性能问题排查
```
"LazyColumn 滚动卡顿，怎么优化？"
→ 触发 compose-performance-audit skill
→ 检查 stability, recomposition, key 使用
```

### 场景 3: 技术迁移评估
```
"我们项目还在用 RxJava，值得迁移到 Coroutines 吗？"
→ 触发 android-migration-advisor skill
→ 给出 ROI 分析 + 分阶段迁移计划
```

### 场景 4: 代码审查
```
"review 这个 ViewModel 的协程使用"
→ 触发 coroutine-reviewer agent
→ 检查 10 条反模式规则
```

### 场景 5: 构建优化
```
"如何设置 version catalog 和 convention plugins？"
→ 触发 android-build-gradle skill
→ 给出完整配置模板
```

## 技术参考

### Compose 版本对应
| Kotlin | Compose Compiler | BOM |
|--------|-----------------|-----|
| 2.0.0+ | 合入 Kotlin repo | 无需单独匹配 |
| 2.1.0 | Built-in | 2025.01.00 |

### 最低版本建议
| 组件 | 推荐最低 |
|------|---------|
| minSdk | 26 (Android 8.0) |
| targetSdk | 35 |
| Kotlin | 2.1.0+ |
| AGP | 8.5+ |
| Gradle | 8.9+ |

## 社区资源

详见 `docs/android-community-blogs.md` 获取完整博客索引。
