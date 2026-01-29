# Utils Plugin

Claude Code plugin for code quality, search, and safety hooks.

## Features

### Skills
- **deslop** - Remove AI-generated code slop from current branch
- **search-code** - Unified code search interface

### Commands
- `/deslop` - Clean up redundant AI-generated code
- `/search <pattern>` - Smart code search

### Hooks
- **loop-detection** - Warns when same tool called 8+ times in last 10 calls
- **alias-conflict-detector** - Detects bash alias conflicts (find→fd, ls→eza, cat→bat)

## Installation

```bash
ln -s /path/to/utils-plugin ~/.claude/plugins/utils
```

## Usage

### Deslop

Remove AI-generated redundant code:

```bash
# Clean current branch
/deslop

# Preview only
/deslop --dry-run
```

Removes:
- Redundant comments (`// Get user` before `getUser()`)
- Over-defensive code (unnecessary try/catch)
- Type escapes (`as any`, `as! Type`)
- Debug logs (`print("start")`)

Preserves:
- `// MARK:` section markers
- `// TODO:` / `// FIXME:`
- Complex logic explanations
- Public API documentation

### Search

Unified code search:

```bash
# Content search
/search "API_KEY"

# File search
/search --file "Manager"

# Symbol definition
/search --symbol "UserManager"

# Usage locations
/search --usage "fetchUser"
```

### Safety Hooks

**Loop Detection:**
Warns when you're calling the same tool repeatedly (potential stuck loop):
```
⚠️ Loop Detection Warning

Tool **Grep** called 8 times in last 10 calls

Suggestions:
1. Try a different approach
2. Use Task(Explore) instead of repeated Grep
3. Create a skill for repetitive operations
```

**Alias Conflict Detection:**
Warns about bash alias conflicts:
```
## Alias Conflict Detection

⚠️ Used `find` (actually `fd` alias) with incompatible `-type` parameter
   Suggest: Use `/usr/bin/find` or `fd -t f --glob` or Glob tool

💡 Used `cat` (actually `bat` alias), suggest using Read tool
```

## Hook Configuration

Hooks are configured in `hooks/hooks.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "${CLAUDE_PLUGIN_ROOT}/hooks/alias-conflict-detector.sh" },
          { "type": "command", "command": "${CLAUDE_PLUGIN_ROOT}/hooks/loop-detection.sh" }
        ]
      }
    ]
  }
}
```

## License

MIT
