# Documentation Sources

Dynamic search strategy for Claude Code updates and best practices.

## Search Strategy

**Core principle: Search live, don't maintain static lists.**

Articles become outdated. URLs change. New content appears weekly. Always search dynamically.

### Step 1: GitHub Releases (Always)

```
WebFetch("https://github.com/anthropics/claude-code/releases",
         "Extract new features for versions above {last_checked_version}")
```

### Step 2: Crawl Index Pages (not keyword search)

**Problem**: WebSearch by keywords misses articles. Must crawl index pages for complete listing.

```
# Crawl these index pages to get full article lists:
WebFetch("https://www.anthropic.com/engineering", "List all article titles and URLs")
WebFetch("https://www.anthropic.com/research", "List all article titles and URLs")
WebFetch("https://docs.anthropic.com/en/docs/claude-code", "List all doc page titles and URLs")
```

### Step 3: Filter & Dedup

```
From index crawl results:
1. Filter: keep only Claude Code / agent / coding related articles
2. Dedup: remove URLs already in state.processed_sources
3. Result: unprocessed_articles[] (could be 0 or 20+)
```

### Step 4: Deep-Read Unprocessed (batched)

```
# If unprocessed count > 5, batch in groups of 5 per run
# Priority: newest first (more likely to have new patterns)
For each unprocessed article:
    WebFetch("{url}", "Extract actionable config patterns...")
```

### Step 5: Cross-Reference

Compare extracted patterns against existing rules. Generate gaps.

---

## Search Query Templates

### By Topic

| Topic | Query Template |
|-------|---------------|
| General | `"Claude Code" new features {year}` |
| Agent Teams | `anthropic claude code agent teams parallel` |
| Hooks | `claude code hooks PreToolUse PostToolUse {year}` |
| Skills | `claude code skills development best practices` |
| Context | `claude code context engineering agentic` |
| MCP | `claude code MCP server integration {year}` |

### By Trigger

| Trigger | Search Focus |
|---------|-------------|
| Major version bump | All topics |
| Minor version bump | Release notes only |
| Weekly check | General + blog search |
| User request | User-specified topic |

---

## Known Source Domains

These domains are authoritative (use `site:` filter):

| Domain | Content |
|--------|---------|
| `anthropic.com` | Official blog, docs |
| `github.com/anthropics` | Releases, issues, discussions |
| `docs.anthropic.com` | API/CLI reference |

---

## Extraction Patterns

### From Release Notes

```
Extract:
- Feature: [name]
- Config: [what to change in settings/hooks/rules]
- Files: [affected config files]
- Check: [command to verify adoption]
```

### From Blog Posts

```
Extract:
- Pattern: [best practice name]
- Implementation: [how to configure]
- Anti-pattern: [what to avoid]
- Verification: [how to check compliance]
```

### From Documentation

```
Extract:
- Option: [new setting/field]
- Default: [default value]
- Recommended: [optimal value]
- Migration: [from old pattern to new]
```

---

## State Tracking

After each search run, update state:

```json
{
  "last_checked_version": "2.1.35",
  "last_check_date": "2026-02-08",
  "applied_optimizations": ["agent_type_check", "agent_teams_env"],
  "processed_sources": {
    "anthropic.com/research/building-effective-agents": {
      "date": "2026-02-08",
      "patterns_extracted": 3,
      "rules_updated": ["agentic-coding.md"]
    },
    "anthropic.com/engineering/multi-agent-research": {
      "date": "2026-02-08",
      "patterns_extracted": 2,
      "rules_updated": ["agent-orchestration.md"]
    }
  }
}
```

This enables:
- **Dedup**: Source URL in `processed_sources` → skip (patterns already in rules)
- **Audit**: Track which source informed which rule file
- **Incremental**: Only research new sources, not re-read old ones
- **Token savings**: After 3-4 runs, most sources processed, cost drops to ~5K/run
