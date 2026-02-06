# Agent Orchestration Reference

Complete guide for compaction-resistant agent orchestration.

## Why Agent Orchestration?

**The Problem:** During long implementations, context accumulates. If auto-compact triggers mid-task, you lose implementation context.

**The Solution:** Delegate implementation to agents. Each agent:
- Starts with fresh context (via `context: fork`)
- Implements one task
- Creates a handoff on completion
- Returns to orchestrator

Handoffs persist on disk. If compaction happens, re-read handoffs and continue.

---

## Model Selection Strategy

| Task Type | Model | Rationale |
|-----------|-------|-----------|
| Simple lint/format | `haiku` | Fast, low cost |
| Standard implementation | `sonnet` | Balanced (default) |
| Complex logic/security | `opus` | Maximum capability |

### Cost Optimization

```python
# 渐进式模型选择
Task(model="haiku", ...)   # 快速验证任务
Task(model="sonnet", ...)  # 常规实现
Task(model="opus", ...)    # 复杂架构决策
```

---

## Tool Restriction Patterns

| 任务类型 | 推荐工具 | 原因 |
|---------|---------|------|
| 代码审查 | `[Read, Grep, Glob]` | 只读，防止意外修改 |
| 测试执行 | `[Bash, Read, Grep]` | 需要执行但不改代码 |
| 实现功能 | `[Read, Edit, Write, Bash, Grep, Glob]` | 完整读写 |
| 研究分析 | `[Read, Grep, WebSearch]` | 信息收集 |

---

## Setup

### 1. Create Handoff Directory

```bash
mkdir -p thoughts/handoffs/<session-name>
```

### 2. Read Task Executor Reference

```bash
# See references/task-executor.md for TDD workflow
```

---

## Pre-Requisite: Plan Validation

Check for validation handoff:
```bash
ls thoughts/handoffs/<session>/validation-*.md
```

If no validation: "Would you like me to spawn validate-agent first?"

---

## Orchestration Loop

### 1. Prepare Agent Context

- Read continuity ledger
- Read the plan
- Read previous handoff if exists
- Identify the specific task

### 2. Spawn Implementation Agent

```python
Task(
  description="Implement task N",  # 3-5 字描述
  subagent_type="general-purpose",
  model="opus",                    # 根据任务复杂度选择
  prompt="""
  [Paste implement_task/SKILL.md contents]

  ---

  ## Your Context

  ### Continuity Ledger:
  [Paste ledger content]

  ### Plan:
  [Paste relevant plan section]

  ### Your Task:
  Task [N] of [Total]: [Task description]

  ### Previous Handoff:
  [Previous task's handoff or "This is the first task"]

  ### Handoff Directory:
  thoughts/handoffs/<session-name>/

  ### Handoff Filename:
  task-[NN]-[short-description].md

  ---

  Implement your task and create your handoff.
  """
)
```

### 3. Process Agent Result

- Read agent's handoff file
- Update ledger checkbox: `[x] Task N`
- Update plan checkbox if applicable
- Continue to next task

### 4. Handle Failure/Blocker

- Read the handoff (status will be "blocked")
- Present blocker to user
- Options: retry, skip, or ask user

---

## Resume Capability

### 恢复之前的代理

```python
Task(
  resume="<agentId>",  # 从 handoff 或 agent-log.jsonl 获取
  prompt="继续实现，这次关注 X 问题"
)
```

代理保留完整之前 context，适用于：
- 需要澄清时恢复 plan-agent
- 调试时恢复失败的 implement-agent
- 增量添加功能

### 获取 Agent ID

```bash
# 从 agent log 获取
cat .claude/cache/agents/agent-log.jsonl | jq -r '.agentId'

# 或从返回消息获取
# Task 完成后返回 agentId: xxx
```

---

## Context Fork 机制

### 为什么需要 Fork

```
❌ 无 Fork - Context 污染:
主代理: Read file1 + Read file2 + Analysis
→ 累积 500 tokens

✅ 有 Fork - 隔离 Context:
子代理: Read file1 + Read file2 + Analysis (隔离)
→ 主代理只收到结果 50 tokens
```

### Skill 配置

```yaml
---
context: fork  # 子代理使用隔离 context
---
```

---

## Recovery After Compaction

1. Read continuity ledger (loaded by SessionStart hook)
2. List handoff directory:
   ```bash
   ls -la thoughts/handoffs/<session-name>/
   ```
3. Read last handoff to understand state
4. Continue from next uncompleted task

---

## Handoff Chain

```
task-01-user-model.md
    ↓ (read by agent 2)
task-02-auth-middleware.md
    ↓ (read by agent 3)
task-03-login-endpoint.md
    ...
```

Chain preserves context even across compactions.

---

## Parallel Execution (高级)

多个独立任务可并行:

```python
# 并行生成多个 Task 调用
Task(description="Task 1: Setup schema", ...)
Task(description="Task 2: Create types", ...)  # 同一消息中
```

**注意**: 仅适用于无依赖的任务。有依赖时必须顺序执行。

---

## When to Use Agent Orchestration

| Scenario | Mode |
|----------|------|
| 1-3 simple tasks | Direct implementation |
| 4+ tasks | Agent orchestration |
| Critical context to preserve | Agent orchestration |
| Quick bug fix | Direct implementation |
| Major feature implementation | Agent orchestration |

---

## Best Practices

### ✅ DO

- **Keep orchestrator thin**: Don't implement, only manage
- **Trust handoffs**: Use them for context passing
- **One agent per task**: Don't batch
- **Sequential by default**: Parallel adds complexity
- **Update ledger**: After each task completion
- **Select model wisely**: haiku for simple, opus for complex

### ❌ DON'T

- Nest subagents (not supported)
- Skip handoff creation
- Ignore tool restrictions
- Use opus for everything (cost)

---

## Error Handling

| 错误 | 处理 |
|-----|------|
| Agent 失败 | 读取 handoff (status: blocked)，决定重试/跳过 |
| Context 溢出 | Fork + Resume 策略 |
| 工具被阻止 | 检查 allowed-tools 配置 |
