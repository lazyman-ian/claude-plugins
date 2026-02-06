---
description: Smart branch switching with auto-stash
---

Switch branches with automatic stash management. Arguments: BRANCH

## Instructions

1. **Execute smart switch**:
   ```
   dev_branch(action="switch", target="$ARGUMENTS")
   ```

2. **The tool automatically**:
   - Stashes uncommitted changes (if any)
   - Switches to target branch
   - Checks for existing stash for target branch

3. **Output scenarios**:

   **With uncommitted changes**:
   ```
   📦 Stashing changes from current-branch...
   ✅ Changes stashed
   🔀 Switching to $ARGUMENTS...
   ✅ Now on $ARGUMENTS
   ```

   **With existing stash for target**:
   ```
   🔀 Switching to $ARGUMENTS...
   📦 Found stash for $ARGUMENTS. Apply? (y/N)
   ```

   **Clean switch**:
   ```
   🔀 Switching to $ARGUMENTS...
   ✅ Now on $ARGUMENTS
   ```

## Examples

```bash
/dev-flow:switch feature/TASK-123-new-feature
/dev-flow:switch master
/dev-flow:switch fix/TASK-456-hotfix
```

## Related Commands

```
# Pop stash for current branch
dev_branch(action="stash-pop")

# List all stashes
git stash list
```
