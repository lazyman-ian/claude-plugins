---
name: config-optimize
description: Checks Claude Code releases and optimizes Claude Code configuration for new features. This skill should be used when user explicitly says "/config-optimize", "check claude updates", "optimize claude settings", "claude new features", "Claude配置优化", "检查Claude更新", "Claude新功能". NOT for general "optimize" requests, documentation reading, or when user references files with "optimization" in the name.
model: haiku
memory: user
allowed-tools: [Read, Glob, Grep, Write, Edit, Bash, WebFetch, TaskCreate, TaskUpdate]
---

# config-optimize

Automatically check Claude Code releases and optimize configuration.

## When to Use

- After Claude Code updates
- Periodically (weekly recommended)
- When prompted by session reminder
- Manual: `/config-optimize`

## Commands

| Command | Purpose |
|---------|---------|
| `/config-optimize` | Full optimization workflow |
| `/config-optimize check` | Check only (no changes) |
| `/config-optimize apply` | Apply pending proposals |

## Early Exit Check (FIRST STEP)

Before fetching releases, check if already current:

```bash
# 1. Get current version
CURRENT=$(claude --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)

# 2. Get last checked version
LAST_CHECKED=$(cat ~/.claude/config-optimize-state.json 2>/dev/null | jq -r '.last_checked_version // "0.0.0"')
LAST_DATE=$(cat ~/.claude/config-optimize-state.json 2>/dev/null | jq -r '.last_check_date // "1970-01-01"')

# 3. Calculate days since last check
DAYS_AGO=$(( ($(date +%s) - $(date -d "$LAST_DATE" +%s 2>/dev/null || echo 0)) / 86400 ))
```

**If `CURRENT == LAST_CHECKED` AND `DAYS_AGO < 7`:**
- Output: "Config is current (v{CURRENT}, last checked {LAST_DATE}). No optimization needed."
- **EXIT EARLY** (no WebFetch required)
- Skip to Completion section

## Workflow

```
VERSION CHECK → CONFIG ANALYSIS → GAP ANALYSIS → PROPOSALS → APPLY
```

1. **Version Check**: Compare current vs last checked version
2. **Config Analysis**: Scan settings, hooks, rules, skills
3. **Gap Analysis**: Identify unused features, deprecated patterns
4. **Proposals**: Generate optimization recommendations
5. **Apply**: Apply selected changes (requires approval)

## Reference Menu

| Reference | Load When |
|-----------|-----------|
| `references/version-history.md` | Generating proposals for specific versions |
| `references/config-areas.md` | Analyzing hooks, skills, rules, env |
| `references/workflow-details.md` | Understanding full workflow details |
| `references/sources.md` | Finding official documentation sources |

## Documentation Sources

| Source | URL | Use For |
|--------|-----|---------|
| GitHub Releases | github.com/anthropics/claude-code/releases | New features |
| Official Blog | claude.ai/blog | Best practices |
| Documentation | docs.anthropic.com/en/docs/claude-code | Reference |

## Quick Check

```bash
# 1. Current version
claude --version

# 2. Last checked
cat ~/.claude/config-optimize-state.json

# 3. Fetch release notes
WebFetch("https://github.com/anthropics/claude-code/releases")
```

## State File

`~/.claude/config-optimize-state.json`:
```json
{
  "last_checked_version": "2.1.3",
  "last_check_date": "2026-01-11",
  "applied_optimizations": ["agent_type_check", "force_autoupdate"]
}
```

## Output

| File | Purpose |
|------|---------|
| `thoughts/config-optimizations/CHECK-*.md` | Gap analysis |
| `thoughts/config-optimizations/APPLY-*.md` | Applied changes |

## Integration

| Skill | Focus |
|-------|-------|
| `/config-optimize` | Config based on releases |
| `/meta-iterate` | Prompts based on sessions |

Weekly routine: `/config-optimize` then `/meta-iterate`

## Completion

After workflow completes (or early exit), always output:

```
## Config Optimization Complete

- Current version: {version}
- Last checked: {date}
- Actions taken: {count} proposals applied / 0 (already current)
- Next check recommended: {date + 7 days}
```

This signals to the user that the optimization is done.
