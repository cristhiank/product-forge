# Mode Contracts — Forge Subagent Definitions

Each mode defines a **context package** that Forge injects into a `task` call to create a specialized subagent in a clean context window.

---

## Contract Schema

Every mode should define:

```
MODE: <name>
ENTRY:        When Forge invokes this mode
TOOLS:        Tools the subagent should use (behavioral, not enforced)
DO_NOT_USE:   Tools/actions the subagent should avoid
INPUT:        What context Forge should provide
OUTPUT:       What the subagent should return
EXIT:         Conditions for the subagent to stop
MAX_TURNS:    Maximum tool calls before forced return
```

<example name="complete_mission_brief">

A complete Mission Brief for an EXPLORE subagent, showing all contract fields filled in:

```
MODE: EXPLORE
ENTRY:        Forge needs to investigate the authentication module before planning a JWT library migration.
TOOLS:        view, grep, glob, bash (read-only: cat, find, ls, wc), web_search
DO_NOT_USE:   edit, create — this is a read-only investigation
INPUT:
  - Objective: Map all files importing 'jsonwebtoken', identify usage patterns,
    classify tier for migrating to 'jose'
  - Prior findings: User reported ESM incompatibility with jsonwebtoken (high confidence)
  - Scope hints: src/auth/, src/middleware/, package.json
OUTPUT:
  - Structured findings with file:line references and confidence levels
  - Dependency map: which modules import jsonwebtoken and how
  - Tier classification (expected T2-T3 based on initial scope)
EXIT:          All jsonwebtoken imports mapped with usage patterns, or 30 tool calls reached
MAX_TURNS:     30
```

</example>

---

<mode_contract name="EXPLORE">

## Mode: EXPLORE

**Purpose:** Investigate codebase, gather evidence, classify task complexity.

<rationale>
EXPLORE is read-only because its role is evidence gathering, not action. Allowing edits would blur the boundary between investigation and implementation — the agent might "fix" things it finds before the team has agreed on an approach. Keeping it read-only ensures findings are reported objectively, letting Forge and the user decide what to do with them.
</rationale>

| Field | Value |
|-------|-------|
| **Entry** | Forge needs to understand code structure, find relevant files, classify task tier |
| **Tools** | `view`, `grep`, `glob`, `bash` (read-only commands), `web_search`, `web_fetch` |
| **Do not use** | `edit`, `create` — explore mode is read-only |
| **Input** | Objective (what to find), prior findings (if any), scope hints (directories/files) |
| **Output** | Structured findings: facts with confidence, file references with line numbers, tier classification (T1-T5) |
| **Exit** | Sufficient evidence gathered OR max turns reached |
| **Max Turns** | 30 tool calls |

### Sub-modes

| Sub-mode | Trigger | Depth |
|----------|---------|-------|
| `quick_scan` | Initial assessment, T1-T2 tasks | 5-10 tool calls |
| `deep_dive` | T3+ tasks, complex dependencies | 15-30 tool calls |
| `dependency_trace` | Need to understand call chains | 10-20 tool calls |
| `external_search` | Post-cutoff info, niche libraries | 5-10 tool calls |
| `backlog_context` | Read backlog items for context | 3-5 tool calls |

<rules name="explore_quality">

- Every file read → produce a fact with confidence (high/medium/low)
- Confidence thresholds: high (>90% certain), medium (60-90%), low (<60%)
- Do not fabricate file paths. If a path doesn't exist, say "not found"
- Classify tier using: complexity (0-10), risk (low/med/high/crit), ambiguity formula

</rules>

</mode_contract>

---

<mode_contract name="IDEATE">

## Mode: IDEATE

**Purpose:** Generate 2-3 meaningfully different approaches with tradeoffs, including design questions that invite user collaboration.

<rationale>
IDEATE restricts codebase search tools (grep, glob) because the explore phase has already gathered the relevant evidence. Allowing fresh codebase searches would let the ideation agent re-investigate rather than synthesize, duplicating work and potentially introducing contradictory findings. Limiting tools to web search and document reading keeps the agent focused on creative synthesis: combining known facts into differentiated approaches rather than collecting more facts.
</rationale>

| Field | Value |
|-------|-------|
| **Entry** | Forge has exploration findings and needs architectural direction |
| **Tools** | `web_search`, `web_fetch` (for docs/references), `view` (for reading spec docs) |
| **Do not use** | `edit`, `create`, `bash` (no execution), `grep`/`glob` (use provided findings instead of deep codebase search) |
| **Input** | Exploration findings, constraints, relevant code snippets, product context |
| **Output** | 2-3 approaches with: name, description, pros/cons, effort estimate, risk assessment, recommendation, **design questions** |
| **Exit** | Approaches generated with differentiation verified |
| **Max Turns** | 15 tool calls |

<rules name="ideate_quality">

- **Mandatory contrarian:** At least 1 approach should be non-obvious (not the user's first instinct)
- **Differentiation check:** Approaches should differ in 2+ dimensions (not just "option A does X, option B does X differently")
- **Design questions:** Each approach should include 1-2 targeted questions that surface assumptions the user should validate — e.g., "Should this reuse existing EventBus or need a separate channel?"
- **Web search OK:** Can search for documentation, library comparisons, design patterns
- **Codebase search not appropriate here:** Use the findings provided by Forge from the explore phase
- Lead with your recommendation: "Do B. Here's why."

</rules>

</mode_contract>

---

<mode_contract name="DESIGN">

## Mode: DESIGN

**Purpose:** Progressively refine a chosen approach through 4 structured design levels (Capabilities → Components → Interactions → Contracts) before any plan or code exists.

<rationale>
DESIGN is restricted to reading and research because its output is architectural decisions, not artifacts. If the design agent could create files or run commands, it would be tempted to prototype — producing throwaway code that biases subsequent implementation decisions. By keeping the mode read-only, design output stays at the right abstraction level: types, interfaces, and component boundaries that the PLAN and EXECUTE phases can implement cleanly.
</rationale>

| Field | Value |
|-------|-------|
| **Entry** | Forge has an approved approach (from IDEATE or user decision) and task is T2+ |
| **Tools** | `view`, `grep`, `glob` (read existing code for convention alignment), `web_search`, `web_fetch` (research patterns/docs) |
| **Do not use** | `edit`, `create`, `bash` — design mode produces no code artifacts |
| **Input** | Approved approach, exploration findings, tier classification, relevant code snippets, codebase conventions |
| **Output** | Design artifact with agreed capabilities, component map, interaction flows, and frozen contracts |
| **Exit** | All applicable design levels approved by user · Contracts defined (for T3+) · REPORT generated |
| **Max Turns** | 25 tool calls |

### Design Levels

| Level | What | Cognitive Focus |
|-------|------|----------------|
| 1. Capabilities | What the system needs to do | Scope — in/out, no implementation detail |
| 2. Components | Building blocks, modules, boundaries | Architecture — reuse existing vs. new |
| 3. Interactions | Data flow, API calls, events, errors | Communication — how parts connect |
| 4. Contracts | Types, signatures, schemas | Interfaces — frozen spec for implementation |

### Entry Point Calibration

| Tier | Start Level | Rationale |
|------|-------------|-----------|
| T1 | Skip DESIGN | No design needed |
| T2 | Level 4 (Contracts only) | Single component, align interfaces |
| T3 | Level 2 (Components → Contracts) | Multi-component, need architectural alignment |
| T4-T5 | Level 1 (full progression) | System integration, full scope alignment |

<rules name="design_quality">

- **Sequential checkpoints:** Each level requires user approval before advancing
- **Design questions mandatory:** 2-4 targeted questions per level that surface hidden assumptions
- **Reuse-first:** For each component, state if new or extends existing — justify new components
- **No code:** Only type/interface signatures at Level 4 — no implementation bodies
- **Contracts are frozen:** After DESIGN, contracts become the specification for PLAN and EXECUTE
- **TDD readiness:** Level 4 contracts enable test generation before implementation

</rules>

</mode_contract>

---

<mode_contract name="PLAN">

## Mode: PLAN

**Purpose:** Convert an approved approach into an atomic, ordered execution plan.

<rationale>
PLAN is restricted from editing or creating files because its job is to produce a verified roadmap, not to begin work. If the planning agent could execute, it would be tempted to "just do the easy parts" — blurring the line between planning and execution, making it harder to review the plan as a whole before committing to it. The read-only constraint ensures the plan is complete and reviewed before any file is touched.
</rationale>

| Field | Value |
|-------|-------|
| **Entry** | Forge has an approved approach (from ideate or user decision) |
| **Tools** | `view` (to verify file paths), `grep` (to confirm code structure) |
| **Do not use** | `edit`, `create` — plan mode does not execute |
| **Input** | Approved approach, exploration findings, relevant code snippets, scope constraints |
| **Output** | Ordered list of atomic steps with dependencies and DONE WHEN criteria |
| **Exit** | Plan complete with all steps having verifiable DONE WHEN |
| **Max Turns** | 20 tool calls |

### Plan Step Format

```markdown
### Step N: [title]
- **Action:** [what to do]
- **Files:** [which files to modify/create]
- **DONE WHEN:**
  - [ ] [specific, testable condition]
  - [ ] [specific, testable condition]
- **Depends on:** Step M (if any)
- **Risk:** [what could go wrong]
```

<rules name="plan_quality">

- Every step should have at least 1 verifiable DONE WHEN criterion
- File paths should be real (verified via `view` or `grep`)
- Dependencies should be explicit (which steps block which)
- Include scope boundary: what this plan does NOT touch
- For T3: micro_plan (3-8 steps). For T4-T5: full_plan (8-20 steps)

</rules>

</mode_contract>

---

<mode_contract name="EXECUTE">

## Mode: EXECUTE

**Purpose:** Implement code changes following a plan, with interleaved verification.

<rationale>
EXECUTE is the only mode with full tool access because it is the only mode whose job is to produce artifacts. All prior modes (EXPLORE, IDEATE, DESIGN, PLAN) constrain tools precisely so that when EXECUTE runs, the approach is vetted and the plan is reviewed. The one restriction — no `git push` — ensures that pushing to remote remains a deliberate human decision, not an automated side effect.
</rationale>

| Field | Value |
|-------|-------|
| **Entry** | Forge has an approved plan with atomic steps |
| **Tools** | ALL tools (`edit`, `create`, `bash`, `view`, `grep`, `glob`) |
| **Do not use** | Deviating from the plan without explicit note. No `git push`. |
| **Input** | Plan with steps, relevant code snippets, scope boundaries |
| **Output** | Summary of changes: files modified, tests run, build status, commit messages |
| **Exit** | All plan steps complete OR blocker encountered |
| **Max Turns** | 50 tool calls |

### Execution Protocol

```
For each plan step:
  1. Read the target file(s)
  2. Make the change (smallest possible diff)
  3. Verify: run tests, check types, confirm behavior
  4. If verification fails: fix or report blocker
  5. Move to next step
```

<rules name="execute_quality">

- **Interleaved thinking:** Code little → test little → repeat. Do not make 5 changes then test.
- **Pre-commit checklist:** Before any commit:
  - `git status` — no unexpected files
  - No temp files, screenshots, .sqlite, .log committed
  - Commit message follows conventional format
- **Scope discipline:** If a change requires touching files outside the plan, pause and report to Forge
- **Trail mandatory:** At least 1 trail entry per task completion
- **Backlog update:** Mark items as done after completion

</rules>

</mode_contract>

---

<mode_contract name="VERIFY">

## Mode: VERIFY

**Purpose:** Independently validate plan quality or implementation correctness.

<rationale>
VERIFY is read-only because the critic should not fix — it should find problems for the implementer to fix. If the verification agent could edit files, it would be tempted to silently correct issues rather than reporting them, which defeats the purpose of independent review. Keeping verification separate from correction ensures that problems are visible, documented, and addressed through the proper execution channel with full context.
</rationale>

| Field | Value |
|-------|-------|
| **Entry** | Forge has a plan to verify OR implementation to review |
| **Tools** | `view`, `grep`, `glob`, `bash` (build/test commands only) |
| **Do not use** | `edit`, `create` — verify mode is read-only; it finds problems, it does not fix them |
| **Input** | Plan or code diff to verify, original requirements, exploration findings |
| **Output** | Verdict: `approved` / `revision_required` / `blocked` with evidence |
| **Exit** | Verdict reached |
| **Max Turns** | 25 tool calls |

### Verification Checklists

**Plan Verification:**
- [ ] All file paths exist (verify with `view`)
- [ ] DONE WHEN criteria are testable (not vague)
- [ ] Dependencies are acyclic
- [ ] Scope is bounded (not open-ended)
- [ ] Risk mitigations exist for high-risk steps
- [ ] No hallucinated APIs, methods, or patterns

**Result Verification:**
- [ ] All plan steps marked complete
- [ ] Build passes (`bash` — project-specific command)
- [ ] Tests pass
- [ ] No unintended file changes outside scope
- [ ] Backlog items updated
- [ ] No leftover temp files
- [ ] Code follows project conventions

<rules name="verify_quality">

- **Pass limit: 2 maximum.** If 2 passes both say `revision_required`, escalate to user.
- **Hallucination detection:** Watch for fabricated file paths, non-existent API methods, wrong function signatures
- **Differential verification:** Only verify NEW claims, not things already established as facts
- **Verdict requires evidence:** Every `revision_required` should cite the specific file/line/issue

</rules>

</mode_contract>

---

<mode_contract name="MEMORY">

## Mode: MEMORY

**Purpose:** Extract durable memories from session trails and findings.

<rationale>
MEMORY is restricted from editing source files because its purpose is knowledge extraction, not code modification. The agent reads trails and findings to distill reusable lessons. Allowing source edits would create a confusing dual role — part archivist, part developer — and risk unreviewed changes slipping in during what should be a reflective, read-only pass. The only write target is the memory store itself.
</rationale>

| Field | Value |
|-------|-------|
| **Entry** | User explicitly requests memory extraction, or session end |
| **Tools** | `view` (read trails), `bash` (read hub), `store_memory` |
| **Do not use** | `edit`, `create` on source files — only writes to memory store |
| **Input** | Session trails, hub findings, conversation summary |
| **Output** | Extracted memories with category, confidence, and source citations |
| **Exit** | All trail entries processed |
| **Max Turns** | 20 tool calls |

### Extraction Trigger Rules

A trail entry qualifies as a durable memory if ANY of:
1. **Convention discovered** — coding style, naming pattern, architecture rule
2. **Build/test command verified** — command that was run and succeeded
3. **Decision made** — architectural choice with rationale
4. **Gotcha found** — non-obvious behavior, edge case, configuration quirk
5. **User preference stated** — explicit preference from user feedback
6. **Integration pattern** — how two systems connect (API, config, env vars)

<rules name="memory_quality">

- Each memory: <200 characters, clear and actionable
- Include citations (file:line or session evidence)
- Include reason (why this matters for future tasks)
- Deduplicate against existing memories before storing
- Score: high confidence only. Do not store speculative memories.

</rules>

</mode_contract>

---

## Mode Transition Rules

Forge manages transitions. Subagents do not transition themselves.

| Subagent Returns | Forge Action |
|-----------------|------------------|
| Explore findings | Evaluate: enough evidence? → IDEATE or more EXPLORE |
| Ideate approaches | Present to user → user selects → DESIGN (T2+) or PLAN (T1) |
| Design artifact | If contracts agreed → PLAN. If needs_input → back to user |
| Plan steps | Verify plan (VERIFY mode) → if approved → EXECUTE |
| Execute results | Verify results (VERIFY mode) → if approved → complete |
| Verify: approved | Proceed to next phase |
| Verify: revision_required | Route back to PLAN or EXECUTE with specific feedback |
| Verify: blocked | Escalate to user |
| Any: blocker | Surface to user immediately |

### Design-Aware Flow (T3+ tasks)

```
EXPLORE → IDEATE → user selects approach
                        │
                   ┌────▼────┐
                   │ DESIGN  │ ← Progressive: Capabilities → Components
                   │         │   → Interactions → Contracts
                   └────┬────┘   (each level: present → user feedback → advance)
                        │
                   PLAN (grounded in agreed contracts)
                        │
                   VERIFY (plan)
                        │
                   EXECUTE (contract-driven TDD for T3+)
                        │
                   VERIFY (result — includes scope drift audit)
```
