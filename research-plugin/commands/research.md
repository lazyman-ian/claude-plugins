---
description: Research a topic using Perplexity AI
---

Research a topic using Perplexity AI search.

## Instructions

1. **Parse the query**:
   - Quick question → `--ask`
   - Best practices / how-to → `--research`
   - Decision making → `--reason`
   - Deep dive → `--deep`

2. **Execute research**:
   ```bash
   # Quick answer
   uv run python ${CLAUDE_PLUGIN_ROOT}/scripts/perplexity_search.py --ask "query"

   # Research (sonar-pro)
   uv run python ${CLAUDE_PLUGIN_ROOT}/scripts/perplexity_search.py --research "query"

   # Reasoning (chain-of-thought)
   uv run python ${CLAUDE_PLUGIN_ROOT}/scripts/perplexity_search.py --reason "query"

   # Deep research (comprehensive)
   uv run python ${CLAUDE_PLUGIN_ROOT}/scripts/perplexity_search.py --deep "query"
   ```

3. **Format output**:
   ```markdown
   ## Research: [Topic]

   ### Key Findings
   - Finding 1
   - Finding 2

   ### Sources
   - [Source 1](url)
   ```

## Options

| Mode | Use Case | Model |
|------|----------|-------|
| `--ask` | Quick questions | sonar |
| `--research` | General research | sonar-pro |
| `--reason` | Decision support | sonar-reasoning-pro |
| `--deep` | Comprehensive analysis | sonar-deep-research |

## Examples

- `/research best practices for Swift concurrency`
- `/research --reason should I use Core Data or SwiftData`
- `/research --deep state of iOS app architecture 2025`
