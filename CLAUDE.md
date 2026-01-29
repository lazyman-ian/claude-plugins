# claude-plugins

lazyman-ian marketplace for Claude Code plugins.

## Plugins Overview

| Plugin | Version | Skills | Commands | Agents | MCP |
|--------|---------|--------|----------|--------|-----|
| dev-flow | 3.12.0 | 5 | 21 | 12 | Yes |
| ios-swift-plugin | 1.0.0 | 10 | 4 | 2 | No |

### dev-flow
Development workflow automation: planning → coding → commit → PR → release
- Key commands: `/dev`, `/dev commit`, `/dev pr`, `/dev release`
- MCP server: `scripts/mcp-server.cjs`

### ios-swift-plugin
iOS/Swift development toolkit
- Skills: swiftui-expert, swift-concurrency, ios-widget-developer, etc.
- Commands: xcode-test, swift-audit, swift-fix-issue, app-changelog

## Plugin Manifest Rules

**Supported fields**:
```json
{
  "name": "plugin-name",
  "version": "1.0.0",
  "description": "...",
  "author": { "name": "..." },
  "skills": "./skills/",
  "commands": "./commands/",
  "mcpServers": "./.mcp.json",
  "lspServers": "./.lsp.json"
}
```

**Auto-discovered** (don't declare):
- `agents/` directory
- `hooks/hooks.json`

**Invalid fields**:
- `bundledMcpServers`
- `agents`
- `hooks`

## Agent Frontmatter

```yaml
---
name: agent-name
description: What it does. Triggers on "keyword", "关键词".
model: sonnet  # sonnet, opus, haiku (NOT inherit)
color: yellow  # optional
---
```

**Invalid**: `tools: [...]`

## Hooks Format

```json
{
  "hooks": {
    "PreToolUse": [{ "matcher": "...", "hooks": [...] }],
    "PostToolUse": [{ "matcher": "...", "hooks": [...] }]
  }
}
```

Must wrap in `"hooks"` object.

## Development Workflow

```bash
# 1. Edit source in /Users/lazyman/work/claude-plugins/<plugin>/

# 2. Commit and push
git -C <plugin> add . && git -C <plugin> commit -m "..." && git -C <plugin> push

# 3. Update main repo
git add <plugin> && git commit -m "chore: update <plugin>" && git push

# 4. Sync marketplace
git -C ~/.claude/plugins/marketplaces/lazyman-ian submodule update --remote
rm -rf ~/.claude/plugins/cache/lazyman-ian/

# 5. Restart Claude Code and test with /plugin
```

## Quick Commands

```bash
# Sync all
git -C ~/.claude/plugins/marketplaces/lazyman-ian submodule update --remote && rm -rf ~/.claude/plugins/cache/lazyman-ian/

# Check submodule status
git submodule status
```
