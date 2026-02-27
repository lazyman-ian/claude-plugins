# research-plugin

Research tools for documentation, codebase exploration, and session analysis.

## Quick Reference

| Action | Command |
|--------|---------|
| Install | `claude plugins add research@lazyman-ian` |

## Structure

- `skills/` - 3 skills (research-agent, rp-explorer, token-analyzer)
- `agents/` - 3 agents (braintrust-analyst, repo-research-analyst, research-agent)
- `commands/` - 4 commands (analyze, explore, research, summary)

## Skills

| Skill | Purpose |
|-------|---------|
| research-agent | External docs/API research via Perplexity, WebSearch, WebFetch |
| rp-explorer | Token-efficient codebase exploration via RepoPrompt |
| token-analyzer | Analyze token usage patterns and suggest optimizations |

## Agents

| Agent | Purpose |
|-------|---------|
| braintrust-analyst | Analyze Claude Code sessions from Braintrust logs |
| repo-research-analyst | Analyze repository structure, patterns, and conventions |
| research-agent | Research external documentation and best practices |

## Plugin Manifest Rules

Auto-discovered (don't declare in plugin.json):
- `agents/` directory
- `hooks/hooks.json`
