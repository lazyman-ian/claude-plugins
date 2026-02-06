# Hooks Setup Guide

dev-flow plugin provides hook scripts that enhance the Claude Code experience.

## Setup Hook (v2.1.10+)

The Setup hook runs on project initialization and maintenance tasks.

### Installation

```bash
# Copy the hook script
cp hooks/setup-init.sh ~/.claude/hooks/
chmod +x ~/.claude/hooks/setup-init.sh

# Or use symlink for auto-updates
ln -s "$(pwd)/hooks/setup-init.sh" ~/.claude/hooks/setup-init.sh
```

### Configuration

Add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "Setup": [{
      "matcher": "init|maintenance",
      "hooks": [{
        "type": "command",
        "command": "$HOME/.claude/hooks/setup-init.sh",
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
        "matcher": "init|maintenance",
        "hooks": [{
          "type": "command",
          "command": "$HOME/.claude/hooks/setup-init.sh",
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
echo '{"trigger": "init"}' | ~/.claude/hooks/setup-init.sh

# Test maintenance trigger
echo '{"trigger": "maintenance"}' | ~/.claude/hooks/setup-init.sh
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
   ls -l ~/.claude/hooks/setup-init.sh
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
echo '{"trigger": "init"}' | ~/.claude/hooks/setup-init.sh

# Check for script errors
bash -x ~/.claude/hooks/setup-init.sh <<< '{"trigger": "init"}'
```

## Hook Development

To create custom hooks:

1. Use bash with `set -euo pipefail`
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

## Related

- [Hook Development Guide](https://code.claude.com/docs/hooks)
- [dev-flow Hook Architecture](../CLAUDE.md#hook-integration)
- [Keybindings Setup](./keybindings.md)
