<p align="center">
  <img src="https://developer.apple.com/assets/elements/icons/swift/swift-96x96_2x.png" alt="ios-swift-plugin" width="96" height="96">
</p>

<h1 align="center">ios-swift-plugin</h1>

<p align="center">
  <strong>iOS/Swift Development Toolkit for Claude Code</strong>
</p>

<p align="center">
  SwiftUI • Swift Concurrency • WidgetKit • Performance
</p>

<p align="center">
  <a href="#installation">Installation</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#skills">Skills</a> •
  <a href="#commands">Commands</a> •
  <a href="#contributing">Contributing</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.3.0-blue.svg" alt="Version">
  <img src="https://img.shields.io/badge/Claude_Code-2.1.19+-purple.svg" alt="Claude Code">
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License">
  <img src="https://img.shields.io/badge/skills-16-brightgreen.svg" alt="Skills">
  <img src="https://img.shields.io/badge/platforms-iOS%20%7C%20macOS-orange.svg" alt="Platforms">
</p>

<p align="center">
  <a href="./docs/GUIDE.md">中文指南</a>
</p>

---

## Features

| Feature | Description |
|---------|-------------|
| **SwiftUI Expert** | Best practices, modern APIs, view composition |
| **Swift Concurrency** | async/await, actors, Sendable, Swift 6 migration |
| **WidgetKit** | Timeline Providers, Live Activities, App Intents |
| **Performance** | Audit, diagnosis, optimization patterns |
| **Build & Test** | Token-efficient xcodebuild commands |
| **Apple Docs** | Integrated documentation lookup |
| **Liquid Glass** | iOS 26+ glassmorphism effects |
| **macOS Packaging** | SwiftPM app bundling and notarization |

## Installation

### From Marketplace

```
# Add marketplace (one-time)
/plugin marketplace add lazyman-ian/claude-plugins

# Install plugin
/plugin install ios-swift-plugin@lazyman-ian
```

### From Local Directory

```bash
# Development mode
claude --plugin-dir /path/to/ios-swift-plugin
```

See [INSTALL.md](../INSTALL.md) for detailed installation guide.

### Verify

```bash
/plugin  # Check plugin load status
```

## Quick Start

```bash
# 1. Build and test iOS project
/ios-build-test build MyApp

# 2. Get SwiftUI guidance
/swiftui-expert "How to implement pull-to-refresh?"

# 3. Check Swift Concurrency
/swift-concurrency "Fix Sendable warning"

# 4. Create widget
/ios-widget-developer "Timeline provider for weather"
```

## Skills

### Skills (16)

| Skill | Description | Trigger Keywords |
|-------|-------------|------------------|
| **swiftui-expert** | View composition, state management, modern APIs | SwiftUI, @State, NavigationStack |
| **swift-concurrency** | async/await, actors, Sendable, Swift 6 | async, actor, Sendable, concurrency |
| **swift-6-guide** | Swift 6 strict concurrency migration | Swift 6, strict concurrency |
| **swift-testing** | Swift Testing framework patterns | @Test, #expect, Swift Testing |
| **ios-build-test** | Token-efficient build and test | build, test, xcodebuild |
| **ios-api-helper** | Apple documentation lookup | iOS API, how to implement |
| **ios-widget-developer** | WidgetKit, Live Activities | widget, Timeline, Live Activity |
| **ios-debugger** | Simulator debugging, UI interaction | run app, simulator, debug |
| **ios-ui-docs** | UIKit components, Auto Layout | UIButton, UITableView, Auto Layout |
| **ios-modern-apis** | iOS 17+/18+ new APIs adoption | iOS 17, iOS 18, new API |
| **ios-migration-advisor** | SDK/API migration guidance | migrate, deprecation, upgrade |
| **ios-performance-guide** | Performance diagnosis and optimization | performance, slow, battery |
| **xcode-build-config** | Build settings and configuration | build config, scheme, target |
| **swiftui-liquid-glass** | iOS 26+ Liquid Glass API | Liquid Glass, glassEffect |
| **swiftui-performance-audit** | SwiftUI performance audit | janky, laggy, SwiftUI perf |
| **macos-spm-app-packaging** | SwiftPM app bundling | SwiftPM app, notarize |

<details>
<summary><strong>Skill Details</strong></summary>

### swiftui-expert
- View structure and composition
- State management (@State, @Observable, @Environment)
- Navigation patterns (NavigationStack, sheets)
- List/Grid/ScrollView optimization
- Modern APIs (iOS 17+)

### swift-concurrency
- async/await basics and advanced patterns
- Actor isolation and @MainActor
- Sendable conformance
- Task management
- Swift 6 migration guide
- Performance optimization

### ios-widget-developer
- Timeline Provider implementation
- Widget configuration
- Live Activities
- App Intents integration
- Debugging techniques

</details>

## Commands

| Command | Description |
|---------|-------------|
| `/swift-audit [path]` | Scan for concurrency violations |
| `/xcode-test [scheme]` | Quick build and test |
| `/swift-fix-issue <number>` | End-to-end GitHub issue resolution |
| `/app-changelog [from-tag]` | Generate release notes from git |

## Agents

| Agent | Trigger | Description |
|-------|---------|-------------|
| **concurrency-reviewer** | PostToolUse (Swift files) | Auto-analyzes for concurrency issues |
| **performance-auditor** | PostToolUse (SwiftUI files) | Auto-checks performance patterns |
| **migration-scanner** | On request | Finds deprecated APIs and migration paths |
| **swift-testing-reviewer** | PostToolUse (test files) | Reviews Swift Testing patterns |

## Hooks

| Hook | Type | Description |
|------|------|-------------|
| **ConcurrencyGuard** | PreToolUse (blocking) | Blocks concurrency anti-patterns |
| **SwiftValidator** | PostToolUse (async) | Analyzes Swift files after edits |

### Concurrency Rules Enforced

| Code | Rule |
|------|------|
| CC-CONC-001 | Prohibits `Task.detached` |
| CC-CONC-002 | Blocks `Task {}` in initializers |
| CC-CONC-003 | Prevents `Task {}` in render/layout paths |
| CC-CONC-004 | Requires `onTermination` for AsyncStream |
| CC-CONC-005 | Limits concurrent tasks (max 3 per function) |
| CC-CONC-008 | Forbids `.background` priority for `for await` |

## Architecture

```
ios-swift-plugin/
├── .claude-plugin/plugin.json   # Plugin manifest
├── skills/                      # 16 skills
│   ├── swiftui-expert/          # SwiftUI best practices
│   │   ├── SKILL.md
│   │   └── references/          # 30+ reference docs
│   ├── swift-concurrency/       # Concurrency patterns
│   │   ├── SKILL.md
│   │   └── references/          # 18 reference docs
│   ├── ios-widget-developer/    # WidgetKit development
│   │   ├── SKILL.md
│   │   ├── references/
│   │   └── examples/
│   ├── ios-build-test/          # Build commands
│   ├── ios-api-helper/          # API lookup
│   ├── ios-debugger/            # Simulator debugging
│   ├── ios-ui-docs/             # UIKit docs
│   ├── swiftui-liquid-glass/    # Liquid Glass
│   ├── swiftui-performance-audit/
│   └── macos-spm-app-packaging/
├── commands/                    # 4 commands
├── agents/                      # 4 agents
├── hooks/                       # 2 hooks
└── tools/
    └── ConcurrencyGuard/        # SwiftSyntax analyzer
```

## Prerequisites

- **Xcode** - Required for build/test commands

### Optional MCP Servers

| MCP | Purpose | Install |
|-----|---------|---------|
| `apple-docs` | Symbol/API lookup | `npx apple-doc-mcp-server@latest` |
| `sosumi` | Full docs, HIG guidelines | HTTP: `https://sosumi.ai/mcp` |
| `XcodeBuildMCP` | Simulator control | `npm install -g @anthropic/xcodebuild-mcp` |

See [GUIDE.md](./docs/GUIDE.md#可选依赖) for configuration details.

## ConcurrencyGuard Setup

Build the SwiftSyntax-based static analyzer:

```bash
cd tools/ConcurrencyGuard
swift build -c release
```

The hook will automatically use the built binary.

## Contributing

Contributions are welcome!

### Development

```bash
# Clone
git clone https://github.com/lazyman-ian/ios-swift-plugin.git
cd ios-swift-plugin

# Test locally
/plugin marketplace add ./ios-swift-plugin
/plugin install ios-swift-plugin@ios-swift-plugin

# Validate plugin structure
/plugin validate .
```

### Ideas

- [ ] SwiftData skill
- [ ] TCA (The Composable Architecture) patterns
- [ ] Combine framework guidance
- [ ] Core Data migration helpers

## License

[MIT](./LICENSE) © lazyman

---

<p align="center">
  <sub>Built with Claude Code</sub>
</p>
