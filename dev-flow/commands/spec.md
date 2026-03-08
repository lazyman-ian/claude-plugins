---
description: Notion adapter that extracts page content and delegates to spec-generator skill
---

# /dev-flow:spec - Notion → Spec Adapter

Extracts plain text from a Notion task and passes it to the `spec-generator` skill for processing.

## Usage

```
/dev-flow:spec {notion_page_id}     # Extract from Notion page → spec-generator
/dev-flow:spec --from-clipboard     # Use clipboard content → spec-generator
/dev-flow:spec --interactive        # Interactive input → spec-generator
```

## Workflow

### Mode: Notion page ID (default)

1. Call Notion MCP to fetch the page (title, properties, body blocks)
2. Convert page content to plain text (strip Notion block structure)
3. Pass plain text to `spec-generator` skill — all spec processing, validation, saving, human gate, and `/dev create-plan` chaining happen there

### Mode: --from-clipboard

1. Read clipboard content as plain text
2. Pass plain text to `spec-generator` skill

### Mode: --interactive

1. Prompt user for task description interactively
2. Pass collected text to `spec-generator` skill

## Spec Lifecycle

```
Notion Task → /dev inbox → /dev spec (extract) → spec-generator (process) → SPEC.md → User Confirm → /dev create-plan → Plan → /dev implement-plan
```

## Notion Extraction

Fields extracted from Notion page and merged into plain text:
- Page title
- `Type` property (Feature / Bug)
- `Status`, `Priority`, `Assignee` properties (if present)
- Full page body (paragraphs, bullets, headings, callouts)

The result is a single plain-text string handed off to `spec-generator`.

## Prerequisites

- Notion MCP server configured (for Notion page ID mode)
- `.dev-flow.json` has `notion.database_id`
- `spec-generator` skill installed
