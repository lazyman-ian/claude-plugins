#!/bin/bash
# Session start hook - shows project status and active tasks

# Output format for Claude
output() {
  echo '{"result":"continue","message":"'"$1"'"}'
}

# Get git root
GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [ -z "$GIT_ROOT" ]; then
  output "Not a git repository"
  exit 0
fi

# Get current branch
BRANCH=$(git branch --show-current 2>/dev/null)

# Extract TASK ID from branch
TASK_ID=$(echo "$BRANCH" | grep -oE 'TASK-[0-9]+')

# Check for active ledger
LEDGER_DIR="$GIT_ROOT/thoughts/ledgers"
ACTIVE_LEDGER=""
if [ -n "$TASK_ID" ] && [ -d "$LEDGER_DIR" ]; then
  ACTIVE_LEDGER=$(ls "$LEDGER_DIR" 2>/dev/null | grep "^$TASK_ID" | head -1)
fi

# Build status message
STATUS="Branch: $BRANCH"
if [ -n "$TASK_ID" ]; then
  STATUS="$STATUS | Task: $TASK_ID"
fi
if [ -n "$ACTIVE_LEDGER" ]; then
  STATUS="$STATUS | Ledger: $ACTIVE_LEDGER"
fi

# Check for uncommitted changes
CHANGES=$(git status --short 2>/dev/null | wc -l | tr -d ' ')
if [ "$CHANGES" -gt 0 ]; then
  STATUS="$STATUS | Changes: $CHANGES files"
fi

# Check PR status
PR_STATE=$(gh pr view --json state -q .state 2>/dev/null)
if [ -n "$PR_STATE" ]; then
  STATUS="$STATUS | PR: $PR_STATE"

  # Suggest archive if merged
  if [ "$PR_STATE" = "MERGED" ] && [ -n "$ACTIVE_LEDGER" ]; then
    STATUS="$STATUS | 💡 Consider: /dev ledger archive $TASK_ID"
  fi
fi

output "$STATUS"
