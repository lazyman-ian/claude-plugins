---
name: create-plan
description: Creates detailed implementation plans through interactive research and design exploration. This skill should be used when user says "create plan", "make a plan", "design architecture", "plan feature", "制定计划", "设计方案", "规划功能", "架构设计", or when exploring design options with "brainstorm", "explore options", "设计讨论", "细化方案". Triggers on /create_plan, 实现计划, 功能规划, 技术方案, 设计探索.
model: opus
memory: project
allowed-tools: [Read, Glob, Grep, WebSearch, Task, TaskCreate, TaskUpdate]
---

# Implementation Plan

Create detailed implementation plans through interactive, iterative research and design exploration.

## When to Use

- Planning new features
- Designing architecture
- Preparing implementation strategy
- Exploring design options and alternatives
- `/create_plan [ticket-file]`

## Two Modes

### Mode 1: Design Exploration (Brainstorming)

**Triggers**: "brainstorm", "explore options", "设计讨论", "细化方案", "compare approaches"

**When to use**:
- Requirements are unclear or vague
- Multiple implementation approaches possible
- Need to identify hidden constraints
- Want to evaluate trade-offs

**Process**:
```
EXPLORE → GENERATE ALTERNATIVES → EVALUATE → DECIDE → PLAN
```

1. **Explore**: Use Socratic questioning to uncover requirements
2. **Generate**: Create 2-4 viable implementation approaches
3. **Evaluate**: Compare pros/cons, constraints, risks
4. **Decide**: Get user buy-in on approach
5. **Plan**: Create detailed implementation plan

### Mode 2: Implementation Planning (Standard)

**Triggers**: "create plan", "make a plan", "制定计划", "设计方案"

**When to use**:
- Requirements are clear
- Implementation approach decided
- Need detailed technical plan

**Process**:
```
CONTEXT GATHER → RESEARCH → STRUCTURE → WRITE PLAN → REVIEW
```

## Initial Response

**Detect mode from user input:**

| User Says | Mode | Response |
|-----------|------|----------|
| "brainstorm", "explore", "设计讨论" | Design Exploration | "I'll help explore design options. Let's start by understanding the problem space..." |
| "create plan", "制定计划" | Implementation Planning | "I'll help create a detailed implementation plan..." |

**If parameters provided**: Skip greeting, read files, begin research.

**If no parameters (Design Exploration mode)**:
```
I'll help explore design options and create a plan.

Let's start with some questions to clarify the requirements:
1. What problem are we solving?
2. Who are the users/stakeholders?
3. What constraints do we have (time, tech, resources)?
4. What does success look like?

Or provide a ticket file: /create_plan thoughts/tickets/eng_1234.md
```

**If no parameters (Implementation Planning mode)**:
```
I'll help create a detailed implementation plan.

Please provide:
1. Task/ticket description (or ticket file reference)
2. Relevant context, constraints, requirements
3. Links to related research or implementations

Tip: /create_plan thoughts/tickets/eng_1234.md
```

## Process Overview

### Design Exploration Mode

```
CLARIFY → EXPLORE → GENERATE → EVALUATE → DECIDE → PLAN
```

1. **Clarify**: Socratic questioning to uncover requirements
2. **Explore**: Research existing solutions, patterns
3. **Generate**: Create 2-4 viable approaches
4. **Evaluate**: Compare trade-offs, constraints, risks
5. **Decide**: Get user buy-in on approach
6. **Plan**: Create detailed implementation plan

### Implementation Planning Mode

```
CONTEXT GATHER → RESEARCH → STRUCTURE → WRITE PLAN → REVIEW
```

1. **Context Gathering**: Read all files FULLY, spawn research agents
2. **Research**: Parallel sub-tasks, verify findings
3. **Structure**: Present outline, get buy-in
4. **Write**: Create plan in `thoughts/shared/plans/`
5. **Review**: Iterate until approved

## Design Exploration Techniques

### Socratic Questioning

Ask questions to uncover hidden requirements:

| Question Type | Examples |
|--------------|----------|
| **Purpose** | "What problem does this solve?" "Why is this needed?" |
| **Constraints** | "What are the hard constraints?" "What's non-negotiable?" |
| **Users** | "Who will use this?" "What are their pain points?" |
| **Success** | "How do we know this works?" "What does done look like?" |
| **Risks** | "What could go wrong?" "What are we assuming?" |

### Generating Alternatives

For each design decision, consider:

1. **Conservative**: Minimal change, proven approach
2. **Balanced**: Moderate change, good trade-offs
3. **Aggressive**: Significant change, high potential
4. **Hybrid**: Combine elements from above

### Evaluation Framework

| Criteria | Weight | Approach A | Approach B | Approach C |
|----------|--------|------------|------------|------------|
| Implementation effort | High | | | |
| Maintenance cost | High | | | |
| Performance | Medium | | | |
| Scalability | Medium | | | |
| Risk | High | | | |

## Reference Menu

| Reference | Load When |
|-----------|-----------|
| `references/process-steps.md` | Detailed step-by-step process |
| `references/plan-template.md` | Full plan template + success criteria |
| `references/guidelines.md` | Planning principles + sub-task patterns |

## Quick Reference

### Plan File Location
`thoughts/shared/plans/YYYY-MM-DD-ENG-XXXX-description.md`

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

## Core Principles

1. **Be Skeptical**: Question vague requirements, verify with code
2. **Be Interactive**: Get buy-in at each step
3. **Be Thorough**: Read files completely, include file:line refs
4. **No Open Questions**: Resolve all questions before finalizing

## Examples

### Design Exploration Example

```
User: "brainstorm authentication options for our API"

[Asks Socratic questions]
- What types of clients will use this API?
- What security requirements do we have?
- Do we need to support third-party integrations?

[Generates alternatives]
1. JWT with refresh tokens (balanced)
2. OAuth 2.0 with PKCE (aggressive)
3. API keys with IP whitelist (conservative)

[Evaluates trade-offs]
| Approach | Effort | Security | Flexibility |
|----------|--------|----------|-------------|
| JWT | Medium | High | High |
| OAuth | High | Very High | Very High |
| API Keys | Low | Medium | Low |

[Gets user decision]
User: "Let's go with JWT approach"

[Creates implementation plan]
```

### Implementation Planning Example

```
User: /create_plan thoughts/tickets/eng_1478.md

[Reads ticket fully]
[Spawns parallel research tasks]
[Presents informed understanding + questions]
[Iterates with user]
[Writes plan to thoughts/shared/plans/]
```
