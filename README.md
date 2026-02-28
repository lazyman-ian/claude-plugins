# lazyman-ian Plugin Directory

Development tools for Claude Code.

> **Important:** Make sure you trust a plugin before installing. These plugins are maintained by lazyman, not Anthropic.

## Plugins

| Plugin | Version | Skills | Cmds | Agents | Description |
|--------|---------|--------|------|--------|-------------|
| [dev-flow](./dev-flow) | 6.1.0 | 22 | 29 | 14 | Workflow: plan → implement → commit → PR → release |
| [ios-swift-plugin](./ios-swift-plugin) | 1.2.0 | 12 | 4 | 3 | iOS/Swift: SwiftUI, Concurrency, Performance, Migration |
| [android-kotlin-plugin](./android-kotlin-plugin) | 1.0.0 | 7 | 2 | 2 | Android/Kotlin: Compose, Coroutines, Architecture |
| [utils](./utils-plugin) | 1.3.0 | 2 | 2 | 0 | Code quality: deslop, search, safety hooks |
| [research](./research-plugin) | 1.3.0 | 3 | 4 | 3 | Research: Perplexity AI, Braintrust, RepoPrompt |

## Installation

In Claude Code:

```
# Add marketplace (one-time)
/plugin marketplace add lazyman-ian/claude-plugins

# Install plugins
/plugin install dev-flow@lazyman-ian
/plugin install ios-swift-plugin@lazyman-ian
/plugin install android-kotlin-plugin@lazyman-ian
/plugin install utils@lazyman-ian
/plugin install research@lazyman-ian
```

See [INSTALL.md](./INSTALL.md) for detailed installation guide.

## Structure

```
claude-plugins/
├── .claude-plugin/
│   └── marketplace.json    # Plugin registry
├── dev-flow/               # Workflow automation (MCP server)
├── ios-swift-plugin/       # iOS/Swift toolkit
├── android-kotlin-plugin/  # Android/Kotlin toolkit
├── utils-plugin/           # Code quality tools
├── research-plugin/        # Research tools
├── thoughts/               # Plans, configs, optimizations
├── CLAUDE.md               # Development guide
└── README.md
```

## Plugin Convention

Each plugin follows this structure:

```
plugin-name/
├── .claude-plugin/plugin.json    # Plugin manifest
├── skills/                        # SKILL.md definitions
├── commands/                      # Command definitions
├── agents/                        # Agent prompts (auto-discovered)
├── hooks/
│   ├── hooks.json                 # Hook config (auto-discovered)
│   └── scripts/                   # Hook shell scripts
└── CLAUDE.md                      # Plugin documentation
```

## Development

See [CLAUDE.md](./CLAUDE.md) for plugin development rules and workflow.

```bash
# MCP Server (dev-flow)
npm install --prefix dev-flow/mcp-server
npm run --prefix dev-flow/mcp-server bundle

# Swift tools (ios-swift-plugin)
builtin cd ios-swift-plugin/tools/ConcurrencyGuard && swift build -c release
```

## License

[MIT](./LICENSE) © lazyman
