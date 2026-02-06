# MCP Tools Reference

Complete reference for dev-flow MCP tools.

## Status Tools

### dev_status (~30 tokens)

Quick status check. Returns: `PHASE|✅0|next`

```
DEVELOPING|✅0|/dev commit
```

### dev_flow (~100 tokens)

Detailed status table with guidance.

```json
{ "verbose": true }  // Add guidance (+50 tokens)
```

### dev_check (~10 tokens)

CI-ready check. Returns: `✅` or `❌ + error count`

### dev_next (~15 tokens)

Suggested next command based on current phase.

## Git Tools

### dev_defaults (~20 tokens)

Infer values from code changes.

```json
{ "action": "scope" }      // Infer commit scope
{ "action": "labels" }     // Infer PR labels
{ "action": "reviewers" }  // Suggest reviewers
{ "action": "working-set" } // Current working files
{ "action": "all" }        // All defaults
```

### dev_commits (~100 tokens)

Get commits grouped by type for release notes.

```json
{
  "from": "v1.0.0",  // Start ref (default: previous tag)
  "to": "HEAD",       // End ref
  "format": "compact" // compact|json|full
}
```

### dev_changes (~50 tokens)

Analyze code changes and get build recommendation.

```json
{
  "base": "origin/master",
  "format": "compact"
}
```

## PR Tools

### dev_ready (~20 tokens)

Control PR build status.

```json
{ "action": "check" }  // View status
{ "action": "yes" }    // Make ready
{ "action": "draft" }  // Make draft
```

### dev_version (~30 tokens)

Get version info and next version suggestions.

```json
{ "format": "compact" }  // compact|json
```

## Continuity Tools

### dev_ledger (~50 tokens)

Manage continuity ledgers.

```json
{ "action": "status" }   // Current ledger status
{ "action": "list" }     // List all ledgers
{ "action": "create", "branch": "feat/xxx", "taskId": "TASK-001" }
{ "action": "update", "commitHash": "abc123", "commitMessage": "..." }
{ "action": "archive", "taskId": "TASK-001" }
{ "action": "search", "keyword": "auth" }
```

### dev_tasks (~30 tokens)

Sync ledger state with Task Management.

```json
{ "action": "summary" }  // Quick status
{ "action": "export" }   // JSON for TaskCreate
{ "action": "sync" }     // Update ledger from tasks
```

### dev_reasoning (~30 tokens)

Manage commit reasoning and decision history.

```json
{ "action": "generate", "commitHash": "...", "commitMessage": "..." }
{ "action": "recall", "keyword": "auth" }
{ "action": "aggregate", "baseBranch": "master" }
```

## Branch Tools

### dev_branch (~30 tokens)

Branch lifecycle management.

```json
{ "action": "cleanup", "dryRun": true }  // Clean merged branches
{ "action": "stale", "days": 30 }        // Find stale branches
{ "action": "switch", "target": "main" } // Smart switch with stash
{ "action": "prune" }                    // Prune remote refs
{ "action": "merged" }                   // List merged branches
```

## Configuration

### dev_config (~50 tokens)

Get platform-specific configuration.

Returns: `platform|fix:cmd|check:cmd|scopes:...|src:source`

Examples:
```
ios|fix:swiftlint --fix|check:swiftlint|scopes:...|src:auto
makefile|fix:make fix|check:make check|scopes:|src:Makefile
python|fix:black .|check:ruff .|scopes:api,models|src:custom
```

## Tool Selection Guide

| Need | Tool | Tokens |
|------|------|--------|
| Quick status | `dev_status` | ~30 |
| Detailed status | `dev_flow` | ~100 |
| CI check | `dev_check` | ~10 |
| Next action | `dev_next` | ~15 |
| Commit scope | `dev_defaults` | ~20 |
| Platform commands | `dev_config` | ~50 |
| PR status | `dev_ready` | ~20 |
| Release notes | `dev_commits` | ~100 |

## Error Handling

All tools return structured errors:

```json
{
  "error": true,
  "message": "Not in a git repository",
  "suggestion": "cd to project root"
}
```
