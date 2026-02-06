---
description: Clean up merged branches
---

Clean up branches that have been merged to master.

## Instructions

1. **List merged branches**:
   ```
   dev_branch(action="merged")
   ```

2. **Preview cleanup** (dry run):
   ```
   dev_branch(action="cleanup", dryRun=true)
   ```

3. **Show branches to delete**:
   ```
   🔍 Finding merged branches...

   Found merged branches:
     - feature/TASK-890-refactor-error-handling
     - fix/TASK-773-fix-image-crash

   Delete these branches? (y/N)
   ```

4. **If confirmed**, execute cleanup:
   ```
   dev_branch(action="cleanup", dryRun=false)
   ```

5. **Prune remote tracking**:
   ```
   dev_branch(action="prune")
   ```

6. **Output**:
   ```
   ✅ Deleted: feature/TASK-890-refactor-error-handling
   ✅ Deleted: fix/TASK-773-fix-image-crash
   🔄 Remote tracking branches pruned
   ✅ Cleanup complete
   ```

## Related Commands

```
# List stale branches (no commits in 30 days)
dev_branch(action="stale", days=30)
```
