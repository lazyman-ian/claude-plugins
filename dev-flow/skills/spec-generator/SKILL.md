---
name: spec-generator
description: >-
  Generates structured implementation specs from Notion tasks or user descriptions.
  Classifies as Feature/Bug, fills appropriate template, and saves to thoughts/shared/specs/.
  Triggers on "generate spec", "create spec", "write spec", "spec from notion",
  "生成规格", "创建规格", "写规格".
  Do NOT use for implementation plans (use create-plan skill instead).
  Do NOT use for brainstorming (use brainstorm skill instead).
allowed-tools: [Read, Write, Glob, Grep, Bash]
model: sonnet
memory: project
---

# Spec Generator

Generate structured implementation specs from Notion tasks or plain descriptions.

## When to Use

- `/spec [notion-page-id]` — generate spec from a Notion task
- `/spec` — interactive mode, provide description directly
- "Write a spec for the login redesign"
- "Generate spec from Notion page abc123"
- "Create spec: fix crash on iOS 17"

**Note**: Specs feed into `/dev create-plan`. After approval, suggest next step.

## Modes

### From Notion

Fetch page → extract fields → classify type → fill template → save spec.

Requires `notion.database_id` in `.dev-flow.json` (see `references/notion-schema.md`).

### From Description

Interactive: ask clarifying questions → classify type → fill template → save spec.

## Workflow

### Step 1: Determine Source

- If page ID provided → Notion mode
- Otherwise → description mode (ask user for task title + description)

### Step 2: Fetch (Notion mode only)

```
mcp__notion__notion-fetch(page_id)
```

Extract: title, description, type, priority, platform, URL.

### Step 3: Classify Type

| Signal | Type |
|--------|------|
| Notion `Type` field = Feature/Improvement/Tech Debt | feature |
| Notion `Type` field = Bug | bug |
| Description contains "crash", "broken", "regression", "fix" | bug |
| Description contains "add", "new", "implement", "redesign" | feature |

### Step 4: Load Template

```
Read references/spec-template-{type}.md
```

Where `{type}` is `feature` or `bug`.

### Step 5: Fill Template

Apply AI analysis to fill all sections:
- Problem Statement: from Notion description or user input
- Acceptance Criteria: derive from requirements (make them testable)
- Technical Approach: identify key files via `Glob` + `Grep`
- Out of Scope: infer boundaries from task scope

### Step 6: Query Memory

```
dev_memory(action="query", query="{feature-area} patterns pitfalls")
```

Incorporate relevant pitfalls into Open Questions or Technical Approach.

### Step 7: Save Spec

```
Write thoughts/shared/specs/SPEC-{id}.md
```

Where `{id}` is the Notion task ID or a short slug from the title (e.g., `login-redesign`).

### Step 8: Human Gate

Present spec to user. Ask:
- "Does this spec look correct?"
- "Any missing acceptance criteria or out-of-scope items?"

Iterate until approved.

### Step 9: Suggest Next Step

On approval:
```
Spec saved to thoughts/shared/specs/SPEC-{id}.md

Next: /dev create-plan thoughts/shared/specs/SPEC-{id}.md
```

## Spec Quality Checklist

Before presenting to user, verify:

- [ ] Problem clearly stated (1-3 sentences, no implementation detail)?
- [ ] Acceptance criteria are testable (not vague like "works correctly")?
- [ ] Technical approach identifies key files with change type?
- [ ] Out of Scope explicitly lists related-but-excluded items?
- [ ] Open Questions flags unresolved blockers before implementation?

## References

| Reference | Load When |
|-----------|-----------|
| `references/notion-schema.md` | Notion fetch + `.dev-flow.json` config needed |
| `references/spec-template-feature.md` | Type = feature/improvement/tech-debt |
| `references/spec-template-bug.md` | Type = bug |
