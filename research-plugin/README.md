# Research Plugin

Claude Code plugin for research, documentation lookup, and session analysis.

## Features

### Skills
- **research-agent** - Research using Perplexity, Context7, Firecrawl
- **rp-explorer** - Token-efficient codebase exploration with RepoPrompt

### Commands
- `/research <query>` - Research topics using Perplexity AI
- `/analyze` - Analyze Claude Code sessions from Braintrust
- `/explore` - Explore codebase using RepoPrompt

### Agents
- **research-agent** - External documentation and best practices research
- **repo-research-analyst** - Repository structure and pattern analysis
- **braintrust-analyst** - Session analysis and optimization insights

## Installation

```bash
claude plugins add research@lazyman-ian
```

## Requirements

- **Perplexity API** - Set `PERPLEXITY_API_KEY` in `~/.claude/.env`
- **Braintrust API** - Set `BRAINTRUST_API_KEY` for session analysis
- **RepoPrompt** - Install RepoPrompt app for codebase exploration

## Usage

### Research

```bash
# Quick question
/research what is MCP

# Best practices research
/research best practices for Swift concurrency

# Decision support
/research --reason Core Data vs SwiftData

# Deep comprehensive research
/research --deep state of iOS architecture 2025
```

### Session Analysis

```bash
# Analyze last session
/analyze

# Detect loops
/analyze loops

# Extract learnings
/analyze learn

# Weekly summary
/analyze weekly
```

### Codebase Exploration

```bash
# Get overview
/explore

# Find specific feature
/explore auth system

# AI-powered exploration
/explore how does routing work
```

## Scripts

Python scripts in `scripts/` directory:
- `perplexity_search.py` - Perplexity AI search
- `braintrust_analyze.py` - Session analysis
- `firecrawl_scrape.py` - Web scraping
- `nia_docs.py` - Documentation lookup
- `github_search.py` - GitHub search

## License

MIT
