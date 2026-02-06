---
description: Initialize dev-flow project structure and configuration
---

# /dev-flow:init - Project Initialization

Initialize dev-flow directory structure and platform-specific configuration.

## What Gets Created

### 1. Directory Structure
```
<project-root>/
├── thoughts/
│   ├── ledgers/          # Task continuity tracking
│   ├── handoffs/         # Agent handoff documents
│   ├── plans/            # Implementation plans
│   └── shared/
│       └── plans/        # Shared plans
└── .dev-flow.json        # Project configuration (optional)
```

### 2. Platform Detection

Auto-detects project type and suggests configuration:

| Platform | Detection Files | Suggested Config |
|----------|----------------|------------------|
| iOS | `*.xcodeproj`, `Podfile` | SwiftLint, SwiftFormat |
| Android | `build.gradle`, `AndroidManifest.xml` | ktlint, ktfmt |
| Python | `pyproject.toml`, `requirements.txt` | ruff, black, mypy |
| Node | `package.json` | eslint, prettier |
| Go | `go.mod` | golangci-lint, gofmt |
| Rust | `Cargo.toml` | clippy, rustfmt |

### 3. Configuration File (.dev-flow.json)

Optional custom configuration:

```json
{
  "platform": "python",
  "commands": {
    "fix": "black . && ruff check --fix .",
    "check": "ruff check . && mypy .",
    "test": "pytest -x",
    "verify": "ruff check . && mypy . && pytest -x"
  },
  "scopes": ["api", "models", "utils", "tests"]
}
```

## Usage

```bash
/dev-flow:init                  # Interactive setup
/dev-flow:init --platform ios   # Skip detection, use specific platform
/dev-flow:init --minimal        # Only create directories, no config
```

## Output

### Success
```
✅ dev-flow initialized

📦 Platform: iOS (detected)
📁 Directories created:
   ├── thoughts/ledgers
   ├── thoughts/handoffs
   ├── thoughts/plans
   └── thoughts/shared/plans

⚙️  Detected tools:
   ├── Lint: swiftlint
   ├── Format: swiftformat
   └── Build: xcodebuild

💡 Quick start:
   1. Run `/dev-flow:start` to begin a new task
   2. Make changes and commit with `/dev-flow:commit`
   3. Create PR with `/dev-flow:pr`

📚 See CLAUDE.md for full workflow guide
```

### Already Initialized
```
ℹ️  dev-flow already initialized

📁 Existing structure:
   ✓ thoughts/ledgers (3 files)
   ✓ thoughts/handoffs (12 files)
   ✓ thoughts/plans (1 file)
   ✓ .dev-flow.json

Run `/dev-flow:init --force` to reinitialize
```

## Options

| Option | Description |
|--------|-------------|
| `--platform <name>` | Skip detection, use specified platform |
| `--minimal` | Only create directories, no config |
| `--force` | Reinitialize even if already exists |
| `--with-keybindings` | Add keybindings to settings.json |

## Keybindings Setup

If you use `--with-keybindings`, adds to `~/.claude/settings.json`:

```json
{
  "keybindings": [
    { "key": "ctrl+d ctrl+s", "command": "/dev-flow:dev" },
    { "key": "ctrl+d ctrl+c", "command": "/dev-flow:commit" },
    { "key": "ctrl+d ctrl+p", "command": "/dev-flow:pr" },
    { "key": "ctrl+d ctrl+r", "command": "/dev-flow:release" },
    { "key": "ctrl+d ctrl+t", "command": "/dev-flow:tasks" }
  ]
}
```

**Keybinding Prefix**: `ctrl+d` (dev-flow prefix)

## Setup Hook Integration

This command can also be triggered by the Setup hook:

```json
{
  "hooks": {
    "Setup": [{
      "matcher": "init",
      "hooks": [{
        "type": "command",
        "command": "$HOME/.claude/hooks/setup-init.sh",
        "timeout": 30
      }]
    }]
  }
}
```

## Examples

### New iOS Project
```
User: /dev-flow:init
→ Detects iOS project
→ Creates thoughts/ structure
→ Suggests SwiftLint/SwiftFormat config
```

### Custom Python Project
```
User: /dev-flow:init --platform python
→ Creates thoughts/ structure
→ Creates .dev-flow.json with ruff/black/mypy
→ Adds suggested scopes
```

### Minimal Setup
```
User: /dev-flow:init --minimal
→ Only creates thoughts/ directories
→ No config file
→ No platform detection
```

## Related Commands

- `/dev-flow:start` - Start a new task (creates ledger)
- `/dev-flow:dev` - Check dev workflow status
- `/dev-flow:config-optimize` - Update configuration for latest features
