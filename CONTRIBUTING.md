# Contributing to claude-plugins

This guide covers development patterns for skills, agents, hooks, and commands in the claude-plugins monorepo.

## Skill Development

Skills are the primary extension mechanism. Each skill lives in `plugin-name/skills/skill-name/` with a SKILL.md file and optional references directory.

### SKILL.md Format

```yaml
---
name: skill-name                # lowercase, alphanumeric + hyphens (max 64 chars)
description: >-
  One-sentence what it does. This skill should be used when [trigger condition].
  Triggers on "[keyword1]", "[keyword2]", "[中文关键词]".
  Do NOT use for [non-triggers].
allowed-tools: [Read, Grep, Glob]  # Restrict tool access
model: sonnet                       # Optional: sonnet, opus, haiku
memory: project                     # Optional: project or user
---
```

### Requirements

- **< 500 lines** in SKILL.md (use references/ for detailed docs)
- **Description is critical**: Claude reads only name + description at startup. Include trigger keywords in English and Chinese.
- **Include negative triggers**: State what the skill should NOT be used for to prevent incorrect triggering.
- **allowed-tools**: Restrict to necessary tools. Omit if full access needed.

### Example Skill Structure

```
compose-expert/
├── SKILL.md                         # Overview + frontmatter
└── references/
    ├── composables-guide.md         # Detailed reference
    ├── performance-patterns.md      # Best practices
    └── examples.md                  # Code examples
```

## Agent Development

Agents are spawned via Task tool for complex multi-step operations. Each agent is a markdown file in `plugin-name/agents/`.

### Agent Frontmatter

```yaml
---
name: agent-name
description: What it does. Use when [context]. Triggers on "[keywords]".
model: sonnet                     # sonnet, opus, haiku (required)
color: blue                       # Optional: blue, green, red, yellow
---
```

### Rules

- **No `tools:` field**: Tools must be specified in user request (not in frontmatter)
- **Auto-discovered**: Agents in `agents/` directory are automatically registered
- **Single model per agent**: Use `model` field to select appropriate model for task complexity

### Example Agent

```
agents/
├── code-reviewer.md             # Reviews code for quality
├── migration-scanner.md         # Finds deprecated APIs
└── references/
    ├── security-checklist.md
    └── code-quality-checklist.md
```

## Hook Development

Hooks automate validation and code quality checks. Hooks are defined in `plugin-name/hooks/hooks.json`.

### hooks.json Format

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/hooks/scripts/my-check.sh",
            "timeout": 30,
            "statusMessage": "Checking code quality..."
          }
        ]
      }
    ]
  }
}
```

### Hook Script Best Practices

```bash
#!/bin/bash
set -o pipefail  # Exit on pipe failure, NOT set -e (breaks jq)

# 1. Early exit for non-target files
[[ "$target_file" =~ \.swift$ ]] || exit 0

# 2. Verify stdin is JSON
input=$(cat)
[[ -z "$input" ]] && exit 0

# 3. Use jq with fallback
result=$(echo "$input" | jq -r '.path' 2>/dev/null || echo "")
[[ -z "$result" ]] && exit 0

# 4. Use full paths for aliased commands
/usr/bin/sed -i 's/old/new/' file.txt    # NOT: sed
/usr/bin/find . -name "*.txt"            # NOT: find
/usr/bin/curl -s https://...             # NOT: curl

# 5. Use builtin for shell builtins, but NOT for external programs
builtin cd /path || exit 1               # OK: cd is shell builtin
# npm run build                          # OK: no builtin needed

# 6. For external programs needing directory change, use --prefix / -C flags
npm run --prefix /path build
git -C /path status
make -C /path target
```

### Hook Matcher Syntax

| Pattern | Matches |
|---------|---------|
| `Write\|Edit` | Write or Edit tools |
| `Bash(npm test*)` | Bash with npm test commands |
| `Bash(*git commit*)` | Bash containing git commit (including chained) |
| `*` | All tools |
| `mcp__*` | All MCP tools |

### Hook Types

| Type | When to Use | Example |
|------|------------|---------|
| `command` | Shell script validation | lint/format checks |
| `prompt` | LLM-evaluated decisions | security review |
| `agent` | Complex multi-turn checks | detailed code review |

## Testing

### MCP Server Tests

```bash
# Install dependencies
npm install --prefix dev-flow/mcp-server

# Run tests (if configured)
npm test --prefix dev-flow/mcp-server

# Build bundle
npm run --prefix dev-flow/mcp-server bundle
```

### Plugin Validation

```bash
# Validate all plugins
./scripts/validate-plugins.sh

# Expected output:
# ✅ dev-flow: 22 skills, 28 commands, 14 agents
# ✅ ios-swift-plugin: 16 skills, 4 commands, 4 agents
# ✅ android-kotlin-plugin: 7 skills, 2 commands, 2 agents
```

### Manual Testing

1. **Local installation**:
   ```
   /plugin marketplace add /path/to/claude-plugins
   /plugin install dev-flow@lazyman-ian
   ```

2. **Skill triggering**: Ask Claude about skill trigger keywords
   ```
   "When would you use the compose-expert skill?"
   ```

3. **Agent spawning**: Use `/dev` commands or Task tool to spawn agents

## Commit Convention

Always use `/dev commit` (never raw `git commit`):

```
/dev commit
```

This enforces:
- Scope inference from code changes
- Pre-commit validation (lint/format checks)
- Conventional Commits format: `type(scope): subject`
- Reasoning documentation in `.git/claude/commits/`

## Plugin Structure Rules

### Required Files

```
plugin-name/
├── .claude-plugin/
│   └── plugin.json         # Manifest with name, version, skills, commands
├── skills/                 # Skill definitions
│   └── skill-name/
│       ├── SKILL.md        # < 500 lines with frontmatter
│       └── references/     # Detailed docs (optional)
├── commands/               # Command definitions (optional)
├── agents/                 # Agent prompts (auto-discovered)
├── hooks/                  # Hooks
│   └── hooks.json         # Wrapped in "hooks" object
└── docs/                   # Documentation (optional)
```

### Auto-Discovered (don't declare in plugin.json)

- `agents/` directory
- `hooks/hooks.json`

### Plugin Manifest Validation

**Unsupported fields** (will cause validation error):
- `bundledMcpServers` → Use `mcpServers: "./.mcp.json"`
- `agents` → Auto-discovered
- `hooks` → Auto-discovered

## Code Quality Checklist

Before submitting a PR:

- [ ] SKILL.md files have proper frontmatter (name, description with triggers)
- [ ] SKILL.md files are < 500 lines
- [ ] Descriptions state when to use skill + trigger keywords (EN + CN)
- [ ] Negative triggers prevent incorrect triggering
- [ ] Hook scripts use `set -o pipefail` (NOT `set -eo`)
- [ ] Hook scripts quote variables: `"$var"` not `$var`
- [ ] Hook scripts use full paths for aliased commands: `/usr/bin/sed`
- [ ] Agent frontmatter valid (no `tools:` field)
- [ ] No hardcoded credentials or API keys
- [ ] No XML angle brackets (`<` `>`) in frontmatter (could inject instructions)
- [ ] Plugin manifest passes validation
- [ ] Tests pass: `npm test --prefix dev-flow/mcp-server`
- [ ] Plugin validation passes: `./scripts/validate-plugins.sh`

## Common Patterns

### Trigger Pattern

Good description:
```yaml
description: >-
  Creates detailed implementation plans with task breakdowns and verification
  criteria. This skill should be used when you have clear requirements and
  need a concrete technical plan. Triggers on "create plan", "implementation plan",
  "plan feature", "制定计划", "设计方案", "规划功能".
  Do NOT use for open-ended design exploration — use brainstorm instead.
```

Bad description (too vague):
```yaml
description: Helps with planning  # Won't trigger
```

### Memory Integration

Skills that benefit from project history should include:
```yaml
memory: project   # Project-scoped knowledge
```

or

```yaml
memory: user      # Cross-project patterns
```

## Monorepo Architecture

This monorepo contains 5 independent plugins:

| Plugin | Purpose | Structure |
|--------|---------|-----------|
| dev-flow | Workflow automation (MCP server) | 22 skills, 28 cmds, 14 agents |
| ios-swift-plugin | iOS/Swift toolkit | 16 skills, 4 cmds, 4 agents |
| android-kotlin-plugin | Android/Kotlin toolkit | 7 skills, 2 cmds, 2 agents |
| utils-plugin | Code quality tools | 2 skills, 2 cmds |
| research-plugin | Research tools | 3 skills, 4 cmds, 3 agents |

### Publishing

All plugins publish to `lazyman-ian` marketplace via `.claude-plugin/marketplace.json`.

## Getting Help

See CLAUDE.md for architecture details and MCP tool documentation.
