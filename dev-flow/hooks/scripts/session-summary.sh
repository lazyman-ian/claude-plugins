#!/bin/bash
set -o pipefail

# Session Summary Stop Hook
# Calls Haiku to generate session summary, writes to knowledge DB
# Only active when .dev-flow.json has memory.tier >= 1

INPUT=$(cat)
STOP_TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)
CWD=$(echo "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty' 2>/dev/null)
# v2.1.47: last_assistant_message available directly (preferred over transcript parsing)
LAST_MSG=$(echo "$INPUT" | jq -r '.last_assistant_message // empty' 2>/dev/null)
TRANSCRIPT=$(echo "$INPUT" | jq -r '.stop_hook_transcript // empty' 2>/dev/null)

# Early exit: Check tier config
CONFIG_FILE="${CWD}/.dev-flow.json"
TIER=0
if [ -f "$CONFIG_FILE" ]; then
  TIER=$(jq -r '.memory.tier // 0' "$CONFIG_FILE" 2>/dev/null || echo "0")
fi

if [ "$TIER" -lt 1 ]; then
  echo '{"continue":true}'
  exit 0
fi

# Get project name
PROJECT=$(basename "$CWD" 2>/dev/null || echo "unknown")

# Get recent git changes for context
GIT_CHANGES=$(git -C "$CWD" diff --stat HEAD~3 2>/dev/null | tail -5 || echo "")
RECENT_COMMITS=$(git -C "$CWD" log --oneline -5 2>/dev/null || echo "")
# Also capture uncommitted changes (staged + unstaged)
UNCOMMITTED=$(git -C "$CWD" diff --stat 2>/dev/null || echo "")
STAGED=$(git -C "$CWD" diff --cached --stat 2>/dev/null || echo "")

# Build excerpt: prefer last_assistant_message (v2.1.47), fallback to transcript
# Use character substring (not tail -c) to avoid breaking multi-byte UTF-8
EXCERPT=""
if [ -n "$LAST_MSG" ]; then
  EXCERPT="${LAST_MSG: -3000}"
elif [ -n "$TRANSCRIPT" ]; then
  EXCERPT="${TRANSCRIPT: -3000}"
fi

REQUEST=""
INVESTIGATED=""
LEARNED=""
COMPLETED=""
NEXT_STEPS=""

# API config: DEV_FLOW_* > ANTHROPIC_API_KEY defaults
API_KEY="${DEV_FLOW_API_KEY:-$ANTHROPIC_API_KEY}"
API_URL="${DEV_FLOW_API_URL:-https://api.anthropic.com/v1/messages}"
API_MODEL="${DEV_FLOW_MODEL:-claude-haiku-4-5-20251001}"
# Auth header: Bearer for third-party endpoints, x-api-key for Anthropic
if echo "$API_URL" | grep -qv 'api\.anthropic\.com'; then
  AUTH_HEADER="Authorization: Bearer $API_KEY"
  ANTHROPIC_VERSION_HEADER=""
else
  AUTH_HEADER="x-api-key: $API_KEY"
  ANTHROPIC_VERSION_HEADER="anthropic-version: 2023-06-01"
fi

if [ -n "$API_KEY" ]; then
  # --- LLM-powered summary (high quality) ---
  PROMPT="Summarize this Claude Code session concisely. Return ONLY valid JSON with these exact fields (1-2 sentences each):
{\"request\": \"what the user asked for\", \"investigated\": \"what was explored/researched\", \"learned\": \"key insights or discoveries\", \"completed\": \"what was accomplished\", \"next_steps\": \"what should happen next\"}

Recent git changes:
${GIT_CHANGES}

Session excerpt:
${EXCERPT}"

  ESCAPED_PROMPT=$(echo "$PROMPT" | jq -Rs '.')

  RESPONSE=$(/usr/bin/curl -s --max-time 10 "${API_URL}" \
    -H "$AUTH_HEADER" \
    ${ANTHROPIC_VERSION_HEADER:+-H "$ANTHROPIC_VERSION_HEADER"} \
    -H "content-type: application/json" \
    -d "{
      \"model\": \"${API_MODEL}\",
      \"max_tokens\": 300,
      \"messages\": [{
        \"role\": \"user\",
        \"content\": ${ESCAPED_PROMPT}
      }]
    }" 2>/dev/null)

  if [ -n "$RESPONSE" ]; then
    SUMMARY_TEXT=$(echo "$RESPONSE" | jq -r '.choices[0].message.content // .content[0].text // empty' 2>/dev/null | /usr/bin/sed '/^ *```/d')
    if [ -n "$SUMMARY_TEXT" ]; then
      REQUEST=$(echo "$SUMMARY_TEXT" | jq -r '.request // empty' 2>/dev/null)
      INVESTIGATED=$(echo "$SUMMARY_TEXT" | jq -r '.investigated // empty' 2>/dev/null)
      LEARNED=$(echo "$SUMMARY_TEXT" | jq -r '.learned // empty' 2>/dev/null)
      COMPLETED=$(echo "$SUMMARY_TEXT" | jq -r '.completed // empty' 2>/dev/null)
      NEXT_STEPS=$(echo "$SUMMARY_TEXT" | jq -r '.next_steps // empty' 2>/dev/null)
    fi
  fi
fi

# --- Heuristic fallback (no API key or API failed) ---
if [ -z "$REQUEST" ] && [ -z "$COMPLETED" ]; then
  # Extract request: first non-empty user line from transcript
  if [ -n "$EXCERPT" ]; then
    REQUEST=$(echo "$EXCERPT" | grep -m1 -oE '"user".*"content":"[^"]+' 2>/dev/null | head -c 200 || echo "")
  fi

  # Completed: from git commits made during session
  if [ -n "$RECENT_COMMITS" ]; then
    COMPLETED=$(echo "$RECENT_COMMITS" | head -3 | tr '\n' '; ' | head -c 200)
  fi

  # Investigated: from file changes (committed + uncommitted + staged)
  ALL_CHANGES="${GIT_CHANGES}${UNCOMMITTED}${STAGED}"
  if [ -n "$ALL_CHANGES" ]; then
    INVESTIGATED=$(echo "$ALL_CHANGES" | grep '|' | awk '{print $1}' | sort -u | tr '\n' ', ' | head -c 200)
  fi

  # For research/exploration sessions with no git changes:
  # Extract tool usage patterns from transcript
  if [ -z "$COMPLETED" ] && [ -z "$INVESTIGATED" ] && [ -n "$EXCERPT" ]; then
    # Count tool calls as evidence of work
    READ_COUNT=$(echo "$EXCERPT" | grep -c '"Read"' 2>/dev/null || echo "0")
    GREP_COUNT=$(echo "$EXCERPT" | grep -c '"Grep"' 2>/dev/null || echo "0")
    GLOB_COUNT=$(echo "$EXCERPT" | grep -c '"Glob"' 2>/dev/null || echo "0")
    WEB_COUNT=$(echo "$EXCERPT" | grep -c '"WebSearch\|WebFetch"' 2>/dev/null || echo "0")
    TOTAL=$((READ_COUNT + GREP_COUNT + GLOB_COUNT + WEB_COUNT))

    if [ "$TOTAL" -gt 0 ]; then
      INVESTIGATED="Research session: ${READ_COUNT} reads, ${GREP_COUNT} searches, ${WEB_COUNT} web lookups"
      COMPLETED="Exploration/research session (${TOTAL} tool calls, no code changes)"
    fi
  fi

  # Empty session: skip writing to DB entirely
  if [ -z "$COMPLETED" ] && [ -z "$REQUEST" ] && [ -z "$INVESTIGATED" ]; then
    echo '{"continue":true}'
    exit 0
  fi
fi

# Write to SQLite database
DB_DIR="${CWD}/.claude/cache/artifact-index"
DB_PATH="${DB_DIR}/context.db"
EPOCH=$(date +%s)
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
SUMMARY_ID="summary-${SESSION_ID:-$(date +%s)}-$(date +%s | shasum | head -c 8)"

# Ensure table exists
sqlite3 "$DB_PATH" "CREATE TABLE IF NOT EXISTS session_summaries (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  project TEXT NOT NULL,
  request TEXT,
  investigated TEXT,
  learned TEXT,
  completed TEXT,
  next_steps TEXT,
  files_modified TEXT,
  created_at TEXT NOT NULL,
  created_at_epoch INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_session_summaries_project ON session_summaries(project);
CREATE INDEX IF NOT EXISTS idx_session_summaries_epoch ON session_summaries(created_at_epoch DESC);
CREATE VIRTUAL TABLE IF NOT EXISTS session_summaries_fts USING fts5(
  request, investigated, learned, completed, next_steps,
  content=session_summaries, content_rowid=rowid,
  tokenize='porter unicode61'
);
CREATE TRIGGER IF NOT EXISTS session_summaries_ai AFTER INSERT ON session_summaries BEGIN
  INSERT INTO session_summaries_fts(rowid, request, investigated, learned, completed, next_steps)
  VALUES (new.rowid, new.request, new.investigated, new.learned, new.completed, new.next_steps);
END;" 2>/dev/null

# Escape single quotes for SQL
esc() { echo "$1" | /usr/bin/sed "s/'/''/g"; }

sqlite3 "$DB_PATH" "INSERT OR IGNORE INTO session_summaries (id, session_id, project, request, investigated, learned, completed, next_steps, files_modified, created_at, created_at_epoch)
VALUES ('$(esc "$SUMMARY_ID")', '$(esc "$SESSION_ID")', '$(esc "$PROJECT")', '$(esc "$REQUEST")', '$(esc "$INVESTIGATED")', '$(esc "$LEARNED")', '$(esc "$COMPLETED")', '$(esc "$NEXT_STEPS")', '$(esc "$GIT_CHANGES")', '${NOW}', ${EPOCH});" 2>/dev/null


# --- Update MEMORY.md Last Session section ---
# Only update if we have meaningful content
if [ -n "$NEXT_STEPS" ] || [ -n "$LEARNED" ] || [ -n "$COMPLETED" ]; then
  # Encode project dir path for Auto Memory directory (replace / with -)
  ENCODED_PATH=$(echo "$CWD" | /usr/bin/sed 's|/|-|g')
  MEMORY_DIR="$HOME/.claude/projects/$ENCODED_PATH/memory"
  MEMORY_MD="$MEMORY_DIR/MEMORY.md"

  if [ -f "$MEMORY_MD" ]; then
    # Build replacement block
    DISPLAY_NEXT="${NEXT_STEPS:-${COMPLETED:-No next steps recorded}}"
    DISPLAY_LEARNED="${LEARNED:-No new learnings recorded}"

    NEW_BLOCK="## Last Session
- Next: ${DISPLAY_NEXT}
- Learned: ${DISPLAY_LEARNED}
<!-- AUTO-UPDATED by session-summary.sh -->"

    # Check if markers exist
    if grep -q '<!-- LAST-SESSION-START -->' "$MEMORY_MD" 2>/dev/null; then
      # Replace between markers using awk
      awk -v block="$NEW_BLOCK" '
        /<!-- LAST-SESSION-START -->/ { print "<!-- LAST-SESSION-START -->"; print block; skip=1; next }
        /<!-- LAST-SESSION-END -->/ { skip=0; print; next }
        !skip { print }
      ' "$MEMORY_MD" > "${MEMORY_MD}.tmp" 2>/dev/null && mv "${MEMORY_MD}.tmp" "$MEMORY_MD" 2>/dev/null
    else
      # Append markers + block at end of file
      printf '\n<!-- LAST-SESSION-START -->\n%s\n<!-- LAST-SESSION-END -->\n' "$NEW_BLOCK" >> "$MEMORY_MD" 2>/dev/null
    fi

    # Enforce 200-line limit: if over, truncate LAST-SESSION section to fit
    # Never trim from top — that destroys MEMORY.md structure (headers, metadata)
    LINE_COUNT=$(wc -l < "$MEMORY_MD" 2>/dev/null | tr -d ' ')
    if [ "$LINE_COUNT" -gt 200 ]; then
      # Truncate the Last Session block to just the essentials (3 lines)
      MINIMAL_BLOCK="## Last Session\n- Next: $(echo "$NEXT_STEPS" | head -1)"
      awk -v block="$MINIMAL_BLOCK" '
        /<!-- LAST-SESSION-START -->/{found=1; print; print block; next}
        /<!-- LAST-SESSION-END -->/{found=0}
        !found
      ' "$MEMORY_MD" > "${MEMORY_MD}.tmp" 2>/dev/null && mv "${MEMORY_MD}.tmp" "$MEMORY_MD" 2>/dev/null
    fi
  fi
fi

echo '{"continue":true}'
exit 0
