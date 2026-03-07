---
name: sync-codex
description: >-
  Sync Claude Code configurations to Codex CLI format. Creates .agents/skills/ symlinks,
  generates AGENTS.md with behavioral rules, .codex/config.toml, .codex/rules/safety.rules,
  and optionally ~/.codex/AGENTS.md from global rules.
  Triggers on "sync codex", "codex sync", "update codex config", "generate codex",
  "同步 codex", "codex 同步", "生成 codex 配置".
  Do NOT use for Cursor — Cursor natively reads Claude configs without sync.
allowed-tools: [Bash, Read]
---

## Modes

### Marketplace (default in plugin repo)

```bash
bash scripts/sync-codex.sh                # Scan local plugin dirs
bash scripts/sync-codex.sh --dry-run      # Preview changes
bash scripts/sync-codex.sh --verbose      # Detailed output
bash scripts/sync-codex.sh --clean        # Clean and regenerate
bash scripts/sync-codex.sh --with-global  # Also compile global rules
```

### Project (any project with Claude Code plugins)

```bash
bash sync-codex.sh --project              # Scan installed plugins from cache
bash sync-codex.sh --project --with-global # Include global rules
```

Auto-detects mode when flag is omitted (marketplace if `.claude-plugin/marketplace.json` exists).

## What Gets Generated

| Output | Scope | Marketplace | Project |
|--------|-------|-------------|---------|
| `~/.agents/skills/*` | User | Plugin `*/skills/` symlinks | Installed plugin cache symlinks |
| `.agents/skills/*` | Project | `.claude/skills/` symlinks | `.claude/skills/` symlinks |
| `AGENTS.md` | Project | Info + catalog + behavioral rules | Rules + catalog + behavioral rules |
| `.codex/config.toml` | Project | Hardcoded MCP + agents | Parsed from `.mcp.json` + agents |
| `.codex/rules/safety.rules` | Project | 6 Starlark safety rules | Same |
| `~/.codex/AGENTS.md` | User | Global behavioral rules (10/17) | Same (`--with-global`) |

## Behavioral Rules

AGENTS.md includes a behavioral rules section that maps Claude hook behaviors to Codex soft constraints:
- Shell safety (alias bypass)
- Commit workflow (guard against raw git commit)
- Tool usage preferences
- Session discipline (ledger, knowledge vault, formatter)
- Code quality standards

## Global Rules

`--with-global` compiles `~/.claude/rules/*.md` → `~/.codex/AGENTS.md`:
- 10 rules included (avoid-ai-slop, continuity, failure-detection, etc.)
- 7 Claude-specific rules skipped (hooks, plan-routing, dev-workflow, etc.)

## When to Run

- After adding/removing skills or agents
- After modifying CLAUDE.md or `.claude/rules/`
- After updating installed plugins or global rules

## Design

- **Source of truth**: Claude Code configs only
- **Idempotent**: Safe to run repeatedly
- **Cursor**: Not needed — Cursor natively reads `.claude/` directories
