# Deny Rules - Recommended Claude Code Permission Restrictions

Claude Code settings support a `permissions.deny` list that blocks specific tool calls before they execute. These rules apply globally across all projects for the user configuration level, or per-project in `.claude/settings.json`.

## Recommended Default Deny Rules

```json
{
  "permissions": {
    "deny": [
      "Bash(rm -rf *)",
      "Bash(curl * | bash)",
      "Bash(curl * | sh)",
      "Bash(wget * | bash)",
      "Bash(wget * | sh)",
      "Read(~/.ssh/*)",
      "Read(~/.aws/*)",
      "Read(~/.gnupg/*)",
      "Read(**/.env*)",
      "Read(**/credentials*)",
      "Write(~/.ssh/*)",
      "Write(**/.env*)"
    ]
  }
}
```

## Rule Reference

### Bash(rm -rf *)

Blocks any `rm -rf` invocation. Prevents accidental or malicious recursive deletion.

Customize: If your workflow legitimately uses `rm -rf` for build artifacts, narrow the scope:
```json
"Bash(rm -rf dist/*)",
"Bash(rm -rf build/*)"
```
Then keep the general `rm -rf *` rule to block everything else.

### Bash(curl * | bash) and variants

Blocks the classic "curl pipe to shell" pattern, which executes arbitrary remote code.
Covers `curl ... | bash`, `curl ... | sh`, and `wget` equivalents.

This is the highest-risk shell pattern. There is no legitimate use case in Claude Code workflows.

### Read(~/.ssh/*)

Blocks reading SSH private keys and known_hosts files. Claude has no need to read your SSH keys.

Customize: If you have SSH-related tooling that must inspect public keys, you can allow specific paths:
```json
"Read(~/.ssh/*.pub)"
```
But keep the general rule to block private keys.

### Read(~/.aws/*)

Blocks reading AWS credentials files (`~/.aws/credentials`, `~/.aws/config`).

### Read(~/.gnupg/*)

Blocks reading GPG keyrings and private keys.

### Read(**/.env*)

Blocks reading any `.env`, `.env.local`, `.env.production`, etc. files.

These files routinely contain database passwords, API keys, and service tokens. Claude does not need to read them to perform development tasks. If you need Claude to understand environment variable names (not values), document them in `CLAUDE.md` without values.

### Read(**/credentials*)

Blocks files named `credentials`, `credentials.json`, `credentials.yaml`, etc. across the project tree.

### Write(~/.ssh/*) and Write(**/.env*)

Blocks writing to SSH key files and environment files. Even if Claude generates a correct-looking private key or env file, you should write these yourself.

## Project-Level Configuration

Place in `.claude/settings.json` for team-shared rules (git tracked):

```json
{
  "permissions": {
    "deny": [
      "Bash(rm -rf src/*)",
      "Bash(DROP TABLE*)",
      "Read(config/secrets.yaml)"
    ]
  }
}
```

Place in `.claude/settings.local.json` for personal rules (not git tracked):

```json
{
  "permissions": {
    "deny": [
      "Read(~/.ssh/*)",
      "Read(~/.aws/*)"
    ]
  }
}
```

## Deny vs PreToolUse Hook

| Approach | When to Use |
|----------|-------------|
| `permissions.deny` | Simple pattern matching, always-off rules |
| `PreToolUse` hook | Conditional logic, logging, user prompts |

Deny rules run before hooks and have zero overhead. Use them for unconditional blocks. Use hooks when you need context-sensitive decisions (e.g., block `rm` in `src/` but allow in `dist/`).

## Testing Deny Rules

After adding a deny rule, verify it fires:

```
Ask Claude: "Run the command: rm -rf /tmp/test-dir"
Expected: Claude reports the tool call was denied
```

If Claude says it cannot run the command but doesn't mention a deny rule, check the rule syntax — glob patterns must match the full argument string.

## Pattern Syntax Notes

Deny rules use glob matching against the full tool call including arguments:
- `Bash(rm -rf *)` matches commands **starting** with `rm -rf` only
- `Bash(*rm -rf*)` matches `rm -rf` anywhere in the command (catches chained: `cd /tmp && rm -rf dir`)
- `Read(**/.env*)` matches `.env`, `.env.local`, `config/.env.production`
- `*` matches any characters except `/` in a single path segment
- `**` matches across path separators

**Important**: `Bash(pattern)` only matches the **start** of commands by default. For destructive operations, always use `Bash(*pattern*)` with leading wildcard to catch chained commands (`&&`, `||`, `;`).

For MCP tools: `mcp__server__tool` format with argument matching is not supported in deny rules. Use PreToolUse hooks for MCP tool restrictions.
