---
name: self-check
description: Runs pre-commit code quality checks by auto-detecting project type and executing relevant linting, formatting, and standards verification. This skill should be used when the user wants to validate code quality before committing, run linting checks, or verify coding standards compliance. Triggers on "self check", "code check", "pre-commit check", "lint check", "quality check", "自检", "检查代码质量", "预提交检查", "代码质量", "代码检查", "lint检查", "格式化", "质量检查". Do NOT use for investigating bugs or crashes — use "debugging" instead. Do NOT use for full build/test verification — use "verify" instead.
model: sonnet
allowed-tools: [Bash, Read, Glob, Grep]
---

# Self-Check - Development Quality Gate

Auto-detect project type and run relevant quality checks before commit.

## Quick Start

```
/dev-flow:self-check          # Run all checks for detected project type
/dev-flow:self-check --quick  # Fast mode (skip deep analysis)
```

## Project Type Detection

Detect automatically based on project files:

| Indicator | Project Type |
|-----------|--------------|
| `nest-cli.json` or `@nestjs/*` in package.json | backend-nestjs |
| `react`/`vue`/`next` in package.json | frontend |
| `Package.swift` or `*.xcodeproj` | ios-swift |
| `build.gradle` or `settings.gradle` | android |
| `go.mod` | golang |
| `Cargo.toml` | rust |

## Execution Flow

1. Auto-detect project type from files
2. `dev_memory(action="query", query="self-check <project-type> pitfalls")`
3. `git diff --name-only` → get changed files
4. Run applicable checks on changed files
5. Report findings with severity

## Checks

| Check | Applies To | What to Look For |
|-------|-----------|-----------------|
| Duplicate files | All | Same filename in multiple locations |
| Unused exports | Backend/Frontend | Exported but never imported |
| Param flow | All | Generated IDs not passed through call chain |
| DB call frequency | Backend | Multiple DB calls per request handler |
| View body complexity | iOS | SwiftUI body > 50 lines |
| Unused imports | iOS/Android | Import statements not used |

## Configuration

Optional `.claude/self-check.yaml` to override project-type or disable checks.
