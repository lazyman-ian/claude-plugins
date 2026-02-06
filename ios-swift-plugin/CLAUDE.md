# ios-swift-plugin

Claude Code iOS/Swift 开发插件。

## Quick Reference

| Action | Command |
|--------|---------|
| 本地测试 | `claude plugins add /path/to/ios-swift-plugin` |
| 安装 | `claude plugins add ios-swift-plugin@lazyman-ian` |

## Structure

- `skills/` - 10 个 skills (swiftui-expert, swift-concurrency, etc.)
- `commands/` - 4 个命令
- `agents/` - 2 个 agents
- `hooks/` - 2 个 hooks
- `docs/GUIDE.md` - 中文完整指南

## Marketplace

发布到 `lazyman-ian` marketplace:
- 配置: `~/.claude/settings.json` → `enabledPlugins`
- 格式: `"ios-swift-plugin@lazyman-ian": true`

## Agent Frontmatter

Valid fields:
- `name`, `description` - required
- `model` - `sonnet`, `opus`, `haiku` (NOT `inherit`)
- `color` - optional

**Invalid fields**: `tools: [...]` (not supported)

## Plugin Manifest Rules

Auto-discovered (don't declare in plugin.json):
- `agents/` directory
- `hooks/hooks.json`

## Reference

- dev-flow 插件作为模板参考: `lazyman-ian/dev-flow`
- README/GUIDE 格式参考 dev-flow
