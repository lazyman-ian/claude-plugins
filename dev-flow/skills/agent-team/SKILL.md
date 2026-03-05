---
name: agent-team
description: Orchestrates parallel agent teams for multi-phase development tasks with automatic model selection, task graphs, and teammate coordination. This skill should be used when the user needs parallel development with multiple agents, team-based task execution, or fan-out workflows within a single repository. Key capabilities include team lifecycle management, conflict detection, handoff aggregation, and dynamic scaling. Triggers on "agent team", "team up", "parallel agents", "fan-out", "master-worker", "organize team", "spawn agents", "组队开发", "并行开发", "多agent协作", "团队协作", "Agent团队", "多人协作", "任务分配", "团队编排". Do NOT use for cross-platform multi-repo workflows spanning iOS/Android/Web — use "cross-platform-team" instead.
memory: user
context: fork
allowed-tools: [Read, Glob, Grep, Bash, Skill, Task, TeamCreate, TeamDelete, SendMessage, TaskCreate, TaskUpdate, TaskList, TaskGet, AskUserQuestion, mcp__plugin_dev-flow_dev-flow__*]
---

# Agent Team

Generic orchestration layer for Agent Teams. Manages team lifecycle, task graphs, model selection, and teammate coordination for any project type.

For cross-platform multi-repo workflows, use `/cross-platform-team` which extends this skill.

## Core Principle

> **Environment design > agent sophistication.** Success depends on tests, environment, and feedback quality — not agent complexity.

Design the environment (tests, verify commands, task boundaries) so agents can self-navigate. The verifier must be near-perfect; poor tests lead agents astray.

## Model Strategy

| Role | Model | Reasoning | Cost Impact |
|------|-------|-----------|-------------|
| **Planning** | `opus` | Architecture, module decomposition, dependency analysis | Higher cost, deeper reasoning |
| **Implementation** | `sonnet` (default) | Code generation, balanced quality | Medium cost |
| **Review teammate** | `opus` | Cross-module reasoning, security analysis, pattern recognition | Higher cost, catches cross-cutting bugs |
| **Quick tasks** | `haiku` | File checks, simple validations, formatting | Lower cost |

**Estimated savings**: 40-50% compared to all-opus, with minimal quality impact.

## Workflow

### Phase 1: Plan (Lead, use **opus**)

Analyze requirements, decompose into parallel modules, detect dependencies.

0. **Pre-flight Check**: Validate product direction before technical work. See `references/management-guide.md` § Pre-flight Check.
   - User stories / acceptance criteria clear?
   - Business logic agreed (not just tech approach)?
   - Plan reviewed AND re-reviewed after corrections?
1. Understand the task scope and deliverables
2. Decompose into independent modules/subtasks
3. Detect parallelism:
   - Independent modules → fan-out (parallel)
   - Sequential dependencies → pipeline (serial)
   - File conflicts → serialize conflicting tasks
4. Define task graph with dependencies
5. If research needed → spawn research agent:
   ```
   Task({
     subagent_type: "research:research-agent",
     name: "researcher",
     model: "opus",
     prompt: "Research {topic}"
   })
   ```
6. If plan needed → use `/create-plan` or spawn plan agent:
   ```
   Task({
     subagent_type: "dev-flow:plan-agent",
     name: "planner",
     model: "opus",
     prompt: "Create plan for {feature}"
   })
   ```
   `/create-plan` generates plan frontmatter v2.0 with phases metadata (complexity, model, parallelizable, target_files, verify) — used by Phase 2 for auto-task creation.
7. Optional: validate tech choices after plan:
   ```
   Task({ subagent_type: "dev-flow:validate-agent", prompt: "Validate plan at {plan_path}" })
   ```

### Phase 2: Setup (Lead)

Create team, task graph, and dependency relationships.

**If plan has frontmatter v2.0** (`plan_version: "2.0"`): `/implement-plan` can auto-create tasks from `phases` metadata. Consider letting teammates use `/implement-plan` directly for their assigned sections.

**Manual setup** (no plan or custom task graph):

```
# 1. Create team
TeamCreate({ team_name: "TASK-{id}" })

# 2. Create tasks
TaskCreate({ subject: "Module A: {description}", activeForm: "Implementing Module A" })
TaskCreate({ subject: "Module B: {description}", activeForm: "Implementing Module B" })
TaskCreate({ subject: "Module C: {description}", activeForm: "Implementing Module C" })

# 3. Set dependencies (from plan frontmatter depends_on, or manual)
TaskUpdate({ taskId: "2", addBlockedBy: ["1"] })  # B depends on A

# 4. Detect file conflicts via dev_coordinate
dev_coordinate(action='plan', mode='fan-out', tasks=[
  { id: 't1', targetFiles: ['src/auth.ts'] },
  { id: 't2', targetFiles: ['src/api.ts'] },
  { id: 't3', targetFiles: ['src/auth.ts'] }  # conflict with t1!
])
# → Serialize conflicts: TaskUpdate({ taskId: 't3', addBlockedBy: ['t1'] })

# 5. Spawn review teammate (for 3+ impl agents or security-sensitive work)
Task({
  subagent_type: "dev-flow:code-reviewer",
  team_name: "TASK-{id}",
  name: "reviewer",
  model: "opus",
  prompt: <<PROMPT
{See Reviewer Prompt Template below}
PROMPT
})
```

**何时启用 reviewer teammate**:

| 条件 | Reviewer? | 原因 |
|------|-----------|------|
| 3+ implementation agents | ✅ 启用 | 跨模块交互风险高 |
| 涉及 auth/cors/security 文件 | ✅ 启用 | 安全敏感需要持续审查 |
| 2 agents, 独立模块 | ❌ 不需要 | per-commit review 足够 |
| 1 agent | ❌ 不需要 | 无跨模块风险 |

### Phase 3: Execute (Team, use **sonnet**)

Spawn teammates, monitor progress, handle errors.

**Per-teammate execution flow** (v5.0.0):
1. Read task → `dev_memory(query)` → get relevant knowledge
2. Implement (TDD if applicable)
3. **Self-review** (11-point checklist) — fix issues before reporting
4. Run verification command
5. `/dev commit` → reviewer teammate notification
6. Reviewer: **merged spec + quality review** — accumulated context advantage
7. P0/P1 or spec mismatch → teammate fixes
8. Pass → `TaskUpdate(completed)` → next task

**Two-layer review**:

| Layer | 机制 | 覆盖范围 |
|-------|------|---------|
| **Per-commit** (自动) | `/dev commit` Step 2.5 code-reviewer agent | 单文件 P0/P1 |
| **Cross-module** (reviewer teammate) | 持久化 reviewer 积累跨模块 context + spec compliance | 跨模块交互 + 需求匹配 |

**Reviewer 交互协议** (当 reviewer teammate 存在时):

Implementer 提交后通知 reviewer：
```
# Implementer 完成 commit 后
SendMessage({
  type: "message",
  recipient: "reviewer",
  content: "Committed {hash}: {commit_message}\nFiles: {changed_files}\nTask: {task_description}\nPlease review for spec compliance + cross-module concerns.",
  summary: "Review request: {module}"
})
```

Reviewer 审查后回复：
```
# 无问题
SendMessage({ recipient: "{impl}", content: "✅ LGTM (spec + quality), no cross-module issues.", summary: "Review passed" })

# 有问题
SendMessage({ recipient: "{impl}", content: "🔴 P1: {file}:{line} — {issue}. Fix before next commit.", summary: "P1 found, fix needed" })

# Spec 不匹配
SendMessage({ recipient: "{impl}", content: "📋 SPEC: Missing requirement X from task. Implement before proceeding.", summary: "Spec mismatch, fix needed" })
```

**优势**: Reviewer 持续积累 context —— 看到 Auth 改动后再看 CORS 改动，能发现两者的交互问题。合并 spec+quality 审查避免上下文切换开销。

**Delegate Mode**: For 3+ teammates, press `Shift+Tab` to restrict lead to coordination-only (spawn, message, shutdown, task management). Prevents lead from implementing tasks meant for teammates.

**Plan Approval**: For risky or complex tasks, require teammate to plan before implementing:
```
Spawn {module}-dev and require plan approval before making changes.
Only approve plans that include verification steps.
```
The teammate stays in read-only plan mode until lead approves. Reject with feedback to iterate.

```
# Pre-fetch knowledge for each teammate's domain
knowledge = dev_memory(action='query', query='{task_keywords} {platform}')

# Spawn per task (parallel for independent tasks)
Task({
  subagent_type: "general-purpose",
  team_name: "TASK-{id}",
  name: "{module}-dev",
  # model: sonnet (default)
  prompt: <<PROMPT
{See Teammate Prompt Template below}
# Inject knowledge query results into ## Historical Knowledge section
PROMPT
})

# Assign tasks
TaskUpdate({ taskId: "1", owner: "{module}-dev" })
```

**Monitoring & Scaling** (see `references/management-guide.md` § Dynamic Scaling):
- Teammates send progress via `SendMessage`
- Check `TaskList()` for blocked/completed status
- If teammate stuck → `SendMessage` with guidance
- If verify fails → teammate keeps trying, does NOT report done
- Teammate idle > 30min → shutdown, re-spawn if needed later
- Teammate context > 80% → shutdown + re-spawn with fresh context
- Sonnet fails 3x → escalate to opus model

### Phase 4: Close (Lead)

Verify results, aggregate, review, shutdown teammates, clean up.

```
1. Final review:

   A) 有 reviewer teammate (推荐，3+ agents):
      # Reviewer 已持续审查，只需请求最终报告
      SendMessage({
        recipient: "reviewer",
        content: "All implementation tasks complete. Please provide final
                  spec + quality review summary (P0-P3) for PR description.
                  Include: spec coverage, cross-cutting findings, module boundary issues,
                  positive patterns observed.",
        summary: "Request final review summary"
      })
      # Reviewer 有完整 context + spec knowledge，报告更准确

   B) 无 reviewer teammate (1-2 agents):
      # 一次性 spawn code-reviewer (无跨模块 context)
      Task({
        subagent_type: "dev-flow:code-reviewer",
        name: "reviewer",
        model: "opus",
        prompt: "PR review mode. Branch diff: git diff master...HEAD
                 Auto-classify risk. Check commit review coverage.
                 Focus on cross-module interactions."
      })

   | Result | Action |
   |--------|--------|
   | P0/P1 found | SendMessage teammate to fix before proceeding |
   | P2/P3 only | Record in PR description as follow-up |
   | Clean | Proceed to verification |

2. Review: check each task completed, verify results
3. Issues found → SendMessage teammate to fix
4. **Verify** (via verify skill): run full verification suite
   - Failure → SendMessage relevant teammate to fix
   - Pass → proceed to aggregation
5. Aggregate results for PR summary:
   dev_aggregate(action='pr_ready', taskId='TASK-{id}')
6. Save team learnings to knowledge vault:
   dev_memory(action='save', text='...', tags='team,learnings')
   # Save key pitfalls, patterns, decisions discovered during team work
   # Available to next session via SessionStart injection
7. All done → shutdown teammates:
   SendMessage({ type: "shutdown_request", recipient: "{name}" })
8. TeamDelete()
9. Summary: report results + aggregated changes to user
```

## Teammate Prompt Template

Every teammate prompt must include **4 essential elements** (from Anthropic multi-agent research):

| Element | Purpose | Missing → |
|---------|---------|-----------|
| **Objective** | Clear goal statement | Agent drifts off-scope |
| **Output Format** | What to deliver | Results unusable |
| **Tool Guidance** | Available tools/skills | Agent picks wrong tools |
| **Task Boundaries** | What NOT to do | Agent modifies wrong files |

```
You are a developer working on {task_description}.

## Objective
{one sentence: clear, measurable goal}

## Context
- Working directory: {repo_path}
- Branch: {branch_name}
- Plan: {plan_path} (if applicable)

## Historical Knowledge (injected by lead)
{dev_memory query results — platform pitfalls + task-related patterns}
If this section is empty, query before starting:
  dev_memory(action:'query', query:'{module keywords}')

## Output Format
- Passing verification: {verify_command}
- Committed code via /dev commit
- Summary to lead: SendMessage with files changed + key decisions

## Steps
1. Read relevant context (CLAUDE.md, existing code)
   - If Historical Knowledge is empty: dev_memory(action:'query', query:'{module keywords}')
   - Note any pitfalls or patterns before starting
2. Implement the assigned module/feature
3. **Self-Review** (MANDATORY before reporting):
   - Completeness: All spec requirements? Edge cases? No silent skips?
   - Quality: Clear names? Maintainable? No temp hacks?
   - Discipline: YAGNI? Existing patterns? No over-abstraction?
   - Testing: Real behavior tests? Not just happy path?
   - If any item fails → fix before proceeding
4. Run verification: {verify_command}
5. If verify passes → /dev commit (includes automatic code review gate)
   - P0/P1 found → fix before retry
   - P2/P3 → proceed, note in summary
6. If reviewer teammate exists → SendMessage reviewer with commit hash + changed files
   - Wait for reviewer response before next major change
   - Reviewer P0/P1 → fix immediately
7. SendMessage to lead: done + summary + any review findings

## Task Boundaries
- Only modify files in: {directory_scope}
- Do NOT modify: {excluded_files_or_dirs}
- If scope needs expansion → SendMessage lead first

## Available Skills
- /implement-plan — Execute plan phases (supports TDD mode with "use tdd")
- /dev commit — Smart commit (includes review gate: P0/P1 blocks, P2/P3 warns)
- /dev review — Standalone code review (use before commit for large changes)
- /self-check — Pre-commit quality check
- /deslop — Remove AI slop

## Available Agents (use as needed)
- Task(subagent_type="dev-flow:code-reviewer") — Code review
- Task(subagent_type="dev-flow:debug-agent") — Debug issues
- Task(subagent_type="codebase-pattern-finder") — Find existing patterns
- Task(subagent_type="research:research-agent") — External docs/API lookup

## Available MCP Tools
- dev_memory(action:'query', query:'...') — Search historical pitfalls and patterns
- dev_handoff(action:'write', handoff={...}) — Write completion handoff for lead aggregation

## Thinking Rules
- Before implementing, briefly consider alternatives (Why this approach?)
- If you find a better approach, propose it before proceeding (What if?)
- After completing, note any implications or follow-up needs (So what?)

## Rules
- Uncertain → SendMessage lead, don't decide alone
- Verify fails → keep fixing, don't report done
- Review P0/P1 → fix before commit, don't skip
- Follow existing code style in the repo
```

## Reviewer Prompt Template

See `references/reviewer-template.md` for the full reviewer teammate prompt (spec + quality review, cross-module focus, report format).

## Error Handling

| Situation | Action |
|-----------|--------|
| Teammate verify fails | Teammate retries; if stuck, reports to lead |
| File conflict detected | Serialize conflicting tasks via addBlockedBy |
| Teammate blocked | Lead provides guidance via SendMessage |
| Task scope unclear | Teammate asks lead before proceeding |
| Skill not available | Fallback to manual commands |
| Team member crashes | Spawn replacement, assign same task |
| Need to resume agent | `Task(resume="<agentId>", prompt="Continue...")` |

## Usage Examples

> **New to agent teams?** Start with a code review task (not implementation) to learn coordination patterns before letting multiple agents write code simultaneously.

### Single Repo, Multiple Modules

```
/agent-team
Implement auth system:
- Module A: JWT service (src/auth/)
- Module B: OAuth providers (src/oauth/)
- Module C: Middleware (src/middleware/)
```

### Multi-File Refactor

```
/agent-team
Refactor logging:
- Agent 1: Replace console.log → structured logger (src/services/)
- Agent 2: Replace console.log → structured logger (src/controllers/)
- Agent 3: Add log config + tests
```

### Test + Implementation Split

```
/agent-team
Feature: user profiles
- impl-dev: Implement user profile (src/profiles/)
- test-dev: Write integration tests (tests/profiles/)
```

### With Dedicated Reviewer (Cross-Module)

```
/agent-team
Implement API with auth + CORS + SSE:
- auth-dev: Auth guards and JWT (src/auth/)
- api-dev: REST controllers and SSE endpoints (src/api/)
- config-dev: CORS, env config, middleware (src/config/)
- reviewer: Review all commits, focus on auth+cors+sse interactions
```

## Collaboration Modes

Choose the mode that fits your task. See `references/team-patterns.md` for details.

| Mode | When to Use | Parallelism |
|------|-------------|-------------|
| **Fan-out** | Independent modules, no shared files | Full parallel |
| **Fan-out + Reviewer** | 3+ agents or security-sensitive | Full parallel + 1 reviewer |
| **Pipeline** | Sequential phases (plan → impl → test) | Serial |
| **Master-Worker** | Batch of similar tasks | N workers |
| **Review-Chain** | Code needs review before merge | 2 agents |
| **Evaluator-Optimizer** | Iterative refinement with feedback cycles | 2 agents |

## Advanced Management

For team scaling, thinking culture, autonomy levels, and multi-session continuity, see `references/management-guide.md`.

## Handoff Integration

For tasks spanning multiple sessions or needing PR aggregation:

```
# Each teammate writes handoff on completion
dev_handoff(action='write', handoff={
  agent_id: '{agent-name}',
  task_id: 'TASK-{id}',
  status: 'success',
  summary: '{what was done}',
  changes_made: ['{files}'],
  for_next_agent: '{what comes next}'
})

# Lead aggregates for PR
dev_aggregate(action='pr_ready', taskId='TASK-{id}')
```
