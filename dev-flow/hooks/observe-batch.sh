#!/bin/bash
set -o pipefail

# Periodic Observation Capture — PostToolUse Hook
# Batches tool observations every N calls, classifies via Haiku
# Only active when .dev-flow.json has memory.tier >= 3

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)
CWD=$(echo "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty' 2>/dev/null)

# Quick exit for non-relevant tools
case "$TOOL_NAME" in
  AskUserQuestion|TaskCreate|TaskUpdate|TaskList|TaskGet|SendMessage|TeamCreate|TeamDelete|ExitPlanMode|EnterPlanMode|Skill)
    echo '{"continue":true}'
    exit 0
    ;;
esac

# Check tier config — early exit if < 3
CONFIG_FILE="${CWD}/.dev-flow.json"
TIER=0
INTERVAL=10
if [ -f "$CONFIG_FILE" ]; then
  TIER=$(jq -r '.memory.tier // 0' "$CONFIG_FILE" 2>/dev/null || echo "0")
  INTERVAL=$(jq -r '.memory.captureInterval // 10' "$CONFIG_FILE" 2>/dev/null || echo "10")
fi

if [ "$TIER" -lt 3 ]; then
  echo '{"continue":true}'
  exit 0
fi

# Counter file per session
COUNTER_DIR="/tmp/devflow-observe"
mkdir -p "$COUNTER_DIR" 2>/dev/null
COUNTER_FILE="${COUNTER_DIR}/${SESSION_ID:-default}"

# Increment counter
COUNT=$(($(cat "$COUNTER_FILE" 2>/dev/null || echo 0) + 1))
echo "$COUNT" > "$COUNTER_FILE"

# Collect tool info into log for batch processing
LOG_FILE="${COUNTER_DIR}/${SESSION_ID:-default}.log"
TOOL_INPUT=$(echo "$INPUT" | jq -r '.tool_input | tostring' 2>/dev/null | head -c 200)
TOOL_RESPONSE=$(echo "$INPUT" | jq -r '.tool_response // empty' 2>/dev/null | head -c 200)
echo "${TOOL_NAME}|||${TOOL_INPUT}|||${TOOL_RESPONSE}" >> "$LOG_FILE"

# Not yet time to batch?
if [ "$COUNT" -lt "$INTERVAL" ]; then
  echo '{"continue":true}'
  exit 0
fi

# Reset counter
echo "0" > "$COUNTER_FILE"

# Read collected tool log
TOOL_LOG=$(cat "$LOG_FILE" 2>/dev/null | tail -${INTERVAL})
> "$LOG_FILE"  # Clear after reading

if [ -z "$TOOL_LOG" ]; then
  echo '{"continue":true}'
  exit 0
fi

# Get project name
PROJECT=$(basename "$CWD" 2>/dev/null || echo "unknown")

OBS_TEXT=""

if [ -n "$ANTHROPIC_API_KEY" ]; then
  # --- Haiku-powered classification (high quality) ---
  PROMPT="Classify these ${INTERVAL} tool uses from a Claude Code session into structured observations.

Return ONLY a JSON array. Each observation should capture a meaningful unit of work (combine related tools). Types: decision, bugfix, feature, refactor, discovery.

Format: [{\"type\": \"...\", \"title\": \"...\", \"concepts\": [\"...\"], \"files\": [\"...\"], \"narrative\": \"...\"}]

Rules:
- Combine related tool calls into ONE observation (e.g., Read + Edit on same file = one change)
- Skip trivial operations (Glob for exploration, etc.)
- Keep titles under 60 chars
- Include 1-3 concepts per observation
- Return [] if nothing meaningful

Tool log (name|||input|||response):
${TOOL_LOG}"

  ESCAPED_PROMPT=$(echo "$PROMPT" | jq -Rs '.')

  RESPONSE=$(/usr/bin/curl -s --max-time 15 https://api.anthropic.com/v1/messages \
    -H "x-api-key: $ANTHROPIC_API_KEY" \
    -H "anthropic-version: 2023-06-01" \
    -H "content-type: application/json" \
    -d "{
      \"model\": \"claude-haiku-4-5-20251001\",
      \"max_tokens\": 500,
      \"messages\": [{
        \"role\": \"user\",
        \"content\": ${ESCAPED_PROMPT}
      }]
    }" 2>/dev/null)

  if [ -n "$RESPONSE" ]; then
    OBS_TEXT=$(echo "$RESPONSE" | jq -r '.content[0].text // empty' 2>/dev/null)
  fi
fi

# --- Heuristic fallback (no API key or API failed) ---
if [ -z "$OBS_TEXT" ] || [ "$(echo "$OBS_TEXT" | jq -r 'length' 2>/dev/null)" = "0" ] || [ "$(echo "$OBS_TEXT" | jq -r 'length' 2>/dev/null)" = "null" ]; then
  # Parse tool log to extract file-based observations
  EDITED_FILES=$(echo "$TOOL_LOG" | grep -E '^(Edit|Write)' | /usr/bin/sed 's/|||/\n/g' | grep -oE '[^ "]+\.(ts|js|py|swift|kt|sh|md|json)' | sort -u | head -5)
  READ_FILES=$(echo "$TOOL_LOG" | grep -E '^(Read|Grep|Glob)' | wc -l | tr -d ' ')
  WRITE_COUNT=$(echo "$TOOL_LOG" | grep -E '^(Edit|Write)' | wc -l | tr -d ' ')
  BASH_CMDS=$(echo "$TOOL_LOG" | grep -E '^Bash' | /usr/bin/sed 's/|||/\n/g' | head -1 | head -c 100)

  OBS_ARRAY="["
  FIRST=true

  # Modified files → feature/refactor observation
  if [ -n "$EDITED_FILES" ]; then
    FILES_JSON=$(echo "$EDITED_FILES" | jq -R . | jq -s '.')
    TYPE="feature"
    [ "$WRITE_COUNT" -gt 3 ] && TYPE="refactor"
    TITLE="Modified $(echo "$EDITED_FILES" | wc -l | tr -d ' ') files"
    [ "$FIRST" = "false" ] && OBS_ARRAY="${OBS_ARRAY},"
    OBS_ARRAY="${OBS_ARRAY}{\"type\":\"${TYPE}\",\"title\":\"${TITLE}\",\"concepts\":[],\"files\":${FILES_JSON},\"narrative\":\"Batch of ${WRITE_COUNT} edit/write operations\"}"
    FIRST=false
  fi

  # Read-heavy batch → discovery observation
  if [ "$READ_FILES" -gt 5 ] && [ "$WRITE_COUNT" -lt 2 ]; then
    [ "$FIRST" = "false" ] && OBS_ARRAY="${OBS_ARRAY},"
    OBS_ARRAY="${OBS_ARRAY}{\"type\":\"discovery\",\"title\":\"Explored ${READ_FILES} files\",\"concepts\":[],\"files\":[],\"narrative\":\"Read-heavy session suggesting exploration or research\"}"
    FIRST=false
  fi

  OBS_ARRAY="${OBS_ARRAY}]"

  # Validate and use
  if echo "$OBS_ARRAY" | jq -e 'length > 0' >/dev/null 2>&1; then
    OBS_TEXT="$OBS_ARRAY"
  else
    echo '{"continue":true}'
    exit 0
  fi
fi

# Parse JSON array of observations
OBS_COUNT=$(echo "$OBS_TEXT" | jq -r 'length' 2>/dev/null || echo "0")
if [ "$OBS_COUNT" = "0" ] || [ "$OBS_COUNT" = "null" ]; then
  echo '{"continue":true}'
  exit 0
fi

# Write observations to SQLite
DB_DIR="${CWD}/.claude/cache/artifact-index"
DB_PATH="${DB_DIR}/context.db"
EPOCH=$(date +%s)
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Ensure observations table exists
sqlite3 "$DB_PATH" "CREATE TABLE IF NOT EXISTS observations (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  project TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  concepts TEXT,
  files_modified TEXT,
  narrative TEXT,
  prompt_number INTEGER,
  created_at TEXT NOT NULL,
  created_at_epoch INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_observations_project ON observations(project);
CREATE INDEX IF NOT EXISTS idx_observations_epoch ON observations(created_at_epoch DESC);
CREATE INDEX IF NOT EXISTS idx_observations_type ON observations(type);
CREATE VIRTUAL TABLE IF NOT EXISTS observations_fts USING fts5(
  title, narrative, concepts,
  content=observations, content_rowid=rowid,
  tokenize='porter unicode61'
);
CREATE TRIGGER IF NOT EXISTS observations_ai AFTER INSERT ON observations BEGIN
  INSERT INTO observations_fts(rowid, title, narrative, concepts)
  VALUES (new.rowid, new.title, new.narrative, new.concepts);
END;
CREATE TRIGGER IF NOT EXISTS observations_ad AFTER DELETE ON observations BEGIN
  INSERT INTO observations_fts(observations_fts, rowid, title, narrative, concepts)
  VALUES('delete', old.rowid, old.title, old.narrative, old.concepts);
END;" 2>/dev/null

# Escape single quotes for SQL
esc() { echo "$1" | /usr/bin/sed "s/'/''/g"; }

# Insert each observation
for i in $(seq 0 $((OBS_COUNT - 1))); do
  OBS_TYPE=$(echo "$OBS_TEXT" | jq -r ".[$i].type // \"discovery\"" 2>/dev/null)
  OBS_TITLE=$(echo "$OBS_TEXT" | jq -r ".[$i].title // \"Untitled\"" 2>/dev/null)
  OBS_CONCEPTS=$(echo "$OBS_TEXT" | jq -r ".[$i].concepts | join(\",\")" 2>/dev/null || echo "")
  OBS_FILES=$(echo "$OBS_TEXT" | jq -r ".[$i].files | join(\",\")" 2>/dev/null || echo "")
  OBS_NARRATIVE=$(echo "$OBS_TEXT" | jq -r ".[$i].narrative // \"\"" 2>/dev/null)
  OBS_ID="obs-${SESSION_ID:-unknown}-${EPOCH}-${i}"

  sqlite3 "$DB_PATH" "INSERT OR IGNORE INTO observations (id, session_id, project, type, title, concepts, files_modified, narrative, created_at, created_at_epoch)
  VALUES ('$(esc "$OBS_ID")', '$(esc "$SESSION_ID")', '$(esc "$PROJECT")', '$(esc "$OBS_TYPE")', '$(esc "$OBS_TITLE")', '$(esc "$OBS_CONCEPTS")', '$(esc "$OBS_FILES")', '$(esc "$OBS_NARRATIVE")', '${NOW}', ${EPOCH});" 2>/dev/null
done

echo '{"continue":true}'
exit 0
