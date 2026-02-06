# Keybindings Setup for dev-flow

Claude Code v2.1.18+ supports custom keybindings for commands.

## Quick Setup

Add to your `~/.claude/settings.json`:

```json
{
  "keybindings": [
    { "key": "ctrl+d ctrl+s", "command": "/dev-flow:dev" },
    { "key": "ctrl+d ctrl+c", "command": "/dev-flow:commit" },
    { "key": "ctrl+d ctrl+p", "command": "/dev-flow:pr" },
    { "key": "ctrl+d ctrl+r", "command": "/dev-flow:release" },
    { "key": "ctrl+d ctrl+t", "command": "/dev-flow:tasks" },
    { "key": "ctrl+d ctrl+l", "command": "/dev-flow:ledger" },
    { "key": "ctrl+d ctrl+v", "command": "/dev-flow:validate" }
  ]
}
```

## Keybinding Reference

| Keybinding | Command | Description |
|------------|---------|-------------|
| `ctrl+d ctrl+s` | `/dev-flow:dev` | Show dev status |
| `ctrl+d ctrl+c` | `/dev-flow:commit` | Smart commit |
| `ctrl+d ctrl+p` | `/dev-flow:pr` | Create pull request |
| `ctrl+d ctrl+r` | `/dev-flow:release` | Create release |
| `ctrl+d ctrl+t` | `/dev-flow:tasks` | Task management |
| `ctrl+d ctrl+l` | `/dev-flow:ledger` | Ledger management |
| `ctrl+d ctrl+v` | `/dev-flow:validate` | Validate plan |

## Keybinding Syntax

Claude Code uses VS Code-style keybinding syntax:

### Modifiers
- `ctrl` - Control key
- `cmd` - Command key (macOS)
- `alt` - Alt/Option key
- `shift` - Shift key

### Sequences
- Single key: `"ctrl+d"`
- Sequence: `"ctrl+d ctrl+c"` (press ctrl+d, then ctrl+c)

### Examples
```json
{ "key": "ctrl+shift+d", "command": "/dev-flow:dev" }
{ "key": "cmd+k cmd+m", "command": "/dev-flow:commit" }
{ "key": "alt+d", "command": "/dev-flow:dev" }
```

## Platform-Specific Bindings

```json
{
  "keybindings": [
    {
      "key": "cmd+d cmd+c",
      "command": "/dev-flow:commit",
      "when": "isMac"
    },
    {
      "key": "ctrl+d ctrl+c",
      "command": "/dev-flow:commit",
      "when": "isWindows || isLinux"
    }
  ]
}
```

## Installation via /init

The `/dev-flow:init --with-keybindings` command will automatically add these keybindings to your settings.

## Manual Merge

If you already have keybindings, merge them:

```json
{
  "keybindings": [
    // Your existing keybindings
    { "key": "ctrl+t", "command": "/some-other-command" },

    // Add dev-flow keybindings
    { "key": "ctrl+d ctrl+s", "command": "/dev-flow:dev" },
    { "key": "ctrl+d ctrl+c", "command": "/dev-flow:commit" }
  ]
}
```

## Troubleshooting

### Keybinding Not Working

1. Check settings.json syntax:
   ```bash
   cat ~/.claude/settings.json | jq .keybindings
   ```

2. Verify command name:
   ```bash
   # Must match exactly:
   /dev-flow:commit  # ✅ Correct
   /commit           # ❌ Wrong
   ```

3. Check for conflicts:
   - Keybindings are first-match wins
   - System keybindings may override

### Override System Keybinding

```json
{
  "key": "ctrl+d ctrl+c",
  "command": "/dev-flow:commit",
  "override": true
}
```

## Related

- [Claude Code Keybindings Documentation](https://code.claude.com/docs/keybindings)
- [dev-flow Command Reference](../commands/)
