---
description: Development workflow hub - auto-detect phase and suggest actions
---

# /dev-flow:dev - 开发工作流中心

智能检测当前状态，自动建议下一步操作。

## 自动执行

```
1. dev_flow(verbose=true)    → 获取完整状态
2. dev_check                 → 检查错误数
3. dev_next                  → 获取建议
```

## 输出格式

```markdown
## 开发状态

| 项目 | 值 |
|------|---|
| 分支 | feature/TASK-123-xxx |
| 阶段 | DEVELOPING |
| 更改 | S:2 U:3 |
| 错误 | 0 |

## 建议操作

[根据阶段自动建议]
```

## 阶段路由

| 阶段 | 状态 | 自动建议 |
|------|------|---------|
| `IDLE` | master + 无更改 | `/dev-flow:start TASK-XXX "描述"` |
| `DEVELOPING` | 有未提交更改 | `make fix` → `/dev-flow:commit` |
| `READY_TO_PUSH` | 有未推送提交 | `git push` |
| `READY_FOR_PR` | 已推送，无 PR | `/dev-flow:pr` |
| `PR_OPEN` | PR 已创建 | 等待审核 或 `/dev-flow:describe` |
| `READY_TO_RELEASE` | master + 新提交 | `/dev-flow:release` |

## 错误处理

如果 `dev_check` 返回错误：
```
⚠️ 发现 N 个错误

运行 `make fix` 自动修复，然后 `make check` 验证。
```

## 快捷方式

| 输入 | 等效 |
|------|------|
| `/dev-flow:dev` | 显示状态 + 建议 |
| `/dev-flow:s` | `/dev-flow:start` |
| `/dev-flow:c` | `/dev-flow:commit` |
| `/dev-flow:p` | `/dev-flow:pr` |
| `/dev-flow:r` | `/dev-flow:release` |
| `/dev-flow:d` | `/dev-flow:describe` |
