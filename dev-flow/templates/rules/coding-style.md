---
# No paths: frontmatter — applies globally
---

# Coding Style

## General
- Prefer explicit over implicit
- Function names: verb + noun (e.g., `fetchUser`, `validateInput`)
- Variable names: descriptive, avoid abbreviations
- Max line length: follow project formatter config
- One responsibility per function

## Structure
- Early return over nested conditionals
- Guard clauses at function entry
- Avoid deep nesting (max 3 levels)
- Group related code with blank lines

## Comments
- Only when logic isn't self-evident
- No redundant comments (e.g., `// increment counter` before `counter++`)
- TODO/FIXME with ticket reference when possible
