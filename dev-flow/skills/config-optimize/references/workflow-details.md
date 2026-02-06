# Workflow Details

Complete workflow documentation for config-optimize skill.

## Phase 1: Version Check

### Steps
1. Get current Claude Code version
2. Read last checked version from state file
3. Fetch release notes for versions in between
4. Parse new features

### Commands
```bash
# Get current version
claude --version 2>/dev/null | head -1

# Read state
cat ~/.claude/config-optimize-state.json 2>/dev/null || echo '{"last_checked_version": "0.0.0"}'
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

## Phase 2: Config Analysis

### Scan Order
1. Global settings: `~/.claude/settings.json`
2. Global hooks: `~/.claude/hooks/`
3. Global rules: `~/.claude/rules/`
4. Global skills: `~/.claude/skills/`
5. Plugins: `~/.claude/plugins/`
6. Project config: `.claude/` (if in project)

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
