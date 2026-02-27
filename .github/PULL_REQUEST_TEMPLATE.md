## Summary

<!-- 1-3 bullet points describing the change -->
-
-
-

## Changes

<!-- List of files modified and what changed -->

## Test Plan

- [ ] Tests pass: `npm test --prefix dev-flow/mcp-server`
- [ ] Plugin validation passes: `./scripts/validate-plugins.sh`
- [ ] Manual verification (if applicable):

## Review Checklist

- [ ] No new security vulnerabilities introduced
- [ ] SKILL.md files are < 500 lines with proper frontmatter (name, description with triggers, allowed-tools)
- [ ] Hook scripts use safe patterns (`set -o pipefail`, quoted variables, jq fallbacks)
- [ ] No hardcoded credentials or .env files committed
- [ ] Agent frontmatter valid (name, description, model, color; no `tools:` field)
- [ ] Plugin manifest valid (auto-discovered agents/ and hooks/hooks.json)

## Related

<!-- Links to issues, plans, or discussion -->
Fixes #
Related to #
