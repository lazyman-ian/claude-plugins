---
# No paths: — applies globally
---

# Testing Rules

## Verification-Driven Development (VDD)
- Every task includes a verify command
- Machine judges completion, not agent
- Success = exit code 0

## Test Writing
- Test behavior, not implementation
- One assertion per test concept
- Use descriptive test names: "should {behavior} when {condition}"
- Arrange-Act-Assert structure

## Coverage
- New features require tests
- Bug fixes require regression test
- Refactors must not break existing tests

## Commands
- Quick check: project lint + type check
- Full verify: lint + build + test
- Use `/dev verify` for automated verification
