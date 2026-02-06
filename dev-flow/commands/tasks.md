---
description: Sync ledger state with Claude Code Task Management
---

# /dev-flow:tasks - Task Management 同步

桥接 Continuity Ledger 与 Claude Code Task Management 工具。

## 语法

```
/dev-flow:tasks              # 快速状态摘要
/dev-flow:tasks export       # 导出为 TaskCreate 命令
/dev-flow:tasks sync         # 显示任务表格
```

## 操作

### summary (默认)
```
dev_tasks(action="summary")
```

输出：
```
TASKS|5 total|2 done|1 active|2 pending
```

### export
```
dev_tasks(action="export")
```

生成可直接执行的 TaskCreate 命令：
```typescript
TaskCreate({
  subject: "Phase 1: Database schema",
  description: "From ledger state",
  activeForm: "Creating database schema"
});

TaskCreate({
  subject: "Phase 2: API endpoints",
  description: "From ledger state",
  activeForm: "Waiting to start"
});

TaskUpdate({ taskId: "task-2", addBlockedBy: ["task-1"] });
```

### sync
```
dev_tasks(action="sync")
```

显示 Markdown 表格：
```
| ID | Subject | Status | Blocked By |
|----|---------|--------|------------|
| task-1 | Phase 1: Schema | ✅ completed | - |
| task-2 | Phase 2: API | → in_progress | - |
| task-3 | Phase 3: UI | ⏳ pending | task-2 |
```

## 与 Task Management 配合

### 从 Ledger 初始化任务

```bash
# 1. 查看当前 ledger 状态
/dev-flow:ledger

# 2. 导出为 TaskCreate 命令
/dev-flow:tasks export

# 3. 执行生成的命令（Claude 自动处理）
```

### 任务更新同步回 Ledger

Task Management 工具更新任务状态后，ledger 自动同步：
- `TaskUpdate(status="completed")` → ledger 中 `[x]` 标记
- `TaskUpdate(status="in_progress")` → ledger 中 `[→]` 标记

## 状态映射

| Ledger 标记 | Task Status |
|-------------|-------------|
| `[x]` | completed |
| `[→]` | in_progress |
| `[ ]` | pending |

## 适用场景

| 场景 | 推荐方式 |
|------|---------|
| 简单任务 (1-3 步) | 直接用 Ledger |
| 复杂任务 (4+ 步) | 初始化 Task Management |
| 多 Agent 协作 | Task Management + Ledger 同步 |
| 跨 Session 恢复 | Ledger 优先（已持久化） |

## 自动行为

| 触发 | 动作 |
|------|------|
| `/dev-flow:start` | 创建 ledger (可选导出 tasks) |
| Task 完成 | 更新 ledger checkbox |
| Context 压缩前 | Ledger 状态保留 |
