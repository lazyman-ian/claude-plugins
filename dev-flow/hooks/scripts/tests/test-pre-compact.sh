#!/bin/bash
set -o pipefail
SCRIPT_DIR="$(builtin cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Setup temp project
TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT
mkdir -p "$TMPDIR/thoughts/ledgers"
printf "# Ledger\n## State\n- Now: [→] Phase 2 (implementing auth)\n## Open Questions\n- Which auth provider?" > "$TMPDIR/thoughts/ledgers/CONTINUITY_CLAUDE-test.md"
git -C "$TMPDIR" init -q && git -C "$TMPDIR" commit --allow-empty -m "init" -q

# Setup minimal MEMORY.md
ENCODED=$(echo "$TMPDIR" | /usr/bin/sed 's|/|-|g')
MEMORY_DIR="$HOME/.claude/projects/$ENCODED/memory"
mkdir -p "$MEMORY_DIR"
cat > "$MEMORY_DIR/MEMORY.md" << 'MEMEOF'
# Memory

## Key Patterns
- Test

<!-- LAST-SESSION-START -->
## Last Session
<!-- LAST-SESSION-END -->
MEMEOF

# Test 1: Basic PreCompact with trigger=auto
echo -n "Test 1: Basic auto compact... "
OUTPUT=$(echo "{\"trigger\":\"auto\",\"session_id\":\"test-123\",\"cwd\":\"$TMPDIR\"}" | \
  CLAUDE_PROJECT_DIR="$TMPDIR" bash "$SCRIPT_DIR/pre-compact.sh" 2>/dev/null)
echo "$OUTPUT" | jq -e '.continue == true' > /dev/null 2>&1 || { echo "FAIL: no continue:true"; exit 1; }

CHECKPOINT="$TMPDIR/thoughts/ledgers/.compact-checkpoint.md"
[[ -f "$CHECKPOINT" ]] || { echo "FAIL: checkpoint not created"; exit 1; }
grep -q "Phase 2" "$CHECKPOINT" || { echo "FAIL: missing ledger state"; exit 1; }
grep -q "## Uncommitted Changes" "$CHECKPOINT" || { echo "FAIL: missing git state"; exit 1; }
echo "PASS"

# Test 2: MEMORY.md gets COMPACT-STATE markers
echo -n "Test 2: MEMORY.md updated... "
grep -q "COMPACT-STATE-START" "$MEMORY_DIR/MEMORY.md" || { echo "FAIL: no markers"; exit 1; }
grep -q "Working State" "$MEMORY_DIR/MEMORY.md" || { echo "FAIL: no working state"; exit 1; }
echo "PASS"

# Test 3: systemMessage contains branch info
echo -n "Test 3: systemMessage... "
echo "$OUTPUT" | jq -r '.systemMessage' | grep -q "Branch:" || { echo "FAIL: no branch in systemMessage"; exit 1; }
echo "PASS"

# Test 4: Custom instructions preserved
echo -n "Test 4: Custom instructions... "
OUTPUT2=$(echo "{\"trigger\":\"manual\",\"custom_instructions\":\"Focus on auth module\",\"cwd\":\"$TMPDIR\"}" | \
  CLAUDE_PROJECT_DIR="$TMPDIR" bash "$SCRIPT_DIR/pre-compact.sh" 2>/dev/null)
grep -q "Focus on auth module" "$TMPDIR/thoughts/ledgers/.compact-checkpoint.md" || { echo "FAIL: custom_instructions not saved"; exit 1; }
echo "PASS"

# Test 5: No ledger dir (graceful exit)
echo -n "Test 5: No ledger dir... "
OUTPUT3=$(echo '{"trigger":"auto"}' | CLAUDE_PROJECT_DIR="/tmp/nonexistent-$$" bash "$SCRIPT_DIR/pre-compact.sh" 2>/dev/null)
echo "$OUTPUT3" | jq -e '.continue == true' > /dev/null 2>&1 || { echo "FAIL"; exit 1; }
echo "PASS"

# Cleanup MEMORY.md test dir
rm -rf "$MEMORY_DIR" 2>/dev/null

echo ""
echo "ALL TESTS PASSED"
