#!/bin/bash
set -o pipefail

echo "=== E2E Smoke Test ==="
SCRIPT_DIR="$(builtin cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FAIL=0

# --- Test 1: Build succeeds ---
echo -n "Test 1: TypeScript build... "
npm run --prefix dev-flow/mcp-server build > /dev/null 2>&1 && echo "PASS" || { echo "FAIL"; FAIL=1; }

# --- Test 2: Bundle succeeds ---
echo -n "Test 2: Bundle to CJS... "
npm run --prefix dev-flow/mcp-server bundle > /dev/null 2>&1 && echo "PASS" || { echo "FAIL"; FAIL=1; }

# --- Test 3: Bundle file exists and is reasonable size ---
echo -n "Test 3: Bundle file valid... "
BUNDLE="dev-flow/scripts/mcp-server.cjs"
if [[ -f "$BUNDLE" ]] && [[ $(wc -c < "$BUNDLE") -gt 10000 ]]; then
  echo "PASS ($(wc -c < "$BUNDLE" | tr -d ' ') bytes)"
else
  echo "FAIL: bundle missing or too small"; FAIL=1
fi

# --- Test 4: No dead imports in bundle ---
echo -n "Test 4: No dead imports... "
if ! grep -q 'chromadb\|ChromaClient\|product.brain' "$BUNDLE" 2>/dev/null; then
  echo "PASS"
else
  echo "FAIL: dead module references remain"; FAIL=1
fi

# --- Test 5: Unit tests pass ---
echo -n "Test 5: Unit tests... "
npm test --prefix dev-flow/mcp-server > /dev/null 2>&1 && echo "PASS" || { echo "FAIL"; FAIL=1; }

# --- Test 6: All hook scripts exit 0 on empty input ---
echo -n "Test 6: Hook scripts sanity... "
HOOK_OK=1
for script in "$SCRIPT_DIR"/pre-compact.sh "$SCRIPT_DIR"/task-checkpoint.sh "$SCRIPT_DIR"/session-summary.sh; do
  [[ -f "$script" ]] || continue
  OUTPUT=$(echo '{}' | CLAUDE_PROJECT_DIR="/tmp" bash "$script" 2>/dev/null)
  echo "$OUTPUT" | jq -e '.continue == true' > /dev/null 2>&1 || { echo "FAIL: $(basename $script)"; HOOK_OK=0; break; }
done
[[ $HOOK_OK -eq 1 ]] && echo "PASS" || FAIL=1

# --- Test 7: No deleted module references in src ---
echo -n "Test 7: Clean imports... "
REFS=$(grep -r 'instincts\|embeddings\|product-brain' dev-flow/mcp-server/src/ --include='*.ts' -l 2>/dev/null | grep -v node_modules || true)
if [[ -z "$REFS" ]]; then
  echo "PASS"
else
  echo "FAIL: $REFS"; FAIL=1
fi

# --- Test 8: hooks.json is valid JSON ---
echo -n "Test 8: hooks.json valid... "
jq empty dev-flow/hooks/hooks.json 2>/dev/null && echo "PASS" || { echo "FAIL"; FAIL=1; }

# --- Test 9: No stop_hook_transcript references (bug fix) ---
echo -n "Test 9: No stop_hook_transcript... "
if ! grep -rq 'stop_hook_transcript' dev-flow/hooks/scripts/ --exclude-dir=tests 2>/dev/null; then
  echo "PASS"
else
  echo "FAIL: stop_hook_transcript reference found (non-existent field)"; FAIL=1
fi

# --- Test 10: session-summary.sh has stop_hook_active guard ---
echo -n "Test 10: Loop guard exists... "
if grep -q 'stop_hook_active' dev-flow/hooks/scripts/session-summary.sh 2>/dev/null; then
  echo "PASS"
else
  echo "FAIL: missing stop_hook_active guard"; FAIL=1
fi

# --- Summary ---
echo ""
if [[ $FAIL -eq 0 ]]; then
  echo "=== ALL E2E TESTS PASSED (10/10) ==="
  exit 0
else
  echo "=== SOME TESTS FAILED ==="
  exit 1
fi
