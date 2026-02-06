---
description: Generate comprehensive PR description (Chinese, template-based)
---

Generate a comprehensive pull request description following the repository's template.

## Instructions

### 1. Read PR Template

```bash
# Check for project-specific template
cat thoughts/shared/pr_description.md 2>/dev/null
```

If no template exists, use default format below.

### 2. Identify PR

```bash
# Current branch PR
gh pr view --json url,number,title,state 2>/dev/null

# Or list open PRs
gh pr list --limit 10 --json number,title,headRefName
```

### 3. Gather Information

```bash
# Diff and commits
gh pr diff {number}
gh pr view {number} --json commits,baseRefName

# MCP tools
dev_commits(format="full")
dev_reasoning(action="aggregate", baseBranch="master")
dev_ledger(action="status")
```

Check for reasoning history:
```bash
ls .git/claude/commits/*/reasoning.md 2>/dev/null
```

### 4. Run Verifications

For each verification step in template:
- Run commands (`make check test`, `npm test`, etc.)
- Mark `[x]` if passed, `[ ]` if failed/manual

### 5. Generate Description (中文)

**All content must be in Chinese.**

```markdown
## 概要

[问题描述和解决方案]

## 变更内容

### 新功能
- 功能 1
- 功能 2

### 修复
- 修复 1

### 重构
- 重构 1

## 技术细节

- 架构决策说明
- 实现方式

## 尝试的方案

(From reasoning aggregate, if available)
- 尝试了 X，选择 Y 因为...
- 遇到问题 Z，解决方法...

## 如何验证

- [x] `make check` 通过
- [x] `make test` 通过
- [ ] 手动测试 UI 功能
- [ ] 边界情况已验证

## 截图

(如适用)

---
Task: TASK-XXX
```

### 6. Save and Update PR

```bash
# Save locally
mkdir -p thoughts/shared/prs
# Write to thoughts/shared/prs/{number}_description.md

# Update PR
gh pr edit {number} --body-file thoughts/shared/prs/{number}_description.md
```

## Important Notes

- **所有内容必须用中文撰写**
- Technical terms (API, file paths, code) can remain in English
- Focus on "why" as much as "what"
- Include breaking changes prominently
- Run verification commands when possible
- Clearly note which steps need manual testing

## Default Template

If no `thoughts/shared/pr_description.md` exists:

```markdown
## 概要

### 问题
[描述要解决的问题]

### 解决方案
[描述如何解决]

## 变更内容

### 新增
-

### 修改
-

### 删除
-

## 技术细节

[架构决策、实现细节]

## 如何验证

- [ ] `make fix && make check` 通过
- [ ] 功能测试通过
- [ ] 无回归问题

## 相关链接

- Task: TASK-XXX
```
