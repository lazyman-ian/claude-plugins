# Task Management Best Practices

使用 Claude Code Task Management 工具追踪实现进度。

## 工具概览

| 工具 | 用途 | Token |
|------|------|-------|
| **TaskCreate** | 创建新任务 | ~50 |
| **TaskUpdate** | 更新状态/依赖/所有者 | ~30 |
| **TaskList** | 列出所有任务 | ~100+ |
| **TaskGet** | 获取任务详情 | ~50 |

## 状态流转

```
pending → in_progress → completed
```

- **pending**: 任务已创建，等待开始
- **in_progress**: 正在执行
- **completed**: 完全完成 (无错误)

**重要**: 只有真正完成才标记 `completed`。如果遇到错误/阻塞，保持 `in_progress`。

## 创建任务

```typescript
TaskCreate({
  subject: "Implement user authentication",      // 简短标题 (必需)
  description: "Add JWT auth with refresh...",   // 详细描述 (必需)
  activeForm: "Implementing authentication"      // Spinner 显示 (推荐)
});
```

### activeForm 示例

| subject | activeForm |
|---------|------------|
| "Add API endpoint" | "Adding API endpoint" |
| "Fix login bug" | "Fixing login bug" |
| "Update tests" | "Updating tests" |

## 依赖管理

### 设置依赖

```typescript
// task-2 被 task-1 阻塞
TaskUpdate({
  taskId: "2",
  addBlockedBy: ["1"]
});

// task-1 阻塞 task-2 和 task-3
TaskUpdate({
  taskId: "1",
  addBlocks: ["2", "3"]
});
```

### 依赖图示例

```
Phase 1: Schema (task-1)
    ↓ blocks
Phase 2: API (task-2, blockedBy: task-1)
    ↓ blocks
Phase 3: UI (task-3, blockedBy: task-2)
    ↓ blocks
Phase 4: Tests (task-4, blockedBy: task-3)
```

## 实现工作流

### 1. 读取计划后创建任务

```typescript
// 为每个 Phase 创建任务
TaskCreate({
  subject: "Phase 1: Database schema",
  description: "Create tables for user, session...",
  activeForm: "Creating database schema"
});

TaskCreate({
  subject: "Phase 2: API endpoints",
  description: "Implement /auth/login, /auth/refresh...",
  activeForm: "Implementing API endpoints"
});

// 设置依赖
TaskUpdate({ taskId: "2", addBlockedBy: ["1"] });
```

### 2. 开始任务

```typescript
TaskUpdate({
  taskId: "1",
  status: "in_progress"
});
```

### 3. 完成任务

```typescript
// 只有验证通过后
TaskUpdate({
  taskId: "1",
  status: "completed"
});

// 自动解除 task-2 的阻塞
```

### 4. 查询进度

```typescript
TaskList();
// 返回所有任务的摘要

TaskGet({ taskId: "1" });
// 返回 task-1 的完整详情
```

## Token 效率

### DO

- 批量创建任务 (一次性创建所有 Phase)
- 累积 2-3 个变化后再 TaskUpdate
- 使用 TaskList 而非多次 TaskGet

### DON'T

- 每完成一小步就 TaskUpdate
- 创建过多细粒度任务 (>10)
- 频繁调用 TaskList (>3 次/任务)

### 调用频率限制

| 任务类型 | TaskCreate | TaskUpdate | TaskList |
|----------|------------|------------|----------|
| 简单 (1-3 步) | 1-3 | 2-4 | 1 |
| 中等 (4-7 步) | 4-7 | 4-8 | 2 |
| 复杂 (8+ 步) | 8+ | 8-12 | 3 |

## 与 Agent 协调

### 主 Agent 创建任务

```typescript
TaskCreate({
  subject: "Implement feature X",
  description: "...",
  metadata: { phase: "1", assignedTo: "implement-agent" }
});
```

### 子 Agent 更新进度

```typescript
// 子 agent 开始工作
TaskUpdate({
  taskId: "1",
  status: "in_progress",
  owner: "implement-agent-001"
});

// 完成后
TaskUpdate({
  taskId: "1",
  status: "completed"
});
```

## 错误处理

### 任务失败

```typescript
// 不要标记 completed，保持 in_progress
// 创建阻塞任务描述问题
TaskCreate({
  subject: "Fix: API endpoint 500 error",
  description: "Investigation needed...",
  activeForm: "Investigating API error"
});

TaskUpdate({
  taskId: "original-task",
  addBlockedBy: ["fix-task-id"]
});
```

### 任务取消

```typescript
// 目前无 "cancelled" 状态
// 标记 completed 并在 description 中说明
TaskUpdate({
  taskId: "1",
  status: "completed",
  description: "[CANCELLED] No longer needed because..."
});
```

## Continuity Ledger 同步

任务状态应同步到 Continuity Ledger:

```markdown
## State

| Task | Subject | Status |
|------|---------|--------|
| 1 | Schema | ✅ completed |
| 2 | API | → in_progress |
| 3 | UI | pending (blocked) |
```

这确保 context compaction 后任务状态保留。
