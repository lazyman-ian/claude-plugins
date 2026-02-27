#!/bin/bash
set -o pipefail

# SessionEnd Hook — Persist session state to .claude/sessions/
# Writes a markdown snapshot: branch, modified files, uncommitted changes, recent commits

INPUT=$(cat)

# Get project directory
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-}"
if [[ -z "$PROJECT_DIR" ]]; then
  PROJECT_DIR=$(git rev-parse --show-toplevel 2>/dev/null) || PROJECT_DIR=$(pwd)
fi

# Ensure sessions directory exists
SESSIONS_DIR="${PROJECT_DIR}/.claude/sessions"
mkdir -p "$SESSIONS_DIR" 2>/dev/null || true

# Timestamp for filename
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
SESSION_FILE="${SESSIONS_DIR}/session-${TIMESTAMP}.md"

# Gather git state (errors are silenced — hook must not crash)
BRANCH=$(git -C "$PROJECT_DIR" branch --show-current 2>/dev/null || echo "unknown")
MODIFIED_FILES=$(git -C "$PROJECT_DIR" status --short 2>/dev/null || echo "")
MODIFIED_COUNT=$(echo "$MODIFIED_FILES" | grep -c '.' 2>/dev/null || echo "0")
# Blank-line counts as 0
if [[ -z "$MODIFIED_FILES" ]]; then
  MODIFIED_COUNT=0
fi

# Recent commits within the last 2 hours (approximate session scope)
TWO_HOURS_AGO=$(date -v-2H +"%Y-%m-%d %H:%M:%S" 2>/dev/null || date -d "2 hours ago" +"%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "")
if [[ -n "$TWO_HOURS_AGO" ]]; then
  SESSION_COMMITS=$(git -C "$PROJECT_DIR" log --oneline --since="$TWO_HOURS_AGO" -5 2>/dev/null || echo "")
else
  # Fallback: last 5 commits regardless of time
  SESSION_COMMITS=$(git -C "$PROJECT_DIR" log --oneline -5 2>/dev/null || echo "")
fi

# Write session state file
{
  echo "# Session State — ${TIMESTAMP}"
  echo ""
  echo "## Info"
  echo ""
  echo "- **Timestamp**: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo "- **Branch**: ${BRANCH}"
  echo "- **Uncommitted changes**: ${MODIFIED_COUNT} file(s)"
  echo ""

  if [[ -n "$MODIFIED_FILES" ]]; then
    echo "## Modified Files"
    echo ""
    echo '```'
    echo "$MODIFIED_FILES"
    echo '```'
    echo ""
  fi

  if [[ -n "$SESSION_COMMITS" ]]; then
    echo "## Recent Commits (last 2h)"
    echo ""
    echo '```'
    echo "$SESSION_COMMITS"
    echo '```'
    echo ""
  fi
} > "$SESSION_FILE" 2>/dev/null || true

echo '{"result":"continue"}'
exit 0
