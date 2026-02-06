#!/bin/bash
# Detect git actions from Bash tool usage
# Arguments: $1 = TOOL_INPUT, $2 = TOOL_OUTPUT

TOOL_INPUT="$1"
TOOL_OUTPUT="$2"

output() {
  echo '{"result":"continue","message":"'"$1"'"}'
}

# Detect git commit
if echo "$TOOL_INPUT" | grep -qE 'git commit'; then
  # Extract commit hash from output
  HASH=$(echo "$TOOL_OUTPUT" | grep -oE '[a-f0-9]{7,40}' | head -1)
  if [ -n "$HASH" ]; then
    output "Commit detected: $HASH. Consider: dev_reasoning(action='generate') to record reasoning."
    exit 0
  fi
fi

# Detect gh pr create
if echo "$TOOL_INPUT" | grep -qE 'gh pr create'; then
  # Extract PR URL from output
  PR_URL=$(echo "$TOOL_OUTPUT" | grep -oE 'https://github.com/[^[:space:]]+/pull/[0-9]+')
  if [ -n "$PR_URL" ]; then
    output "PR created: $PR_URL. Ledger should be updated with PR link."
    exit 0
  fi
fi

# Detect git checkout -b (new branch)
if echo "$TOOL_INPUT" | grep -qE 'git checkout -b'; then
  BRANCH=$(echo "$TOOL_INPUT" | grep -oE 'checkout -b [^ ]+' | sed 's/checkout -b //')
  TASK_ID=$(echo "$BRANCH" | grep -oE 'TASK-[0-9]+')
  if [ -n "$TASK_ID" ]; then
    output "New branch: $BRANCH. Consider creating ledger: dev_ledger(action='create', taskId='$TASK_ID')"
    exit 0
  fi
fi

# Detect git push with tag
if echo "$TOOL_INPUT" | grep -qE 'git push.*v[0-9]+\.[0-9]+'; then
  output "Release tag pushed. Consider archiving completed ledgers: /dev ledger archive"
  exit 0
fi

# No special action detected
output ""
