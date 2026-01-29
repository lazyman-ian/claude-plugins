---
description: Explore codebase using RepoPrompt (token-efficient)
---

Explore and understand a codebase using RepoPrompt CLI.

## Instructions

1. **Get overview**:
   ```bash
   rp-cli -e 'tree --folders'
   rp-cli -e 'structure .'
   ```

2. **Search for patterns**:
   ```bash
   rp-cli -e 'search "pattern" --context-lines 2'
   ```

3. **Deep dive on area**:
   ```bash
   rp-cli -e 'select set src/auth/'
   rp-cli -e 'structure --scope selected'
   rp-cli -e 'read src/auth/login.ts'
   ```

4. **Export context**:
   ```bash
   rp-cli -e 'context --all > codebase-map.md'
   ```

## Commands

| Command | Purpose |
|---------|---------|
| `tree` | File/folder tree |
| `structure` | Code signatures (token-efficient) |
| `search` | Search with context |
| `read` | Read file contents |
| `select` | Manage file selection |
| `context` | Export workspace context |
| `builder` | AI-powered file selection |

## Workflow

### Quick Overview
```bash
rp-cli -e 'tree && structure .'
```

### Find Feature Code
```bash
rp-cli -e 'builder "find auth system"'
rp-cli -e 'search "login" --extensions .swift'
```

### Understand Module
```bash
rp-cli -e 'select set HouseSigma/Auth/'
rp-cli -e 'structure --scope selected'
```

## Examples

- `/explore` - Get codebase overview
- `/explore auth` - Find and analyze auth system
- `/explore how does routing work` - AI-powered exploration
