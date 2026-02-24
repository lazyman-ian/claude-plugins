# android-kotlin-plugin

Claude Code Android/Kotlin 开发插件。

## Quick Reference

| Action | Command |
|--------|---------|
| 本地测试 | `claude plugins add /path/to/android-kotlin-plugin` |
| 安装 | `claude plugins add android-kotlin-plugin@lazyman-ian` |

## Structure

- `skills/` - 7 个 skills (compose-expert, kotlin-coroutines, android-performance, etc.)
- `commands/` - 2 个命令
- `agents/` - 2 个 agents
- `hooks/` - 1 个 hook (coroutine guard)
- `docs/GUIDE.md` - 中文完整指南
- `docs/android-community-blogs.md` - Android 社区博客索引 (研究用)

## Marketplace

发布到 `lazyman-ian` marketplace:
- 配置: `~/.claude/settings.json` → `enabledPlugins`
- 格式: `"android-kotlin-plugin@lazyman-ian": true`

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

## Android Community Blog Sources

When reference files lack coverage, search these blogs for up-to-date content. Full index: `docs/android-community-blogs.md`

| Topic | Primary Blogs |
|-------|---------------|
| Jetpack Compose | chrisbanes.me, proandroiddev.com, rengwuxian.com |
| Kotlin Coroutines | manuelvivo.dev, elizarov.medium.com, proandroiddev.com |
| Performance | romainguy.dev, androidperformance.com |
| Architecture | android-developers.googleblog.com, proandroiddev.com |
| Build/Gradle | jakewharton.com, zacsweers.dev |
| Weekly Roundup | androidweekly.net, jetc.dev |

## Reference

- dev-flow 插件作为模板参考: `lazyman-ian/dev-flow`
- ios-swift-plugin 作为同类参考: `lazyman-ian/ios-swift-plugin`
