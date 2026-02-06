# Task Management Integration Plan

整合 Claude Code Task Management (v2.1.16+) 到 dev-flow-plugin。

## 概述

Task Management 提供:
- **TaskCreate** - 创建任务 (subject, description, activeForm)
- **TaskUpdate** - 更新状态、依赖、所有者
- **TaskList** - 列出所有任务
- **TaskGet** - 获取任务详情

### vs TodoWrite

| 特性 | TodoWrite | Task Management |
|------|-----------|-----------------|
| 依赖管理 | ❌ | ✅ blocks/blockedBy |
| 任务分配 | ❌ | ✅ owner 字段 |
| 状态查询 | ❌ | ✅ TaskGet |
| Token 效率 | 中 | 高 |

## Phase 1: Skill 升级

### 1.1 更新 allowed-tools

```yaml
# Before
allowed-tools: [Read, Edit, Write, Bash, Task, TodoWrite]

# After
allowed-tools: [Read, Edit, Write, Bash, Task, TaskCreate, TaskUpdate, TaskList, TaskGet]
```

### 1.2 涉及的 Skills

| Skill | 当前 | 升级 |
|-------|------|------|
| implement_plan | TodoWrite | TaskCreate, TaskUpdate, TaskList |
| create_plan | TodoWrite | TaskCreate, TaskUpdate |
| meta-iterate | TodoWrite | TaskCreate, TaskUpdate, TaskList |
| config-optimize | TodoWrite | TaskCreate, TaskUpdate |
| implement_task | TodoWrite | TaskUpdate, TaskGet |

## Phase 2: Continuity Ledger 同步

### 2.1 Ledger ↔ Tasks 映射

```markdown
# CONTINUITY_CLAUDE-feature.md

## State (Auto-synced from Tasks)

| Task ID | Subject | Status | Blocked By |
|---------|---------|--------|------------|
| task-1 | Implement auth | in_progress | - |
| task-2 | Add tests | pending | task-1 |
| task-3 | Update docs | pending | task-2 |
```

### 2.2 同步逻辑

```typescript
// continuity/task-sync.ts
interface TaskLedgerSync {
  // Tasks → Ledger: 更新 State 部分
  syncTasksToLedger(ledgerPath: string): void;

  // Ledger → Tasks: 从 ledger 恢复任务
  restoreTasksFromLedger(ledgerPath: string): void;
}
```

### 2.3 Hook 触发

```json
{
  "hooks": {
    "SessionStart": [{
      "hooks": [{
        "type": "command",
        "command": "sync-ledger-tasks.sh"
      }]
    }]
  }
}
```

## Phase 3: Agent 协调

### 3.1 任务分配模式

```typescript
// 主 agent 创建任务
TaskCreate({
  subject: "Implement feature X",
  description: "...",
  metadata: { phase: "1", agent: "implement-agent" }
});

// 分配给子 agent
TaskUpdate({
  taskId: "task-1",
  owner: "implement-agent-001"
});

// 子 agent 完成后
TaskUpdate({
  taskId: "task-1",
  status: "completed"
});
```

### 3.2 依赖图

```
task-1: Schema design (pending)
   ↓ blocks
task-2: API implementation (blockedBy: task-1)
   ↓ blocks
task-3: Frontend integration (blockedBy: task-2)
   ↓ blocks
task-4: E2E tests (blockedBy: task-3)
```

## Phase 4: MCP 工具扩展

### 4.1 新增 dev_tasks 工具

```typescript
{
  name: 'dev_tasks',
  description: '[~50 tokens] Query and manage tasks with ledger sync',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        enum: ['list', 'summary', 'sync', 'export'],
        description: 'Action to perform'
      },
      format: {
        enum: ['compact', 'json', 'markdown'],
        description: 'Output format'
      }
    }
  }
}
```

### 4.2 输出格式

```
dev_tasks(action="summary")
→ TASKS|3 total|1 in_progress|2 pending|0 completed

dev_tasks(action="list")
→
| ID | Subject | Status | Blocked |
|----|---------|--------|---------|
| 1 | Auth | in_progress | - |
| 2 | Tests | pending | 1 |
```

## Phase 5: Workflow 整合

### 5.1 /dev 命令扩展

```bash
# 查看任务状态
/dev tasks

# 同步到 ledger
/dev tasks sync

# 导出为 markdown
/dev tasks export
```

### 5.2 StatusLine 整合

多行显示 (v3.13.0+):
```
████████░░ 76% | main | ↑2↓0 | !3M +2A | 15m
✓ Read ×12 | ✓ Edit ×3 | ✓ Bash ×5
Tasks: 2/5 (40%) | → 1 active | 2 pending
```

旧版单行格式:
```
[main|DEVELOP] 12.5K 38% | Tasks: 1/3 ✓ | +50/-10
```

## Implementation Checklist

### Phase 1: Skill 升级 ✅
- [x] 更新 implement_plan allowed-tools
- [x] 更新 create_plan allowed-tools
- [x] 更新 meta-iterate allowed-tools
- [x] 更新 config-optimize allowed-tools
- [x] 更新 implement_task allowed-tools
- [x] 添加任务管理最佳实践到 references

### Phase 2: Ledger 同步 ✅
- [x] 创建 continuity/task-sync.ts
- [x] 实现 parseLedgerState() + generateTaskCommands()
- [x] 实现 updateLedgerFromTasks() + formatTasksAsMarkdown()
- [x] 导出 getActiveLedgerPath()

### Phase 3: Agent 协调 ✅
- [x] 创建 task-management.md 最佳实践
- [x] 添加任务依赖示例
- [x] 创建 implement-agent 任务分配模式

### Phase 4: MCP 工具 ✅
- [x] 添加 dev_tasks 工具到 index.ts
- [x] 实现 summary/export/sync actions
- [x] 添加 task-management 到 plugin.json keywords

### Phase 5: Workflow ✅
- [x] 创建 commands/tasks.md
- [x] 更新 /dev skill 支持 tasks 命令
- [x] 更新 CLAUDE.md 文档

## Token 效率指南

| 操作 | 方式 | Token |
|------|------|-------|
| 创建任务 | TaskCreate | ~50 |
| 批量更新 | 单次 TaskUpdate 多字段 | ~30 |
| 查询状态 | dev_tasks summary | ~50 |
| 完整列表 | TaskList | ~100+ |

### 最佳实践

1. **批量更新**: 累积 2-3 个变化后再 TaskUpdate
2. **activeForm**: 始终提供 (显示在 spinner)
3. **依赖先行**: 创建任务时先设置 blockedBy
4. **完成确认**: 只有真正完成才标记 completed
