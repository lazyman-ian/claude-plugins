# ios-swift-plugin

Claude Code iOS/Swift 开发插件。

## Quick Reference

| Action | Command |
|--------|---------|
| 本地测试 | `claude plugins add /path/to/ios-swift-plugin` |
| 安装 | `claude plugins add ios-swift-plugin@lazyman-ian` |

## Structure

- `skills/` - 16 个 skills (swiftui-expert, swift-concurrency, swift-testing, swift-6-guide, ios-modern-apis, xcode-build-config, etc.)
- `commands/` - 4 个命令
- `agents/` - 3 个 agents (concurrency-reviewer, migration-scanner, swift-testing-reviewer)
- `hooks/` - 2 个 hooks
- `docs/GUIDE.md` - 中文完整指南
- `docs/ios-community-blogs.md` - iOS 社区博客索引 (研究用)

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

## iOS Community Blog Sources

When reference files lack coverage, search these blogs for up-to-date content. Full index: `docs/ios-community-blogs.md`

| Topic | Primary Blogs |
|-------|---------------|
| SwiftUI | avanderlee.com, swiftwithmajid.com, onevcat.com |
| Swift Concurrency | massicotte.org, alexdremov.me, donnywals.com |
| Performance (system) | blog.ibireme.com, ming1016.github.io, emergetools.com/blog |
| SwiftData / Core Data | fatbobman.com, donnywals.com |
| Swift Testing | steipete.me, fatbobman.com, avanderlee.com |
| @Observable | avanderlee.com, jessesquires.com |
| Architecture | nalexn.github.io, casatwy.com |
| Weekly roundup | mjtsai.com/blog, iosdevweekly.com |

## Reference

- dev-flow 插件作为模板参考: `lazyman-ian/dev-flow`
- README/GUIDE 格式参考 dev-flow
