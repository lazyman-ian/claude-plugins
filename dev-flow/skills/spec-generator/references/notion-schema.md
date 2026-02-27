# Notion Database Schema

Generic schema for a task/ticket board used by the spec-generator skill.

## Recommended Properties

| Property | Type | Values |
|----------|------|--------|
| Title | title | Task name |
| Status | select | Backlog, Ready, In Progress, In Review, Done |
| Priority | select | P0-Critical, P1-High, P2-Medium, P3-Low |
| Type | select | Feature, Bug, Improvement, Tech Debt |
| Platform | multi_select | iOS, Android, Web, Backend, All |
| Sprint | relation or select | Sprint identifier |
| Assignee | people | Team member |
| Due Date | date | Target completion |
| Spec Status | select | No Spec, Draft, Approved |
| PR Link | url | Pull request URL |

## .dev-flow.json Configuration

```json
{
  "notion": {
    "database_id": "YOUR_DATABASE_ID",
    "status_field": "Status",
    "priority_field": "Priority",
    "type_field": "Type",
    "platform_field": "Platform",
    "spec_status_field": "Spec Status"
  }
}
```

Find `database_id` in the Notion URL: `notion.so/{workspace}/{DATABASE_ID}?v=...`

## Field Mapping Conventions

### Status → Dev Phase

| Notion Status | Dev Phase | Action |
|---------------|-----------|--------|
| Backlog | Not started | Skip in `/dev inbox` |
| Ready | Queued | Show in `/dev inbox` |
| In Progress | Developing | Active task |
| In Review | PR open | Awaiting review |
| Done | Complete | Skip in `/dev inbox` |

### Priority → P-Level

| Notion Priority | Internal | Urgency |
|----------------|----------|---------|
| P0-Critical | P0 | Immediate, blocks release |
| P1-High | P1 | Current sprint |
| P2-Medium | P2 | Backlog priority |
| P3-Low | P3 | Nice to have |

### Type → Spec Template

| Notion Type | Template Used |
|-------------|---------------|
| Feature | spec-template-feature.md |
| Bug | spec-template-bug.md |
| Improvement | spec-template-feature.md |
| Tech Debt | spec-template-feature.md |

## Minimal Schema

If your database uses different field names, override via `.dev-flow.json`. Only `database_id` is required; all field names have defaults matching the table above.

## Notes

- Multi-select Platform values are combined for cross-platform tasks (e.g., iOS + Android)
- Spec Status is updated automatically by `/dev spec` after saving SPEC file
- Sprint field is optional; `/dev inbox` ignores it unless `--sprint` flag is used
