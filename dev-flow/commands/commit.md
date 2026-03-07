---
description: Smart commit - auto-fix, auto-scope, auto-reasoning
---

# /dev-flow:commit - 智能提交

自动检查、修复、生成 commit message 和 reasoning。

## 自动执行流程

### Step 1: 质量检查
```
dev_config()  # 获取平台特定的 fix/check 命令
```

执行返回的 fix 命令（如 `make fix`、`swiftlint --fix`、`ruff check --fix`），
然后执行 check 命令验证。

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

### Step 2.3: Code Simplification (optional, `--simplify`)

当使用 `--simplify` 时，AI 根据改动规模自动选择工具：

| 信号 | 选择 | 原因 |
|------|------|------|
| staged lines < 100 | `Skill("simplify")` — CC 内置 | light 足够 |
| staged lines >= 100 且已安装 | `Task(subagent_type="code-simplifier:code-simplifier")` | 大改动需要 opus |
| staged lines >= 100 未安装 | `Skill("simplify")` + 提示安装 | fallback + hint |

然后验证行为不变：
```
dev_config() → 获取 verify 命令 → 执行
```

| 结果 | 行为 |
|------|------|
| simplify + verify PASS | 重新 stage (`git add -u`)，继续 review |
| simplify 无改动 | 继续 review |
| verify FAIL | 提示用户 review 简化改动，不自动继续 |

> dev-flow 不维护简化逻辑，两个工具各跟随上游更新。

### Step 2.4: UI Verification (AI 自主决策)

检测 staged changes 中是否包含 UI 文件：

```bash
UI_FILES=$(git diff --cached --name-only | grep -iE '\.(css|scss|less|styled|vue|tsx|jsx|swift|kt)$' | head -5)
HAS_FIGMA_CONTEXT=$(git log -1 --format=%B | grep -qi 'figma' && echo 1)
```

| 信号 | 行为 |
|------|------|
| UI 文件改动 + 当前 session 有 Figma URL | 自动调用 `Skill("ui-verify")` |
| UI 文件改动 + 无 Figma context | 提示: "检测到 UI 改动，有 Figma 设计稿可对比吗？" |
| 无 UI 文件改动 | 跳过 |

### Step 2.5: Quality Gate (轻量)

检查是否需要 full review:

1. 读取 review session log (`.git/claude/review-session-{branch}.md`) 最近条目时间
2. 如果最近 5 分钟内有 `/dev review` 记录 → 跳过 (已 review)
3. 否则: 运行 `dev_check()` (lint-level, ~10 tokens)

| 结果 | 行为 |
|------|------|
| dev_check pass | ✅ 继续提交 |
| dev_check fail | ❌ 停止，显示错误，建议 `dev_fix()` |
| 最近有 review | ⏩ 跳过检查，继续提交 |

> Full code review 在 `/dev pr` 时执行。commit-gate 只做 lint 验证。
> 需要 commit 时 full review: `/dev review` → `/dev commit`
> 强制 full review: `/dev commit --review`

当使用 `--review` 时，spawn code-reviewer agent（与之前行为一致）：

```
Task(subagent_type="dev-flow:code-reviewer",
     prompt="Review staged changes (commit gate mode).
             Files: <git diff --cached --name-only>
             Report P0/P1 only. Auto-classify risk level.
             Read branch-scoped review session log for previous review context.
             After review, append findings to review session log.")
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

### Step 6: 更新 Ledger
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

🎯 下一步: `git push` 或 继续开发
```

## 选项

| 选项 | 说明 |
|------|------|
| `/dev-flow:commit` | 自动生成 message |
| `/dev-flow:commit "message"` | 使用指定 message |
| `/dev-flow:commit --simplify` | 提交前简化 (AI 自动选 light/deep) |
| `/dev-flow:commit --review` | 强制 full code review (spawn code-reviewer) |
| `/dev-flow:commit --amend` | 修改上次提交 (谨慎) |

## 重要

- ✅ 自动运行 `dev_config()` 返回的 fix/check 命令
- ✅ 自动推断 scope
- ✅ 自动更新 ledger
- ❌ **不添加** Claude 署名
- ❌ **不添加** Co-Authored-By
