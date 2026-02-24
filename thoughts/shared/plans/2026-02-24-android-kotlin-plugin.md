# Android Kotlin Plugin Implementation Plan

## Overview

基于对 Android 2015-2025 生态演进的深度研究，创建 android-kotlin-plugin。
研究来源：6 个并行 research agents（Compose、Coroutines、Performance、Migration、Blogs、Build/Gradle）。

## Plugin Structure

```
android-kotlin-plugin/
├── .claude-plugin/plugin.json
├── CLAUDE.md
├── skills/
│   ├── compose-expert/          # Jetpack Compose 最佳实践
│   ├── kotlin-coroutines/       # Coroutines & Flow
│   ├── android-performance/     # 系统级性能优化
│   ├── compose-performance-audit/ # Compose 渲染性能审计
│   ├── android-migration-advisor/ # 技术迁移顾问
│   ├── android-architecture/    # 架构 & 模块化
│   └── android-build-gradle/    # Gradle & 构建优化
├── agents/
│   ├── coroutine-reviewer.md    # Coroutine 反模式审查
│   └── migration-scanner.md     # 废弃 API 扫描
├── commands/
│   ├── kotlin-audit/            # Kotlin 代码审计
│   └── app-changelog/           # 应用更新日志
├── hooks/hooks.json             # Coroutine guard hook
└── docs/
    ├── GUIDE.md                 # 中文完整指南
    └── android-community-blogs.md # 社区博客索引
```

## Phase 1: Scaffold + Core Skills (compose-expert, kotlin-coroutines, android-performance)

### 1.1 Plugin scaffold
- plugin.json, CLAUDE.md, marketplace.json entry
- Version: 1.0.0

### 1.2 compose-expert (8 references)
- SKILL.md: state management, navigation, M3, side effects, interop
- References: state-management.md, navigation.md, material3.md, side-effects.md,
  composables.md, testing.md, interop.md, modern-apis.md

### 1.3 kotlin-coroutines (7 references)
- SKILL.md: async/await, Flow, structured concurrency, lifecycle, testing
- References: basics.md, flow.md, channels.md, error-handling.md,
  lifecycle.md, testing.md, anti-patterns.md

### 1.4 android-performance (5 references)
- SKILL.md: startup, memory, binary, battery, monitoring
- References: startup.md, memory.md, binary-size.md, baseline-profiles.md,
  monitoring.md

## Phase 2: Specialized Skills (compose-performance-audit, migration-advisor, architecture, build)

### 2.1 compose-performance-audit (3 references)
- SKILL.md: stability, recomposition, lazy layouts, strong skipping
- References: stability.md, recomposition.md, lazy-layouts.md

### 2.2 android-migration-advisor (4 references)
- SKILL.md: XML→Compose, Java→Kotlin, RxJava→Coroutines, deprecated ecosystem
- References: compose-migration.md, kotlin-migration.md, coroutines-migration.md,
  dependency-migration.md

### 2.3 android-architecture (3 references)
- SKILL.md: 3-layer, UDF, modularization, Hilt
- References: layers.md, modularization.md, dependency-injection.md

### 2.4 android-build-gradle (3 references)
- SKILL.md: Gradle KTS, version catalogs, convention plugins, R8, CI/CD
- References: gradle-kts.md, version-catalogs.md, convention-plugins.md

## Phase 3: Agents, Commands, Hooks, Docs

### 3.1 Agents
- coroutine-reviewer.md (opus): anti-pattern detection
- migration-scanner.md (sonnet): deprecated API/library scan

### 3.2 Commands
- kotlin-audit: Kotlin code quality scan
- app-changelog: Generate release notes

### 3.3 Hooks
- hooks.json: Coroutine guard (PreToolUse)

### 3.4 Docs
- GUIDE.md: 中文使用指南
- android-community-blogs.md: 社区博客索引

## Phase 4: Integration

- Update marketplace.json
- Update repo CLAUDE.md
- Routing conflict check across all plugins
