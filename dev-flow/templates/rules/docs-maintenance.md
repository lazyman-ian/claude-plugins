---
paths:
  - "docs/**"
  - "CLAUDE.md"
---

# Documentation Maintenance

## Auto-Recording Rules

| Event | Update |
|-------|--------|
| Task completed | `docs/memory.md` |
| Architecture/design choice made | `docs/decisions.md` |
| New API module or service added | `docs/toolbox.md` |
| New term or abbreviation introduced | `docs/glossary.md` |
| New skill/command available | `docs/skills.md` |

## CLAUDE.md Constraints

- Target: 50-100 lines of actual content (max 200)
- Code style rules belong in linter/formatter config, not CLAUDE.md
- One-time code patterns belong in `docs/decisions.md`
- API documentation belongs in `docs/toolbox.md`
- Use `@docs/` imports for progressive loading
