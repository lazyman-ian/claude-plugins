#!/bin/bash
set -o pipefail
SCRIPT_DIR="$(builtin cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Setup
TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT
mkdir -p "$TMPDIR/thoughts/ledgers"
cat > "$TMPDIR/thoughts/ledgers/CONTINUITY_CLAUDE-test.md" << 'EOF'
# Task Ledger
## State
- Now: [→] Phase 1
## Open Questions
EOF
git -C "$TMPDIR" init -q && git -C "$TMPDIR" commit --allow-empty -m "init" -q

# Test 1: Valid TaskCompleted input
echo -n "Test 1: Valid input... "
OUTPUT=$(echo '{"task_id":"1","task_subject":"Implement auth module"}' | CLAUDE_PROJECT_DIR="$TMPDIR" bash "$SCRIPT_DIR/task-checkpoint.sh" 2>/dev/null)
grep -q "Implement auth module" "$TMPDIR/thoughts/ledgers/CONTINUITY_CLAUDE-test.md" || { echo "FAIL: task not recorded in ledger"; exit 1; }
echo "$OUTPUT" | jq -e '.continue == true' > /dev/null 2>&1 || { echo "FAIL: no continue:true"; exit 1; }
echo "PASS"

# Test 2: Empty input (graceful exit)
echo -n "Test 2: Empty input... "
OUTPUT=$(echo '{}' | CLAUDE_PROJECT_DIR="$TMPDIR" bash "$SCRIPT_DIR/task-checkpoint.sh" 2>/dev/null)
echo "$OUTPUT" | jq -e '.continue == true' > /dev/null 2>&1 || { echo "FAIL: no continue:true"; exit 1; }
echo "PASS"

# Test 3: No ledger dir (graceful exit)
echo -n "Test 3: Missing ledger dir... "
OUTPUT=$(echo '{"task_id":"1","task_subject":"test"}' | CLAUDE_PROJECT_DIR="/tmp/nonexistent-$$" bash "$SCRIPT_DIR/task-checkpoint.sh" 2>/dev/null)
echo "$OUTPUT" | jq -e '.continue == true' > /dev/null 2>&1 || { echo "FAIL: no continue:true"; exit 1; }
echo "PASS"

echo ""
echo "ALL TESTS PASSED"
