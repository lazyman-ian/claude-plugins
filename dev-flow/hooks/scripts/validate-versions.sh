#!/usr/bin/env bash
# validate-versions.sh: Check plugin.json and marketplace.json version consistency
# Triggered by PostToolUse on Edit|Write — warns if a plugin.json was just modified
# and the corresponding marketplace.json version is out of sync.

set -o pipefail

INPUT=$(cat 2>/dev/null || echo "")
[[ -z "$INPUT" ]] && exit 0

file_path=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null || echo "")
case "$file_path" in
  *plugin.json|*marketplace.json) ;; # continue with validation
  *) echo '{"continue": true}'; exit 0 ;; # early exit for non-manifest files
esac

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
MISMATCHES=()

for plugin_dir in ios-swift-plugin dev-flow android-kotlin-plugin utils-plugin research-plugin; do
    pjson="$PROJECT_DIR/$plugin_dir/.claude-plugin/plugin.json"
    mjson="$PROJECT_DIR/$plugin_dir/.claude-plugin/marketplace.json"
    [[ ! -f "$pjson" ]] && continue
    [[ ! -f "$mjson" ]] && continue

    plugin_ver=$(jq -r '.version // empty' "$pjson" 2>/dev/null || echo "")
    market_ver=$(jq -r '.plugins[0].version // .version // empty' "$mjson" 2>/dev/null || echo "")

    [[ -z "$plugin_ver" || -z "$market_ver" ]] && continue
    [[ "$plugin_ver" == "$market_ver" ]] && continue

    MISMATCHES+=("$plugin_dir: plugin.json=$plugin_ver marketplace.json=$market_ver")
done

# Also check root marketplace.json
root_mjson="$PROJECT_DIR/.claude-plugin/marketplace.json"
if [[ -f "$root_mjson" ]]; then
    for plugin_dir in ios-swift-plugin dev-flow android-kotlin-plugin utils-plugin research-plugin; do
        pjson="$PROJECT_DIR/$plugin_dir/.claude-plugin/plugin.json"
        [[ ! -f "$pjson" ]] && continue

        plugin_ver=$(jq -r '.version // empty' "$pjson" 2>/dev/null || echo "")
        plugin_name=$(jq -r '.name // empty' "$pjson" 2>/dev/null || echo "")
        [[ -z "$plugin_ver" || -z "$plugin_name" ]] && continue

        root_ver=$(jq -r --arg name "$plugin_name" '.plugins[] | select(.name == $name) | .version // empty' "$root_mjson" 2>/dev/null || echo "")
        [[ -z "$root_ver" ]] && continue
        [[ "$plugin_ver" == "$root_ver" ]] && continue

        MISMATCHES+=("root marketplace: $plugin_name plugin.json=$plugin_ver marketplace.json=$root_ver")
    done
fi

if [[ ${#MISMATCHES[@]} -gt 0 ]]; then
    echo "WARNING: Version mismatch detected (update marketplace.json to match plugin.json):" >&2
    for m in "${MISMATCHES[@]}"; do
        echo "  $m" >&2
    done
fi

exit 0
