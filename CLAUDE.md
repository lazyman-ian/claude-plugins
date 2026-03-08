# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

lazyman-ian marketplace for Claude Code plugins. 5 plugins in a single repository.

| Plugin | Version | Purpose |
|--------|---------|---------|
| dev-flow | 7.1.0 | Autonomous dev workflow: pipeline, 5-gate quality, code review, knowledge vault |
| ios-swift-plugin | 1.3.0 | iOS/Swift: SwiftUI, Concurrency, WidgetKit, Migration |
| android-kotlin-plugin | 1.0.0 | Android/Kotlin: Compose, Coroutines, Architecture, Migration |
| utils | 1.3.0 | Code quality: deslop, search-code, safety hooks |
| research | 1.3.0 | Research: Perplexity AI, Braintrust, RepoPrompt |

## Build Commands

### dev-flow MCP Server (TypeScript)

```bash
npm install --prefix dev-flow/mcp-server
npm run --prefix dev-flow/mcp-server bundle    # → scripts/mcp-server.cjs (required)
npm run --prefix dev-flow/mcp-server build     # TypeScript → dist/
npm run --prefix dev-flow/mcp-server dev       # Run with ts-node
```

### ios-swift-plugin ConcurrencyGuard (Swift)

```bash
builtin cd ios-swift-plugin/tools/ConcurrencyGuard && swift build -c release
```

### utils & research

No build required.

### Project Initialization

Run `/dev-flow:init` once per project to create `.dev-flow.json` and `thoughts/`.
- Without init: no platform commands, no memory, no scope inference
- Monorepo: set `"platform": "monorepo"` in `.dev-flow.json`

## Directory Structure

```
├── dev-flow/                 # 25 skills, 30 commands, 15 agents, 21 MCP tools
│   ├── .claude-plugin/       # Plugin manifest (v7.1.0)
│   ├── mcp-server/src/       # MCP server (TypeScript)
│   │   ├── index.ts          # Entry, tool registration
│   │   ├── detector.ts       # Platform detection (.dev-flow.json > file-based)
│   │   ├── notion.ts         # Notion integration
│   │   ├── git/              # Git operations
│   │   ├── platforms/        # iOS, Android platform commands
│   │   ├── continuity/       # Ledger, task-sync, memory, defaults
│   │   └── coordination/     # Multi-agent: coordinate, handoff, aggregate
│   ├── skills/               # SKILL.md definitions
│   ├── commands/             # Command definitions
│   ├── agents/               # Agent prompts (auto-discovered)
│   ├── hooks/hooks.json      # 23 hooks across 9 types (auto-discovered)
│   ├── scripts/              # 12 scripts (statusline, validation, etc.)
│   └── templates/rules/      # 12 rule templates
├── ios-swift-plugin/         # 16 skills, 4 agents
├── android-kotlin-plugin/    # 7 skills, 2 agents
├── utils-plugin/             # 2 skills, safety hooks
├── research-plugin/          # 3 skills, 3 agents
├── .claude-plugin/           # Marketplace registry
└── thoughts/                 # Plans, specs, knowledge, ledgers
```

## Plugin Development

### Manifest (plugin.json)

**Supported**: `name`, `version`, `description`, `author`, `skills`, `commands`, `mcpServers`, `lspServers`

**Auto-discovered** (don't declare): `agents/` directory, `hooks/hooks.json`

### Agent Frontmatter

```yaml
---
name: agent-name
description: What it does. Triggers on "keyword", "关键词".
model: sonnet  # sonnet, opus, haiku
color: yellow  # optional
---
```

Invalid fields: `tools: [...]`

### Hooks (hooks.json)

```json
{
  "hooks": {
    "PreToolUse": [{ "matcher": "...", "hooks": [...] }],
    "PostToolUse": [{ "matcher": "...", "hooks": [...] }]
  }
}
```

Must wrap in `"hooks"` object. Input fields: `.tool_name`, `.tool_input.*`

### Hook Scripts

- `set -o pipefail` (NOT `set -eo pipefail`) — `-e` crashes on jq parse errors
- All `jq` calls: `2>/dev/null || echo ""` fallback
- Non-target files: early exit before heavy parsing

### Skills

- SKILL.md < 500 lines
- Frontmatter: `name`, `description` (EN+CN triggers), `allowed-tools`
- Description: `"This skill should be used when..."`

## Version Upgrade

Update these files when bumping version:
- `<plugin>/.claude-plugin/plugin.json`
- `.claude-plugin/marketplace.json`
- `<plugin>/README.md` (badge)

## Compaction

Preserve on compact:
- Modified files list and purposes
- Build commands (`npm run --prefix`, `builtin cd && swift build`)
- Task state and phase progress
- Architectural decisions and verification results

## MCP Servers

| MCP | Plugin | Transport |
|-----|--------|-----------|
| dev-flow | dev-flow | stdio |
| xcode | ios-swift-plugin | stdio (xcrun) |
| apple-docs | ios-swift-plugin | stdio (npx, pinned) |
| sosumi | ios-swift-plugin | HTTP (read-only docs) |
| XcodeBuildMCP | ios-swift-plugin | stdio (external) |
