---
description: Code review - run anytime on current changes
---

# /dev-flow:review - 代码审查

随时对当前变更运行结构化代码审查（不绑定 commit/PR）。

## 用法

| 命令 | 范围 |
|------|------|
| `/dev-flow:review` | 审查 staged + unstaged changes |
| `/dev-flow:review --staged` | 只审查 staged changes |
| `/dev-flow:review --branch` | 审查整个分支 vs base branch |

## 执行流程

### Step 1: 加载知识上下文

```
dev_memory(action="query", query="<keywords from changed files> pitfalls")
```

### Step 2: 获取变更范围

| 模式 | 命令 |
|------|------|
| 默认 | `git diff` + `git diff --cached` |
| `--staged` | `git diff --cached` |
| `--branch` | `git diff master...HEAD` |

```
dev_changes(format="full")
```

### Step 3: Spawn Code Reviewer

```
Task(subagent_type="dev-flow:code-reviewer",
     prompt="Full review (all dimensions, P0-P3).
             Diff scope: <mode>
             Knowledge context: <pitfalls from Step 1>
             Read branch-scoped review session log for previous review context.
             After review, append findings to review session log.
             Report format: structured with file:line references.")
```

### Step 4: 展示报告

输出 P0-P3 分级报告（格式见 code-reviewer agent）。

### Step 5: 建议后续动作

| 结果 | 建议 |
|------|------|
| P0/P1 found | "修复后再 `/dev commit`" |
| P2/P3 only | "可以 `/dev commit`，建议后续处理 P2/P3" |
| Clean | "✅ Ready to `/dev commit`" |
