# REPORT Contract v1 (Claude-optimized)

Canonical subagent → coordinator contract. Every subagent dispatch must return a REPORT in this format.

## Required Fields

IMPORTANT: All fields below are required. A response without these fields is not a valid REPORT.

```markdown
## REPORT
STATUS: <complete | blocked | needs_input | failed | timed_out>
SUMMARY: <one-line result — what was done or why it wasn't>

### Evidence
 - <concrete proof: test output, file paths changed, command results>
 - <at least 1 evidence item for complete status>

### Artifacts
 - <files changed, created, or deleted — with paths>
 - <decisions made and rationale>

### Next
<recommended next action for the coordinator>
```

## Status Values

| Status | Meaning | Coordinator Action |
|--------|---------|-------------------|
| `complete` | Work finished successfully | Summarize → bookkeep → bridge → done |
| `blocked` | Cannot proceed — external dependency or permission needed | Surface blocker to user |
| `needs_input` | Underspecified — design decision or scope clarification required | Present questions to user |
| `failed` | Attempted but failed — include error details in Evidence | Explain failure, consider retry |
| `timed_out` | Hit runtime guard without completing | Explain timeout, consider splitting |

## Validation Rules

IMPORTANT: The coordinator MUST validate before accepting a REPORT:

 - **Status present** — one of the 5 valid values
 - **Summary present** — non-empty one-liner
 - **Evidence present** — at least 1 item when status is `complete`
 - **Artifacts present** — lists files touched (can be empty for explore/verify)
 - **Next present** — recommended follow-up action

**INCORRECT — NEVER accept this:**
```
Done! I fixed the bug and everything works now.
```

**CORRECT — always require structured REPORT:**
```
## REPORT
STATUS: complete
SUMMARY: Fixed off-by-one in price calculation

### Evidence
 - `src/services/pricing.ts:42` — changed `<=` to `<`
 - Tests passing: `npm test` → 47/47 green

### Artifacts
 - Modified: src/services/pricing.ts

### Next
Verify phase — run code review on pricing module
```
