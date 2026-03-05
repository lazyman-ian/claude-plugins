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
| `/dev-flow:commit --amend` | 修改上次提交 (谨慎) |

## 重要

- ✅ 自动运行 `make fix` 和 `make check`
- ✅ 自动推断 scope
- ✅ 自动更新 ledger
- ❌ **不添加** Claude 署名
- ❌ **不添加** Co-Authored-By
