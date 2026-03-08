#!/bin/bash
set -o pipefail

# Session Summary Stop Hook
# Handles MEMORY.md fallback writing (if Claude didn't update it) + priority-based trimming

INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)
STOP_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false' 2>/dev/null)

if [ "$STOP_ACTIVE" = "true" ]; then
  echo '{"continue":true}'
  exit 0
fi

RECENT_COMMITS=$(git -C "$CWD" log --oneline -5 2>/dev/null || echo "")
GIT_CHANGES=$(git -C "$CWD" diff --stat HEAD~3 2>/dev/null | tail -5 || echo "")
UNCOMMITTED=$(git -C "$CWD" diff --stat 2>/dev/null || echo "")
STAGED=$(git -C "$CWD" diff --cached --stat 2>/dev/null || echo "")

# Heuristic summary
COMPLETED=""
INVESTIGATED=""

if [ -n "$RECENT_COMMITS" ]; then
  COMPLETED=$(echo "$RECENT_COMMITS" | head -3 | tr '\n' '; ' | head -c 200)
fi

ALL_CHANGES="${GIT_CHANGES}${UNCOMMITTED}${STAGED}"
if [ -n "$ALL_CHANGES" ]; then
  INVESTIGATED=$(echo "$ALL_CHANGES" | grep '|' | awk '{print $1}' | sort -u | tr '\n' ', ' | head -c 200)
fi

if [ -z "$COMPLETED" ] && [ -z "$INVESTIGATED" ]; then
  echo '{"continue":true}'
  exit 0
fi

# --- MEMORY.md: fallback write + trimming ---
ENCODED_PATH=$(echo "$CWD" | /usr/bin/sed 's|/|-|g')
MEMORY_MD="$HOME/.claude/projects/$ENCODED_PATH/memory/MEMORY.md"

if [ -f "$MEMORY_MD" ]; then
  # Skip if Claude already updated MEMORY.md within last 60s
  MEMORY_MTIME=$(stat -f %m "$MEMORY_MD" 2>/dev/null || stat -c %Y "$MEMORY_MD" 2>/dev/null || echo "0")
  NOW_EPOCH=$(date +%s)
  AGE=$((NOW_EPOCH - MEMORY_MTIME))

  if [ "$AGE" -gt 60 ]; then
    DISPLAY_NEXT="${COMPLETED:-No next steps recorded}"

    NEW_BLOCK="## Last Session
- Next: ${DISPLAY_NEXT}
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
