---
description: Fetch and triage Notion tasks into local development pipeline
---

# /dev-flow:inbox - Task Inbox

Fetch tasks from Notion board, display summary, and optionally generate specs.

## Usage

```
/dev-flow:inbox              # Show all Ready tasks
/dev-flow:inbox --priority P0  # Filter by priority
/dev-flow:inbox --platform ios # Filter by platform
/dev-flow:inbox --sprint current # Filter by current sprint
```

## Workflow

1. Read `.dev-flow.json` for Notion config (`notion.database_id`, field names)
2. Query Notion database via MCP (`notion-query-data-sources` or `notion-search`)
3. Filter by Status = "Ready" (or user-specified filter)
4. Display task table sorted by priority:

```
#  Title                        Priority    Platform  Type        Spec
─  ───────────────────────────  ──────────  ────────  ──────────  ────────
1  Add dark mode toggle          P1-High     iOS       Feature     No Spec
2  Fix login crash on iPad        P0-Critical iOS      Bug         No Spec
3  Update payment flow           P2-Medium   All       Improvement Draft
```

5. User selects task(s) → auto-run `/dev spec {notion_page_id}`

## Prerequisites

- Notion MCP server configured in Claude Code
- `.dev-flow.json` has `notion.database_id` set
- Notion integration has read access to the database

## Output

Table of tasks sorted by priority, with Spec Status indicator. Selection
prompts `/dev spec` for the chosen task.
