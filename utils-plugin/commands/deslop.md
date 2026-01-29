---
description: Remove AI-generated code slop from current branch
---

Remove AI-generated redundant code (slop) from modified files.

## Instructions

1. **Get diff from base branch**:
   ```bash
   git diff --name-only $(git merge-base HEAD develop)..HEAD
   ```

2. **For each modified file**, identify and remove:

   | Slop Type | Example | Action |
   |-----------|---------|--------|
   | Redundant comments | `// Get user` before `getUser()` | Delete |
   | Over-defensive | try/catch in internal functions | Delete |
   | Type escapes | `as any`, `as! Type` | Fix or delete |
   | Style inconsistency | Different naming than file | Unify |
   | Debug logs | `print("start")` | Delete |

3. **Preserve**:
   - `// MARK:` section comments
   - `// TODO:` / `// FIXME:`
   - Complex logic explanations
   - Public API documentation

4. **Report**:
   ```
   Removed 5 redundant comments and 2 unnecessary try/catch from UserService.swift.
   ```

## Options

- `/deslop` - Check and clean current branch
- `/deslop --dry-run` - Report only, no modifications

## Examples

### Is Slop
```swift
// Check if user is null  // <- redundant
if user == nil { return }

try {                       // <- over-defensive
    internalMethod()
} catch { /* never happens */ }
```

### Not Slop
```swift
// Use exponential backoff to avoid thundering herd  // <- explains why
let delay = baseDelay * pow(2.0, attempt)

// MARK: - Lifecycle  // <- section marker
```
