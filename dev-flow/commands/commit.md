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

### Step 2: Prepare (Server-side)
```
dev_commit(action="prepare")
→ { token, files, diff_stat }
```

Server 自动检查 staged changes、计算 diff hash、记录 review log 时间戳。

如果无 staged changes：
```
❌ No staged changes. Run `git add` first.
```

### Step 2.5: Code Review Gate

**无条件 spawn code-reviewer agent**（深度由 agent 自行判定，主流程不参与决策）：

```
Task(subagent_type="dev-flow:code-reviewer",
     prompt="Review staged changes (commit gate mode).
             Files: <git diff --cached --name-only>
             Report P0/P1 only. Auto-classify risk level.
             Read branch-scoped review session log for previous review context.
             After review, append findings to review session log.")
```

Agent 在独立 context 中自动完成：
1. 读取 review session log（前次审查的跨模块 context）
2. 分析 diff 大小、敏感文件、新文件等信号
3. 查询 `dev_memory` 匹配 pitfalls
4. **关联当前改动与之前审查发现**（跨 commit 检测）
5. 自动选择审查深度（🔴 Full / 🟡 Medium / 🟢 Quick / ⚪ Skip）
6. 返回分级报告 + 写回 session log

| Agent 返回 | 行为 |
|-----------|------|
| P0/P1 issues found | ❌ 停止提交，展示问题，要求修复 |
| P2/P3 only | ⚠️ 显示 warnings，继续提交 |
| Risk ⚪ (docs-only) | ✅ Agent 确认无需审查，继续提交 |
| No issues | ✅ 继续提交 |

> 为什么不在主流程判定深度？防止主 agent 为省 token 合理化跳过审查。
> 深度决策权在 code-reviewer agent（独立 context，无偏差）。
>
> 强制跳过: `/dev-flow:commit --no-review`（仅供紧急修复，PR 审查会补偿）

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

### Step 5: Finalize (Server-verified)
```
dev_commit(action="finalize", token="<token>", message="type(scope): subject")
```

Server 验证：
1. Token 匹配（session 有效）
2. Diff hash 未变（review 后未改代码）
3. Review session log 已更新（reviewer 已执行）

如果需要跳过 review（紧急修复）：
```
dev_commit(action="finalize", token="<token>", message="...", skip_review=true)
```

> Server 内部使用 `DEV_FLOW_COMMIT=1 git commit` 执行，commit-guard hook 自动放行。

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
