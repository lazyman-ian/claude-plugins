---
name: security-scan
description: >-
  Scans Claude Code plugin files for security vulnerabilities including network calls in hooks,
  external links in skills, overly broad allowed-tools, zero-width character injection, and
  credential exposure. This skill should be used when the user wants to audit plugin security,
  check for prompt injection risks, verify hook safety, or review permission scope.
  Triggers on "security scan", "security audit", "check security", "audit hooks", "prompt injection check",
  "安全扫描", "安全审计", "检查安全", "插件安全", "漏洞检查".
  Do NOT use for code review of application code (use code-reviewer agent instead).
  Do NOT use for general hook development (use hook-developer skill instead).
allowed-tools: [Read, Glob, Grep, Bash]
model: sonnet
---

# Security Scan - Plugin Security Audit

Audit Claude Code plugin files for security vulnerabilities across 5 categories.

## When to Use

- "run a security scan on the plugins"
- "check hooks for network calls"
- "audit allowed-tools scope across skills"
- "check for zero-width characters in skill files"
- "verify no credentials are tracked in git"
- "安全扫描插件文件"

## Scan Categories

| # | Category | Severity Range | Checks |
|---|----------|----------------|--------|
| 1 | Hook Security | Critical-Warning | Network tools, unquoted vars, output suppression |
| 2 | Skill Security | Warning-Info | External URLs, overly broad allowed-tools |
| 3 | Zero-Width Characters | Critical | Unicode injection in markdown files |
| 4 | Credential Exposure | Critical | .env, API keys, tokens in tracked files |
| 5 | Plugin Manifest | Warning-Info | Deprecated fields, permission scope |

## Execution Flow

```
1. Discover all plugin files via Glob
2. Run each scan category in sequence
3. Collect findings with severity + file + line
4. Output summary table + remediation guidance
5. Save findings to memory if Critical items found
```

## Scan 1: Hook Security Audit

Scan all hook scripts for dangerous patterns.

### Target Files

```
Glob: **/hooks/scripts/*.sh
Glob: **/hooks/*.sh
Glob: **/.claude/hooks/*.sh
```

### Checks

**Network tool usage (Critical)**

```
Grep pattern: \b(curl|wget|nc|netcat|ssh|scp|rsync)\b
Files: *.sh in hooks directories
```

Flag any hook that makes outbound network calls. Hooks run with user permissions and can exfiltrate data. Legitimate hooks using `curl` for local services must document why.

**Unquoted variable expansion (Warning)**

```
Grep pattern: \$[A-Z_]+[^"'\s]
Context: lines with variable usage not in quotes
```

Unquoted variables in hook scripts allow path injection.

**Output suppression of errors (Warning)**

```
Grep pattern: 2>/dev/null
Context: surrounding 2 lines
```

Distinguishes intentional suppression (with comment) from hiding errors. First occurrence in a file warns; repeated use without comments is a finding.

**Dangerous command patterns (Critical)**

```
Grep pattern: eval\s|exec\s|source\s/tmp|bash\s<\(|sh\s<\(
```

Dynamic execution of remote or temp content is a critical risk.

## Scan 2: Skill Security Check

Scan all SKILL.md files for exposure patterns.

### Target Files

```
Glob: **/skills/*/SKILL.md
Glob: **/agents/*.md
```

### Checks

**External URLs (Warning)**

```
Grep pattern: https?://(?!github\.com|claude\.ai|anthropic\.com)[^\s)]+
Files: SKILL.md, agent markdown files
```

External URLs in skill instructions can be vectors for prompt injection via fetched content. Skills that fetch external content must include a security guardrail comment. See `references/security-guardrails.md`.

**Overly broad allowed-tools (Warning)**

```
Grep pattern: allowed-tools:.*\[\s*\*\s*\]
Grep pattern: allowed-tools:.*Bash[^(]
```

`allowed-tools: [*]` grants unrestricted tool access. `Bash` without argument constraints allows any shell command. Flag these and suggest minimal tool sets.

**Missing allowed-tools (Info)**

```
Grep pattern: ^---$   (frontmatter block)
Check: frontmatter contains no allowed-tools line
```

Skills without `allowed-tools` inherit all permissions. For production plugin skills this should be explicit.

## Scan 3: Zero-Width Character Detection

Scan skill and agent markdown for invisible character injection.

### Target Files

```
Glob: **/skills/*/SKILL.md
Glob: **/agents/*.md
Glob: **/skills/*/references/*.md
```

### Checks

**Zero-width characters (Critical)**

```bash
# Use Python for portable detection (grep -P is invalid on macOS)
python3 -c "
import sys
zw = ['\u200b', '\u200c', '\u200d', '\ufeff']
for i, line in enumerate(open(sys.argv[1]), 1):
    for ch in zw:
        if ch in line:
            print(f'Line {i}: U+{ord(ch):04X} found')
" <file>
```

Zero-width characters in instructions are invisible in editors and can alter Claude's behavior by inserting hidden directives between visible text.

## Scan 4: Credential Exposure

Check git-tracked files for credential patterns.

### Checks

**Git-tracked sensitive files (Critical)**

```bash
git ls-files | grep -E '\.env|credentials|secrets|\.pem|\.key$|\.p12$'
```

**Hardcoded credential patterns (Critical)**

```
Grep pattern: (api[_-]?key|secret[_-]?key|access[_-]?token|password)\s*[=:]\s*["'][^"']{8,}
Files: all tracked files except *.md documentation
Case-insensitive
```

**AWS/GCP/Azure pattern leak (Critical)**

```
Grep pattern: AKIA[0-9A-Z]{16}          # AWS Access Key ID
Grep pattern: AIza[0-9A-Za-z\-_]{35}   # Google API key
```

**Anthropic key pattern (Critical)**

```
Grep pattern: sk-ant-[a-zA-Z0-9\-]{20,}
```

## Scan 5: Plugin Manifest Validation

Check plugin.json files for deprecated fields and permission issues.

### Target Files

```
Glob: **/.claude-plugin/plugin.json
Glob: **/plugin.json (in plugin root directories)
```

### Checks

**Deprecated fields (Warning)**

```
Check: bundledMcpServers key present
Check: agents key present (auto-discovered from agents/ directory)
Check: hooks key present (auto-discovered from hooks/hooks.json)
```

**Overly broad MCP permissions (Warning)**

Read any `mcpServers` entries and check if they declare unrestricted filesystem or network access without documentation.

**Version consistency (Info)**

Cross-check version in `plugin.json` against any `marketplace.json` and `README.md` version badges. Stale version references cause user confusion.

## Output Format

Present findings as a table sorted by severity:

```
Security Scan Results
=====================

| Severity | File | Line | Finding | Remediation |
|----------|------|------|---------|-------------|
| Critical | hooks/scripts/post-tool.sh | 42 | curl call without allowlist | Add domain allowlist or remove |
| Warning  | skills/my-skill/SKILL.md | 8 | allowed-tools: [*] | Restrict to needed tools |
| Info     | .claude-plugin/plugin.json | - | Version mismatch with marketplace.json | Sync versions |

Summary: 1 Critical, 1 Warning, 1 Info
```

If no findings: "Security scan complete. No issues found."

After reporting, if Critical findings exist, save to memory:

```
dev_memory(action="save", key="security-scan-findings", value="<summary>", category="pitfalls")
```

## References

- `references/deny-rules.md` - Recommended deny rules for Claude Code settings
- `references/security-guardrails.md` - Guardrail pattern for skills fetching external content
- `${CLAUDE_PLUGIN_ROOT}/agents/references/security-checklist.md` - Code-level security checklist (used by code-reviewer)
