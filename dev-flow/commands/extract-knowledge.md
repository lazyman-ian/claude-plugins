---
description: Reindex knowledge vault Markdown files into SQLite FTS5 search index
---

# /dev-flow:extract-knowledge - Knowledge Vault Reindex

Reindex Markdown vault files (`thoughts/knowledge/**/*.md`) into the SQLite FTS5 search index.

## Usage

```
/dev-flow:extract-knowledge              # Full reindex
/dev-flow:extract-knowledge --dry-run    # Preview only
```

## Workflow

### Step 1: Check vault status

```
dev_memory(action:"status")
```

Show the current vault stats and entry counts to the user.

### Step 2: Run reindex

```
dev_memory(action:"reindex")
```

This scans all `.md` files in `thoughts/knowledge/{pitfalls,patterns,decisions,habits}/` and updates the SQLite FTS5 index.

### Step 3: Report results

```
dev_memory(action:"status")
```

Show the updated knowledge base status after reindex.

### Step 4: Update MEMORY.md (optional)

If the user's project memory file exists at the auto-memory path, append an `## Auto-indexed` section with today's date and counts.

## Vault Structure

```
thoughts/knowledge/
├── pitfalls/     # Platform-specific bugs and gotchas
├── patterns/     # Reusable code patterns
├── decisions/    # Technical decisions and rationale
└── habits/       # Development habits and preferences
```

Each `.md` file has YAML frontmatter:
```yaml
---
type: pitfall
priority: critical    # critical | important | reference
platform: ios
tags: [concurrency, MainActor]
created: 2026-02-28
access_count: 3
---
```

## Output Format

```
Knowledge Vault Reindex Complete

Platform: ios
Indexed:
- 2 pitfalls
- 1 pattern
- 3 decisions
- 0 habits

Vault: 12 entries total (thoughts/knowledge/)
FTS5 index: synchronized
```

## Arguments

| Arg | Effect |
|-----|--------|
| `--dry-run` | Preview what would be reindexed without making changes |
