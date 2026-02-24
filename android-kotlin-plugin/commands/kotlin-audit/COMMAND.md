---
name: kotlin-audit
description: Scan Kotlin/Android project for code quality issues, deprecated patterns, and coroutine anti-patterns
allowed-tools: [Read, Glob, Grep, Bash]
---

# Kotlin Audit

Comprehensive code quality scan for Android/Kotlin projects.

## Process

### 1. Detect Project Structure
```bash
# Find Kotlin source files
Glob("**/*.kt")
# Find build files
Glob("**/build.gradle.kts")
Glob("**/build.gradle")
```

### 2. Scan Categories

Run all scans in parallel:

#### A. Deprecated API Usage
```
Grep for: AsyncTask, Loader, LocalBroadcastManager, startActivityForResult,
onActivityResult, requestPermissions, launchWhenStarted, collectAsState()
```

#### B. Coroutine Anti-Patterns
```
Grep for: GlobalScope, runBlocking (non-test), catch.*CancellationException,
Dispatchers.IO (hardcoded), init.*collect, SharingStarted.Eagerly
```

#### C. Build System
```
Check: Groovy vs KTS, kapt vs KSP, version catalog usage,
R8 configuration, convention plugins
```

#### D. Compose Patterns (if Compose project)
```
Grep for: collectAsState() without lifecycle, List parameters (unstable),
remember without keys, missing contentType in LazyColumn
```

### 3. Output Report

```markdown
## Kotlin Audit Report: [project]

### Score: [X]/100

| Category | Issues | Score |
|----------|--------|-------|
| Deprecated APIs | [N] | [X]/25 |
| Coroutine Safety | [N] | [X]/25 |
| Build System | [N] | [X]/25 |
| Compose Quality | [N] | [X]/25 |

### Top Issues
1. [Most impactful issue]
2. [Second issue]
3. [Third issue]

### Details
[Categorized findings with file:line references]
```
