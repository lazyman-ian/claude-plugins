---
description: Manage continuity ledgers for task tracking
---

# /dev-flow:ledger - 状态账本管理

管理任务状态、进度跟踪、跨 session 持久化。

## 语法

```
/dev-flow:ledger              # 显示当前状态
/dev-flow:ledger list         # 列出所有
/dev-flow:ledger search XXX   # 搜索
/dev-flow:ledger archive      # 归档当前
```

## 操作

### status (默认)
```
dev_ledger(action="status")
```

输出：
```
📋 TASK-945 | 60%

## Goal
实现 Google reCAPTCHA 验证

## State
- [x] Phase 1: API 集成
- [→] Phase 2: UI 组件
- [ ] Phase 3: 测试

## Key Decisions
- 使用 reCAPTCHA v3
```

### list
```
dev_ledger(action="list")
```

输出：
```
📚 Ledgers

Active (2):
  TASK-945  feature/TASK-945-add-recaptcha     60%
  TASK-1205 perf/TASK-1205-pre-check-secret    30%

Archived (5):
  TASK-890  Auth Refactor                      ✓
  ...
```

### search KEYWORD
```
dev_ledger(action="search", keyword="auth")
```

### archive [TASK-XXX]
```
dev_ledger(action="archive", taskId="TASK-XXX")
```

归档完成的任务 ledger。

### update (内部使用)
```
dev_ledger(action="update", content="...")
```

由 `/dev-flow:commit` 等命令自动调用。

## Ledger 结构

`thoughts/ledgers/TASK-XXX.md`:

```markdown
# TASK-XXX: [描述]

## Goal
[目标]

## Constraints
[约束条件]

## State
- [x] Done
- [→] In Progress
- [ ] Pending

## Key Decisions
- [决策 1]: [原因]

## Open Questions
- [问题 1]

## Working Set
- `path/to/file.swift`
```

## 自动行为

| 触发 | 自动更新 |
|------|---------|
| `/dev-flow:start` | 创建 ledger |
| `/dev-flow:commit` | 记录提交 |
| `/dev-flow:pr` | 记录 PR 链接 |
| Context 压缩前 | PreCompact hook 保存状态 |
| Session 恢复 | 自动加载 |
