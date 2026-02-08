# Configuration Areas Reference

Detailed check patterns for each configuration area.

## Hooks

### Files to Scan
```
~/.claude/settings.json          # Hook registration
~/.claude/hooks/*.sh             # Shell hooks
~/.claude/hooks/dist/*.mjs       # Bundled TypeScript hooks
.claude/settings.json            # Project hooks
.claude/hooks/                   # Project hook scripts
```

### Check Patterns

| Pattern | Issue | Fix |
|---------|-------|-----|
| No `agent_type` check | Subagent overhead | Add early exit for non-main |
| Timeout < 600000 | May timeout on long operations | Increase timeout |
| Missing error handling | Silent failures | Add set -e, error logging |
| Hardcoded paths | Portability issues | Use $CLAUDE_PROJECT_DIR |

### Validation Script
```bash
# Check all session-start hooks for agent_type
for hook in ~/.claude/hooks/session-start-*.sh; do
    if ! grep -q "agent_type" "$hook"; then
        echo "WARN: $hook missing agent_type check"
    fi
done
```

## Skills

### Files to Scan
```
~/.claude/skills/*/SKILL.md      # Global skills
.claude/skills/*/SKILL.md        # Project skills
~/.claude/plugins/*/skills/      # Plugin skills
```

### Check Patterns

| Pattern | Issue | Fix |
|---------|-------|-----|
| Missing `name` field | May not register | Add name to frontmatter |
| Vague description | Won't auto-trigger | Add trigger keywords |
| Missing `allowed-tools` | Unrestricted access | Add tool restrictions |
| > 500 lines | Context bloat | Split to references/ |
| Duplicate commands/*.md | Redundant (v2.1.3+) | Remove command file |

### Validation Script
```bash
# Check skill frontmatter
for skill in ~/.claude/skills/*/SKILL.md; do
    if ! head -20 "$skill" | grep -q "^name:"; then
        echo "WARN: $skill missing name field"
    fi
    if ! head -20 "$skill" | grep -q "^description:"; then
        echo "WARN: $skill missing description"
    fi
done
```

## Rules

### Files to Scan
```
~/.claude/rules/*.md             # Global rules
.claude/rules/*.md               # Project rules (gitignored)
CLAUDE.md                        # Project instructions
```

### Check Patterns

| Pattern | Issue | Fix |
|---------|-------|-----|
| No glob pattern | May not trigger | Add `globs:` frontmatter |
| Contradicting rules | Confusion | Consolidate or prioritize |
| > 200 lines | Too verbose | Split into focused rules |
| Outdated references | Broken links | Update or remove |

### Consistency Check (Phase 7)

Cross-file contradiction detection for accumulated rules:

| Check | What | Example |
|-------|------|---------|
| Opposite imperatives | "Use X" vs "Don't use X" | "use tabs" vs "use spaces" |
| Tool conflicts | Different tool recommendations | "use Glob" vs "use find" |
| Workflow conflicts | Incompatible steps | "commit immediately" vs "always review first" |
| Scope conflicts | Different scope boundaries | "fix everything" vs "only fix requested" |

**Directive extraction targets:**
```
NEVER / ALWAYS / MUST / 禁止 / 必须
✅ / ❌ table patterns
"Use X not Y" / "用 X 不用 Y"
```

**Exclusions:** `.project-specific/` directory, platform-specific rules (different context).

### Unreachable Detection
```bash
# Run /doctor to find unreachable rules
claude /doctor 2>&1 | grep -A5 "Unreachable rules"
```

## Agent Teams

### Files to Scan
```
~/.claude/settings.json          # env vars, hooks
~/.claude/hooks/*-gate.sh        # Quality gate scripts
~/.claude/rules/agent-*.md       # Agent management rules
*/skills/agent-team/             # Agent team skill
```

### Check Patterns

| Pattern | Issue | Fix |
|---------|-------|-----|
| No `AGENT_TEAMS` env var | Teams disabled | Add to settings.json env |
| No TeammateIdle hook | No idle quality gate | Install gate script |
| No TaskCompleted hook | No completion gate | Install gate script |
| No agent management rules | No team guidelines | Add agent-team-management.md |
| Gate scripts not executable | Hooks fail silently | `chmod +x` |

### Validation Script
```bash
# Check Agent Teams readiness
echo "=== Agent Teams Config ==="
ENV_VAR=$(jq -r '.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS // "NOT SET"' ~/.claude/settings.json)
echo "Teams env: $ENV_VAR"

IDLE_HOOK=$(jq -r '.hooks.TeammateIdle // "NOT SET"' ~/.claude/settings.json)
echo "TeammateIdle: $IDLE_HOOK"

TASK_HOOK=$(jq -r '.hooks.TaskCompleted // "NOT SET"' ~/.claude/settings.json)
echo "TaskCompleted: $TASK_HOOK"

for gate in ~/.claude/hooks/*-gate.sh ~/.claude/plugins/*/scripts/*-gate.sh; do
    [ -f "$gate" ] && echo "Gate: $gate ($(test -x "$gate" && echo 'OK' || echo 'NOT EXEC'))"
done
```

---

## Environment

### Files to Scan
```
~/.claude/settings.json          # env section
~/.zshrc or ~/.bashrc            # Shell exports
```

### Known Env Vars

| Variable | Purpose | Default |
|----------|---------|---------|
| `FORCE_AUTOUPDATE_PLUGINS` | Auto-update plugins | unset |
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` | Enable Agent Teams | unset |
| `CLAUDE_CODE_REMOTE` | Remote session flag | unset |
| `CLAUDE_HOOK_DEBUG` | Hook debug logging | unset |
| `ANTHROPIC_API_KEY` | API authentication | required |
| `CLAUDE_PROJECT_DIR` | Project root (in hooks) | auto |
| `CLAUDE_ENV_FILE` | SessionStart env file | auto |

### Check for Missing
```bash
# Check if recommended env vars are set
jq -r '.env // {}' ~/.claude/settings.json | grep -E "FORCE_AUTOUPDATE"
```

## MCP Servers

### Files to Scan
```
~/.claude/settings.json          # mcpServers section
.mcp.json                        # Project MCP config
```

### Check Patterns

| Pattern | Issue | Fix |
|---------|-------|-----|
| Outdated server version | Missing features | Update package |
| Missing error handling | Silent failures | Add health checks |
| Duplicate servers | Resource waste | Consolidate |

### Validation
```bash
# List configured MCP servers
jq -r '.mcpServers | keys[]' ~/.claude/settings.json
```

## Plugins

### Files to Scan
```
~/.claude/plugins/               # Installed plugins
*/plugin.json                    # Plugin manifests
```

### Check Patterns

| Pattern | Issue | Fix |
|---------|-------|-----|
| Outdated version | Missing features | Update plugin |
| Missing skills | Incomplete functionality | Check plugin docs |
| Conflicting commands | Name collision | Rename or disable |

### Auto-Update Check
```bash
# Ensure auto-update is enabled
if [ -z "$FORCE_AUTOUPDATE_PLUGINS" ]; then
    echo "WARN: Plugin auto-update not enabled"
fi
```

## Gap Analysis Template

```markdown
## Configuration Gap Analysis - {DATE}

### Current State
- Claude Code Version: {version}
- Last Checked: {last_check_date}

### Findings

#### Hooks
- [ ] {issue}: {recommendation}

#### Skills
- [ ] {issue}: {recommendation}

#### Rules
- [ ] {issue}: {recommendation}

#### Environment
- [ ] {issue}: {recommendation}

### Recommendations

1. **High Priority**: {critical issues}
2. **Medium Priority**: {improvements}
3. **Low Priority**: {nice-to-have}
```
