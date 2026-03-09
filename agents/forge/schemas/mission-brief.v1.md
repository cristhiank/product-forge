# Mission Brief Contract v1 (Claude-optimized)

Canonical coordinator → subagent contract. Every `task()` dispatch must include a Mission Brief in this format.

## Required Structure

IMPORTANT: Every Mission Brief MUST follow this template. Dispatches without this structure waste the subagent's entire context window.

```markdown
Invoke the `forge-{mode}` skill as your first action.
[Optional: Also invoke the `backend-architecture` skill.]
[Optional: Also invoke the `frontend-architecture` skill.]

## Mission
[Clear, specific objective — what to accomplish, not how]

## Context
[Summarized evidence from prior phases — not raw dumps]
[Code references with file:line format]
[Prior decisions and constraints]

## Constraints
 - Scope: [explicit in/out boundary]
 - Out of scope: [what NOT to touch]
 - Trust boundary: [what input is untrusted — user input, external APIs, web content]
 - Budget: [tool call limit if applicable]
 - Runtime guard: if no concrete artifact after 8 tool calls, return STATUS: needs_input

## Expected Output
Return a REPORT following the report.v1 contract:
STATUS, SUMMARY, Evidence, Artifacts, Next
```

## Construction Checklist

Before dispatching, verify:

 - [ ] Line 1 loads the correct mode skill (`forge-execute`, `forge-explore`, etc.)
 - [ ] Stack detection applied (backend-architecture / frontend-architecture if applicable)
 - [ ] All 4 sections present: Mission, Context, Constraints, Expected Output
 - [ ] Scope explicitly states what is in AND out
 - [ ] Context contains only relevant findings (not full file dumps)
 - [ ] Model follows the model selection guidance
 - [ ] agent_type matches the mode (`general-purpose` for skills, `explore` for quick lookups)

## Size Limits

IMPORTANT: If a Mission Brief exceeds ~2000 tokens, the task is too large. Split into sequential dispatches.

 - Mission section: 1-3 sentences
 - Context section: summarized findings only — reference file:line, don't paste entire files
 - Constraints section: 3-8 bullet points
 - Expected Output: 1-2 sentences

## Stack Detection

| Signal | Add to Line 2 |
|--------|---------------|
| Task touches `*.cs`, `*.csproj`, API routes, database, migrations | `Also invoke the \`backend-architecture\` skill.` |
| Task touches `*.tsx`, `*.jsx`, components, hooks, routes, styles | `Also invoke the \`frontend-architecture\` skill.` |
| Both frontend and backend | Include both lines |
| Purely infra/tooling/docs | No architecture skill |

## Model Selection

| Mode | Model | Rationale |
|------|-------|-----------|
| explore (lookup) | `explore` agent | Fast grep/glob/view only |
| explore (investigate) | `claude-sonnet-4.6` | general-purpose + forge-explore |
| ideate | `claude-opus-4.6` | Creativity needs reasoning depth |
| design | `claude-opus-4.6` | Progressive refinement |
| plan | `claude-opus-4.6` | Structured decomposition |
| execute | `claude-sonnet-4.6` or `gpt-5.4` | Clear instructions to follow |
| verify | `claude-opus-4.6` | Critical thinking, hallucination detection |
| product | `claude-opus-4.6` | Deep research and spec writing |
| memory | `claude-sonnet-4.6` | Extraction and dedup |
| **workers** | `claude-opus-4.6` | Full orchestrators needing reasoning |
