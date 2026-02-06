# Claude Code 配置优化指南

持续收集的配置优化经验和最佳实践。

## 信息来源

### 官方渠道

| 来源 | URL | 更新频率 |
|------|-----|---------|
| **Release Notes** | https://github.com/anthropics/claude-code/releases | 每次发布 |
| **官方博客** | https://claude.ai/blog | 不定期 |
| **官方文档** | https://docs.anthropic.com/en/docs/claude-code | 持续更新 |

### 监控方式

```bash
# GitHub Release 通知
# 1. Star + Watch 仓库: https://github.com/anthropics/claude-code
# 2. 设置 Watch → Custom → Releases

# RSS Feed (可选)
# https://github.com/anthropics/claude-code/releases.atom
```

---

## Skill 开发最佳实践

### Frontmatter 必需字段

```yaml
---
name: skill-name              # lowercase, hyphens
description: [What]. Use when user says "[triggers]", "[中文触发词]".
allowed-tools: [Read, Bash]   # 限制工具访问
---
```

### 可选字段

| 字段 | 用途 | 示例 |
|------|------|------|
| `model` | 指定模型 | `opus`, `haiku` |
| `context: fork` | 隔离 context | 复杂 agent |
| `user-invocable: false` | 隐藏 slash 菜单 | 内部 helper |
| `disable-model-invocation: true` | 禁止自动触发 | 危险操作 |

### Context Fork 实战应用

| 场景 | 示例 Skill | 为什么需要 Fork |
|------|-----------|----------------|
| 多阶段复杂 workflow | `meta-iterate` | 5 个阶段避免污染主 context |
| Agent orchestration | `implement-plan` | 编排多个子 agent，隔离实现细节 |
| 内部 helper agent | `implement-task` | 被编排调用，不应影响主流程 |
| 外部研究/验证 | `validate-agent` | WebSearch 结果不应进入主 context |

**判断标准**：
- ✅ 需要 fork: 多步骤（>3）、生成大量临时 context、被其他 agent 调用
- ❌ 不需要 fork: 简单查询、用户直接交互、需要保留 context

### user-invocable 使用场景

| 设置 | 何时使用 | 示例 |
|------|---------|------|
| `true`（默认） | 用户可以直接调用 | `/dev`, `/config-optimize` |
| `false` | 仅被其他 agent 调用 | `implement-task`, `validate-agent` |
| `false` + description 有触发词 | Claude 可自动触发，但不显示在菜单 | 内部优化 helper |

**Anti-pattern**: 所有 skills 都设置 `user-invocable: false`，导致用户无法发现功能。

### Progressive Loading 架构

```
skill/
├── SKILL.md              # < 150 行，精简概览
└── references/
    ├── templates.md      # 完整模板
    ├── workflow.md       # 详细流程
    └── examples.md       # 使用示例
```

**原则**: SKILL.md 只包含概览 + Reference Menu，详细内容按需加载。

### Description 编写要点

1. 第一句说明功能
2. 列出触发场景
3. 包含中英文触发词

```yaml
# ✅ Good
description: Validate plan tech choices against best practices. Use when user says "validate plan", "check tech", "验证方案".

# ❌ Bad
description: Helps with validation  # 太模糊
```

---

## Hook 开发最佳实践

### 9 种 Hook 类型

| Hook | 触发 | 可阻止 | 主要用途 |
|------|-----|--------|---------|
| **Setup** | `--init`, `--maintenance` | ❌ | 初始化配置（v2.1.10+）|
| PreToolUse | 工具执行前 | ✅ | 阻止/修改工具调用 |
| PostToolUse | 工具执行后 | 部分 | 格式化/lint |
| UserPromptSubmit | 用户发送 | ✅ | 注入上下文 |
| PermissionRequest | 权限对话框 | ✅ | 自动批准/拒绝 |
| SessionStart | 会话开始 | ❌ | 加载上下文 |
| Stop | Claude 完成 | ✅ | 强制继续 |
| SubagentStop | 子 agent 完成 | ✅ | 验证输出 |
| PreCompact | 压缩前 | ❌ | 保存状态 |

### Setup Hook (v2.1.10+)

在 `claude --init` 或 `--maintenance` 时自动执行，适合：
- 自动生成配置文件（如 `.dev-flow.json`）
- 平台检测和初始化
- 项目 onboarding

```bash
#!/bin/bash
# hooks/setup-dev-flow.sh
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# 检测平台并生成配置
if [[ -f "$PROJECT_DIR/Package.swift" ]]; then
    echo '{"platform": "ios", ...}' > "$PROJECT_DIR/.dev-flow.json"
fi

echo '{"result": "continue", "message": "✅ Created .dev-flow.json"}'
```

### SessionStart 优化 (v2.1.2+)

```bash
# 检查 agent_type，跳过非主 agent
AGENT_TYPE=$(echo "$INPUT" | jq -r '.agent_type // "main"')
if [[ "$AGENT_TYPE" != "main" ]]; then
    echo '{"result": "continue"}'
    exit 0
fi
```

### Matcher 语法

```json
{
  "matcher": "Write|Edit",           // 多个工具
  "matcher": "*",                    // 所有工具
  "matcher": "Bash(npm test*)",      // 带参数
  "matcher": "mcp__memory__.*"       // MCP 工具
}
```

### PreToolUse additionalContext (v2.1.9+)

返回 `additionalContext` 字段可向 Claude 注入额外上下文：

```bash
#!/bin/bash
# hooks/pre-tool-context.sh
INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null)

# 只处理特定工具
case "$TOOL_NAME" in
    Edit|Write|Bash) ;;
    *) echo '{"decision": "approve"}'; exit 0 ;;
esac

# 收集上下文
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
FOCUS=$(grep -m1 "Now:" thoughts/ledgers/CONTINUITY_*.md 2>/dev/null | head -1)
SESSION_ID="${CLAUDE_SESSION_ID:-unknown}"

# 构建上下文字符串
CONTEXT="Branch: $BRANCH | Focus: $FOCUS | Session: $SESSION_ID"

# 返回带 additionalContext 的响应
echo "{\"decision\": \"approve\", \"additionalContext\": $(echo "$CONTEXT" | jq -Rs .)}"
```

**配置示例**：

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Edit|Write|Bash",
      "hooks": [{
        "type": "command",
        "command": "$HOME/.claude/hooks/pre-tool-context.sh",
        "timeout": 5
      }]
    }]
  }
}
```

**适用场景**：
- 注入当前分支/任务上下文
- 添加 Session ID 用于追踪
- 提供 ledger 焦点信息

### Plugin Commit SHA Pinning (v2.1.14+)

锁定插件到特定 commit SHA，避免自动更新带来的不兼容：

```json
{
  "enabledPlugins": {
    "context7@claude-plugins-official": ["e30768372b41"],
    "typescript-lsp@claude-plugins-official": ["ee2f7266264580ef92b04e6d02980396e0336fb5"]
  }
}
```

**获取 SHA 方法**：
```bash
# 查看已安装插件的 SHA
ls ~/.claude/plugins/*/

# 或从 GitHub 获取最新稳定版
gh api repos/anthropics/claude-plugins-official/commits --jq '.[0].sha[:12]'
```

**使用场景**：
| 场景 | 推荐 |
|------|------|
| 生产环境 | ✅ Pin 到已测试的 SHA |
| 开发环境 | 可不 pin，享受更新 |
| 团队项目 | ✅ Pin 确保一致性 |

### 环境变量配置

| 变量 | 版本 | 用途 |
|------|------|------|
| `CLAUDE_CODE_TMPDIR` | v2.1.5+ | 自定义临时目录 |
| `CLAUDE_SESSION_ID` | v2.1.9+ | 当前会话 ID |
| `FORCE_AUTOUPDATE_PLUGINS` | v2.1.2+ | 强制插件自动更新 |

```json
{
  "env": {
    "CLAUDE_CODE_TMPDIR": "/tmp/claude-code"
  }
}
```

---

## Skill Description 优化

### 触发词策略

Description 是 Claude 决定是否触发 skill 的关键。

**模式**：
```yaml
description: [功能描述]. Use when user says "[English triggers]", "[中文触发词]".
```

**示例对比**：

| 类型 | 示例 | 触发率 |
|------|------|--------|
| ❌ 模糊 | "Helps with development" | ~10% |
| ⚠️ 一般 | "Development workflow for commits" | ~40% |
| ✅ 优秀 | "Development workflow hub for git operations, commits, PRs, and releases. Use when user says \"commit\", \"push\", \"create PR\", \"提交代码\", \"创建PR\"." | ~80% |

### 必须包含的元素

1. **功能描述**（第一句）
2. **触发场景**（Use when...）
3. **英文触发词**
4. **中文触发词**
5. **Slash 命令**（如适用）

### 实战优化案例

```yaml
# Before
description: Create implementation plans.

# After
description: Create detailed implementation plans through interactive research.
  Use when user wants to plan a feature, design architecture, or prepare
  implementation strategy. Triggers on "create plan", "implementation plan",
  "设计方案", "制定计划", "plan feature".
```

### 常见触发词

| 类别 | 英文 | 中文 |
|------|------|------|
| 提交 | commit, push, save changes | 提交, 推送, 保存 |
| PR | create PR, pull request, review | 创建PR, 合并请求 |
| 计划 | plan, design, architect | 计划, 设计, 方案 |
| 发布 | release, deploy, publish | 发布, 部署, 上线 |
| 优化 | optimize, improve, enhance | 优化, 改进, 提升 |

---

## StatusLine 增强

### 多行格式 (v3.13.0+)

```
████████░░ 76% | main | ↑2↓0 | !3M +2A | 15m
✓ Read ×12 | ✓ Edit ×3 | ✓ Bash ×5
Tasks: 2/5 (40%) | → 1 active | 2 pending
```

**第1行**: 上下文可视化进度条 | 分支 | ahead/behind | 文件统计(M/A/D) | 会话时长
**第2行**: 工具使用统计 (Read/Edit/Bash/Grep 计数)
**第3行**: 任务进度 (完成/总数 | 进行中 | 待处理)
**第4行**: Agent 状态 (名称: 任务描述 时长)

### 旧版单行格式

```
45.2K 23% | main [DEV] ±6 | focus
```

### 增强格式 (v2.1.6+)

```
45.2K 23% $0.12 | main [DEV] +120/-30 ±6 | focus
```

新字段：
- **Cost**: `$0.12` - 当前会话费用
- **Code Delta**: `+120/-30` - 代码行增减

### 实现示例

```bash
# 费用追踪 - JSON 字段或 token 估算
session_cost=$(echo "$input" | jq -r '.cost.session_cost // -1' 2>/dev/null)
if [[ "$session_cost" != "-1" && "$session_cost" != "null" ]]; then
    cost_display="\$$(printf "%.2f" "$session_cost")"
elif [[ "$total_tokens" -gt 0 ]]; then
    # 回退: 从 tokens 估算 (~$3/1M for Sonnet)
    estimated_cost=$(awk "BEGIN {printf \"%.2f\", $total_tokens * 0.000003}")
    [[ "$estimated_cost" != "0.00" ]] && cost_display="~\$$estimated_cost"
fi

# 代码增减 - JSON 字段或 git diff
lines_added=$(echo "$input" | jq -r '.code_delta.lines_added // -1' 2>/dev/null)
if [[ "$lines_added" != "-1" && "$lines_added" != "null" ]]; then
    lines_removed=$(echo "$input" | jq -r '.code_delta.lines_removed // -1' 2>/dev/null)
    code_delta="+${lines_added}/-${lines_removed}"
else
    # 回退: 从 git diff 计算
    diff_stat=$(git diff --shortstat 2>/dev/null)
    added=$(echo "$diff_stat" | grep -oE '[0-9]+ insertion' | grep -oE '[0-9]+' || echo "0")
    removed=$(echo "$diff_stat" | grep -oE '[0-9]+ deletion' | grep -oE '[0-9]+' || echo "0")
    [[ "$added" -gt 0 || "$removed" -gt 0 ]] && code_delta="+${added}/-${removed}"
fi
```

**注意**: `.cost.session_cost` 和 `.code_delta.*` 字段可能不在所有版本的 StatusLine 输入中可用，建议实现回退方案。

### Context 使用率

```bash
# v2.1.6+ 内置百分比
used_pct=$(echo "$input" | jq -r '.context_window.used_percentage // -1')

# 颜色编码
if [[ "$context_pct" -ge 80 ]]; then
    ctx_display="\033[31m⚠ ${token_display} ${context_pct}%\033[0m"  # 红色警告
elif [[ "$context_pct" -ge 60 ]]; then
    ctx_display="\033[33m${token_display} ${context_pct}%\033[0m"    # 黄色提醒
else
    ctx_display="\033[32m${token_display} ${context_pct}%\033[0m"    # 绿色正常
fi
```

---

## 版本更新记录

### v2.1.16-17 (2026-01)

| 特性 | 配置变更 |
|------|---------|
| **Task Management** | 新工具 `TaskCreate`, `TaskUpdate`, `TaskList` |
| 依赖追踪 | 任务间 `blocks`/`blockedBy` 关系 |
| VSCode 插件管理 | 原生支持 |

### v2.1.14 (2026-01)

| 特性 | 配置变更 |
|------|---------|
| **历史自动补全** | bash 模式 `!` + Tab |
| **插件 Pin** | `enabledPlugins: {"name": ["sha"]}` |
| `/usage` 命令 | VSCode 显示用量 |

### v2.1.9 (2026-01)

| 特性 | 配置变更 |
|------|---------|
| **`plansDirectory`** | 自定义 plan 存储位置 |
| **PreToolUse `additionalContext`** | Hook 返回额外上下文 |
| **`${CLAUDE_SESSION_ID}`** | Skill 中的替换变量 |
| `auto:N` MCP 阈值 | 工具搜索自动启用 |

### v2.1.6 (2026-01)

| 特性 | 配置变更 |
|------|---------|
| **context_window 状态字段** | `used_percentage`, `remaining_percentage` |
| `/config` 搜索 | 配置内搜索 |
| `/doctor` 更新检查 | 检测新版本 |
| `/stats` 日期过滤 | 7天/30天/全部 |
| 自动 skill 发现 | nested `.claude/skills/` |

### v2.1.5 (2026-01)

| 特性 | 配置变更 |
|------|---------|
| **`CLAUDE_CODE_TMPDIR`** | 自定义临时目录 |

### v2.1.3 (2026-01)

| 特性 | 配置变更 |
|------|---------|
| Skills/Commands 合并 | 删除重复 command 文件 |
| Hook timeout 10min | 增加长 hook 超时 |
| 死规则检测 | `/doctor` 检查 |

### v2.1.2 (2026-01)

| 特性 | 配置变更 |
|------|---------|
| `agent_type` in SessionStart | 跳过子 agent 重处理 |
| `FORCE_AUTOUPDATE_PLUGINS` | settings.json env |

---

## Task Management (v2.1.16+)

### 新工具

| 工具 | 用途 |
|------|------|
| `TaskCreate` | 创建任务（subject, description, activeForm）|
| `TaskUpdate` | 更新任务状态/依赖 |
| `TaskList` | 列出所有任务 |
| `TaskGet` | 获取任务详情 |

### 任务状态

```
pending → in_progress → completed
```

### 依赖追踪

```python
# 设置依赖关系
TaskUpdate(taskId="2", addBlockedBy=["1"])  # 任务 2 被任务 1 阻塞
TaskUpdate(taskId="1", addBlocks=["2"])     # 任务 1 阻塞任务 2
```

### 使用场景

| 场景 | 推荐 |
|------|------|
| 简单任务（1-3 步） | 不使用 TaskCreate |
| 中等任务（4-7 步） | 使用，最多 4 次更新 |
| 复杂任务（8+ 步） | 使用，最多 6 次更新 |

### 与 TodoWrite 对比

| 特性 | TaskCreate/Update | TodoWrite |
|------|-------------------|-----------|
| 依赖追踪 | ✅ | ❌ |
| 任务分配 | ✅ (owner) | ❌ |
| 状态查询 | ✅ (TaskGet) | ❌ |
| Token 效率 | 更高 | 较低 |

**建议**: v2.1.16+ 优先使用 Task Management 替代 TodoWrite。

---

## Subagent 最佳实践

### Task Tool 参数

```python
Task(
  description="3-5 字描述",     # 必需
  prompt="详细任务说明",        # 必需
  subagent_type="general-purpose",  # 必需
  model="sonnet",              # 可选: opus, sonnet, haiku
  run_in_background=False,     # 可选: 后台运行
  resume="<agentId>"           # 可选: 恢复之前的代理
)
```

### 模型选择策略

| 任务类型 | 推荐模型 | 原因 |
|---------|---------|------|
| 简单搜索/lint | `haiku` | 快速、低成本 |
| 标准实现 | `sonnet` | 平衡 (默认) |
| 复杂分析/安全 | `opus` | 最强能力 |

### 实战案例（dev-flow-plugin）

| Skill | 模型 | 为什么 |
|-------|------|--------|
| `config-optimize` | `haiku` | 轻量级配置检查，快速响应 |
| `validate-agent` | `haiku` | 简单验证逻辑，外部研究已在 WebSearch |
| `dev` | `sonnet` | 标准工作流，需要理解 git 状态 |
| `create_plan` | `opus` | 复杂规划，需要深度思考和架构设计 |
| `implement-plan` | `opus` | 编排多个 agent，需要全局决策能力 |
| `meta-iterate` | `opus` | 5 阶段分析，需要元认知和自我改进 |

**成本优化要点**：
- ✅ 70% 任务用 sonnet（默认）
- ✅ 20% 简单任务用 haiku（快速+便宜）
- ✅ 10% 关键任务用 opus（质量优先）

### 工具限制模式

| 场景 | 推荐工具 |
|------|---------|
| 只读分析 | `[Read, Grep, Glob]` |
| 测试执行 | `[Bash, Read, Grep]` |
| 代码修改 | `[Read, Edit, Write, Bash]` |
| 研究收集 | `[WebSearch, WebFetch, Read]` |

### Context Fork

```yaml
# SKILL.md frontmatter
---
context: fork  # 隔离 context，防止污染主代理
---
```

**优点**:
- 子代理 context 不污染主代理
- 节省主代理 context 窗口
- 更清晰的任务边界

### Resume 能力

```python
# 恢复之前的代理，保留完整 context
Task(
  resume="<agentId>",
  prompt="继续之前的分析..."
)
```

### 并行执行

```python
# 同一消息中生成多个 Task（无依赖时）
Task(description="Task 1", ...)
Task(description="Task 2", ...)
```

### 限制

- ❌ 子代理不能嵌套（不能再生成子代理）
- ❌ Windows 长 prompt 限制 8191 字符

详见: `docs/SUBAGENT_PATTERNS.md`

---

## CLAUDE.md 最佳实践

### 推荐章节

| 章节 | 内容 |
|------|------|
| Quick Reference | 常用命令表格 |
| Directory Structure | 带注释的目录树 |
| Standards | 代码规范 |
| Skills | 可用 skill 列表 |

### 反模式

- ❌ 超过 500 行
- ❌ 重复代码中的信息
- ❌ 包含 API key/secrets
- ❌ 过时文档

---

## 优化检查清单

### Skill 检查

- [ ] `name` 字段存在
- [ ] `description` 包含触发词 (EN + CN)
- [ ] `allowed-tools` 限制不必要工具
- [ ] SKILL.md < 150 行（推荐 < 100 行）
- [ ] 复杂内容移到 references/
- [ ] `context: fork` 用于复杂/多阶段 workflow
- [ ] `user-invocable: false` 用于内部 helper
- [ ] `model` 字段根据任务复杂度选择（haiku/sonnet/opus）

### Hook 检查

- [ ] SessionStart 检查 `agent_type`（跳过子 agent）
- [ ] 使用 `${CLAUDE_PLUGIN_ROOT}` 或 `$CLAUDE_PROJECT_DIR` 路径
- [ ] 错误处理完善（`set -o pipefail`，避免 `set -e`）
- [ ] 超时设置合理（v2.1.3+ 支持 10min）
- [ ] 使用 `jq` 解析 JSON 输入

### 规则检查

- [ ] 运行 `/doctor` 检查死规则
- [ ] 规则文件 < 200 行
- [ ] 无冲突规则

### MCP Server 检查

- [ ] `npm run bundle` 生成 scripts/*.cjs
- [ ] .mcp.json 指向 bundle 文件（非 dist/）
- [ ] 工具提供 compact 输出（< 50 tokens）
- [ ] 平台检测自动化（无需用户配置）
- [ ] Token 优化（默认最小输出）

---

## MCP Server 最佳实践

### Bundle vs 源码

| 环境 | 使用文件 | 构建方式 |
|------|---------|---------|
| **生产（plugin）** | `scripts/mcp-server.cjs` | `npm run bundle` |
| **开发** | `dist/*.js` | `npm run build` |
| **调试** | `src/*.ts` | `npm run dev` |

### Bundle 优势

- ✅ 单文件，无 node_modules 依赖
- ✅ 启动快（无 TypeScript 编译）
- ✅ 分发简单（只需一个 .cjs 文件）
- ✅ 兼容性好（CJS 格式）

### 配置示例

```json
// .mcp.json
{
  "mcpServers": {
    "dev-flow": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/scripts/mcp-server.cjs"]
    }
  }
}
```

### 开发流程

```bash
# 1. 修改 TypeScript 源码
vim mcp-server/src/index.ts

# 2. 测试（开发模式）
npm run dev

# 3. Bundle（生产）
npm run bundle

# 4. 验证 bundle
node scripts/mcp-server.cjs
```

### Token 优化模式

MCP 工具应提供多种输出级别：

| 工具 | Compact | Standard | Verbose |
|------|---------|----------|---------|
| `dev_status` | ~30 tokens | ~100 tokens | ~200 tokens |
| `dev_flow` | N/A | ~100 tokens | ~150 tokens |
| `dev_config` | ~50 tokens | N/A | N/A |

**设计原则**：
- 默认 compact（最常用场景）
- Verbose 选项（调试时）
- JSON 格式（机器处理）

### 平台检测自动化

```typescript
// detector.ts 示例
export function detectPlatform(projectDir: string): Platform {
  if (hasFiles(projectDir, ['*.xcodeproj', 'Podfile'])) return 'ios';
  if (hasFiles(projectDir, ['build.gradle', 'AndroidManifest.xml'])) return 'android';
  if (hasFiles(projectDir, ['package.json'])) return 'web';
  if (hasFiles(projectDir, ['pyproject.toml', 'requirements.txt'])) return 'python';
  if (hasFiles(projectDir, ['go.mod'])) return 'go';
  if (hasFiles(projectDir, ['Cargo.toml'])) return 'rust';
  return 'unknown';
}
```

**扩展新平台**：只需在 `detector.ts` 添加检测规则，`platforms/xxx.ts` 实现命令映射。

---

## 自动化工具

### /config-optimize

定期运行检查新特性:

```bash
/config-optimize          # 完整优化流程
/config-optimize check    # 仅检查
```

### /meta-iterate

分析会话性能优化提示:

```bash
/meta-iterate            # 完整 5 阶段流程
```

---

## 贡献指南

发现新的优化模式时:

1. 更新 `docs/OPTIMIZATION_GUIDE.md`
2. 更新 `skills/config-optimize/references/version-history.md`
3. 如果是重要模式，考虑创建新 rule

## 参考链接

- [Claude Code Releases](https://github.com/anthropics/claude-code/releases)
- [Skills Explained](https://claude.ai/blog/skills-explained)
- [How to Configure Hooks](https://claude.ai/blog/how-to-configure-hooks)
- [Using CLAUDE.md Files](https://claude.ai/blog/using-claude-md-files)
