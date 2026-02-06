# Skill Development Guide

## Creating a New Skill

### File Structure

```
skills/<skill-name>/
├── SKILL.md              # Main skill file (< 500 lines)
└── references/           # Detailed docs (loaded on demand)
    └── example.md
```

### SKILL.md Frontmatter

```yaml
---
name: skill-name
description: What it does. Triggers on "keyword", "中文关键词".
model: sonnet              # sonnet, opus, or haiku
allowed-tools: [Read, Edit, Bash]
---
```

### Description Best Practices

- Start with what it does (1 sentence)
- Include trigger keywords (English + Chinese)
- Use third person: "This skill should be used when..."
- Max 1024 characters

### Trigger Keywords

- Include verbs: "create", "build", "fix", "analyze"
- Include domain terms: "API", "database", "test"
- Include Chinese equivalents

## Skill Quality Checklist

- [ ] Name: lowercase, alphanumeric + hyphens
- [ ] Description: < 1024 chars, includes triggers
- [ ] Allowed-tools: specific, not `[*]`
- [ ] File: < 500 lines (prefer < 300)
- [ ] Progressive loading: references/ for details
- [ ] Examples: concrete usage scenarios

## Plugin Development

### Manifest (plugin.json)

```json
{
  "name": "plugin-name",
  "version": "1.0.0",
  "description": "...",
  "skills": "./skills/",
  "commands": "./commands/",
  "mcpServers": "./.mcp.json"
}
```

### Auto-discovered (don't declare)

- `agents/` directory
- `hooks/hooks.json`
