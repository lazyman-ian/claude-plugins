---
description: Create PR with auto-push, auto-description, auto-review
---

# /dev-flow:pr - 创建 Pull Request

自动推送、生成描述、触发代码审查。AI 自主决策审查深度和工具组合。

## 自动执行流程

### Step 1: 前置检查

```bash
git status --short           # 检查未提交
git log origin/master..HEAD  # 检查未推送
gh pr view 2>/dev/null            # 检查已有 PR
```

| 状态 | 处理 |
|------|------|
| 有未提交更改 | 自动触发 `/dev-flow:commit` |
| 有未推送提交 | 自动 `git push -u origin HEAD` |
| PR 已存在 | 显示 PR 链接，询问是否更新描述 |

### Step 2: 收集信息 + 信号

```bash
git log master..HEAD --oneline
git diff master...HEAD --stat
```

```
dev_commits(format="full")
dev_memory(action="search", query="decisions for current branch")
dev_ledger(action="status")
```

同时收集决策信号：
```bash
CHANGED_FILES=$(git diff master...HEAD --name-only)
COMMIT_COUNT=$(git log master..HEAD --oneline | wc -l)
TEST_FILES=$(echo "$CHANGED_FILES" | grep -iE '(test|spec)\.')
TYPE_FILES=$(echo "$CHANGED_FILES" | grep -iE '\.(d\.ts|types?\.(ts|swift|kt))$')
ERROR_PATTERNS=$(git diff master...HEAD | grep -cE '(catch|rescue|except|\.catch|try\s*\{)')
COMMENT_CHANGES=$(git diff master...HEAD | grep -cE '^[+-]\s*(//|/\*|\*|#|"""|<!--)')
DIR_COUNT=$(echo "$CHANGED_FILES" | cut -d/ -f1-2 | sort -u | wc -l)
```

### Step 3: 生成标题

从分支名和提交推断：
```
feature/TASK-123-add-recaptcha → feat(auth): add reCAPTCHA validation
fix/TASK-456-crash            → fix: resolve image viewer crash
```

### Step 4: 生成描述 (中文)

```markdown
## 概要

[从 commits 和 reasoning 提取]

## 变更内容

### 新增
- [功能 1]

### 修改
- [修改 1]

## 技术细节

[从 reasoning 提取架构决策]

## 尝试的方案

[从 reasoning aggregate 提取]
- 尝试了 X，因为 Y 选择了 Z

## 如何验证

- [x] `make check` 通过
- [ ] 手动测试 [功能]
- [ ] 无回归问题

---
Task: TASK-XXX
```

### Step 5: 创建 PR

```bash
gh pr create \
  --title "type: title" \
  --body-file /tmp/pr-body.md \
  --base master
```

### Step 6: 更新 Ledger

```
dev_ledger(action="update", content="PR created: #123")
```

### Step 7: dev-flow Code Review (always)

**无条件 spawn code-reviewer agent**（深度由 agent 自行判定）：

```
Task(subagent_type="dev-flow:code-reviewer",
     prompt="PR review mode. Branch diff: git diff master...HEAD
             Auto-classify risk and review depth.
             Check commit review coverage (reasoning files in .git/claude/commits/).
             Focus on cross-cutting concerns and module interactions.
             Include positive notes and knowledge saving.")
```

| 审查结果 | 行为 |
|---------|------|
| P0/P1 found | 追加到 PR description，建议创建 Draft PR |
| P2/P3 only | 追加到 PR body 的 "Review Notes" section |
| Clean | 在 PR body 追加 "Code review passed" |

> 强制跳过: `/dev-flow:pr --no-review`

### Step 8: AI 自主决策官方 Plugin 调用

根据 Step 2 信号 **自动判定**，无需用户指定 flags：

**专项 agents (pr-review-toolkit@anthropics):**

| 信号 | 触发 Agent | 条件 |
|------|-----------|------|
| test/spec 文件有改动 | `pr-test-analyzer` | `TEST_FILES` 非空 |
| error handling 有改动 | `silent-failure-hunter` | `ERROR_PATTERNS >= 3` |
| 类型定义有改动 | `type-design-analyzer` | `TYPE_FILES` 非空 |
| 注释大量改动 | `comment-analyzer` | `COMMENT_CHANGES >= 10` |

**GH PR Comment (code-review@anthropics):**

| 信号 | 触发 | 条件 |
|------|------|------|
| 跨模块 PR | `code-review:code-review` | `DIR_COUNT >= 3` 或 `COMMIT_COUNT >= 5` |

**前提**: 对应官方 plugin 已安装。未安装时跳过该 agent，在报告末尾提示安装。

检测：
```bash
claude plugins list 2>/dev/null | grep -q "pr-review-toolkit" && HAS_TOOLKIT=1
claude plugins list 2>/dev/null | grep -q "code-review" && HAS_REVIEW=1
```

符合条件且已安装的 agents 与 dev-flow reviewer **并行 spawn**，结果聚合到 PR description。

未安装但信号匹配时，在报告末尾追加安装提示：
```
Tip: 检测到 test 文件改动 + 跨模块 PR，安装以下 plugin 可增强 review:
  claude plugins add pr-review-toolkit@anthropics  # 测试覆盖、静默失败分析
  claude plugins add code-review@anthropics        # GH PR comment (confidence scoring)
```

### 聚合输出格式

```markdown
## Review Summary

### dev-flow code-reviewer
[P0-P3 分级报告]

### pr-test-analyzer (auto: test files changed)
[测试覆盖 findings]

### silent-failure-hunter (auto: error handling changed)
[静默失败 findings]

### code-review@anthropics (auto: cross-module PR)
[GH comment posted with confidence-scored findings]
```

## 输出

```
PR 已创建

| 项目 | 值 |
|------|---|
| PR | #123 |
| URL | https://github.com/org/repo/pull/123 |
| Title | feat(auth): add reCAPTCHA validation |
| Review | dev-flow + pr-test-analyzer + silent-failure-hunter |
```

## 选项

| 选项 | 说明 |
|------|------|
| `/dev-flow:pr` | AI 自动决策审查组合 |
| `/dev-flow:pr --draft` | 创建 Draft PR |
| `/dev-flow:pr --no-review` | 跳过所有代码审查 |
| `/dev-flow:pr --update` | 更新现有 PR 描述 |
