---
description: Unified code search - find files, content, symbols, patterns
---

Smart code search that automatically selects the best tool.

## Instructions

### Search Type Decision

| User Intent | Type | Tool |
|-------------|------|------|
| "Find XXX file" | `--file` | Glob |
| "Search XXX content" | default | Grep |
| "Where is XXX defined" | `--symbol` | Grep + regex |
| "Where is XXX used" | `--usage` | Grep |

### Execute Search

**Content Search (default):**
```
/search "pattern"
→ Grep pattern="pattern" output_mode="content" -C=2
```

**File Search:**
```
/search --file "Manager"
→ Glob pattern="**/*Manager*"
```

**Symbol Search:**
```
/search --symbol "ClassName"
→ Grep pattern="(class|struct|enum)\s+ClassName"
```

**Usage Search:**
```
/search --usage "functionName"
→ Grep pattern="functionName" (exclude definitions)
```

### Platform-Aware File Types

| Platform | Default Types |
|----------|---------------|
| iOS | `*.swift`, `*.m`, `*.h` |
| Android | `*.kt`, `*.java`, `*.xml` |
| Web | `*.ts`, `*.tsx`, `*.js` |
| Python | `*.py` |

## Output Format

**Compact (≤10 results):**
```
📁 path/to/File.swift:42
    context before
    >>> matched line <<<
    context after
```

**File list (>10 results):**
```
Found 25 matches:

📁 path/to/File.swift (3 matches)
📁 path/to/Another.swift (2 matches)
...
```

## Examples

```bash
# Content
/search "API_KEY"
/search "error handling" --type swift

# Files
/search --file "ViewController"
/search --file "*.test.ts"

# Symbols
/search --symbol "UserManager"

# Usage
/search --usage "NetworkService"
```
