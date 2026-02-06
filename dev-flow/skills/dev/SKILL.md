---
name: dev
description: Provides development workflow hub for git operations, commits, PRs, and releases. This skill should be used when user says "commit", "push", "create PR", "release", "git status", "check status", "提交代码", "推送", "创建PR", "发布版本", "查看状态". Triggers on /dev, /commit, /pr, /release, 代码提交, 版本发布, git操作.
model: sonnet
memory: project
allowed-tools: [Bash, Read, Glob, Grep, Edit, Write, mcp__plugin_dev-flow_dev-flow__*]
---

# dev - Unified Development Flow

Cross-platform development workflow powered by dev-flow MCP.

## When to Use

Use `/dev-flow:` commands for all Git workflow operations:

| Command | Purpose |
|---------|---------|
| `/dev-flow:dev` | Check status + next step |
| `/dev-flow:start` | Start new task (branch + ledger) |
| `/dev-flow:commit` | Create commit with reasoning |
| `/dev-flow:pr` | Create pull request |
| `/dev-flow:release` | Create release tag |
| `/dev-flow:ledger` | Manage continuity ledgers |
| `/dev-flow:tasks` | Sync ledger with Task Management |
| `/dev-flow:recall` | Search historical decisions |
| `/dev-flow:cleanup` | Clean merged branches |
| `/dev-flow:switch` | Smart branch switching |

## Core Principles

1. **Platform Agnostic**: Use `dev_config` for platform-specific commands
2. **Token Optimized**: Prefer lightweight tools (`dev_status` ~30 tokens)
3. **Continuity First**: Auto-track progress via ledgers and reasoning

## MCP Tools

| Tool | Tokens | Purpose |
|------|--------|---------|
| `dev_status` | ~30 | Quick status check |
| `dev_flow` | ~100 | Detailed status |
| `dev_check` | ~10 | CI-ready check |
| `dev_config` | ~50 | Platform commands |
| `dev_defaults` | ~20 | Smart defaults |

Full tool reference: `references/mcp-tools.md`

## Workflow Phases

```
IDLE → DEVELOPING → READY_TO_PUSH → WAITING_QA → PR_OPEN → READY_TO_RELEASE
```

| Phase | Action |
|-------|--------|
| IDLE | `/dev-flow:start TASK-XXX` |
| DEVELOPING | `make fix` → `/dev-flow:commit` |
| READY_TO_PUSH | `git push` |
| WAITING_QA | `/dev-flow:pr` |
| PR_OPEN | Wait for merge |
| READY_TO_RELEASE | `/dev-flow:release` |

## Commit Guidelines

- **Format**: `type(scope): subject`
- **Types**: feat, fix, refactor, perf, chore, docs, test, ci
- **Scope**: Auto-inferred via `dev_defaults(action="scope")`
- **No Claude Attribution**: Commits show as user-created

## Ledger Integration

```
/dev-flow:start → Creates ledger
/dev-flow:commit → Updates ledger + generates reasoning
/dev-flow:pr → Records PR URL
/dev-flow:tasks export → Sync to Task Management
/dev-flow:ledger archive → Archives completed task
```

## Quick Reference

```bash
# Check status
/dev-flow:dev

# Start new task
/dev-flow:start TASK-123 "Add feature"

# Commit changes
make fix && /dev-flow:commit

# Create PR
/dev-flow:pr

# Sync tasks (for complex multi-phase work)
/dev-flow:tasks export

# Search past decisions
/dev-flow:recall "authentication"

# Clean up
/dev-flow:cleanup
/dev-flow:ledger archive
```
