# lazyman-ian Plugin Directory

Development tools for Claude Code.

> **⚠️ Important:** Make sure you trust a plugin before installing. These plugins are maintained by lazyman, not Anthropic.

## Plugins

| Plugin | Description | Version |
|--------|-------------|---------|
| [dev-flow](./dev-flow) | Development workflow: planning → coding → commit → PR → release | 3.14.0 |
| [ios-swift-plugin](./ios-swift-plugin) | iOS/Swift toolkit: SwiftUI, Concurrency, WidgetKit | 1.1.0 |
| [utils](./utils-plugin) | Code quality: deslop, search-code, safety hooks | 1.3.0 |
| [research](./research-plugin) | Research: Perplexity AI, Braintrust, RepoPrompt | 1.3.0 |

## Installation

In Claude Code:

```
# Add marketplace (one-time)
/plugin marketplace add lazyman-ian/claude-plugins

# Install plugins
/plugin install dev-flow@lazyman-ian
/plugin install ios-swift-plugin@lazyman-ian
/plugin install utils@lazyman-ian
/plugin install research@lazyman-ian
```

See [INSTALL.md](./INSTALL.md) for detailed installation guide.

## Structure

```
claude-plugins/
├── .claude-plugin/
│   └── marketplace.json    # Plugin registry
├── dev-flow/               # Workflow automation
├── ios-swift-plugin/       # iOS/Swift toolkit
├── utils-plugin/           # Built-in: code quality tools
├── research-plugin/        # Built-in: research tools
├── CLAUDE.md               # Development guide
└── README.md
```

## Development

See [CLAUDE.md](./CLAUDE.md) for plugin development rules and workflow.

## License

[MIT](./LICENSE) © lazyman
