---
description: Validate plan tech choices against best practices
---

Validate a plan's technology choices against current best practices (2024-2025).

## Instructions

### 1. Read Plan

```bash
cat thoughts/shared/plans/<plan-file>.md
```

### 2. Extract Tech Choices

Identify from the plan:
- Libraries/frameworks
- Patterns/architectures
- APIs/services
- Implementation approaches

### 3. Check Past Precedent

```
dev_ledger(action="search", keyword="<tech-choice>")
dev_reasoning(action="recall", keyword="<tech-choice>")
```

Look for:
- Past successes (patterns to follow)
- Past failures (patterns to avoid)

### 4. Research Each Choice

Use WebSearch:
```
"[library] best practices 2024 2025"
"[library] vs alternatives"
"[pattern] deprecated OR recommended"
```

### 5. Assess Findings

For each tech choice:
- **VALID** - Current best practice
- **OUTDATED** - Better alternatives exist
- **DEPRECATED** - Should not use
- **RISKY** - Security concerns
- **UNKNOWN** - Insufficient info

### 6. Create Report

Save to `thoughts/handoffs/<session>/validation-<plan>.md`:

```markdown
---
type: validation
status: [VALIDATED | NEEDS REVIEW]
plan_file: [path]
---

# Plan Validation: [Name]

## Overall Status: VALIDATED | NEEDS REVIEW

## Tech Choices Validated

### 1. [Choice]
**Status:** VALID
**Findings:** [evidence]
**Recommendation:** Keep as-is

### 2. [Choice]
**Status:** OUTDATED
**Findings:** [evidence]
**Recommendation:** Consider [alternative]

## Summary

### Validated:
- Choice 1 ✓
- Choice 2 ✓

### Needs Review:
- Choice 3 - [reason]

### Must Change:
- Choice 4 - [reason + alternative]
```

### 7. Update Ledger

```
dev_ledger(action="update", content="Validation: [status]")
```

## Status Thresholds

**VALIDATED** when:
- All choices valid, OR
- Only minor suggestions

**NEEDS REVIEW** when:
- Any DEPRECATED choice
- Security concerns (RISKY)
- Significantly OUTDATED
- Critical architectural issues

## Skip Validation For

- Standard library (always valid)
- Established tools (pytest, git, make)
- Common patterns (REST, JSON)

## Examples

```bash
/dev-flow:validate thoughts/shared/plans/2025-01-10-auth.md
/dev-flow:validate                  # Validate most recent plan
```
