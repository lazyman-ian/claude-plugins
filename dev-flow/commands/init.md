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

### 3. Configuration File (.dev-flow.json)

Optional custom configuration. The `platform` field affects `dev_config`, knowledge injection, and `dev_memory` classification:

```json
{
  "platform": "python",
  "commands": {
    "fix": "black . && ruff check --fix .",
    "check": "ruff check . && mypy .",
    "test": "pytest -x",
    "verify": "ruff check . && mypy . && pytest -x"
  },
  "scopes": ["api", "models", "utils", "tests"],
  "memory": {
    "tier": 0
  }
}
```

**`memory` 字段必须包含**，否则知识系统不生效。Tier 说明见 CLAUDE.md "Knowledge System" 章节。

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

### 4. Memory Tier Setup (post-init)

After creating `.dev-flow.json`, automatically validate the selected memory tier:

```
dev_memory(action="status")
```

This triggers lazy DB creation (`ensureDbSchema`) and reports current state.

**Tier-specific checks:**

| Tier | Check | Auto-action |
|------|-------|-------------|
| 0 | `which sqlite3` | None needed (system tool) |
| 1 | `sqlite3` + `ANTHROPIC_API_KEY` | Warn if key missing (heuristic fallback OK) |
| 2 | Tier 1 + `chromadb` npm package | Install if missing (see below) |
| 3 | Tier 2 + observation hooks active | Same as Tier 2 |

**ChromaDB auto-install (Tier 2+):**

```bash
# Check if chromadb is importable from MCP server context
node -e "require('chromadb')" 2>/dev/null
# If not found:
npm install --prefix ${CLAUDE_PLUGIN_ROOT}/mcp-server chromadb
npm run --prefix ${CLAUDE_PLUGIN_ROOT}/mcp-server bundle
```

> If `CLAUDE_PLUGIN_ROOT` is unavailable (non-plugin install), guide user to install globally: `npm install -g chromadb`

**Output example (Tier 2):**

```
🧠 Memory: Tier 2

✅ sqlite3 3.51.0 (FTS5 supported)
✅ Knowledge DB: .claude/cache/artifact-index/context.db (created)
⚠️ ANTHROPIC_API_KEY not set — session summaries use heuristic fallback
📦 Installing chromadb... done
✅ ChromaDB: semantic search enabled

Memory ready. Knowledge persists across sessions.
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

## Why Init is Required

**`/dev-flow:init` is the ONLY way to initialize a project.** SessionStart will warn if `.dev-flow.json` is missing but will NOT auto-create it.

Without initialization:
- `dev_config` returns generic commands (no platform-specific lint/format)
- `dev_memory` has no knowledge system (missing `memory.tier` config)
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
