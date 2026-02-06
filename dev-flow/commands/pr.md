---
description: Create PR with auto-push, auto-description, auto-review
---

# /dev-flow:pr - 创建 Pull Request

自动推送、生成描述、触发代码审查。

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

### Step 2: 收集信息

```bash
git log master..HEAD --oneline
git diff master...HEAD --stat
```

```
dev_commits(format="full")
dev_reasoning(action="aggregate", baseBranch="master")
dev_ledger(action="status")
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

### Step 7: 触发代码审查 (可选)

```
→ 自动 spawn code-reviewer agent
→ 输出审查结果
```

## 输出

```
✅ PR 已创建

| 项目 | 值 |
|------|---|
| PR | #123 |
| URL | https://github.com/org/repo/pull/123 |
| Title | feat(auth): add reCAPTCHA validation |
| Status | Open |

📝 描述已自动生成 (中文)
🔍 代码审查进行中...
```

## 选项

| 选项 | 说明 |
|------|------|
| `/dev-flow:pr` | 自动生成一切 |
| `/dev-flow:pr --draft` | 创建 Draft PR |
| `/dev-flow:pr --no-review` | 跳过代码审查 |
| `/dev-flow:pr --update` | 更新现有 PR 描述 |

## 代码审查输出

如果启用自动审查：
```
## 代码审查结果

### 通过 ✅
- 代码风格一致
- 无明显安全问题

### 建议 💡
- 考虑添加单元测试
- 建议提取公共方法
```
