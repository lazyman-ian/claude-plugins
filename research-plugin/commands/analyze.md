---
description: Analyze Claude Code sessions from Braintrust
---

Analyze session data from Braintrust logs.

## Instructions

1. **Identify analysis type**:
   - Last session overview → `--last-session`
   - Recent sessions list → `--sessions N`
   - Loop detection → `--detect-loops`
   - Extract learnings → `--learn`
   - Weekly trends → `--weekly-summary`

2. **Execute analysis**:
   ```bash
   # Last session
   uv run python ${CLAUDE_PLUGIN_ROOT}/scripts/braintrust_analyze.py --last-session

   # List sessions
   uv run python ${CLAUDE_PLUGIN_ROOT}/scripts/braintrust_analyze.py --sessions 5

   # Detect loops
   uv run python ${CLAUDE_PLUGIN_ROOT}/scripts/braintrust_analyze.py --detect-loops

   # Extract learnings
   uv run python ${CLAUDE_PLUGIN_ROOT}/scripts/braintrust_analyze.py --learn

   # Weekly summary
   uv run python ${CLAUDE_PLUGIN_ROOT}/scripts/braintrust_analyze.py --weekly-summary

   # Token trends
   uv run python ${CLAUDE_PLUGIN_ROOT}/scripts/braintrust_analyze.py --token-trends

   # Replay session
   uv run python ${CLAUDE_PLUGIN_ROOT}/scripts/braintrust_analyze.py --replay <session-id>
   ```

3. **Present findings** in markdown format.

## Options

| Option | Description |
|--------|-------------|
| `--last-session` | Analyze most recent session |
| `--sessions N` | List last N sessions |
| `--detect-loops` | Find repeated tool calls |
| `--learn` | Extract learnings from session |
| `--weekly-summary` | Weekly activity summary |
| `--token-trends` | Token usage over time |
| `--replay ID` | Replay specific session |
| `--agent-stats` | Agent usage statistics |

## Examples

- `/analyze` - Analyze last session
- `/analyze loops` - Detect potential loops
- `/analyze weekly` - Weekly summary
- `/analyze learn` - Extract learnings
