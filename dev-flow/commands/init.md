---
description: Initialize dev-flow project structure and configuration
---

# /dev-flow:init - Project Initialization

Initialize dev-flow directory structure and platform-specific configuration.

## What Gets Created

```
<project-root>/
├── thoughts/
│   ├── ledgers/          # Task continuity tracking
│   ├── handoffs/         # Agent handoff documents
│   ├── plans/            # Implementation plans
│   ├── shared/plans/     # Shared plans
│   └── knowledge/        # Knowledge vault (FTS5 indexed)
│       ├── pitfalls/
│       ├── patterns/
│       ├── decisions/
│       └── habits/
├── docs/                 # Project documentation (@import)
│   ├── glossary.md       # 术语表
│   ├── toolbox.md        # 接口与工具
│   ├── skills.md         # 技能清单
│   ├── memory.md         # 任务记录
│   └── decisions.md      # 决策日志 (ADR)
├── .claude/rules/dev-flow/  # Platform-aware rules
└── .dev-flow.json        # Project configuration
```

## Steps

### 1. Platform Detection

Detection priority: `.dev-flow.json` > file-based auto-detect.

| Platform | Detection Files | Lint | Format |
|----------|----------------|------|--------|
| iOS | `*.xcodeproj`, `Podfile`, `Package.swift` | SwiftLint | SwiftFormat |
| Android | `build.gradle` | ktlint | ktfmt |
| Web | `package.json` | eslint | prettier |
| Python | `pyproject.toml`, `requirements.txt` | ruff, mypy | black |
| Go | `go.mod` | golangci-lint | gofmt |
| Rust | `Cargo.toml` | clippy | rustfmt |

Mixed projects: use `.dev-flow.json` to set platform explicitly.

### 2. Write Configuration

```json
{
  "platform": "<detected>",
  "commands": {
    "fix": "<platform-specific>",
    "check": "<platform-specific>"
  },
  "scopes": ["<auto-detected>"],
  "memory": { "vault": "thoughts/knowledge" }
}
```

### 3. Install Rules

Run `/dev rules install` with detected platform. Creates `.claude/rules/dev-flow/`:
- Always: `coding-style`, `testing`, `git-workflow`, `security`, `performance`, `agent-rules`, `docs-maintenance`
- Platform-specific: `coding-style-swift` (iOS), `coding-style-kotlin` (Android), `coding-style-typescript` (Web), `ios-pitfalls` (iOS), `android-pitfalls` (Android)

### 4. Docs Scaffolding

Copy templates from `${CLAUDE_PLUGIN_ROOT}/templates/docs/` into `docs/` (idempotent). Scan the project and populate with project-specific content.

Append `@docs/` references to `CLAUDE.md` if not already present:

```markdown
## Docs
- @docs/glossary.md — 术语表
- @docs/toolbox.md — 接口与工具
- @docs/skills.md — 技能清单
- @docs/memory.md — 任务记录
- @docs/decisions.md — 决策日志 (ADR)
```

**Hooks auto-installed:** `docs-lint` (warn CLAUDE.md > 200 lines), `docs-reminder` (remind toolbox update on new API files).

### 5. CLAUDE.md Optimization

**No CLAUDE.md**: Create from `${CLAUDE_PLUGIN_ROOT}/templates/docs/CLAUDE.md.template` (target: 50-80 lines).

**Existing CLAUDE.md**: Audit and trim:

| Check | Action |
|-------|--------|
| > 200 lines | Move verbose sections to `docs/` |
| No Quick Reference | Add command table at top |
| No `@docs/` imports | Add import section |
| Code style rules | Remove (belongs in linter) |
| One-time patterns | Move to `docs/decisions.md` |

### 6. Knowledge Vault

Create `thoughts/knowledge/{pitfalls,patterns,decisions,habits}/` directories, then `dev_memory(action="status")` to initialize FTS5 index.

## Options

| Option | Description |
|--------|-------------|
| `--platform <name>` | Skip detection, use specified platform |
| `--minimal` | Only create directories, no config, no docs |
| `--no-docs` | Skip docs scaffolding and CLAUDE.md optimization |
| `--force` | Reinitialize even if already exists |
| `--reindex` | Reindex knowledge vault FTS5 only (`dev_memory(action="reindex")`) |
| `--with-keybindings` | Add `ctrl+d` chord keybindings to settings.json (see `docs/keybindings.md`) |

## Output

```
✅ dev-flow initialized

📦 Platform: iOS (detected)
📁 Structure: thoughts/, docs/, .claude/rules/dev-flow/
⚙️  Tools: swiftlint, swiftformat, xcodebuild
🧠 Knowledge vault: FTS5 indexed

💡 Next: /dev-flow:start → /dev-flow:commit → /dev-flow:pr
```

If already initialized, reports existing structure and suggests `--force` to reinitialize.

## Example

```
User: /dev-flow:init --platform python
→ Creates thoughts/ + docs/ + .claude/rules/dev-flow/
→ .dev-flow.json with ruff/black/mypy
→ CLAUDE.md created from template
→ Knowledge vault initialized
```

**Idempotent**: safe to re-run. Existing files are never overwritten.

## Related

- `/dev-flow:start` - Start a new task
- `/dev-flow:dev` - Check workflow status
- `/dev-flow:config-optimize` - Update for latest features
