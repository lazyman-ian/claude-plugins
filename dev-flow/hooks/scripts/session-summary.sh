#!/bin/bash
set -o pipefail

# Session Summary Stop Hook (simplified)
# Prompt Stop hook handles summary generation (Claude writes MEMORY.md with full context).
# This command hook handles:
# 1. .claude/cache/.last-session.json (structured cache, heuristic-based)
# 2. MEMORY.md fallback writing (if prompt hook didn't update it)
# 3. MEMORY.md priority-based trimming (always)

INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty' 2>/dev/null)
LAST_MSG=$(echo "$INPUT" | jq -r '.last_assistant_message // empty' 2>/dev/null)
STOP_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false' 2>/dev/null)

if [ "$STOP_ACTIVE" = "true" ]; then
  echo '{"continue":true}'
  exit 0
fi

PROJECT=$(basename "$CWD" 2>/dev/null || echo "unknown")
GIT_CHANGES=$(git -C "$CWD" diff --stat HEAD~3 2>/dev/null | tail -5 || echo "")
RECENT_COMMITS=$(git -C "$CWD" log --oneline -5 2>/dev/null || echo "")
UNCOMMITTED=$(git -C "$CWD" diff --stat 2>/dev/null || echo "")
STAGED=$(git -C "$CWD" diff --cached --stat 2>/dev/null || echo "")

# --- Heuristic summary for .last-session.json ---
REQUEST=""
INVESTIGATED=""
LEARNED=""
COMPLETED=""
NEXT_STEPS=""

EXCERPT=""
if [ -n "$LAST_MSG" ]; then
  EXCERPT="${LAST_MSG: -3000}"
fi

if [ -n "$RECENT_COMMITS" ]; then
  COMPLETED=$(echo "$RECENT_COMMITS" | head -3 | tr '\n' '; ' | head -c 200)
fi

ALL_CHANGES="${GIT_CHANGES}${UNCOMMITTED}${STAGED}"
if [ -n "$ALL_CHANGES" ]; then
  INVESTIGATED=$(echo "$ALL_CHANGES" | grep '|' | awk '{print $1}' | sort -u | tr '\n' ', ' | head -c 200)
fi

if [ -z "$COMPLETED" ] && [ -z "$INVESTIGATED" ] && [ -n "$EXCERPT" ]; then
  READ_COUNT=$(echo "$EXCERPT" | grep -c '"Read"' 2>/dev/null || echo "0")
  GREP_COUNT=$(echo "$EXCERPT" | grep -c '"Grep"' 2>/dev/null || echo "0")
  WEB_COUNT=$(echo "$EXCERPT" | grep -c '"WebSearch\|WebFetch"' 2>/dev/null || echo "0")
  TOTAL=$((READ_COUNT + GREP_COUNT + WEB_COUNT))
  if [ "$TOTAL" -gt 0 ]; then
    INVESTIGATED="Research session: ${READ_COUNT} reads, ${GREP_COUNT} searches, ${WEB_COUNT} web lookups"
    COMPLETED="Exploration/research session (${TOTAL} tool calls, no code changes)"
  fi
fi

if [ -z "$COMPLETED" ] && [ -z "$REQUEST" ] && [ -z "$INVESTIGATED" ]; then
  echo '{"continue":true}'
  exit 0
fi

# --- Write .last-session.json (always) ---
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

# --- MEMORY.md: fallback write + trimming ---
ENCODED_PATH=$(echo "$CWD" | /usr/bin/sed 's|/|-|g')
MEMORY_DIR="$HOME/.claude/projects/$ENCODED_PATH/memory"
MEMORY_MD="$MEMORY_DIR/MEMORY.md"

if [ -f "$MEMORY_MD" ]; then
  # Skip MEMORY.md writing if prompt hook already updated it (within last 60s)
  MEMORY_MTIME=$(stat -f %m "$MEMORY_MD" 2>/dev/null || stat -c %Y "$MEMORY_MD" 2>/dev/null || echo "0")
  NOW_EPOCH=$(date +%s)
  AGE=$((NOW_EPOCH - MEMORY_MTIME))

  if [ "$AGE" -gt 60 ]; then
    # Prompt hook didn't update — use heuristic fallback
    DISPLAY_NEXT="${NEXT_STEPS:-${COMPLETED:-No next steps recorded}}"
    DISPLAY_LEARNED="${LEARNED:-No new learnings recorded}"

    NEW_BLOCK="## Last Session
- Next: ${DISPLAY_NEXT}
- Learned: ${DISPLAY_LEARNED}
<!-- AUTO-UPDATED by session-summary.sh -->"

    if grep -q '<!-- LAST-SESSION-START -->' "$MEMORY_MD" 2>/dev/null; then
      awk -v block="$NEW_BLOCK" '
        /<!-- LAST-SESSION-START -->/ { print "<!-- LAST-SESSION-START -->"; print block; skip=1; next }
        /<!-- LAST-SESSION-END -->/ { skip=0; print; next }
        !skip { print }
      ' "$MEMORY_MD" > "${MEMORY_MD}.tmp" 2>/dev/null && mv "${MEMORY_MD}.tmp" "$MEMORY_MD" 2>/dev/null
    else
      printf '\n<!-- LAST-SESSION-START -->\n%s\n<!-- LAST-SESSION-END -->\n' "$NEW_BLOCK" >> "$MEMORY_MD" 2>/dev/null
    fi
  fi

  # --- Priority-Based Trimming (always runs) ---
  LINE_COUNT=$(wc -l < "$MEMORY_MD" 2>/dev/null | tr -d ' ')

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

  if [ "$LINE_COUNT" -gt 180 ]; then
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

  if [ "$LINE_COUNT" -gt 200 ]; then
    awk '
      /<!-- COMPACT-STATE-START -->/{skip=1; next}
      /<!-- COMPACT-STATE-END -->/{skip=0; next}
      !skip
    ' "$MEMORY_MD" > "${MEMORY_MD}.tmp" 2>/dev/null && mv "${MEMORY_MD}.tmp" "$MEMORY_MD" 2>/dev/null
  fi
fi

echo '{"continue":true}'
exit 0
