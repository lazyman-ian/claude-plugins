---
name: cross-platform-team
description: Orchestrates Agent Teams for parallel cross-platform development across multiple repositories (iOS/Android/Web). Composes existing skills (create-plan, implement-plan, dev commit, dev pr, research) instead of reimplementing. This skill should be used when user says "cross-platform", "跨平台开发", "multi-repo team", "同时开发", "parallel platform", "iOS Android Web 同时", "组队开发多仓库". Triggers on /cross-platform-team, 跨平台并行, 多仓库协作.
memory: user
context: fork
allowed-tools: [Read, Glob, Grep, Bash, Skill, Task, TeamCreate, TeamDelete, SendMessage, TaskCreate, TaskUpdate, TaskList, TaskGet, AskUserQuestion, mcp__Framelink_MCP_for_Figma__get_figma_data, mcp__plugin_dev-flow_dev-flow__*, mcp__apple-docs__*, mcp__sosumi__*, mcp__plugin_context7_context7__*]
---

# Cross-Platform Team

Pure orchestration layer. Composes existing skills — does NOT reimplement them.

## Skill Composition Map

```
/cross-platform-team orchestrates:
│
├─ Phase 1a (Lead)
│  ├─ /research          ← 如需调研 API/技术方案
│  └─ /create-plan       ← 生成跨平台 plan
│
├─ Phase 1b (Team 并行, plan review)
│  ├─ ios-reviewer       ← 验证 iOS 章节: 文件存在? API 对齐? 步骤完整?
│  ├─ android-reviewer   ← 验证 Android 章节
│  └─ Lead 汇总修正 → 迭代 plan
│
├─ Phase 1c: User 审核 (已自审过的高质量 plan)
│
├─ Phase 2 (Lead)
│  └─ /dev start         ← 各仓库创建分支 + ledger
│
├─ Phase 3 (Teammates 并行)
│  ├─ /implement-plan    ← 按 plan 实现各自平台
│  ├─ /dev commit        ← 提交代码
│  ├─ /deslop            ← 清理 AI slop
│  ├─ /self-check        ← 验证代码质量
│  └─ agents (可选)      ← 平台专属 agent 深度检查
│
└─ Phase 4 (Lead)
   ├─ /dev pr            ← 各仓库创建 PR
   └─ /describe          ← 生成 PR 描述
```

**Teammates 是完整 Claude 实例，可直接使用所有已安装 skills。**

## Documentation & Reference Tools

规划和实现时查阅官方文档，避免猜测 API。

| 平台 | 文档工具 | 用途 |
|------|---------|------|
| iOS | `mcp__apple-docs__*` | Symbol 搜索、API 详情 (choose_technology → search_symbols → get_documentation) |
| iOS | `mcp__sosumi__*` | 完整文档 + HIG (searchAppleDocumentation → fetchAppleDocumentation) |
| Any | `mcp__plugin_context7_context7__*` | 任意库文档 (resolve-library-id → query-docs) |
| iOS | `/swiftui-expert`, `/swift-concurrency`, `/ios-api-helper` | 平台专属 skills |
| Android | context7: `kotlin`, `android`, `retrofit`, `hilt` | Kotlin/Android 库 |
| Web | context7: `vue`, `pinia`, `vue-router`, `vite` | Vue 生态 |

### 使用时机

- **Phase 1a (create-plan)**: Lead 查文档确认 API 可行性，写入 plan
- **Phase 1b (review)**: Reviewer 查文档验证 plan 中的 API 调用是否正确
- **Phase 3 (implement)**: Teammate 实现时查文档确认用法

## Workflow

### Phase 1a: Draft Plan (Lead, 串行)

1. Resolve platforms (see Platform Resolution)
2. If research needed → `Skill("research", "调研 {topic}")`
3. 查文档确认关键 API:
   - iOS API → `mcp__apple-docs__` 或 `mcp__sosumi__`
   - 第三方库 → `mcp__plugin_context7_context7__` (resolve-library-id → query-docs)
   - 平台专属问题 → 对应 skill (如 `/swiftui-expert`)
4. Create plan → `Skill("create-plan", "跨平台 plan for TASK-{id}")`
   - Instruct create-plan to include per-platform sections
   - Plan template: see `references/platform-templates.md`

### Phase 1b: Team Plan Review (并行)

Plan 自审 — 各平台 reviewer 从自己仓库视角验证 plan 质量。

```
TeamCreate({ team_name: "TASK-{id}-review" })

# Per platform reviewer (lightweight, read-only)
Task({
  subagent_type: "Explore",         # Read-only agent, no edits
  team_name: "TASK-{id}-review",
  name: "{platform}-reviewer",
  prompt: <<PROMPT
审查 {plan_path} 中 "Platform: {Platform}" 章节。
仓库: {repo_path}

## 检查清单
1. 文件存在性: plan 中列出的目标文件在仓库中是否存在?
   - Glob/Grep 搜索确认 (新建文件标注 [NEW])
2. API 对齐: Shared Contract 中的 API 参数/字段,
   在该平台代码中对应什么? 找到实际代码位置。
3. 数据模型: plan 中的类型映射是否正确?
   (如 iOS Bool vs Android Boolean)
4. 步骤完整性: 是否有遗漏的步骤?
   (如缺少 i18n、缺少 push handling、缺少 UI 入口)
5. 依赖检查: 是否需要先修改其他文件才能开始?
6. Verify 命令: plan 中的 verify 是否与 CLAUDE.md/Makefile 一致?

## 输出格式
SendMessage 给 lead:
- ✅ 通过的检查项
- ⚠️ 需要补充/修正的项 (附具体建议)
- 📍 找到的实际代码位置 (file:line)
PROMPT
})
```

**Lead 汇总 reviewer 反馈 → 修正 plan → 迭代直到无 ⚠️**

### Phase 1c: User Review

经过 team 自审的 plan 质量更高。User 只需关注:
- 业务逻辑是否正确
- 优先级是否合理
- 是否需要增减平台

**对比**:

| | 无自审 | 有自审 |
|---|--------|--------|
| User 看到 | 粗糙 plan, 需多轮修改 | 已验证的 plan, 通常 1 轮通过 |
| 文件路径 | 可能是猜的 | 已在仓库中确认 |
| API 映射 | 可能遗漏 | 已找到实际代码位置 |
| 步骤完整性 | 可能缺步骤 | reviewer 已补全 |

### Phase 2: Prepare (Lead, 串行)

For each target repo:
```
Skill("dev", "start TASK-{id}-{feature} in {repo_path}")
```

This uses `/dev start` which handles:
- Branch creation (with repo-specific base branch)
- Ledger creation
- Context setup

### Phase 3: Implement (Team, 并行)

Spawn teammates, each instructed to use existing skills:

```
TeamCreate({ team_name: "TASK-{id}" })

# Per platform teammate:
Task({
  subagent_type: "general-purpose",
  team_name: "TASK-{id}",
  name: "{platform}-dev",
  prompt: <<PROMPT
你是 {platform} 开发者，在 {repo_path} 实现 TASK-{id}。

## 执行步骤
1. git -C {repo_path} checkout {branch}
2. 读取 {repo_path}/CLAUDE.md
3. 使用 /implement-plan 执行:
   Plan: {plan_path}
   只实现 "Platform: {Platform}" 章节
4. 每完成一个 Phase → 使用 /dev commit 提交
5. 全部完成 → 使用 /self-check 验证
6. SendMessage 给 lead: done + git diff --stat 结果

## 代码清理
- 实现完成后 → /deslop 清理 AI slop
- 需要深度简化 → Task(subagent_type="code-simplifier:code-simplifier")

## 可用 Agents (按需调用)
- iOS: Task(subagent_type="ios-swift-plugin:concurrency-reviewer") — Swift 并发检查
- iOS: Task(subagent_type="ios-swift-plugin:performance-auditor") — SwiftUI 性能
- All: Task(subagent_type="dev-flow:code-reviewer") — 代码质量审查
- All: Task(subagent_type="dev-flow:debug-agent") — 排查 bug
- All: Task(subagent_type="dev-flow:diagnose-agent") — 根因分析
- All: Task(subagent_type="codebase-pattern-finder") — 查找现有代码模式
- All: Task(subagent_type="research:research-agent") — 查外部文档/API

## 注意
- 不确定时 SendMessage 问 lead，不自行决定
- verify 不通过不报 done
PROMPT
})
```

### Phase 4: Close (Lead, 串行)

```
1. Review: git -C {repo} diff {base}..{branch} --stat
2. 问题 → SendMessage teammate 修复
3. 各仓库: Skill("dev", "pr") → 自动推送 + 创建 PR
4. Skill("describe") → 生成 PR 描述 (可选)
5. shutdown → TeamDelete
6. Summary: PR links
```

## Platform Resolution

| Priority | Method | Example |
|----------|--------|---------|
| 1 | Explicit | `只做 iOS 和 Android` |
| 2 | Preset | `mobile` → [ios, android] |
| 3 | Default | mobile (most common) |
| 4 | AskUserQuestion | If ambiguous |

**Presets**: `mobile` [ios,android] · `all` [ios,android,web] · `full-stack` [+backend]

## Memory: Conventions

Auto-populated on first use via discovery, updated by Phase 5.

**First run**: No memory exists → auto-discover from each repo:
1. Read `{repo_path}/CLAUDE.md` for tech stack, verify commands, conventions
2. Check `git symbolic-ref refs/remotes/origin/HEAD` for base branch
3. Check `Makefile` for fix/check targets
4. Use `AskUserQuestion` if repo paths not found

```yaml
# Example (auto-populated, values vary per project)
repos:
  ios: {discovered_ios_repo_path}
  android: {discovered_android_repo_path}
  web: {discovered_web_repo_path}
conventions:
  ios: { base: master, commit: "feat({scope}): {desc}", verify: "make fix && make check" }
  android: { base: master, commit: "feat({scope}): {desc}", verify: "make fix && make check" }
  web: { base: develop, commit: "{desc}", verify: "pnpm lint" }
branch_pattern: "feature/TASK-{id}-{feature}"
```

**Discovery priority**:
1. Parent dir CLAUDE.md (e.g. `../CLAUDE.md` with repo table)
2. Glob for common repo patterns in parent dir
3. AskUserQuestion → user provides repo paths

## Plan Structure (for create-plan)

Instruct `/create-plan` to generate this structure:

```markdown
# {Feature} Implementation Plan
## Overview
Ticket: TASK-{id} | Platforms: [iOS, Android]
## Shared Contract
### API Endpoints / Data Models / UI States
## Platform: iOS
### Alignment Table (if syncing)
### Phase 1-N: {description}
- Files: {specific paths}
- Steps: ...
### Verify: make fix && make check
## Platform: Android
### Alignment Table
### Phase 1-N
### Verify: make fix && make check
```

## Usage Examples

### Standard
```
/cross-platform-team mobile
TASK-{id} 实现 {feature}
需求: #PRD-{feature}.md
```

### Sync from reference
```
/cross-platform-team android
iOS 已实现 TASK-{id}，给 Android 同步
```

### Plan only
```
/cross-platform-team plan-only mobile
TASK-{id} 实现 {feature}
```

### Implement existing plan
```
/cross-platform-team implement
Plan: #thoughts/shared/plans/PLAN-TASK-{id}.md
```

## Phase 5: Learn (Lead, 自动)

After each run, update `~/.claude/memory/cross-platform-stats.yaml`:
- Append run metrics (platforms, mode, results, issues)
- Detect convention changes (base branch, verify, commit style)
- Update memory if drifted

Periodic: `/meta-iterate cross-platform` for deep analysis.
See `references/self-evolution.md` for full learning loop details.

## Repo Convention Auto-Sync

Each run start, verify conventions still current:
```
git log -5, CLAUDE.md, Makefile → compare with memory
If changed → update memory + warn user
```

## Error Handling

| Situation | Action |
|-----------|--------|
| Repo path not found | AskUserQuestion → save to memory |
| Branch exists | Checkout existing |
| Teammate verify fails | Report, keep trying |
| Plan ambiguous | Teammate asks lead |
| Skill not available to teammate | Fallback to manual commands |
