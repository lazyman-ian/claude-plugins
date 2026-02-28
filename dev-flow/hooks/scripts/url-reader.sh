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
    # --- MCP-handled domains: skip, let Claude use dedicated tools ---
    *notion.so/*|*notion.site/*)
      ;; # Notion MCP
    *figma.com/*)
      ;; # Figma MCP
    *github.com/*)
      ;; # gh CLI
    *linear.app/*)
      ;; # Linear MCP

    # --- Private/internal URLs: never route through external proxy ---
    *localhost*|*127.0.0.1*|*0.0.0.0*|*10.*|*192.168.*|*172.1[6-9].*|*172.2[0-9].*|*172.3[0-1].*)
      ;;

    # --- X/Twitter: always use Jina (JS-rendered articles) ---
    *x.com/*/status/*|*twitter.com/*/status/*)
      HINTS="${HINTS}[URL] ${url} → WebFetch https://r.jina.ai/${url} (X 需要 JS 渲染)\n"
      ;;

    # --- Other public URLs: suggest Jina as fallback ---
    *)
      HINTS="${HINTS}[URL] ${url} → WebFetch https://r.jina.ai/${url} (Jina 渲染 JS 页面更完整)\n"
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
