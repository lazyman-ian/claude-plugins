---
description: Create, verify, and manage development checkpoints for rollback and comparison
---

# /dev-flow:checkpoint - Development Checkpoints

Stash-and-tag based checkpoints for safe experimentation and comparison.

## Usage

```
/dev-flow:checkpoint create <name>   # Save current state as checkpoint
/dev-flow:checkpoint verify <name>   # Compare current state vs checkpoint
/dev-flow:checkpoint list            # Show all checkpoints with timestamps
```

## Subcommands

### create

Saves the current working state as a named checkpoint.

```
/dev-flow:checkpoint create before-refactor
```

Execution flow:

1. Check for uncommitted changes:
   ```bash
   git status --short
   ```

2. Stash all changes (including untracked):
   ```bash
   git stash push -u -m "checkpoint/<name>"
   ```

3. Create a git tag on the current HEAD:
   ```bash
   git tag checkpoint/<name>
   ```

4. Pop the stash to restore working state:
   ```bash
   git stash pop
   ```

5. Append metadata to `.claude/checkpoints.log`:
   ```
   2026-02-27T12:34:56Z  checkpoint/before-refactor  abc1234  "before-refactor"
   ```

Output:
```
Checkpoint created: checkpoint/before-refactor
  Tag: abc1234 (HEAD)
  Log: .claude/checkpoints.log
```

### verify

Compares the current state against a named checkpoint.

```
/dev-flow:checkpoint verify before-refactor
```

Execution flow:

1. Confirm checkpoint tag exists:
   ```bash
   git tag -l "checkpoint/before-refactor"
   ```

2. Show diff summary (files changed, insertions, deletions):
   ```bash
   git diff --stat checkpoint/before-refactor
   ```

3. Run current test suite and report pass/fail status (no stored baseline — tests
   are run fresh against the current code to detect regressions since checkpoint).

Output:
```
Checkpoint: checkpoint/before-refactor (abc1234, 2026-02-27T12:34:56Z)
Current:    def5678 (HEAD)

Changes since checkpoint:
  src/auth/token.ts         | 42 +++++++----
  src/auth/token.test.ts    | 18 +++--
  2 files changed, 60 insertions(+), 15 deletions(-)

Test status: PASS
```

If regressions are detected:
```
Regressions detected since checkpoint/before-refactor:
  - 2 tests that passed at checkpoint now fail
  Run `/dev-flow:checkpoint verify before-refactor --tests` for details
```

### list

Lists all checkpoints recorded in `.claude/checkpoints.log`.

```
/dev-flow:checkpoint list
```

Output:
```
Checkpoints
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Name                     Tag      Created
─────────────────────    ───────  ──────────────────────
before-refactor          abc1234  2026-02-27 12:34:56
after-phase-1            bcd2345  2026-02-27 15:10:02
pre-migration            cde3456  2026-02-27 18:45:30

Total: 3 checkpoints
```

If no checkpoints exist:
```
No checkpoints found. Create one with:
  /dev-flow:checkpoint create <name>
```

## Storage

| Item | Location | Purpose |
|------|----------|---------|
| Git tag | `checkpoint/<name>` | Point-in-time reference for diff |
| Stash entry | git stash | Saved working tree state |
| Log entry | `.claude/checkpoints.log` | Timestamp + hash metadata |

`.claude/checkpoints.log` format (tab-separated):
```
<ISO-8601-timestamp>\t<tag-name>\t<commit-hash>\t<label>
```

## Integration with eval-harness

`/dev checkpoint verify <name>` feeds the diff as the regression criterion
into eval-harness when running checkpoint-based evaluation mode.

## Notes

- Checkpoint tags are local only — not pushed to remote by default.
- Stash state is not a hard requirement; create falls back to tag-only if stash fails.
- Use `git tag -d checkpoint/<name>` to manually remove a checkpoint tag.
