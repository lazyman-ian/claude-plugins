# Contributing to dev-flow

Thank you for your interest in contributing to dev-flow! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Adding Platform Support](#adding-platform-support)

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow

## Getting Started

### Prerequisites

- Node.js 18+
- Claude Code 2.1.19+
- Git

### Fork and Clone

```bash
# Fork on GitHub, then clone
git clone https://github.com/YOUR_USERNAME/dev-flow.git
cd dev-flow
```

## Development Setup

### Build MCP Server

```bash
cd mcp-server
npm install
npm run bundle    # Bundle for production
npm run build     # TypeScript compile (development)
npm run dev       # Run with ts-node
```

### Test Locally

```bash
# Add as local plugin
/plugin marketplace add /path/to/dev-flow
# Or: claude --plugin-dir /path/to/dev-flow

# Verify
/dev-flow:dev
```

### Project Structure

```
dev-flow-plugin/
├── mcp-server/src/          # MCP server source
│   ├── index.ts             # Entry point, tool definitions
│   ├── detector.ts          # Platform detection
│   ├── git/                 # Git operations
│   ├── platforms/           # Platform-specific configs
│   └── coordination/        # Multi-agent coordination
├── skills/                  # Skill definitions
├── commands/                # Command definitions
├── agents/                  # Agent prompts
└── hooks/                   # Hook configurations
```

## Making Changes

### Branch Naming

```
feature/TASK-XXX-description
fix/TASK-XXX-description
docs/TASK-XXX-description
```

### Using dev-flow (Recommended)

```bash
# Start task
/dev-flow:start CONTRIB-001 "Add Python support"

# Make changes...

# Commit
/dev-flow:commit

# Create PR
/dev-flow:pr
```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): subject

feat(python): add Python platform detection
fix(ios): correct SwiftLint path resolution
docs(readme): add Python platform example
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

**Scopes**: `mcp`, `ios`, `android`, `python`, `hooks`, `commands`, `agents`, `docs`

## Pull Request Process

1. **Update documentation** if adding features
2. **Test locally** with `/dev-flow:dev`
3. **Ensure MCP server builds**: `npm run bundle`
4. **Create PR** with clear description
5. **Wait for review**

### PR Template

```markdown
## Summary
Brief description of changes

## Changes
- Added X
- Fixed Y
- Updated Z

## Test Plan
- [ ] Tested with iOS project
- [ ] Tested with Android project
- [ ] MCP server builds successfully

## Related Issues
Closes #XXX
```

## Coding Standards

### TypeScript

- Use TypeScript strict mode
- Export interfaces for public APIs
- Document complex functions

```typescript
/**
 * Detect project type based on files in directory
 * @param projectPath - Path to project root
 * @returns ProjectInfo with type and configuration
 */
export function detectProjectType(projectPath: string): ProjectInfo {
  // ...
}
```

### Commands/Skills/Agents

- Use YAML frontmatter
- Include description with trigger keywords
- Keep files under 500 lines

```markdown
---
name: command-name
description: What it does. Use when "trigger phrase", "另一个触发词".
---

# /dev-flow:command-name

Brief description.

## Usage
...
```

## Adding Platform Support

This is the most welcome contribution! Here's how:

### 1. Update detector.ts

```typescript
// mcp-server/src/detector.ts

// Add detection logic
const hasPyproject = files.includes('pyproject.toml');
const hasRequirements = files.includes('requirements.txt');

if (hasPyproject || hasRequirements) {
  return {
    type: 'python',
    name: path.basename(projectPath),
    path: projectPath,
    srcDir: 'src',
    configFiles: ['pyproject.toml', 'requirements.txt'].filter(f => files.includes(f))
  };
}
```

### 2. Create Platform Module

```typescript
// mcp-server/src/platforms/python.ts

export interface PythonConfig {
  platform: 'python';
  lintFix: string;
  lintCheck: string;
  formatFix: string;
  formatCheck: string;
  buildCmd: string;
  testCmd: string;
  verifyCmd: string;
  scopes: string[];
}

export function getPythonConfig(projectPath: string): PythonConfig {
  return {
    platform: 'python',
    lintFix: 'ruff check --fix .',
    lintCheck: 'ruff check .',
    formatFix: 'black .',
    formatCheck: 'black --check .',
    buildCmd: 'python -m build',
    testCmd: 'pytest',
    verifyCmd: 'ruff check . && mypy . && pytest',
    scopes: detectPythonScopes(projectPath)
  };
}

function detectPythonScopes(projectPath: string): string[] {
  // Detect common Python project directories
  const dirs = ['src', 'tests', 'api', 'models', 'utils'];
  return dirs.filter(d => fs.existsSync(path.join(projectPath, d)));
}
```

### 3. Update index.ts

```typescript
// mcp-server/src/index.ts

import { getPythonConfig } from './platforms/python';

// In dev_config handler
case 'python':
  const pythonConfig = getPythonConfig(projectPath);
  return `python|fix:${pythonConfig.lintFix}|check:${pythonConfig.lintCheck}|...`;
```

### 4. Test

```bash
# Create test project
mkdir test-python && cd test-python
echo 'name = "test"' > pyproject.toml

# Test detection
/dev-flow:dev
# Should show: python|fix:ruff...|check:ruff...
```

### 5. Document

Update README.md platform table and add example `.dev-flow.json`.

## Questions?

- Open an issue for questions
- Tag with `question` label
- Check existing issues first

## Thank You!

Your contributions make dev-flow better for everyone.
