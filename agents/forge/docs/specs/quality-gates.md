# Quality Gates

> Prime directives, assessment protocols, code safety checklists, and tier-calibrated quality standards that span the Forge lifecycle.

---

## Prime Directives

These principles apply to all roles at T3+ complexity. They are the quality floor — not aspirational targets.

1. **Zero silent failures.** Every error path must be named, handled, and visible — to the system, the team, and the user. A failure that can happen silently is a critical defect in any plan or implementation.

2. **Every error has a name.** "Handle errors" is not a specification. Name the specific exception/error class, what triggers it, what catches it, what the user sees, and whether it is tested.

3. **Data flows have shadow paths.** Every data flow has a happy path and three shadow paths: nil/missing input, empty/zero-length input, and upstream error. All four must be traced for every new flow at T3+.

4. **Interactions have edge cases.** Every user-visible interaction has edge cases: double-click, navigate-away-mid-action, slow connection, stale state, back button, concurrent mutation. Map them.

5. **Observability is scope, not afterthought.** Logging, metrics, alerts, and dashboards for new codepaths are first-class deliverables — not post-launch cleanup items.

6. **Everything deferred must be written down.** Vague intentions are lies. If work is deferred, it must appear in NOT IN SCOPE with a rationale, or in a backlog item with enough context that someone can pick it up in 3 months.

7. **Optimize for the 6-month future.** If a plan solves today's problem but creates next quarter's nightmare, that must be surfaced explicitly.

---

## ASSESS Phase Protocol (CEO Quality Gate)

### Purpose

Challenge premises, validate the problem is worth solving, and set the strategic frame before design and implementation. This is the "should we?" gate that precedes the "how should we?" phases.

### When It Runs

```
Tier      Depth          Trigger
────      ─────          ───────
T1-T2     Skip           —
T3        Light          Auto (premise check + existing leverage + NOT in scope)
T4-T5     Deep           Auto (full 7-output protocol + JTBD skill invocation)
Any       Deep/Light     Explicit user request ("challenge this", "CEO review")
```

### ASSESS Outputs

The ASSESS subagent produces structured findings. The coordinator presents them interactively — one issue at a time, with the user deciding each point before moving forward.

| Output | T3 (Light) | T4-T5 (Deep) | Description |
|--------|-----------|-------------|-------------|
| **Premise Challenge** | ✓ brief | ✓ full | Is this the right problem? What happens if we do nothing? Could a different framing yield a simpler or more impactful solution? |
| **Dream State Delta** | — | ✓ | Current state → This change → 12-month ideal. Does this plan move toward or away from the ideal? |
| **JTBD Validation** | — | ✓ (invoke skill) | What job is the user hiring this feature for? What is the struggling moment? What are the hiring criteria? |
| **Scope Mode Selection** | — | ✓ | EXPAND (cathedral — push scope up, 10x thinking) / HOLD (bulletproof — maximum rigor) / REDUCE (surgeon — strip to essentials). Selected mode feeds into DESIGN. |
| **Delight Opportunities** | — | ✓ | 3-5 adjacent improvements (<30 min each) that would make users think "oh nice, they thought of that." |
| **NOT in Scope** | ✓ | ✓ | Work explicitly deferred with one-line rationale per item. |
| **Existing Code Leverage** | ✓ | ✓ | What existing code/flows already partially solve each sub-problem? Does the plan reuse them or unnecessarily rebuild? |

### Scope Modes (T4-T5)

Once selected, the scope mode commits fully — the coordinator and all downstream phases honor the mode:

```
┌─────────────┬──────────────────────────────────────────────────────┐
│  EXPAND     │ Dream big. Push scope UP. "What would make this     │
│  (Cathedral)│ 10x better for 2x effort?" Find the platonic ideal. │
│             │ Delight opportunities are mandatory outputs.         │
├─────────────┼──────────────────────────────────────────────────────┤
│  HOLD       │ The scope is right. Make it bulletproof. Maximum     │
│  (Rigor)    │ depth on error paths, edge cases, observability,    │
│             │ security. Do not expand or reduce.                   │
├─────────────┼──────────────────────────────────────────────────────┤
│  REDUCE     │ Surgeon mode. Find the absolute minimum that ships  │
│  (Surgeon)  │ value. Everything else is deferred. Be ruthless.     │
└─────────────┴──────────────────────────────────────────────────────┘
```

### Interactive Presentation Protocol

The coordinator drives the interactive flow after receiving ASSESS output:

1. Present premise challenge findings — ask user to confirm or redirect
2. Present existing code leverage — ask if plan should reuse or rebuild
3. (T4-T5) Present dream state delta — ask if direction is right
4. (T4-T5) Present scope mode recommendation — ask user to select
5. (T4-T5) Present delight opportunities — ask which to include/defer
6. Present NOT in scope — ask if anything should be pulled in or pushed out
7. Collect decisions and pass them as context to DESIGN phase

Each finding is one question. Lead with recommendation + WHY. Lettered options. The user can batch-respond if they prefer speed.

---

## Pre-Investigation Audit (SCOUT Enhancement, T3+)

Before diving into codebase exploration for T3+ tasks, SCOUT runs a lightweight audit:

```
Audit Step               What It Surfaces
──────────               ────────────────
git log -10 on scope     Recent churn — areas under active development
TODO/FIXME grep          Known debt in affected files
git stash list           In-flight work that might conflict
Recent file timestamps   Files recently modified (potential merge risk)
```

This audit context is included in SCOUT's findings output so downstream phases can calibrate. High-churn areas and existing TODOs get flagged as risk factors.

---

## Error & Rescue Registry (DESIGN L3 Enhancement, T3+)

When DESIGN reaches Level 3 (Interactions), the subagent produces an Error & Rescue Registry alongside interaction flows.

### Template

```
METHOD/CODEPATH          │ FAILURE MODE             │ ERROR CLASS/TYPE
─────────────────────────┼──────────────────────────┼─────────────────
ServiceX.call()          │ API timeout              │ TimeoutError
                         │ API returns 429          │ RateLimitError
                         │ Malformed response       │ ParseError
─────────────────────────┼──────────────────────────┼─────────────────

ERROR CLASS/TYPE         │ HANDLED? │ HANDLER ACTION         │ USER SEES
─────────────────────────┼──────────┼────────────────────────┼──────────
TimeoutError             │ Yes      │ Retry 2x, then raise   │ "Temporarily unavailable"
RateLimitError           │ Yes      │ Backoff + retry         │ Nothing (transparent)
ParseError               │ NO ← GAP│ —                       │ 500 error ← BAD
```

### Rules

 - Generic "handle errors" is never acceptable — name the specific error type
 - `catch (Exception)` / `rescue StandardError` is always a smell — flag it
 - Every rescued error must: retry with backoff, degrade gracefully with a user-visible message, or re-raise with added context
 - "Swallow and continue" is almost never acceptable
 - For LLM/AI calls specifically: trace malformed response, empty response, hallucinated JSON, and refusal as distinct failure modes

### Tier Calibration

 - **T3:** Simple registry — cover the 2-3 critical integration boundaries
 - **T4-T5:** Full registry — every method that can fail, every error class, every handler, every user-visible outcome

---

## Test Coverage Map (PLANNER Enhancement, T3+)

When PLANNER produces the execution plan for T3+ tasks, it includes a test coverage map.

### Template

```
CODEPATH / FEATURE       │ TEST TYPE    │ HAPPY PATH  │ ERROR PATH  │ EDGE CASE
─────────────────────────┼──────────────┼─────────────┼─────────────┼──────────
Auth token validation    │ Unit         │ ✓ valid JWT │ ✓ expired   │ ✓ malformed
Rate limiter             │ Integration  │ ✓ under limit│ ✓ over limit│ ✓ burst
User-facing form         │ E2E          │ ✓ submit    │ ✓ validation│ — (defer)
```

### Confidence Tests

For each new feature at T4-T5, the planner answers:
 - **Friday deploy test:** Would you ship this at 2am on a Friday? What test gives you that confidence?
 - **Hostile QA test:** What would a hostile QA engineer write to break this?
 - **Chaos test:** What happens if the database is slow, the API times out, or the user double-clicks?

---

## Observability Section (PLANNER Enhancement, T3+)

The plan must include an observability section for T3+ tasks:

```
FEATURE / CODEPATH       │ HEALTH METRIC              │ BROKEN SIGNAL
─────────────────────────┼────────────────────────────┼──────────────────
Payment processing       │ Success rate > 99%         │ Rate drops below 95%
Search indexing          │ Index lag < 5 min          │ Lag exceeds 30 min
Background jobs          │ Queue depth < 100          │ Depth exceeds 1000
```

 - **T3:** Mention what metrics matter (1-2 sentences per new codepath)
 - **T4-T5:** Full table with health metric, broken signal, and recommended alert threshold

---

## Deploy & Rollout Section (PLANNER Enhancement, T3+)

```
CONCERN                  │ ANSWER
─────────────────────────┼────────────────────────────
Migration safety         │ Backward-compatible? Zero-downtime? Table locks?
Feature flags            │ Should any part be behind a flag?
Rollout order            │ Migrate first → deploy → verify? Or flag-gated?
Rollback plan            │ Explicit steps. How long to roll back?
Partial deploy risk      │ Old code + new code running simultaneously — what breaks?
Post-deploy verification │ What to check in the first 5 minutes?
```

 - **T3:** Basic answers (1-2 sentences per concern)
 - **T4-T5:** Full answers with explicit rollback steps and verification checklist

---

## Code Safety Checklist (VERIFIER Enhancement, T3+)

After result verification, VERIFIER runs a code safety checklist against the diff. Two-pass structure: CRITICAL findings block approval; INFORMATIONAL findings are advisory.

### Pass 1 — CRITICAL (blocks verdict)

#### Data Safety
 - String interpolation in SQL or query construction (even with type coercion)
 - Check-then-act (TOCTOU) patterns that should be atomic
 - ORM methods that bypass validations on constrained fields
 - N+1 queries: associations used in loops without eager loading

#### Race Conditions & Concurrency
 - Read-check-write without uniqueness constraint or conflict handling
 - Find-or-create without unique index — concurrent calls can create duplicates
 - Status transitions without atomic conditional update — concurrent updates can skip or double-apply

#### LLM Output Trust Boundary
 - LLM-generated values written to DB or passed to downstream systems without format validation
 - Structured LLM output (arrays, objects) accepted without type/shape checks before persistence

### Pass 2 — INFORMATIONAL (advisory, included in verdict notes)

#### Conditional Side Effects
 - Code paths that branch but forget a side effect on one branch (e.g., state promoted but URL only attached conditionally)
 - Log messages that claim an action happened but the action was conditionally skipped

#### Magic Numbers & String Coupling
 - Bare numeric literals used in multiple files — should be named constants
 - Error message strings used as query filters elsewhere

#### Dead Code & Consistency
 - Variables assigned but never read
 - Comments/docstrings that describe old behavior after the code changed

#### LLM Prompt Issues
 - 0-indexed lists in prompts (LLMs reliably return 1-indexed)
 - Prompt text listing available tools that don't match what's actually wired up
 - Token/word limits stated in multiple places that could drift

#### Test Gaps
 - Negative-path tests that assert type/status but not side effects
 - Security enforcement without integration tests verifying the enforcement path
 - Missing "expects never called" assertions when a path should NOT trigger external calls

#### Crypto & Entropy
 - Truncation instead of hashing (less entropy, easier collisions)
 - Non-cryptographic random for security-sensitive values
 - Non-constant-time comparisons on secrets or tokens

#### Time Window Safety
 - Date-key lookups assuming "today" covers 24h
 - Mismatched time windows between related features

#### Type Coercion at Boundaries
 - Values crossing serialization boundaries where type could change
 - Hash/digest inputs that don't normalize types before serialization

### Suppression Rules — Do NOT Flag

 - Redundancy that aids readability (e.g., `present?` redundant with `length > 20`)
 - "Add a comment explaining why" — threshold values change during tuning, comments rot
 - "This assertion could be tighter" when the assertion already covers the behavior
 - Consistency-only changes (wrapping a value to match how another is guarded)
 - Regex edge cases when input is constrained and the edge case never occurs in practice
 - Tests exercising multiple guards simultaneously
 - Harmless no-ops
 - Anything already addressed in the diff being reviewed

### Gate Classification

```
CRITICAL (blocks verdict):          INFORMATIONAL (in verdict notes):
├─ Data Safety                      ├─ Conditional Side Effects
├─ Race Conditions & Concurrency    ├─ Magic Numbers & String Coupling
└─ LLM Output Trust Boundary        ├─ Dead Code & Consistency
                                     ├─ LLM Prompt Issues
                                     ├─ Test Gaps
                                     ├─ Crypto & Entropy
                                     ├─ Time Window Safety
                                     └─ Type Coercion at Boundaries
```

---

## Deploy Readiness Check (VERIFIER Enhancement, T3+)

After code safety, VERIFIER checks deploy readiness for T3+ tasks:

 - Migrations reversible? Zero-downtime compatible?
 - Feature flags present for user-facing changes?
 - Rollback plan documented in the plan?
 - Post-deploy verification steps defined?

### Tier Calibration

 - **T3:** Mention any deploy concerns (1-2 items)
 - **T4-T5:** Full deploy readiness verdict with go/no-go recommendation

---

## Hostile QA Perspective (VERIFIER Enhancement, T4-T5)

For T4-T5 result verification, VERIFIER adds an adversarial lens:

 - **Friday deploy confidence:** Would you approve this for a Friday evening deploy? What's the weakest link?
 - **Break it test:** How would a hostile QA engineer break this? What input, timing, or sequence would expose a flaw?
 - **Silent failure scan:** Walk through each new codepath — is there any path where a failure is invisible?

---

## Tier Calibration Matrix (Complete)

```
Enhancement                     T1    T2    T3         T4-T5
────────────────────────────────────────────────────────────────
EXPLORE pre-audit                —     —     ✓ light    ✓ full
ASSESS (CEO gate)                —     —     ✓ light    ✓ deep
  Premise challenge              —     —     ✓ brief    ✓ full
  Dream state delta              —     —     —          ✓
  JTBD validation                —     —     —          ✓ (invoke skill)
  Scope mode selection           —     —     —          ✓
  Delight opportunities          —     —     —          ✓
  NOT in scope                   —     —     ✓          ✓
  Existing code leverage         —     —     ✓          ✓
DESIGN error/rescue registry     —     —     ✓ simple   ✓ full
PLAN test coverage map           —     —     ✓ basic    ✓ full
PLAN observability section       —     —     ✓ mention  ✓ full table
PLAN deploy/rollout section      —     —     ✓ basic    ✓ full
VERIFY(plan) gate                —     —     ✓          ✓
VERIFY code safety checklist     —     —     ✓          ✓
VERIFY deploy readiness          —     —     ✓ basic    ✓ full
VERIFY hostile QA perspective    —     —     —          ✓
ARCHIVIST retro trigger          —     —     ✓          ✓
```

---

## Session Retrospective Trigger (ARCHIVIST Enhancement)

After T3+ tasks complete, the ARCHIVIST adds a seventh extraction trigger:

**Trigger 7 — Session Retrospective:**
 - What patterns emerged that should become future conventions?
 - What was surprising or harder than expected?
 - What guardrails would prevent similar issues in the future?
 - What decisions were made that should be remembered for context?

This trigger produces memories that are forward-looking — not recording what happened, but encoding what was learned for future tasks.
