---
description: Search historical reasoning and decisions
---

Search past commit reasoning and ledger decisions. Arguments: "keyword"

## Instructions

1. **Search reasoning**:
   ```
   dev_reasoning(action="recall", keyword="$ARGUMENTS")
   ```

2. **Search ledgers**:
   ```
   dev_ledger(action="search", keyword="$ARGUMENTS")
   ```

3. **Format output**:
   ```
   🔍 Searching for "$ARGUMENTS"...

   ## Commit Reasoning
   ### abc1234 (2 days ago)
   feat(auth): add reCAPTCHA

   Context: Chose RecaptchaEnterprise SDK because...
   Failed attempts: 2
   ...

   ## Ledgers
   ### TASK-945-Add-Google-reCAPTCHA.md (active)
   Key Decisions:
   - SDK: RecaptchaEnterprise
   - Architecture: Manager pattern
   ...

   ═══════════════════════════════════════
   Found X matches for "$ARGUMENTS"
   ```

## Use Cases

- Find how similar problems were solved before
- Recall why certain decisions were made
- Avoid repeating past mistakes
- Reuse successful patterns
