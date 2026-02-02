# claude-plugins

lazyman-ian marketplace for Claude Code plugins.

## Plugins Overview

| Plugin | Version | Skills | Commands | Agents | Hooks | MCP |
|--------|---------|--------|----------|--------|-------|-----|
| dev-flow | 3.13.0 | 5 | 21 | 12 | 3 | Yes |
| ios-swift-plugin | 1.1.0 | 10 | 4 | 2 | 2 | No |
| utils | 1.3.0 | 2 | 2 | 0 | 4 | No |
| research | 1.3.0 | 3 | 4 | 3 | 0 | No |

### dev-flow (submodule)
Development workflow automation: planning → coding → commit → PR → release
- Key commands: `/dev`, `/dev commit`, `/dev pr`, `/dev release`
- MCP server: `scripts/mcp-server.cjs`
- StatusLine: `scripts/statusline.sh` (multi-line: context | git | tools | tasks | agents)

### ios-swift-plugin (submodule)
iOS/Swift development toolkit
- Skills: swiftui-expert, swift-concurrency, ios-widget-developer, etc.
- Commands: xcode-test, swift-audit, swift-fix-issue, app-changelog

### utils (built-in)
Code quality and safety tools
- Skills: deslop, search-code
- Commands: /deslop, /search
- Hooks: tool-enforcer (PreToolUse), loop-detection, alias-conflict-detector, context-warning (Stop)

### research (built-in)
External research and analysis tools
- Skills: research-agent, rp-explorer, token-analyzer
- Commands: /research, /analyze, /explore, /summary
- Agents: research-agent, repo-research-analyst, braintrust-analyst
- Requires: Perplexity API, Braintrust API, RepoPrompt app

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

## Hook Input Fields

| Hook Type | Tool Field | Input Field |
|-----------|-----------|-------------|
| PreToolUse | `.tool_name` | `.tool_input.*` |
| PostToolUse | `.tool_name` | `.tool_input.*` |

**错误示例**: `.tool`, `.params.command` (会导致 hook 失败)

## Development Workflow

```bash
# 1. Edit source in /Users/lazyman/work/claude-plugins/<plugin>/

# 2. Commit and push
git -C <plugin> add . && git -C <plugin> commit -m "..." && git -C <plugin> push

# 3. Update main repo
git add <plugin> && git commit -m "chore: update <plugin>" && git push

# 4. Sync marketplace
git -C ~/.claude/plugins/marketplaces/lazyman-ian pull

# 5. Reinstall if cache was cleared (see Quick Commands)
# 6. Restart Claude Code and test
```

## Quick Commands

```bash
# Sync submodules
git -C ~/.claude/plugins/marketplaces/lazyman-ian pull

# After cache cleared, reinstall affected plugins
claude plugins remove utils@lazyman-ian && claude plugins add utils@lazyman-ian
claude plugins remove research@lazyman-ian && claude plugins add research@lazyman-ian

# Check submodule status
git submodule status
```

## Skill Audit

```bash
# Batch audit all skills
for f in <plugin>/skills/*/SKILL.md; do
  name=$(dirname "$f" | xargs basename)
  lines=$(wc -l < "$f" | tr -d ' ')
  tools=$(grep -q "allowed-tools" "$f" && echo "✅" || echo "❌")
  echo "$lines $tools $name"
done | sort -rn
```

**Checklist**: name, description (EN+CN triggers, 3rd person), allowed-tools, <500 lines

## Version Upgrade

Update these files when bumping version:
- `<plugin>/.claude-plugin/plugin.json`
- `.claude-plugin/marketplace.json`
- `<plugin>/README.md` (badge)
- `<plugin>/docs/GUIDE.md`

## MCP Tools

```bash
claude mcp list              # List active MCP servers
```

| MCP | Purpose | Plugin |
|-----|---------|--------|
| apple-docs | Symbol/API lookup | ios-swift-plugin |
| sosumi | Full docs, HIG | ios-swift-plugin |
| XcodeBuildMCP | Simulator control | ios-swift-plugin |
| dev-flow | Workflow tools | dev-flow |

## Plugin Migration

When moving plugins from local to marketplace:
1. Remove from `~/.claude/plugins/known_marketplaces.json`
2. Remove from `~/.claude/plugins/installed_plugins.json`
3. Delete `~/.claude/plugins/cache/<old-marketplace>/`

## Skill Description Pattern

Third-person + "This skill should be used when...":
```yaml
description: Removes AI-generated code slop. This skill should be used when user says "clean up", "deslop", "清理代码".
```
