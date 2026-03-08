#!/bin/bash
set -o pipefail

# validate-spec.sh - Deterministic spec quality check
# Usage: validate-spec.sh <spec-file-path>
#        validate-spec.sh --help
#        validate-spec.sh --test  (self-check with built-in samples)
# Exit: 0 = all pass, 1 = has failures, 2 = needs escalation

if [[ "$1" == "--help" ]]; then
  echo "Usage: validate-spec.sh <spec-file> [--help|--test]"
  echo ""
  echo "Deterministic spec quality checker."
  echo "Checks 5 criteria: verify command, scope/files, no ambiguity,"
  echo "acceptance criteria, and security/architecture escalation."
  echo ""
  echo "Exit codes:"
  echo "  0 - All checks pass"
  echo "  1 - Has failures (fixable by self-heal)"
  echo "  2 - Needs escalation (security/architecture scope)"
  exit 0
fi

if [[ "$1" == "--test" ]]; then
  echo "Running self-test..."
  PASS=0
  FAIL=0

  # Test 1: Good spec (all pass)
  GOOD_SPEC=$(mktemp)
  cat > "$GOOD_SPEC" << 'SPEC'
# Test Spec
verify: make test
files:
  modify: [src/app.ts]
contract: |
  - Must handle edge cases
  - acceptance criteria: works correctly
SPEC
  if bash "$0" "$GOOD_SPEC" > /dev/null 2>&1; then
    PASS=$((PASS+1))
  else
    echo "FAIL: good spec should pass (got exit $?)"
    FAIL=$((FAIL+1))
  fi
  rm -f "$GOOD_SPEC"

  # Test 2: Missing verify (should fail)
  BAD_SPEC=$(mktemp)
  cat > "$BAD_SPEC" << 'SPEC'
# Test Spec
files:
  modify: [src/app.ts]
contract: |
  - acceptance criteria here
SPEC
  if bash "$0" "$BAD_SPEC" > /dev/null 2>&1; then
    echo "FAIL: missing verify should fail"
    FAIL=$((FAIL+1))
  else
    rc=$?
    if [[ $rc -eq 1 ]]; then
      PASS=$((PASS+1))
    else
      echo "FAIL: expected exit 1, got $rc"
      FAIL=$((FAIL+1))
    fi
  fi
  rm -f "$BAD_SPEC"

  # Test 3: Security escalation
  SEC_SPEC=$(mktemp)
  cat > "$SEC_SPEC" << 'SPEC'
# Auth Module Refactor
verify: make test
files:
  modify: [src/auth/login.ts]
scope: auth module
contract: |
  - acceptance criteria: security validated
SPEC
  if bash "$0" "$SEC_SPEC" > /dev/null 2>&1; then
    echo "FAIL: auth spec should escalate"
    FAIL=$((FAIL+1))
  else
    rc=$?
    if [[ $rc -eq 2 ]]; then
      PASS=$((PASS+1))
    else
      echo "FAIL: expected exit 2 (escalate), got $rc"
      FAIL=$((FAIL+1))
    fi
  fi
  rm -f "$SEC_SPEC"

  echo "Self-test: $PASS passed, $FAIL failed"
  [[ $FAIL -eq 0 ]] && exit 0 || exit 1
fi

# --- Main validation ---

SPEC_FILE="$1"

if [[ -z "$SPEC_FILE" || ! -f "$SPEC_FILE" ]]; then
  echo "ERROR: spec file required and must exist"
  echo "Usage: validate-spec.sh <spec-file>"
  exit 1
fi

FAILURES=0
ESCALATE=0

# Check 1: verify command exists
if grep -q '^verify:\|^  verify:\|^    verify:' "$SPEC_FILE" 2>/dev/null; then
  echo "PASS: verify command found"
else
  echo "FAIL: no verify command"
  FAILURES=$((FAILURES+1))
fi

# Check 2: scope/files defined
if grep -q '^files:\|^scope:\|^  files:\|^    files:\|^target_files:' "$SPEC_FILE" 2>/dev/null; then
  echo "PASS: scope/files defined"
else
  echo "FAIL: no scope/files section"
  FAILURES=$((FAILURES+1))
fi

# Check 3: no ambiguity markers
AMBIGUOUS=$(grep -Ein '(maybe|probably|might|perhaps|TBD|TBC)' "$SPEC_FILE" 2>/dev/null || true)
if [[ -n "$AMBIGUOUS" ]]; then
  echo "FAIL: ambiguous language found:"
  echo "$AMBIGUOUS"
  FAILURES=$((FAILURES+1))
else
  echo "PASS: no ambiguous language"
fi

# Check 4: acceptance criteria exist
if grep -qi 'acceptance\|criteria\|contract\|verify:' "$SPEC_FILE" 2>/dev/null; then
  echo "PASS: acceptance criteria found"
else
  echo "FAIL: no acceptance criteria"
  FAILURES=$((FAILURES+1))
fi

# Check 5: security/architecture escalation (ESCALATE, not FAIL)
SEC_MATCH=$(grep -Ein '(auth|security|migration|schema|database|breaking.change|credential|encrypt|permission)' "$SPEC_FILE" 2>/dev/null || true)
if [[ -n "$SEC_MATCH" ]]; then
  echo "ESCALATE: security/architecture scope detected:"
  echo "$SEC_MATCH"
  ESCALATE=1
fi

# --- Results ---
echo ""
if [[ $ESCALATE -eq 1 ]]; then
  echo "Result: NEEDS ESCALATION (security/architecture scope)"
  exit 2
fi

if [[ $FAILURES -gt 0 ]]; then
  echo "Result: $FAILURES FAILURE(S)"
  exit 1
fi

echo "Result: ALL PASS"
exit 0
