---
name: create-plan
description: >-
  Creates detailed implementation plans with task breakdowns, dependency graphs, and verification
  criteria through interactive research. This skill should be used when the user has clear
  requirements and needs a concrete, step-by-step technical plan saved to thoughts/shared/plans/.
  Triggers on "create plan", "make a plan", "plan feature", "implementation plan", "technical plan",
  "write a plan", "制定计划", "设计方案", "规划功能", "技术方案", "写计划", "实现方案".
  Do NOT use for open-ended design exploration or brainstorming — use "brainstorm" instead.
model: opus
memory: project
allowed-tools: [Read, Glob, Grep, WebSearch, Task, TaskCreate, TaskUpdate]
---

# Implementation Plan

Create detailed implementation plans through interactive, iterative research.

## When to Use

- Planning new features
- Designing architecture
- Preparing implementation strategy
- `/create_plan [ticket-file]`

**Note**: For design exploration and brainstorming, use `/brainstorm` first.

## Mode

**Implementation Planning** - Create detailed technical plans from clear requirements.

**Process**:
```
CONTEXT GATHER → RESEARCH → STRUCTURE → WRITE PLAN → REVIEW
```

## Initial Response

**If parameters provided**: Skip greeting, read files, begin research.

**If no parameters**:
```
I'll help create a detailed implementation plan.

Please provide:
1. Task/ticket description (or ticket file reference)
2. Relevant context, constraints, requirements
3. Links to related research or implementations

Tip: /create_plan thoughts/tickets/eng_1234.md
```

**Note**: For brainstorming, use `/brainstorm` first.

## Process Overview

```
CONTEXT GATHER → RESEARCH → STRUCTURE → WRITE PLAN → REVIEW
```

1. **Context Gathering**: Read all files FULLY, spawn research agents
   - Query past patterns: `dev_memory(action="query", query="<feature-type> architecture")`
2. **Research**: Parallel sub-tasks, verify findings
3. **Structure**: Present outline, get buy-in
4. **Write**: Create plan in `thoughts/shared/plans/`
5. **Review**: Iterate until approved

### Task Granularity (v5.0.0)

When writing plan phases, evaluate whether to break them into fine-grained tasks:

| Phase Complexity | Action |
|-----------------|--------|
| Simple (≤2 files, straightforward) | Keep as phase-level description |
| Complex (6+ files OR complex logic) | Break into `tasks` array |

**Two task types:**

- **logic-task** (backend/tools/algorithms): 2-5 min, includes complete implementation code
- **ui-task** (frontend/mobile/design): 5-15 min, includes Figma reference + design constraints

See `references/plan-template.md` for task format details.

Phases with `tasks` → implement-plan uses 5-gate per-task pipeline.
Phases without `tasks` → implement-plan uses standard phase-level execution.


## Reference Menu

| Reference | Load When |
|-----------|-----------|
| `references/process-steps.md` | Detailed step-by-step process |
| `references/plan-template.md` | Full plan template + success criteria |
| `references/guidelines.md` | Planning principles + sub-task patterns |

## Quick Reference

### Plan File Location
`thoughts/shared/plans/YYYY-MM-DD-ENG-XXXX-description.md`

### Plan Frontmatter (v2.0)

Plans include YAML frontmatter with structured phase metadata (complexity, model, parallelizable, target_files, verify). This enables `implement-plan` to auto-create tasks, detect parallel conflicts, and select models. See `references/plan-template.md` for schema.

### Success Criteria Format
```markdown
#### Automated Verification:
- [ ] Tests pass: `make test`
- [ ] Linting passes: `make lint`

#### Manual Verification:
- [ ] Feature works in UI
- [ ] Performance acceptable
```

### Key Agents

| Agent | Purpose |
|-------|---------|
| codebase-locator | Find related files |
| codebase-analyzer | Understand implementation |
| thoughts-locator | Find existing research |
| research-agent | External documentation |

### Post-Plan Validation

After plan is written and approved, offer:

```
"Would you like me to validate tech choices with validate-agent?"
```

If accepted → spawn `validate-agent` → produces validation handoff via `dev_handoff(action='write')`. This checks library versions, API compatibility, and best practices before implementation begins.

## Core Principles

1. **Be Skeptical**: Question vague requirements, verify with code
2. **Be Interactive**: Get buy-in at each step
3. **Be Thorough**: Read files completely, include file:line refs
4. **No Open Questions**: Resolve all questions before finalizing

## Example

```
User: /create_plan thoughts/tickets/eng_1478.md

[Reads ticket fully]
[Spawns parallel research tasks]
[Presents informed understanding + questions]
[Iterates with user]
[Writes plan to thoughts/shared/plans/]
```
