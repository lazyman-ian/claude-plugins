#!/bin/bash
set -o pipefail

# UserPromptSubmit Auto-Retrieval Hook
# Extracts keywords from user prompt → FTS5 query → injects relevant knowledge
# Cost: $0, latency: <50ms

INPUT=$(cat)
PROMPT_TEXT=$(echo "$INPUT" | jq -r '.prompt // empty' 2>/dev/null)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty' 2>/dev/null)

# Skip empty or very short prompts (commands, acknowledgments)
if [[ -z "$PROMPT_TEXT" || ${#PROMPT_TEXT} -lt 15 ]]; then
  echo '{"continue":true}'
  exit 0
fi

# Skip slash commands (handled by skills)
if [[ "$PROMPT_TEXT" =~ ^/ ]]; then
  echo '{"continue":true}'
  exit 0
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
DB_PATH="$PROJECT_DIR/.claude/cache/artifact-index/context.db"

# No DB → no knowledge to inject
if [[ ! -f "$DB_PATH" ]]; then
  echo '{"continue":true}'
  exit 0
fi

# --- Frequency guard: max 1 injection per 3 prompts ---
STATE_DIR="$HOME/.claude/state/dev-flow"
mkdir -p "$STATE_DIR" 2>/dev/null
COUNTER_FILE="$STATE_DIR/prompt-inject-counter"
COUNTER=0
if [[ -f "$COUNTER_FILE" ]]; then
  COUNTER=$(cat "$COUNTER_FILE" 2>/dev/null || echo "0")
fi
COUNTER=$((COUNTER + 1))
echo "$COUNTER" > "$COUNTER_FILE"

if [[ $((COUNTER % 3)) -ne 1 ]]; then
  echo '{"continue":true}'
  exit 0
fi

# --- Extract keywords from prompt ---
# Remove common stop words, keep meaningful terms (>2 chars)
KEYWORDS=$(echo "$PROMPT_TEXT" | tr '[:upper:]' '[:lower:]' | \
  tr -c 'a-z0-9 ' ' ' | \
  tr -s ' ' '\n' | \
  grep -vE '^(the|a|an|is|are|was|were|be|been|have|has|had|do|does|did|will|would|could|should|and|or|but|in|on|at|to|for|of|with|by|from|as|it|this|that|not|can|my|me|we|you|your|how|what|when|where|why|which|there|here|just|also|very|too|more|some|any|all|no|if|so|then|than|i|help|want|need|please|make|use|let|get|like|try|show|check|find|look|tell|give|know|think|see|go|come|take|put|add|create|update|change|fix|run|test|about)$' | \
  awk 'length > 2' | \
  head -8 | \
  tr '\n' ' ' | \
  /usr/bin/sed 's/ *$//')

# Need at least 2 keywords for meaningful search
WORD_COUNT=$(echo "$KEYWORDS" | wc -w | tr -d ' ')
if [[ "$WORD_COUNT" -lt 2 ]]; then
  echo '{"continue":true}'
  exit 0
fi

# --- FTS5 query: knowledge + session_summaries ---
# Use TAB as separator (IFS='|||' splits on each | char, not the string)
FTS_QUERY=$(echo "$KEYWORDS" | /usr/bin/sed "s/'/''/g" | /usr/bin/sed 's/ / OR /g')
SEP=$'\t'

# Query knowledge table (pitfalls, patterns, decisions)
KNOWLEDGE_HITS=$(sqlite3 -separator "$SEP" "$DB_PATH" \
  "SELECT k.type, k.title, substr(k.problem, 1, 120)
   FROM knowledge k
   JOIN knowledge_fts f ON k.rowid = f.rowid
   WHERE knowledge_fts MATCH '${FTS_QUERY}'
   ORDER BY rank
   LIMIT 2;" 2>/dev/null || echo "")

# Query session_summaries (recent learnings)
SUMMARY_HITS=$(sqlite3 -separator "$SEP" "$DB_PATH" \
  "SELECT 'session', substr(s.learned, 1, 100), substr(s.completed, 1, 80)
   FROM session_summaries s
   JOIN session_summaries_fts f ON s.rowid = f.rowid
   WHERE session_summaries_fts MATCH '${FTS_QUERY}'
   ORDER BY s.created_at_epoch DESC
   LIMIT 1;" 2>/dev/null || echo "")

# No results → skip
if [[ -z "$KNOWLEDGE_HITS" && -z "$SUMMARY_HITS" ]]; then
  echo '{"continue":true}'
  exit 0
fi

# --- Build injection context (budget: 600 chars) ---
CONTEXT=""
if [[ -n "$KNOWLEDGE_HITS" ]]; then
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    ktype=$(printf '%s' "$line" | cut -f1)
    ktitle=$(printf '%s' "$line" | cut -f2)
    kproblem=$(printf '%s' "$line" | cut -f3)
    CONTEXT="${CONTEXT}[${ktype}] ${ktitle}: ${kproblem}\n"
  done <<< "$KNOWLEDGE_HITS"
fi

if [[ -n "$SUMMARY_HITS" ]]; then
  slearned=$(printf '%s' "$SUMMARY_HITS" | cut -f2)
  if [[ -n "$slearned" ]]; then
    CONTEXT="${CONTEXT}[recent] ${slearned}\n"
  fi
fi

# Truncate to 600 chars
CONTEXT=$(echo -e "$CONTEXT" | head -c 600)

# --- Update last_accessed for retrieved entries ---
# Touch access timestamp (fire-and-forget, async-safe)
TOUCH_QUERY=$(echo "$KEYWORDS" | /usr/bin/sed "s/'/''/g" | /usr/bin/sed 's/ / OR /g')
sqlite3 "$DB_PATH" \
  "UPDATE knowledge SET
     access_count = COALESCE(access_count, 0) + 1,
     last_accessed = datetime('now')
   WHERE rowid IN (
     SELECT k.rowid FROM knowledge k
     JOIN knowledge_fts f ON k.rowid = f.rowid
     WHERE knowledge_fts MATCH '${TOUCH_QUERY}'
     LIMIT 3
   );" 2>/dev/null || true

# --- Output with additionalContext injection ---
CONTEXT_RENDERED=$(echo -e "$CONTEXT")
# NOTE: GitHub #17550 — JSON hookSpecificOutput may error on first message of new session.
# The || echo fallback ensures graceful degradation.
jq -n --arg ctx "[Knowledge] $CONTEXT_RENDERED" \
  '{"continue":true,"hookSpecificOutput":{"additionalContext":$ctx,"hookEventName":"UserPromptSubmit"}}' 2>/dev/null || echo '{"continue":true}'
