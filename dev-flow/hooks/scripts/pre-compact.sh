#!/bin/bash
set -o pipefail

INPUT=$(cat)
TRIGGER=$(echo "$INPUT" | jq -r '.trigger // "auto"' 2>/dev/null)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty' 2>/dev/null)
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // empty' 2>/dev/null)
CUSTOM_INST=$(echo "$INPUT" | jq -r '.custom_instructions // empty' 2>/dev/null)

project_dir="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
LEDGER_DIR="$project_dir/thoughts/ledgers"

# --- Layer 1: Filesystem state ---
BRANCH=$(git -C "$project_dir" branch --show-current 2>/dev/null || echo "detached")
GIT_DIFF=$(git -C "$project_dir" diff --stat 2>/dev/null | tail -10)
GIT_STAGED=$(git -C "$project_dir" diff --cached --stat 2>/dev/null | tail -5)
RECENT_COMMITS=$(git -C "$project_dir" log --oneline -5 2>/dev/null)

LEDGER_STATE=""
OPEN_QUESTIONS=""
if [[ -d "$LEDGER_DIR" ]]; then
  ACTIVE_LEDGER=$(ls -t "$LEDGER_DIR"/CONTINUITY_CLAUDE-*.md 2>/dev/null | head -1)
  if [[ -n "$ACTIVE_LEDGER" && -f "$ACTIVE_LEDGER" ]]; then
    LEDGER_STATE=$(grep -A 20 '## State' "$ACTIVE_LEDGER" 2>/dev/null | head -20)
    OPEN_QUESTIONS=$(grep -A 10 '## Open Questions' "$ACTIVE_LEDGER" 2>/dev/null | head -10)
    /usr/bin/sed -i '' "s/^Updated: .*/Updated: $(date -u +"%Y-%m-%dT%H:%M:%S.000Z")/" "$ACTIVE_LEDGER" 2>/dev/null || true
  fi
fi

# --- Layer 2: Transcript state (via Node.js for large JSONL) ---
TASK_STATE=""
RECENT_ACTIONS=""
LAST_CONTEXT=""
MODIFIED_FILES=""
if [[ -n "$TRANSCRIPT_PATH" && -f "$TRANSCRIPT_PATH" ]]; then
  TRANSCRIPT_JSON=$(node -e "
    const fs = require('fs');
    const lines = fs.readFileSync(process.argv[1], 'utf-8').split('\n').filter(l => l.trim());
    const result = { tasks: [], tools: [], files: new Set(), lastMsg: '' };
    for (const line of lines) {
      try {
        const e = JSON.parse(line);
        if ((e.role === 'assistant' || e.type === 'assistant') && typeof e.content === 'string')
          result.lastMsg = e.content;
        const tn = e.tool_name || e.name || '';
        if (tn.includes('Todo') || tn.includes('Task')) {
          const inp = e.tool_input || {};
          if (inp.subject || inp.todos) result.tasks.push(inp);
        }
        if (['Edit','Write'].some(t => tn.includes(t))) {
          const fp = (e.tool_input || {}).file_path;
          if (fp) result.files.add(fp.replace(process.argv[2] + '/', ''));
        }
        if (tn) result.tools.push(tn);
      } catch {}
    }
    console.log(JSON.stringify({
      lastMsg: result.lastMsg.slice(-400),
      files: [...result.files].slice(-10),
      recentTools: result.tools.slice(-8),
      taskCount: result.tasks.length
    }));
  " "$TRANSCRIPT_PATH" "$project_dir" 2>/dev/null || echo "")

  if [[ -n "$TRANSCRIPT_JSON" ]]; then
    LAST_CONTEXT=$(echo "$TRANSCRIPT_JSON" | jq -r '.lastMsg // empty' 2>/dev/null)
    MODIFIED_FILES=$(echo "$TRANSCRIPT_JSON" | jq -r '.files | join(", ")' 2>/dev/null)
    RECENT_ACTIONS=$(echo "$TRANSCRIPT_JSON" | jq -r '.recentTools | join(" → ")' 2>/dev/null)
  fi
fi

# --- Output 1: Compact Checkpoint (file) ---
if [[ -d "$LEDGER_DIR" ]]; then
  CHECKPOINT="$LEDGER_DIR/.compact-checkpoint.md"
  cat > "$CHECKPOINT" << HEREDOC
# Compact Checkpoint
**Branch**: ${BRANCH}
**Time**: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
**Trigger**: ${TRIGGER}
${CUSTOM_INST:+**User note**: ${CUSTOM_INST}}

## Uncommitted Changes
${GIT_DIFF:-No uncommitted changes}

## Staged Changes
${GIT_STAGED:-Nothing staged}

## Recent Commits
${RECENT_COMMITS:-No recent commits}

## Active Ledger State
${LEDGER_STATE:-No active ledger}

## Open Questions
${OPEN_QUESTIONS:-None}

## Files Modified This Session
${MODIFIED_FILES:-Unknown (no transcript)}

## Last Context
${LAST_CONTEXT:+$(echo "$LAST_CONTEXT" | head -c 300)}
HEREDOC
fi

# --- Output 2: Auto Memory MEMORY.md update ---
ENCODED_PATH=$(echo "$project_dir" | /usr/bin/sed 's|/|-|g')
MEMORY_DIR="$HOME/.claude/projects/$ENCODED_PATH/memory"
MEMORY_MD="$MEMORY_DIR/MEMORY.md"

if [[ -f "$MEMORY_MD" ]]; then
  LEDGER_NOW=$(echo "$LEDGER_STATE" | grep -oE '(Now|→).*' | head -1 || echo 'none')
  OPEN_BRIEF=""
  [[ -n "$OPEN_QUESTIONS" ]] && OPEN_BRIEF=$(echo "$OPEN_QUESTIONS" | head -2 | tr '\n' '; ')

  STATE_TMP=$(mktemp)
  cat > "$STATE_TMP" << STATEEOF
<!-- COMPACT-STATE-START -->
## Working State (auto-saved before compact)
- Branch: ${BRANCH}
- Modified: ${MODIFIED_FILES:-unknown}
- Ledger: ${LEDGER_NOW}
${OPEN_BRIEF:+- Open: ${OPEN_BRIEF}}
<!-- AUTO-UPDATED by pre-compact.sh -->
<!-- COMPACT-STATE-END -->
STATEEOF

  if grep -q '<!-- COMPACT-STATE-START -->' "$MEMORY_MD" 2>/dev/null; then
    awk '
      /<!-- COMPACT-STATE-START -->/ { skip=1; next }
      /<!-- COMPACT-STATE-END -->/ { skip=0; next }
      !skip { print }
    ' "$MEMORY_MD" > "${MEMORY_MD}.tmp" 2>/dev/null
    if grep -q '<!-- LAST-SESSION-START -->' "${MEMORY_MD}.tmp" 2>/dev/null; then
      awk -v sfile="$STATE_TMP" '
        /<!-- LAST-SESSION-START -->/ { while ((getline line < sfile) > 0) print line; print "" }
        { print }
      ' "${MEMORY_MD}.tmp" > "${MEMORY_MD}.tmp2" 2>/dev/null && mv "${MEMORY_MD}.tmp2" "$MEMORY_MD" 2>/dev/null
    else
      cat "$STATE_TMP" >> "${MEMORY_MD}.tmp" 2>/dev/null
      mv "${MEMORY_MD}.tmp" "$MEMORY_MD" 2>/dev/null
    fi
    rm -f "${MEMORY_MD}.tmp" 2>/dev/null
  elif grep -q '<!-- LAST-SESSION-START -->' "$MEMORY_MD" 2>/dev/null; then
    awk -v sfile="$STATE_TMP" '
      /<!-- LAST-SESSION-START -->/ { while ((getline line < sfile) > 0) print line; print "" }
      { print }
    ' "$MEMORY_MD" > "${MEMORY_MD}.tmp" 2>/dev/null && mv "${MEMORY_MD}.tmp" "$MEMORY_MD" 2>/dev/null
  else
    printf '\n' >> "$MEMORY_MD" 2>/dev/null
    cat "$STATE_TMP" >> "$MEMORY_MD" 2>/dev/null
  fi
  rm -f "$STATE_TMP" 2>/dev/null
fi

# --- Output 3: systemMessage (immediate injection) ---
BRIEF="Branch: ${BRANCH}"
[[ -n "$MODIFIED_FILES" ]] && BRIEF="$BRIEF | Files: $(echo "$MODIFIED_FILES" | head -c 80)"
[[ -n "$LEDGER_STATE" ]] && BRIEF="$BRIEF | $(echo "$LEDGER_STATE" | grep -oE '(Now|→).*' | head -1)"

BRIEF_ESC=$(echo "$BRIEF" | /usr/bin/sed 's/\\/\\\\/g; s/"/\\"/g' | tr '\n' ' ' | head -c 200)

echo "{\"continue\":true,\"systemMessage\":\"[PreCompact] Working state saved. ${BRIEF_ESC}\"}"
