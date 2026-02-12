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

### 1. Handoff Directory

Handoffs are managed via `dev_handoff` MCP tool (auto-creates directory). No manual `mkdir` needed.

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

## Platform-Aware Verification

Before running verification commands, query the platform:

```python
dev_config()  # Returns platform-specific lint/check/verify commands
```

**Priority**: plan frontmatter `verify` > `dev_config()` output > hardcoded fallback

This ensures agents use the correct verification commands regardless of platform (iOS/Android/Web/custom).

---

## Orchestration Loop

### 1. Prepare Agent Context

- Read continuity ledger
- Read the plan
- Read previous handoff: `dev_handoff(action='read', handoffId='...')` or `dev_handoff(action='chain', taskId='...')` to get full history
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

- Read agent's handoff: `dev_handoff(action='read', handoffId='...')`
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
2. Search handoffs: `dev_handoff(action='search', keyword='TASK-XXX')` or `dev_handoff(action='chain', taskId='TASK-XXX')`
3. Read last handoff to understand state
4. Continue from next uncompleted task

---

## Handoff Chain

Use `dev_handoff(action='chain', taskId='TASK-XXX')` to view the full handoff sequence:

```
Agent 1 → dev_handoff(write) → handoff-001
Agent 2 → dev_handoff(read, handoff-001) → implements → dev_handoff(write) → handoff-002
Agent 3 → dev_handoff(chain, taskId) → sees [handoff-001, handoff-002] → implements
```

Chain preserves context even across compactions.

---

## Parallel Execution with Conflict Detection

Before spawning parallel agents, detect file conflicts:

```python
# 1. Check for conflicts
dev_coordinate(action='plan', mode='fan-out', tasks=json.dumps([
  {"id": "t1", "targetFiles": ["src/auth.ts", "src/types.ts"]},
  {"id": "t2", "targetFiles": ["src/api.ts"]},
  {"id": "t3", "targetFiles": ["src/auth.ts"]}  # conflicts with t1!
]))
# → ⚠️ Conflicts detected: src/auth.ts: t1, t3

# 2. Serialize conflicting tasks
TaskUpdate(taskId="t3", addBlockedBy=["t1"])

# 3. Dispatch non-conflicting in parallel
Task(description="Task 1: Auth module", ...)
Task(description="Task 2: API endpoints", ...)  # same message = parallel
```

If plan has frontmatter, read `parallelizable` flag and `target_files` to auto-identify parallel phases. Only phases with `parallelizable: true` and no overlapping `target_files` run concurrently.

---

## Batch Checkpoint

For plans with many tasks, pause every N tasks for architect-level review:

| Plan Size | Checkpoint Interval |
|-----------|-------------------|
| 5-8 tasks | Every 3 tasks |
| 9-15 tasks | Every 4 tasks |
| 16+ tasks | Every 5 tasks |

At each checkpoint:
1. Read all handoffs since last checkpoint
2. Verify cumulative changes are coherent (no drift from plan)
3. Check for emerging cross-task issues
4. Decide: continue / adjust plan / escalate to user

Skip checkpoint if remaining tasks ≤ 2.

---

## Final Aggregation

After all agents complete, aggregate results for PR:

```python
dev_aggregate(action='pr_ready', taskId='TASK-XXX')
```

Returns a unified summary of all changes, decisions, and open questions across handoffs.

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

## Agent Teams Alternative

When 3+ phases are parallelizable with no file conflicts, Agent Teams provide true parallel execution:

| Dimension | Agent Orchestration | Agent Teams |
|-----------|-------------------|-------------|
| Parallelism | Sequential/limited | Fully parallel |
| Context | Shared main context | Independent per teammate |
| Communication | Handoff files | `SendMessage` bidirectional |
| Cost | Lower | Higher (N× contexts) |
| Best for | Sequential dependencies | Independent parallel work |

Use Agent Teams when `dev_coordinate(action='plan')` shows no file conflicts and phases are independently executable. See `implement-plan/SKILL.md` "Agent Teams Mode" for the workflow.

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
