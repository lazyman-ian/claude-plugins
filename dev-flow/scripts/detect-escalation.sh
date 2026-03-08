#!/usr/bin/env bash
# USAGE:
#   detect-escalation.sh [--diff] [--help] [--test] [file1 file2 ...]
#
# PURPOSE:
#   L3 escalation detection - deterministic rules for security/architecture scope.
#   Reads file list from stdin (one per line), arguments, or --diff (git diff --name-only).
#
# OUTPUT:
#   SAFE   → exit 0
#   ESCALATE + reasons → exit 2
#
# NOTE: False positives are expected behavior (better to escalate unnecessarily).

set -o pipefail

usage() {
  local first=1
  local in_header=1
  while IFS= read -r line; do
    [[ $in_header -eq 0 ]] && break
    if [[ $first -eq 1 ]]; then
      first=0
      continue  # skip shebang
    fi
    if [[ "$line" =~ ^# ]]; then
      /usr/bin/sed 's/^# \{0,1\}//' <<< "$line"
    else
      in_header=0
    fi
  done < "$0"
  exit 0
}

# --- Self-test mode ---
run_tests() {
  local pass=0
  local fail=0

  _check() {
    local desc="$1"
    local expected="$2"  # 0=SAFE, 2=ESCALATE
    shift 2
    local actual
    echo "$@" | bash "$0" > /dev/null 2>&1
    actual=$?
    if [[ $actual -eq $expected ]]; then
      echo "  PASS: $desc"
      ((pass++))
    else
      echo "  FAIL: $desc (expected exit $expected, got $actual)"
      ((fail++))
    fi
  }

  echo "Running built-in tests..."

  # Test 1: auth path triggers escalation
  _check "auth path escalates" 2 "src/auth/login.ts"

  # Test 2: database migration escalates
  _check "migration file escalates" 2 "db/migrations/20240101_add_users.sql"

  # Test 3: plain source file is safe
  _check "plain source file is safe" 0 "src/components/Button.tsx"

  # Test 4: package.json escalates
  _check "package.json escalates" 2 "package.json"

  # Test 5: Dockerfile escalates
  _check "Dockerfile escalates" 2 "Dockerfile"

  # Test 6: .github workflow escalates
  _check ".github CI config escalates" 2 ".github/workflows/ci.yml"

  # Test 7: security in path escalates
  _check "security path escalates" 2 "lib/security/crypto_utils.go"

  # Test 8: requirements.txt escalates
  _check "requirements.txt escalates" 2 "requirements.txt"

  # Test 9: terraform config escalates
  _check "terraform file escalates" 2 "infra/terraform/main.tf"

  # Test 10: schema file escalates
  _check "schema file escalates" 2 "models/schema.rb"

  echo ""
  echo "Results: $pass passed, $fail failed"
  [[ $fail -eq 0 ]]
}

# --- Argument parsing ---
USE_DIFF=0
files=()

for arg in "$@"; do
  case "$arg" in
    --help|-h) usage ;;
    --test)    run_tests; exit $? ;;
    --diff)    USE_DIFF=1 ;;
    *)         files+=("$arg") ;;
  esac
done

# --- Collect file list ---
if [[ $USE_DIFF -eq 1 ]]; then
  while IFS= read -r line; do
    files+=("$line")
  done < <(git diff --name-only 2>/dev/null)
fi

# If no arguments and no --diff, read from stdin
if [[ ${#files[@]} -eq 0 && $USE_DIFF -eq 0 ]]; then
  while IFS= read -r line; do
    [[ -n "$line" ]] && files+=("$line")
  done
fi

if [[ ${#files[@]} -eq 0 ]]; then
  echo "SAFE (no files to check)"
  exit 0
fi

# --- Detection rules ---
reasons_file="$(mktemp)"
trap 'rm -f "$reasons_file"' EXIT

for f in "${files[@]}"; do
  lower="$(printf '%s' "$f" | tr '[:upper:]' '[:lower:]')"
  basename_f="$(basename "$f")"
  basename_lower="$(printf '%s' "$basename_f" | tr '[:upper:]' '[:lower:]')"

  # Rule 1: auth/security paths
  if printf '%s' "$lower" | grep -qE '(^|/)auth(\/|$|\.)' || \
     printf '%s' "$lower" | grep -qE '(^|/)security(\/|$|\.)' || \
     printf '%s' "$lower" | grep -qiE 'credential|encrypt|permission|authenti' || \
     printf '%s' "$lower" | grep -qE 'auth[^o]' || \
     printf '%s' "$lower" | grep -q 'security'; then
    printf 'AUTH/SECURITY: %s\n' "$f" >> "$reasons_file"
  fi

  # Rule 2: database migration/schema changes
  if printf '%s' "$lower" | grep -qiE 'migration|schema|database' || \
     printf '%s' "$lower" | grep -qE '\.sql$'; then
    printf 'DB/MIGRATION: %s\n' "$f" >> "$reasons_file"
  fi

  # Rule 3: new external dependency files
  case "$basename_lower" in
    package.json|podfile|podfile.lock|build.gradle|build.gradle.kts|\
    cargo.toml|cargo.lock|requirements.txt|go.mod|go.sum)
      printf 'DEPENDENCY: %s\n' "$f" >> "$reasons_file"
      ;;
  esac

  # Rule 4: API route files (potential breaking change indicator)
  if printf '%s' "$lower" | grep -qE '(^|/)(routes?|api|router|endpoints?)(\/|$|\.)'; then
    printf 'API/ROUTES: %s\n' "$f" >> "$reasons_file"
  fi

  # Rule 5: infrastructure/CI changes
  if printf '%s' "$lower" | grep -qE '^\.github/' || \
     printf '%s' "$lower" | grep -qE '^\.gitlab-ci' || \
     printf '%s' "$lower" | grep -qiE '(^|/)(dockerfile|docker-compose)' || \
     printf '%s' "$lower" | grep -qiE '(^|/)terraform' || \
     printf '%s' "$lower" | grep -qE '\.tf$' || \
     printf '%s' "$lower" | grep -qE '(^|/)(k8s|kubernetes)(/|$)'; then
    printf 'INFRA/CI: %s\n' "$f" >> "$reasons_file"
  fi
done

# Deduplicate reasons
if [[ ! -s "$reasons_file" ]]; then
  echo "SAFE"
  exit 0
fi

unique_reasons=()
while IFS= read -r line; do
  unique_reasons+=("$line")
done < <(sort -u "$reasons_file")

echo "ESCALATE"
echo ""
echo "Reasons:"
for r in "${unique_reasons[@]}"; do
  echo "  - $r"
done
echo ""
echo "Action: Review with human before proceeding (L3 escalation required)."
exit 2
