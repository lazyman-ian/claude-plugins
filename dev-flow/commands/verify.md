---
description: Run verification suite (lint + typecheck + tests)
---

# /dev-flow:verify

```bash
/dev-flow:verify          # Full: lint + build + test
/dev-flow:verify --quick  # Quick: lint + check only
```

## Flow

1. `dev_config(format="json")` → get platform commands
2. Execute in order (stop on first failure):
   - `lintCheck` → `buildCmd` (skip if --quick) → `testCmd` (skip if --quick)
   - Or use combined `verifyCmd` for full verification
3. Report pass/fail per step
