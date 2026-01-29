# claude-plugins

Local marketplace for Claude Code plugins.

## Submodules

- `dev-flow` - Development workflow automation
- `ios-swift-plugin` - iOS/Swift toolkit

## Marketplace Sync

After pushing submodule changes:
```bash
# Update marketplace
git -C ~/.claude/plugins/marketplaces/lazyman-ian submodule update --remote

# Clear cache to reload
rm -rf ~/.claude/plugins/cache/lazyman-ian/
```

## Validation

Test plugin before release: `/plugin` to check load status
