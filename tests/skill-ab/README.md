# Skill A/B Test

Compare full (current) vs thin (methodology-stripped) skill prompts.

## Design

- **3 skills**: search-first, debugging, test-generator
- **2 tasks per skill**: 1 simple + 1 complex
- **2 variants**: full prompt vs thin prompt
- **Evaluation**: 5-dimension scoring (0-10) by evaluator agent

## Scoring Dimensions

| Dimension | Weight | What it measures |
|-----------|--------|-----------------|
| Correctness | 30% | Did the agent produce correct output? |
| Tool Usage | 25% | Did it use the right MCP tools correctly? |
| Efficiency | 20% | Token count, unnecessary steps avoided |
| Scope Control | 15% | Stayed within task boundary |
| Output Quality | 10% | Clear, actionable, well-structured |

## Run

```bash
# From project root, in Claude Code session:
# Each test spawns 2 subagents (full vs thin) with the same task
# Results saved to tests/skill-ab/results/
```
