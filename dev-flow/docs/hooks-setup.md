# Hooks Setup Guide

dev-flow plugin provides hook scripts that enhance the Claude Code experience.

## Setup Hook (v2.1.10+)

The Setup hook runs on project initialization and maintenance tasks.

### Installation

```bash
# Copy the hook script
cp hooks/setup-dev-flow.sh ~/.claude/hooks/
chmod +x ~/.claude/hooks/setup-dev-flow.sh

# Or use symlink for auto-updates
ln -s "$(pwd)/hooks/setup-dev-flow.sh" ~/.claude/hooks/setup-dev-flow.sh
```

### Configuration

Add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "Setup": [{
      "matcher": "init",
      "hooks": [{
        "type": "command",
        "command": "$HOME/.claude/hooks/setup-dev-flow.sh",
        "timeout": 30
      }]
    }]
  }
}
```

### Usage

#### Initialize New Project

```bash
# Trigger with matcher "init"
# Creates thoughts/ledgers, handoffs, plans directories
```

Claude Code will automatically run this when:
- Opening a new project for the first time
- Running `/dev-flow:init` command

#### Maintenance

```bash
# Trigger with matcher "maintenance"
# Cleans old cache, transcripts, logs
```

Runs on:
- Manual trigger
- Scheduled maintenance (if configured)

### What It Does

| Trigger | Actions |
|---------|---------|
| `init` | Creates `thoughts/` structure, `.gitignore` |
| `maintenance` | Deletes files >7 days in cache, >30 days transcripts, trims logs |

## Hook Priority vs .claude-plugin/

**Important**: Hooks in `~/.claude/hooks/` have **higher priority** than hooks defined in `.claude-plugin/plugin.json`.

If you want plugin-bundled hooks to run:
1. Don't install to `~/.claude/hooks/`
2. Define hooks in `.claude-plugin/hooks/hooks.json`

## Existing Hooks Reference

dev-flow works with these standard hooks:

| Hook | Purpose | Status |
|------|---------|--------|
| `SessionStart` | Load ledger context | ✅ Recommended |
| `PreToolUse` | Context injection | ✅ Recommended |
| `PostToolUse` | Auto-formatting, tracking | ✅ Recommended |
| `Stop` | Verify completion | ⚠️ Optional |
| `SessionEnd` | Cleanup, reminders | ⚠️ Optional |
| `PreCompact` | Backup transcripts | ✅ Recommended |
| `SubagentStop` | Handoff validation | ⚠️ Optional |
| `Setup` | Init & maintenance | ✅ New in v2.1.10 |
| `TaskCompleted` | Block incomplete tasks | ⚠️ Opt-in (agent teams) |
| `TeammateIdle` | Block idle with dirty state | ⚠️ Opt-in (agent teams) |

## Hook Conflicts

If you already have hooks in `~/.claude/settings.json`, merge them:

```json
{
  "hooks": {
    "Setup": [
      // Existing Setup hooks
      { "matcher": "...", "hooks": [...] },

      // Add dev-flow Setup hook
      {
        "matcher": "init",
        "hooks": [{
          "type": "command",
          "command": "$HOME/.claude/hooks/setup-dev-flow.sh",
          "timeout": 30
        }]
      }
    ]
  }
}
```

## Testing Hooks

### Test Setup Hook

```bash
# Test init trigger
echo '{"trigger": "init"}' | ~/.claude/hooks/setup-dev-flow.sh

# Test maintenance trigger
echo '{"trigger": "maintenance"}' | ~/.claude/hooks/setup-dev-flow.sh
```

### Expected Output

```
# Init
✅ dev-flow initialized
  📁 thoughts/ledgers, handoffs, plans created

# Maintenance
✅ Maintenance complete
  🧹 Cleaned 23 files/entries
```

## Troubleshooting

### Hook Not Running

1. Check file permissions:
   ```bash
   ls -l ~/.claude/hooks/setup-dev-flow.sh
   # Should show: -rwxr-xr-x
   ```

2. Verify JSON syntax:
   ```bash
   cat ~/.claude/settings.json | jq .hooks.Setup
   ```

3. Check timeout:
   - Default: 30s
   - Increase if maintenance takes longer

### Hook Errors

```bash
# Run manually with stdin
echo '{"trigger": "init"}' | ~/.claude/hooks/setup-dev-flow.sh

# Check for script errors
bash -x ~/.claude/hooks/setup-dev-flow.sh <<< '{"trigger": "init"}'
```

## Hook Development

To create custom hooks:

1. Use bash with `set -o pipefail` (avoid `-e` as it crashes on jq errors)
2. Read JSON input from stdin
3. Output user-friendly messages
4. Exit 0 for success, non-zero for errors

Example structure:

```bash
#!/bin/bash
set -euo pipefail

INPUT=$(cat)
PARAM=$(echo "$INPUT" | jq -r '.param // "default"')

# Your logic here

echo "✅ Success message"
```

## Performance Optimization

### Avoid Heavy Operations

```bash
# ❌ Bad: Full git log on every PostToolUse
git log --all --oneline

# ✅ Good: Limit results
git log --oneline -5
```

### Cache Expensive Checks

```bash
# Cache PR status for 30 seconds
CACHE_FILE="$STATE_DIR/pr_cache"
if [ -f "$CACHE_FILE" ]; then
    CACHE_AGE=$(( $(date +%s) - $(stat -f%m "$CACHE_FILE" 2>/dev/null || echo 0) ))
    if [ "$CACHE_AGE" -lt 30 ]; then
        cat "$CACHE_FILE"
        exit 0
    fi
fi

# Fetch and cache
gh pr view --json state -q '.state' > "$CACHE_FILE"
```

### Early Exit for Non-Target Tools

```bash
# In PostToolUse hook, exit early for irrelevant tools
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
case "$TOOL_NAME" in
    Read|Grep|Glob) exit 0 ;;  # Skip for read-only tools
esac
```

## Debugging Techniques

### Enable Debug Logging

```bash
# Set environment variable
export CLAUDE_HOOK_DEBUG=1

# In hook script
if [ "$CLAUDE_HOOK_DEBUG" = "1" ]; then
    LOG_FILE="${HOME}/.claude/hooks.log"
    echo "[$(date)] $0 | Input: $INPUT" >> "$LOG_FILE"
fi
```

### Test Hooks Manually

```bash
# Simulate hook input
echo '{"tool_name":"Bash","tool_input":{"command":"git status"}}' | \
  ~/.claude/hooks/my-hook.sh

# With real Claude Code JSON
pbpaste | ~/.claude/hooks/my-hook.sh
```

### Validate JSON Parsing

```bash
# Robust parsing with fallback
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty' 2>/dev/null || echo "")
if [ -z "$SESSION_ID" ]; then
    echo "⚠️ Warning: No session_id found" >&2
    exit 0  # Non-blocking
fi
```

## Advanced Matcher Patterns

### Multiple Tools

```json
{
  "matcher": "Write|Edit|Bash",
  "hooks": [...]
}
```

### Tool with Arguments

```json
{
  "matcher": "Bash(git commit*)",
  "hooks": [...]
}
```

### MCP Tools

```json
{
  "matcher": "mcp__.*",
  "hooks": [...]
}
```

### Exclude Pattern

Use script logic to exclude:

```bash
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')
case "$TOOL_NAME" in
    Read|Grep|Glob) exit 0 ;;  # Exclude these
    *) ;;  # Process others
esac
```

## Agent Team Quality Gates

Two hook types for enforcing quality in agent teams. **Not enabled by default** — add to your settings to opt in.

### TaskCompleted Gate

Blocks task completion when verification hasn't passed. Only enforces for agent team tasks (`team_name` present).

**Checks**:
1. No uncommitted changes (must `/dev commit` first)
2. `make check` passes (if Makefile exists)

**Script**: `scripts/task-completed-gate.sh`

**Input** (stdin JSON):
```json
{
  "task_id": "task-001",
  "task_subject": "Implement auth",
  "task_description": "Add login endpoints",
  "teammate_name": "impl-dev",
  "team_name": "TASK-123"
}
```

### TeammateIdle Gate

Prevents teammate from going idle with uncommitted work.

**Checks**:
1. No uncommitted changes
2. No staged-but-not-committed files

**Script**: `scripts/teammate-idle-gate.sh`

**Input** (stdin JSON):
```json
{
  "teammate_name": "impl-dev",
  "team_name": "TASK-123"
}
```

### Local Installation

Add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "TaskCompleted": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "~/.claude/plugins/installed/dev-flow@lazyman-ian/scripts/task-completed-gate.sh",
            "timeout": 30
          }
        ]
      }
    ],
    "TeammateIdle": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "~/.claude/plugins/installed/dev-flow@lazyman-ian/scripts/teammate-idle-gate.sh",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

**Note**: These hooks don't support matchers — they fire on every occurrence.

### Testing

```bash
# Test TaskCompleted (should pass if clean tree)
echo '{"task_id":"t1","task_subject":"Test","team_name":"test-team"}' | \
  scripts/task-completed-gate.sh

# Test TeammateIdle (should pass if clean tree)
echo '{"teammate_name":"dev","team_name":"test-team"}' | \
  scripts/teammate-idle-gate.sh

# Debug mode
CLAUDE_HOOK_DEBUG=1 echo '{"team_name":"test"}' | scripts/task-completed-gate.sh
cat ~/.claude/hooks.log
```

### Customization

| Scenario | How |
|----------|-----|
| Skip `make check` | Remove Check 2 block in `task-completed-gate.sh` |
| Add test run | Add `npm test` or custom verify in Check 2 |
| Allow dirty idle | Remove Check 1 in `teammate-idle-gate.sh` |
| Team-specific logic | Check `$team_name` value in script |

### Advanced: Prompt-based TaskCompleted

TaskCompleted supports `type: "prompt"` — use an LLM to evaluate completion:

```json
{
  "hooks": {
    "TaskCompleted": [
      {
        "hooks": [
          {
            "type": "prompt",
            "prompt": "Evaluate if this task is truly complete. Task: $ARGUMENTS. Check if the implementation matches the description and all acceptance criteria are met.",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

### Advanced: Agent-based TaskCompleted

TaskCompleted also supports `type: "agent"` — spawn a subagent to verify:

```json
{
  "hooks": {
    "TaskCompleted": [
      {
        "hooks": [
          {
            "type": "agent",
            "prompt": "Verify task completion by checking: 1) All files mentioned in the task exist, 2) Tests pass, 3) No TODO comments left. Task: $ARGUMENTS",
            "timeout": 120
          }
        ]
      }
    ]
  }
}
```

**Note**: `TeammateIdle` only supports `type: "command"`, not prompt or agent.

## Related

- [Hook Development Guide](https://code.claude.com/docs/hooks)
- [dev-flow Hook Architecture](../CLAUDE.md#hook-integration)
- [Keybindings Setup](./keybindings.md)
