---
name: brainstorm
description: Explores design options and clarifies requirements through structured Socratic questioning before any creative work begins. This skill should be used when the user wants to brainstorm approaches, evaluate multiple implementation options, clarify vague requirements, or make technical decisions before committing to a plan. One question at a time, options over open-ended, YAGNI-strict. Triggers on "brainstorm", "explore options", "design discussion", "evaluate approaches", "compare options", "think through", "头脑风暴", "设计讨论", "细化方案", "探索方案", "对比方案". Do NOT use for creating concrete implementation plans — use "create-plan" instead.
model: opus
memory: project
allowed-tools: [Read, Glob, Grep, WebSearch, Task, AskUserQuestion, mcp__plugin_dev-flow_dev-flow__dev_memory, mcp__plugin_dev-flow_dev-flow__dev_handoff]
---

# Brainstorm — Design Exploration

Explore design options and clarify requirements through structured, disciplined brainstorming.

## When to Use

Use this skill **before** any creative work:

- Exploring feature requirements
- Designing components or architecture
- Evaluating multiple implementation approaches
- Clarifying vague requirements
- Making technical decisions
- "brainstorm", "explore options", "头脑风暴", "设计讨论"

## Process

```
CLARIFY → EXPLORE → GENERATE → EVALUATE → DECIDE → PERSIST
```

### 1. CLARIFY

Ask Socratic questions to understand the problem space. Query memory for similar patterns:

```
dev_memory(action="query", query="<feature-keyword> <platform>")
```

### 2. EXPLORE

Uncover constraints, users, success criteria, and risks.

### 3. GENERATE

Create 2-4 viable implementation approaches:
- **Conservative**: Minimal change, safe
- **Balanced**: Moderate complexity, good ROI
- **Aggressive**: Maximum flexibility, higher risk
- **Hybrid**: Combine aspects from above

### 4. EVALUATE

Compare approaches using evaluation framework.

### 5. DECIDE

Get user buy-in on chosen approach.

### 6. PERSIST

Save design decisions via handoff:

```
dev_handoff(action='write', handoff={
  agent_id: 'brainstorm',
  task_id: '<task-id>',
  status: 'success',
  decisions: { 'key': 'rationale' },
  for_next_agent: 'Create implementation plan'
})
```

## Discipline Rules

These rules prevent common anti-patterns:

| Rule | Why |
|------|-----|
| **1. One question at a time** | Never dump 5 questions — user gets overwhelmed |
| **2. Multiple choice preferred** | Give 2-4 options via AskUserQuestion instead of open-ended |
| **3. 200-300 word segments** | Present design in chunks, verify after each |
| **4. YAGNI strict** | Every option must pass "Do we really need this?" |
| **5. Persist decisions** | Use dev_handoff to save — don't discard |

## Socratic Questioning

| Dimension | Questions |
|-----------|-----------|
| **Purpose** | What problem are we solving? Who benefits? |
| **Constraints** | Time? Tech stack? Dependencies? |
| **Users** | Who will use this? What do they expect? |
| **Success** | What does "done" look like? How do we measure? |
| **Risks** | What can go wrong? What's the fallback? |

## Generating Alternatives

For each approach, define:
- **Core idea**: One sentence summary
- **Pros**: 2-3 key benefits
- **Cons**: 2-3 key drawbacks
- **Complexity**: Low/Medium/High
- **Risk**: Low/Medium/High

Present as table for comparison.

## Evaluation Framework

| Criteria | Weight | Conservative | Balanced | Aggressive |
|----------|--------|--------------|----------|------------|
| Complexity | 30% | Low | Medium | High |
| Risk | 25% | Low | Medium | High |
| Flexibility | 20% | Low | Medium | High |
| Time to deliver | 15% | Fast | Medium | Slow |
| Maintainability | 10% | High | Medium | Low |

Adapt criteria based on project needs.

## Transition to Plan

After decisions are made:

```
Design decisions recorded via handoff-<date>.md.

Ready to create implementation plan? Run:
/create-plan (references handoff automatically)
```

## Reference Menu

| Reference | Load When |
|-----------|-----------|
| `references/brainstorm-guide.md` | Detailed examples, anti-patterns, handoff format |

## Example Flow

```
User: "brainstorm chat feature architecture"

Agent: Let me query memory for similar patterns...
[Query memory]

To clarify the requirements, which statement best describes your goal?
A) Simple text chat only (MVP, 1-2 weeks)
B) Text + file sharing (Balanced, 3-4 weeks)
C) Full multimedia chat with history (Complex, 6+ weeks)

User: A

Agent: [Generate 2-3 approaches for simple text chat]
[Present comparison table]
Which approach aligns with your constraints?

User: Approach 2

Agent: [Record decision via dev_handoff]
Design decisions saved. Ready for /create-plan?
```

---

**Anti-patterns to avoid:**
- Asking 5 questions at once
- Open-ended "What do you think?" without options
- Writing 1000-word essays per section
- Including features without YAGNI justification
- Forgetting to persist decisions via handoff
