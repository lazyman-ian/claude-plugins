# Local Mode (No External Dependencies)

When Braintrust is unavailable (missing Python modules, API issues, network), use local data sources.

## Quick Check

```bash
# Test Braintrust availability
uv run python -c "import requests" 2>/dev/null && echo "BRAINTRUST_OK" || echo "LOCAL_MODE"
```

## Local Data Sources

| Source | Location | Contains | Extraction |
|--------|----------|----------|------------|
| Session JSONL | `~/.claude/projects/<proj>/*.jsonl` | Full transcripts | `jq` parsing |
| Session index | `~/.claude/projects/<proj>/session-index` | Metadata | `jq .sessions` |
| Stats cache | `~/.claude/projects/<proj>/stats-cache` | Token usage | `jq .sessions` |
| Commit reasoning | `.git/claude/commits/*/reasoning.md` | Decisions | Read directly |
| Ledgers | `thoughts/ledgers/` | Task completion | Read directly |

## Local Workflow

```
[local evaluate] -> diagnose -> propose -> [approve] -> apply -> verify
```

The evaluate phase uses local session JSONL files instead of Braintrust API.
Mark evaluation with `data_quality: "local"` to indicate limited data fidelity.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `requests module not installed` | Use Local Mode OR run `uv pip install requests` |
| `aiohttp not found` | Use Local Mode OR run `uv pip install aiohttp` |
| Braintrust API timeout | Use Local Mode (local files don't require network) |
| Empty evaluation results | Check `~/.claude/projects/` for session files |

**Tip**: Local Mode provides ~80% of evaluation quality for most use cases.
