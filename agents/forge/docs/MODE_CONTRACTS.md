# Mode Contracts — Forge Subagent Definitions

Each mode defines a **context package** that Forge injects into a `task` call to create a specialized subagent in a clean context window.

---

## Contract Schema

Every mode MUST define:

```
MODE: <name>
ENTRY:     When Forge invokes this mode
TOOLS:     Tools the subagent should use (behavioral, not enforced)
FORBIDDEN: Tools/actions the subagent must NOT do
INPUT:     What context Forge must provide
OUTPUT:    What the subagent must return
EXIT:      Conditions for the subagent to stop
MAX_TURNS: Maximum tool calls before forced return
```

---

## Mode: EXPLORE

**Purpose:** Investigate codebase, gather evidence, classify task complexity.

| Field | Value |
|-------|-------|
| **Entry** | Forge needs to understand code structure, find relevant files, classify task tier |
| **Tools** | `view`, `grep`, `glob`, `bash` (read-only commands), `web_search`, `web_fetch` |
| **Forbidden** | `edit`, `create` — explore mode is READ-ONLY |
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

### Quality Rules

- Every file read → produce a fact with confidence (high/medium/low)
- Confidence thresholds: high (>90% certain), medium (60-90%), low (<60%)
- NEVER fabricate file paths. If a path doesn't exist, say "not found"
- Classify tier using: complexity (0-10), risk (low/med/high/crit), ambiguity formula

---

## Mode: IDEATE

**Purpose:** Generate 2-3 meaningfully different approaches with tradeoffs.

| Field | Value |
|-------|-------|
| **Entry** | Forge has exploration findings and needs architectural direction |
| **Tools** | `web_search`, `web_fetch` (for docs/references), `view` (for reading spec docs) |
| **Forbidden** | `edit`, `create`, `bash` (no execution), `grep`/`glob` (no deep codebase search — use provided findings) |
| **Input** | Exploration findings, constraints, relevant code snippets, product context |
| **Output** | 2-3 approaches with: name, description, pros/cons, effort estimate, risk assessment, recommendation |
| **Exit** | Approaches generated with differentiation verified |
| **Max Turns** | 15 tool calls |

### Quality Rules

- **Mandatory contrarian:** At least 1 approach must be non-obvious (not the user's first instinct)
- **Differentiation check:** Approaches must differ in 2+ dimensions (not just "option A does X, option B does X differently")
- **Web search OK:** Can search for documentation, library comparisons, design patterns
- **Codebase search NOT OK:** Use the findings provided by Forge from the explore phase
- Lead with your recommendation: "Do B. Here's why."

---

## Mode: PLAN

**Purpose:** Convert an approved approach into an atomic, ordered execution plan.

| Field | Value |
|-------|-------|
| **Entry** | Forge has an approved approach (from ideate or user decision) |
| **Tools** | `view` (to verify file paths), `grep` (to confirm code structure) |
| **Forbidden** | `edit`, `create` — plan mode does NOT execute |
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

### Quality Rules

- Every step must have at least 1 verifiable DONE WHEN criterion
- File paths must be real (verified via `view` or `grep`)
- Dependencies must be explicit (which steps block which)
- Include scope boundary: what this plan does NOT touch
- For T3: micro_plan (3-8 steps). For T4-T5: full_plan (8-20 steps)

---

## Mode: EXECUTE

**Purpose:** Implement code changes following a plan, with interleaved verification.

| Field | Value |
|-------|-------|
| **Entry** | Forge has an approved plan with atomic steps |
| **Tools** | ALL tools (`edit`, `create`, `bash`, `view`, `grep`, `glob`) |
| **Forbidden** | Deviating from the plan without explicit note. No `git push`. |
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

### Quality Rules

- **Interleaved thinking:** Code little → test little → repeat. Never make 5 changes then test.
- **Pre-commit checklist:** Before any commit:
  - `git status` — no unexpected files
  - No temp files, screenshots, .sqlite, .log committed
  - Commit message follows conventional format
- **Scope discipline:** If a change requires touching files outside the plan, STOP and report
- **Trail mandatory:** At least 1 trail entry per task completion
- **Backlog update:** Mark items as done after completion

---

## Mode: VERIFY

**Purpose:** Independently validate plan quality or implementation correctness.

| Field | Value |
|-------|-------|
| **Entry** | Forge has a plan to verify OR implementation to review |
| **Tools** | `view`, `grep`, `glob`, `bash` (build/test commands only) |
| **Forbidden** | `edit`, `create` — verify mode is READ-ONLY. No fixes. |
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

### Quality Rules

- **Pass limit: 2 maximum.** If 2 passes both say `revision_required`, escalate to user.
- **Hallucination detection:** Watch for fabricated file paths, non-existent API methods, wrong function signatures
- **Differential verification:** Only verify NEW claims, not things already established as facts
- **Verdict must have evidence:** Every `revision_required` must cite the specific file/line/issue

---

## Mode: MEMORY

**Purpose:** Extract durable memories from session trails and findings.

| Field | Value |
|-------|-------|
| **Entry** | User explicitly requests memory extraction, or session end |
| **Tools** | `view` (read trails), `bash` (read hub), `store_memory` |
| **Forbidden** | `edit`, `create` on source files — only writes to memory store |
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

### Quality Rules

- Each memory: <200 characters, clear and actionable
- Must include citations (file:line or session evidence)
- Must include reason (why this matters for future tasks)
- Deduplicate against existing memories before storing
- Score: high confidence only. Do NOT store speculative memories.

---

## Mode Transition Rules

Forge manages transitions. Subagents do NOT transition themselves.

| Subagent Returns | Forge Action |
|-----------------|------------------|
| Explore findings | Evaluate: enough evidence? → IDEATE or more EXPLORE |
| Ideate approaches | Present to user → user selects → PLAN |
| Plan steps | Verify plan (VERIFY mode) → if approved → EXECUTE |
| Execute results | Verify results (VERIFY mode) → if approved → complete |
| Verify: approved | Proceed to next phase |
| Verify: revision_required | Route back to PLAN or EXECUTE with specific feedback |
| Verify: blocked | Escalate to user |
| Any: blocker | Surface to user immediately |
