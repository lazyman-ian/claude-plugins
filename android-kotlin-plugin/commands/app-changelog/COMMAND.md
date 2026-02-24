---
name: app-changelog
description: Generate Google Play release notes from git history
allowed-tools: [Bash, Read, Glob]
---

# App Changelog

Generate Google Play Store release notes from git commit history.

## Process

### 1. Get Recent Commits
```bash
git log --oneline --no-merges $(git describe --tags --abbrev=0 2>/dev/null || echo HEAD~20)..HEAD
```

### 2. Categorize Changes

Group commits by type:

| Type | Label |
|------|-------|
| feat | New Features |
| fix | Bug Fixes |
| perf | Performance |
| ui | UI Improvements |

### 3. Generate Notes

Format for Google Play (max 500 characters):

```
What's New:

🆕 New Features
- [Feature description]

🐛 Bug Fixes
- [Fix description]

⚡ Performance
- [Improvement description]
```

### 4. Multi-Language (Optional)

If user provides translation context:
- Generate English (en-US) primary
- Translate to requested languages (zh-CN, ja, ko, etc.)
- Output per Google Play's locale directory structure

## Output
- Console: formatted release notes
- Optional: write to `fastlane/metadata/android/en-US/changelogs/[versionCode].txt`
