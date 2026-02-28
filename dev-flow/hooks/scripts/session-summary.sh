#!/bin/bash
set -o pipefail

# Session Summary Stop Hook
# Generates a lightweight session summary and writes to:
# 1. .claude/cache/.last-session.json (for next session pickup)
# 2. MEMORY.md Last Session section (for cross-session context)

INPUT=$(cat)
STOP_TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)
CWD=$(echo "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty' 2>/dev/null)
# v2.1.47: last_assistant_message + transcript_path available in Stop hook
LAST_MSG=$(echo "$INPUT" | jq -r '.last_assistant_message // empty' 2>/dev/null)
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // empty' 2>/dev/null)
STOP_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false' 2>/dev/null)

# Guard: prevent infinite loop if Stop hook causes continuation
if [ "$STOP_ACTIVE" = "true" ]; then
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

# Build excerpt: prefer last_assistant_message (v2.1.47), fallback to transcript file
EXCERPT=""
if [ -n "$LAST_MSG" ]; then
  EXCERPT="${LAST_MSG: -3000}"
elif [ -n "$TRANSCRIPT_PATH" ] && [ -f "$TRANSCRIPT_PATH" ]; then
  EXCERPT=$(tail -c 4000 "$TRANSCRIPT_PATH" 2>/dev/null)
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
  PROMPT="Summarize this Claude Code session concisely. Return ONLY valid JSON with these exact fields:
{
  \"request\": \"what the user asked for (1-2 sentences)\",
  \"investigated\": \"what was explored/researched (1-2 sentences)\",
  \"learned\": \"key insights or discoveries (1-2 sentences)\",
  \"completed\": \"what was accomplished (1-2 sentences)\",
  \"next_steps\": \"what should happen next (1-2 sentences)\"
}

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
      \"max_tokens\": 400,
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

  # Empty session: skip writing entirely
  if [ -z "$COMPLETED" ] && [ -z "$REQUEST" ] && [ -z "$INVESTIGATED" ]; then
    echo '{"continue":true}'
    exit 0
  fi
fi

# --- Write to .last-session.json ---
CACHE_DIR="${CWD}/.claude/cache"
mkdir -p "$CACHE_DIR" 2>/dev/null
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

jq -n \
  --arg sid "$SESSION_ID" \
  --arg project "$PROJECT" \
  --arg request "$REQUEST" \
  --arg investigated "$INVESTIGATED" \
  --arg learned "$LEARNED" \
  --arg completed "$COMPLETED" \
  --arg next_steps "$NEXT_STEPS" \
  --arg files "$GIT_CHANGES" \
  --arg created_at "$NOW" \
  '{
    session_id: $sid,
    project: $project,
    request: $request,
    investigated: $investigated,
    learned: $learned,
    completed: $completed,
    next_steps: $next_steps,
    files_modified: $files,
    created_at: $created_at
  }' > "$CACHE_DIR/.last-session.json" 2>/dev/null

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

    # --- MEMORY.md Priority-Based Trimming ---
    # P0: Key Patterns, Architecture, Lessons (never trim)
    # P1: Other sections (trim tables to header+5 rows, skip P0 sections)
    # P2: Last Session (minimize to 1-line)
    # P3: Compact State (remove entirely)

    LINE_COUNT=$(wc -l < "$MEMORY_MD" 2>/dev/null | tr -d ' ')

    # Step 1: trim P1 sections — trim tables to header+5 rows, but SKIP P0 sections
    if [ "$LINE_COUNT" -gt 160 ]; then
      awk '
        /^## Key Patterns/    { p0=1 }
        /^## Architecture/    { p0=1 }
        /^## Lessons/         { p0=1 }
        /^## / && !/Key Patterns|Architecture|Lessons/ { p0=0; table=0 }
        /^\|/ && !p0 { table++; if (table > 7) next }
        !/^\|/ { table=0 }
        { print }
      ' "$MEMORY_MD" > "${MEMORY_MD}.tmp" 2>/dev/null && mv "${MEMORY_MD}.tmp" "$MEMORY_MD" 2>/dev/null
      LINE_COUNT=$(wc -l < "$MEMORY_MD" 2>/dev/null | tr -d ' ')
    fi

    # Step 2: trim P2 (Last Session -> minimal 1-line)
    if [ "$LINE_COUNT" -gt 180 ]; then
      # Extract first "Next:" line from Last Session block (macOS-safe, no grep -P)
      FIRST_NEXT=$(awk '/^## Last Session/,/<!-- LAST-SESSION-END -->/' "$MEMORY_MD" 2>/dev/null \
        | grep -o 'Next: .*' 2>/dev/null | head -1 | /usr/bin/sed 's/^Next: //' 2>/dev/null)
      [ -z "$FIRST_NEXT" ] && FIRST_NEXT="(trimmed)"
      awk -v next_step="$FIRST_NEXT" '
        /<!-- LAST-SESSION-START -->/{found=1; print; print "## Last Session"; print "- Next: " next_step; next}
        /<!-- LAST-SESSION-END -->/{found=0}
        !found
      ' "$MEMORY_MD" > "${MEMORY_MD}.tmp" 2>/dev/null && mv "${MEMORY_MD}.tmp" "$MEMORY_MD" 2>/dev/null
      LINE_COUNT=$(wc -l < "$MEMORY_MD" 2>/dev/null | tr -d ' ')
    fi

    # Step 3: remove P3 (COMPACT-STATE) if still over
    if [ "$LINE_COUNT" -gt 200 ]; then
      awk '
        /<!-- COMPACT-STATE-START -->/{skip=1; next}
        /<!-- COMPACT-STATE-END -->/{skip=0; next}
        !skip
      ' "$MEMORY_MD" > "${MEMORY_MD}.tmp" 2>/dev/null && mv "${MEMORY_MD}.tmp" "$MEMORY_MD" 2>/dev/null
    fi
  fi
fi

echo '{"continue":true}'
exit 0
