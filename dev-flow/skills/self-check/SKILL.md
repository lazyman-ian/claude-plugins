---
name: self-check
description: Development self-check before commit. Auto-detects project type and runs relevant checks. Use when user says "self check", "自检", "code check", "pre-commit check", "检查代码质量". Triggers on /self-check, 代码自检, 提交前检查.
model: sonnet
memory: project
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

## Check Matrix

| Check | Backend | Frontend | iOS | Android | Description |
|-------|:-------:|:--------:|:---:|:-------:|-------------|
| Duplicate files | ✅ | ✅ | ✅ | ✅ | Same filename in multiple locations |
| Unused exports | ✅ | ✅ | - | - | Exported but never imported |
| Param flow | ✅ | ✅ | ✅ | ✅ | Generated IDs passed through call chain |
| DB call frequency | ✅ | - | - | - | Multiple DB calls per request |
| Bundle size | - | ✅ | - | - | Large bundle impact |
| Component rerender | - | ✅ | - | - | Unnecessary re-renders |
| View body complexity | - | - | ✅ | - | SwiftUI body too complex |
| Unused imports | - | - | ✅ | ✅ | Import statements not used |

## Execution Flow

```
1. Detect project type
2. Get changed files (git diff --name-only)
3. Run applicable checks on changed files
4. Report findings with severity
```

## Check Implementations

### 1. Duplicate Files (All)

```bash
# Find files with same name in different locations
find . -name "*.ts" -o -name "*.swift" | xargs -I{} basename {} | sort | uniq -d
```

**When to check**: After creating new files

### 2. Unused Exports (Backend/Frontend)

```bash
# For TypeScript projects
npx ts-prune --error libs/
```

**When to check**: After adding exports to libs/shared

### 3. Parameter Flow (All)

Check if newly created variables (especially IDs) are passed to downstream functions.

Pattern to detect:
```
const roundId = generateId()  # Created
// ... but not passed to handleStream()
```

**When to check**: After generating IDs, creating objects that should flow downstream

### 4. DB Call Frequency (Backend)

Count repository/model calls within a single request handler:

```typescript
// BAD: 5 calls per request
await repo.create()
await repo.updateStatus()
await repo.recordTTFT()
await repo.updateStatus()
await repo.recordLatency()

// GOOD: 1 call per request
await repo.upsertFinal(data)
```

**When to check**: After writing service methods with multiple DB operations

### 5. View Body Complexity (iOS)

Check SwiftUI view body line count:

```swift
// BAD: > 50 lines in body
var body: some View {
  // 100+ lines of nested views
}

// GOOD: Extract subviews
var body: some View {
  VStack {
    HeaderView()
    ContentView()
    FooterView()
  }
}
```

**When to check**: After creating/modifying SwiftUI views

## Output Format

```
🔍 Self-Check Results (backend-nestjs)
══════════════════════════════════════

✅ Duplicate files: None found
⚠️ Unused exports: 2 found
   - libs/common-shared: AuthzGatewayClientService
   - libs/common-shared: RoundSchema

❌ Parameter flow: 1 issue
   - roundId generated in controller.ts:53 but not passed to orchestrator.ts

⚠️ DB frequency: 1 concern
   - orchestrator.service.ts: 5 repository calls per request

Summary: 1 error, 2 warnings
```

## Integration with /dev commit

When running `/dev commit`, suggest running self-check first if:
- New files created
- Exports added to libs
- Multiple DB calls added
- ID generation detected

## Configuration

Optional `.claude/self-check.yaml`:

```yaml
project-type: auto  # or explicit: backend-nestjs
checks:
  duplicate-files: true
  unused-exports: true
  param-flow: true
  db-frequency: true
ignore:
  - "**/*.spec.ts"
  - "**/*.test.ts"
```

## Real Examples

### Example 1: roundId Bug (This Session)

```
Generated: controller.ts:53 → const roundId = randomUUID()
Used for: header X-Request-Id
Missing: Not passed to handleStream()
Result: orchestrator.ts:61 generates different roundId for DB

Detection: Trace roundId from generation → usage → persistence
```

### Example 2: Duplicate Schema (This Session)

```
File 1: apps/chat-service/src/schemas/round.schema.ts
File 2: libs/common-shared/src/schemas/round.schema.ts

Detection: find . -name "round.schema.ts"
```

### Example 3: MongoDB Frequency (This Session)

```
orchestrator.service.ts:
  L109: await this.roundRepository.create()
  L125: await this.roundRepository.updateStatus()
  L248: await this.roundRepository.recordTTFT()
  L249: await this.roundRepository.updateStatus()
  L264: await this.roundRepository.updateStatus()

Detection: Count repository.* calls in single method
```
