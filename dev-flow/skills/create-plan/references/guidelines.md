# Planning Guidelines

Important guidelines and sub-task patterns.

## Core Principles

### 1. Be Skeptical
- Question vague requirements
- Identify potential issues early
- Ask "why" and "what about"
- Don't assume - verify with code

### 2. Be Interactive
- Don't write the full plan in one shot
- Get buy-in at each major step
- Allow course corrections
- Work collaboratively

### 3. Be Thorough
- Read all context files COMPLETELY
- Research actual code patterns using parallel sub-tasks
- Include specific file paths and line numbers
- Write measurable success criteria
- Use `make` commands when possible

### 4. Be Practical
- Focus on incremental, testable changes
- Consider migration and rollback
- Think about edge cases
- Include "what we're NOT doing"

### 5. Track Progress
- Use TodoWrite to track planning tasks
- Update todos as you complete research
- Mark tasks complete when done

### 6. No Open Questions
- If you encounter open questions, STOP
- Research or ask for clarification immediately
- Do NOT write plan with unresolved questions
- Plan must be complete and actionable

---

## Sub-Task Model Selection

| 任务类型 | 推荐模型 | 原因 |
|---------|---------|------|
| 快速文件查找 | `haiku` | 简单、快速、低成本 |
| 代码分析理解 | `sonnet` | 平衡性能和成本 |
| 架构决策研究 | `opus` | 需要深度推理 |
| 外部文档研究 | `haiku` | 主要是信息收集 |

---

## Sub-Task Tool Restrictions

| 代理类型 | 推荐工具 | 原因 |
|---------|---------|------|
| codebase-locator | `[Glob, Grep, Read]` | 只读搜索 |
| codebase-analyzer | `[Read, Grep, Glob]` | 只读分析 |
| thoughts-locator | `[Glob, Read]` | 只读文档 |
| research-agent | `[WebSearch, WebFetch, Read, Write]` | 需要写 handoff |

---

## Sub-Task Spawning Patterns

### 模式 1: 并行研究 (推荐)

同一消息中生成多个 Task 调用:

```python
# 并行执行，节省时间
Task(
  description="Find database schema",
  model="haiku",
  prompt="..."
)
Task(
  description="Find API patterns",
  model="haiku",
  prompt="..."
)
Task(
  description="Check test patterns",
  model="haiku",
  prompt="..."
)
```

### 模式 2: 顺序依赖

有依赖时必须顺序:

```python
# 先完成第一个
result1 = Task(description="Analyze core module", ...)

# 基于结果生成第二个
Task(description="Find callers of X", prompt=f"Based on {result1}...")
```

### 模式 3: 恢复之前的代理

```python
Task(
  resume="<agentId>",
  prompt="之前的分析遗漏了 X，请补充"
)
```

---

## Task Invocation Best Practices

### ✅ DO

1. **清晰的 description (3-5 字)**
   ```python
   description="Find auth patterns"  # Good
   ```

2. **明确的目录范围**
   ```python
   prompt="Search in humanlayer-wui/ directory only"
   ```

3. **指定输出格式**
   ```python
   prompt="Return file:line references for each finding"
   ```

4. **选择合适的模型**
   ```python
   model="haiku"  # 简单搜索
   model="opus"   # 复杂分析
   ```

### ❌ DON'T

1. **模糊的 description**
   ```python
   description="Do research"  # Bad - too vague
   ```

2. **不限制目录**
   ```python
   prompt="Find all files"  # Bad - too broad
   ```

3. **不验证结果**
   - 子代理返回后，如果结果可疑，spawn follow-up

---

## Spawning Research Agent

For external documentation:

```python
Task(
  description="Research WebSocket patterns",
  subagent_type="general-purpose",
  model="haiku",  # 研究任务用 haiku 足够
  prompt="""
  # Research Agent

  [Paste research-agent SKILL.md content]

  ---

  ## Your Research Task

  **Question:** WebSocket best practices in TypeScript 2024

  **Context:** Planning real-time notification system

  **Handoff Directory:** thoughts/shared/handoffs/notification-feature/
  **Handoff Filename:** research-01-websocket-patterns.md

  ---

  Execute research and create handoff.
  """
)
```

After research-agent returns, read its handoff before finalizing plan.

---

## Be EXTREMELY Specific About Directories

| Ticket Mentions | Specify Directory |
|-----------------|-------------------|
| "WUI" | `humanlayer-wui/` |
| "daemon" | `hld/` |
| "API" | `api/` or `backend/` |
| "iOS" | `HouseSigma/` |
| "Android" | `app/src/main/` |

Never use generic terms like "UI" when you mean "WUI".

---

## Verify Sub-Task Results

1. **检查结果合理性**
   - 文件路径是否存在
   - 行号是否合理

2. **交叉验证**
   - 多个代理的结果是否一致
   - 与已知代码是否匹配

3. **Spawn Follow-up**
   ```python
   # 如果结果可疑
   Task(
     description="Verify previous findings",
     prompt="验证之前找到的 X 是否正确..."
   )
   ```

---

## Example Interaction Flow

```
User: /create_plan

Claude: I'll help create a plan. What feature?

User: Add auth to API

Claude: Let me research the codebase...

[Spawns 3 parallel Tasks with haiku model]
- Task 1: Find existing auth patterns
- Task 2: Find API endpoints
- Task 3: Check test patterns

[All tasks complete]

Claude: Based on research:
- Found auth middleware at auth/middleware.ts:45
- Found 5 API endpoints needing auth
- Tests use mock auth at tests/fixtures/

Shall I proceed with the plan structure?
```
