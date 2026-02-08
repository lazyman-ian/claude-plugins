---
description: Extract reusable knowledge from current project into cross-project knowledge base
---

# /dev-flow:extract-knowledge - Knowledge Extraction

Extract reusable knowledge from the current project into `~/.claude/knowledge/`.

## Usage

```
/dev-flow:extract-knowledge              # Full extraction
/dev-flow:extract-knowledge --dry-run    # Preview only
```

## Workflow

### Step 1: Preview what will be extracted

```
dev_memory(action:"extract", dryRun:true)
```

Show the counts to the user and confirm before proceeding.

### Step 2: Run extraction

```
dev_memory(action:"extract")
```

### Step 3: Report results

```
dev_memory(action:"status")
```

Show the knowledge base status after extraction.

### Step 4: Update MEMORY.md (optional)

If the user's project memory file exists at the auto-memory path, append an `## Auto-extracted` section with today's date and counts.

## Data Sources

| Source | Extracted Content | Knowledge Type |
|--------|------------------|----------------|
| CLAUDE.md "Known Pitfalls" | Platform-specific bugs | `pitfall` |
| `thoughts/ledgers/*.md` resolved questions | Technical decisions | `decision` |
| `.git/claude/commits/` failed attempts | Anti-patterns | `pattern` |
| `thoughts/shared/handoffs/` errors | Platform pitfalls | `pitfall` |

## Knowledge Destinations

| Type | Location |
|------|----------|
| `pitfall` | `~/.claude/knowledge/platforms/<platform>/pitfalls.md` |
| `pattern` | `~/.claude/knowledge/patterns/<id>.md` |
| `decision` | `~/.claude/knowledge/discoveries/YYYY-MM-DD-<topic>.md` |

## Output Format

```
Knowledge Extraction Complete

Platform: ios
Extracted:
- 2 pitfalls → platforms/ios/pitfalls.md
- 1 pattern → patterns/
- 3 decisions → discoveries/
- 0 skipped (duplicates)

Knowledge base: 12 entries total
```

## Arguments

| Arg | Effect |
|-----|--------|
| `--dry-run` | Pass `dryRun: true` to `dev_memory(action:"extract")` |
| `--type pitfalls` | Only extract pitfall type (future) |
