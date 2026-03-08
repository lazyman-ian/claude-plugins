# dev-flow Plugin 完整指南

> Claude Code 开发工作流自动化插件 | v7.1.0

## 目录

- [为什么使用 dev-flow](#为什么使用-dev-flow)
- [快速开始](#快速开始)
- [核心工作流](#核心工作流)
  - [标准流程](#标准流程)
  - [Autonomous Pipeline (v7.1.0)](#autonomous-pipeline-v710)
  - [命令详解](#命令详解)
- [高级功能](#高级功能)
  - [Agentic Engineering (v6.3.0)](#agentic-engineering-v630)
  - [5-Gate Execution Pipeline](#5-gate-execution-pipeline)
  - [Review System](#review-system)
  - [Knowledge Vault](#knowledge-vault)
  - [Ledger 状态管理](#ledger-状态管理)
  - [Multi-Agent 协调](#multi-agent-协调)
  - [Notion Pipeline](#notion-pipeline)
  - [Rules 分发系统](#rules-分发系统)
  - [Meta-Iterate 自我迭代](#meta-iterate-自我迭代)
  - [Ralph Loop](#ralph-loop)
- [平台支持](#平台支持)
- [最佳实践](#最佳实践)
- [常见问题](#常见问题)
- [版本历史](#版本历史)

---

## 为什么使用 dev-flow

### 传统开发 vs dev-flow

| 传统方式 | dev-flow |
|---------|----------|
| 手动 `git add && git commit` | `/dev commit` 自动格式化 + scope 推断 |
| 手写 commit message | 自动生成符合规范的 message，无 AI 署名 |
| 手动创建 PR | `/dev pr` 自动推送 + 生成描述 + 代码审查 |
| 手动验证代码质量 | `/dev verify` VDD: exit code 0 = 完成 |
| 上下文丢失（session 切换） | Ledger 持久化任务状态，跨 session 恢复 |
| Agent 自己判断完成 | 环境（hooks + exit code）判断完成 |
| 需求到 PR 需要多步手动操作 | `/dev start --auto` 全自主流水线 |

### 核心价值

1. **减少重复操作** — 一个命令完成 lint → commit → push
2. **保持上下文** — Ledger 跨 session 保持任务状态
3. **质量保障** — 自动执行平台对应检查命令，P0/P1 阻止提交
4. **知识积累** — Markdown-first 知识库，自动注入历史决策和陷阱

---

## 快速开始

### 安装

```bash
# 方式 1: 从 Marketplace 安装（推荐）
/plugin marketplace add lazyman-ian/claude-plugins
/plugin install dev-flow@lazyman-ian

# 方式 2: 本地开发
claude plugins add /path/to/dev-flow
```

### 验证安装

```bash
/dev-flow:dev
# 输出示例: STARTING|✅0|checkout
```

### 初始化项目

```bash
# 必须：每个项目运行一次，创建 .dev-flow.json 和 thoughts/ 目录
/dev-flow:init
```

### 5 分钟上手

```bash
# 1. 开始任务
/dev-flow:start TASK-001 "实现用户登录"

# 2. 编写代码...

# 3. 提交
/dev-flow:commit

# 4. 创建 PR
/dev-flow:pr
```

---

## 核心工作流

### 标准流程

```
start → [brainstorm] → [create-plan] → [validate] → implement-plan → verify → commit → pr → [release]
```

每个步骤：
- `start` — 创建分支 + Ledger
- `brainstorm` — 苏格拉底式探索（需求不清晰时）
- `create-plan` — 研究 → 结构化计划 → `thoughts/shared/plans/`
- `validate` — 验证技术选型
- `implement-plan` — 5-gate pipeline 执行
- `verify` — VDD 验证（exit code 0）
- `commit` — lint fix → lint check → review → commit
- `pr` — push → 生成描述 → 代码审查
- `release` — 版本建议 → Tag → Release Notes

---

### Autonomous Pipeline (v7.1.0)

全自主流水线 — 人类只在入口（提供需求）和出口（PR Review + Merge）介入。

#### 使用方式

```bash
# 从纯文本需求
/dev start "实现用户登录功能，支持 OAuth2" --auto

# 从 Notion 任务
/dev start "https://notion.so/page-id" --auto

# 从需求文件
/dev start --spec path/to/requirements.md --auto
```

#### 完整流程

```
/dev start "需求" --auto
    │
    ▼
来源检测
  Notion URL → Notion MCP
  文件 → Read
  URL → WebFetch
  纯文本 → 直接传递
    │
    ▼
spec-generator（纯函数，来源无关）
  文本 → 分类 → 模板 → SPEC.md
    │
    ▼
spec-validator（确定性验证）
  validate-spec.sh (5 项质量检查)
  detect-escalation.sh (5 条升级规则)
  ├─ 全部通过 → 继续
  ├─ 失败 → 自愈修复（最多 2 次）
  └─ 需升级 → 停止，等待人类决策
    │
    ▼
create-plan（研究 → 结构化计划）
  └─ validate-agent（强制执行）
     ├─ 验证通过 → 继续
     ├─ 需修改 → 自动修复（最多 2 次）
     └─ 必须变更 → 停止，等待人类
    │
    ▼
implement-plan（5-gate pipeline）
  每个 task：subagent → self-review →
    spec-review → quality-review → verify
  verify 通过 → .proof/ → commit → 下一个
    │
    ▼
Review Gate Loop
  code-reviewer（完整分支 diff）
  ├─ P0/P1 → 生成修复任务 → 重新审查（最多 3 轮）
  ├─ P2/P3 → 记录到 PR 说明
  └─ 干净 → /dev pr
    │
    ▼
人类: PR Review + Merge
```

#### 关键设计

| 设计点 | 说明 |
|--------|------|
| `--auto` 传播 | 通过 prompt context 传递，默认关闭（向后兼容） |
| 确定性脚本 | `validate-spec.sh` + `detect-escalation.sh`，零 token 成本 |
| L3 升级 | 安全/架构问题是唯一拉入人类的路径（允许误报） |
| Review Gate | PR 创建的**前置条件**，不是后置步骤 |
| Proof Manifest | `.proof/{task-id}.json` 由 TaskCompleted hook 强制执行 |

---

### 命令详解

#### /dev start — 开始任务

```bash
/dev-flow:start TASK-001 "实现用户登录"   # 基础用法
/dev-flow:start "需求" --auto              # 全自主模式
/dev-flow:start --spec path/to/spec.md    # 从文件开始
/dev-flow:start --branch feature/auth     # 从已有分支
```

自动执行：创建分支 `TASK-001-xxx` + Ledger `thoughts/ledgers/TASK-001-xxx.md` + 设置初始状态。

#### /dev commit — 智能提交

```bash
/dev-flow:commit              # 自动模式
/dev-flow:commit --scope auth # 指定 scope
/dev-flow:commit --type fix   # 指定类型
```

自动执行流程：
1. `lint fix` — 自动格式化代码
2. `lint check` — 验证无错误
3. `dev_defaults` — 推断 scope
4. code-reviewer — P0/P1 阻止提交
5. `git commit` — 生成 message（无 Claude 署名）
6. `dev_ledger` — 更新状态

#### /dev pr — 创建 PR

```bash
/dev-flow:pr                       # 自动模式
/dev-flow:pr --reviewer @team-lead # 指定 reviewer
```

自动执行：检查未提交 → `git push -u` → 聚合 reasoning → `gh pr create`（中文描述）→ 完整代码审查。

#### /dev verify — VDD 验证

```bash
/dev-flow:verify            # 完整验证
/dev-flow:verify --lint-only
/dev-flow:verify --test-only
```

**VDD 原则**: 机器（exit code 0）判断完成，不是 Agent。

| 传统 | VDD |
|------|-----|
| "修复这个 bug" | "修复 bug，`npm test auth` 应该通过" |
| Agent 说"完成" | exit code 0 说"完成" |

---

## 高级功能

### Agentic Engineering (v6.3.0)

#### 三层决策架构

| 层级 | 执行者 | 触发条件 | 成本 |
|------|--------|---------|------|
| L1 Environment | hooks + exit code + scope check | 始终执行 | 零 |
| L2 Decision Agent | Sonnet（fork context） | L1 无法判断时 | 低 |
| L3 Human | PR Review | 安全/架构问题 | 罕见 |

#### Continue vs Stop 信号

**Continue（全部满足才继续）**：
- verify pass（exit 0）
- 变更在 task scope 内
- context < 70%

**Stop（任一触发即停止）**：
- verify fail 2 次（自愈后仍失败）
- 变更超出声明 scope
- context > 80%
- 安全/架构决策（升级 L3）

#### Task Contracts + Proof Manifest

每个 plan task 包含：
```markdown
contract:
  acceptance: "用户可以用邮箱+密码登录，无错误"
  verify: "npm test auth"
  scope: ["src/auth/", "src/api/login.ts"]
  autonomy: 1  # 1=milestone报告, 2=仅最终报告
```

验证通过后 → `.proof/{task-id}.json`（TaskCompleted hook 强制执行，无 proof 不能完成任务）。

#### Self-Healing Retry

```
verify fail
    → diagnose（读取错误）
    → fix code（永远不修改 verify 命令）
    → re-verify
        pass → 继续 + 记录 guardrail
        fail → 停止 + 升级
```

最多重试 2 次。超出 → 停止，等待人类。

#### Silent Execution

| Autonomy Level | 输出时机 | 输出内容 |
|---------------|---------|---------|
| 0（默认） | 每步确认 | 完整说明 |
| 1（milestone） | 每个 task 完成 | `[Task N/M] name done (X files, verify pass)` |
| 2（final only） | 全部完成 | `Done: N/M tasks, X files, all pass. Proof: .proof/` |

---

### 5-Gate Execution Pipeline

implement-plan 对每个 task 执行的质量门禁。

#### Gate 矩阵

| Gate | 低风险 | 中风险 | 高风险 |
|------|--------|--------|--------|
| 0. Figma Pre-fetch（ui-task） | — | ✓ | ✓ |
| 1. Fresh Subagent | ✓ | ✓ | ✓ |
| 2. Self-Review（11 点检查） | ✓ | ✓ | ✓ |
| 3. Spec Review | — | — | ✓ |
| 4. Quality Review | — | ✓ | ✓ |
| 5. Verify（exit code 0） | ✓ | ✓ | ✓ |

风险由 code-reviewer 根据 diff 信号自动判断（敏感文件、改动规模、已知陷阱匹配）。

每 N 个 task 执行一次 Batch Checkpoint，检查跨任务一致性。

---

### Review System

#### 严重级别

| 级别 | 含义 | 行为 |
|------|------|------|
| P0 | 阻断（安全漏洞、数据丢失风险） | 阻止提交/PR |
| P1 | 严重（逻辑错误、崩溃风险） | 阻止提交/PR |
| P2 | 中等（性能、代码质量） | 记录到 PR notes |
| P3 | 建议（风格、可读性） | 记录到 PR notes |

#### 四个集成点

```
/dev simplify   → 轻量或深度代码简化
/dev commit     → 代码审查（P0/P1 阻止）
/dev review     → 完整代码审查（P0-P3）
/dev pr         → 完整审查 + GH comment
Agent Team      → reviewer teammate（持久，跨模块）
```

#### Review Session Log

`.git/claude/review-session-{branch}.md` — 分支维度的累积审查上下文。每次 code-reviewer 启动前读取历史发现，实现跨提交问题检测，无需 Agent Teams。

---

### Knowledge Vault

Markdown-first 知识库，人工可编辑，SQLite FTS5 全文搜索，自动注入 session。

#### 目录结构

```
thoughts/knowledge/
├── pitfalls/     # 陷阱：已踩过的坑
├── patterns/     # 模式：可复用的解法
├── decisions/    # 决策：架构选型记录
└── habits/       # 习惯：团队约定
```

每个条目使用 YAML frontmatter：
```yaml
---
type: pitfall
priority: critical  # critical / important / reference
platform: ios
tags: [concurrency, swift]
created: 2026-01-15
access_count: 5
---
```

#### 优先级与衰减

- 得分 = `priority_weight × temporal_decay（30 天半衰期）`
- 自动晋升：`access_count >= 3` → critical
- 自动降级：`important + 0 次访问 + > 90 天` → reference
- 自动归档：`reference + 0 次访问 + > 90 days` → `.archive/`

#### 质量门

写入前自动检查（regex + Type-Token Ratio，无 LLM）。过于模糊的条目被拒绝。

#### 读写时机

| 操作 | 触发 | 说明 |
|------|------|------|
| 注入 | SessionStart | 仅注入 `priority='critical'` 条目（context diet） |
| 搜索 | 技能/agent 开工前 | debug/plan/implement/review 自动查询 |
| 保存 | Stop hook + commit 时 | 经质量门过滤 + 智能去重 |

#### MCP 工具操作

```bash
# 保存知识（经质量门）
dev_memory(action='save', text='@Sendable 闭包不能捕获可变状态', title='Swift 并发陷阱', tags=['swift', 'concurrency'])

# 搜索（轻量级，返回 ID + 标题）
dev_memory(action='search', query='concurrency pitfalls', limit=5)

# 获取完整内容（search → get 两步模式，节省 token）
dev_memory(action='get', ids=['knowledge-xxx'])

# 查看状态
dev_memory(action='status')
```

---

### Ledger 状态管理

跨 session 的任务状态追踪器，存储在 `thoughts/ledgers/`，git 追踪。

#### Ledger 结构

```markdown
# TASK-001: 实现用户登录

## Goal
实现完整的用户登录功能，支持 OAuth2

## Constraints
- 使用 JWT 认证
- 不引入新的认证库

## Key Decisions
- [2026-01-27] 选择 Firebase Auth（方案见 thoughts/knowledge/decisions/）

## State
- [x] Phase 1: UI 设计（verified: `make check` ✓）
- [→] Phase 2: API 集成（当前）
- [ ] Phase 3: 测试

## Open Questions
- [ ] 刷新 token 策略？
```

#### 基础命令

```bash
/dev-flow:ledger status          # 查看当前状态
/dev-flow:ledger update          # 更新进度
/dev-flow:tasks sync             # 与 Task Management 双向同步
```

context > 70% 时，更新 ledger 再 `/clear`，下次 session 通过 ledger 恢复状态。

---

### Multi-Agent 协调

```bash
# 规划任务分解（检测文件冲突）
dev_coordinate(action="plan", task="实现完整认证系统")

# 创建 agent 间交接文档
dev_handoff(action="write", from="plan-agent", to="implement-agent")

# 聚合多 agent 结果为 PR 摘要
dev_aggregate(action='pr_ready', taskId='...')
```

| 工具 | 功能 |
|------|------|
| `dev_coordinate` | 任务规划、分发、冲突检测 |
| `dev_handoff` | Agent 间交接文档 |
| `dev_aggregate` | 聚合多 Agent 结果 |

**Agent Teams 模式**：设置 `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` 后，`Shift+Tab` 进入 Delegate 模式（lead 只协调不写代码）。

---

### Notion Pipeline

从 Notion 数据库拉取任务，通过适配器模式生成规格说明。

#### 配置

```json
{
  "notion": {
    "database_id": "your-database-id",
    "status_field": "Status",
    "priority_field": "Priority",
    "platform_field": "Platform"
  }
}
```

#### 流程

```
Notion DB → /dev inbox（任务分拣）→ 选择任务
    → /dev spec（Notion 适配器）→ spec-generator（纯函数）→ SPEC.md
    → [人工确认] → /dev create-plan → /dev implement-plan
```

`/dev spec` 负责从 Notion 提取内容为纯文本，再委托给 `spec-generator`（来源无关）处理。`--auto` 模式下整个流程自动继续。

```bash
/dev inbox                    # 查看 Notion 任务
/dev inbox --priority High    # 按优先级过滤
/dev spec {page_id}           # 从 Notion 任务生成规格
```

---

### Rules 分发系统

12 个平台感知规则模板，安装到 `.claude/rules/dev-flow/`（命名空间隔离）。

```bash
/dev rules list          # 查看可用模板
/dev rules install       # 自动检测平台并安装匹配规则
/dev rules install --all # 安装全部模板
/dev rules diff          # 对比已安装与最新版本
/dev rules sync          # 更新到最新版本
```

#### 模板清单

| 模板 | 作用域 |
|------|--------|
| `coding-style.md` | 全局 |
| `coding-style-swift.md` | `**/*.swift` |
| `coding-style-kotlin.md` | `**/*.kt` |
| `coding-style-typescript.md` | `**/*.ts` |
| `ios-pitfalls.md` | `**/*.swift` |
| `android-pitfalls.md` | `**/*.kt` |
| `testing.md` | 全局 |
| `git-workflow.md` | 全局 |
| `security.md` | 全局 |
| `performance.md` | 全局 |
| `agent-rules.md` | 全局 |
| `agentic-engineering.md` | 全局 |

`/dev init` 自动调用 `/dev rules install`，无需手动安装。

---

### Meta-Iterate 自我迭代

分析 session 表现，持续优化 prompt 和 skill。

```bash
/dev-flow:meta-iterate          # 完整 5 阶段流程
/dev-flow:meta-iterate evaluate # 评估最近 20 次 session
/dev-flow:meta-iterate diagnose # 诊断根因
/dev-flow:meta-iterate propose  # 提出改进方案
/dev-flow:meta-iterate apply    # 应用（需人工确认）
/dev-flow:meta-iterate verify   # 验证改进效果
/dev-flow:meta-iterate discover # 发现新 skill 机会
```

```
evaluate → diagnose → propose → [approve] → apply → verify
```

---

### Ralph Loop

针对长 plan 的持久化回退模式，通过 Stop hook 重注入实现迭代完成。

```bash
# 桥接命令：读取 plan → 提取 tasks/contracts → 生成 Ralph prompt
/dev ralph-implement [plan-path]
```

适用场景：plan 任务过多、context 受限、需要多轮 session 完成的情况。详见 `skills/implement-plan/references/ralph-loop-mode.md`。

---

## 平台支持

### 检测优先级

```
1. .dev-flow.json（用户显式配置）→ 最高优先级
2. 文件检测（自动推断）
   *.xcodeproj / Podfile / Package.swift → ios
   build.gradle / AndroidManifest.xml   → android
   package.json                         → web
   其他                                 → general
```

混合项目（如 Svelte+Tauri）建议通过 `.dev-flow.json` 显式指定平台。

### 内置平台命令

| 平台 | lint fix | lint check | verify |
|------|----------|------------|--------|
| iOS | `swiftlint --fix` | `swiftlint` | `swiftlint && xcodebuild build` |
| Android | `ktlint -F` | `ktlint` | `ktlintCheck && ./gradlew assembleDebug` |

### 自定义平台

```json
{
  "platform": "python",
  "commands": {
    "fix": "black . && ruff check --fix .",
    "check": "ruff check . && mypy .",
    "test": "pytest",
    "verify": "ruff check . && mypy . && pytest"
  },
  "scopes": ["api", "models", "utils"]
}
```

`platform` 字段同时影响：`dev_config` 命令输出、知识库注入（SessionStart 加载对应平台 pitfalls）、`dev_memory` 知识分类。

### 扩展新平台

1. `mcp-server/src/detector.ts` — 添加检测逻辑（`detectPlatformSimple()` 统一入口）
2. `mcp-server/src/platforms/xxx.ts` — 实现命令配置

---

## 最佳实践

### 任务粒度

| 粒度 | 推荐做法 |
|------|---------|
| 小任务（< 3 文件） | 直接执行，不需要 plan |
| 中任务（3-10 文件） | `/dev create-plan` → `/dev implement-plan` |
| 大任务（> 10 文件） | 拆分为多个 TASK，Multi-Agent 协调 |

### 提交频率

推荐小步提交：完成一个功能点就 `/dev commit`。避免积累大量修改后一次性提交（增加 review 难度）。

### Context 管理

| 信号 | 行动 |
|------|------|
| Context > 70% | 更新 ledger → 准备 `/clear` |
| Context > 85% | 立即更新 ledger → `/clear` |
| 完成独立子任务 | 新 session |
| Agent 开始重复 | 立即新 session |

2 次修正失败 → `/clear` + 重写 prompt（含教训），不要在同一 session 反复修正。

### VDD 实践

```bash
# 定义任务时包含验证命令
"修复登录 bug。验证: npm test auth"

# 完成后机器验证
/dev-flow:verify  # exit code 0 = 真正完成
```

---

## 常见问题

### Q: dev_config 返回 "unknown"

项目未初始化或不是内置平台。解决：

```json
{
  "platform": "python",
  "commands": {
    "fix": "black .",
    "check": "ruff . && mypy ."
  }
}
```

或在 Makefile 中定义 `fix:` 和 `check:` target，plugin 自动使用 `make fix/check`。

### Q: 提交被 hook 阻止

常见原因：lint check 失败 或 P0/P1 review 发现。

```bash
/dev-flow:verify  # 查看具体错误
/dev-flow:commit  # 修复后重新提交
```

注意：`--no-verify` 被 commit-guard.sh 阻止，不可绕过。

### Q: Ledger 状态不同步

```bash
/dev-flow:tasks sync  # 同步 ledger 和 Task Management
```

### Q: Multi-Agent 任务冲突

```bash
dev_coordinate(action="check_conflicts")  # 检查冲突
dev_coordinate(action="replan")           # 重新规划（串行化冲突任务）
```

### Q: Knowledge Vault 条目写入失败

质量门拒绝了过于模糊的条目。提供更具体的标题和内容（避免"这是一个陷阱"这类描述），并确保内容有足够的 Type-Token Ratio。

---

## 版本历史

| 版本 | 日期 | 主要变更 |
|------|------|---------|
| **v7.1.0** | 2026-03-08 | **Autonomous Pipeline**: `/dev start --auto` 全自主流水线；spec-generator 重构（纯函数）；spec-validator + 确定性脚本（`validate-spec.sh` + `detect-escalation.sh`）；Review Gate Loop；Proof Manifest 强制（TaskCompleted hook）；`/dev spec` 变为 Notion 适配器 |
| **v7.0.0** | 2026-02-27 | **Closed-Loop Learning Engine**: Ledger v2（gate tracking + 结构化状态）；Adaptive Execution Engine（L1/L2/L3 决策）；Execution Report（`.proof/execution-report.md`）；泛化 scope 推断（`dev_defaults` 读 `.dev-flow.json` 或目录结构）；176 个测试 |
| **v6.3.0** | 2026-02-22 | **Agentic Engineering**: Task Contracts + Proof Manifest；Decision Agent（Sonnet）；三层决策架构；Self-Healing Retry；Silent Execution；Auto-Resume（`.resume-directive.md`）；Context Diet（仅注入 critical 知识） |
| **v6.0.0** | 2026-02-15 | **Notion Pipeline**（inbox + spec 适配器）；**Rules 分发系统**（12 个模板）；vitest + 98 个测试；Hook 系统升级；安全扫描 skill |
| **v5.0.0** | 2026-02-12 | **5-Gate Execution Pipeline**（Fresh Subagent → Self-Review → Spec Review → Quality Review → Verify）；brainstorm skill；spec-reviewer agent；自适应 plan 粒度 |
| **v4.0.0** | 2026-02-09 | **Knowledge Vault**（Markdown-first，SQLite FTS5，priority + decay）；quality gate；path-scoped pitfall 模板 |
| **v3.13.0** | 2026-01-27 | VDD；Multi-Agent 协调；`dev_coordinate` / `dev_handoff` / `dev_aggregate` |

---

> 问题或建议：https://github.com/lazyman-ian/claude-plugins/issues
