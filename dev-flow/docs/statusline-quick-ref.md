# StatusLine Quick Reference

## Display Overview

```
Line 1: Son ██████░░░░ 60% | ● DEV | main ~3 +1 | 45m $0.23
Line 2: in:45K out:12K | +123 -45 | cache:75% | R:12 E:5 B:8 G:3
Line 3: ✓ 3/5 (60%) →1 ⏳1
Line 4: ⚡ feature-auth (3) agent-1,agent-2,agent-3
Line 5: ▸ impl-agent: Implementing auth (45s)
Line 6: turn:12 | ▶ Auth Module → Phase 2
```

## Line-by-Line Breakdown

### Line 1: Main Status

| Element | Meaning | Example |
|---------|---------|---------|
| `Son` | Model (Opus/Son/Hai) | Sonnet 4.5 |
| `██████░░░░` | Context bar (0-100%) | 60% full |
| `60%` | Context percentage | 60K/100K used |
| `● DEV` | Workflow phase | Developing |
| `main` | Git branch | main branch |
| `~3` | Modified files | 3 files changed |
| `+1` | Added files | 1 new file |
| `45m` | Session duration | 45 minutes |
| `$0.23` | Session cost | 23 cents USD |

### Line 2: Session Metrics

| Element | Meaning |
|---------|---------|
| `in:45K` | Total input tokens (thousands) |
| `out:12K` | Total output tokens (thousands) |
| `+123 -45` | Lines added/removed this session |
| `cache:75%` | Cache hit rate (green if >70%) |
| `R:12` | Read tool calls |
| `E:5` | Edit tool calls |
| `B:8` | Bash tool calls |
| `G:3` | Grep tool calls |

### Line 3: Task Progress

| Element | Meaning |
|---------|---------|
| `✓ 3/5` | Completed/total tasks |
| `(60%)` | Completion percentage |
| `→1` | In-progress tasks |
| `⏳1` | Pending tasks |

### Line 4: Agent Team ✨

**Session-isolated display** - only shows current session's team.

| Element | Meaning |
|---------|---------|
| `⚡` | Team indicator |
| `feature-auth` | Team name |
| `(3)` | Number of teammates |
| `agent-1,agent-2,agent-3` | Teammate names (truncated if >30 chars) |

**Note**: If you don't see this line, no Agent Team is active in current session.

### Line 5: Active Agents

Shows agents currently working on tasks.

| Element | Meaning |
|---------|---------|
| `▸` | Agent indicator |
| `impl-agent` | Agent name |
| `Implementing auth` | Task description (truncated to 25 chars) |
| `(45s)` | Duration |

### Line 6: Session Info

| Element | Meaning |
|---------|---------|
| `turn:12` | Conversation turns (yellow if >20, red if >40) |
| `▶` | Ledger indicator |
| `Auth Module` | Ledger title |
| `→ Phase 2` | Current phase from ledger |

## Workflow Phases

| Phase | Icon | Meaning | Next Action |
|-------|------|---------|-------------|
| `IDLE` | ○ | No git repo | Initialize repo |
| `DEV` | ● | Uncommitted changes | `/dev commit` |
| `PUSH` | ↑ | Ahead of remote | `/dev pr` |
| `PR` | ◎ | PR open | Review/merge |
| `MERGED` | ✓ | PR merged | `/dev release` |
| `WAIT` | ⏸ | Clean state | Continue development |

## Context Bar Colors

| Color | Range | Meaning |
|-------|-------|---------|
| 🟢 Green | 0-50% | Healthy |
| 🟡 Yellow | 50-80% | Attention needed |
| 🔴 Red | 80-100% | Consider `/clear` |

## Agent Team Session Isolation

### How It Works

```
Session A: TeamCreate("team-auth")
  └─> StatusLine shows: ⚡ team-auth (3) ...

Session B: TeamCreate("team-payment")
  └─> StatusLine shows: ⚡ team-payment (2) ...

Session A again:
  └─> StatusLine shows: ⚡ team-auth (3) ...  ← Only team-auth!
```

### Implementation

1. **Primary**: Session→team mapping
   - Automatically tracked via hooks
   - Stored in `~/.claude/state/dev-flow/session_teams.json`

2. **Fallback**: Time-based filter (5-minute window)
   - Used if mapping missing/corrupted

### Troubleshooting

| Issue | Solution |
|-------|----------|
| Multiple teams shown | Check `~/.claude/state/dev-flow/session_teams.json` |
| No team shown | Verify team still exists in `~/.claude/teams/` |
| Stale team shown | Run cleanup: `track-team.sh cleanup` |

## Installation

Add to `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "~/.claude/plugins/marketplaces/lazyman-ian/dev-flow/scripts/statusline.sh",
    "padding": 0
  }
}
```

## See Also

- [session-team-mapping.md](./session-team-mapping.md) - Session isolation implementation
- [StatusLine script](../scripts/statusline.sh) - Source code
- [hooks.json](../hooks/hooks.json) - Hook configuration
