# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

lazyman-ian marketplace for Claude Code plugins. Contains 4 plugins in a single repository.

| Plugin | Version | Purpose |
|--------|---------|---------|
| dev-flow | 5.0.0 | Development workflow: brainstorm → plan → implement (5-gate pipeline) → commit → PR → release + automated code review (P0-P3) + agent-team + cross-platform team + 4-tier memory system |
| ios-swift-plugin | 1.1.0 | iOS/Swift toolkit: SwiftUI, Concurrency, WidgetKit |
| utils | 1.3.0 | Code quality: deslop, search-code, safety hooks |
| research | 1.3.0 | Research: Perplexity AI, Braintrust, RepoPrompt |

## Build Commands

### Project Initialization

**Required:** Run `/dev-flow:init` once per project to create `.dev-flow.json` and `thoughts/` directories.
- SessionStart warns if not initialized but does NOT auto-create
- Without init: no platform commands, no memory system, no scope inference
- For monorepo projects: Set `"platform": "monorepo"` explicitly

### dev-flow MCP Server (TypeScript)

```bash
# Use --prefix to avoid cd (zoxide alias breaks non-interactive cd)
npm install --prefix dev-flow/mcp-server
npm run --prefix dev-flow/mcp-server bundle    # Bundle to scripts/mcp-server.cjs (required for plugin)
npm run --prefix dev-flow/mcp-server build     # TypeScript compile to dist/
npm run --prefix dev-flow/mcp-server dev       # Run with ts-node
```

### ios-swift-plugin ConcurrencyGuard (Swift)

```bash
# swift build doesn't have --prefix equivalent, use builtin cd
builtin cd ios-swift-plugin/tools/ConcurrencyGuard && swift build -c release
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

`.claude-plugin/marketplace.json` defines the plugin registry. Plugins reference directories via `"source": "./dev-flow"`.

### Key Directories

| Directory | Purpose |
|-----------|---------|
| `dev-flow/` | Workflow automation with MCP server |
| `ios-swift-plugin/` | iOS/Swift toolkit |
| `utils-plugin/` | Built-in: code quality hooks |
| `research-plugin/` | Built-in: research tools |
| `thoughts/` | Config optimizations, cross-platform plans |

### dev-flow MCP Server Architecture

Single-file bundle architecture (`mcp-server/src/index.ts` → `scripts/mcp-server.cjs`):

| Module | Purpose |
|--------|---------|
| `detector.ts` | Platform detection: `detectPlatformSimple()` unified entry (`.dev-flow.json` > file-based) |
| `git/workflow.ts` | Git status, phase detection |
| `platforms/ios.ts` | SwiftLint, SwiftFormat commands |
| `platforms/android.ts` | ktlint, ktfmt commands |
| `continuity/` | Ledgers, reasoning, task-sync |
| `coordination/` | Multi-agent coordination, handoffs |

## Installation

See [INSTALL.md](./INSTALL.md) for detailed installation instructions.

Quick install (in Claude Code):
```
/plugin marketplace add lazyman-ian/claude-plugins
/plugin install dev-flow@lazyman-ian
```

## Development Workflow

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

### Hook Script Best Practices

- Use `set -o pipefail` (NOT `set -eo pipefail`) — `-e` causes jq parse errors to crash the script
- All `jq` calls add `2>/dev/null || echo ""` fallback
- Non-target files early exit before heavy parsing (e.g., check `.swift$` before parsing content)
- Use `builtin cd` (not `cd`) in hooks — aliased to zoxide. Note: `builtin` only works with shell builtins (cd/echo/pwd), NOT external commands (npm/git/node). For external commands use `--prefix`/`-C` flags
- Use `/usr/bin/sed` (not `sed`) — aliased to `sd` with incompatible syntax
- Use `/usr/bin/find` (not `find`) — aliased to `fd` with different arguments
- Use `/usr/bin/curl` (not `curl`) — aliased to `xh` with incompatible flags

### Skill Requirements

- SKILL.md < 500 lines
- Frontmatter with `name`, `description` (EN+CN triggers), `allowed-tools`
- Description pattern: "This skill should be used when..."

## Quick Commands

```bash
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
- `<plugin>/.claude-plugin/marketplace.json` (if exists, was found stale at 3.11.1)
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
