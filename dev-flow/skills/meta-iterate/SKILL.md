---
name: meta-iterate
description: Analyzes session performance and iterates agent/skill/rule prompts for self-improvement, and provides skill development guidance. This skill should be used when user says "improve prompts", "analyze sessions", "self-improve", "discover skills", "compound learnings", "learn from sessions", "优化工作流", "迭代agent", "分析session", "发现新skill", "积累经验", "学习总结", "提取规则", or when developing skills with "write skill", "create skill", "开发 skill", "插件开发", "skill development". Triggers on /meta-iterate, 自我改进, 会话分析, prompt优化, skill开发.
model: opus
memory: user
context: fork
allowed-tools: [Read, Glob, Grep, Write, Edit, Bash, WebSearch, Task, TaskCreate, TaskUpdate, TaskList, AskUserQuestion]
---

# meta-iterate - Self-Improvement & Skill Development

Analyze Claude Code session performance, iterate on prompts, and guide skill/plugin development.

## When to Use

### Self-Improvement Mode
- Periodically evaluate workflow effectiveness
- After noticing repeated issues
- When prompted by session-end reminder (every 10 sessions)
- To proactively improve Claude capabilities
- To compound learnings into permanent artifacts

### Skill Development Mode
- Creating new skills
- Improving existing skills
- Developing plugins
- Auditing skill quality

## Commands

### Self-Improvement Commands

| Command | Purpose |
|---------|---------|
| `/meta-iterate` | Run full 5-phase workflow |
| `/meta-iterate evaluate` | Only evaluate sessions |
| `/meta-iterate discover` | Discover new skill opportunities |
| `/meta-iterate compound` | Transform learnings into skills/rules |
| `/meta-iterate diagnose` | Only diagnose issues |
| `/meta-iterate propose` | Only generate proposals |
| `/meta-iterate apply` | Apply approved changes |
| `/meta-iterate verify` | Verify improvement effects |

### Skill Development Commands

| Command | Purpose |
|---------|---------|
| `/meta-iterate skill-create` | Create new skill from template |
| `/meta-iterate skill-audit` | Audit existing skill quality |
| `/meta-iterate skill-improve` | Improve specific skill |

## Workflows

### Self-Improvement Workflow

```
evaluate → discover/compound (optional) → diagnose → propose → [approve] → apply → verify
```

| Phase | Input | Output | Agent |
|-------|-------|--------|-------|
| **evaluate** | Braintrust logs | `EVAL-<date>.json` | evaluate-agent |
| **discover** | Evaluation data | `DISCOVER-<date>.md` | (built-in) |
| **compound** | Learnings files | Artifacts proposal | (built-in) |
| **diagnose** | Evaluation | `DIAG-<date>.md` | diagnose-agent |
| **propose** | Diagnosis | `PROP-<date>.md` | propose-agent |
| **apply** | Proposals + approval | Component files | apply-agent |
| **verify** | Post-change sessions | `ITER-NNN.md` | verify-agent |

### Skill Development Workflow

```
design → create → validate → improve
```

| Phase | Input | Output |
|-------|-------|--------|
| **Design** | Skill concept | Design decisions |
| **Create** | Design | SKILL.md + references/ |
| **Validate** | Skill files | Checklist results |
| **Improve** | Audit findings | Updated skill |

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `--recent N` | 10 | Number of sessions to analyze |
| `--target PATH` | all | Specific component to focus on |
| `--type TYPE` | all | agent, skill, rule, or all |
| `--threshold N` | 70 | Score threshold for recommendations |

## Examples

```bash
# Full workflow
/meta-iterate

# Evaluate recent 20 sessions
/meta-iterate evaluate --recent 20

# Discover new skill opportunities
/meta-iterate discover

# Compound learnings into permanent artifacts
/meta-iterate compound

# Focus on specific agent
/meta-iterate --target agents/plan-agent.md

# Apply specific proposals
/meta-iterate apply --proposals PROP-2026-01-10.md

# Verify after improvements
/meta-iterate verify
```

## Output Files

| Phase | Location | Format |
|-------|----------|--------|
| Evaluate | `thoughts/evaluations/EVAL-YYYY-MM-DD.json` | JSON |
| Discover | `thoughts/discoveries/DISCOVER-YYYY-MM-DD.md` | Markdown |
| Compound | `thoughts/proposals/COMPOUND-YYYY-MM-DD.md` | Markdown |
| Diagnose | `thoughts/diagnoses/DIAG-YYYY-MM-DD.md` | Markdown |
| Propose | `thoughts/proposals/PROP-YYYY-MM-DD.md` | Markdown |
| Apply | Component files + `thoughts/iterations/ITER-NNN.md` | Markdown |
| Verify | `thoughts/iterations/ITER-NNN.md` (updated) | Markdown |

## Human Review Gate

**Phase 4 (APPLY) requires explicit approval:**

1. Review proposals in `thoughts/proposals/`
2. Confirm which changes to apply
3. Backups saved to `thoughts/backups/`

This ensures human oversight on all prompt changes.

## Integration with dev-flow

| dev-flow Component | Usage |
|--------------------|-------|
| `dev_ledger` | Track iteration tasks |
| `dev_reasoning` | Record iteration decisions |
| `braintrust_analyze.py` | Session data source (primary) |
| Local JSONL parsing | Session data source (fallback) |

## Skill Development Guide

See `references/skill-development.md` for:
- Creating new skills
- SKILL.md frontmatter best practices
- Skill quality checklist
- Plugin development guidelines

## Local Mode

See `references/local-mode.md` for:
- Using without Braintrust
- Local data sources
- Troubleshooting common issues

## References

- `references/compound-learnings.md` - Detailed process for transforming learnings into artifacts
- `references/skill-template.md` - SKILL.md template

## Quick Reference

```bash
# Weekly check (full workflow)
/meta-iterate

# Find new skill opportunities
/meta-iterate discover

# Transform learnings into permanent artifacts
/meta-iterate compound

# After noticing issues
/meta-iterate evaluate --recent 5
/meta-iterate diagnose

# Apply improvements
/meta-iterate propose
# Review proposals...
/meta-iterate apply

# Verify after 5+ new sessions
/meta-iterate verify
```
