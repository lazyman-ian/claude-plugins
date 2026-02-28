#!/bin/bash
set -o pipefail

# UserPromptSubmit URL Detection Hook
# Detects URLs in user prompt → injects reading strategy via additionalContext
# Cost: $0, latency: <10ms

INPUT=$(cat)
PROMPT_TEXT=$(echo "$INPUT" | jq -r '.prompt // empty' 2>/dev/null)

if [[ -z "$PROMPT_TEXT" ]]; then
  echo '{"continue":true}'
  exit 0
fi

# Extract URLs from prompt (http/https)
URLS=$(echo "$PROMPT_TEXT" | grep -oE 'https?://[^ ]+' | head -3)

if [[ -z "$URLS" ]]; then
  echo '{"continue":true}'
  exit 0
fi

# Build strategy hints per URL
HINTS=""
while IFS= read -r url; do
  [[ -z "$url" ]] && continue
  # Strip trailing punctuation
  url=$(echo "$url" | /usr/bin/sed 's/[),.:;!?]*$//')

  case "$url" in
    *x.com/*/status/*|*twitter.com/*/status/*)
      HINTS="${HINTS}[URL] ${url} → WebFetch https://r.jina.ai/${url} (X 需要 JS 渲染)\n"
      ;;
  esac
done <<< "$URLS"

if [[ -z "$HINTS" ]]; then
  echo '{"continue":true}'
  exit 0
fi

# Use printf to avoid backslash expansion in URLs
CONTEXT=$(printf '%b' "$HINTS" | head -c 400)

jq -n --arg ctx "$CONTEXT" \
  '{"continue":true,"hookSpecificOutput":{"additionalContext":$ctx,"hookEventName":"UserPromptSubmit"}}' 2>/dev/null || echo '{"continue":true}'
