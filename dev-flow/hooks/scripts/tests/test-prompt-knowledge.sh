#!/bin/bash
# Tests for prompt-knowledge.sh (UserPromptSubmit auto-retrieval hook)
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOK="$SCRIPT_DIR/prompt-knowledge.sh"
PASS=0
FAIL=0
TOTAL=0

assert_json() {
  local test_name="$1"
  local input="$2"
  local expected_key="$3"
  local expected_val="$4"
  TOTAL=$((TOTAL + 1))

  # Reset counter to force injection on test
  STATE_DIR="$HOME/.claude/state/dev-flow"
  mkdir -p "$STATE_DIR" 2>/dev/null
  echo "0" > "$STATE_DIR/prompt-inject-counter"

  local output
  output=$(echo "$input" | CLAUDE_PROJECT_DIR="$TEST_DIR" "$HOOK" 2>/dev/null)
  local actual
  actual=$(echo "$output" | jq -r "$expected_key" 2>/dev/null)

  if [[ "$actual" == "$expected_val" ]]; then
    echo "✅ $test_name"
    PASS=$((PASS + 1))
  else
    echo "❌ $test_name"
    echo "  Expected: $expected_val"
    echo "  Actual:   $actual"
    echo "  Output:   $output"
    FAIL=$((FAIL + 1))
  fi
}

assert_contains() {
  local test_name="$1"
  local input="$2"
  local expected_substr="$3"
  TOTAL=$((TOTAL + 1))

  STATE_DIR="$HOME/.claude/state/dev-flow"
  mkdir -p "$STATE_DIR" 2>/dev/null
  echo "0" > "$STATE_DIR/prompt-inject-counter"

  local output
  output=$(echo "$input" | CLAUDE_PROJECT_DIR="$TEST_DIR" "$HOOK" 2>/dev/null)

  if echo "$output" | grep -q "$expected_substr"; then
    echo "✅ $test_name"
    PASS=$((PASS + 1))
  else
    echo "❌ $test_name"
    echo "  Expected to contain: $expected_substr"
    echo "  Output: $output"
    FAIL=$((FAIL + 1))
  fi
}

# --- Setup test DB ---
TEST_DIR=$(mktemp -d)
DB_DIR="$TEST_DIR/.claude/cache/artifact-index"
mkdir -p "$DB_DIR"
DB_PATH="$DB_DIR/context.db"

# Create schema
sqlite3 "$DB_PATH" "
CREATE TABLE IF NOT EXISTS knowledge (
  id TEXT PRIMARY KEY, type TEXT NOT NULL, platform TEXT,
  title TEXT NOT NULL, problem TEXT, solution TEXT,
  source_project TEXT, source_session TEXT,
  created_at TEXT NOT NULL, file_path TEXT NOT NULL,
  access_count INTEGER DEFAULT 0, last_accessed TEXT
);
CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
  title, problem, solution, content=knowledge, content_rowid=rowid,
  tokenize='porter unicode61'
);
CREATE TRIGGER IF NOT EXISTS knowledge_ai AFTER INSERT ON knowledge BEGIN
  INSERT INTO knowledge_fts(rowid, title, problem, solution) VALUES (new.rowid, new.title, new.problem, new.solution);
END;
CREATE TABLE IF NOT EXISTS session_summaries (
  id TEXT PRIMARY KEY, session_id TEXT, project TEXT NOT NULL,
  request TEXT, investigated TEXT, learned TEXT, completed TEXT,
  next_steps TEXT, files_modified TEXT,
  created_at TEXT NOT NULL, created_at_epoch INTEGER NOT NULL
);
CREATE VIRTUAL TABLE IF NOT EXISTS session_summaries_fts USING fts5(
  request, investigated, learned, completed, next_steps,
  content=session_summaries, content_rowid=rowid, tokenize='porter unicode61'
);
CREATE TRIGGER IF NOT EXISTS session_summaries_ai AFTER INSERT ON session_summaries BEGIN
  INSERT INTO session_summaries_fts(rowid, request, investigated, learned, completed, next_steps)
  VALUES (new.rowid, new.request, new.investigated, new.learned, new.completed, new.next_steps);
END;"

# Seed test data
sqlite3 "$DB_PATH" "
INSERT INTO knowledge VALUES ('k1','pitfall','ios','SwiftUI NavigationStack crash','NavigationStack crashes on iOS 16 with deep links','Use NavigationPath instead of direct binding','test','s1','2026-01-01T00:00:00Z','',0,NULL);
INSERT INTO knowledge VALUES ('k2','pattern','general','FTS5 search optimization','FTS5 prefix queries are faster with prefix index','Use prefix=2,3 in CREATE VIRTUAL TABLE','test','s2','2026-02-01T00:00:00Z','',0,NULL);
INSERT INTO session_summaries VALUES ('ss1','sess1','test','Fix SwiftUI navigation','Investigated deep link routing','NavigationPath is more reliable','Fixed navigation crash','Test edge cases','nav.swift','2026-02-28T00:00:00Z',1740700800);
"

echo "=== prompt-knowledge.sh Tests ==="
echo ""

# Test 1: Short prompt should skip
assert_json "Skip short prompt" \
  '{"prompt":"fix it"}' \
  '.continue' 'true'

# Test 2: Slash command should skip
assert_json "Skip slash command" \
  '{"prompt":"/dev commit -m fix"}' \
  '.continue' 'true'

# Test 3: Matching prompt should inject knowledge
assert_contains "Inject SwiftUI knowledge" \
  '{"prompt":"How to fix SwiftUI NavigationStack crash on iOS 16 deep links"}' \
  'additionalContext'

# Test 4: Non-matching prompt returns continue
assert_json "No match returns continue" \
  '{"prompt":"How to configure PostgreSQL replication with streaming"}' \
  '.continue' 'true'

# Test 5: Frequency guard skips 2nd consecutive prompt
STATE_DIR="$HOME/.claude/state/dev-flow"
mkdir -p "$STATE_DIR"
echo "1" > "$STATE_DIR/prompt-inject-counter"
TOTAL=$((TOTAL + 1))
output=$(echo '{"prompt":"SwiftUI NavigationStack deep link crash fix optimization"}' | CLAUDE_PROJECT_DIR="$TEST_DIR" "$HOOK" 2>/dev/null)
has_ctx=$(echo "$output" | jq -r '.hookSpecificOutput.additionalContext // empty' 2>/dev/null)
if [[ -z "$has_ctx" ]]; then
  echo "✅ Frequency guard skips 2nd prompt"
  PASS=$((PASS + 1))
else
  echo "❌ Frequency guard skips 2nd prompt"
  echo "  Should have skipped but got: $has_ctx"
  FAIL=$((FAIL + 1))
fi

# Test 6: access_count updated after retrieval
echo "0" > "$STATE_DIR/prompt-inject-counter"
echo '{"prompt":"SwiftUI NavigationStack deep link crash fix optimization"}' | CLAUDE_PROJECT_DIR="$TEST_DIR" "$HOOK" >/dev/null 2>&1
TOTAL=$((TOTAL + 1))
ACCESS=$(sqlite3 "$DB_PATH" "SELECT access_count FROM knowledge WHERE id='k1';" 2>/dev/null)
if [[ "$ACCESS" -gt 0 ]]; then
  echo "✅ access_count incremented"
  PASS=$((PASS + 1))
else
  echo "❌ access_count incremented (got: $ACCESS)"
  FAIL=$((FAIL + 1))
fi

# Cleanup
rm -rf "$TEST_DIR"

echo ""
echo "=== Results: $PASS/$TOTAL passed ==="
[[ $FAIL -eq 0 ]] && exit 0 || exit 1
