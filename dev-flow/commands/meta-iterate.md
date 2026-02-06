---
description: Analyze session performance and iterate agent/skill/rule prompts for continuous improvement
---

# /meta-iterate - Self-Improvement Workflow

Analyze Claude Code session performance and iterate on prompts for continuous improvement.

## Auto Execute

```
1. Parse subcommand (evaluate/diagnose/propose/apply/verify)
2. Check for existing evaluation/diagnosis files
3. Launch appropriate agent based on phase
```

## Subcommands

| Command | Purpose |
|---------|---------|
| `/meta-iterate` | Run full workflow |
| `/meta-iterate evaluate` | Evaluate recent sessions |
| `/meta-iterate discover` | Find new skill opportunities |
| `/meta-iterate diagnose` | Diagnose identified issues |
| `/meta-iterate propose` | Generate improvement proposals |
| `/meta-iterate apply` | Apply approved changes |
| `/meta-iterate verify` | Verify improvement effects |

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `--recent N` | 10 | Sessions to analyze |
| `--target PATH` | all | Specific component |
| `--type TYPE` | all | agent/skill/rule |
| `--threshold N` | 70 | Score threshold |

## Workflow

```
evaluate → diagnose → propose → [approve] → apply → verify
```

Phase 4 (apply) requires explicit user approval before modifying any files.

## Output Locations

| Phase | Output |
|-------|--------|
| Evaluate | `thoughts/evaluations/EVAL-YYYY-MM-DD.json` |
| Discover | `thoughts/discoveries/DISCOVER-YYYY-MM-DD.md` |
| Diagnose | `thoughts/diagnoses/DIAG-YYYY-MM-DD.md` |
| Propose | `thoughts/proposals/PROP-YYYY-MM-DD.md` |
| Apply | `thoughts/iterations/ITER-NNN.md` |

## Data Sources

Priority order (uses first available):

| Priority | Source | Content | When |
|----------|--------|---------|------|
| 1 | Braintrust API | Full session analytics | API available |
| 2 | Local JSONL | `~/.claude/projects/*/*.jsonl` | API unavailable |
| 3 | Git + Ledger | Commit reasoning + task history | Minimal fallback |

### Local Evaluation

When Braintrust is unavailable, uses `~/.claude/scripts/local_evaluate.py`:

```bash
# Direct usage
python ~/.claude/scripts/local_evaluate.py --recent 10

# Output
{
  "data_quality": "local",
  "session_count": 10,
  "tool_distribution": {"Bash": 45, "Read": 30, ...},
  "error_rate": 0.12,
  "patterns": {
    "suggestions": ["High Bash usage (35%). Consider Glob/Read/Grep."]
  }
}
```

## Quick Start

```bash
# Weekly check
/meta-iterate

# Find new skill opportunities
/meta-iterate discover

# Focus on specific component
/meta-iterate --target agents/plan-agent.md

# After applying changes
/meta-iterate verify

# Force local evaluation (skip Braintrust)
/meta-iterate evaluate --local
```
