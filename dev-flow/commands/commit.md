---
description: Smart commit - auto-fix, auto-scope, auto-reasoning
---

# /dev-flow:commit - 智能提交

自动检查、修复、生成 commit message 和 reasoning。

## 自动执行流程

### Step 1: 质量检查
```bash
make fix    # 自动格式化 + 修复
make check  # 验证
```

如果仍有错误：
```
❌ 仍有 N 个错误需要手动修复

[错误详情]

修复后再次运行 `/dev-flow:commit`
```

### Step 2: 分析变更
```bash
git status --short
git diff --stat
git diff --cached --stat
```

如果无变更：
```
ℹ️ 没有需要提交的变更
```

### Step 3: 智能 Scope 推断
```
dev_defaults(action="scope")
```

| 变更文件 | 推断 Scope |
|---------|-----------|
| `HouseSigma/Network/*` | network |
| `HouseSigma/UI/*` | ui |
| `HouseSigma/Model/*` | model |
| 多个目录 | 最主要的目录 |
| 单文件 | 文件名 |

### Step 4: 生成 Commit Message

格式: `type(scope): subject`

| 变更类型 | type |
|---------|------|
| 新功能 | feat |
| 修复 | fix |
| 重构 | refactor |
| 性能 | perf |
| 测试 | test |
| 文档 | docs |
| 构建/CI | chore |

规则：
- Subject: 祈使句，首字母小写，无句号，≤50 字符
- **无 Claude 署名** - 提交显示为用户创建

### Step 5: 执行提交
```bash
git add .
git commit -m "type(scope): subject"
```

### Step 6: 生成 Reasoning
```
dev_reasoning(action="generate", commitHash="<hash>", commitMessage="<msg>")
```

自动保存到 `.git/claude/commits/<hash>/reasoning.md`:
```markdown
# Commit Reasoning

## What Changed
- [变更说明]

## Why
- [原因]

## Alternatives Considered
- [考虑过的方案]

## Build Attempts
- [构建历史，如果有]
```

### Step 7: 更新 Ledger
```
dev_ledger(action="update", content="Committed: <hash-short>")
```

## 输出

```
✅ 提交成功

| 项目 | 值 |
|------|---|
| Hash | abc1234 |
| Message | feat(auth): add recaptcha validation |
| Files | 3 changed |
| Reasoning | .git/claude/commits/abc1234/reasoning.md |

🎯 下一步: `git push` 或 继续开发
```

## 选项

| 选项 | 说明 |
|------|------|
| `/dev-flow:commit` | 自动生成 message |
| `/dev-flow:commit "message"` | 使用指定 message |
| `/dev-flow:commit --amend` | 修改上次提交 (谨慎) |

## 重要

- ✅ 自动运行 `make fix` 和 `make check`
- ✅ 自动推断 scope
- ✅ 自动生成 reasoning
- ❌ **不添加** Claude 署名
- ❌ **不添加** Co-Authored-By
