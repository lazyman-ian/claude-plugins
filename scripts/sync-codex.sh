#!/usr/bin/env bash
# sync-codex.sh — Sync Claude Code configs to Codex CLI format
#
# USAGE:
#   bash sync-codex.sh [--project] [--dry-run] [--verbose] [--clean]
#
# MODES:
#   (default)   Marketplace repo — scans local plugin dirs
#   --project   Any project — scans installed plugins from ~/.claude/plugins/cache/
#
# OPTIONS:
#   --with-global  Also compile ~/.claude/rules/ → ~/.codex/AGENTS.md
#
# GENERATES:
#   ~/.agents/skills/*         User-scope symlinks to plugin skills (both modes)
#   .agents/skills/*           Project-scope .claude/skills/ symlinks (both modes)
#   AGENTS.md                  Project instructions + behavioral rules for Codex
#   .codex/config.toml         MCP server + agent roles
#   .codex/rules/safety.rules  Starlark safety rules
#   ~/.codex/AGENTS.md         Global behavioral rules (--with-global only)

set -o pipefail

DRY_RUN=0; VERBOSE=0; CLEAN=0; MODE=""; WITH_GLOBAL=0
for arg in "$@"; do
  case "$arg" in
    --project)     MODE="project" ;;
    --with-global) WITH_GLOBAL=1 ;;
    --dry-run)     DRY_RUN=1 ;;
    --verbose)     VERBOSE=1 ;;
    --clean)       CLEAN=1 ;;
    --help|-h)     head -18 "$0" | tail -16; exit 0 ;;
  esac
done

# Resolve repo root: --project uses cwd, default uses script parent
if [[ "$MODE" == "project" ]]; then
  REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
else
  REPO_ROOT="$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel 2>/dev/null)"
  [[ -z "$REPO_ROOT" ]] && REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fi

# Auto-detect mode if not specified
if [[ -z "$MODE" ]]; then
  [[ -f "$REPO_ROOT/.claude-plugin/marketplace.json" ]] && MODE="marketplace" || MODE="project"
fi

PLUGIN_CACHE="${HOME}/.claude/plugins/cache"

log() { [[ $VERBOSE -eq 1 ]] && echo "  $*"; }

# Extract name from YAML frontmatter (BSD awk compatible)
extract_name() {
  awk -F': ' '/^---$/{f++; next} f==1 && $1=="name"{print $2; exit}' "$1" 2>/dev/null
}

# Extract description from YAML frontmatter (handles >- multiline, BSD awk compatible)
extract_desc() {
  awk 'BEGIN{d=""; sep=""} /^---$/{f++; next} f>=2{if(length(d)>0) print d; exit} f==1 && /^description:/{sub(/^description: */, ""); if($0==">-" || $0==">" || $0=="|" || $0==""){m=1; next} print; exit} f==1 && m && /^  /{sub(/^ +/, ""); d = d sep $0; sep = " "; next} f==1 && m{print d; exit}' "$1" 2>/dev/null
}

# Truncate to first sentence, max 120 chars
truncate_desc() {
  echo "$1" | /usr/bin/sed 's/\. .*/\./' | cut -c1-120
}

# Escape double quotes for TOML strings
escape_toml() {
  echo "$1" | /usr/bin/sed 's/"/\\"/g'
}

# ────────────────────────────────────────────────
# 1. Skills: plugin skills → ~/.agents/skills/ (user scope)
#            .claude/skills/ → .agents/skills/ (project scope)
# ────────────────────────────────────────────────
sync_skills() {
  local global_target="${HOME}/.agents/skills"
  local project_target="$REPO_ROOT/.agents/skills"
  [[ $CLEAN -eq 1 ]] && rm -rf "$global_target" "$project_target"
  mkdir -p "$global_target"

  local new=0 unchanged=0 total=0

  # Plugin skills (*/skills/) → ~/.agents/skills/ (user scope, shared across projects)
  for skill_dir in "$REPO_ROOT"/*/skills/*/; do
    [[ -f "$skill_dir/SKILL.md" ]] || continue
    local name
    name=$(basename "$skill_dir")
    local abs_path
    abs_path=$(cd "$skill_dir" && pwd)
    ((total++))

    if [[ -L "$global_target/$name" ]] && [[ "$(readlink "$global_target/$name")" == "$abs_path" ]]; then
      ((unchanged++)); continue
    fi
    [[ -e "$global_target/$name" ]] && rm -rf "$global_target/$name"

    if [[ $DRY_RUN -eq 0 ]]; then
      ln -sf "$abs_path" "$global_target/$name"
    fi
    log "+ $name -> $abs_path (user)"
    ((new++))
  done

  # Project-local skills (.claude/skills/) → .agents/skills/ (project scope)
  for skill_dir in "$REPO_ROOT"/.claude/skills/*/; do
    [[ -f "$skill_dir/SKILL.md" ]] || continue
    mkdir -p "$project_target"
    local name
    name=$(basename "$skill_dir")
    local rel="../../.claude/skills/$name"
    ((total++))

    if [[ -L "$project_target/$name" ]] && [[ "$(readlink "$project_target/$name")" == "$rel" ]]; then
      ((unchanged++)); continue
    fi
    [[ -e "$project_target/$name" ]] && rm -rf "$project_target/$name"

    if [[ $DRY_RUN -eq 0 ]]; then
      ln -sf "$rel" "$project_target/$name"
    fi
    log "+ $name -> $rel (project)"
    ((new++))
  done

  echo "  Skills: $total total, $new new, $unchanged unchanged"
}

# ────────────────────────────────────────────────
# 2. AGENTS.md: Project instructions for Codex
# ────────────────────────────────────────────────
generate_agents_md() {
  local output="$REPO_ROOT/AGENTS.md"

  # Collect agent rows
  local agent_rows=""
  for f in "$REPO_ROOT"/*/agents/*.md; do
    [[ -f "$f" ]] || continue
    [[ "$(basename "$f")" == "TEMPLATE.md" ]] && continue
    local name
    name=$(extract_name "$f")
    [[ -z "$name" ]] && name=$(basename "$f" .md)
    local desc
    desc=$(truncate_desc "$(extract_desc "$f")")
    [[ -z "$desc" ]] && continue
    agent_rows+="| $name | $desc |\n"
  done

  # Collect skill rows (both user-scope and project-scope)
  local skill_rows
  skill_rows=$(collect_skill_rows)

  if [[ $DRY_RUN -eq 1 ]]; then
    echo "  AGENTS.md: would generate"
    return
  fi

  cat > "$output" << 'EOF'
<!-- Auto-generated by scripts/sync-codex.sh — DO NOT EDIT DIRECTLY -->
<!-- Source: CLAUDE.md + plugin configs | Regenerate: bash scripts/sync-codex.sh -->

# Project Instructions

## Overview

lazyman-ian marketplace for AI coding plugins. 5 plugins in a single repository.

| Plugin | Purpose |
|--------|---------|
| dev-flow | Development workflow: brainstorm, plan, implement, review, commit, PR, release |
| ios-swift-plugin | iOS/Swift toolkit: SwiftUI, Concurrency, WidgetKit, Performance, Migration |
| android-kotlin-plugin | Android/Kotlin toolkit: Compose, Coroutines, Performance, Architecture |
| utils | Code quality: deslop, search-code, safety hooks |
| research | Research: Perplexity AI, Braintrust, RepoPrompt |

## Build Commands

```bash
npm install --prefix dev-flow/mcp-server
npm run --prefix dev-flow/mcp-server bundle    # Bundle MCP server (required)
npm run --prefix dev-flow/mcp-server build     # TypeScript compile
```

## Architecture

```
plugin-name/
  .claude-plugin/plugin.json    # Plugin manifest
  skills/                        # SKILL.md definitions
  agents/                        # Agent prompts (.md)
  hooks/                         # Hook configurations
```

## Code Standards

- Match existing file style (indentation, spacing, patterns)
- TODO/FIXME with ticket reference when possible
- Conventional commits: `type(scope): subject`
- Every task must have a verify command; success = exit code 0
- No AI attribution in commits

## Agents

| Agent | Description |
|-------|-------------|
EOF

  printf '%b' "$agent_rows" >> "$output"

  cat >> "$output" << 'EOF'

## Skills

Invoke with `$skill-name`. User-scope skills in `~/.agents/skills/`, project-scope in `.agents/skills/`.

| Skill | Description |
|-------|-------------|
EOF

  printf '%b' "$skill_rows" >> "$output"

  # Append behavioral rules from hooks
  behavioral_rules_section >> "$output"

  echo "  AGENTS.md: generated ($(wc -l < "$output" | tr -d ' ') lines)"
}

# ────────────────────────────────────────────────
# 3. .codex/config.toml: MCP + agent roles
# ────────────────────────────────────────────────
generate_codex_config() {
  local output="$REPO_ROOT/.codex/config.toml"
  mkdir -p "$(dirname "$output")"

  if [[ $DRY_RUN -eq 1 ]]; then
    echo "  .codex/config.toml: would generate"
    return
  fi

  cat > "$output" << 'EOF'
# Auto-generated by scripts/sync-codex.sh — DO NOT EDIT DIRECTLY
# Regenerate: bash scripts/sync-codex.sh

[features]
multi_agent = true

[mcp_servers.dev-flow]
command = "node"
args = ["dev-flow/scripts/mcp-server.cjs"]

[agents]
max_threads = 5
max_depth = 1

EOF

  for f in "$REPO_ROOT"/*/agents/*.md; do
    [[ -f "$f" ]] || continue
    [[ "$(basename "$f")" == "TEMPLATE.md" ]] && continue
    local name
    name=$(extract_name "$f")
    [[ -z "$name" ]] && name=$(basename "$f" .md)
    local desc
    desc=$(escape_toml "$(truncate_desc "$(extract_desc "$f")")")
    [[ -z "$desc" ]] && continue
    printf '[agents.%s]\ndescription = "%s"\n\n' "$name" "$desc" >> "$output"
  done

  echo "  .codex/config.toml: generated"
}

# ════════════════════════════════════════════════
# PROJECT MODE: Scan installed plugins + project configs
# ════════════════════════════════════════════════

# Find latest version dir for a plugin in cache
latest_version() {
  ls -t "$1" 2>/dev/null | head -1
}

# Project mode: Symlink installed plugin skills (global) + .claude/skills/ (project)
sync_skills_project() {
  local global_target="${HOME}/.agents/skills"
  local project_target="$REPO_ROOT/.agents/skills"
  [[ $CLEAN -eq 1 ]] && rm -rf "$global_target" "$project_target"
  mkdir -p "$global_target"

  local new=0 unchanged=0 total=0

  # Plugin cache skills → ~/.agents/skills/ (global, all projects share)
  if [[ -d "$PLUGIN_CACHE" ]]; then
    for author_dir in "$PLUGIN_CACHE"/*/; do
      [[ -d "$author_dir" ]] || continue
      for plugin_dir in "$author_dir"/*/; do
        [[ -d "$plugin_dir" ]] || continue
        local ver
        ver=$(latest_version "$plugin_dir")
        [[ -z "$ver" ]] && continue
        for skill_dir in "$plugin_dir/$ver"/skills/*/; do
          [[ -f "$skill_dir/SKILL.md" ]] || continue
          local name
          name=$(basename "$skill_dir")
          local abs_path="$skill_dir"
          ((total++))

          if [[ -L "$global_target/$name" ]] && [[ "$(readlink "$global_target/$name")" == "$abs_path" ]]; then
            ((unchanged++)); continue
          fi
          [[ -e "$global_target/$name" ]] && rm -rf "$global_target/$name"

          if [[ $DRY_RUN -eq 0 ]]; then
            ln -sf "$abs_path" "$global_target/$name"
          fi
          log "+ $name -> $abs_path (global)"
          ((new++))
        done
      done
    done
  fi

  # Project-local skills (.claude/skills/) → .agents/skills/ (project-level)
  local has_local=0
  for skill_dir in "$REPO_ROOT"/.claude/skills/*/; do
    [[ -f "$skill_dir/SKILL.md" ]] || continue
    has_local=1; break
  done

  if [[ $has_local -eq 1 ]]; then
    mkdir -p "$project_target"
    for skill_dir in "$REPO_ROOT"/.claude/skills/*/; do
      [[ -f "$skill_dir/SKILL.md" ]] || continue
      local name
      name=$(basename "$skill_dir")
      local rel="../../.claude/skills/$name"
      ((total++))

      if [[ -L "$project_target/$name" ]] && [[ "$(readlink "$project_target/$name")" == "$rel" ]]; then
        ((unchanged++)); continue
      fi
      [[ -e "$project_target/$name" ]] && rm -rf "$project_target/$name"

      if [[ $DRY_RUN -eq 0 ]]; then
        ln -sf "$rel" "$project_target/$name"
      fi
      log "+ $name -> $rel (local)"
      ((new++))
    done
  fi

  echo "  Skills: $total total, $new new, $unchanged unchanged"
}

# Collect agent rows from a list of dirs (reusable)
collect_agent_rows() {
  local rows=""
  for dir in "$@"; do
    [[ -d "$dir" ]] || continue
    for f in "$dir"/*.md; do
      [[ -f "$f" ]] || continue
      [[ "$(basename "$f")" == "TEMPLATE.md" ]] && continue
      local name
      name=$(extract_name "$f")
      [[ -z "$name" ]] && name=$(basename "$f" .md)
      local desc
      desc=$(truncate_desc "$(extract_desc "$f")")
      [[ -z "$desc" ]] && continue
      rows+="| $name | $desc |\n"
    done
  done
  echo "$rows"
}

# Collect skill rows from .agents/skills/ (global + project)
collect_skill_rows() {
  local rows=""
  local seen=""
  # Scan both global and project skill dirs (dedup by name)
  for target in "${HOME}/.agents/skills" "$REPO_ROOT/.agents/skills"; do
    [[ -d "$target" ]] || continue
    for skill_dir in "$target"/*/; do
      [[ -f "$skill_dir/SKILL.md" ]] || continue
      local name
      name=$(extract_name "$skill_dir/SKILL.md")
      [[ -z "$name" ]] && name=$(basename "$skill_dir")
      # Dedup: project-level overrides global
      echo "$seen" | /usr/bin/grep -q "^${name}$" && continue
      seen+="$name"$'\n'
      local desc
      desc=$(truncate_desc "$(extract_desc "$skill_dir/SKILL.md")")
      rows+="| \`\$${name}\` | $desc |\n"
    done
  done
  echo "$rows"
}

# Project mode: AGENTS.md from rules + catalog (CLAUDE.md read via fallback)
generate_agents_md_project() {
  local output="$REPO_ROOT/AGENTS.md"

  if [[ $DRY_RUN -eq 1 ]]; then
    echo "  AGENTS.md: would generate"
    return
  fi

  cat > "$output" << 'EOF'
<!-- Auto-generated by sync-codex.sh --project — DO NOT EDIT DIRECTLY -->
<!-- CLAUDE.md is read separately via project_doc_fallback_filenames -->
<!-- Regenerate: bash sync-codex.sh --project -->

# Supplementary Instructions
EOF

  # Compile .claude/rules/ into sections
  local rules_dir="$REPO_ROOT/.claude/rules"
  if [[ -d "$rules_dir" ]]; then
    printf '\n## Project Rules\n\n' >> "$output"
    /usr/bin/find "$rules_dir" -name "*.md" -type f | sort | while IFS= read -r rule_file; do
      local rule_name
      rule_name=$(basename "$rule_file" .md)
      printf '### %s\n\n' "$rule_name" >> "$output"
      # Strip YAML frontmatter, keep content
      awk '/^---$/{f++; next} f>=2||f==0{print}' "$rule_file" >> "$output"
      printf '\n' >> "$output"
    done
  fi

  # Agent catalog from plugin cache + .claude/agents/
  local agent_dirs=()
  if [[ -d "$PLUGIN_CACHE" ]]; then
    for author_dir in "$PLUGIN_CACHE"/*/; do
      for plugin_dir in "$author_dir"/*/; do
        local ver
        ver=$(latest_version "$plugin_dir")
        [[ -n "$ver" && -d "$plugin_dir/$ver/agents" ]] && agent_dirs+=("$plugin_dir/$ver/agents")
      done
    done
  fi
  [[ -d "$REPO_ROOT/.claude/agents" ]] && agent_dirs+=("$REPO_ROOT/.claude/agents")

  local agent_rows
  agent_rows=$(collect_agent_rows "${agent_dirs[@]}")

  if [[ -n "$agent_rows" ]]; then
    cat >> "$output" << 'EOF'

## Agents

| Agent | Description |
|-------|-------------|
EOF
    printf '%b' "$agent_rows" >> "$output"
  fi

  # Skill catalog from resolved symlinks
  local skill_rows
  skill_rows=$(collect_skill_rows)

  if [[ -n "$skill_rows" ]]; then
    cat >> "$output" << 'EOF'

## Skills

Invoke with `$skill-name`.

| Skill | Description |
|-------|-------------|
EOF
    printf '%b' "$skill_rows" >> "$output"
  fi

  # Append behavioral rules from hooks
  behavioral_rules_section >> "$output"

  echo "  AGENTS.md: generated ($(wc -l < "$output" | tr -d ' ') lines)"
}

# Project mode: config.toml from .mcp.json + agent roles
generate_codex_config_project() {
  local output="$REPO_ROOT/.codex/config.toml"
  mkdir -p "$(dirname "$output")"

  if [[ $DRY_RUN -eq 1 ]]; then
    echo "  .codex/config.toml: would generate"
    return
  fi

  cat > "$output" << 'EOF'
# Auto-generated by sync-codex.sh --project — DO NOT EDIT DIRECTLY
# Regenerate: bash sync-codex.sh --project

[features]
multi_agent = true

# Read CLAUDE.md as project instructions alongside AGENTS.md
project_doc_fallback_filenames = ["CLAUDE.md", "AGENTS.md"]

EOF

  # Parse .mcp.json for MCP servers
  local mcp_file=""
  [[ -f "$REPO_ROOT/.mcp.json" ]] && mcp_file="$REPO_ROOT/.mcp.json"
  [[ -f "$REPO_ROOT/.claude/.mcp.json" ]] && mcp_file="$REPO_ROOT/.claude/.mcp.json"

  if [[ -n "$mcp_file" ]]; then
    python3 -c "
import json, sys
with open('$mcp_file') as f:
    data = json.load(f)
for name, cfg in data.get('mcpServers', {}).items():
    cmd = cfg.get('command', '')
    args = cfg.get('args', [])
    print(f'[mcp_servers.{name}]')
    print(f'command = \"{cmd}\"')
    args_str = ', '.join(f'\"{a}\"' for a in args)
    print(f'args = [{args_str}]')
    env = cfg.get('env', {})
    if env:
        print('[mcp_servers.{}.env]'.format(name))
        for k, v in env.items():
            print(f'{k} = \"{v}\"')
    print()
" >> "$output" 2>/dev/null
    log "  MCP servers parsed from $mcp_file"
  fi

  # Agent roles from plugin cache
  printf '[agents]\nmax_threads = 5\nmax_depth = 1\n\n' >> "$output"

  if [[ -d "$PLUGIN_CACHE" ]]; then
    for author_dir in "$PLUGIN_CACHE"/*/; do
      for plugin_dir in "$author_dir"/*/; do
        local ver
        ver=$(latest_version "$plugin_dir")
        [[ -z "$ver" ]] && continue
        local agents_dir="$plugin_dir/$ver/agents"
        [[ -d "$agents_dir" ]] || continue
        for f in "$agents_dir"/*.md; do
          [[ -f "$f" ]] || continue
          [[ "$(basename "$f")" == "TEMPLATE.md" ]] && continue
          local name
          name=$(extract_name "$f")
          [[ -z "$name" ]] && name=$(basename "$f" .md)
          local desc
          desc=$(escape_toml "$(truncate_desc "$(extract_desc "$f")")")
          [[ -z "$desc" ]] && continue
          printf '[agents.%s]\ndescription = "%s"\n\n' "$name" "$desc" >> "$output"
        done
      done
    done
  fi

  echo "  .codex/config.toml: generated"
}

# ────────────────────────────────────────────────
# Behavioral rules section (soft constraints from Claude hooks)
# Injected into AGENTS.md for both modes
# ────────────────────────────────────────────────
behavioral_rules_section() {
  cat << 'SECTION'

## Behavioral Rules

These rules map Claude Code hook behaviors to Codex. Follow them strictly.

### Shell Safety
- Use `builtin cd` for directory changes (zoxide alias)
- Use `/usr/bin/sed` instead of `sed` (sd alias)
- Use `/usr/bin/find` instead of `find` (fd alias)
- Use `/usr/bin/curl` instead of `curl` (xh alias)
- Use `npm run --prefix`, `git -C`, `make -C` instead of cd + command

### Commit Workflow
- NEVER use raw `git commit` — use `$dev-commit` skill or `dev_commit` MCP tool
- NEVER use `git push --force` — use `--force-with-lease`
- NEVER skip verification with `--no-verify`
- Before committing: search knowledge vault for relevant pitfalls

### Tool Usage
- Prefer Read over cat/head/tail
- Prefer Edit over sed/awk for file modification
- Prefer Glob over find for file search
- Prefer Grep over grep/rg for content search

### Session Discipline
- At session start: load active ledger from `thoughts/ledgers/`
- At session start: check `thoughts/knowledge/` for critical pitfalls
- After editing files: run the appropriate formatter
- If same command fails 3+ times: stop and try a different approach
- Every task must have a verify command; completion = exit code 0

### Code Quality
- Match existing file style (indentation, spacing, patterns)
- No AI attribution in commits
- Conventional commits: `type(scope): subject`
- P0/P1 review findings block commit
SECTION
}

# ────────────────────────────────────────────────
# Global rules: ~/.claude/rules/ → ~/.codex/AGENTS.md
# ────────────────────────────────────────────────

# Rules safe to compile (Claude-specific rules excluded)
GLOBAL_RULES_ALLOW=(
  avoid-ai-slop
  continuity
  failure-detection
  mcp-scripts
  scope-control
  shell-safety
  verification-driven
  agent-orchestration
  user-habits
  memory-rules
)

is_allowed_rule() {
  local name="$1"
  for r in "${GLOBAL_RULES_ALLOW[@]}"; do
    [[ "$r" == "$name" ]] && return 0
  done
  return 1
}

seed_codex_memory() {
  local mem_path
  mem_path=$(resolve_memory_path "$REPO_ROOT")
  local codex_mem="${HOME}/.codex/memories/MEMORY.md"

  if [[ -z "$mem_path" ]]; then
    log "  Codex memory seed: no Claude memory found"
    return
  fi

  if [[ $DRY_RUN -eq 1 ]]; then
    echo "  Codex memory: would seed from $mem_path"
    return
  fi

  mkdir -p "$(dirname "$codex_mem")"

  # Only seed if Codex memory is empty or older than Claude memory
  if [[ ! -f "$codex_mem" ]] || [[ "$mem_path" -nt "$codex_mem" ]]; then
    cat > "$codex_mem" << SEED
# Codex Memory (seeded from Claude Code auto memory)
# Source: $mem_path
# Last synced: $(date -u +%Y-%m-%dT%H:%M:%SZ)
# This file is managed by Codex. Claude memory is synced periodically.

SEED
    cat "$mem_path" >> "$codex_mem"
    echo "  Codex memory: seeded from Claude auto memory"
  else
    echo "  Codex memory: up to date"
  fi
}

generate_global_agents_md() {
  local global_rules_dir="${HOME}/.claude/rules"
  local output="${HOME}/.codex/AGENTS.md"

  if [[ ! -d "$global_rules_dir" ]]; then
    echo "  ~/.codex/AGENTS.md: skipped (no ~/.claude/rules/)"
    return
  fi

  local included=0 skipped=0

  if [[ $DRY_RUN -eq 1 ]]; then
    for f in "$global_rules_dir"/*.md; do
      [[ -f "$f" ]] || continue
      local name
      name=$(basename "$f" .md)
      if is_allowed_rule "$name"; then
        ((included++))
      else
        ((skipped++))
        log "  skip: $name (Claude-specific)"
      fi
    done
    echo "  ~/.codex/AGENTS.md: would generate ($included rules, $skipped skipped)"
    return
  fi

  mkdir -p "$(dirname "$output")"

  cat > "$output" << 'EOF'
<!-- Auto-generated by scripts/sync-codex.sh --with-global — DO NOT EDIT DIRECTLY -->
<!-- Source: ~/.claude/rules/ | Regenerate: bash scripts/sync-codex.sh --with-global -->

# Global Behavioral Rules
EOF

  for f in "$global_rules_dir"/*.md; do
    [[ -f "$f" ]] || continue
    local name
    name=$(basename "$f" .md)

    if ! is_allowed_rule "$name"; then
      ((skipped++))
      log "  skip: $name (Claude-specific)"
      continue
    fi

    ((included++))
    printf '\n## %s\n\n' "$name" >> "$output"
    # Strip YAML frontmatter if present, keep content
    awk '/^---$/{f++; next} f>=2||f==0{print}' "$f" >> "$output"
  done

  # Also include project-specific rules
  local ps_dir="$global_rules_dir/.project-specific"
  if [[ -d "$ps_dir" ]]; then
    for f in "$ps_dir"/*.md; do
      [[ -f "$f" ]] || continue
      local name
      name=$(basename "$f" .md)
      ((included++))
      printf '\n## %s\n\n' "$name" >> "$output"
      awk '/^---$/{f++; next} f>=2||f==0{print}' "$f" >> "$output"
    done
  fi

  echo "  ~/.codex/AGENTS.md: generated ($included rules, $skipped skipped)"
}

# ────────────────────────────────────────────────
# Memory sync: Claude auto memory → Codex/Cursor
# ────────────────────────────────────────────────

# Resolve Claude project memory path from project root
resolve_memory_path() {
  local project_dir="$1"
  # Claude uses path-based hashing: /Users/foo/work/project → -Users-foo-work-project
  local hash
  hash=$(echo "$project_dir" | /usr/bin/sed 's|/|-|g')
  local mem="${HOME}/.claude/projects/${hash}/memory/MEMORY.md"
  [[ -f "$mem" ]] && echo "$mem" || echo ""
}

sync_memory() {
  local mem_path
  mem_path=$(resolve_memory_path "$REPO_ROOT")

  if [[ -z "$mem_path" ]]; then
    log "  Memory: no Claude auto memory found for $REPO_ROOT"
    return
  fi

  local synced=0

  # 1. Codex: Append to project AGENTS.md
  local agents_md="$REPO_ROOT/AGENTS.md"
  if [[ -f "$agents_md" ]] && [[ $DRY_RUN -eq 0 ]]; then
    # Check if memory section already exists (from previous sync)
    if /usr/bin/grep -q '## Project Memory' "$agents_md" 2>/dev/null; then
      # Replace existing memory section (everything after ## Project Memory)
      local line_num
      line_num=$(/usr/bin/grep -n '## Project Memory' "$agents_md" | head -1 | cut -d: -f1)
      if [[ -n "$line_num" ]]; then
        head -$((line_num - 1)) "$agents_md" > "${agents_md}.tmp"
        printf '\n## Project Memory\n\n' >> "${agents_md}.tmp"
        printf '> Auto-synced from Claude Code auto memory. Source of truth: `%s`\n\n' "$mem_path" >> "${agents_md}.tmp"
        cat "$mem_path" >> "${agents_md}.tmp"
        mv "${agents_md}.tmp" "$agents_md"
      fi
    else
      printf '\n## Project Memory\n\n' >> "$agents_md"
      printf '> Auto-synced from Claude Code auto memory. Source of truth: `%s`\n\n' "$mem_path" >> "$agents_md"
      cat "$mem_path" >> "$agents_md"
    fi
    ((synced++))
  fi

  # 2. Cursor: Symlink memory + auto-memory rule
  local cursor_rules="$REPO_ROOT/.cursor/rules"
  if [[ -d "$cursor_rules" ]] || [[ -d "$REPO_ROOT/.cursor" ]]; then
    mkdir -p "$cursor_rules"
    if [[ $DRY_RUN -eq 0 ]]; then
      # Symlink Claude memory as read-only context
      ln -sf "$mem_path" "$cursor_rules/memory.md"
      # Create auto-memory rule so Cursor also maintains memory
      cat > "$cursor_rules/auto-memory-protocol.md" << 'CURSOR_RULE'
# Auto Memory Protocol

Maintain a project memory file at `.cursor/memory/MEMORY.md`.

## When to Write
- After learning something reusable about this project (architecture, patterns, pitfalls)
- When user explicitly asks to remember something
- After discovering a non-obvious solution

## When NOT to Write
- Session-specific temporary context
- Information already in project docs
- Speculative or unverified conclusions

## Format
```markdown
## Section Name
- Key insight (1-2 lines max)
```

## Rules
- Keep total under 100 lines
- Update existing entries rather than appending duplicates
- Read `.cursor/memory/MEMORY.md` at the start of each conversation for context
CURSOR_RULE
      ((synced++))
      log "  Cursor: symlinked memory + created auto-memory rule"
    fi
  fi

  if [[ $DRY_RUN -eq 1 ]]; then
    echo "  Memory: would sync from $mem_path"
  else
    echo "  Memory: synced to $synced target(s) from $mem_path"
  fi
}

# ────────────────────────────────────────────────
# Shared: .codex/rules/safety.rules (same for both modes)
# ────────────────────────────────────────────────
generate_codex_rules() {
  local output="$REPO_ROOT/.codex/rules/safety.rules"
  mkdir -p "$(dirname "$output")"

  if [[ $DRY_RUN -eq 1 ]]; then
    echo "  .codex/rules/safety.rules: would generate"
    return
  fi

  cat > "$output" << 'EOF'
# Auto-generated by scripts/sync-codex.sh — DO NOT EDIT DIRECTLY
# Maps Claude Code PreToolUse hooks to Codex Starlark rules
# Regenerate: bash scripts/sync-codex.sh

# Block raw git commit (use $dev-commit skill instead)
prefix_rule(
    pattern = [["git", "commit"]],
    decision = "prompt",
    justification = "Use structured commit workflow instead of raw git commit",
)

# Block force push
prefix_rule(
    pattern = [["git", "push", "--force"]],
    decision = "forbidden",
    justification = "Use --force-with-lease instead of --force",
)

# Block hook bypass
prefix_rule(
    pattern = [["git", "commit", "--no-verify"], ["git", "push", "--no-verify"]],
    decision = "forbidden",
    justification = "Never skip hooks or verification",
)

# Block dangerous resets
prefix_rule(
    pattern = [["git", "reset", "--hard"]],
    decision = "prompt",
    justification = "Hard reset discards uncommitted changes — confirm intent",
)

# Block force branch deletion
prefix_rule(
    pattern = [["git", "branch", "-D"]],
    decision = "prompt",
    justification = "Force delete may lose unmerged work — confirm branch is merged",
)

# Block recursive force delete
prefix_rule(
    pattern = [["rm", "-rf"]],
    decision = "prompt",
    justification = "Recursive force delete — confirm target path is correct",
)
EOF

  echo "  .codex/rules/safety.rules: generated"
}

# ────────────────────────────────────────────────
# Main
# ────────────────────────────────────────────────
echo "sync-codex: Claude Code -> Codex CLI ($MODE mode)"
echo "repo: $REPO_ROOT"
[[ $DRY_RUN -eq 1 ]] && echo "mode: dry-run"
echo ""

case "$MODE" in
  marketplace)
    sync_skills
    generate_agents_md
    generate_codex_config
    ;;
  project)
    sync_skills_project
    generate_agents_md_project
    generate_codex_config_project
    ;;
esac
generate_codex_rules
sync_memory

if [[ $WITH_GLOBAL -eq 1 ]]; then
  echo ""
  echo "Global rules:"
  generate_global_agents_md
  seed_codex_memory
fi

echo ""
echo "Done."
