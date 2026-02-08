# Claude Code Version History

Known optimizations by version. Load this reference when generating proposals.

## v2.1.32+ (2026-02) — Agent Teams Era

| Feature | Config Change | Files Affected |
|---------|---------------|----------------|
| Agent Teams | `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in env | `settings.json` |
| TeammateIdle hook | Add quality gate script | `settings.json` hooks, `scripts/` |
| TaskCompleted hook | Add quality gate script | `settings.json` hooks, `scripts/` |
| SubagentStop hook | Validate handoff output | `settings.json` hooks |
| Delegate mode | `Shift+Tab` restricts lead to coordination | Team workflow |
| Plan Approval mode | `mode: "plan"` in Task spawning | Teammate template |
| `memory: user` frontmatter | Persistent cross-session state | Skill SKILL.md |

**Applied Check:**
```bash
# Verify Agent Teams env var
jq -r '.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS // "not set"' ~/.claude/settings.json

# Verify quality gate hooks
jq -r '.hooks.TeammateIdle // "not configured"' ~/.claude/settings.json
jq -r '.hooks.TaskCompleted // "not configured"' ~/.claude/settings.json
```

**Key Blog Insights (search dynamically, don't hardcode URLs):**
- Environment design > agent sophistication (C Compiler: 16 agents, $20K)
- 4-element teammate prompt: Objective, Output Format, Tool Guidance, Task Boundaries
- Evaluator-Optimizer pattern for iterative improvement
- Task verifier must be near-perfect
- Token economics: multi-agent ~15x chat cost

---

## v2.1.3 (2026-01)

| Feature | Config Change | Files Affected |
|---------|---------------|----------------|
| Skills/Commands merged | Remove duplicate command files | `commands/*.md` |
| Hook timeout 10min | Increase timeout for long hooks | `settings.json` |
| Unreachable rule detection | Run `/doctor` to find dead rules | `rules/*.md` |
| Release channel toggle | Set `releaseChannel` in settings | `settings.json` |

**Applied Check:**
```bash
# Verify no duplicate skill/command pairs
ls skills/*/SKILL.md | xargs -I{} basename $(dirname {}) | sort > /tmp/skills.txt
ls commands/*.md | xargs -I{} basename {} .md | sort > /tmp/commands.txt
comm -12 /tmp/skills.txt /tmp/commands.txt  # Should show merged pairs only
```

## v2.1.2 (2026-01)

| Feature | Config Change | Files Affected |
|---------|---------------|----------------|
| `agent_type` in SessionStart | Skip heavy processing for subagents | `hooks/session-start-*.sh` |
| `FORCE_AUTOUPDATE_PLUGINS` | Auto-update plugins on startup | `settings.json` env |
| Large outputs to disk | No action needed (automatic) | - |

**Applied Check:**
```bash
# Verify agent_type handling in session-start hooks
grep -l "agent_type" ~/.claude/hooks/session-start-*.sh
```

**Implementation Pattern:**
```bash
AGENT_TYPE=$(echo "$INPUT" | jq -r '.agent_type // "main"')
if [[ "$AGENT_TYPE" != "main" ]]; then
    echo '{"result": "continue"}'
    exit 0
fi
```

## v2.1.0 (2025-12)

| Feature | Config Change | Files Affected |
|---------|---------------|----------------|
| Hooks system | Add hooks to settings.json | `settings.json` |
| Skills system | Create skills/ directory | `.claude/skills/` |
| MCP integration | Configure mcpServers | `settings.json` |

## v2.0.x

| Feature | Config Change | Files Affected |
|---------|---------------|----------------|
| CLAUDE.md support | Create project instructions | `CLAUDE.md` |
| Rules directory | Create rules/ directory | `.claude/rules/` |

## Future Version Template

When checking new releases, extract:

```markdown
## vX.Y.Z (YYYY-MM)

| Feature | Config Change | Files Affected |
|---------|---------------|----------------|
| [Feature name] | [What to change] | [Files to modify] |

**Applied Check:**
```bash
# Verification command
```

**Implementation Pattern:**
```code
# Code snippet if applicable
```
```

## Deprecated Patterns

| Version | Deprecated | Replacement |
|---------|-----------|-------------|
| v2.1.3 | Separate commands/*.md for skills | Skill-only (auto-registered) |
| v2.1.2 | Processing all SessionStart events | Check agent_type first |

## Migration Guides

### Skill/Command Merge (v2.1.3)

Before:
```
skills/my-skill/SKILL.md
commands/my-skill.md  # Duplicate!
```

After:
```
skills/my-skill/SKILL.md  # Auto-registered as /my-skill
```

### SessionStart Optimization (v2.1.2)

Before:
```bash
#!/bin/bash
# Heavy processing for all agents
LEDGER=$(find_ledger)
echo "$LEDGER"
```

After:
```bash
#!/bin/bash
INPUT=$(cat)
AGENT_TYPE=$(echo "$INPUT" | jq -r '.agent_type // "main"')
if [[ "$AGENT_TYPE" != "main" ]]; then
    exit 0
fi
# Heavy processing only for main agent
LEDGER=$(find_ledger)
echo "$LEDGER"
```
