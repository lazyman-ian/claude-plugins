---
description: Simplify changed code - AI auto-selects light or deep mode
---

# /dev-flow:simplify - 代码简化

AI 根据变更规模自动选择简化工具，无需手动指定模式。

## 可用工具

| 工具 | 来源 | 深度 | 适用 |
|------|------|------|------|
| `/simplify` | CC 内置 bundled skill | light | 小范围改动 |
| `code-simplifier` agent | 官方 plugin (anthropics, opus) | deep | 大范围改动 |

## 执行流程

### Step 1: 收集信号

```bash
STAGED=$(git diff --cached --stat | tail -1)
UNSTAGED=$(git diff --stat | tail -1)
CHANGED_LINES=$((staged_lines + unstaged_lines))
```

### Step 2: AI 自主决策

| 信号 | 选择 | 原因 |
|------|------|------|
| `CHANGED_LINES < 100` | `Skill("simplify")` | 小改动，light 足够 |
| `CHANGED_LINES >= 100` 且已安装 | `Task(subagent_type="code-simplifier:code-simplifier")` | 大改动需要 opus 深度分析 |
| `CHANGED_LINES >= 100` 未安装 | `Skill("simplify")` + 提示安装 | fallback + hint |

未安装时提示：
```
Tip: 改动较大 (N lines)，安装 code-simplifier 可获得 opus 深度简化:
  claude plugins add code-simplifier@anthropics
```

### Step 3: 验证

```
dev_config() → 获取 verify 命令 → 执行
```

| 验证结果 | 行为 |
|---------|------|
| PASS | 简化完成 |
| FAIL | 提示用户 review，手动回退问题部分 |

## 选项

| 选项 | 说明 |
|------|------|
| `/dev-flow:simplify` | AI 自动选择 (推荐) |
| `/dev-flow:simplify --light` | 强制 CC /simplify |
| `/dev-flow:simplify --deep` | 强制 code-simplifier agent |
