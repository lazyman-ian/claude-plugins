---
description: Complete development on current branch and choose next action
disable-model-invocation: true
---

# /dev-flow:finish

Complete development on the current branch. Runs verification, then presents options for branch disposition.

## Process

### Step 1: Verify

Run verification to confirm branch is in good state:

```bash
# Get platform verify command
dev_config()
# Run verify command from dev_config result
```

If verification fails → stop and show errors. Do not proceed.

### Step 2: Detect Base Branch

```bash
# Check for common base branches
for branch in main master develop; do
  if git rev-parse --verify "$branch" >/dev/null 2>&1; then
    BASE="$branch"
    break
  fi
done
```

### Step 3: Present Options

Use AskUserQuestion with 4 options:

```
AskUserQuestion({
  questions: [{
    question: "Branch is verified. How do you want to proceed?",
    header: "Branch",
    options: [
      { label: "Push & Create PR (Recommended)", description: "Push branch and create PR via /dev pr" },
      { label: "Merge locally", description: "Merge into {base} branch locally" },
      { label: "Keep branch", description: "Leave branch as-is, no action" },
      { label: "Discard work", description: "Switch to {base} and delete this branch (destructive)" }
    ],
    multiSelect: false
  }]
})
```

### Step 4: Execute Choice

| Choice | Action |
|--------|--------|
| Push & Create PR | `git push -u origin {branch}` → invoke `/dev pr` |
| Merge locally | `git checkout {base} && git merge {branch}` |
| Keep branch | No action, inform user |
| Discard work | Confirm with "type DISCARD to confirm" → `git checkout {base} && git branch -D {branch}` |

### Step 5: Update Ledger

If ledger exists for this branch:
```
dev_ledger(action='update', commitMessage='Branch finished: {choice}')
```
