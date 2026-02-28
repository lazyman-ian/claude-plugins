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

Detection priority: `.dev-flow.json` > file-based auto-detect.

| Platform | Detection Files | Suggested Config |
|----------|----------------|------------------|
| iOS | `*.xcodeproj`, `Podfile`, `Package.swift` | SwiftLint, SwiftFormat |
| Android | `build.gradle` | ktlint, ktfmt |
| Web | `package.json` | eslint, prettier |
| Python | `pyproject.toml`, `requirements.txt` | ruff, black, mypy |
| Go | `go.mod` | golangci-lint, gofmt |
| Rust | `Cargo.toml` | clippy, rustfmt |

> **Mixed projects**: Use `.dev-flow.json` to explicitly set platform.

### 3. Knowledge Vault Setup

The knowledge vault is automatically created under `thoughts/knowledge/` with subdirectories for different entry types.

### 4. Configuration File (.dev-flow.json)

Write config using detected platform:

```json
{
  "platform": "<detected>",
  "commands": {
    "fix": "<platform-specific>",
    "check": "<platform-specific>"
  },
  "scopes": ["<auto-detected>"],
  "memory": {
    "vault": "thoughts/knowledge"
  }
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

### 5. Install Rules

After platform detection and writing `.dev-flow.json`, auto-install matching rule templates:

Run `/dev rules install` with detected platform. This creates `.claude/rules/dev-flow/` with:
- Always: `coding-style`, `testing`, `git-workflow`, `security`, `performance`, `agent-rules`
- Platform-specific: `coding-style-swift` (iOS), `coding-style-kotlin` (Android), `coding-style-typescript` (Web), `ios-pitfalls` (iOS), `android-pitfalls` (Android)

Rules are namespaced under `.claude/rules/dev-flow/` to avoid conflicts with existing project rules.

### 6. Knowledge Vault Setup (auto)

Immediately after writing `.dev-flow.json`:

**Step 6a**: Create vault directories

```bash
mkdir -p thoughts/knowledge/{pitfalls,patterns,decisions,habits}
```

**Step 6b**: Initialize FTS5 index

```
dev_memory(action="status")
```

Triggers lazy DB schema creation — creates sqlite3 FTS5 index for vault search.

**Output:**

```
🧠 Knowledge vault initialized

✅ Vault: thoughts/knowledge/
✅ FTS5 search index created
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
| `--reindex` | Reindex knowledge vault only (skip platform/directory setup) |
| `--with-keybindings` | Add keybindings to settings.json |

### Vault Reindex (`--reindex`)

Reindexes knowledge vault files into FTS5 without touching other config.

```bash
/dev-flow:init --reindex
```

Flow:
1. Read existing `.dev-flow.json` (must exist, error if not)
2. Run `dev_memory(action="reindex")` to sync vault → FTS5

```
🧠 Knowledge vault reindexed

✅ 12 entries indexed from thoughts/knowledge/
```

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

## Why Init is Required

**`/dev-flow:init` is the ONLY way to initialize a project.** SessionStart will warn if `.dev-flow.json` is missing but will NOT auto-create it.

Without initialization:
- `dev_config` returns generic commands (no platform-specific lint/format)
- `dev_memory` has no knowledge vault (missing `memory.vault` config)
- `dev_defaults` cannot infer scopes (no `scopes` array)
- `/dev commit` quality checks use placeholder commands

**Run `/dev-flow:init` once per project before using any other dev-flow commands.**

**Idempotent Design:** All operations check for existence before creating. Safe to run on projects with:
- Existing `thoughts/` directories (legacy projects)
- Partial initialization (directories exist, config missing)
- Fully initialized projects (no changes made)

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

### Partial Initialization (Legacy Project)
```
Scenario: Project has thoughts/ but missing .dev-flow.json

User: /dev-flow:init
→ Detects existing structure:
   ✓ thoughts/ledgers (5 files)
   ✓ thoughts/handoffs (3 files)
→ Creates missing components:
   + .dev-flow.json (platform: auto-detected)
   + thoughts/.gitignore (if missing)
→ Result: Fully initialized without data loss
```

**Note:** All operations are idempotent - safe to re-run without overwriting existing files.

## Related Commands

- `/dev-flow:start` - Start a new task (creates ledger)
- `/dev-flow:dev` - Check dev workflow status
- `/dev-flow:config-optimize` - Update configuration for latest features
