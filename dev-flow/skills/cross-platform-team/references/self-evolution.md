# Self-Evolution Guide

How the cross-platform-team skill learns and evolves.

## Three Learning Loops

```
Loop 1: Per-Run (automatic)
  Each run → collect metrics → update stats → detect changes

Loop 2: Periodic (via meta-iterate)
  Every ~10 sessions → analyze stats → update skill templates

Loop 3: Manual (user-triggered)
  /meta-iterate cross-platform → deep analysis → rewrite skill sections
```

## Loop 1: Per-Run Learning

### What to Collect (Phase 5 of skill)

After each cross-platform-team run, append to `~/.claude/memory/cross-platform-stats.yaml`:

```yaml
- date: "{today}"
  task_id: "TASK-{id}"
  feature: "{name}"
  platforms: [ios, android]
  mode: "plan+implement"
  plan_revisions: {count}      # 0 = plan approved first try
  teammate_count: {n}
  results:
    ios:
      status: done|blocked|partial
      commits: {n}
      verify: pass|fail
      issues: ["list of issues"]
    android:
      status: done|blocked|partial
      commits: {n}
      verify: pass|fail
      issues: []
  learnings:
    - "Android detekt baseline needs regeneration after new files"
    - "iOS NetworkService param format: key=value not JSON body"
```

### Convention Drift Detection

At the start of each run, check if conventions changed:

```bash
# 1. Check base branch
CURRENT_DEFAULT=$(git -C {repo} symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||')

# 2. Check latest commit style
LATEST_STYLE=$(git -C {repo} log --oneline -5 --format="%s" | head -1)

# 3. Check verify command exists
make -C {repo} -n check 2>/dev/null && echo "make check exists"

# 4. Read CLAUDE.md for changes
CLAUDE_MD_HASH=$(md5 -q {repo}/CLAUDE.md 2>/dev/null)
```

If any differs from memory → update memory + log warning.

## Loop 2: Periodic Analysis (meta-iterate integration)

### Trigger

When `/meta-iterate` runs, it should check for cross-platform stats:

```
if file_exists("~/.claude/memory/cross-platform-stats.yaml"):
  if stats.runs.length >= 3:
    run cross-platform analysis
```

### Analysis Queries

| Question | Data Source | Action |
|----------|-----------|--------|
| Which platforms are most used? | platform_usage | Adjust default preset |
| Do plans need many revisions? | avg_plan_revisions > 1 | Improve plan template |
| Which verify commands fail? | common_verify_failures | Add pre-check steps |
| What do teammates ask most? | common_teammate_questions | Clarify prompt template |
| Is iOS always first? | ios_first_then_sync | Optimize sync-from-ref flow |
| Do conventions drift? | convention.last_synced | Force re-sync |
| Are presets accurate? | preset_usage | Add/remove presets |

### Output Actions

| Finding | Auto-Action |
|---------|-------------|
| Platform X never used | Remove from default presets |
| New repo added | Add to memory.repos |
| Verify always fails on step Y | Add workaround to platform template |
| Plan revision > 2 avg | Improve plan structure with more detail |
| Common teammate question | Add answer to teammate prompt template |
| New commit convention | Update memory.conventions |

### meta-iterate Command Extension

Add this to meta-iterate's analysis flow:

```
/meta-iterate cross-platform
→ Read ~/.claude/memory/cross-platform-stats.yaml
→ Analyze patterns
→ Generate proposals:
  1. SKILL.md updates (conventions, presets, defaults)
  2. references/platform-templates.md updates
  3. Memory schema updates
→ Present to user for approval
→ Apply changes
```

## Loop 3: Manual Deep Analysis

User triggers comprehensive review:

```
/meta-iterate cross-platform deep
```

This does everything in Loop 2, plus:

1. **Git archaeology**: Scan all configured repos for recent branch/commit patterns
2. **CLAUDE.md diff**: Compare current CLAUDE.md with last-synced version
3. **Plan quality**: Read recent plans, check if structure matches template
4. **Cross-reference**: Find TASK-IDs that appear in multiple repos
5. **Timeline**: Which platform typically finishes first?

### Output: Evolution Report

```markdown
# Cross-Platform Skill Evolution Report - {date}

## Usage Stats (last {n} runs)
- Most common: mobile (iOS+Android) - 80%
- Avg plan revisions: 1.2
- Avg teammate commits: 3.5
- Verify pass rate: iOS 95%, Android 85%, Web 90%

## Convention Changes Detected
- [ ] Android switched from ktlint to detekt for some checks
- [ ] Web added Vitest for unit testing
- [x] iOS verify still `make fix && make check`

## Recommended Skill Updates
1. Add Vitest to Web verify template
2. Increase Android detekt baseline step in Phase 1
3. Default to mobile preset (80% usage)

## Teammate Prompt Improvements
- Add: "Run detekt baseline regeneration if new files added"
- Clarify: NetworkService param format for iOS
```

## Stats File Management

### Rotation
Keep last 20 runs in `runs:` array. Archive older to `~/.claude/memory/cross-platform-stats-archive.yaml`.

### Aggregation
After each run, update aggregate fields:
```python
platform_usage[platform] += 1
preset_usage[preset] += 1
patterns.avg_plan_revisions = rolling_avg(runs[-10:].plan_revisions)
patterns.avg_teammate_commits = rolling_avg(runs[-10:].results.*.commits)
```

### Reset
If repos change significantly (new project, different team):
```
/cross-platform-team reset-stats
→ Archive current stats
→ Start fresh collection
→ Re-scan all repos for conventions
```
