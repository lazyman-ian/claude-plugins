---
name: meta-iterate
description: Use when analyzing session performance, improving agent/skill prompts, developing new skills, or reviewing insights reports. Triggers on "improve prompts", "analyze sessions", "self-improve", "优化工作流", "迭代agent", "分析session", "discover skills", "skill development", "insights analysis".
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
| `/meta-iterate insights` | Read `/insights` report + facets as evaluate input |
| `/meta-iterate evaluate` | Only evaluate sessions (Braintrust/local) |
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
[insights + evaluate] → discover/compound (optional) → diagnose → propose → [approve] → apply → verify
```

| Phase | Input | Output | Agent |
|-------|-------|--------|-------|
| **insights** | Facets + report.html | Friction/goal summary | (built-in) |
| **evaluate** | Braintrust logs | `EVAL-<date>.json` | evaluate-agent |
| **discover** | Insights + Evaluation | `DISCOVER-<date>.md` | (built-in) |
| **compound** | Learnings files | Artifacts proposal | (built-in) |
| **diagnose** | Insights + Evaluation | `DIAG-<date>.md` | diagnose-agent |
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

## Data Sources (Priority Order)

| Source | Location | Quality | Dependency |
|--------|----------|---------|------------|
| **Insights facets** | `~/.claude/usage-data/facets/*.json` | High (structured) | None (local) |
| **Insights report** | `~/.claude/usage-data/report.html` | High (aggregated) | Run `/insights` first |
| **Braintrust** | API via `braintrust_analyze.py` | Highest (detailed) | Python + API key |
| **Local JSONL** | `~/.claude/projects/<proj>/*.jsonl` | Medium (raw) | None (local) |

### Insights + Evaluate 合并

默认流程同时使用两个数据源，合并后提供更全面的分析：

```
insights (本地 facets)  ─┐
                         ├→ 合并 → diagnose → propose → apply → verify
evaluate (Braintrust)   ─┘
```

**Insights 提供宏观视角** (哪些 session 有摩擦、什么类型的任务最多):

| Facet Field | Maps to |
|-------------|---------|
| `friction_counts.wrong_approach` | Diagnose: approach issues |
| `friction_counts.excessive_changes` | Diagnose: scope control |
| `goal_categories` | Discover: skill opportunities |
| `friction_detail` | Propose: specific improvements |
| `outcome` | Verify: baseline metrics |

**Evaluate 提供微观细节** (具体哪个工具调用出问题、token 消耗在哪):

| Braintrust Field | Maps to |
|------------------|---------|
| Tool call traces | Diagnose: specific tool issues |
| Token usage | Propose: context optimization |
| Error patterns | Propose: error handling rules |
| **Task metrics** (v2.1.31+) | Agent efficiency: token_count, tool_uses, duration per subagent |

### `/meta-iterate insights` 单独使用

当只需快速查看时，可单独运行 insights（不调用 Braintrust）:

```bash
/meta-iterate insights   # 只读 facets + report，即时分析
```

### 完整流程 (默认)

```bash
/meta-iterate            # insights + evaluate 合并，最全面
```

## Integration with dev-flow

| dev-flow Component | Usage |
|--------------------|-------|
| `dev_ledger` | Track iteration tasks |
| `dev_reasoning` | Record iteration decisions |
| Insights facets | 宏观数据: 摩擦、目标、结果 (always) |
| `braintrust_analyze.py` | 微观数据: 工具调用、token (default) |
| Task metrics (v2.1.31+) | Subagent 效率: token_count, tool_uses, duration |
| Local JSONL parsing | Fallback when Braintrust unavailable |

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
# Quick iteration (from local insights, no external deps)
/meta-iterate insights

# Weekly check (full workflow with Braintrust)
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
