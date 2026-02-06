---
name: swift-fix-issue
description: End-to-end GitHub issue resolution for Swift projects
argument-hint: <issue-number>
allowed-tools: [Bash, Read, Edit, Write, Glob, Grep]
---

# Swift Issue Fix Workflow

Resolve GitHub issue #$1 end-to-end following iOS/Swift best practices.

## Prerequisites

- `gh` CLI authenticated
- Issue number required: $1

## Workflow

### Phase 1: Understand

1. **Fetch issue details**:
   ```bash
   gh issue view $1 --json title,body,labels,comments
   ```

2. **Analyze requirements**:
   - What is the expected behavior?
   - What is the actual behavior?
   - What area of code is affected?
   - Are there related issues or PRs?

### Phase 2: Locate

3. **Find relevant files**:
   - Search for keywords from issue
   - Identify affected components
   - Map dependencies

4. **Read current implementation**:
   - Understand existing code structure
   - Identify integration points
   - Note any constraints

### Phase 3: Plan

5. **Design solution**:
   - Minimal changes to fix the issue
   - Follow existing code patterns
   - Consider edge cases

6. **Identify test requirements**:
   - Existing test coverage
   - New tests needed

### Phase 4: Implement

7. **Make changes**:
   - Edit files following SwiftUI/Swift best practices
   - Use modern APIs (reference `swiftui-expert` skill)
   - Ensure proper error handling

8. **Add/update tests**:
   - Unit tests for new functionality
   - Regression tests if bug fix

### Phase 5: Verify

9. **Run ConcurrencyGuard** (if Swift concurrency involved):
   - Check for anti-patterns introduced
   - Fix any violations

10. **Build and test**:
    ```bash
    xcodebuild build -scheme [scheme] -destination "platform=iOS Simulator,name=iPhone 15" -quiet 2>&1 | tail -10
    ```

### Phase 6: Document

11. **Summarize changes**:
    - Files modified
    - Key decisions made
    - Testing performed

12. **Suggest commit message**:
    ```
    fix(scope): brief description

    Fixes #$1
    ```

## Constraints

- Follow Conventional Commits format
- Use existing code patterns
- Prefer composition over inheritance
- Modern Swift APIs only (@Observable, NavigationStack, etc.)

## On Completion

Report:
- Summary of changes
- Files modified (with line counts)
- Test results
- Suggested commit message
- Any follow-up items
