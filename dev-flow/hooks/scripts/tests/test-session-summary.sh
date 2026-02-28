#!/bin/bash
set -o pipefail
SCRIPT_DIR="$(builtin cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT
mkdir -p "$TMPDIR/.claude/cache"
echo '{"memory":{"vault":"thoughts/knowledge"}}' > "$TMPDIR/.dev-flow.json"
git -C "$TMPDIR" init -q && git -C "$TMPDIR" commit --allow-empty -m "init" -q

# Test 1: Heuristic fallback (no API key)
echo -n "Test 1: Heuristic fallback... "
OUTPUT=$(echo "{\"cwd\":\"$TMPDIR\",\"session_id\":\"test-123\",\"last_assistant_message\":\"I completed the auth module\"}" | \
  ANTHROPIC_API_KEY="" DEV_FLOW_API_KEY="" CLAUDE_PROJECT_DIR="$TMPDIR" bash "$SCRIPT_DIR/session-summary.sh" 2>/dev/null)
echo "$OUTPUT" | jq -e '.continue == true' > /dev/null || { echo "FAIL"; exit 1; }
echo "PASS"

# Test 2: Writes .last-session.json
echo -n "Test 2: Writes .last-session.json... "
if [ -f "$TMPDIR/.claude/cache/.last-session.json" ]; then
  echo "$TMPDIR/.claude/cache/.last-session.json" | jq -e '.session_id == "test-123"' > /dev/null 2>&1
  echo "PASS"
else
  echo "FAIL (file not created)"
  exit 1
fi

# Test 3: stop_hook_active=true (loop guard)
echo -n "Test 3: Loop guard... "
OUTPUT=$(echo "{\"cwd\":\"$TMPDIR\",\"session_id\":\"test-789\",\"stop_hook_active\":true}" | CLAUDE_PROJECT_DIR="$TMPDIR" bash "$SCRIPT_DIR/session-summary.sh" 2>/dev/null)
echo "$OUTPUT" | jq -e '.continue == true' > /dev/null || { echo "FAIL"; exit 1; }
echo "PASS"

# Test 4: Empty input
echo -n "Test 4: Empty input... "
OUTPUT=$(echo '{}' | CLAUDE_PROJECT_DIR="$TMPDIR" bash "$SCRIPT_DIR/session-summary.sh" 2>/dev/null)
echo "$OUTPUT" | jq -e '.continue == true' > /dev/null || { echo "FAIL"; exit 1; }
echo "PASS"

echo ""
echo "ALL TESTS PASSED"
