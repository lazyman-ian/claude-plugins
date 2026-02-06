---
name: app-changelog
description: Generate App Store release notes from git history
argument-hint: [from-tag]
allowed-tools: [Bash, Read]
model: haiku
---

# App Store Changelog Generator

Generate user-facing App Store "What's New" text from git commit history.

## Target

From tag: $1 (default: previous tag if not specified)

## Workflow

### 1. Find Previous Tag

```bash
git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0"
```

### 2. Get Commits

```bash
git log --oneline --no-merges $1..HEAD 2>/dev/null || git log --oneline --no-merges -30
```

### 3. Categorize Changes

Group commits by type (from Conventional Commits):

| Type | User-Facing Category |
|------|---------------------|
| `feat` | New Features |
| `fix` | Bug Fixes |
| `perf` | Performance Improvements |
| `ui`, `style` | UI Improvements |
| `a11y` | Accessibility |

**Ignore** (internal):
- `chore`, `ci`, `test`, `docs`, `refactor`, `build`

### 4. Generate Release Notes

Format for App Store:

```
What's New in [Version]

🚀 New Features
• [Feature description in user terms]

🐛 Bug Fixes
• [Fix description - what was broken, now works]

⚡ Performance
• [Improvement in user terms]

🎨 UI Improvements
• [Visual change description]
```

## Guidelines

- **User perspective**: Write for end users, not developers
- **Benefits, not changes**: "Photos load faster" not "Optimized image caching"
- **Concise**: 1-2 lines per item
- **No jargon**: Avoid technical terms
- **Bilingual**: Provide both English and Chinese versions

## Output Format

```markdown
## English

What's New in v1.2.0

🚀 New Features
• ...

## 中文

v1.2.0 更新内容

🚀 新功能
• ...
```

## Exclude from Changelog

- Commits with `[skip-changelog]`
- Internal refactoring
- Test-only changes
- CI/CD configuration
- Documentation updates
