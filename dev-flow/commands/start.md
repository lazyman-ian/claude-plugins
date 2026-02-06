---
description: Start new task - create branch, ledger, and optionally plan
---

# /dev-flow:start - 开始新任务

自动创建分支和 ledger，可选创建实现计划。

## 语法

```
/dev-flow:start TASK-XXX "描述"
/dev-flow:start TASK-XXX "描述" --plan    # 同时创建计划
```

## 自动执行流程

### Step 1: 检查状态
```bash
git status --short
```

| 状态 | 处理 |
|------|------|
| 有未提交更改 | 询问: stash / commit / 取消 |
| 不在 master | 询问: 切换到 master? |
| master 落后 | 自动 `git pull` |

### Step 2: 解析参数

从描述推断类型：

| 关键词 | 类型 | 分支前缀 |
|--------|------|---------|
| 添加/实现/新增/add/implement | feature | `feature/` |
| 修复/解决/fix | fix | `fix/` |
| 重构/refactor | refactor | `refactor/` |
| 优化/性能/perf | perf | `perf/` |
| 测试/test | test | `test/` |
| 文档/docs | docs | `docs/` |
| 紧急/hotfix | hotfix | `hotfix/` |

### Step 3: 转换分支名

中文 → 英文，空格 → 连字符，小写：
```
"添加 Google reCAPTCHA 验证" → "add-google-recaptcha"
```

### Step 4: 创建分支
```bash
git checkout master
git pull origin master
git checkout -b <type>/TASK-<number>-<description>
```

### Step 5: 创建 Ledger
```
dev_ledger(action="create", taskId="TASK-XXX", branch="<branch>")
```

自动生成 `thoughts/ledgers/TASK-XXX.md`:
```markdown
# TASK-XXX: [描述]

## Goal
[从描述提取]

## State
- [ ] 开发中
- [ ] 代码审查
- [ ] 合并完成

## Key Decisions
- [待补充]

## Open Questions
- [待补充]
```

### Step 6: (可选) 创建计划

如果带 `--plan` 参数：
```
→ 自动触发 /dev-flow:plan
```

## 输出

```
✅ 任务已创建

| 项目 | 值 |
|------|---|
| 分支 | feature/TASK-123-add-recaptcha |
| 类型 | feature |
| Ledger | thoughts/ledgers/TASK-123.md |

🎯 下一步: 开发 → `make fix` → `/dev-flow:commit`
```

## 示例

```bash
/dev-flow:start TASK-945 "添加 Google reCAPTCHA 验证"
# → feature/TASK-945-add-google-recaptcha

/dev-flow:start TASK-773 "修复图片浏览崩溃"
# → fix/TASK-773-fix-image-crash

/dev-flow:start TASK-800 "优化首页加载速度" --plan
# → perf/TASK-800-optimize-homepage-loading
# → 同时创建实现计划
```
