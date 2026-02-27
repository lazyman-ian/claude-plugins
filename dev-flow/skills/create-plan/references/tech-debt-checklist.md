# Tech Debt Analysis Checklist

Reference for tech-debt reduction plans. Provides quantifiable dimensions for assessment.

## When to Use

Plan description contains: "tech debt", "refactor", "技术债", "重构", "cleanup", "modernize"

## Debt Dimensions

### 1. Code Debt

| Smell | Detection | Threshold |
|-------|-----------|-----------|
| Long methods | Line count per function | > 50 lines |
| God classes | Methods + lines per class | > 20 methods or > 500 lines |
| Duplicate code | Similar logic blocks | > 3 occurrences |
| Deep nesting | Conditional depth | > 3 levels |
| High complexity | Cyclomatic complexity | > 10 per function |
| Dead code | Unused functions/imports | Any |
| Magic numbers | Hardcoded literals | Any non-obvious |

**Quick scan commands**:
```
Grep("TODO|FIXME|HACK|XXX|WORKAROUND")  → known debt markers
Grep("swiftlint:disable|nolint|noqa")    → suppressed warnings
```

### 2. Architecture Debt

| Issue | Signal | Impact |
|-------|--------|--------|
| Circular dependencies | A imports B imports A | Build order fragile |
| Leaky abstractions | Internal types in public API | Coupling |
| Missing boundaries | Feature code in shared/ | Change amplification |
| Monolithic components | Single file > 1000 lines | Hard to test/modify |
| Inconsistent patterns | Mixed paradigms in same layer | Cognitive load |

### 3. Testing Debt

| Gap | How to Measure | Priority |
|-----|---------------|----------|
| No tests for critical path | Coverage on business logic | P0 |
| Flaky tests | CI failure rate | P1 |
| Slow test suite | Total runtime | P1 |
| No integration tests | Only unit tests exist | P2 |
| Outdated test fixtures | Last modified date | P3 |

### 4. Dependency Debt

| Issue | Detection | Risk |
|-------|-----------|------|
| Outdated major versions | `npm outdated` / `pod outdated` | Security + compatibility |
| Abandoned dependencies | Last commit > 1 year | No fixes available |
| Duplicate dependencies | Multiple versions of same lib | Bundle size |
| Missing lock file | No Podfile.lock / package-lock | Non-reproducible builds |

### 5. Documentation Debt

| Gap | Signal |
|-----|--------|
| No API docs | Public functions without docstrings |
| Outdated README | Last update > 6 months |
| Missing architecture docs | No diagrams for complex flows |
| Undocumented config | Config files without comments |

## Prioritization Matrix

```
            High Impact
                │
    P1 ─────────┼───────── P0
    (Schedule)  │  (Fix Now)
                │
  ──────────────┼──────────────
                │
    P3 ─────────┼───────── P2
    (Backlog)   │  (Opportunistic)
                │
            Low Impact
     High Effort ──────── Low Effort
```

| Priority | Action | Example |
|----------|--------|---------|
| P0 | Fix immediately | Security vulnerability, data loss risk |
| P1 | Plan into next sprint | Flaky tests, missing critical tests |
| P2 | Fix when touching the code | Poor naming, missing types |
| P3 | Track but don't schedule | Style inconsistencies, old patterns |

## Output Format

Plan should include:
1. **Debt Inventory** — list with dimension + priority
2. **Effort Estimate** — per item (S/M/L)
3. **Dependencies** — which items must be fixed in order
4. **Verification** — `dev_config → check` + specific test commands
