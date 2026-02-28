---
description: Search historical knowledge and decisions
---

Search past knowledge entries and ledger decisions. Arguments: "keyword"

## Instructions

1. **Search knowledge vault**:
   ```
   dev_memory(action="search", query="$ARGUMENTS")
   ```

2. **Search ledgers**:
   ```
   dev_ledger(action="search", keyword="$ARGUMENTS")
   ```

3. **Format output**:
   ```
   🔍 Searching for "$ARGUMENTS"...

   ## Knowledge Vault
   ### pitfall: MainActor isolation issue (critical)
   Platform: ios | Tags: concurrency, MainActor
   ...

   ### decision: RecaptchaEnterprise SDK choice
   Platform: ios | Tags: auth, sdk
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
