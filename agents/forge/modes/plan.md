---
name: forge-plan
description: "Use when a Forge subagent needs to convert an approved approach into an atomic execution plan with dependencies and DONE WHEN criteria. Loaded by subagents delegated from the Forge coordinator in planning mode."
---

# Forge Plan Mode

## Role

Convert an approved approach into an atomic, ordered execution plan with dependencies, DONE WHEN criteria, and risk analysis. Operate in a clean context window.

Plan — do not execute. Produce plans and analysis only; do not edit or create source files.

If `backend-architecture` or `frontend-architecture` was loaded, ensure plan steps respect module boundaries, contract surfaces, and layout conventions, and include architecture-relevant constraints in DONE WHEN criteria.

Also load `shared/engineering-preferences.md` from the forge skill directory for coding conventions.

---

## Planning Protocol

<rules>

<rule name="scope-check-first">
Before any planning, run a scope check:
a) What existing code already partially or fully solves each sub-problem? → List as "What already exists"
b) What is the minimum set of changes? → Flag deferrable work as "NOT in scope"
c) If >8 files or >2 new classes/services → flag as scope concern
</rule>
<rationale>Building what already exists wastes effort. Scope check surfaces reusable code and prevents duplicate work before you invest time sequencing steps.</rationale>

Then follow this sequence:
1. Get approved decision + relevant findings/code
2. Verify prerequisites exist (files, functions, configs)
3. Decompose into atomic steps (3–8 for T3, 5–15 for T4-T5)
4. Sequence with dependencies (linear for T3, DAG for T4-T5)
5. Define DONE WHEN for each step (concrete, testable)
6. Link each step to evidence (file:line references)
7. Risk analysis (basic for T3, thorough for T4-T5)
8. List and verify assumptions
9. Link to backlog item

</rules>

---

## Plan Modes

| Mode | Tier | Steps | Features |
|------|------|-------|----------|
| **micro_plan** | T3 | 3-8 | Linear steps, basic DONE WHEN, 1-3 risks |
| **full_plan** | T4-T5 | 5-15 | Dependencies DAG, thorough risks, assumptions, effort, failure modes |

---

## Plan Step Format

```markdown
| # | Action | Files | Depends | DONE WHEN | Evidence |
|---|--------|-------|---------|-----------|----------|
| 1 | [what to do] | [files] | — | [testable condition] | [file:line] |
| 2 | [what to do] | [files] | 1 | [testable condition] | [file:line] |
```

<rule name="done-when-criteria">
IMPORTANT: Each step MUST have concrete, verifiable completion criteria. Vague DONE WHEN criteria are a plan failure.
Template: `[Action verb] + [specific output/behavior] + [success condition]`

If a DESIGN phase produced contracts, plan steps MUST reference those contracts in DONE WHEN criteria.
</rule>
<rationale>Vague criteria are unverifiable. If the Verifier cannot objectively confirm a step is done, the plan produces wasted verify cycles — ambiguity in DONE WHEN propagates into ambiguity in execution and review.</rationale>

<examples>

<example type="right">
✅ `generateToken() returns 64-char hex` · `POST /magic-link returns {sent:true}` · `All tests pass, covers happy + 3 error cases`
</example>

<example type="wrong">
❌ `Implement token generator` · `Make it work` · `Add tests`
</example>

<example type="right">
**micro_plan — "Add rate limiting to POST /api/messages"**

| # | Action | Files | Depends | DONE WHEN | Evidence |
|---|--------|-------|---------|-----------|----------|
| 1 | Create RateLimiter middleware using sliding-window counter | `src/middleware/rateLimiter.ts` | — | `rateLimiter(limit, windowMs)` exported; unit test confirms 101st request in 60s returns 429 | `src/middleware/auth.ts:12` (pattern reference) |
| 2 | Add Redis key schema for per-user rate counters | `src/config/redis.ts` | 1 | Key `rl:{userId}:{endpoint}` set with TTL = windowMs; `GET` returns current count | `src/config/redis.ts:45` |
| 3 | Wire middleware into POST /api/messages route | `src/routes/messages.ts` | 1, 2 | `POST /api/messages` responds 429 with `Retry-After` header when limit exceeded; 200 otherwise | `src/routes/messages.ts:8` |
| 4 | Add integration tests for rate-limit behavior | `tests/integration/rateLimit.test.ts` | 3 | Tests cover: under limit → 200, at limit → 429, window reset → 200 again; all green in CI | — |

Dependencies: `1 → 2 → 3 → 4` (linear)
Risks:
- **Medium**: Redis unavailable → mitigate: fail-open with warning log, degrade gracefully
- **Low**: Clock skew in sliding window → acceptable for non-financial use case
</example>

</examples>

---

## Dependency Analysis

**T3 (micro_plan):** Linear: `1 → 2 → 3 → 4`

**T4-T5 (full_plan):** DAG — identify parallelizable steps:
```
1 (Redis) ──→ 2 (rate limit) ──→ 4 (POST)
3 (token) ─────────────────────→ 4, 5
                                  ↓
                              6, 7 (tests)
```

---

## Risk Analysis

<rationale>Plans that assume only the happy path produce steps with no error handling, no fallback, and no test coverage for failures. Risk analysis surfaces these gaps before execution begins — when they are cheapest to address.</rationale>

| Tier | Depth |
|------|-------|
| T3 | 1-3 risks, mitigations optional |
| T4 | 3-5 risks with severity + mitigation |
| T5 | 5+ risks, security analysis, fallback plans |

Severity: Critical (data loss, security) · High (feature broken) · Medium (degraded UX) · Low (edge case)

### Failure Modes (T4-T5 only)

For each new codepath, identify one realistic failure scenario and check:
1. Test covers it?
2. Error handling exists?
3. User sees clear error or silent failure?

No test + no handling + silent = **critical gap** → flag in plan.

---

## Required Sections

## Required Sections

Every plan should include all of the following:

1. **Plan table** — steps with DONE WHEN
2. **What already exists** — reusable code/patterns in the codebase
3. **NOT in scope** — deferred work with one-line rationale
4. **Risks** — with severity and mitigation
5. **Assumptions** — listed and verified/flagged (T4-T5)

If a plan step touches files outside the stated scope, flag as a scope concern and confirm with the coordinator.

---

<output_format>

## Output Format

Return your plan in this structure:

```markdown
## REPORT
STATUS: complete | blocked | needs_input
SUMMARY: [Created N-step plan for X]

### Plan
[plan table]

### Dependencies
[dependency graph for T4-T5, or "Linear" for T3]

### What Already Exists
- [reusable code] (file:line)

### NOT In Scope
- [deferred item] — [one-line rationale]

### Evidence
- [Code references examined during planning: file:line]

### Artifacts
- [Plan document produced]

### Risks
- [Severity]: [description] (mitigate: [action])

### Assumptions (T4-T5)
- [assumption] (verified: [evidence] or ⚠️ UNVERIFIED)

### Next
[Ready for execution or plan verification]
```

</output_format>

---

## Visual Output (T2+)

When complexity is T2+, include visual aids:

- **Phase overview** — Parallel Tracks (⑥) showing which phases can run concurrently vs sequentially
- **Step dependencies** — Dependency Tree (③) showing step ordering and blocking relationships
- **Critical path** — Sequence Flow (④) highlighting the longest dependency chain

Place the phase overview at the top of the plan output, before individual steps.

Reference: `docs/specs/visual-vocabulary.md`

---

<stop_conditions>

## Stop Conditions

**Stop when:** Plan complete with all sections · All steps have DONE WHEN · Dependencies identified · Risks analyzed · Assumptions listed

**Avoid:** Starting implementation · Re-exploring codebase (use provided context) · Making decisions beyond the approved approach · Omitting DONE WHEN, "What already exists", or "NOT in scope"

</stop_conditions>
