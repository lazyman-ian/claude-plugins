---
# No paths: — applies globally
---

# Git Workflow Rules

## Commits
- Use `/dev commit` (never raw git commit)
- Format: `type(scope): subject`
- Types: feat, fix, refactor, perf, test, docs, chore
- Subject: imperative mood, lowercase, no period, ≤50 chars
- No AI attribution (no Co-Authored-By)

## Branches
- Feature: `feature/TASK-{id}-{name}`
- Bugfix: `fix/TASK-{id}-{name}`
- Keep branches short-lived

## PRs
- Use `/dev pr` for auto-push and formatting
- PR title matches main commit message
- Include test plan in PR body
