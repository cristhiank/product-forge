# Evidence

> What counts as evidence per role, minimum requirements for completion, and rules for evidence absence.

---

## Principle

Evidence is what separates a claim from a fact. The coordinator should not accept "done" without supporting evidence, and should not reject useful work just because the evidence is formatted wrong.

Evidence is judged **semantically**: does the subagent's output contain concrete proof that supports the claimed result? Not: did it use the right XML tags or markdown headers?

---

## Cross-Role Evidence Requirements

These apply to **every** role in addition to the role-specific evidence below.

### DEVIATIONS (required)

Every subagent output MUST include a `DEVIATIONS:` footer listing any departure from the Mission Brief instructions with a one-line justification. If there are no deviations, omit the footer entirely rather than writing `DEVIATIONS: None`. Absence of the footer when deviations exist is a defect the coordinator should flag.

These footers are **internal** — the coordinator reads them for evaluation and strips them before presenting output to the user. Non-trivial deviations are surfaced to the user in natural language.

### UNKNOWNS and REMAINING RISKS (recommended)

Every subagent output SHOULD surface `UNKNOWNS:` (things that could not be determined) and `REMAINING RISKS:` (things that could go wrong). Omit when there are genuinely none — do not write `UNKNOWNS: None`. These are especially important for SCOUT, PLANNER, and EXECUTOR outputs. Stating unknowns is evidence of rigor, not a sign of failure.

These footers are **internal** — the coordinator reads them for evaluation and surfaces only the ones that matter to the user, rephrased naturally.

### CORRECTION statements (positive quality signal)

If a subagent includes `CORRECTION:` statements in its output, this indicates mid-execution self-correction — the subagent caught an error in its own reasoning or approach and fixed it in real-time. Corrections are a mark of quality, not a defect. The coordinator should not penalize corrected work.

---

## Evidence by Role

### SCOUT (Explore)

| Evidence type | Example |
|--------------|---------|
| File reference | `src/auth/AuthController.cs:41` — handles token validation |
| Command output | `npm outdated` → 28 packages with available updates (exit code 1) |
| Confidence finding | "Uses JWT with RS256" (high confidence, file:line) |
| Negative finding | "No existing rate limiting middleware found in src/middleware/" |

**Minimum for completion:** At least one finding with a file reference and confidence level. Tier classification with complexity score, risk, and ambiguity.

**When evidence is absent:** If explore found nothing relevant, that is itself a finding. Report what was searched and why nothing matched.

---

### CREATIVE (Ideate)

| Evidence type | Example |
|--------------|---------|
| Approach description | Named approach with pros, cons, effort, risk |
| Differentiator | "Approach A uses existing middleware; B requires new service" |
| Reference | Link to documentation, design pattern, or prior art |
| Design question | "Should the rate limiter be per-user or per-endpoint?" |

**Minimum for completion:** At least 2 differentiated approaches with recommendation. At least 1 non-obvious approach.

**When evidence is absent:** If ideation cannot produce differentiated approaches (only one viable path exists), say so explicitly with the rationale.

---

### CREATIVE (Assess)

| Evidence type | Example |
|--------------|---------|
| Premise finding | "Current search averages 3.2s — users report abandoning after 2s (support tickets #142, #156)" |
| Existing code reference | "`src/search/SearchService.ts:41` already implements fuzzy matching — plan should extend, not rebuild" |
| JTBD statement | "User hires this feature to reduce time-to-answer when investigating a customer complaint" |
| Scope mode recommendation | "Recommend HOLD: scope is right, focus on making search sub-2s with proper caching" |
| Delight opportunity | "Auto-suggest recent searches (<30 min, high delight, low effort)" |
| NOT in scope item | "Full-text search across attachments — deferred, requires infrastructure change" |

**Minimum for completion:** T3: premise check + existing code leverage + NOT in scope. T4-T5: all 7 outputs with evidence-backed recommendations. Each output must end with a clear recommendation.

**When evidence is absent:** If premises cannot be evaluated (e.g., no product context in codebase, no user data), report as `needs_input` with specific questions about the product context.

---

### CREATIVE (Design)

| Evidence type | Example |
|--------------|---------|
| Component definition | "AuthMiddleware: wraps existing Express middleware, extends with JWT validation" |
| Interaction diagram | Data flow between components with explicit contracts |
| Interface signature | Type definitions, API shapes, schema declarations |
| Reuse justification | "Extends existing `BaseMiddleware` in `src/middleware/base.ts:12`" |

**Minimum for completion:** Design artifact at the appropriate level for the tier. Frozen contracts at Level 4 (for T3+).

**When evidence is absent:** If a design level reveals insufficient information to proceed, report it as `needs_input` with specific questions rather than guessing.

---

### PLANNER (Plan)

| Evidence type | Example |
|--------------|---------|
| Step with DONE WHEN | "Step 3: Add rate limiter middleware. DONE WHEN: `npm test` passes, rate limit header present in response" |
| Verified file path | Path confirmed to exist via file reading |
| Dependency link | "Step 4 depends on Step 2 (middleware must exist before route registration)" |
| Scope boundary | "NOT in scope: database schema changes, deployment config" |

**Minimum for completion:** All steps have verifiable DONE WHEN criteria. File paths verified. Dependencies explicit.

**When evidence is absent:** If plan cannot be completed because scope is unclear, return `needs_input` with the specific ambiguity.

---

### EXECUTOR (Execute)

| Evidence type | Example |
|--------------|---------|
| File change | `Modified: src/auth/AuthController.cs` (added input validation at line 41) |
| Test result | `dotnet test` → 24 passed, 0 failed (exit code 0) |
| Build output | `npm run build` → success (exit code 0) |
| Diagnostic | `eslint .` → 0 errors, 0 warnings |

**Minimum for completion:** At least one file change with a corresponding verification result (test, build, or diagnostic). If code changed, evidence must include command output.

**When evidence is absent:** If no code changed (e.g., task was to verify something already works), explain why no build/test evidence exists. If a build/test command failed, include the failure output.

---

### VERIFIER (Verify)

| Evidence type | Example |
|--------------|---------|
| Checklist result | "✅ All file paths exist. ✅ Tests pass. ❌ Scope drift: `utils/format.ts` modified but not in plan" |
| Defect citation | `src/auth/AuthController.cs:67` — missing null check on `req.body.token` |
| Build verification | `dotnet test` → 24 passed, 0 failed |
| Hallucination flag | "Plan references `src/middleware/rateLimit.ts` but file does not exist" |

**Minimum for completion:** Clear verdict (approved / revision_required / blocked). For revision_required: at least one defect with file/line citation and fix direction.

**When evidence is absent:** If verification cannot proceed (missing access, tools unavailable), report `blocked` with the specific blocker — do not infer blockers.

---

### ARCHIVIST (Memory)

| Evidence type | Example |
|--------------|---------|
| Memory entry | "Use `npm run build` to build the frontend" (convention, high confidence, `package.json:7`) |
| Deduplication | "Skipped: already stored as memory #42" |

**Minimum for completion:** At least one extracted memory, or explicit statement that no trail entries qualified.

---

## Coordinator Evaluation

The coordinator evaluates subagent output by asking:

1. **Did it address the objective?** — Compare output content to what the Mission Brief asked for.
2. **Is evidence present and concrete?** — Look for file references, command outputs, specific findings — not just prose claims.
3. **Is the work complete or partial?** — Determine whether to proceed, retry, or escalate.
4. **Is anything out of scope?** — Check for unasked-for changes, drift, or security concerns.

This evaluation is semantic. The coordinator does not parse a specific output format — it reads the output and judges whether the evidence criteria above are met.
