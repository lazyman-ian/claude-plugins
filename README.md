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

```bash
# Add marketplace (one-time)
claude marketplace add lazyman-ian https://github.com/lazyman-ian/claude-plugins.git

# Install plugins
claude plugins add dev-flow@lazyman-ian
claude plugins add ios-swift-plugin@lazyman-ian
claude plugins add utils@lazyman-ian
claude plugins add research@lazyman-ian
```

See [INSTALL.md](./INSTALL.md) for detailed installation guide including submodule handling.

## Structure

```
claude-plugins/
├── .claude-plugin/
│   └── marketplace.json    # Plugin registry
├── dev-flow/               # Submodule: workflow automation
├── ios-swift-plugin/       # Submodule: iOS/Swift toolkit
├── utils-plugin/           # Built-in: code quality tools
├── research-plugin/        # Built-in: research tools
├── CLAUDE.md               # Development guide
└── README.md
```

## Development

See [CLAUDE.md](./CLAUDE.md) for plugin development rules and workflow.

## License

[MIT](./LICENSE) © lazyman
