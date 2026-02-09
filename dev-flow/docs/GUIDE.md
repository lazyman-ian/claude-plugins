# dev-flow Plugin 完整指南

> Claude Code 开发工作流自动化插件 | v4.0.0

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

### Memory System 记忆系统

4 层渐进式记忆系统，从零成本到语义搜索：

| Tier | 功能 | Token 开销 | 依赖 |
|------|------|-----------|------|
| 0 | FTS5 全文搜索 + save/search/get | 0 (纯 SQLite) | 无 |
| 1 | + Session 自动总结 | ~$0.001/session | 可选 API key |
| 2 | + ChromaDB 语义搜索 | 同 Tier 1 | + chromadb |
| 3 | + 周期性观察捕获 | ~$0.005/session | 同 Tier 1 |

#### 知识闭环

```
┌─────────────────────────────────────────────────────────────┐
│                     Knowledge Loop                          │
│                                                             │
│  ┌──────────┐    自动注入     ┌──────────────┐              │
│  │SessionStart│──────────────▶│ System Prompt │              │
│  │  hook     │  pitfalls +    │ (~2500 tokens)│              │
│  └──────────┘  last summary   └──────┬───────┘              │
│       ▲                              │                      │
│       │                              ▼                      │
│  ┌──────────┐              ┌──────────────────┐             │
│  │ Knowledge │◀────────────│  Skill / Agent   │             │
│  │    DB     │   save()    │  自动 query()    │             │
│  │ (SQLite)  │             │  发现后 save()   │             │
│  └──────────┘              └────────┬─────────┘             │
│       ▲                             │                       │
│       │                             ▼                       │
│  ┌──────────┐              ┌──────────────────┐             │
│  │ Stop hook │◀─────────── │   Session 结束   │             │
│  │ 自动总结  │  Tier 1     └──────────────────┘             │
│  └──────────┘                       │                       │
│       ▲                             ▼                       │
│  ┌──────────┐              ┌──────────────────┐             │
│  │PostToolUse│◀─────────── │  每 N 次工具调用  │             │
│  │ 自动观察  │  Tier 3     └──────────────────┘             │
│  └──────────┘                                               │
└─────────────────────────────────────────────────────────────┘
```

#### 自动 vs 手动

| 操作 | 触发方式 | 说明 |
|------|---------|------|
| 知识注入 | **自动** SessionStart | 每次 session 开始注入 pitfalls + 任务知识 + 上次总结 |
| Skill/Agent 查询 | **自动** 开工前 | debug/plan/implement/validate/review 自动查询历史 |
| Skill/Agent 保存 | **半自动** 完工后 | 发现非显而易见的模式时自动保存 |
| Session 总结 | **自动** Stop hook | Tier 1+ session 结束时自动生成 |
| 观察捕获 | **自动** PostToolUse | Tier 3 每 N 次工具调用自动分类 |
| 知识整合 | **手动** consolidate | 大功能完成后运行一次 |
| 知识提取 | **手动** extract | 新项目初始化时运行一次 |

#### 存储位置

```
~/.claude/
├── knowledge/                      # 知识文件（consolidate 产出）
│   ├── platforms/                   #   平台相关 (ios/android)
│   ├── patterns/                    #   通用模式
│   └── discoveries/                 #   探索发现
└── cache/artifact-index/
    └── context.db                   # SQLite 数据库（所有 FTS5 索引）

<project>/
├── .dev-flow.json                   # Memory 配置（tier, options）
├── .claude/cache/artifact-index/
│   └── context.db                   # 项目级 DB（优先）
├── .git/claude/commits/<hash>/
│   └── reasoning.md                 # Commit 推理记录
└── thoughts/reasoning/
    └── <hash>-reasoning.md          # 推理记录副本（git 追踪）
```

| 数据 | 存储位置 | 生命周期 |
|------|---------|---------|
| 知识条目 | `context.db` → `knowledge` 表 | 持久，跨 session |
| 推理记录 | `context.db` → `reasoning` 表 + 文件 | 持久，跟随 git |
| 同义词 | `context.db` → `synonyms` 表 | 持久，自动种子 |
| Session 总结 | `context.db` → `session_summaries` 表 | 持久，Tier 1+ |
| 观察记录 | `context.db` → `observations` 表 | 持久，Tier 3 |
| 知识文件 | `~/.claude/knowledge/` | 持久，跨项目 |

#### 检查是否正常工作

```bash
# 查看 Memory 状态和统计
dev_memory(action='status')

# 查看知识条目数量
dev_memory(action='list')

# 搜索特定知识
dev_memory(action='search', query='concurrency')

# 直接查看 SQLite 数据
sqlite3 .claude/cache/artifact-index/context.db "SELECT COUNT(*) FROM knowledge;"
sqlite3 .claude/cache/artifact-index/context.db "SELECT id, title FROM session_summaries ORDER BY created_at_epoch DESC LIMIT 5;"
sqlite3 .claude/cache/artifact-index/context.db "SELECT type, title FROM observations ORDER BY created_at_epoch DESC LIMIT 5;"

# 检查知识文件
ls ~/.claude/knowledge/platforms/ ~/.claude/knowledge/patterns/ ~/.claude/knowledge/discoveries/
```

#### Tier 0: FTS5 全文搜索（默认）

零成本、纯 SQLite 的基础记忆层。

**做什么**：
- `save` — 保存知识条目到 `knowledge` 表，自动创建 FTS5 索引
- `search` — 轻量级搜索，返回 ID + 标题列表（不返回全文，省 token）
- `get` — 按 ID 获取完整内容（search → get 两步模式，节省 ~10x token）
- `consolidate` — 从 CLAUDE.md、ledger、reasoning 提取知识写入数据库
- SessionStart 自动注入：平台 pitfalls + 任务相关知识 + 最近 discoveries

**同义词扩展**：搜索 `crash` 自动扩展为 `(crash OR error OR exception OR panic OR abort)`，8 组内置映射。

**数据流**：
```
用户/Claude 调用 dev_memory(save) → knowledge 表 + FTS5 索引
SessionStart hook → FTS5 查询 → 注入到 system prompt (~2000 tokens)
```

**适合**：所有用户，零配置，零成本。

#### Tier 1: Session 自动总结

Session 结束时自动生成结构化总结，下次 session 可以快速了解上次做了什么。

**做什么**：
- Stop hook 在 session 结束时触发
- 有 API key → 调用 Haiku 生成 JSON 总结（request/investigated/learned/completed/next_steps）
- 无 API key → heuristic fallback：从 `git log --oneline` 提取 completed，从 `git diff --stat` 提取 investigated
- 总结写入 `session_summaries` 表 + FTS5 索引
- 下次 SessionStart 自动注入上次总结（~500 tokens budget）

**数据流**：
```
Session 结束 → Stop hook → Haiku API / heuristic
    → session_summaries 表 + FTS5
    → 下次 SessionStart 注入 "上次你在做 XXX，完成了 YYY，下一步 ZZZ"
```

**适合**：频繁切换 session、希望自动保持上下文连续性的用户。

#### Tier 2: ChromaDB 语义搜索

在 FTS5 关键词搜索基础上增加向量语义搜索，理解"意思相近"而不只是"词相同"。

**做什么**：
- `save`/`consolidate` 时同步写入 ChromaDB 向量数据库（fire-and-forget，不阻塞）
- `memorySearchAsync` 混合搜索：ChromaDB 语义 + FTS5 关键词，结果去重合并
- ChromaDB 未安装时 graceful degradation → 自动降级为纯 FTS5

**数据流**：
```
dev_memory(save) → knowledge 表 + FTS5 + ChromaDB 向量
dev_memory(search) → FTS5 关键词搜索（同步，快）
                   + ChromaDB 语义搜索（异步，准）
                   → 去重合并 → 返回排序结果
```

**依赖**：`pip install chromadb`（可选，不装也不影响其他功能）

**适合**：知识库较大（100+ 条目），需要模糊语义搜索的用户。

#### Tier 3: 周期性观察捕获

自动记录 Claude 的工作过程，不只记录"知道什么"，还记录"做了什么"。

**做什么**：
- PostToolUse hook 在每次工具调用后触发，累计计数
- 每 N 次（默认 10）触发一次批量处理
- 有 API key → Haiku 分类工具日志为结构化观察（type: decision/bugfix/feature/refactor/discovery）
- 无 API key → heuristic：按 Edit/Write → feature，Read-heavy → discovery 分类
- 观察写入 `observations` 表 + FTS5 索引

**数据流**：
```
每次工具调用 → PostToolUse hook → 计数器 +1，工具信息追加到日志
第 N 次 → 读取日志 → Haiku 分类 / heuristic 分类
       → observations 表 + FTS5
       → 可通过 search/query 检索
```

**适合**：希望自动积累项目历史、回溯"上次怎么解决这类问题"的用户。

#### 新用户初始化

安装 dev-flow 后，`claude --init` 自动执行:

1. Setup hook 创建 `.dev-flow.json`（包含 `"memory": { "tier": 0 }`）
2. 首次调用 `dev_memory` 时自动创建 SQLite 表和 FTS5 索引
3. 同义词自动种子（8 组默认映射：concurrency、auth、crash 等）

**零配置即可使用 Tier 0**。

#### 老用户迁移

如果已有 `.dev-flow.json`（setup hook 不会重复创建），手动添加 `memory` 字段：

```json
{
  "platform": "ios",
  "commands": { "fix": "...", "check": "..." },
  "scopes": ["ui", "api"],
  "memory": { "tier": 0 }
}
```

> 不添加也不影响使用 — `getMemoryConfig()` 默认 tier 0。添加后可以显式升级 tier。

#### Tier 升级路径

```jsonc
// Tier 1: Session 自动总结 (Stop hook → Haiku API 或 heuristic)
"memory": { "tier": 1, "sessionSummary": true }

// Tier 2: 语义搜索 (需要安装 chromadb: pip install chromadb)
"memory": { "tier": 2, "sessionSummary": true, "chromadb": true }

// Tier 3: 周期性捕获 (每 N 次工具调用自动分类)
"memory": { "tier": 3, "sessionSummary": true, "chromadb": true, "periodicCapture": true, "captureInterval": 10 }
```

#### API Key 配置（可选）

Tier 1/3 的 Haiku 调用需要 API key，但**无 key 也能用**（heuristic fallback 从 git log 提取摘要）：

```bash
# 方式 1: 注册 API 账号 (console.anthropic.com)，充 $5
export ANTHROPIC_API_KEY=sk-ant-...  # 加到 ~/.zshrc

# 方式 2: 无 key（自动使用 heuristic 模式，质量低但零成本）
```

#### 使用 MCP 工具

```bash
# 保存知识
dev_memory(action='save', text='@Sendable 闭包不能捕获可变状态', title='Swift 并发陷阱', tags=['swift', 'concurrency'])

# 搜索 (轻量级，返回 ID + 标题)
dev_memory(action='search', query='concurrency pitfalls', limit=5)

# 获取完整内容
dev_memory(action='get', ids=['knowledge-xxx'])

# 合并历史知识
dev_memory(action='consolidate')

# 查看状态
dev_memory(action='status')
```

#### 自动化行为

| Tier | 自动行为 | 时机 |
|------|---------|------|
| 0 | SessionStart 注入知识 (~2500 tokens) | 每次 session 开始 |
| 1 | 生成 session 总结写入 DB | Stop hook (session 结束) |
| 2 | ChromaDB 语义索引同步 | save/consolidate 时 |
| 3 | 批量观察捕获分类 | 每 N 次工具调用 |

#### Tips

**Memory 维护**

| 命令 | 何时使用 | 频率 |
|------|---------|------|
| `dev_memory(action='consolidate')` | 将 CLAUDE.md pitfalls、ledger 决策、reasoning 模式提取入库 | 每完成一个大功能后运行一次 |
| `/dev-flow:extract-knowledge` | 扫描项目文件提取可复用知识（首次或大版本后） | 新项目初始化 / 大版本升级后运行一次 |

> 日常使用无需手动调用 — skill/agent 自动查询和保存知识，session 总结自动生成。以上两个命令仅用于定期维护和一次性迁移。

**Claude Code CLI**

| 操作 | 命令 | 说明 |
|------|------|------|
| 初始化项目 | `claude` 后 `/init` | 触发 Setup hook，自动创建 `.dev-flow.json`（含 memory 配置） |
| 清除上下文 | `/clear` | context > 70% 时使用，ledger 自动恢复状态 |
| 压缩上下文 | `/compact` | 保留关键信息压缩 context，自动触发 PreCompact hook 备份 |
| 查看插件状态 | `/plugins` | 确认 dev-flow 加载正常 |
| 查看 MCP 工具 | `claude mcp list` | 确认 dev-flow MCP server 连接正常 |
| Delegate 模式 | `Shift+Tab` | 3+ teammates 时限制 lead 为纯协调角色 |
| 引用文件 | `#filename` | 将文件内容加入 context，搭配 memory 查询更高效 |

#### 数据库架构

所有数据存储在 `.claude/cache/artifact-index/context.db`：

| 表 | 用途 | Tier |
|----|------|------|
| knowledge + knowledge_fts | 知识条目 | 0 |
| reasoning + reasoning_fts | 推理记录 | 0 |
| synonyms | 同义词扩展 (FTS5 查询增强) | 0 |
| session_summaries + _fts | Session 总结 | 1 |
| observations + _fts | 观察记录 | 3 |

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
| Setup | 首次初始化 | 配置 dev-flow 环境 + memory |
| SessionStart | 恢复 session | 加载 ledger + 平台知识 + 上次总结 |
| PreCompact | 压缩前 | 备份 transcript |
| Stop | session 结束 | 生成 session 总结 (Tier 1+) |
| PostToolUse | 工具执行后 | 工具计数 + 提醒 + 周期性观察 (Tier 3) |

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

### v4.0.0 (2026-02-09)

- **4-Tier Memory System**: 渐进式记忆 — Tier 0 (FTS5) → Tier 1 (Session 总结) → Tier 2 (ChromaDB) → Tier 3 (观察捕获)
- **新 MCP 操作**: `dev_memory` 增加 save/search/get — 3 层搜索模式（轻量索引 → 完整内容）
- **FTS5 同义词扩展**: 8 组默认同义词（concurrency、auth、crash 等），查询自动扩展
- **Session 总结 (Stop hook)**: Haiku API 或 heuristic fallback（订阅用户无需 API key）
- **周期性观察 (PostToolUse)**: 每 N 次工具调用自动分类为 decision/bugfix/feature/discovery
- **ChromaDB 语义搜索**: 可选，graceful degradation（未安装时纯 FTS5）
- **Setup hook 升级**: 新项目自动包含 `memory: { tier: 0 }` 配置
- **Context Injector 增强**: 上次 session 总结注入（budget 2500 tokens）

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
