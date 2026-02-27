---
# No paths: — applies globally
---

# Security Rules

## Input Validation
- Validate at system boundaries (user input, external APIs)
- Trust internal code and framework guarantees
- Sanitize before database queries or shell execution

## Credentials
- Never commit .env, credentials, API keys
- Use environment variables for secrets
- Check `.gitignore` covers sensitive files

## Dependencies
- Review new dependency security before adding
- Keep dependencies updated (check CVEs)
- Prefer well-maintained packages with active security response

## Hook & Plugin Safety
- Quote all shell variables in hooks
- No network calls (curl/wget) in hooks without explicit documentation
- No eval/exec of dynamic content
