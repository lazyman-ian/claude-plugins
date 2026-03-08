---
description: Start new task - create branch, ledger, and optionally plan, spec, or full autonomous pipeline
---

# /dev-flow:start - 开始新任务

自动创建分支和 ledger，可选创建 spec、实现计划，或启动全自动流水线。

## 语法

```
/dev-flow:start TASK-XXX "描述"
/dev-flow:start TASK-XXX "描述" --plan         # 同时创建计划
/dev-flow:start TASK-XXX "描述" --spec         # 从描述生成 spec
/dev-flow:start TASK-XXX "描述" --auto         # 全自动流水线 (spec → plan → implement → PR)
/dev-flow:start --spec "notion.so/page/xxx"    # 从 Notion URL 生成 spec
/dev-flow:start --spec "path/to/req.md"        # 从文件生成 spec
/dev-flow:start --auto "path/to/requirements.md"  # 从文件启动全自动流水线
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

### Step 1.5: 解析输入源

识别描述参数的来源类型，统一转换为纯文本：

| 输入类型 | 识别方式 | 提取方法 |
|----------|----------|----------|
| Notion URL | `notion.so/*` 或 `notion.site/*` | Notion MCP tools → 提取标题 + 正文 |
| 文件路径 | `*.md`, `*.txt`, `*.pdf` | Read tool → 提取内容 |
| 其他 URL | `http://` 或 `https://` 开头 | WebFetch → 提取正文 |
| 纯文本 | 其他 | 直接传入 |

提取完成后，纯文本作为后续步骤的描述使用。

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

### Step 6: (可选) 生成 Spec

如果带 `--spec` 参数：
```
→ 将提取的纯文本传入 spec-generator agent
→ 生成结构化 spec 文件: thoughts/shared/specs/TASK-XXX.md
→ 输出 spec 路径，等待用户确认后继续
```

### Step 7: (可选) 创建计划

如果带 `--plan` 参数：
```
→ 自动触发 /dev-flow:plan
```

### Step 8: (可选) 全自动流水线

如果带 `--auto` 参数，在创建分支和 ledger 后，自动依次执行：

```
1. 生成 spec (同 --spec，跳过用户确认)
2. 创建实现计划 → /dev-flow:plan --from-spec
3. 执行实现 → /dev-flow:implement-plan (autonomy level 2)
4. 创建 PR → /dev-flow:pr
```

不带 `--auto` 时，每个步骤需手动触发（行为与原有流程一致）。

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

/dev-flow:start TASK-901 "新增用户反馈模块" --spec
# → feature/TASK-901-add-user-feedback
# → 生成 thoughts/shared/specs/TASK-901.md

/dev-flow:start --spec "notion.so/page/abc123"
# → 从 Notion 页面提取需求
# → 生成 spec 文件

/dev-flow:start TASK-910 "重构认证流程" --auto
# → feature/TASK-910-refactor-auth
# → 全自动: spec → plan → implement → PR
```
