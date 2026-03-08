#!/bin/bash
# migrate-state-layout.sh — Migrate dev-flow state files to new layout
# Idempotent, non-destructive (copies, doesn't delete originals)
set -o pipefail

PROJECT_DIR="${1:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"

echo "Migrating state layout for: $PROJECT_DIR"

# === 1. Create .claude/state/ directory structure ===
mkdir -p "$PROJECT_DIR/.claude/state/pipeline"
mkdir -p "$PROJECT_DIR/.claude/state/review"
mkdir -p "$PROJECT_DIR/.claude/state/sessions"
mkdir -p "$PROJECT_DIR/.claude/state/cache"
echo "  ✓ Created .claude/state/ directories"

# === 2. Add .claude/state/ to .gitignore ===
GITIGNORE="$PROJECT_DIR/.gitignore"
if [[ -f "$GITIGNORE" ]]; then
  if ! grep -q '\.claude/state/' "$GITIGNORE" 2>/dev/null; then
    echo '.claude/state/' >> "$GITIGNORE"
    echo "  ✓ Added .claude/state/ to .gitignore"
  fi
else
  echo '.claude/state/' > "$GITIGNORE"
  echo "  ✓ Created .gitignore with .claude/state/"
fi

# === 3. Flatten thoughts/shared/ → thoughts/ ===
for subdir in plans specs handoffs; do
  SRC="$PROJECT_DIR/thoughts/shared/$subdir"
  DST="$PROJECT_DIR/thoughts/$subdir"
  if [[ -d "$SRC" ]]; then
    mkdir -p "$DST"
    # Copy files that don't already exist in destination
    for f in "$SRC"/*; do
      [[ -f "$f" ]] || continue
      local_name=$(basename "$f")
      if [[ ! -f "$DST/$local_name" ]]; then
        cp "$f" "$DST/"
        echo "  ✓ Copied $subdir/$local_name → thoughts/$subdir/"
      fi
    done
  fi
done

# === 4. Populate context.json from existing ledger files ===
REGISTRY="$PROJECT_DIR/.claude/state/context.json"
if [[ ! -f "$REGISTRY" ]]; then
  BRANCH=$(git -C "$PROJECT_DIR" branch --show-current 2>/dev/null || echo "")
  LEDGER_DIR="$PROJECT_DIR/thoughts/ledgers"

  if [[ -n "$BRANCH" && -d "$LEDGER_DIR" ]]; then
    # Find most recent ledger
    LATEST=$(ls -t "$LEDGER_DIR"/*.md 2>/dev/null | head -1)
    if [[ -n "$LATEST" ]]; then
      REL_PATH="thoughts/ledgers/$(basename "$LATEST")"
      # Extract task ID if present
      TASK_ID=""
      if [[ "$(basename "$LATEST")" =~ ^(TASK-[0-9]+) ]]; then
        TASK_ID="${BASH_REMATCH[1]}"
      fi

      if [[ -n "$TASK_ID" ]]; then
        cat > "$REGISTRY" << EOF
{
  "version": 1,
  "branches": {
    "$BRANCH": {
      "ledger": "$REL_PATH",
      "task_id": "$TASK_ID"
    }
  }
}
EOF
      else
        cat > "$REGISTRY" << EOF
{
  "version": 1,
  "branches": {
    "$BRANCH": {
      "ledger": "$REL_PATH"
    }
  }
}
EOF
      fi
      echo "  ✓ Created context.json: $BRANCH → $REL_PATH"
    fi
  fi

  # If no ledger found, create empty registry
  if [[ ! -f "$REGISTRY" ]]; then
    echo '{"version":1,"branches":{}}' > "$REGISTRY"
    echo "  ✓ Created empty context.json"
  fi
fi

# === 5. Move compact checkpoint if exists ===
OLD_CHECKPOINT="$PROJECT_DIR/thoughts/ledgers/.compact-checkpoint.md"
NEW_CHECKPOINT="$PROJECT_DIR/.claude/state/checkpoint.md"
if [[ -f "$OLD_CHECKPOINT" && ! -f "$NEW_CHECKPOINT" ]]; then
  cp "$OLD_CHECKPOINT" "$NEW_CHECKPOINT"
  echo "  ✓ Copied compact checkpoint to .claude/state/"
fi

# === 6. Move auto-pipeline state if exists ===
for f in "$PROJECT_DIR/.claude/cache/"/.auto-pipeline-*.json; do
  [[ -f "$f" ]] || continue
  BASENAME=$(basename "$f" | sed 's/^\.auto-pipeline-//')
  NEW_PATH="$PROJECT_DIR/.claude/state/pipeline/$BASENAME"
  if [[ ! -f "$NEW_PATH" ]]; then
    cp "$f" "$NEW_PATH"
    echo "  ✓ Copied pipeline state: $BASENAME"
  fi
done

# === 7. Move coordinator state if exists ===
OLD_COORD="$PROJECT_DIR/thoughts/.dev-flow-cache/coordinator.json"
NEW_COORD="$PROJECT_DIR/.claude/state/coordinator.json"
if [[ -f "$OLD_COORD" && ! -f "$NEW_COORD" ]]; then
  cp "$OLD_COORD" "$NEW_COORD"
  echo "  ✓ Copied coordinator state to .claude/state/"
fi

echo ""
echo "Migration complete. Old files preserved — delete manually when ready:"
echo "  rm -rf thoughts/shared/ thoughts/.dev-flow-cache/ thoughts/ledgers/.compact-checkpoint.md"
