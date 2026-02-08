---
name: agent-team
description: Orchestrates Agent Teams for parallel development on any project. Handles team lifecycle, task graphs, model selection (opus for planning, sonnet for coding), and teammate coordination. This skill should be used when user says "agent team", "team up", "parallel agents", "organize team", "组队开发", "并行开发", "多agent协作", "团队协作". Triggers on /agent-team, 组建团队, 并行任务.
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

| Phase | Model | Reasoning | Cost Impact |
|-------|-------|-----------|-------------|
| **Planning** | `opus` | Architecture, module decomposition, dependency analysis | Higher cost, deeper reasoning |
| **Implementation** | `sonnet` (default) | Code generation, balanced quality | Medium cost |
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
```

### Phase 3: Execute (Team, use **sonnet**)

Spawn teammates, monitor progress, handle errors.

**Delegate Mode**: For 3+ teammates, press `Shift+Tab` to restrict lead to coordination-only (spawn, message, shutdown, task management). Prevents lead from implementing tasks meant for teammates.

**Plan Approval**: For risky or complex tasks, require teammate to plan before implementing:
```
Spawn {module}-dev and require plan approval before making changes.
Only approve plans that include verification steps.
```
The teammate stays in read-only plan mode until lead approves. Reject with feedback to iterate.

```
# Spawn per task (parallel for independent tasks)
Task({
  subagent_type: "general-purpose",
  team_name: "TASK-{id}",
  name: "{module}-dev",
  # model: sonnet (default)
  prompt: <<PROMPT
{See Teammate Prompt Template below}
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

Verify results, aggregate, shutdown teammates, clean up.

```
1. Spawn dedicated opus reviewer for quality-critical projects:
   Task({ subagent_type: "dev-flow:code-reviewer", name: "reviewer", model: "opus", ... })
   See references/management-guide.md § Dedicated Reviewer
2. Review: check each task completed, verify results
3. Issues found → SendMessage teammate to fix
4. Aggregate results for PR summary:
   dev_aggregate(action='pr_ready', taskId='TASK-{id}')
5. All done → shutdown teammates:
   SendMessage({ type: "shutdown_request", recipient: "{name}" })
6. TeamDelete()
7. Summary: report results + aggregated changes to user
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

## Output Format
- Passing verification: {verify_command}
- Committed code via /dev commit
- Summary to lead: SendMessage with files changed + key decisions

## Steps
1. Read relevant context (CLAUDE.md, existing code)
2. Implement the assigned module/feature
3. Run verification: {verify_command}
4. If verify passes → /dev commit
5. SendMessage to lead: done + summary

## Task Boundaries
- Only modify files in: {directory_scope}
- Do NOT modify: {excluded_files_or_dirs}
- If scope needs expansion → SendMessage lead first

## Available Skills
- /implement-plan — Execute plan phases (supports TDD mode with "use tdd")
- /dev commit — Smart commit
- /self-check — Pre-commit quality check
- /deslop — Remove AI slop

## Available Agents (use as needed)
- Task(subagent_type="dev-flow:code-reviewer") — Code review
- Task(subagent_type="dev-flow:debug-agent") — Debug issues
- Task(subagent_type="codebase-pattern-finder") — Find existing patterns
- Task(subagent_type="research:research-agent") — External docs/API lookup

## Thinking Rules
- Before implementing, briefly consider alternatives (Why this approach?)
- If you find a better approach, propose it before proceeding (What if?)
- After completing, note any implications or follow-up needs (So what?)

## Rules
- Uncertain → SendMessage lead, don't decide alone
- Verify fails → keep fixing, don't report done
- Follow existing code style in the repo
```

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

## Collaboration Modes

Choose the mode that fits your task. See `references/team-patterns.md` for details.

| Mode | When to Use | Parallelism |
|------|-------------|-------------|
| **Fan-out** | Independent modules, no shared files | Full parallel |
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
