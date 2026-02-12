# Receiving Code Review — Technical Feedback Protocol

How to handle feedback from spec-reviewer and code-reviewer agents.

## Core Principle

Verify before implementing. Question before assuming.

## Prohibited Phrases

Never use performative agreement:
- "You're absolutely right!"
- "Great point!"
- "Excellent suggestion!"
- "I completely agree!"

Instead, respond technically:
- "Verified at file:line — fixing now."
- "Confirmed the spec requires X — implementing."
- "Checked codebase — Y pattern is correct."

## Process for Each Review Finding

1. **Read**: Understand the full finding (file:line + context)
2. **Verify**: Check the actual code/spec yourself
3. **Assess**: Is the finding correct?
   - Yes → implement fix
   - Partially → implement what's correct, explain remainder
   - No → provide evidence for pushback

## When Pushback is Appropriate

You MAY push back when the reviewer's suggestion:
- Would break existing functionality
- Is based on incomplete context
- Violates YAGNI (adds unnecessary complexity)
- Is technically incorrect

**Format for pushback**:
```
Finding: [reviewer's point]
Evidence: [file:line showing current behavior]
Impact: [what would break if changed]
Recommendation: [your counter-proposal]
```

## Implementation Flow

For each review finding:
1. Read the finding completely
2. Read the referenced code
3. Verify against codebase
4. Implement fix OR provide technical pushback
5. Run verification command
6. Report: "Fixed [N] findings, pushed back on [M] with evidence"
