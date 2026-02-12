---
plan_version: "2.0"
status: completed
created: 2026-02-12
ticket: UPGRADE-SUPERPOWERS-V2
phases:
  - id: 1
    name: "Brainstorm Skill Extraction + CSO"
    complexity: medium
    model: sonnet
    parallelizable: true
    depends_on: []
    target_files:
      - "dev-flow/skills/brainstorm/SKILL.md"
      - "dev-flow/skills/brainstorm/references/brainstorm-guide.md"
      - "dev-flow/commands/brainstorm.md"
      - "dev-flow/skills/*/SKILL.md"
    verify: ["test -f dev-flow/skills/brainstorm/SKILL.md"]
  - id: 2
    name: "Spec Reviewer + Self-Review + Execution Pipeline"
    complexity: high
    model: opus
    parallelizable: true
    depends_on: []
    target_files:
      - "dev-flow/agents/spec-reviewer.md"
      - "dev-flow/agents/implement-agent.md"
      - "dev-flow/agents/code-reviewer.md"
      - "dev-flow/skills/implement-plan/SKILL.md"
      - "dev-flow/skills/implement-plan/references/task-executor.md"
      - "dev-flow/skills/implement-plan/references/receiving-review.md"
    verify: ["test -f dev-flow/agents/spec-reviewer.md"]
  - id: 3
    name: "Adaptive Plan Template + Task Granularity"
    complexity: medium
    model: sonnet
    parallelizable: true
    depends_on: []
    target_files:
      - "dev-flow/skills/create-plan/SKILL.md"
      - "dev-flow/skills/create-plan/references/plan-template.md"
      - "dev-flow/skills/create-plan/references/process-steps.md"
    verify: ["grep -c 'logic-task\\|ui-task' dev-flow/skills/create-plan/references/plan-template.md"]
  - id: 4
    name: "Verification Skill + Branch Finish"
    complexity: low
    model: sonnet
    parallelizable: true
    depends_on: []
    target_files:
      - "dev-flow/skills/verify/SKILL.md"
      - "dev-flow/commands/finish.md"
      - "dev-flow/skills/dev/SKILL.md"
    verify: ["test -f dev-flow/skills/verify/SKILL.md && test -f dev-flow/commands/finish.md"]
  - id: 5
    name: "Batch Execution + Ripple Integration (agent-team, debugging, cross-platform)"
    complexity: high
    model: opus
    parallelizable: false
    depends_on: [2, 3, 4]
    target_files:
      - "dev-flow/skills/implement-plan/references/task-executor.md"
      - "dev-flow/skills/implement-plan/references/agent-orchestration.md"
      - "dev-flow/skills/agent-team/SKILL.md"
      - "dev-flow/skills/agent-team/references/team-patterns.md"
      - "dev-flow/skills/agent-team/references/management-guide.md"
      - "dev-flow/skills/cross-platform-team/SKILL.md"
      - "dev-flow/skills/debugging/SKILL.md"
    verify: ["grep -c 'self_review\\|spec.*review\\|verify' dev-flow/skills/agent-team/SKILL.md"]
  - id: 6
    name: "Version Bump + CLAUDE.md + Cleanup"
    complexity: low
    model: sonnet
    parallelizable: false
    depends_on: [1, 2, 3, 4, 5]
    target_files:
      - "dev-flow/.claude-plugin/plugin.json"
      - ".claude-plugin/marketplace.json"
      - "dev-flow/CLAUDE.md"
      - "CLAUDE.md"
      - "dev-flow/CHANGELOG.md"
    verify: ["grep -q '5.0.0' dev-flow/.claude-plugin/plugin.json"]
key_decisions:
  approach: "B - Skill decomposition refactor"
  plan_granularity: "Adaptive - logic-task (2-5min, complete code) + ui-task (5-15min, Figma ref + constraints)"
  worktree: "Deferred - not in this release"
  version_target: "5.0.0 (major - new skills, restructured pipeline)"
  philosophy: "Superpowers methodology (quality gates) + Dev-flow infrastructure (MCP/memory/hooks)"
---

# Dev-flow v5.0.0: Superpowers-Informed Restructuring

## Overview

将 [obra/superpowers](https://github.com/obra/superpowers) (v4.2.0, 50.4k stars) 的**方法论纪律**融入 dev-flow 的**基础设施自动化**，通过 Skill 分解重构实现最佳组合。

**核心目标**: 将执行管线的质量门密度从 2 gates/phase 提升到 5 gates/task。

## Current State Analysis

### 执行管线质量门对比

```
Superpowers (5 gates/task):
  Plan (完整代码, 2-5min task) → Fresh Subagent → Self-Review (11项) → Spec Review → Quality Review

Dev-flow (2 gates/phase):
  Plan (phase 级描述) → Agent (可能复用 context) → Code Review at Commit (P0-P3)
```

### Plan 粒度对比

| 维度 | Superpowers | Dev-flow | 目标 |
|------|-------------|----------|------|
| 任务粒度 | 2-5 min, 完整代码 | Phase 级, 描述性 | 自适应 (logic + ui) |
| 代码示例 | 完整实现代码 | 无/部分 | logic-task: 完整代码; ui-task: Figma ref |
| 验证命令 | 精确到单测文件 | `make test` 全局 | 精确到 task 级 |
| 目标读者 | "零经验 junior" | "有 context 的 agent" | "fresh subagent (无 context)" |

### 重构范围

| 变更类型 | 数量 | 详情 |
|---------|------|------|
| 新增 Skills | +2 | `brainstorm`, `verify` |
| 新增 Agents | +1 | `spec-reviewer` |
| 新增 Commands | +2 | `brainstorm.md`, `finish.md` |
| 新增 References | +3 | `brainstorm-guide.md`, `receiving-review.md`, task templates |
| 修改 Skills | 3 | `create-plan`, `implement-plan`, `dev` |
| 修改 Agents | 2 | `implement-agent`, `code-reviewer` |
| CSO 优化 | 12 | 所有 skill descriptions |
| 吸收 Skills | -1 | `api-implementer` → plan template reference |
| **净增** | **+2 skills, +1 agent, +2 commands** | 10→12 skills, 12→13 agents |

## Desired End State

### 重构后的 Skill 架构

```
Layer 1: Core Development Workflow (sequential, composable)
  brainstorm? → create-plan → implement-plan → [verify] → finish

Layer 2: Quality & Debugging
  debugging, self-check

Layer 3: Team Orchestration
  agent-team, cross-platform-team

Layer 4: Infrastructure & Meta
  dev, config-optimize, meta-iterate
```

### 重构后的执行管线

```
Per-Task Pipeline (implement-plan):

  ┌─────────────────┐
  │ Plan Task        │  自适应粒度:
  │ (from plan)      │  - logic-task: 2-5 min, 完整代码
  │                  │  - ui-task: 5-15 min, Figma ref + 约束
  └────────┬────────┘
           ↓
  ┌─────────────────┐
  │ Fresh Subagent   │  每个 task 独立 context
  │ (implement-agent)│  嵌入完整 task 文本 (不引用文件)
  │                  │  包含 prev handoff 摘要
  └────────┬────────┘
           ↓
  ┌─────────────────┐
  │ Self-Review      │  11-point checklist:
  │ (implementer)    │  完整性/质量/纪律/测试
  │                  │  BEFORE reporting back
  └────────┬────────┘
           ↓
  ┌─────────────────┐
  │ Spec Review      │  spec-reviewer agent (NEW):
  │ (spec-reviewer)  │  需求匹配度 - 不多不少
  │                  │  读实际代码, 不信任声明
  └────────┬────────┘
           ↓ (if approved)
  ┌─────────────────┐
  │ Quality Review   │  code-reviewer agent (existing):
  │ (code-reviewer)  │  P0-P3 severity
  │                  │  + review session log
  └────────┬────────┘
           ↓ (if approved)
  ┌─────────────────┐
  │ Task Complete    │  handoff + TaskUpdate
  │                  │  每 3 tasks → batch checkpoint
  └─────────────────┘

  质量门: 5 gates/task (vs 当前 2 gates/phase)
```

---

## Phase 1: Brainstorm Skill Extraction + CSO

**复杂度**: Medium | **模型**: Sonnet | **可并行**: Yes

### 1.1 提取 `brainstorm` 为独立 skill

**原因**: Superpowers 将 brainstorming 作为**所有创造性工作的强制前置步骤**，不仅限于 planning。当前 dev-flow 将它嵌入 create-plan，限制了复用。

**新建**:
- `skills/brainstorm/SKILL.md` — 独立 brainstorming skill
- `skills/brainstorm/references/brainstorm-guide.md` — Socratic 提问模板
- `commands/brainstorm.md` — `/brainstorm` 命令

**Brainstorm skill 核心设计**:

```yaml
---
name: brainstorm
description: >-
  Use before any creative work - creating features, building components,
  adding functionality, or modifying behavior. Explores requirements and
  design before implementation. Triggers on "brainstorm", "explore options",
  "design discussion", "头脑风暴", "设计讨论", "细化方案", "探索方案".
model: opus
memory: project
allowed-tools: [Read, Glob, Grep, WebSearch, Task, AskUserQuestion,
  mcp__plugin_dev-flow_dev-flow__dev_memory,
  mcp__plugin_dev-flow_dev-flow__dev_handoff]
---
```

**纪律规则** (from superpowers):
1. **一次一问** — 不要一次抛出 5 个问题
2. **多选偏好** — 给用户 2-4 个选项而非开放式
3. **200-300 word sections** — 设计呈现分段，每段后验证
4. **YAGNI 严格** — 每个方案要问 "Do we really need this?"
5. **Persist decisions** — 通过 `dev_handoff(action='write')` 持久化设计决策

**与 create-plan 的关系**:
```
brainstorm (独立) → 产出: design decisions handoff
                 ↓ (可选) 自动流转到 create-plan
create-plan (聚焦于 implementation planning)
```

### 1.2 修改 `create-plan` 聚焦实现规划

**修改**: `skills/create-plan/SKILL.md`
- 移除 Design Exploration mode (已迁移到 brainstorm)
- 保留 Implementation Planning mode
- 引用 brainstorm 的 design decisions handoff
- 更新 description (CSO)

### 1.3 CSO 优化所有 Skill Descriptions

**原则**: Description 仅包含**何时触发**，不描述工作流。

| Skill | 当前 (含工作流) | 优化后 (仅触发条件) |
|-------|----------------|-------------------|
| implement-plan | "Executes implementation plans with TDD and agent orchestration..." | "Use when executing approved implementation plans, following TDD, or implementing features step-by-step." |
| debugging | "Systematic debugging using 4-phase root cause analysis..." | "Use when debugging failures, investigating crashes, or troubleshooting unexpected behavior." |
| agent-team | "Orchestrates Agent Teams for parallel development..." | "Use when organizing parallel development with multiple agents." |
| (etc.) | ... | ... |

**变更**: 12 个 skill 的 description 字段

---

## Phase 2: Spec Reviewer + Self-Review + Execution Pipeline

**复杂度**: High | **模型**: Opus | **可并行**: Yes

### 2.1 新增 `agents/spec-reviewer.md`

Superpowers 执行管线的核心创新 — spec compliance review 独立于 code quality review。

```markdown
---
name: spec-reviewer
description: >-
  Verify implementation matches spec exactly - nothing more, nothing less.
  Use after task implementation, before code quality review.
  Triggers on "spec review", "check spec compliance", "验证需求匹配".
model: sonnet
color: cyan
---

# Spec Compliance Reviewer

## Core Mandate

Verify implementer built EXACTLY what was requested. Read actual code.
Do NOT trust implementer's claims.

## Process

1. **Read Spec** — Full task description from plan
2. **Read Code** — Every changed file, line by line
3. **Compare** — For each requirement:
   - ✅ Implemented correctly (cite file:line evidence)
   - ❌ Missing (what's not there)
   - ⚠️ Over-built (what's extra, not requested)
   - 🔀 Misunderstood (incorrect interpretation)

## Approval Decision

- **APPROVED**: All requirements met, nothing extra, nothing missing
- **REQUEST CHANGES**: Found issues → list specific fixes needed

## Red Flags (Auto-Reject)

- Implementer claims "done" but code doesn't match spec
- Extra features not in spec (YAGNI violation)
- Tests that don't actually verify the requirement
- Hardcoded values where spec asks for configuration

## Output Format

### ✅ Spec Compliant
- Requirement 1: ✅ Implemented at `src/auth.ts:45-67`
- Requirement 2: ✅ Test coverage at `tests/auth.test.ts:12-30`

### ❌ Issues Found
- Requirement 3: ❌ Missing - no error handling for invalid tokens
- Over-built: Added rate limiting (not in spec) at `src/middleware.ts:20-35`
```

### 2.2 增强 `agents/implement-agent.md` — Self-Review Checklist

在 implement-agent 执行完毕、报告之前，强制执行 11 项自检：

```markdown
## Self-Review Checklist (MANDATORY before reporting)

### Completeness
- [ ] All spec requirements implemented
- [ ] Edge cases from spec handled
- [ ] No requirements silently skipped

### Quality
- [ ] Names are clear and consistent with codebase
- [ ] Code is maintainable (another dev can understand)
- [ ] No temporary hacks left in place

### Discipline
- [ ] YAGNI — only built what was requested
- [ ] Followed existing patterns in codebase
- [ ] No unnecessary abstractions

### Testing
- [ ] Tests verify actual behavior (not mock behavior)
- [ ] TDD discipline followed (if TDD mode)
- [ ] Tests are comprehensive, not just happy path
```

### 2.3 修改 `implement-plan` 执行管线

**核心变更**: 将 2-gate/phase pipeline 升级为 5-gate/task pipeline。

**修改文件**:
- `skills/implement-plan/SKILL.md` — 增加执行管线描述
- `references/task-executor.md` — 重写，加入 two-stage review
- `references/receiving-review.md` — 新增，处理 review 反馈

**Task Executor 新流程**:

```
Per Task:
  1. Prepare Context
     - Read plan task (embed full text, not file reference)
     - Read prev handoff summary
     - Query dev_memory for pitfalls

  2. Spawn Fresh Implementer
     - Task(subagent_type="general-purpose", model=per-task)
     - MUST be fresh context (anti-corruption)
     - Inject: task text + self-review checklist + prev handoff

  3. Implementer Self-Review
     - 11-point checklist before reporting
     - If any item fails → fix before reporting

  4. Spec Review (NEW)
     - Spawn spec-reviewer agent
     - Input: task spec + implementer's changes (git diff)
     - Decision: APPROVED → continue | REQUEST CHANGES → back to step 2
     - Max 2 iterations (if still failing → escalate to user)

  5. Quality Review (enhanced existing)
     - Only after spec review passes
     - Spawn code-reviewer agent
     - P0/P1 → block, fix, re-review
     - P2/P3 → note, continue
     - Append to review session log

  6. Complete Task
     - Create handoff via dev_handoff
     - TaskUpdate status: completed
     - Check batch checkpoint (every N tasks)
```

### 2.4 新增 `references/receiving-review.md`

指导 implement-agent 如何**技术性地**处理 spec-reviewer 和 code-reviewer 的反馈。

**核心规则**:
- 验证后再实现，提问后再假设
- **禁止表演性短语**: "You're absolutely right!", "Great point!", "Excellent suggestion!"
- Pushback 允许条件: 打破现有功能 / 缺乏完整上下文 / 违反 YAGNI / 技术上不正确
- 处理流程: 完整阅读 → 复述 → 代码库验证 → 技术评估 → 回应 → 逐项实现+测试

---

## Phase 3: Adaptive Plan Template + Task Granularity

**复杂度**: Medium | **模型**: Sonnet | **可并行**: Yes

### 3.1 自适应 Task 格式

Plan template 支持两种 task 格式，plan-agent 根据 target_files 类型自动选择：

#### logic-task (后端/工具/算法)

```yaml
tasks:
  - id: "1.1"
    type: logic-task
    description: "Create JWT token utility"
    estimated_minutes: 3
    files:
      create: ["src/utils/jwt.ts"]
      test: ["tests/utils/jwt.test.ts"]
    steps:
      - "Write failing test for generateToken()"
      - "Implement generateToken() with RS256"
      - "Write failing test for verifyToken()"
      - "Implement verifyToken()"
      - "Refactor: extract constants"
    code: |
      // Complete implementation code here
      export function generateToken(payload: JwtPayload): string {
        return jwt.sign(payload, privateKey, { algorithm: 'RS256' });
      }
    verify: "npm test -- --testPathPattern=jwt"
    commit: "feat(auth): add JWT token utility"
```

**特点**: 完整代码在 plan 中，fresh subagent 可以直接执行。

#### ui-task (前端/移动端/设计还原)

```yaml
tasks:
  - id: "2.1"
    type: ui-task
    description: "Implement PropertyCard component"
    estimated_minutes: 10
    files:
      create: ["src/components/PropertyCard.swift"]
      modify: ["src/views/ListingView.swift:45-60"]
      test: ["tests/PropertyCardTests.swift"]
    figma:
      file_key: "abc123"
      node_id: "456:789"
      design_constraints:
        - "Card height: 120pt, corner radius: 12pt"
        - "Image aspect ratio: 16:9, left-aligned"
        - "Title: SF Pro Display Semibold 17pt"
        - "Price: SF Pro Display Bold 20pt, color: #E63946"
    data_binding:
      - "title → property.address"
      - "price → property.formattedPrice"
      - "image → property.thumbnailURL (async load)"
    interaction:
      - "Tap → navigate to PropertyDetailView(id:)"
      - "Long press → show share sheet"
    verify: "manual: screenshot comparison with Figma"
    commit: "feat(ui): implement PropertyCard component"
```

**特点**: Figma reference 代替完整代码，设计约束作为验证标准。

### 3.2 修改 Plan Template Frontmatter

```yaml
phases:
  - id: 1
    name: "Auth Service"
    complexity: medium
    model: sonnet
    parallelizable: false
    depends_on: []
    target_files: ["src/utils/jwt.ts", "src/middleware/auth.ts"]
    verify: ["npm test -- --testPathPattern=auth"]
    tasks:                    # NEW: optional task breakdown
      - id: "1.1"
        type: logic-task      # NEW: task type
        description: "..."
        estimated_minutes: 3  # NEW: granularity indicator
        files: {...}
        verify: "..."
```

**规则**:
- `tasks` 是可选字段 — 简单 phase 不需要
- complex phase (6+ files 或 complexity: high) **建议**细化到 tasks
- plan-agent 根据 complexity 自动决定是否细化
- 没有 tasks 的 phase → implement-plan 按当前方式执行（phase 级）
- 有 tasks 的 phase → implement-plan 按 task 级执行（5-gate pipeline）

### 3.3 修改 create-plan 聚焦实现规划

**修改**: `skills/create-plan/SKILL.md`
- 移除 Design Exploration 相关内容（已移至 brainstorm）
- 增加 task 细化指导
- 引用新 plan template

**修改**: `references/process-steps.md`
- Step 4 (Detailed Plan Writing) 增加 task 细化逻辑：
  - 评估 phase complexity
  - complex → 细化为 logic-task/ui-task
  - simple → 保持 phase 级

---

## Phase 4: Verification Skill + Branch Finish

**复杂度**: Low | **模型**: Sonnet | **可并行**: Yes

### 4.1 新增 `skills/verify/SKILL.md`

```yaml
---
name: verify
description: >-
  Use before claiming any work is complete. Enforces fresh verification
  evidence before completion claims. Internal skill referenced by
  implement-plan and agent-team. Triggers automatically, not user-invoked.
user-invocable: false
allowed-tools: [Bash, Read, Glob, Grep]
---
```

**Iron Law**: "No completion claims without fresh verification evidence."

**核心规则**:
1. 声称完成前**必须**运行验证命令
2. 验证结果必须是**当前的**（不引用之前的结果）
3. 禁止模糊语言: "should", "probably", "seems to", "I believe"
4. 不信任 agent 的成功报告 — 独立运行验证
5. 退出码 0 才算完成

**Gate Function**:
```
1. IDENTIFY: 获取验证命令 (dev_config 或 plan 的 verify 字段)
2. RUN: 完整执行，不截断输出
3. READ: 检查退出码和完整输出
4. VERIFY: 输出确认了声称的状态？
5. ONLY THEN: 声称完成
```

**Common Failure Patterns**:
- ❌ "Tests passed earlier" → 必须现在运行
- ❌ "The fix should work" → 必须验证
- ❌ "Linter only has warnings" → 必须确认无 errors
- ❌ Trusting agent success report → 必须独立验证

### 4.2 新增 `commands/finish.md` (`/dev finish`)

```yaml
---
description: Complete development on current branch
disable-model-invocation: true
---
```

**流程**:
1. **Verify Tests** — 运行 `dev_config` 获取的 verify 命令
   - 失败 → 停止，显示错误
2. **Detect Base Branch** — main / master / develop
3. **Present 4 Options** (via AskUserQuestion):
   1. **Merge locally** — `git checkout {base} && git merge {branch}`
   2. **Push & Create PR** — 自动流转到 `/dev pr`
   3. **Keep branch** — 不做任何操作
   4. **Discard work** — 需要输入 "discard" 确认，`git checkout {base} && git branch -D {branch}`
4. **Execute Choice**
5. **Update Ledger** — 记录完成状态

### 4.3 修改 `skills/dev/SKILL.md`

添加 `/dev finish` 到命令列表。

---

## Phase 5: Batch Execution + Integration

**复杂度**: Medium | **模型**: Sonnet | **依赖**: Phase 2, 3

### 5.1 Batch Checkpoint 机制

**修改**: `references/task-executor.md`

```
每完成 N 个 tasks (默认 N=3):
  → 暂停执行
  → 显示 Batch Report:
    ┌─────────────────────────────────────┐
    │ Batch 1 Complete (Tasks 1.1 - 1.3)  │
    ├─────────────────────────────────────┤
    │ ✅ Task 1.1: JWT utility            │
    │ ✅ Task 1.2: Auth middleware         │
    │ ✅ Task 1.3: Token refresh           │
    │                                     │
    │ Verification: npm test ✅ (23/23)   │
    │ Spec Reviews: 3/3 passed            │
    │ Quality Reviews: 3/3 passed         │
    │                                     │
    │ Next batch: Tasks 1.4 - 1.6        │
    └─────────────────────────────────────┘
  → 等待用户: "Continue" / "Adjust" / "Stop"
```

**选项**:
- `--no-checkpoint` — 跳过 checkpoint（自动化场景）
- `--batch-size N` — 自定义 batch 大小
- Agent Orchestration 模式下默认启用
- Direct 模式 (≤3 tasks) 不需要 checkpoint

### 5.2 集成 verify skill

在 implement-plan 的 task completion 环节引用 verify skill:

```
Task 完成 → verify skill 检查 → 通过 → handoff + TaskUpdate
                                ↓ 失败
                         → 保持 in_progress, 要求修复
```

### 5.3 agent-team Ripple Integration

**修改文件**: `skills/agent-team/SKILL.md`, `references/team-patterns.md`, `references/management-guide.md`

#### 5.3.1 Teammate Prompt Template 更新

在 SKILL.md 的 Teammate Spawn Template 中注入 self-review checklist:

```markdown
## Teammate Template (updated)

每个 teammate spawn 时注入:
1. 任务描述 + 验证命令
2. **Self-Review Checklist** (11 项)  ← NEW
3. Working set 文件列表
4. dev_memory 查询结果 (if available)

Teammate 完成任务后必须:
- 执行 self-review checklist
- 在 handoff 中包含 verification evidence
- 不得声称完成但无验证证据
```

#### 5.3.2 Reviewer Teammate 合并 Spec+Quality

当前 reviewer teammate 仅做 code quality review。升级为**合并 spec+quality review**:

```markdown
## Reviewer Teammate (v5.0.0)

职责 (合并):
1. **Spec Review** — 任务输出是否匹配 plan 要求?
   - Read actual code，不信任 teammate 的声明
   - 检查 file paths、function signatures、test coverage
2. **Quality Review** — 代码质量是否达标?
   - P0-P3 severity (复用 code-quality-checklist.md)
   - Architecture patterns, error handling, security

优势: reviewer 拥有 accumulated cross-module context，
合并两阶段避免上下文切换开销。

触发: 每个 teammate 完成任务 → reviewer 审查
阻塞: P0/P1 findings → 打回修改
通过: P2/P3 记录 → TaskUpdate completed
```

#### 5.3.3 Phase 3 (Execute) 更新

```markdown
## Phase 3: Execute (updated)

每个 teammate 的执行流程:
1. Read task → dev_memory(query) → 获取相关知识
2. Implement (TDD if applicable)
3. **Self-review** (11-point checklist) ← NEW
4. Handoff → reviewer teammate
5. Reviewer: **spec + quality review** (合并) ← UPDATED
6. P0/P1 → 打回 teammate 修改
7. Pass → TaskUpdate completed → 下一个任务
```

#### 5.3.4 Phase 4 (Close) 更新

Phase 4 在 TeamDelete 前增加 verify skill 检查:

```
Phase 4: Close
1. dev_aggregate(action='pr_ready') — 聚合所有 handoff
2. **verify skill** — 运行完整验证 ← NEW
3. dev_memory(consolidate) — 知识归档
4. Shutdown teammates → TeamDelete
```

### 5.4 cross-platform-team Ripple

**修改文件**: `skills/cross-platform-team/SKILL.md`

cross-platform-team 继承 agent-team 的所有更新，额外:

- **UI-task spec review**: reviewer teammate 对 UI 任务需检查 Figma 设计约束 (来自 plan 的 `design_ref` 字段)
- **Platform-specific verification**: 各平台 teammate 的 verify 命令不同 (iOS: `swiftlint + xcodebuild`, Android: `ktlint + assembleDebug`, Web: `eslint + build`)
- 继承方式: SKILL.md 中 `extends: agent-team` 引用即可，不重复定义

### 5.5 debugging Ripple

**修改文件**: `skills/debugging/SKILL.md`

debugging 的 5 阶段 (OBSERVE→HYPOTHESIZE→TEST→FIX→VERIFY) 中，Phase 5 (VERIFY) 引用 verify skill:

```markdown
## Phase 5: VERIFY (updated)

当前: 手动验证命令
更新: 引用 verify skill 确保一致性

VERIFY:
1. 使用 verify skill 运行完整验证
2. 验证 fix 未引入新问题 (regression check)
3. 更新 dev_memory 记录 fix 方案 (if novel)
```

---

## Phase 6: Version Bump + CLAUDE.md + Cleanup

**复杂度**: Low | **模型**: Sonnet | **依赖**: All

### 6.1 吸收 `api-implementer`

将 `api-implementer` skill 的 checklists 移入 `create-plan/references/api-template.md` 作为 plan 参考模板。删除 `skills/api-implementer/`。

**原因**:
- api-implementer 本质是一个 plan template + checklist，不是独立工作流
- 移入 create-plan 作为领域特定 template 更合理
- 减少 skill 数量避免触发混淆

### 6.2 版本更新

| 文件 | 变更 |
|------|------|
| `dev-flow/.claude-plugin/plugin.json` | version: "5.0.0" |
| `.claude-plugin/marketplace.json` | dev-flow version: "5.0.0" |
| `dev-flow/CHANGELOG.md` | v5.0.0 release notes |
| `dev-flow/CLAUDE.md` | 更新架构图、skill 列表、执行管线描述 |
| `CLAUDE.md` (root) | 更新 dev-flow version |

### 6.3 最终 Skill Inventory (v5.0.0)

| # | Skill | 状态 | Layer |
|---|-------|------|-------|
| 1 | **brainstorm** | **NEW** | Core Workflow |
| 2 | create-plan | Modified (narrowed scope) | Core Workflow |
| 3 | implement-plan | **Restructured** (5-gate pipeline) | Core Workflow |
| 4 | **verify** | **NEW** (internal) | Core Workflow |
| 5 | debugging | Modified (verify skill in VERIFY phase) | Quality |
| 6 | self-check | Unchanged | Quality |
| 7 | agent-team | Modified (self-review + merged reviewer + verify) | Orchestration |
| 8 | cross-platform-team | Modified (inherit agent-team + UI spec review) | Orchestration |
| 9 | dev | Modified (+/finish) | Infrastructure |
| 10 | config-optimize | Unchanged | Meta |
| 11 | meta-iterate | Unchanged | Meta |
| — | ~~api-implementer~~ | **Absorbed** into create-plan ref | — |

**Skills: 11** (10 + 2 new - 1 absorbed)
**Agents: 13** (12 + 1 spec-reviewer)
**Commands: 24** (22 + brainstorm + finish)

---

## Risk Analysis

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| Two-stage review 增加 2x subagent 成本 | 高 | 中 | 仅 task 级别启用；phase 级保持单次 review |
| Spec reviewer 与 code reviewer 重叠 | 中 | 低 | 明确分工: spec = "匹配度", quality = "代码质量" |
| Brainstorm 独立后与 create-plan 触发混淆 | 中 | 中 | CSO 描述明确区分: brainstorm = "before creative work", plan = "when requirements are clear" |
| Plan task 粒度过细增加 planning 时间 | 中 | 低 | 仅 complex phase 细化; simple phase 保持 phase 级 |
| 删除 api-implementer 影响现有用户 | 低 | 低 | 功能保留为 reference template |
| Batch checkpoint 打断自动化流程 | 中 | 低 | `--no-checkpoint` 选项 |

## What NOT to Adopt from Superpowers

| 特性 | 不采纳原因 |
|------|-----------|
| TodoWrite | 已有 TaskCreate/TaskUpdate 更强 |
| `docs/plans/` 路径 | 保持 `thoughts/shared/plans/` |
| `using-superpowers` 元 skill | hooks 自动注入更可靠 |
| Git Worktree | 暂缓 — Claude Code session 切换限制 |
| 并行 dispatch skill | 已有 agent-team 更完整 |
| writing-skills | 已有 meta-iterate + skill-developer |
| 完全替换 P0-P3 review | 保留现有 code-reviewer 作为 quality stage |

## Success Criteria

### Automated Verification
- [ ] 所有 11 个 skill 存在且 frontmatter 格式正确
- [ ] spec-reviewer agent 文件存在
- [ ] finish command 文件存在
- [ ] plan template 包含 logic-task/ui-task 格式
- [ ] implement-plan 引用 spec-reviewer + verify skill
- [ ] CSO: 所有 description 不含工作流描述
- [ ] Version 更新为 5.0.0

### Manual Verification
- [ ] `brainstorm` skill 在创造性请求时正确触发
- [ ] `create-plan` 不再触发 brainstorm 模式
- [ ] implement-plan 的 5-gate pipeline 正确执行
- [ ] Batch checkpoint 在第 3 个 task 后暂停
- [ ] `/dev finish` 正确呈现 4 个选项
- [ ] spec-reviewer 独立于 code-reviewer 运行
