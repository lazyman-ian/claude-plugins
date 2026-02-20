---
name: hook-developer
description: >-
  Provides complete Claude Code hooks development guidance with templates, safety patterns,
  and testing workflows for all 14 hook types. This skill should be used when users need to
  create, modify, debug, or test Claude Code hooks including PreToolUse, PostToolUse, SessionStart,
  Stop, SubagentStart, TaskCompleted, TeammateIdle, and other hook types.
  Triggers on "create hook", "write hook", "hook for", "add hook", "debug hook", "test hook",
  "编写hook", "创建钩子", "hook开发", "调试hook".
  Do NOT use for general shell scripting — only Claude Code hook development.
model: sonnet
memory: project
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep]
---

# Hook Developer - Claude Code Hook Creation Guide

Create, modify, debug, and test Claude Code hooks with safety patterns and templates.

## When to Use

- "create a PreToolUse hook to block dangerous commands"
- "write a PostToolUse hook for auto-formatting"
- "add a SessionStart hook to inject context"
- "debug why my hook isn't triggering"
- "编写一个 hook 来自动审批测试命令"

## Hook Types Quick Reference

| Hook | Trigger | Can Block | Primary Use |
|------|---------|-----------|-------------|
| **PreToolUse** | Before tool | YES | Block commands, validate inputs |
| **PostToolUse** | After tool | Partial | Formatters, linters, counters |
| **PostToolUseFailure** | Tool fails | NO | Error tracking, feedback |
| **UserPromptSubmit** | User sends | YES | Inject context, validate |
| **PermissionRequest** | Permission dialog | YES | Auto-approve/deny |
| **SessionStart** | Session begins | NO | Load context, git status |
| **SessionEnd** | Session ends | NO | Cleanup, save state |
| **Stop** | Claude finishes | YES | Verify completion |
| **SubagentStart** | Subagent spawns | NO | Inject context |
| **SubagentStop** | Subagent done | YES | Validate output |
| **PreCompact** | Before compact | NO | Back up transcripts |
| **Notification** | Notification sent | NO | React to alerts |
| **TaskCompleted** | Task marked done | YES | Verify quality |
| **TeammateIdle** | Teammate idles | YES | Assign work |

## Workflow

### Step 1: Identify Hook Type

Determine which hook type matches the need:
- **Before action** (block/modify) -> PreToolUse, UserPromptSubmit
- **After action** (react/log) -> PostToolUse, PostToolUseFailure
- **Lifecycle** -> SessionStart, SessionEnd, Stop, PreCompact
- **Agent control** -> SubagentStart, SubagentStop, TaskCompleted, TeammateIdle
- **Permissions** -> PermissionRequest

### Step 2: Copy Template

```bash
cp ~/.claude/templates/hook-template.sh hooks/my-hook.sh
chmod +x hooks/my-hook.sh
```

Template includes stdin guard, jq fallback, debug logging.

### Step 3: Implement Logic

Follow safety patterns (see below), implement the hook body.
For detailed patterns per hook type, see `references/hook-patterns.md`.

### Step 4: Register in hooks.json

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Bash(rm *)",
      "hooks": [{
        "type": "command",
        "command": "hooks/my-hook.sh"
      }]
    }]
  }
}
```

### Step 5: Test

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"rm -rf /"}}' | hooks/my-hook.sh
```

See `references/testing-guide.md` for comprehensive testing patterns.

## Safety Patterns (CRITICAL)

| Pattern | Why |
|---------|-----|
| `set -o pipefail` (NOT `set -eo pipefail`) | `-e` causes jq errors to crash silently |
| `input=$(cat 2>/dev/null \|\| echo '{}')` | Empty stdin protection |
| `jq -r '.field // empty' 2>/dev/null \|\| echo ""` | Null field + parse error fallback |
| `"$variable"` (always quoted) | Paths with spaces |
| `[[ -f "$file" ]]` before access | Missing file protection |
| `builtin cd` (not `cd`) | Avoids zoxide alias |
| `/usr/bin/sed` (not `sed`) | Avoids sd alias |
| `/usr/bin/curl` (not `curl`) | Avoids xh alias |

## Exit Codes

| Code | Meaning | Use |
|------|---------|-----|
| `0` | Success | Process JSON response |
| `2` | Block | Stderr = error message to Claude |
| Other | Non-blocking error | Hook failure, continue |

## Response Formats

```bash
# Continue (default)
echo '{"result": "continue"}'

# Continue with message
echo '{"result": "continue", "message": "Info for Claude"}'

# Block action (PreToolUse, UserPromptSubmit)
echo '{"result": "block", "reason": "Why blocked"}'

# Approve permission (PermissionRequest)
echo '{"decision": "approve", "reason": "Auto-approved because..."}'

# Modify input (PreToolUse)
echo '{"updatedInput": {"command": "safer-command"}}'
```

## Configuration Levels

| Level | Path | Scope |
|-------|------|-------|
| Project | `.claude/settings.json` | Team (git tracked) |
| User | `~/.claude/settings.json` | All projects |
| Local | `.claude/settings.local.json` | Personal (gitignore) |

## References

- `references/hook-patterns.md` — Detailed patterns per hook type
- `references/testing-guide.md` — Testing, debugging, common errors
- `~/.claude/templates/hook-template.sh` — Base template
- `~/.claude/rules/hooks.md` — Complete hook reference
