---
name: config-optimize
description: Use to check Claude Code updates and optimize configuration. Triggers on "/config-optimize", "check claude updates", "Claude配置优化", "Claude新功能". NOT for general "optimize" requests.
model: sonnet
memory: user
allowed-tools: [Read, Glob, Grep, Write, Edit, Bash, WebFetch, WebSearch, Task, TaskCreate, TaskUpdate]
---

# config-optimize

Automatically check Claude Code releases and optimize configuration.

## When to Use

- After Claude Code updates
- Periodically (weekly recommended)
- When prompted by session reminder
- Manual: `/config-optimize`

## Commands

| Command | Purpose |
|---------|---------|
| `/config-optimize` | Full optimization workflow |
| `/config-optimize check` | Check only (no changes) |
| `/config-optimize apply` | Apply pending proposals |

## State Initialization & Backward Compatibility

```bash
STATE_FILE=~/.claude/config-optimize-state.json

# Read or create state (backward compatible)
if [ -f "$STATE_FILE" ]; then
    STATE=$(cat "$STATE_FILE")
    # Migrate: add processed_sources if missing (old format)
    HAS_PS=$(echo "$STATE" | jq 'has("processed_sources")')
    if [ "$HAS_PS" = "false" ]; then
        STATE=$(echo "$STATE" | jq '. + {"processed_sources": {}}')
    fi
else
    # First run: empty state
    STATE='{"last_checked_version":"0.0.0","last_check_date":"1970-01-01","applied_optimizations":[],"processed_sources":{}}'
fi
```

**Migration from old format**: Old state `{"last_checked_version","last_check_date","applied_optimizations"}` is preserved. `processed_sources: {}` is added automatically. No data loss.

## Early Exit Check

```bash
CURRENT=$(claude --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
LAST_CHECKED=$(echo "$STATE" | jq -r '.last_checked_version // "0.0.0"')
LAST_DATE=$(echo "$STATE" | jq -r '.last_check_date // "1970-01-01"')
PS_COUNT=$(echo "$STATE" | jq '.processed_sources | length')
```

**Exit conditions:**

| Condition | Action |
|-----------|--------|
| `CURRENT == LAST_CHECKED` AND `days < 7` AND `PS_COUNT > 0` | Early exit |
| `PS_COUNT == 0` (first run or migrated) | **Full run** (seed search) |
| `CURRENT != LAST_CHECKED` | Version changed, run |
| `days >= 7` | Weekly check, run |

## Workflow

```
VERSION CHECK → SOURCE SEARCH → CONFIG ANALYSIS → GAP ANALYSIS → PROPOSALS → APPLY → RULES CONSISTENCY
```

1. **Version Check**: Compare current vs last checked version
2. **Source Search**: Dynamic search for new features and best practices (see below)
3. **Config Analysis**: Scan settings, hooks, rules, skills
4. **Gap Analysis**: Identify unused features, deprecated patterns
5. **Proposals**: Generate optimization recommendations
6. **Apply**: Apply selected changes (requires approval)
7. **Rules Consistency**: Cross-check all rules/ for contradictions (see below)

## Dynamic Source Search (Phase 2)

**Do NOT rely on static article lists.** Delegate deep research to a research agent.

### Strategy: Research Agent for Deep Reading

```
Step 1: WebFetch GitHub releases (inline, quick)
Step 2: Spawn research agent for blog/docs deep reading
Step 3: Research agent returns structured findings
Step 4: Use findings for gap analysis (Phase 3)
```

### Step 1: Release Notes (inline)

```
WebFetch("https://github.com/anthropics/claude-code/releases",
         "Extract features for versions above {last_checked_version}")
```

### Step 2: Research Agent (deep reading)

**Both first and subsequent runs use the same strategy: crawl index → filter → dedup → read.**

```
Task(subagent_type="research:research-agent", prompt="""
Find and deep-read ALL unprocessed Claude Code articles from official sources.

## Step 1: Crawl Index Pages

Fetch these index pages to get complete article listings:
- https://www.anthropic.com/engineering — all engineering blog posts
- https://www.anthropic.com/research — all research blog posts
- https://docs.anthropic.com/en/docs/claude-code — all doc pages

List every article title + URL found.

## Step 2: Filter

Keep only articles about: Claude Code, agents, agent teams, agentic coding,
hooks, skills, MCP, context engineering, coding assistants.
Discard unrelated articles (safety research, model cards, etc).

## Step 3: Dedup

Already processed (skip these): {processed_sources_urls}

## Step 4: Deep-Read (max 5 per run)

For each unprocessed article (newest first, max 5):
- WebFetch the full article
- Extract actionable patterns for Claude Code configuration

## Step 5: Check Existing Rules

Read ~/.claude/rules/*.md to see what's already covered.
Only return patterns NOT already present.

## Output Format

| Source URL | Pattern | Config Change | Target Rule File | Priority |

Also return: total unprocessed count remaining (for next run).
""")
```

**Batching**: If >5 unprocessed articles, process 5 per run. State tracks progress.
Subsequent `/config-optimize` runs pick up where the last run left off.

### Step 3: Persist to Rules (knowledge extraction)

Extracted patterns must be **written to rules files**, not just used for gap analysis:

```
For each new pattern found:
1. Check if already in existing rules → skip
2. If new → append to matching rule file or create new one
3. Record in state file which sources have been processed
```

| Pattern Type | Write To | Example |
|-------------|----------|---------|
| Agent/team pattern | `~/.claude/rules/agent-team-management.md` | Delegate mode |
| Hook best practice | `~/.claude/rules/hooks.md` | New hook type |
| Agentic workflow | `~/.claude/rules/agentic-coding.md` | Context engineering |
| Skill development | `~/.claude/rules/skill-development.md` | New frontmatter field |
| General config | `~/.claude/rules/dev-workflow.md` | New env var |

**Benefits:**
- All future sessions follow new patterns immediately (no re-research)
- Next config-optimize run skips already-processed sources (token savings)
- Rules accumulate institutional knowledge over time

### Cost Model

| Run | Research | Persist | Total | Notes |
|-----|----------|---------|-------|-------|
| First | ~25K | ~5K | ~30K | Full research + rule writing |
| Subsequent (no new content) | ~5K | 0 | ~5K | State check → skip |
| Subsequent (new content) | ~15K | ~3K | ~18K | Incremental only |

## Reference Menu

| Reference | Load When |
|-----------|-----------|
| `references/version-history.md` | Generating proposals for specific versions |
| `references/config-areas.md` | Analyzing hooks, skills, rules, env |
| `references/workflow-details.md` | Understanding full workflow details |
| `references/sources.md` | Finding official documentation sources |

## Documentation Sources

| Source | Method | Use For |
|--------|--------|---------|
| GitHub Releases | `WebFetch` (always) | Version-specific features |
| Web Search | `WebSearch` (always) | New articles, blog posts, best practices |
| Top results | `WebFetch` (top 2-3) | Extract actionable patterns |

**No static article list.** Search dynamically every run.

## Quick Check

```bash
# 1. Current version
claude --version

# 2. Last checked
cat ~/.claude/config-optimize-state.json

# 3. Dynamic search (not just releases)
WebFetch("https://github.com/anthropics/claude-code/releases")
WebSearch("Claude Code new features best practices 2026")
```

## State File

`~/.claude/config-optimize-state.json`:
```json
{
  "last_checked_version": "2.1.35",
  "last_check_date": "2026-02-08",
  "applied_optimizations": ["agent_type_check", "force_autoupdate", "agent_teams_env"],
  "processed_sources": {
    "anthropic.com/research/building-effective-agents": {
      "date": "2026-02-08",
      "patterns_extracted": 3,
      "rules_updated": ["agentic-coding.md"]
    },
    "anthropic.com/engineering/multi-agent-research": {
      "date": "2026-02-08",
      "patterns_extracted": 2,
      "rules_updated": ["agent-orchestration.md", "agent-team-management.md"]
    }
  }
}
```

**Dedup logic**: If source URL exists in `processed_sources` → skip.
**Backlog tracking**: `remaining_unprocessed` shows how many articles still need reading. Reaches 0 after a few runs.

## Output

| File | Purpose |
|------|---------|
| `thoughts/config-optimizations/CHECK-*.md` | Gap analysis |
| `thoughts/config-optimizations/APPLY-*.md` | Applied changes |

## Phase 7: Rules Consistency Check

After all config phases, scan `~/.claude/rules/*.md` for contradictions.

### Strategy

Read all rules files into context, then cross-check for conflicting directives.
Uses Claude's own reasoning — **no `claude -p` subprocess**.

### Steps

```
1. Glob("~/.claude/rules/*.md") → list all rule files
2. Read each file (parallel, limit=50 per file for headers/key directives)
3. Extract key directives (imperative statements, table rows with ✅/❌)
4. Cross-check pairs for contradictions:
   - Same topic, opposite advice
   - Conflicting tool recommendations
   - Incompatible workflow steps
5. Append results to CHECK report
```

### Output in CHECK Report

```markdown
## Rules Consistency Check

| Rule A | Rule B | Conflict | Severity |
|--------|--------|----------|----------|
| scope-control.md: "不修改范围外文件" | agentic-coding.md: "记录发现的问题" | Partial: 发现 vs 修改 | Low (compatible) |

✅ No critical contradictions found.
```

### Contradiction Types

| Type | Severity | Example |
|------|----------|---------|
| Direct opposite | High | "use tabs" vs "use spaces" |
| Scope conflict | Medium | "only fix requested" vs "fix surrounding issues" |
| Partial overlap | Low | "record discoveries" vs "don't modify unrelated" |
| False positive | Skip | Different topics using similar language |

### Skip Conditions

- Rules < 3 files → skip (not enough to conflict)
- Same file internal contradictions → not checked (author's intent)
- Platform-specific rules (android-theme-lessons.md) → skip cross-platform comparison

## Agent Team Readiness Check

If Agent Teams are available, also check:

| Check | What | How |
|-------|------|-----|
| Env var | `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` | `settings.json` env |
| TeammateIdle hook | Quality gate script installed | `settings.json` hooks |
| TaskCompleted hook | Quality gate script installed | `settings.json` hooks |
| Delegate mode aware | Rules mention delegate mode | `rules/*.md` |
| Quality gate scripts | Executable in expected path | `scripts/*-gate.sh` |

## Integration

| Skill | Focus |
|-------|-------|
| `/config-optimize` | Config based on releases + blog search |
| `/meta-iterate` | Prompts based on sessions |

Weekly routine: `/config-optimize` then `/meta-iterate`

## Completion

After workflow completes (or early exit), always output:

```
## Config Optimization Complete

- Current version: {version}
- Last checked: {date}
- Actions taken: {count} proposals applied / 0 (already current)
- Rules consistency: {N} files checked, {M} contradictions ({critical} critical)
- Next check recommended: {date + 7 days}
```

This signals to the user that the optimization is done.
