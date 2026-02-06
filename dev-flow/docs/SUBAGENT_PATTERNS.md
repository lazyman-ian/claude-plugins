# Subagent Patterns Reference

Claude Code 子代理模式完整参考。

## 核心概念

| 概念 | 说明 |
|------|------|
| **Subagent** | 由主代理生成的独立代理实例，处理专注子任务 |
| **Task Tool** | 调用子代理的工具，需在 `allowed-tools` 中启用 |
| **Context Isolation** | 每个子代理维护独立 context，不污染主代理 |
| **Parallelization** | 多个子代理可并发运行 |

---

## Task Tool 参数

### 输入 Schema

```typescript
{
  description: string      // 3-5 字任务描述 (必需)
  prompt: string          // 代理执行的任务 (必需)
  subagent_type: string   // 专用代理名称 (必需)
  model?: string          // 模型选择: opus, sonnet, haiku
  run_in_background?: boolean  // 后台运行
  resume?: string         // 恢复之前的代理 ID
}
```

### 输出 Schema

```typescript
{
  result: string          // 子代理最终结果
  usage: dict | null      // Token 使用统计
  total_cost_usd: float   // 总成本 (USD)
  duration_ms: int        // 执行时长 (ms)
}
```

---

## 模型选择策略

| Model | 推荐用途 | 速度 | 成本 |
|-------|---------|------|------|
| `opus` | 复杂分析、高风险决策、安全审计 | 慢 | 高 |
| `sonnet` | 默认选择、大多数任务 | 中 | 中 |
| `haiku` | 快速简单任务、lint、格式化 | 快 | 低 |

### 成本优化模式

```python
# 渐进式模型复杂度
agents = {
    "linter": AgentDefinition(
        model="haiku",  # 快速便宜
        prompt="检查 lint 违规"
    ),
    "security-review": AgentDefinition(
        model="opus",   # 安全需要最强模型
        prompt="识别漏洞"
    )
}
```

---

## 工具限制模式

| 场景 | 推荐工具 | 用途 |
|------|---------|------|
| 只读分析 | `[Read, Grep, Glob]` | 代码审查、静态分析 |
| 测试执行 | `[Bash, Read, Grep]` | 运行测试、分析输出 |
| 代码修改 | `[Read, Edit, Write, Grep, Glob]` | 实现功能 |
| 完全访问 | 省略 tools 字段 | 继承所有父工具 |

---

## Context 管理

### Fork Context (推荐)

```yaml
# SKILL.md frontmatter
---
context: fork  # 创建隔离 context
---
```

**优点**:
- Context 隔离
- 防止主代理 context 污染
- 更清晰的任务边界

### Context 污染问题

```
❌ 无 Fork - Context 膨胀:
- Read file1 (50 tokens)
- Read file2 (50 tokens)
- Analysis (100 tokens)
→ 主代理看到所有 200 tokens

✅ 有 Fork - 干净分离:
- 子代理在隔离 context 操作
- 主代理只收到最终结果 (20 tokens)
→ 节省 180 tokens
```

---

## 调用模式

### 模式 1: 自动调用 (描述匹配)

Claude 根据 description 自动决定是否调用:

```python
agents = {
    "code-reviewer": AgentDefinition(
        description="Expert code reviewer. Use for quality, security reviews.",
        prompt="...",
    )
}

# 用户说 "review the code" 时自动调用 code-reviewer
```

### 模式 2: 显式调用 (保证执行)

在 prompt 中直接指定代理名:

```python
prompt = "Use the code-reviewer agent to check auth.py"
# 保证 code-reviewer 被调用
```

### 模式 3: 恢复之前的代理

```python
Task(
    resume="<agentId>",
    prompt="继续之前的分析，这次关注安全问题"
)
# 代理保留完整之前 context
```

---

## 编排流程图

```
Main Agent
    │
    ├─→ Task("Review code")
    │   └─→ code-reviewer subagent
    │       ├─ 隔离 context
    │       ├─ 限制工具: Read, Grep
    │       └─→ 结果: "发现 5 个问题"
    │
    ├─→ Task("Run tests")
    │   └─→ test-runner subagent
    │       ├─ 隔离 context
    │       ├─ 允许工具: Bash, Read
    │       └─→ 结果: "3 个失败"
    │
    └─→ 综合结果
        └─→ 主代理输出
```

---

## 最佳实践

### ✅ DO

1. **清晰的描述用于自动匹配**
   ```python
   description="Optimizes database queries and slow operations"
   ```

2. **渐进式模型复杂度**
   - 简单任务用 haiku
   - 复杂/安全任务用 opus

3. **工具访问控制**
   - 只读分析: 限制为 Read, Grep, Glob
   - 需要执行时才给 Bash

4. **Context Fork 隔离**
   ```yaml
   context: fork
   ```

5. **Handoff 文档**
   - 每个任务创建 handoff
   - 包含决策、文件、下一步

### ❌ DON'T

1. **模糊的描述**
   ```python
   description="Helps with stuff"  # 不会被正确触发
   ```

2. **子代理嵌套**
   - 子代理不能再生成子代理
   - 复杂编排在主代理层面处理

3. **忽略 context 管理**
   - 不用 fork 会污染主 context

4. **硬编码模型选择**
   - 应根据任务复杂度动态选择

---

## Skill Frontmatter 配置

### 子代理 Skill 模板

```yaml
---
name: implement-task
description: Implementation agent for single task. Internal skill used by orchestrator.
user-invocable: false    # 隐藏 slash 菜单
context: fork            # 隔离 context
model: opus              # 复杂任务用强模型
allowed-tools: [Read, Glob, Grep, Edit, Write, Bash, TodoWrite]
---
```

### 编排 Skill 模板

```yaml
---
name: implement-plan
description: Execute plans with agent orchestration.
context: fork            # 编排器也隔离
allowed-tools: [Read, Glob, Grep, Edit, Write, Bash, Task, TodoWrite]
---
```

---

## 错误处理

| 场景 | 行为 | 恢复策略 |
|------|------|---------|
| 子代理失败 | 主代理收到失败通知 | 重试或使用备用代理 |
| Context 溢出 | 截断或错误 | Fork + Resume 策略 |
| 工具不可用 | 工具被限制阻止 | 使用其他可用工具 |
| 模型不可用 | 回退到可用模型 | 优雅降级 |

---

## 限制

| 限制 | 影响 | 绕过方式 |
|------|------|---------|
| 子代理不能嵌套 | 无递归 | 主代理层面编排 |
| Windows 长 prompt 限制 | 8191 字符 | 分割 prompt 或用文件 |
| Context 窗口耗尽 | 完成慢或失败 | Fork + Resume 策略 |

---

## v2.1.x 相关更新

### v2.1.3

- 修复子代理在 context 压缩时使用错误模型
- 修复子代理 web search 使用错误模型

### v2.1.2

- SessionStart hook 增加 `agent_type` 字段
- 可用于检测是否在子代理中运行

```bash
AGENT_TYPE=$(echo "$INPUT" | jq -r '.agent_type // "main"')
if [[ "$AGENT_TYPE" != "main" ]]; then
    # 跳过子代理的重处理
    exit 0
fi
```

---

## 参考链接

- [Agent SDK Overview](https://docs.claude.com/en/docs/agent-sdk/overview)
- [Create Custom Subagents](https://code.claude.com/docs/en/sub-agents)
- [Claude Code Releases](https://github.com/anthropics/claude-code/releases)
