#!/usr/bin/env bash
# validate-plugins.sh - Validate all claude-plugins plugin structure, hooks, and skills
# Usage: ./scripts/validate-plugins.sh

set -o pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGINS=(dev-flow ios-swift-plugin android-kotlin-plugin utils-plugin research-plugin)

pass=0
fail=0

ok() {
  echo "  ✅ $1"
  ((pass++))
}

fail() {
  echo "  ❌ $1"
  ((fail++))
}

# ---------------------------------------------------------------------------
# plugin.json validation
# ---------------------------------------------------------------------------
validate_plugin_json() {
  local plugin="$1"
  local json_file="$REPO_ROOT/$plugin/.claude-plugin/plugin.json"

  echo "--- plugin.json ---"

  if [[ ! -f "$json_file" ]]; then
    fail "$plugin/.claude-plugin/plugin.json missing"
    return
  fi

  ok "$plugin/.claude-plugin/plugin.json exists"

  if ! python3 -c "import json,sys; json.load(open('$json_file'))" 2>/dev/null; then
    fail "$plugin/plugin.json is not valid JSON"
    return
  fi
  ok "$plugin/plugin.json valid JSON"

  for field in name version description; do
    val=$(python3 -c "import json; d=json.load(open('$json_file')); print(d.get('$field',''))" 2>/dev/null)
    if [[ -z "$val" ]]; then
      fail "$plugin/plugin.json missing field: $field"
    else
      ok "$plugin/plugin.json has $field: $val"
    fi
  done
}

# ---------------------------------------------------------------------------
# hooks.json validation
# ---------------------------------------------------------------------------
validate_hooks_json() {
  local plugin="$1"
  local hooks_file="$REPO_ROOT/$plugin/hooks/hooks.json"

  echo "--- hooks.json ---"

  if [[ ! -f "$hooks_file" ]]; then
    fail "$plugin/hooks/hooks.json missing"
    return
  fi

  ok "$plugin/hooks/hooks.json exists"

  if ! python3 -c "import json,sys; json.load(open('$hooks_file'))" 2>/dev/null; then
    fail "$plugin/hooks/hooks.json is not valid JSON"
    return
  fi
  ok "$plugin/hooks/hooks.json valid JSON"

  has_hooks=$(python3 -c "
import json, sys
try:
    d = json.load(open('$hooks_file'))
    print('yes' if 'hooks' in d else 'no')
except:
    print('no')
" 2>/dev/null)

  if [[ "$has_hooks" == "yes" ]]; then
    ok "$plugin/hooks/hooks.json has top-level 'hooks' key"
  else
    fail "$plugin/hooks/hooks.json missing top-level 'hooks' key"
    return
  fi

  # Validate referenced hook scripts (only type: "command" entries)
  python3 -c "
import json, sys

with open('$hooks_file') as f:
    data = json.load(f)

def find_commands(obj):
    if isinstance(obj, dict):
        hook_type = obj.get('type', 'command')
        if hook_type == 'command' and 'command' in obj:
            yield obj['command']
        for v in obj.values():
            yield from find_commands(v)
    elif isinstance(obj, list):
        for item in obj:
            yield from find_commands(item)

for cmd in find_commands(data):
    # Extract the script path (first token), ignore args
    parts = cmd.split()
    script = parts[0] if parts else ''
    # Replace \${CLAUDE_PLUGIN_ROOT} with actual plugin dir
    script = script.replace('\${CLAUDE_PLUGIN_ROOT}', '$REPO_ROOT/$plugin')
    print(script)
" 2>/dev/null | while read -r script; do
    [[ -z "$script" ]] && continue
    if [[ ! -f "$script" ]]; then
      fail "$plugin hook script missing: ${script#$REPO_ROOT/$plugin/}"
    else
      ok "$plugin hook script exists: ${script#$REPO_ROOT/$plugin/}"
      if [[ ! -x "$script" ]]; then
        fail "$plugin hook script not executable: ${script#$REPO_ROOT/$plugin/}"
      else
        ok "$plugin hook script is executable: ${script#$REPO_ROOT/$plugin/}"
      fi
    fi
  done
}

# ---------------------------------------------------------------------------
# SKILL.md validation
# ---------------------------------------------------------------------------
validate_skills() {
  local plugin="$1"
  local skills_dir="$REPO_ROOT/$plugin/skills"

  echo "--- skills ---"

  if [[ ! -d "$skills_dir" ]]; then
    fail "$plugin/skills/ directory missing"
    return
  fi

  local skill_count=0
  while IFS= read -r -d '' skill_file; do
    skill_count=$((skill_count + 1))
    local skill_name
    skill_name=$(basename "$(dirname "$skill_file")")
    local rel="${skill_file#$REPO_ROOT/$plugin/}"

    # Check frontmatter starts with ---
    local first_line
    first_line=$(head -1 "$skill_file" 2>/dev/null)
    if [[ "$first_line" != "---" ]]; then
      fail "$plugin/$rel: missing YAML frontmatter (no opening ---)"
      continue
    fi
    ok "$plugin/$rel: has YAML frontmatter"

    # Check name field in frontmatter
    if python3 -c "
import sys
with open('$skill_file') as f:
    lines = f.readlines()
# Find frontmatter block
if not lines or lines[0].strip() != '---':
    sys.exit(1)
in_fm = True
found = False
for line in lines[1:]:
    if line.strip() == '---':
        break
    if line.startswith('name:') and line[5:].strip():
        found = True
        break
sys.exit(0 if found else 1)
" 2>/dev/null; then
      ok "$plugin/$rel: has 'name' field"
    else
      fail "$plugin/$rel: missing 'name' field in frontmatter"
    fi

    # Check description field in frontmatter
    if python3 -c "
import sys
with open('$skill_file') as f:
    lines = f.readlines()
if not lines or lines[0].strip() != '---':
    sys.exit(1)
found = False
for line in lines[1:]:
    if line.strip() == '---':
        break
    if line.startswith('description:') and line[12:].strip():
        found = True
        break
sys.exit(0 if found else 1)
" 2>/dev/null; then
      ok "$plugin/$rel: has 'description' field"
    else
      fail "$plugin/$rel: missing 'description' field in frontmatter"
    fi

    # Check line count < 500
    local line_count
    line_count=$(wc -l < "$skill_file" | tr -d ' ')
    if [[ "$line_count" -lt 500 ]]; then
      ok "$plugin/$rel: ${line_count} lines (< 500)"
    else
      fail "$plugin/$rel: ${line_count} lines (>= 500, too long)"
    fi

  done < <(/usr/bin/find "$skills_dir" -name "SKILL.md" -print0 2>/dev/null)

  if [[ "$skill_count" -eq 0 ]]; then
    fail "$plugin: no SKILL.md files found"
  else
    ok "$plugin: found $skill_count skill(s)"
  fi
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
echo "============================================================"
echo "  Claude Plugins Validation"
echo "  Repo: $REPO_ROOT"
echo "============================================================"

for plugin in "${PLUGINS[@]}"; do
  echo ""
  echo "============================================================"
  echo "  Plugin: $plugin"
  echo "============================================================"

  validate_plugin_json "$plugin"
  validate_hooks_json "$plugin"
  validate_skills "$plugin"
done

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "============================================================"
echo "  Summary"
echo "============================================================"
echo "  Total: $((pass + fail)) checks"
echo "  ✅ Passed: $pass"
echo "  ❌ Failed: $fail"
echo "============================================================"

if [[ "$fail" -gt 0 ]]; then
  exit 1
else
  exit 0
fi
