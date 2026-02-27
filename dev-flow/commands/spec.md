---
description: Generate implementation spec from Notion task using spec-generator skill
---

# /dev-flow:spec - Spec Generator

Convert a Notion task into a structured implementation specification.

## Usage

```
/dev-flow:spec {notion_page_id}     # Generate spec from Notion page
/dev-flow:spec --from-clipboard     # Generate from clipboard content
/dev-flow:spec --interactive        # Interactive spec creation (no Notion)
```

## Workflow

1. Fetch task details from Notion via `notion-fetch` MCP tool
2. Classify task type: Feature / Bug (from `Type` field)
3. Load matching template from `spec-generator/references/`:
   - Feature → `spec-template-feature.md`
   - Bug → `spec-template-bug.md`
4. Fill template with Notion data + AI analysis
5. Save to `thoughts/shared/specs/SPEC-{id}.md`
6. Human Gate: Display spec and ask user to confirm or request edits
7. On confirmation → auto-run `/dev create-plan` with spec as input

## Spec Lifecycle

```
Notion Task → /dev inbox → /dev spec → SPEC.md → User Confirm → /dev create-plan → Plan → /dev implement-plan
```

## Prerequisites

- Notion MCP server configured
- `.dev-flow.json` has `notion.database_id`
- `thoughts/shared/specs/` directory exists (created by `/dev-flow:init`)

## Output

Spec saved to `thoughts/shared/specs/SPEC-{id}.md` containing:
- All template sections filled from Notion data
- Open questions highlighted for user review before implementation
- Suggested complexity estimate (S / M / L) for plan scoping
