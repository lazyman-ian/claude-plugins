# Workflow Details

Complete workflow documentation for config-optimize skill.

## Phase 0: State Initialization

### Backward Compatibility

Old state format (pre-upgrade):
```json
{"last_checked_version": "2.1.3", "last_check_date": "2026-01-11", "applied_optimizations": [...]}
```

New state format:
```json
{"last_checked_version": "2.1.35", "last_check_date": "2026-02-08", "applied_optimizations": [...], "processed_sources": {...}}
```

**Migration**: Auto-add `processed_sources: {}` if missing. No manual migration needed.

### First Run Detection

```
processed_sources is empty OR state file doesn't exist
    → first_run = true
    → Use seed topics for comprehensive search
    → Scan existing rules to avoid duplicates
```

---

## Phase 1: Version Check

### Steps
1. Get current Claude Code version
2. Read state file (with migration if needed)
3. Detect first run vs incremental
4. Fetch release notes for versions in between

### Commands
```bash
# Get current version
claude --version 2>/dev/null | head -1

# Read state (backward compatible)
STATE=$(cat ~/.claude/config-optimize-state.json 2>/dev/null || echo '{"last_checked_version":"0.0.0","processed_sources":{}}')
PS_COUNT=$(echo "$STATE" | jq '.processed_sources | length')
```

### Release Notes Parsing

Fetch from: `https://github.com/anthropics/claude-code/releases`

Extract pattern:
```
## vX.Y.Z
### Features
- Feature description
### Bug Fixes
- Fix description
```

## Phase 1.5: Dynamic Source Search (Research Agent)

### Purpose

Deep-read official sources to extract actionable config patterns. **Do not rely on static article lists or shallow WebSearch summaries.**

### Architecture

```
config-optimize (sonnet)          research agent (sonnet)
    │                                  │
    ├─ Step 1: WebFetch releases       │
    │  (inline, quick)                 │
    │                                  │
    ├─ Step 2: Spawn ────────────────► │
    │                                  ├─ WebSearch queries
    │                                  ├─ WebFetch top results (deep read)
    │                                  ├─ Extract patterns
    │                                  └─ Return structured findings
    │                                  │
    ◄──────────────────────────────────┘
    │
    ├─ Step 3: Gap analysis using findings
    └─ Step 4: Generate proposals
```

### Research Strategy: Index Crawl (not keyword search)

**Why not WebSearch?** Keyword search misses articles. Blog has 20+ relevant articles, WebSearch returns ~5 per query. Instead, crawl the index pages for a complete listing.

### Research Agent Flow

```
Index crawl (3 pages)
    │
    ├─ anthropic.com/engineering → article list
    ├─ anthropic.com/research → article list
    └─ docs.anthropic.com/en/docs/claude-code → doc list
    │
    ▼
Filter (Claude Code related only)
    │
    ▼
Dedup (remove processed_sources URLs)
    │
    ▼
Read batch (max 5, newest first)
    │
    ▼
Extract patterns + check against existing rules
    │
    ▼
Return: patterns[] + remaining_unprocessed_count
```

### Batching Logic

| Unprocessed Count | This Run | Next Run |
|-------------------|----------|----------|
| 0 | Skip research, early exit | Same |
| 1-5 | Read all | Done |
| 6-10 | Read 5 (newest first) | Read remaining |
| 11+ | Read 5 (newest first) | Continue batching |

State tracks which URLs are processed. Each run picks up where the last stopped.

### Existing Rules Dedup

Before writing any pattern to rules:

```
1. Research agent reads ~/.claude/rules/*.md headers
2. For each extracted pattern:
   - Grep pattern keyword in rules → found? → skip
   - Not found → include in output
3. Return only genuinely new patterns
```

Prevents duplicates when user already has rules from manual sessions.

### Context Isolation Benefit

Research agent runs in isolated context:
- Main skill context stays clean for gap analysis
- Research can read 5-10 articles without bloating main context
- Structured return = minimal tokens transferred back

### Fallback

If research agent fails or times out:
```
Fallback: inline WebSearch + WebFetch (reduced quality, still functional)
```

### State Tracking

After research, record in state file:
```json
{
  "search_queries_used": ["..."],
  "sources_fetched": ["url1", "url2"],
  "patterns_extracted": 12,
  "research_agent_used": true
}
```

---

## Phase 2.5: Persist Patterns to Rules

### Purpose

Write extracted patterns as rules so all future sessions follow them without re-research.

### Flow

```
Research findings
    │
    ├─ For each pattern:
    │   ├─ Grep existing rules for pattern keyword
    │   │   ├─ Found → skip (already persisted)
    │   │   └─ Not found → append to matching rule file
    │   └─ Record in state.processed_sources
    │
    └─ Output: list of rules updated
```

### Rule File Matching

| Pattern Topic | Target Rule File |
|--------------|-----------------|
| Agent teams, delegation, scaling | `agent-team-management.md` |
| Agent orchestration, handoffs, modes | `agent-orchestration.md` |
| Agentic coding, context, sessions | `agentic-coding.md` |
| Hooks, matchers, gate scripts | `hooks.md` |
| Skills, frontmatter, descriptions | `skill-development.md` |
| Dev workflow, commit, PR | `dev-workflow.md` |
| No match | Create new rule or append to closest |

### Append Format

When adding to existing rule file:

```markdown
## {Pattern Name} (from config-optimize {date})

{Concise description of the pattern}

| Key | Value |
|-----|-------|
| Source | {url} |
| Config change | {what to set} |
| Verification | {how to check} |
```

### Dedup Check

Before writing, verify pattern is truly new:

```bash
# Check if pattern keyword already exists in rules
Grep("{pattern_keyword}", path="~/.claude/rules/", output_mode="count")
# count > 0 → skip
```

### State Update

```json
{
  "processed_sources": {
    "{url}": {
      "date": "{ISO date}",
      "patterns_extracted": 3,
      "rules_updated": ["agent-team-management.md", "hooks.md"]
    }
  }
}
```

### Token Savings Over Time

| Run # | Sources to Research | Rules to Write | Net Token Cost |
|-------|-------------------|----------------|---------------|
| 1 | All (first run) | All patterns | ~30K |
| 2 | New only (incremental) | Delta only | ~5-18K |
| 3+ | Usually 0-2 new | 0-3 patterns | ~5-10K |

After 3-4 runs, most official sources are processed. Weekly cost drops to ~5K (state check + release notes only).

---

## Phase 2: Config Analysis

### Scan Order
1. Global settings: `~/.claude/settings.json`
2. Global hooks: `~/.claude/hooks/`
3. Global rules: `~/.claude/rules/`
4. Global skills: `~/.claude/skills/`
5. Plugins: `~/.claude/plugins/`
6. Project config: `.claude/` (if in project)
7. Agent Team config: env vars, quality gate hooks, gate scripts

### Output Format
```json
{
  "settings": {
    "hooks": ["PreToolUse", "PostToolUse"],
    "env": ["FORCE_AUTOUPDATE_PLUGINS"],
    "mcpServers": ["dev-flow", "apple-docs"]
  },
  "hooks": {
    "session-start-continuity.sh": {
      "has_agent_type_check": true,
      "timeout": 60000
    }
  },
  "skills": {
    "config-optimize": {
      "has_name": true,
      "has_description": true,
      "has_allowed_tools": true,
      "line_count": 150
    }
  },
  "rules": {
    "dev-workflow.md": {
      "has_globs": false,
      "line_count": 89
    }
  }
}
```

## Phase 3: Gap Analysis

### Comparison Matrix

For each new feature, check:

| Feature | Required Config | Current State | Gap |
|---------|-----------------|---------------|-----|
| agent_type | SessionStart hook check | ✅/❌ | Y/N |
| Hook timeout | settings.json timeout | 60000 | Increase to 600000 |

### Gap Categories

1. **Missing Feature**: New capability not configured
2. **Deprecated Pattern**: Old pattern that should be updated
3. **Suboptimal Config**: Works but could be better
4. **Security Issue**: Potential vulnerability
5. **Agent Team Readiness**: Team infrastructure not configured

## Phase 4: Generate Proposals

### Proposal Format
```markdown
# Config Optimization Proposal - {DATE}

## Summary
{N} optimizations identified for Claude Code {version}

## Proposals

### PROP-001: {Title}

**Category**: Missing Feature / Deprecated / Suboptimal / Security
**Priority**: High / Medium / Low
**Effort**: Low / Medium / High

**Current State**:
```{current config}```

**Proposed Change**:
```{new config}```

**Rationale**:
{Why this change is beneficial}

**Files Affected**:
- `{file1}`
- `{file2}`

---

### PROP-002: ...
```

### Save Location
```
thoughts/config-optimizations/PROP-{DATE}.md
```

## Phase 5: Apply

### Pre-Apply Checklist
- [ ] User reviewed proposals
- [ ] Backup created
- [ ] No conflicting changes

### Apply Process
```bash
# 1. Create backup
cp ~/.claude/settings.json ~/.claude/settings.json.bak

# 2. Apply changes
# (skill applies edits)

# 3. Verify
claude /doctor

# 4. Update state
cat > ~/.claude/config-optimize-state.json << EOF
{
  "last_checked_version": "{version}",
  "last_check_date": "{date}",
  "applied_optimizations": [...]
}
EOF
```

### Rollback
```bash
# If issues occur
cp ~/.claude/settings.json.bak ~/.claude/settings.json
```

## Periodic Reminder Logic

### Session Count Tracking
```bash
STATE_FILE=~/.claude/config-optimize-state.json
CURRENT_SESSION=$(jq -r '.session_count // 0' "$STATE_FILE")
NEXT_SESSION=$((CURRENT_SESSION + 1))

# Update count
jq --argjson n "$NEXT_SESSION" '.session_count = $n' "$STATE_FILE" > /tmp/state.json
mv /tmp/state.json "$STATE_FILE"

# Check if reminder needed (every 20 sessions)
if [ $((NEXT_SESSION % 20)) -eq 0 ]; then
    echo "Consider running /config-optimize"
fi
```

### Version Change Detection
```bash
CURRENT_VERSION=$(claude --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
LAST_VERSION=$(jq -r '.last_checked_version // "0.0.0"' "$STATE_FILE")

if [ "$CURRENT_VERSION" != "$LAST_VERSION" ]; then
    echo "Claude Code updated: $LAST_VERSION → $CURRENT_VERSION"
    echo "Run /config-optimize to check for new features"
fi
```

## Phase 6: Rules Consistency Check

### Purpose

Detect contradictions across `~/.claude/rules/*.md` that accumulate over time as rules are added from different sources (manual, config-optimize, meta-iterate).

### Architecture

```
config-optimize (in-context)
    │
    ├─ Glob("~/.claude/rules/*.md")
    │
    ├─ Parallel Read (limit=50 per file)
    │   ├─ Extract: imperative statements
    │   ├─ Extract: table rows (✅/❌ patterns)
    │   └─ Extract: "NEVER/ALWAYS/MUST" directives
    │
    ├─ Cross-check pairs (N*(N-1)/2 comparisons)
    │   ├─ Same topic? → check for opposite advice
    │   ├─ Same tool? → check for conflicting recommendations
    │   └─ Same workflow? → check for incompatible steps
    │
    └─ Append to CHECK report
```

### Key Design: No Subprocess

Unlike claude-reflect's `claude -p` approach, this uses Claude's **own context** to reason about contradictions. Benefits:

| Aspect | `claude -p` (claude-reflect) | In-context (ours) |
|--------|------------------------------|-------------------|
| Latency | ~5-30s per call | 0 (already in context) |
| Cost | Extra API call | 0 (within existing session) |
| Quality | Isolated, no cross-file context | Full cross-file understanding |
| Reliability | Subprocess can fail/timeout | Always works |

### Extraction Patterns

From each rule file, extract directives matching:

```
- Imperative: "Use X", "Always Y", "Never Z"
- Table rows: "| ✅ pattern | ❌ anti-pattern |"
- Conditional: "If X then Y" / "When X, do Y"
- Prohibition: "NEVER", "BLOCKED", "禁止"
- Requirement: "MUST", "ALWAYS", "必须"
```

### Contradiction Detection Logic

```
For each pair (rule_A, rule_B):
  1. Topic overlap? (same keywords: "commit", "agent", "scope", etc.)
     → No overlap → skip pair
  2. Same topic, same advice → compatible, skip
  3. Same topic, opposite advice → CONTRADICTION
     → Classify severity:
       - Both use NEVER/ALWAYS → High
       - One conditional, one absolute → Medium
       - Different contexts explicitly → Low (likely compatible)
  4. Record: {rule_A, rule_B, conflict_description, severity}
```

### Skip Rules

| Condition | Reason |
|-----------|--------|
| < 3 rule files | Not enough to conflict |
| Platform-specific (e.g., `android-theme-lessons.md`) | Different context |
| `.project-specific/` subdirectory | Project-scoped, not global |
| Same file | Internal consistency is author's responsibility |

### Output Format

Appended to `thoughts/config-optimizations/CHECK-{date}.md`:

```markdown
## Rules Consistency Check

Scanned: {N} rule files, {M} directive pairs checked.

### Contradictions Found

| # | File A | Directive A | File B | Directive B | Conflict | Severity |
|---|--------|-------------|--------|-------------|----------|----------|
| 1 | scope-control.md | "只改请求的内容" | agentic-coding.md | "记录发现的问题" | 发现 vs 修改范围 | Low |

### Resolution Suggestions

1. **#1 (Low)**: Compatible — "记录" ≠ "修改". scope-control prevents editing, agentic-coding encourages recording (TaskCreate). No action needed.

### Summary

✅ No critical contradictions. {N} low-severity items noted (compatible with context).
```

### State Tracking

Add to `config-optimize-state.json`:

```json
{
  "rules_consistency": {
    "last_check_date": "2026-02-08",
    "rules_checked": 15,
    "contradictions_found": 1,
    "critical_count": 0
  }
}
```

### Cost Impact

| Scenario | Additional Tokens |
|----------|-------------------|
| 15 rule files × 50 lines | ~3K read |
| Cross-check analysis | ~2K reasoning |
| Report output | ~1K write |
| **Total** | **~6K** (minimal overhead) |

---

## Integration Points

### With meta-iterate
```
/meta-iterate → Analyzes session performance → Optimizes prompts/rules
/config-optimize → Analyzes Claude Code releases → Optimizes config
```

### With dev workflow
```
/dev-flow:dev → Shows current state
/config-optimize → Ensures dev-flow uses latest features
```

### Automation
```json
{
  "hooks": {
    "SessionStart": [{
      "matcher": "startup",
      "hooks": [{
        "type": "command",
        "command": "~/.claude/hooks/config-optimize-reminder.sh"
      }]
    }]
  }
}
```
