# Plan Template

Complete template for implementation plans.

## File Location

`thoughts/shared/plans/YYYY-MM-DD-ENG-XXXX-description.md`

## Template

````markdown
---
plan_version: "2.0"
status: draft              # draft | approved | in_progress | completed
created: YYYY-MM-DD
ticket: ENG-XXXX           # optional
phases:
  - id: 1
    name: "Phase Name"
    complexity: medium      # low | medium | high
    model: sonnet           # haiku | sonnet | opus
    parallelizable: false
    depends_on: []          # phase IDs
    target_files: ["path/to/file.ts"]
    verify: ["make test"]
  - id: 2
    name: "Phase Name"
    complexity: high
    model: opus
    parallelizable: true
    depends_on: [1]
    target_files: ["path/to/other.ts"]
    verify: ["npm run typecheck"]
key_decisions: {}           # populated during design exploration
---

# [Feature/Task Name] Implementation Plan

## Overview

[Brief description of what we're implementing and why]

## Current State Analysis

[What exists now, what's missing, key constraints discovered]

## Desired End State

[Specification of desired end state and how to verify it]

### Key Discoveries:
- [Important finding with file:line reference]
- [Pattern to follow]
- [Constraint to work within]

### Key Decisions (from Design Exploration):
<!-- Auto-populated from frontmatter key_decisions -->

## What We're NOT Doing

[Explicitly list out-of-scope items to prevent scope creep]

## Implementation Approach

[High-level strategy and reasoning]

## Phase 1: [Descriptive Name]

### Overview
[What this phase accomplishes]

### Changes Required:

#### 1. [Component/File Group]
**File**: `path/to/file.ext`
**Changes**: [Summary of changes]

```[language]
// Specific code to add/modify
```

### Success Criteria:

#### Automated Verification:
- [ ] Migration applies cleanly: `make migrate`
- [ ] Unit tests pass: `make test-component`
- [ ] Type checking passes: `npm run typecheck`
- [ ] Linting passes: `make lint`
- [ ] Integration tests pass: `make test-integration`

#### Manual Verification:
- [ ] Feature works as expected in UI
- [ ] Performance acceptable under load
- [ ] Edge case handling verified
- [ ] No regressions in related features

**Implementation Note**: After automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 2: [Descriptive Name]

[Similar structure...]

---

## Testing Strategy

### Unit Tests:
- [What to test]
- [Key edge cases]

### Integration Tests:
- [End-to-end scenarios]

### Manual Testing Steps:
1. [Specific step to verify]
2. [Another verification step]
3. [Edge case to test manually]

## Performance Considerations

[Any performance implications or optimizations]

## Migration Notes

[If applicable, how to handle existing data/systems]

## References

- Original ticket: `thoughts/allison/tickets/eng_XXXX.md`
- Related research: `thoughts/shared/research/[relevant].md`
- Similar implementation: `[file:line]`
````

---

## Frontmatter Guidelines

- **`parallelizable: true`** = phase has no `target_files` overlap with other parallel phases
- **`model`** based on complexity: `low` → haiku, `medium` → sonnet, `high` → opus
- **`verify`** is fallback; at runtime `dev_config()` takes priority for platform commands
- **`key_decisions`** populated during Design Exploration mode (persisted via `dev_handoff`)
- **Backward compatible**: `implement-plan` checks `plan_version`; if absent, falls back to legacy parsing

---

## Success Criteria Guidelines

**Always separate into two categories:**

### Automated Verification (run by agents)
- Commands: `make test`, `npm run lint`
- Specific files that should exist
- Code compilation/type checking
- Automated test suites

### Manual Verification (requires human)
- UI/UX functionality
- Performance under real conditions
- Hard-to-automate edge cases
- User acceptance criteria

### Example Format

```markdown
### Success Criteria:

#### Automated Verification:
- [ ] Database migration runs: `make migrate`
- [ ] All unit tests pass: `go test ./...`
- [ ] No linting errors: `golangci-lint run`
- [ ] API returns 200: `curl localhost:8080/api/endpoint`

#### Manual Verification:
- [ ] Feature appears correctly in UI
- [ ] Performance acceptable with 1000+ items
- [ ] Error messages user-friendly
- [ ] Works on mobile devices
```

---

## Common Patterns

### Database Changes
1. Start with schema/migration
2. Add store methods
3. Update business logic
4. Expose via API
5. Update clients

### New Features
1. Research existing patterns
2. Start with data model
3. Build backend logic
4. Add API endpoints
5. Implement UI last

### Refactoring
1. Document current behavior
2. Plan incremental changes
3. Maintain backwards compatibility
4. Include migration strategy
