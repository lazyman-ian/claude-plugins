---
name: spec-generator
description: >-
  Generates structured implementation specs from task descriptions or requirements documents.
  Classifies as Feature/Bug, fills appropriate template, and saves to thoughts/shared/specs/.
  This skill should be used when the user wants to generate a spec, create implementation requirements, or document task details.
  Triggers on "generate spec", "create spec", "write spec",
  "生成规格", "创建规格", "写规格", "需求文档", "实现规格", "任务规格".
  Do NOT use for implementation plans (use create-plan skill instead).
  Do NOT use for brainstorming (use brainstorm skill instead).
allowed-tools: [Read, Write, Glob, Grep, Bash]
model: sonnet
memory: project
---

# Spec Generator

Generate structured implementation specs from task descriptions or requirements documents.

## When to Use

- `/spec` — provide description directly
- "Write a spec for the login redesign"
- "Generate spec: fix crash on iOS 17"
- "Create spec from this requirements doc"

**Note**: Specs feed into `/dev create-plan`. After spec-validator approves, plan is created automatically.

## Workflow

### Step 1: Gather Input

Ask user for task title + description if not already provided.

### Step 2: Classify Type

| Signal | Type |
|--------|------|
| Description contains "crash", "broken", "regression", "fix" | bug |
| Description contains "add", "new", "implement", "redesign" | feature |
| Type field = Feature/Improvement/Tech Debt | feature |
| Type field = Bug | bug |

### Step 3: Load Template

```
Read references/spec-template-{type}.md
```

Where `{type}` is `feature` or `bug`.

### Step 4: Fill Template

Apply AI analysis to fill all sections:
- Problem Statement: from user input or requirements
- Acceptance Criteria: derive from requirements (make them testable)
- Technical Approach: identify key files via `Glob` + `Grep`
- Out of Scope: infer boundaries from task scope

### Step 5: Query Memory

```
dev_memory(action="query", query="{feature-area} patterns pitfalls")
```

Incorporate relevant pitfalls into Open Questions or Technical Approach.

### Step 6: Save Spec

```
Write thoughts/shared/specs/SPEC-{id}.md
```

Where `{id}` is a short slug from the title (e.g., `login-redesign`).

### Step 7: Auto-Validate and Chain

Spawn spec-validator agent on the saved spec:

```
Task(spec-validator, spec_path="thoughts/shared/specs/SPEC-{id}.md")
```

**If spec-validator returns VALIDATED**:
- Auto-invoke `/dev create-plan thoughts/shared/specs/SPEC-{id}.md`

**If spec-validator returns NEEDS_HUMAN**:
- Output the spec content
- Output the escalation reason from spec-validator
- Stop and wait for human to review and confirm

## Spec Quality Checklist

Before passing to spec-validator, verify:

- [ ] Problem clearly stated (1-3 sentences, no implementation detail)?
- [ ] Acceptance criteria are testable (not vague like "works correctly")?
- [ ] Technical approach identifies key files with change type?
- [ ] Out of Scope explicitly lists related-but-excluded items?
- [ ] Open Questions flags unresolved blockers before implementation?

## References

| Reference | Load When |
|-----------|-----------|
| `references/spec-template-feature.md` | Type = feature/improvement/tech-debt |
| `references/spec-template-bug.md` | Type = bug |
