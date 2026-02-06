#!/bin/bash
###
# Setup Hook - Auto-configure dev-flow on init (v2.1.10+)
#
# Triggered during: claude --init, --init-only, --maintenance
# Creates .dev-flow.json with platform-specific configuration
###

set -o pipefail

INPUT=$(cat)
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Check if .dev-flow.json already exists
if [[ -f "$PROJECT_DIR/.dev-flow.json" ]]; then
    echo '{"result": "continue", "message": "✅ .dev-flow.json already exists"}'
    exit 0
fi

# Detect platform
detect_platform() {
    if [[ -f "$PROJECT_DIR/Package.swift" ]] || ls "$PROJECT_DIR"/*.xcodeproj &>/dev/null 2>&1; then
        echo "ios"
    elif [[ -f "$PROJECT_DIR/build.gradle" ]] || [[ -f "$PROJECT_DIR/build.gradle.kts" ]]; then
        echo "android"
    elif [[ -f "$PROJECT_DIR/package.json" ]]; then
        echo "node"
    elif [[ -f "$PROJECT_DIR/pyproject.toml" ]] || [[ -f "$PROJECT_DIR/requirements.txt" ]]; then
        echo "python"
    elif [[ -f "$PROJECT_DIR/go.mod" ]]; then
        echo "go"
    elif [[ -f "$PROJECT_DIR/Cargo.toml" ]]; then
        echo "rust"
    else
        echo "unknown"
    fi
}

PLATFORM=$(detect_platform)

# Generate .dev-flow.json based on platform
case "$PLATFORM" in
    ios)
        cat > "$PROJECT_DIR/.dev-flow.json" << 'EOF'
{
  "platform": "ios",
  "commands": {
    "fix": "swiftlint --fix && swiftformat .",
    "check": "swiftlint"
  },
  "scopes": ["ui", "api", "models", "utils", "tests"]
}
EOF
        ;;
    android)
        cat > "$PROJECT_DIR/.dev-flow.json" << 'EOF'
{
  "platform": "android",
  "commands": {
    "fix": "./gradlew ktlintFormat",
    "check": "./gradlew ktlintCheck"
  },
  "scopes": ["ui", "api", "data", "domain", "utils"]
}
EOF
        ;;
    node)
        cat > "$PROJECT_DIR/.dev-flow.json" << 'EOF'
{
  "platform": "node",
  "commands": {
    "fix": "npm run lint:fix || npx eslint --fix .",
    "check": "npm run lint || npx eslint ."
  },
  "scopes": ["api", "components", "utils", "hooks", "services"]
}
EOF
        ;;
    python)
        cat > "$PROJECT_DIR/.dev-flow.json" << 'EOF'
{
  "platform": "python",
  "commands": {
    "fix": "black . && ruff check --fix .",
    "check": "ruff check . && mypy ."
  },
  "scopes": ["api", "models", "utils", "tests"]
}
EOF
        ;;
    go)
        cat > "$PROJECT_DIR/.dev-flow.json" << 'EOF'
{
  "platform": "go",
  "commands": {
    "fix": "gofmt -w . && golangci-lint run --fix",
    "check": "golangci-lint run"
  },
  "scopes": ["cmd", "pkg", "internal", "api"]
}
EOF
        ;;
    rust)
        cat > "$PROJECT_DIR/.dev-flow.json" << 'EOF'
{
  "platform": "rust",
  "commands": {
    "fix": "cargo fmt && cargo clippy --fix --allow-dirty",
    "check": "cargo clippy"
  },
  "scopes": ["src", "lib", "bin", "tests"]
}
EOF
        ;;
    *)
        # Unknown platform - create minimal config
        cat > "$PROJECT_DIR/.dev-flow.json" << 'EOF'
{
  "platform": "unknown",
  "commands": {
    "fix": "echo 'Configure fix command'",
    "check": "echo 'Configure check command'"
  },
  "scopes": []
}
EOF
        ;;
esac

echo "{\"result\": \"continue\", \"message\": \"✅ Created .dev-flow.json for $PLATFORM platform\"}"
