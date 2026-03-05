---
description: Code review - run anytime on current changes
---

# /dev-flow:review - 代码审查

随时对当前变更运行结构化代码审查（不绑定 commit/PR）。

## 用法

| 命令 | 说明 |
|------|------|
| `/dev-flow:review` | AI 自动决策审查范围和深度 |
| `/dev-flow:review --staged` | 只审查 staged changes |
| `/dev-flow:review --branch` | 审查整个分支 vs base branch |

## 执行流程

### Step 1: 收集信号

```bash
CHANGED_FILES=$(git diff --name-only && git diff --cached --name-only)
CHANGED_LINES=$(git diff --stat | tail -1)
TEST_FILES=$(echo "$CHANGED_FILES" | grep -iE '(test|spec)\.')
TYPE_FILES=$(echo "$CHANGED_FILES" | grep -iE '\.(d\.ts|types?\.(ts|swift|kt))$')
ERROR_PATTERNS=$(git diff | grep -cE '(catch|rescue|except|\.catch|try\s*\{)')
COMMENT_CHANGES=$(git diff | grep -cE '^[+-]\s*(//|/\*|\*|#|"""|<!--)')
UI_FILES=$(echo "$CHANGED_FILES" | grep -iE '\.(css|scss|less|styled|vue|tsx|jsx|swift|kt)$')
```

### Step 2: 加载知识上下文

```
dev_memory(action="query", query="<keywords from changed files> pitfalls")
```

### Step 3: Spawn dev-flow Code Reviewer (always)

```
Task(subagent_type="dev-flow:code-reviewer",
     prompt="Full review (all dimensions, P0-P3).
             Diff scope: <mode>
             Knowledge context: <pitfalls from Step 2>
             Read branch-scoped review session log for previous review context.
             After review, append findings to review session log.
             Report format: structured with file:line references.")
```

### Step 4: AI 自主决策是否调用官方专项 agents

根据 Step 1 信号 **自动判定**，无需用户指定：

| 信号 | 触发 | 条件 |
|------|------|------|
| test/spec 文件有改动 | `pr-review-toolkit:pr-test-analyzer` | `TEST_FILES` 非空 |
| error handling 有改动 | `pr-review-toolkit:silent-failure-hunter` | `ERROR_PATTERNS >= 3` |
| 类型定义有改动 | `pr-review-toolkit:type-design-analyzer` | `TYPE_FILES` 非空 |
| 注释大量改动 | `pr-review-toolkit:comment-analyzer` | `COMMENT_CHANGES >= 10` |
| 变更行数较大 | `code-simplifier:code-simplifier` | `CHANGED_LINES >= 200` |
| UI 文件改动 + Figma context | `Skill("ui-verify")` | CSS/UI 文件 + session 有 Figma URL |

**前提**: 对应官方 plugin 已安装。未安装时跳过该 agent，在报告末尾提示安装。

检测 plugin 是否可用：
```bash
claude plugins list 2>/dev/null | grep -q "pr-review-toolkit" && HAS_TOOLKIT=1
claude plugins list 2>/dev/null | grep -q "code-simplifier" && HAS_SIMPLIFIER=1
```

符合条件且已安装的 agents **并行 spawn**，与 dev-flow reviewer 的结果聚合输出。

未安装但信号匹配时，在报告末尾追加：
```
Tip: 检测到 test 文件改动，安装 pr-review-toolkit 可自动分析测试覆盖:
  claude plugins add pr-review-toolkit@anthropics
```

### Step 5: 聚合输出

```markdown
## Review Report

**Scope**: N files, M lines | **Risk**: 🔴/🟡/🟢/⚪

### dev-flow code-reviewer
[P0-P3 findings]

### pr-test-analyzer (auto-triggered: test files changed)
[test coverage gaps]

### silent-failure-hunter (auto-triggered: error handling changed)
[silent failure findings]

---
Next: [修复建议 or "✅ Ready to /dev commit"]
```

### Step 6: 建议后续动作

| 结果 | 建议 |
|------|------|
| P0/P1 or Critical found | "修复后再 `/dev commit`" |
| P2/P3 only | "可以 `/dev commit`，建议后续处理" |
| Clean | "✅ Ready to `/dev commit`" |
