# lazyman-ian Plugin Directory

Development tools for Claude Code.

> **⚠️ Important:** Make sure you trust a plugin before installing. These plugins are maintained by lazyman, not Anthropic.

## Plugins

| Plugin | Description | Version |
|--------|-------------|---------|
| [dev-flow](./dev-flow) | Development workflow: planning → coding → commit → PR → release | 3.12.0 |
| [ios-swift-plugin](./ios-swift-plugin) | iOS/Swift toolkit: SwiftUI, Concurrency, WidgetKit | 1.0.0 |

## Installation

```bash
# Add marketplace (one-time)
claude plugins add-marketplace lazyman-ian --github lazyman-ian/claude-plugins

# Install plugin
claude plugins add dev-flow@lazyman-ian
claude plugins add ios-swift-plugin@lazyman-ian
```

## Structure

```
claude-plugins/
├── .claude-plugin/
│   └── marketplace.json    # Plugin registry
├── dev-flow/               # Submodule: workflow automation
├── ios-swift-plugin/       # Submodule: iOS/Swift toolkit
├── CLAUDE.md               # Development guide
└── README.md
```

## Development

See [CLAUDE.md](./CLAUDE.md) for plugin development rules and workflow.

## License

[MIT](./LICENSE) © lazyman
