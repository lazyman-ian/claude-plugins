---
# No paths: — applies globally
---

# Security Rules

## Hook & Plugin Safety
- Quote all shell variables in hooks
- No network calls (curl/wget) in hooks without explicit documentation
- No eval/exec of dynamic content
