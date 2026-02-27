# utils-plugin

Utility tools for code quality, search, and safety hooks.

## Quick Reference

| Action | Command |
|--------|---------|
| Install | `claude plugins add utils@lazyman-ian` |

## Structure

- `skills/` - 2 skills (deslop, search-code)
- `commands/` - 2 commands (deslop, search)
- `hooks/` - 4 hooks (alias-conflict-detector, context-warning, loop-detection, tool-enforcer)

## Skills

| Skill | Purpose |
|-------|---------|
| deslop | Remove AI-generated code slop from current branch |
| search-code | Unified code search for files, content, symbols, patterns |

## Hooks

| Hook | Type | Purpose |
|------|------|---------|
| alias-conflict-detector | PreToolUse(Bash) | Detect shell alias conflicts (zoxide, sd, xh) |
| context-warning | PostToolUse | Warn when context budget is high |
| loop-detection | PostToolUse | Detect tool call loops (same tool 8+ times) |
| tool-enforcer | PreToolUse(Bash) | Enforce dedicated tools over Bash equivalents |

## Plugin Manifest Rules

Auto-discovered (don't declare in plugin.json):
- `agents/` directory
- `hooks/hooks.json`
