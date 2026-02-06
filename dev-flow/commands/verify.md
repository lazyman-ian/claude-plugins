---
description: Run verification suite (lint + typecheck + tests)
---

# /dev-flow:verify - Verification Suite

Run the full verification suite for the current platform. Implements Verification-Driven Development (VDD).

## Core Principle

| Traditional | VDD |
|-------------|-----|
| "Fix the bug" | "Fix the bug, `npm test auth` should pass" |
| Agent judges completion | exit code 0 judges completion |
| Manual verification | Automatic verification |

## Usage

```bash
/dev-flow:verify          # Full verification (lint + check + test)
/dev-flow:verify --quick  # Quick mode (lint + check only, skip tests)
```

## Execution Flow

### Step 1: Get Platform Commands

```
dev_config(format="json")
```

This returns platform-specific verification commands.

### Step 2: Run Verification

Execute in order (stop on first failure):

1. **Lint Check**: `lintCheck` command
2. **Build Check**: `buildCmd` (if --quick not specified)
3. **Tests**: `testCmd` (if --quick not specified)

Or use the combined `verifyCmd` for full verification.

### Step 3: Report Results

**Success Output:**
```
✅ Verification passed (3/3)
   ├── lint: passed
   ├── build: passed
   └── tests: 42 passed
```

**Failure Output:**
```
❌ Verification failed (1/3)
   ├── lint: passed
   ├── build: FAILED (2 errors)
   │   └── error: Type 'string' is not assignable to type 'number'
   └── tests: skipped

Run `dev_fix` to auto-fix lint issues, or fix errors manually.
```

## Platform Commands

| Platform | lint | build | test |
|----------|------|-------|------|
| iOS | swiftlint | xcodebuild build | xcodebuild test |
| Android | ktlintCheck | assembleDebug | gradle test |
| Python | ruff + mypy | - | pytest |
| Node | eslint + tsc | tsc | npm test |

## Integration with /dev commit

The commit flow automatically runs verification:

```
/dev commit
  → dev_config → get verify command
  → execute verify
  → failure → block commit
  → success → continue commit
```

## VDD Task Template

When creating tasks, always include verification:

```
❌ "Fix the login bug"
✅ "Fix the login bug. Verify: `npm test auth` exits 0"
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All verifications passed |
| 1 | Lint/check failed |
| 2 | Build failed |
| 3 | Tests failed |

## Examples

### Quick Check (Before Commit)
```bash
/dev-flow:verify --quick
# Only runs lint and type checks
```

### Full Verification (Before PR)
```bash
/dev-flow:verify
# Runs lint, build, and tests
```

### Targeted Test
```bash
/dev-flow:verify --test "auth"
# Runs full verify but filters tests to "auth" pattern
```
