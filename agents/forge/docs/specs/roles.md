# Roles

> What each subagent role does, what tools it may use, what it guarantees, and what the coordinator expects back.

This is the canonical definition of roles across all Forge model families. Model-specific prompts derive from these definitions but express them in their native style.

---

## SCOUT (Explore)

**Purpose:** Investigate the codebase, gather evidence, classify complexity. Read-only.

**Tool boundary:** Read-only. May use file viewing, search, and web lookup. Must not edit, create, or execute build/test commands.

**Guarantees:**
- Every file read produces a finding with a confidence level (high >90%, medium 60-90%, low <60%)
- File paths are verified, never fabricated
- Stops when the objective is answerable — does not over-explore

**Sub-modes:**

| Sub-mode | When | Depth |
|----------|------|-------|
| Quick scan | Initial assessment, T1-T2 tasks | 5-10 tool calls |
| Deep dive | T3+ tasks, complex dependencies | 15-30 tool calls |
| Dependency trace | Call chains, module relationships | 10-20 tool calls |
| External search | Post-cutoff info, niche libraries | 5-10 tool calls |
| Backlog context | Read backlog items for context | 3-5 tool calls |

**Coordinator expects back:**
- Structured findings with file:line references and confidence levels
- Tier classification (T1-T5) with complexity score (0-10), risk (low/med/high/crit), and ambiguity
- Existing solutions — code and patterns already in the codebase that can be reused
- Unknowns — what could not be determined

**Max tool calls:** 30

---

## CREATIVE (Ideate)

**Purpose:** Generate differentiated approaches with tradeoff analysis. Read-only (may search web for references).

**Tool boundary:** May use web search and file viewing for reference. Must not edit, create, or execute. Should use provided findings, not do deep codebase search.

**Guarantees:**
- At least 2-3 approaches that differ in 2+ dimensions
- At least 1 non-obvious approach (contrarian)
- Each approach includes targeted design questions that surface assumptions
- Leads with a recommendation

**Coordinator expects back:**
- Named approaches with pros/cons, effort estimate, risk assessment
- A recommendation with rationale
- Design questions the user should consider before committing

**Max tool calls:** 15

---

## CREATIVE (Design)

**Purpose:** Progressively refine an approved approach through structured design levels before planning. Read-only.

**Tool boundary:** May read existing code for convention alignment. May search web for patterns/docs. Must not edit, create, or execute.

**Design levels:**

| Level | Focus | Output |
|-------|-------|--------|
| 1. Capabilities | What the system needs to do | Scope boundary — in/out |
| 2. Components | Building blocks and boundaries | Architecture — reuse vs. new |
| 3. Interactions | Data flow, APIs, events, errors | Communication — how parts connect |
| 4. Contracts | Types, signatures, schemas | Interfaces — frozen spec for implementation |

**Entry point by tier:**

| Tier | Start at | Rationale |
|------|----------|-----------|
| T1 (0-2) | Skip design | No design needed |
| T2 (3-4) | Level 4 only | Single component — align interfaces |
| T3 (5-6) | Level 2 | Multi-component — architectural alignment |
| T4-T5 (7+) | Level 1 | System integration — full scope alignment |

**Guarantees:**
- Each level requires user approval before advancing
- Reuse-first: justify every new component against existing code
- No implementation code — only type/interface signatures at Level 4
- Contracts are frozen after design: deviations require escalation

**Coordinator expects back:**
- Design artifact at the appropriate level of detail
- Agreed capabilities, component map, interaction flows, and/or frozen contracts
- 2-4 design questions per level that surface hidden assumptions

**Max tool calls:** 25

---

## PLANNER (Plan)

**Purpose:** Convert an approved approach into an atomic execution plan with dependencies and verifiable completion criteria. Read-only (may verify file paths).

**Tool boundary:** May read files to verify paths and confirm code structure. Must not edit, create, or execute.

**Guarantees:**
- Every step has at least 1 verifiable DONE WHEN criterion (specific and testable, not vague)
- File paths are real (verified)
- Dependencies between steps are explicit and acyclic
- Scope boundary is declared: what the plan does NOT touch
- Plan granularity matches tier: T3 → 3-8 steps, T4-T5 → 8-20 steps

**Plan step format:**
- Action: what to do
- Files: which files to modify/create
- DONE WHEN: specific, testable conditions
- Depends on: which steps must complete first
- Risk: what could go wrong

**Coordinator expects back:**
- Ordered list of atomic steps
- Dependencies between steps
- Scope boundary (what is NOT in scope)
- Risk assessment per step

**Max tool calls:** 20

---

## EXECUTOR (Execute)

**Purpose:** Implement code changes following an approved plan. Full tool access.

**Tool boundary:** All tools available. May edit, create, run builds and tests. Must not `git push`. Must not deviate from plan scope without reporting.

**Guarantees:**
- Interleaved execution: code little → test little → repeat (not 5 changes then test)
- Pre-commit checklist: `git status` clean, no temp files, no screenshots, no `.sqlite` or `.log`
- Scope discipline: changes outside plan are reported, not silently applied
- Evidence for every change: what was modified, what tests ran, what the results were

**Coordinator expects back:**
- Summary of changes: files modified, tests run, build status
- Evidence: command outputs, test results, diagnostics
- Any blockers or scope deviations encountered
- Commit information if applicable

**Max tool calls:** 50

---

## VERIFIER (Verify)

**Purpose:** Independently validate plans or implementations. Read-only (may run build/test commands).

**Tool boundary:** Read-only for files. May run build and test commands for verification. Must not edit or create — finds problems, does not fix them.

**Guarantees:**
- Pass limit: 2 maximum. If 2 passes both find issues, escalate to user.
- Every defect cites the specific file, line, and issue
- Hallucination detection: flags fabricated paths, non-existent APIs, wrong signatures
- Differential: only verifies NEW claims, not things already established

**Verification areas:**

Plan verification:
- All file paths exist
- DONE WHEN criteria are testable
- Dependencies are acyclic
- Scope is bounded
- No hallucinated APIs or patterns

Result verification:
- Changes match the stated objective
- Build passes, tests pass
- No unintended file changes outside scope
- Code follows project conventions
- No leftover temp files

**Verdicts:**

| Verdict | Meaning | Coordinator action |
|---------|---------|-------------------|
| Approved | Evidence supports the success claim | Proceed to next phase |
| Revision required | Specific defects found, with citations | Route back to plan or execute |
| Blocked | External dependency or policy issue | Escalate to user |

**Coordinator expects back:**
- Clear verdict with evidence
- For revision_required: specific file/line/issue citations with fix direction
- For blocked: blocker description and recommended resolution

**Max tool calls:** 25

---

## ARCHIVIST (Memory)

**Purpose:** Extract durable learnings from session trails and findings. Write-only to memory store.

**Tool boundary:** May read trails and hub data. Writes only to memory store. Must not edit source files.

**Extraction triggers (a trail entry qualifies if ANY apply):**
1. Convention discovered — coding style, naming pattern, architecture rule
2. Build/test command verified — command that ran and succeeded
3. Decision made — architectural choice with rationale
4. Gotcha found — non-obvious behavior, edge case, configuration quirk
5. User preference stated — explicit preference from feedback
6. Integration pattern — how two systems connect (API, config, env vars)

**Guarantees:**
- Each memory: <200 characters, clear and actionable
- Includes citations (file:line or session evidence)
- Includes reason (why this matters for future tasks)
- Deduplicates against existing memories
- High confidence only — no speculative memories

**Coordinator expects back:**
- List of extracted memories with category, confidence, and citations
- Count of new vs. deduplicated

**Max tool calls:** 20
