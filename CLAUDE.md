# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

lazyman-ian marketplace for Claude Code plugins. This is a plugin directory (not a monorepo) containing 4 plugins: 2 git submodules (dev-flow, ios-swift-plugin) and 2 built-in plugins (utils, research).

| Plugin | Version | Type | Purpose |
|--------|---------|------|---------|
| dev-flow | 3.14.0 | submodule | Development workflow: planning → coding → commit → PR → release |
| ios-swift-plugin | 1.1.0 | submodule | iOS/Swift toolkit: SwiftUI, Concurrency, WidgetKit |
| utils | 1.3.0 | built-in | Code quality: deslop, search-code, safety hooks |
| research | 1.3.0 | built-in | Research: Perplexity AI, Braintrust, RepoPrompt |

## Build Commands

### dev-flow MCP Server (TypeScript)

```bash
cd dev-flow/mcp-server
npm install
npm run bundle    # Bundle to scripts/mcp-server.cjs (required for plugin)
npm run build     # TypeScript compile to dist/
npm run dev       # Run with ts-node
```

### ios-swift-plugin ConcurrencyGuard (Swift)

```bash
cd ios-swift-plugin/tools/ConcurrencyGuard
swift build -c release
```

### utils & research

No build required (Python scripts and markdown skills).

## Architecture

### Plugin System Structure

Each plugin follows this structure:

```
plugin-name/
├── .claude-plugin/plugin.json    # Plugin manifest
├── skills/                        # Skill definitions (SKILL.md)
├── commands/                      # Command definitions
├── agents/                        # Agent prompts (auto-discovered)
└── hooks/hooks.json              # Hook configurations (auto-discovered)
```

### Marketplace Registry

`.claude-plugin/marketplace.json` defines the plugin registry. Plugins reference submodules via `"source": "./dev-flow"`.

### Key Directories

| Directory | Purpose |
|-----------|---------|
| `dev-flow/` | Submodule: workflow automation with MCP server |
| `ios-swift-plugin/` | Submodule: iOS/Swift toolkit |
| `utils-plugin/` | Built-in: code quality hooks |
| `research-plugin/` | Built-in: research tools |
| `thoughts/` | Shared schemas and handoff documents |

### dev-flow MCP Server Architecture

Single-file bundle architecture (`mcp-server/src/index.ts` → `scripts/mcp-server.cjs`):

| Module | Purpose |
|--------|---------|
| `detector.ts` | Project type detection (ios/android/web) |
| `git/workflow.ts` | Git status, phase detection |
| `platforms/ios.ts` | SwiftLint, SwiftFormat commands |
| `platforms/android.ts` | ktlint, ktfmt commands |
| `continuity/` | Ledgers, reasoning, task-sync |
| `coordination/` | Multi-agent coordination, handoffs |

## Installation

See [INSTALL.md](./INSTALL.md) for detailed installation instructions including submodule handling.

Quick install:
```bash
claude marketplace add lazyman-ian https://github.com/lazyman-ian/claude-plugins.git
claude plugins add dev-flow@lazyman-ian
```

## Development Workflow

### Submodule Changes

```bash
# 1. Edit in submodule
git -C <plugin> add . && git -C <plugin> commit -m "..." && git -C <plugin> push

# 2. Update main repo
git add <plugin> && git commit -m "chore: update <plugin>" && git push

# 3. Sync marketplace
git -C ~/.claude/plugins/marketplaces/lazyman-ian pull
```

### Plugin Manifest Rules

**Supported fields**: `name`, `version`, `description`, `author`, `skills`, `commands`, `mcpServers`, `lspServers`

**Auto-discovered** (don't declare): `agents/` directory, `hooks/hooks.json`

**Invalid fields**: `bundledMcpServers`, `agents`, `hooks`

### Agent Frontmatter

```yaml
---
name: agent-name
description: What it does. Triggers on "keyword", "关键词".
model: sonnet  # sonnet, opus, haiku
color: yellow  # optional
---
```

**Invalid**: `tools: [...]`

### Hooks Format

```json
{
  "hooks": {
    "PreToolUse": [{ "matcher": "...", "hooks": [...] }],
    "PostToolUse": [{ "matcher": "...", "hooks": [...] }]
  }
}
```

Must wrap in `"hooks"` object. Use `.tool_name` and `.tool_input.*` for input fields.

### Skill Requirements

- SKILL.md < 500 lines
- Frontmatter with `name`, `description` (EN+CN triggers), `allowed-tools`
- Description pattern: "This skill should be used when..."

## Quick Commands

```bash
# Check submodule status
git submodule status

# Reinstall after cache clear
claude plugins remove utils@lazyman-ian && claude plugins add utils@lazyman-ian

# Audit all skills
for f in */skills/*/SKILL.md; do
  name=$(dirname "$f" | xargs basename)
  lines=$(wc -l < "$f" | tr -d ' ')
  tools=$(grep -q "allowed-tools" "$f" && echo "✅" || echo "❌")
  echo "$lines $tools $name"
done | sort -rn
```

## Version Upgrade Checklist

Update these files when bumping version:
- `<plugin>/.claude-plugin/plugin.json`
- `.claude-plugin/marketplace.json`
- `<plugin>/README.md` (badge)

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
