---
name: debugging
description: Systematic debugging using 4-phase root cause analysis with subagent-driven rapid iteration. This skill should be used when user says "debug", "调试", "troubleshoot", "diagnose", "排查", "修复 bug", "fix bug", "investigate", "analyze crash". Triggers on /debug, 调试, 排查问题, 修复错误.
model: opus
memory: project
context: fork
allowed-tools: [Read, Glob, Grep, Edit, Write, Bash, Task, TaskCreate, TaskUpdate, TaskList, AskUserQuestion]
---

# Debugging - Systematic Root Cause Analysis

Debug issues using 4-phase systematic approach with optional subagent-driven parallel exploration.

## When to Use

- "debug this crash"
- "troubleshoot login failure"
- "diagnose performance issue"
- "排查为什么功能不工作"
- "修复这个 bug"

## 4-Phase Debugging Process

```
OBSERVE → HYPOTHESIZE → TEST → FIX → VERIFY
```

### Phase 1: OBSERVE

**Goal**: Gather all relevant information about the issue.

**Collect:**
- Error messages and stack traces
- Logs (application, system, access)
- Reproduction steps
- Environment details (OS, versions, config)
- Recent changes (git log, deployments)
- Frequency and patterns (when does it happen?)

**Questions to Answer:**
- What exactly is the symptom?
- When did it start happening?
- What changed recently?
- Who/what is affected?
- Can you reproduce it consistently?

### Phase 2: HYPOTHESIZE

**Goal**: Generate possible causes.

**Generate 2-5 hypotheses:**
1. **Most Likely**: Based on common patterns
2. **Recent Change**: Related to recent modifications
3. **Edge Case**: Unusual input/state combination
4. **Environment**: OS, dependency, config issue
5. **Cascading**: Secondary effect of another problem

**For each hypothesis:**
- What would we expect to see if this is true?
- What evidence supports/refutes this?
- How can we test this quickly?

### Phase 3: TEST

**Goal**: Validate or invalidate hypotheses.

**Design experiments:**
- Start with fastest test (quick elimination)
- Look for definitive proof (not just correlation)
- Test one variable at a time
- Document results for each hypothesis

**Testing strategies:**
- Add logging/metrics
- Isolate components
- Reproduce in clean environment
- Binary search (comment out half the code)
- Check assumptions (is the data what we think?)

### Phase 4: FIX

**Goal**: Implement the fix.

**Choose fix approach:**
- **Direct**: Fix the root cause
- **Defensive**: Add guards/checks
- **Workaround**: Temporary mitigation

**For complex fixes, use subagents:**
```
Spawn 2-3 subagents with different fix approaches
Compare results, choose best solution
```

### Phase 5: VERIFY

**Goal**: Confirm the fix works.

**Verification checklist:**
- [ ] Original issue is resolved
- [ ] No regressions introduced
- [ ] Edge cases handled
- [ ] Tests pass (if applicable)
- [ ] Performance acceptable

## Subagent-Driven Debugging

For complex issues, spawn subagents to explore in parallel:

```
Agent 1: Focus on data flow hypothesis
Agent 2: Focus on timing/race condition hypothesis
Agent 3: Focus on configuration hypothesis
```

**Compare results and choose best path forward.**

## Quick Reference

| Symptom | Likely Causes | Quick Check |
|---------|--------------|-------------|
| Crash/exception | Null pointer, type error, resource exhaustion | Stack trace analysis |
| Hang/timeout | Infinite loop, deadlock, slow I/O | CPU profiling, thread dump |
| Wrong output | Logic error, data corruption, config issue | Input/output comparison |
| Performance | N+1 queries, memory leak, algorithm | Profiling, metrics |
| Intermittent | Race condition, timing, external dependency | Reproduction pattern |

## Example

```
User: "debug why login fails with 500 error"

[OBSERVE]
- Check logs: NullPointerException in AuthService.java:147
- Recent change: Added OAuth support 2 days ago
- Affects: All OAuth login attempts

[HYPOTHESIZE]
1. Missing null check for OAuth token
2. Config issue with OAuth provider
3. Database migration incomplete

[TEST]
- Add logging: token is null when OAuth disabled for user
- Hypothesis 1 confirmed

[FIX]
- Add null check for token before processing
- Handle OAuth-disabled users gracefully

[VERIFY]
- OAuth users can login ✓
- Non-OAuth users can login ✓
- No regression in other auth methods ✓
```

## Output

Document findings in:
- `thoughts/debugging/DEBUG-<issue>-<date>.md`
- Include: observations, hypotheses tested, root cause, fix applied
