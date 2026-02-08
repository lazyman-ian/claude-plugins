# dev-flow Plugin 完整指南

> Claude Code 开发工作流自动化插件 | v3.15.0

## 目录

- [为什么使用 dev-flow](#为什么使用-dev-flow)
- [快速开始](#快速开始)
- [核心工作流](#核心工作流)
- [高级功能](#高级功能)
- [最佳实践](#最佳实践)
- [常见问题](#常见问题)
- [Claude Code 配合使用](#claude-code-配合使用)

---

## 为什么使用 dev-flow

### 传统开发 vs dev-flow

| 传统方式 | dev-flow |
|---------|----------|
| 手动 `git add && git commit` | `/dev commit` 自动格式化 + scope 推断 |
| 手写 commit message | 自动生成符合规范的 message |
| 手动创建 PR | `/dev pr` 自动推送 + 生成描述 + 代码审查 |
| 手动验证代码质量 | `/dev verify` 自动 lint + test |
| 上下文丢失 (session 切换) | Ledger 持久化任务状态 |
| Agent 判断任务完成 | VDD: exit code 0 判断完成 |

### 核心价值

1. **减少重复操作**: 一个命令完成 lint → commit → push
2. **保持上下文**: Ledger 跨 session 保持任务状态
3. **质量保障**: 自动执行平台对应的检查命令
4. **知识积累**: 自动记录决策历史，提取跨项目知识

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
```

输出示例:
```
STARTING|✅0|checkout
```

### 5 分钟上手

```bash
# 1. 开始新任务
/dev-flow:start TASK-001 "实现用户登录"

# 2. 编写代码...

# 3. 提交
/dev-flow:commit

# 4. 创建 PR
/dev-flow:pr
```

---

## 核心工作流

### 完整流程图

```
┌─────────────────────────────────────────────────────────────────┐
│                     /dev-flow:start                              │
│                创建分支 TASK-XXX-xxx                             │
│                创建 Ledger 追踪状态                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   /dev-flow:plan (可选)                          │
│              研究 → 设计 → 迭代 → 生成计划                       │
│              输出: thoughts/shared/plans/xxx.md                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                 /dev-flow:validate (可选)                        │
│              验证技术选型是否符合 2024-2025 最佳实践              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   /dev-flow:implement                            │
│                  TDD: Red → Green → Refactor                     │
│                  大任务: Multi-Agent 协调                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    /dev-flow:verify                              │
│              lint check → typecheck → unit tests                 │
│              VDD: exit code 0 = 完成                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    /dev-flow:commit                              │
│       1. lint fix (自动格式化)                                   │
│       2. lint check (验证)                                       │
│       3. git commit (自动 scope + message)                       │
│       4. reasoning 记录                                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      /dev-flow:pr                                │
│       1. push to remote                                          │
│       2. 生成 PR 描述 (中文)                                     │
│       3. 自动代码审查                                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   /dev-flow:release                              │
│              版本建议 → Tag → Release Notes                      │
└─────────────────────────────────────────────────────────────────┘
```

### 命令详解

#### /dev-flow:start - 开始任务

```bash
# 基础用法
/dev-flow:start TASK-001 "实现用户登录"

# 从已有分支开始
/dev-flow:start --branch feature/auth
```

**自动执行**:
1. 创建分支 `TASK-001-implement-user-login`
2. 创建 Ledger `thoughts/ledgers/TASK-001-xxx.md`
3. 设置初始状态

#### /dev-flow:commit - 智能提交

```bash
# 自动模式
/dev-flow:commit

# 指定 scope
/dev-flow:commit --scope auth

# 指定类型
/dev-flow:commit --type fix
```

**自动执行**:
1. `lint fix` - 自动格式化代码
2. `lint check` - 验证无错误
3. `git diff --stat` - 分析变更
4. `dev_defaults` - 推断 scope
5. `git commit` - 生成 message (无 Claude 署名)
6. `dev_reasoning` - 记录决策历史
7. `dev_ledger` - 更新状态

#### /dev-flow:pr - 创建 PR

```bash
# 自动模式
/dev-flow:pr

# 指定 reviewers
/dev-flow:pr --reviewer @team-lead
```

**自动执行**:
1. 检查未提交 → 自动 `/dev-flow:commit`
2. 检查未推送 → `git push -u`
3. 收集提交历史
4. 聚合 reasoning
5. `gh pr create` (中文描述)
6. 自动代码审查

#### /dev-flow:verify - VDD 验证

```bash
# 完整验证
/dev-flow:verify

# 只测试
/dev-flow:verify --test-only

# 只 lint
/dev-flow:verify --lint-only
```

**VDD 原则**: Machine judges completion, not Agent.

| 传统 | VDD |
|------|-----|
| "修复这个 bug" | "修复 bug，`npm test auth` 应该通过" |
| Agent 说 "完成" | exit code 0 说 "完成" |

---

## 高级功能

### Ledger 状态管理

Ledger 是跨 session 的任务状态追踪器。

```bash
# 查看当前 ledger
/dev-flow:ledger status

# 创建新 ledger
/dev-flow:ledger create --branch TASK-001

# 更新状态
/dev-flow:ledger update --commit abc123 --message "完成登录 UI"

# 归档已完成任务
/dev-flow:ledger archive TASK-001
```

**Ledger 结构**:
```markdown
# TASK-001: 实现用户登录

## Goal
实现完整的用户登录功能

## Constraints
- 使用 JWT 认证
- 支持 OAuth2

## Key Decisions
- [2026-01-27] 选择 Firebase Auth

## State
- [x] Phase 1: UI 设计
- [→] Phase 2: API 集成
- [ ] Phase 3: 测试

## Open Questions
- [ ] 刷新 token 策略？
```

### Knowledge Base 知识库

跨项目知识自动积累和加载。

```bash
# 提取当前项目知识
/dev-flow:extract-knowledge

# 提取特定类型
/dev-flow:extract-knowledge --type pitfalls
/dev-flow:extract-knowledge --type patterns
/dev-flow:extract-knowledge --type discoveries
```

**知识结构**:
```
~/.claude/knowledge/
├── index.md                  # 索引
├── platforms/
│   ├── ios/pitfalls.md      # iOS 陷阱
│   └── android/pitfalls.md  # Android 陷阱
├── patterns/                 # 通用模式
│   └── async-error-handling.md
└── discoveries/              # 时间线发现
    └── 2026-01-27-swift-concurrency.md
```

Session 启动时自动加载:
```
📚 ios pitfalls: 4 条
```

### Multi-Agent 协调

复杂任务自动分解给多个 Agent 执行。

```bash
# 查看任务分解
dev_coordinate(action="plan", task="实现完整认证系统")

# 创建 handoff
dev_handoff(action="create", from="plan-agent", to="implement-agent")

# 聚合结果
dev_aggregate(sources=["agent-1", "agent-2"])
```

**协调工具**:

| 工具 | 功能 |
|------|------|
| `dev_coordinate` | 任务规划、分发、冲突检测 |
| `dev_handoff` | Agent 间交接文档 |
| `dev_aggregate` | 聚合多 Agent 结果 |

### Meta-Iterate 自我迭代

分析 session 表现，持续优化 prompt。

```bash
# 完整 5 阶段流程
/dev-flow:meta-iterate

# 单独执行某阶段
/dev-flow:meta-iterate evaluate --recent 20
/dev-flow:meta-iterate diagnose
/dev-flow:meta-iterate propose
/dev-flow:meta-iterate apply  # 需要人工确认
/dev-flow:meta-iterate verify

# 发现新 skill 机会
/dev-flow:meta-iterate discover
```

**5 阶段流程**:
```
evaluate → diagnose → propose → [approve] → apply → verify
    ↓          ↓          ↓                    ↓        ↓
  评估       诊断       提案                 应用     验证
```

---

## 最佳实践

### 1. 任务粒度

| 粒度 | 推荐做法 |
|------|---------|
| 小任务 (< 3 文件) | 直接执行，不需要 plan |
| 中任务 (3-10 文件) | `/dev-flow:plan` → `/dev-flow:implement` |
| 大任务 (> 10 文件) | 拆分为多个 TASK，Multi-Agent 协调 |

### 2. 提交频率

```bash
# 推荐: 小步提交
/dev-flow:commit  # 完成一个功能点就提交

# 不推荐: 大批量提交
# 积累大量修改后一次性提交
```

### 3. Context 管理

| 信号 | 行动 |
|------|------|
| Context > 70% | 更新 ledger → `/clear` |
| 完成独立子任务 | 新 session |
| Agent 开始重复 | 新 session |

### 4. VDD 实践

```bash
# 定义任务时包含验证命令
"修复登录 bug，验证: npm test auth 应该通过"

# 完成后自动验证
/dev-flow:verify
# exit code 0 → 真正完成
```

### 5. 知识积累

```bash
# 每周提取一次项目知识
/dev-flow:extract-knowledge

# 发现新陷阱时立即记录到 CLAUDE.md
## 已知陷阱
- session.save() 是异步的，必须 await
```

---

## 常见问题

### Q: dev_config 返回 "unknown"

**原因**: 项目未配置且不是 iOS/Android/Web 项目

**解决** (推荐 `.dev-flow.json`，同时配置平台和命令):

```json
{
  "platform": "python",
  "commands": {
    "fix": "black .",
    "check": "ruff . && mypy ."
  }
}
```

> `.dev-flow.json` 的 `platform` 字段还会影响知识库注入和 `dev_memory` 分类。

或创建 `Makefile`:
```makefile
fix:
	black .
check:
	ruff . && mypy .
```

### Q: Ledger 状态不同步

**解决**:
```bash
# 同步 ledger 和 Task Management
/dev-flow:tasks sync
```

### Q: 提交被 hook 阻止

**常见原因**:
- `--no-verify` 被禁止
- lint check 失败

**解决**:
```bash
# 先修复问题
/dev-flow:verify

# 再提交
/dev-flow:commit
```

### Q: Multi-Agent 任务冲突

**解决**:
```bash
# 检查冲突
dev_coordinate(action="check_conflicts")

# 重新规划
dev_coordinate(action="replan")
```

---

## Claude Code 配合使用

### Rules 最佳配置

dev-flow 推荐配合以下 rules 使用:

| Rule | 功能 |
|------|------|
| `agentic-coding.md` | Context 管理 + 发现捕获 |
| `command-tools.md` | 工具优先，减少 Bash |
| `verification-driven.md` | VDD 原则 |
| `context-budget.md` | Context 预算管理 |
| `failure-detection.md` | 循环/绕过检测 |

### Hooks 集成

dev-flow 自动启用以下 hooks:

| Hook | 触发 | 功能 |
|------|------|------|
| PreToolUse | `git commit` 前 | 阻止裸 git commit，强制 /dev commit |
| Setup | 首次初始化 | 配置 dev-flow 环境 |
| SessionStart | 恢复 session | 加载 ledger + 平台知识 |
| PreCompact | 压缩前 | 备份 transcript |
| PostToolUse | 工具执行后 | 工具计数 + 提醒用 /dev 命令 |

### StatusLine

StatusLine 多行显示 (v3.13.0+):

```
████████░░ 76% | main | ↑2↓0 | !3M +2A | 15m
✓ Read ×12 | ✓ Edit ×3 | ✓ Bash ×5
Tasks: 2/5 (40%) | → 1 active | 2 pending
```

**第1行**: 上下文使用率 | 分支 | ahead/behind | 文件统计 | 会话时长
**第2行**: 工具使用统计 (Read/Edit/Bash/Grep)
**第3行**: 任务进度 (完成/总数 | 进行中 | 待处理)
**第4行**: Agent 状态 (如有运行中的 Agent)

**手动配置** (如需要):
```json
{
  "statusLine": {
    "type": "command",
    "command": "$HOME/.claude/plugins/marketplaces/lazyman-ian/dev-flow/scripts/statusline.sh",
    "padding": 0
  }
}
```

### Task Management

双向同步:
```bash
# 从 ledger 导出到 Task Management
/dev-flow:tasks export

# 从 Task Management 同步到 ledger
/dev-flow:tasks sync
```

---

## 平台支持

### 检测优先级

```
1. .dev-flow.json → 最高优先级（用户显式配置）
2. 文件检测 → 自动推断
   *.xcodeproj / Podfile / Package.swift → ios
   build.gradle → android
   package.json → web
   其他 → general
```

> **混合项目**（如 Svelte+Tauri 同时有 `package.json` 和 `Cargo.toml`）建议通过 `.dev-flow.json` 显式指定平台。

### 内置平台

| 平台 | 检测文件 | lint fix | lint check | test | verify |
|------|---------|----------|------------|------|--------|
| iOS | `*.xcodeproj`, `Podfile` | swiftlint --fix | swiftlint | xcodebuild test | swiftlint && xcodebuild build |
| Android | `build.gradle` | ktlint -F | ktlint | ./gradlew test | ktlintCheck && ./gradlew assembleDebug |
| Web | `package.json` | (自定义) | (自定义) | (自定义) | (自定义) |

### 自定义平台

通过 `.dev-flow.json` 可以为任何项目指定平台和命令，覆盖自动检测：

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

`.dev-flow.json` 中的 `platform` 字段同时影响：
- `dev_config` 命令输出
- 知识库注入（SessionStart 时加载对应平台的 pitfalls）
- `dev_memory` 知识分类

### 扩展新平台 (开发者)

1. `mcp-server/src/detector.ts` - 添加检测逻辑（`detectPlatformSimple()` 统一入口）
2. `mcp-server/src/platforms/xxx.ts` - 实现命令配置

---

## 版本历史

### v3.17.0 (2026-02-09)

- **知识整合引擎**: `dev_memory` 工具，闭合 Distill → Consolidate → Inject 循环
- **Smart Injection**: SessionStart 自动注入平台陷阱和任务相关知识 (~500 tokens)
- **Reasoning 持久化**: 双写到 `thoughts/reasoning/` + FTS5 索引
- **统一平台检测**: `detectPlatformSimple()` 统一 4 处检测逻辑，`.dev-flow.json` 优先级最高
- **新命令**: /extract-knowledge 完整实现

### v3.16.0 (2026-02-07)

- **agent-team**: 通用 Agent Team 编排技能
- **cross-platform-team**: 重构为扩展 agent-team
- **evaluate-agent**: 跨 session 基线 + Task 指标集成

### v3.13.0 (2026-01-27)

- **VDD**: Verification-Driven Development
- **Multi-Agent**: TaskCoordinator + HandoffHub
- **Knowledge Base**: 跨项目知识库
- **新命令**: /verify, /extract-knowledge
- **新工具**: dev_coordinate, dev_handoff, dev_aggregate
- **Hook 增强**: 平台知识加载, 绕过检测

### v3.11.0

- Meta-Iterate 自我迭代
- Task Management 双向同步
- Reasoning 记录

---

## 贡献指南

欢迎贡献！

1. Fork 仓库
2. 创建分支: `git checkout -b feature/xxx`
3. 使用 dev-flow 工作流开发:
   ```bash
   /dev-flow:start CONTRIB-001 "添加 Python 支持"
   # ... 开发 ...
   /dev-flow:commit
   /dev-flow:pr
   ```
4. 等待代码审查

### 扩展平台

最受欢迎的贡献是添加新平台支持:
- Python (ruff, black, mypy)
- Go (golangci-lint, gofmt)
- Rust (clippy, rustfmt)
- Node (eslint, prettier)

---

## License

MIT

---

> 有问题？欢迎提 Issue: https://github.com/lazyman-ian/dev-flow/issues
