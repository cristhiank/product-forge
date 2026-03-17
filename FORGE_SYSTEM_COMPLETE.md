# FORGE AGENT SYSTEM — COMPLETE ARCHITECTURE & WORKFLOW

## EXECUTIVE SUMMARY

**Forge** is a sophisticated multi-agent dispatch coordinator system that operationalizes the **Why Loop / How Loop paradigm** from Martin Fowler's "Humans and Agents" research. It separates strategic decision-making (coordinator) from tactical execution (specialized subagents), ensuring humans control *intent* while agents handle *implementation*.

The system has two primary implementations:
- **Forge (Claude-based)** — optimized for Opus-class models
- **Forge-GPT** — optimized for GPT models

Both follow identical conceptual patterns but with model-specific tuning.

---

## 1. FOUNDATIONAL CONCEPTS

### The Why Loop / How Loop Boundary

```
┌─────────────────────────────────────────┐
│ COORDINATOR (Why Loop)                  │
│ ─ Translates user intent to outcomes    │
│ ─ Decides what success looks like       │
│ ─ Evaluates if outcome matches intent   │
│ ─ Improves the harness, not the artifact│
└─────────────────────────────────────────┘
         ↓ Dispatch ↓
┌─────────────────────────────────────────┐
│ SUBAGENTS (How Loop)                    │
│ ─ Produce intermediate artifacts        │
│ ─ Follow the agreed harness             │
│ ─ Operate in clean context windows      │
└─────────────────────────────────────────┘
```

**Key Insight**: When output is unsatisfying, improve the *harness that produced it*, not just the artifact or retry. The harness includes:
- Mode files (behavioral rules per phase)
- Quality gates (checkpoints and verification criteria)
- Engineering preferences (coding conventions)
- Mission Brief templates (context packaging)
- Coordinator routing logic (how tasks are classified)

### Dispatch is Doing

**CRITICAL RULE**: The coordinator **constructs Mission Briefs and dispatches via task() or workers**. It NEVER:
- Edits files directly
- Runs build/test commands
- Creates files
- Implements code

Everything that touches source code or requires testing goes through a subagent dispatch.

### Tool Permissions (Coordinator vs Subagent vs Worker)

| Tool | Coordinator | Subagent | Worker |
|------|:-:|:-:|:-:|
| **task()** | ✅ Single dispatch | ❌ Cannot nest | ✅ Can nest |
| **copilot-cli-skill** | ✅ Parallel dispatch | ❌ — | ❌ — |
| **skill()** | ✅ | ✅ | ✅ |
| **view/grep/glob** | ✅ Read context | ✅ Full | ✅ Full |
| **bash** (git, CLI) | ✅ Read + bookkeep | ✅ Full | ✅ Full |
| **bash** (build/test) | ❌ Delegate | ✅ Full | ✅ Full |
| **edit/create** | ❌ Delegate | ✅ Full | ✅ Full |

---

## 2. DISPATCH ROUTING DECISION

Before dispatching, the coordinator evaluates:

```
Dispatch Decision:
├── 0 files → Answer inline (T1_ANSWER lane)
├── 1-2 items OR overlapping files → task() subagent
└── 3+ independent items in different files → copilot-cli-skill workers
```

**Why this matters**:
- A `task()` subagent cannot call `task()` — limited to direct tool use
- A `copilot-cli-skill` worker is a full Copilot instance: loads skills, calls task(), runs cycles, operates in isolated git worktree
- For parallel multi-item work, workers are the correct mechanism

---

## 3. COORDINATOR ROUTING (Intent Classification)

### The Three Lanes

Every coordinator turn operates in exactly ONE lane. The lane determines permitted actions:

| Lane | Trigger | Action |
|------|---------|--------|
| **T1_ANSWER** | Quick factual answer, 0 files touched | Answer directly. No dispatch. |
| **DISPATCH** | Work requiring file changes, builds, tests, or analysis | Classify → Build Mission Brief → task() or workers |
| **BLOCKED** | Missing info, ambiguous scope, conflicting constraints | Ask 1-3 clarifying questions. No dispatch. No edits. |

### Intent Classification Rules (from SKILL.md)

When a user message arrives, classify and route to:

1. **T1: Quick Answer** (answer inline, no delegation)
   - Factual questions: "what is", "explain", "how does X work"
   - Pure knowledge: no codebase investigation, no file changes

2. **Experts Council**
   - Multi-model parallel review via experts-council skill
   - Triggers: "ask the experts", "multi-model", "get perspectives"

3. **Backlog Navigation**
   - Load backlog skill
   - Triggers: "what's next", "show tasks", "priorities"

4. **Product (DISCOVER / DESIGN / VALIDATE / Health)**
   - Dispatch forge-product subagent
   - Triggers: product discovery, feature specs, positioning, GTM, feature health

5. **Explore (lookup)** — Built-in agent, no skill, simple file/symbol search
   - Triggers: "where is", "find [symbol]", "what file has"
   - Use when: single file lookup, <3 search calls

6. **Explore (investigate)** — general-purpose + forge-explore skill, structured REPORT
   - Triggers: "investigate", "understand", "scan", "classify complexity"
   - Use when: multi-file analysis, tier classification, external search

7. **Assess (CEO Quality Gate)**
   - Delegate to forge-assess subagent
   - Triggers: "challenge this", "CEO review", "is this the right problem"
   - AUTO-CHAINED: after IDEATE for T3+ tasks
   - T3 (moderate): Light gate — 3 outputs
   - T4-T5 (complex): Deep gate — 7 outputs with JTBD skill

8. **Ideate**
   - Delegate to ideate subagent
   - Triggers: "explore options", "approaches", "architecture decision"
   - Generates 2-3 differentiated approaches with tradeoffs

9. **Design (Progressive Refinement)**
   - Delegate to design subagent
   - Triggers: "design", "whiteboard", "define contracts"
   - CHAINED before PLAN/EXECUTE for T3+ tasks
   - Entry calibration:
     - T2: Level 4 only (Contracts)
     - T3: Level 2→4 (Components, Interactions, Contracts)
     - T4-T5: Level 1→4 (full progression)

10. **Plan**
    - Delegate to plan subagent
    - Triggers: "create plan", "break down", "decompose"
    - DESIGN GUARD: if T3+ and no ASSESS/DESIGN completed, auto-chain them first
    - VERIFY GATE: after PLAN completes for T3+, dispatch forge-verify for plan verification

11. **Dispatch (Implementation)**
    - Route via dispatch decision (task() vs workers)
    - Triggers: "implement", "fix", "proceed", "keep going"
    - DESIGN GUARD: same rule as PLAN
    - YOUR ACTION: Build Mission Brief → dispatch
    - NOT YOUR ACTION: edit, create, run builds

12. **Verify**
    - Delegate to verify subagent
    - Triggers: "review", "check", "verify", "audit"
    - Can escalate to experts-council for delta review

13. **Memory**
    - Delegate to memory subagent (user request only)
    - Triggers: "extract memories", "save learnings"

14. **Retrospective**
    - Delegate to forge-retrospective subagent
    - Triggers: "retrospective", "what went wrong", "improve harness"
    - Auto-suggest: after VERIFY returns revision_required

15. **GC (Codebase Health)**
    - Delegate to forge-gc subagent
    - Triggers: "run gc", "scan for debt", "check health"
    - Auto-suggest: after 10+ successful runs since last GC

16. **Ambiguous**
    - Ask 1-3 focused clarifying questions
    - Triggers: scope unclear, multiple valid interpretations

---

## 4. MISSION BRIEF STRUCTURE

Every dispatch includes a Mission Brief that packages context for the subagent:

```xml
<mission_brief>
  <run_id>[stable ID for logical run]</run_id>
  <role>[SCOUT|EXECUTOR|VERIFIER|PLANNER|CREATIVE|ARCHIVIST]</role>
  <complexity>[simple|moderate|complex-ambiguous]</complexity>
  <reasoning_budget>[minimal|standard|deep]</reasoning_budget>

  <desired_outcome>
    [What success looks like from user perspective — the why loop answer]
  </desired_outcome>

  <objective>
    [1-3 concise sentences — what the subagent should do]
  </objective>

  <context>
    <findings>[summarized evidence only — no raw conversation]</findings>
    <decisions>[approved design choices or none]</decisions>
    <files_of_interest>[specific files/symbols or none]</files_of_interest>
  </context>

  <constraints>
    <scope>[what is in scope]</scope>
    <out_of_scope>[what must not be touched]</out_of_scope>
    <risk>[R0-R4 classification and reason]</risk>
  </constraints>

  <verify_requirements>
    <must_pass>[what evidence is required before completion]</must_pass>
  </verify_requirements>
</mission_brief>
```

**Line 1 requirement**: Every dispatch must load the selected mode skill:
```
Invoke the `<target-mode-skill>` skill as your first action.
```

---

## 5. THE 11 MODE PHASES

### PHASE 1: EXPLORE (Scout)

**When**: Codebase investigation needed before design/implementation

**Modes**: 
- `forge-explore` (Forge/Opus)
- `forge-explore-gpt` (Forge-GPT)

**Responsibilities**:
- Read-only investigation of codebase
- Gather evidence-backed findings with confidence levels (high/medium/low)
- Classify task complexity using three axes:
  ```
  complexity (0-10) + risk (low/med/high/crit) + ambiguity (0-1)
  ambiguity = 1 - (high_confidence_facts / total_relevant_facts)
  ```
- Surface existing solutions (reusable code already in the codebase)
- Pre-investigation audit for T3+: git log, TODO/FIXME scan, stash check

**Output**:
- Tier classification if requested
- Findings with file:line citations and confidence levels
- Existing solutions that can be reused
- Risk factors and unknowns

**Constraints**:
- Read-only (no edits, no builds, no tests)
- Stay within tool-call budget per complexity
- Stop when objective is answerable

---

### PHASE 2: ASSESS (CEO Quality Gate)

**When**: Challenge premises before investing in design

**Modes**:
- `forge-assess` (Forge/Opus)
- `forge-assess-gpt` (Forge-GPT)

**Responsibilities** (vary by complexity):

**Light Gate (T3 / Moderate)**:
1. **Premise Check** — Is this the right problem? What's the actual user outcome? What happens if we do nothing?
2. **Existing Code Leverage** — Map every sub-problem to existing code
3. **NOT in Scope** — List deferred work with rationale

**Deep Gate (T4-T5 / Complex)**:
1. **Premise Challenge** — Full investigation with evidence
2. **Dream State Delta** — Map trajectory: CURRENT → THIS CHANGE → 12-MONTH IDEAL
3. **JTBD Validation** — Invoke jobs-to-be-done skill for framework grounding
4. **Scope Mode Selection** — Recommend EXPAND, HOLD, or REDUCE
5. **Delight Opportunities** — 3-5 adjacent improvements
6. **NOT in Scope** — Thorough deferred list
7. **Existing Code Leverage** — With file:line references

**Output**:
- Structured findings that coordinator can present interactively
- Recommendation on scope mode
- Risk assessment

**Constraints**:
- Read-only (no edits, no designs, no plans)
- For complex: MUST invoke jobs-to-be-done skill

---

### PHASE 3: IDEATE (Creative)

**When**: Generate differentiated approaches with tradeoffs

**Modes**:
- `forge-ideate` (Forge/Opus)
- `forge-ideate-gpt` (Forge-GPT)

**Responsibilities**:
- Generate 2-3 meaningfully different approaches
- MUST include at least one contrarian option (non-obvious)
- MUST verify approaches differ in 2+ dimensions:
  - Architecture (stateful vs stateless, sync vs async)
  - Technology (SQL vs NoSQL, framework vs vanilla)
  - Complexity (T1-T2 vs T3 vs T4+)
  - Risk (low, medium, high)
  - User flow (steps, auth factors, interaction pattern)
  - Dependencies (external services, libraries)

**Approach Structure** (for each):
- **Summary**: One sentence
- **How it works**: Steps with evidence references
- **Pros/Cons**: With evidence if applicable
- **Risk**: Low | Medium | High
- **Effort**: Low | Medium | High
- **Design Questions**: 1-2 questions that surface hidden assumptions

**Complexity Calibration**:
- **Simple**: 1 recommended approach (skip contrarian if obvious)
- **Moderate**: 2-3 approaches with differentiation
- **Complex-ambiguous**: 3 approaches with deep tradeoff analysis

**Output**:
- Approaches with comparison matrix (required for T2+)
- Differentiation check showing 2+ dimensions
- Design questions per approach
- Directive recommendation with rationale
- Next action

**Constraints**:
- MUST NOT implement
- MUST NOT search codebase (use mission findings only)
- Maximum 3 approaches

---

### PHASE 4: DESIGN (Architect)

**When**: Progressively refine approach through structured levels

**Modes**:
- `forge-design` (Forge/Opus)
- `forge-design-gpt` (Forge-GPT)

**Four Design Levels** (each is a checkpoint):

**Level 1: Capabilities**
- Scope + constraints alignment
- Core requirements with concrete descriptions
- Quality constraints (throughput, latency, availability, data volume, concurrency)
- Explicitly unconstrained, out of scope, assumptions
- Design questions about scope and constraints

**Level 2: Components**
- Domain model (entities, boundaries, invariants)
- Component map with responsibilities
- Reuse-first: new vs existing for each component
- Key design decisions with rationale
- Trust boundaries (when handling untrusted input)
- Design questions about boundaries and reuse

**Level 3: Interactions**
- Primary flow (happy path)
- Data flow diagram
- **Failure Modes** (REQUIRED for T3+): one per external dependency
  - What fails, how detected, how responded, how system degrades
- Integration points (component-to-component communication)
- State machines (entity lifecycles)
- Consistency model (strong vs eventual)
- Error & Rescue Registry (T3+): error types, handling, user-visible outcome
- Design questions about flows and degradation

**Level 4: Contracts**
- Domain types (interfaces, enums)
- Public API (function signatures, no bodies)
- Event contracts (when event-driven)
- Schema changes (SQL)
- Migration notes (for breaking changes)
- Contract decisions with rationale
- Design questions about naming and compatibility

**Entry Points by Tier**:
- T1: Skip design entirely
- T2 (3-4): Level 4 only (Contracts)
- T3 (5-6): Level 2→4 (Components, Interactions, Contracts)
- T4-T5 (7+): Level 1→4 (full progression)

**Design Review Artifacts** (T3+ with 3+ components):
- MANDATORY: Generate HTML design review artifact (real file on disk, not terminal text)
- Structured JSON intermediate (never write Mermaid directly)
- Tabs for Overview, Architecture, Flows, Decisions, Questions
- Anchor IDs for precise feedback
- Hand-drawn theme by default (signals "draft, critique please")
- Refresh browser for updates

**Output**:
- Design artifact through applicable levels
- Visual aids (component box, layer stack, sequence flow, state machine)
- Design decisions log with rationale
- Skipped levels with reasons
- Open questions requiring user input
- TDD readiness assessment
- HTML artifact written to disk

**Constraints**:
- MUST NOT write implementation code (signatures only)
- MUST NOT advance past approved level
- MUST include failure modes for T3+ external dependencies
- MUST include Error & Rescue Registry for T3+
- MUST write HTML artifact to disk for T3+ with 3+ components (verify file exists)

**Downstream Integration**:
- PLAN receives: component list, interaction flows, contracts
- EXECUTE receives: frozen contracts → writes tests first (Contract-Driven TDD)
- VERIFY uses contracts as baseline

---

### PHASE 5: PLAN (Orchestrator)

**When**: Convert approved approach into atomic execution plan

**Modes**:
- `forge-plan` (Forge/Opus)
- `forge-plan-gpt` (Forge-GPT)

**Responsibilities**:
1. Scope check first:
   - What existing code partially/fully solves each sub-problem?
   - What is minimum set of changes?
   - Flag deferrable work
   - If >8 files or >2 new classes → flag scope concern

2. Decompose into atomic steps with dependencies:
   - T3: 3-8 steps
   - T4-T5: 5-15 steps with DAG dependencies

3. Define DONE WHEN for each step:
   - Concrete, testable, verifiable
   - NOT vague ("it works" is WRONG)
   - Template: `[Action verb] + [specific output/behavior] + [success condition]`

4. Link to evidence (file:line references)

5. Risk analysis:
   - T3: 1-3 risks, mitigations optional
   - T4-T5: 3-5 risks with severity + mitigation

6. Create sections:
   - **Plan table**: steps with dependencies and DONE WHEN
   - **What already exists**: reusable code/patterns
   - **NOT in scope**: deferred work
   - **Risks**: with severity and mitigation
   - **Assumptions**: listed and verified/flagged (T4-T5)
   - **Test Coverage Map**: codepaths mapped to test types (T3+)
   - **Observability**: health and failure signals (T3+)
   - **Deploy & Rollout**: migration safety, feature flags, rollout order (T3+)

**Complexity Calibration**:
- **Simple**: 2-5 steps, minimal dependencies, terse DONE WHEN
- **Moderate**: 3-8 steps, explicit dependencies and risk
- **Complex**: 8-20 steps, full dependency graph, risk mitigations

**Output**:
- Plan steps with verified file paths
- Dependency analysis
- What already exists
- What is NOT in scope
- Risk analysis with mitigations
- Assumptions
- Test coverage map
- Observability section
- Deploy & rollout plan

**Constraints**:
- MUST NOT start implementation
- MUST NOT edit files
- Every step MUST have concrete, testable DONE WHEN
- File paths MUST be verified (not assumed)
- Dependencies MUST be explicit and acyclic

---

### PHASE 6: VERIFY (Critic)

**When**: Independently validate plan or implementation

**Modes**:
- `forge-verify` (Forge/Opus)
- `forge-verify-gpt` (Forge-GPT)

**Two Modes**:

**Plan Verification**:
- File references exist and paths are correct
- Functions/APIs exist and signatures match usage
- Dependencies exist in manifest
- No hardcoded secrets
- Auth/authz properly handled
- Changes fit existing patterns
- Steps are atomic and reversible
- DONE WHEN criteria are testable
- Failure modes covered

**Result Verification** (Plan or Implementation):
- Completeness: all planned files modified/created, all steps executed
- Correctness: changes match plan intent, code compiles/parses
- Tests: build passes, existing tests pass, new tests added
- Regressions: related functionality unaffected
- Scope Drift Audit (T3+):
  - No unplanned files
  - No unplanned functions/classes/modules
  - No new dependencies without justification
  - No unrequested features (rate limiting, caching, analytics beyond spec)
  - No unnecessary abstraction layers
  - Line count sanity: implementation ≤ 1.5x expected
- Contract Conformance: matches design spec exactly
- Code Safety (T3+): CRITICAL (data safety, race conditions, LLM trust boundary) and INFORMATIONAL checks
- Deploy Readiness (T3+): migrations backward-compatible, feature flags, rollback plan

**Verdict Criteria**:
- **approved**: ≥90% checks passed, 0 blockers
- **revision_required**: 70-90% passed, issues have fix guidance
- **blocked**: <70% passed or any blocker

**Pass Limit**:
- Maximum 2 passes
- Pass 1: Full checklist
- Pass 2: Only unresolved items from pass 1
- After pass 2: Escalate with options

**Output**:
- Checklist results (passed/failed counts)
- Issues in critique format (location, expected, actual, fix direction)
- Verdict with evidence-backed rationale
- Next action

**Constraints**:
- Read-only (no edits, no file creation)
- Must stay within 2-pass limit
- No re-verification of trusted facts
- Must verify only components directly affected

---

### PHASE 7: EXECUTE (Builder)

**When**: Implement code changes following a plan

**Modes**:
- `forge-execute` (Forge/Opus)
- `forge-execute-gpt` (Forge-GPT)

**Responsibilities**:
1. Read the plan exactly
2. Code little → test little → repeat
   - T1-T2: 20-30 lines per cycle
   - T3: 10-20 lines per cycle
   - T4-T5: 10-15 lines per cycle (draft-then-apply for shared interfaces)

3. Use Think-Act-Verify loop:
   - **Think**: What am I changing, why? (reference plan step, check recent reverts)
   - **Act**: Edit 10-20 lines max
   - **Verify**: Diagnostics or build check
   - **Adjust**: Fix issues before continuing

4. Verification cadence:
   - After every edit: Diagnostics check (ide-get_diagnostics or build)
   - After every 20 lines: Diagnostics + review
   - After logical unit: Build
   - After step complete: Tests
   - All steps done: Full test suite

5. Contract-Driven TDD (T3+ with design contracts):
   - Read frozen contracts
   - Write test skeletons from contract signatures
   - Verify tests fail (no implementation yet)
   - Implement code to make tests pass
   - Verify all tests pass

6. Pre-commit checklist:
   - `git status` — check all files
   - Remove: screenshots, temp scripts, analysis docs, .sqlite, build artifacts
   - Stage specific files (`git add <files>`)
   - Temp files → `temp/` only

7. Scope discipline:
   - MUST stay inside objective, scope, out_of_scope from Mission Brief
   - MUST NOT add features, utilities, or abstractions not in Brief
   - If something new is needed → use `[needs_input: ...]` marker instead of implementing

8. Backlog bookkeeping:
   - Load `backlog` skill if available
   - Task start: `node <skill-dir>/scripts/index.js move <id> working`
   - Task complete: `node <skill-dir>/scripts/index.js complete <id>`
   - Follow-up discovered: `node <skill-dir>/scripts/index.js add <project> <kind> "<title>"`

9. Trail logging (at least 1 per task):
   - Design decision made → Always
   - Bug fix with root cause → Always
   - Reusable pattern found → If notable
   - Scope changed → Always

**Complexity Calibration**:
- **Simple**: Implement directly, verify once at end
- **Moderate**: Follow standard loop, verify after each unit
- **Complex**: Extra caution — read broadly, verify after every edit

**Output**:
- Completed steps with file references
- Files changed (created/modified)
- Verification results (build/test outcomes)
- Backlog updates and trails logged
- Next action

**Constraints**:
- MUST NOT implement beyond the plan
- MUST update backlog and log at least 1 trail
- MUST run build + tests before completion
- Max 2 self-fix attempts on same blocker

---

### PHASE 8: RETROSPECTIVE (Analyst)

**When**: Analyze failures and propose harness improvements

**Modes**:
- `forge-retrospective` (Forge/Opus)
- `forge-retrospective-gpt` (Forge-GPT)

**Responsibilities**:
1. Gather context: Mission Brief, verification verdict, artifacts
2. Query forge-harness metrics for run and history
3. Classify root cause (exactly ONE primary):
   - `inadequate_constraint`: Mode file should have prevented it
   - `missing_context`: Available info not packaged
   - `wrong_tier`: Task misscoped for complexity
   - `insufficient_gate`: Gate existed but missed issue
   - `template_gap`: Brief template missing field
   - `ambiguous_brief`: Multiple valid interpretations

4. Propose concrete, minimal patches (max 5):
   - **Target**: exact file path
   - **What**: specific change (addition/modification/removal)
   - **Why**: how this prevents recurrence
   - **Risk**: low/medium/high — what else this affects
   - **Evidence**: specific failure evidence

5. Assess risk for each patch
6. Log retrospective as metric

**Output**:
- Failure summary (what happened, expected)
- Root cause classification with evidence
- Metrics context (historical patterns, recent changes)
- Proposed patches ordered by impact

**Constraints**:
- Read-only (propose patches, don't edit)
- Max 5 patches per retrospective
- Every patch must reference specific failure evidence
- Consider downstream effects

---

### PHASE 9: MEMORY (Archivist)

**When**: Extract durable memories from session trails (USER REQUEST ONLY)

**Modes**:
- `forge-memory` (Forge/Opus)
- `forge-memory-gpt` (Forge-GPT)

**Responsibilities**:
1. Process trail entries against extraction triggers:
   - Convention discovered
   - Build/test command verified
   - Decision made
   - Gotcha found
   - User preference stated
   - Integration pattern
   - Bug fix with root cause
   - Reusable pattern found
   - Session retrospective

2. Filter candidates using quality criteria:
   - <200 characters
   - Cited (file:line or evidence)
   - Reasoned (why matters)
   - Durable (remains relevant if code not merged)
   - Non-secret

3. Score and deduplicate:
   ```
   Base: User pref (0.95) | Bug fix (0.90) | Decision (0.85)
   | Build cmd (0.80) | Pattern (0.80) | Convention (0.85)
   | Gotcha (0.70) | Integration (0.75)
   
   Modifiers: Has evidence refs (×1.0) | No refs (×0.8)
   | Cross-session pattern (×1.1) | Old >90d (×0.7)
   
   Threshold: Score ≥0.5 → extract
   ```

4. Check duplicates against existing memories
5. Store via `store_memory` tool

6. Propose harness improvements if triggered:
   - Preference pattern: 3+ memories → engineering-preferences.md
   - Missing constraint: recurring mistake → mode file rule
   - Template gap: missing context → Mission Brief template

**Output**:
- Extracted memories with confidence and citations
- Skipped items with reasoning
- Cross-session patterns
- Harness evolution proposals

**Constraints**:
- Run on explicit user request ONLY
- No speculation (high confidence only)
- Deduplicate before storing
- Check existing memories first

---

### PHASE 10: GC (Janitor)

**When**: Scan codebase for debt, stale docs, dead code, entropy

**Modes**:
- `forge-gc` (Forge/Opus)
- `forge-gc-gpt` (Forge-GPT)

**Responsibilities**:
1. Run deterministic scans via forge-harness:
   - `debt`: TODO, FIXME, HACK, XXX, WORKAROUND, TEMP comments
   - `stale-docs`: README broken refs, dead links
   - `dead-exports`: Unused named exports
   - `architectural`: Pattern violations, circular deps (LLM analysis for complex)

2. Analyze findings:
   - Group related items
   - Assess impact of stale docs
   - Evaluate dead exports (truly dead vs external consumers)
   - Check architectural violations

3. Prioritize:
   - **Critical**: actively misleading docs, broken refs users would hit
   - **Warning**: debt accumulation, unused code, stale patterns
   - **Info**: cosmetic debt, low-impact cleanup

4. Propose backlog items (atomic, single-session completable)
5. Log scan as metric

**Complexity Calibration**:
- **Simple**: Debt only, focused directory, 0-3 proposals
- **Moderate**: All scans, full project, 3-7 proposals
- **Complex**: All scans + architectural analysis, 5-15 proposals

**Output**:
- Health report (scan date, scope, finding count)
- Findings by priority (critical/warning/info)
- Proposed backlog items
- Metrics logged

**Constraints**:
- Read-only (report and propose)
- Use forge-harness for deterministic scans first
- Separate deterministic (high) from LLM (medium) confidence
- Group related findings, don't list every TODO individually

---

### PHASE 11: PRODUCT (PM)

**When**: Manage product artifacts (specs, discovery, validation, implementation handoff)

**Modes**:
- `forge-product` (Forge/Opus)
- `forge-product-gpt` (Forge-GPT)

**Phases**:

**DISCOVER**:
- Load `jobs-to-be-done` skill
- Read existing customer docs
- Apply JTBD framework:
  - Job statement: "When [situation], I want [motivation], so I can [outcome]"
  - Forces: Push (pain), Pull (future), Anxiety (fear), Habit (inertia)
  - Non-obvious competition (what else are they hiring?)
- Write findings to `.product/customers/`:
  - ICP.md — ideal customer profile
  - JTBD.md — job statements and forces
  - SEGMENTS.md — segments with switching triggers
- Each doc: evidence source, confidence level, implications

**DESIGN**:
- Load `made-to-stick`, `copywriting` skills
- Read context and validate discovery
- **Discovery handoff check**: If `.product/customers/` exists, reference existing JTBD — don't invent
- Create feature spec with sections:
  - Job to be Done (reference existing JTBD)
  - Problem Statement (simple + concrete)
  - Proposed Solution (MUST/SHOULD/MAY requirements)
  - User Stories (at least one, trace to success metrics)
  - Success Metrics (measurable, target value, timeframe)
  - Out of Scope (at least one item)
  - Open Questions (unresolved with owner)

- **Self-review pass** (mandatory for T2+):
  - Anti-pattern checklist: vague requirements, unmeasurable metrics, assumptions-as-reqs, technical hand-waving, gold plating, missing personas, orphaned refs, contradictions
  - Made-to-Stick SUCCESs check: Simple, Unexpected, Concrete, Credible, Emotional, Story
  - Classify findings: Critical (blocks impl) | Important (causes rework) | Suggestion
  - Max 2 iterations before escalating

- **Structural gate**:
  - Required headings present: Job to be Done, Problem Statement, Proposed Solution, User Stories, Success Metrics, Out of Scope
  - No TBD, TODO, PLACEHOLDER, PRODUCT-GAP- tokens
  - Only Suggestion-level findings remain

**VALIDATE**:
- Read feature spec
- Design validation approach: Prototype, User interview, A/B test, Concierge
- Ensure hypothesis is falsifiable: "If we do X, metric Y will change by Z%"
- Include measurable success/failure criteria with thresholds
- Create experiment

**BRIDGE**:
- Translate product spec into implementation scope
- Define acceptance criteria (testable conditions)
- Assign priority and recommended tier
- Ready for planning phase

**Tools**:
- Use product-hub CLI (never edit .product/ files directly):
  - `$PHUB meta` — check if .product/ exists
  - `$PHUB init` — initialize
  - `$PHUB health` — run health check
  - `$PHUB feature create F-XXX "Title" "Desc"`
  - `$PHUB feature transition F-XXX defined`
  - `$PHUB list --type customer` — read customer docs

**Health Checks**:
- Stale docs (>30 days without update)
- Missing required fields
- Orphaned features (planned/building with no epic_id)
- Draft vs active counts

**Output**:
- Product artifacts (specs, discovery docs, health reports)
- Spec quality metrics (TBD count, anti-pattern check)
- Feature status transitions
- Bridge actions (backlog epics, experiments)
- Next action

**Constraints**:
- MUST NOT edit source code (product mode, not execute)
- MUST use $PHUB CLI for all .product/ operations
- MUST include anti-pattern review for specs
- MUST define NOT in scope for specs
- MUST verify discovery before spec (or return needs_input)

---

## 6. PHASE SEQUENCING & GUARDS

### Standard Flow for Tasks

```
Task arrives
  ↓
EXPLORE (if context insufficient)
  ↓
ASSESS (T3+ only, challenge premises)
  ↓ [INTERACTIVE: present findings, collect decisions]
  ↓
IDEATE (generate approaches)
  ↓ [User selects approach]
  ↓
DESIGN (T3+ only, refine progressively through levels)
  ↓ [User approves design]
  ↓
PLAN (convert approach to atomic steps)
  ↓
VERIFY (verify plan — T3+ only)
  ↓ [If revision_required, dispatch revised phase]
  ↓
EXECUTE (implement the plan)
  ↓
VERIFY (verify implementation)
  ↓ [If revision_required, dispatch RETROSPECTIVE]
```

### Design Guard

**CRITICAL**: For T3+ tasks, ASSESS and DESIGN are **mandatory** before PLAN or EXECUTE — regardless of how the user phrases the request.

- User says "plan it" or "implement it" for T3+ → auto-chain ASSESS → DESIGN first
- After ASSESS: present findings interactively, collect decisions
- After DESIGN: chain to PLAN or EXECUTE in same turn
- After PLAN (T3+): dispatch VERIFY for plan verification before EXECUTE

**Skip conditions**:
- Task is T1-T2
- ASSESS/DESIGN already completed this session
- User explicitly says "skip assess" / "skip design"

### Verify Gate

**PLAN VERIFY GATE (T3+)**: After PLAN completes for T3+ tasks, dispatch forge-verify for plan verification before proceeding to EXECUTE.

---

## 7. POST-DISPATCH EVALUATION

After `task()` returns, coordinator evaluates in this order:

### Expected Evidence by Role

| Role | Expected Evidence |
|------|-------------------|
| `SCOUT` | Findings with file:line refs and confidence |
| `EXECUTOR` | File changes + build, test, or diagnostic evidence |
| `VERIFIER` | Verdict with file:line defect citations |
| `PLANNER` | Steps with verifiable DONE WHEN criteria |
| `CREATIVE` | Approaches with tradeoffs or design artifact |
| `ARCHIVIST` | Stored memory candidates with confidence |

### Evaluation Checklist

1. **Objective match** — Does output address Mission Brief objective?
2. **Evidence check** — Confirm expected evidence is present
3. **Outcome classification**:
   - **Complete**: summarize, bookkeep, bridge, stop
   - **Complete + more phases remain**: dispatch next in same turn if no user input needed
   - **Partial**: acknowledge progress, dispatch targeted follow-up if safe
   - **Needs input**: switch to BLOCKED, ask focused question
   - **Failed**: retry once if clearly recoverable; otherwise surface failure
   - **Blocked**: surface the blocker

4. **Scope and risk check** — Surface scope drift or security concerns
5. **Deviation check** — Review `DEVIATIONS:` in output, capture in `forge_deviations`
6. **Correction check** — Review `CORRECTION:` statements, verify final output reflects correction

### Closing Markers

Subagents end output with internal markers (stripped before user sees):
```
[done]  or  [blocked: reason]  or  [needs_input: question]
DEVIATIONS: any departures from Mission Brief, or omit if none
UNKNOWNS: unresolved facts, or omit if none
REMAINING RISKS: high-impact uncertainties, or omit if none
```

---

## 8. COMPLEXITY TIERS

Tasks are classified along three axes:

```
complexity (0-10) + risk (low/med/high/crit) + ambiguity (0-1)
```

| Tier | Complexity | Risk | Ambiguity | Explore | Assess | Design | Plan | Execute | Verify |
|------|-----------|------|-----------|---------|--------|--------|------|---------|--------|
| T1 | 0-2 | low | <0.3 | Optional | Skip | Skip | Skip | Execute | Optional |
| T2 | 3-4 | low-med | <0.5 | Optional | Skip | L4 only | Optional | Execute | Optional |
| T3 | 5-6 | any | any | Recommended | Light | L2-L4 | Required | Execute | Required |
| T4-T5 | 7+ | any | any | Required | Deep | L1-L4 | Required | Execute | Required |

---

## 9. SHARED SKILLS & INFRASTRUCTURE

### Shared Skills (used by both Forge and Forge-GPT)

- **forge-harness**: Metrics, GC scans, run ledger
- **backlog**: Task tracking and bookkeeping
- **product-hub**: Product artifact management
- **jobs-to-be-done**: JTBD framework for product discovery
- **made-to-stick**: SUCCESs framework for spec clarity
- **copywriting**: Customer-facing copy
- **lean-startup**: Experiment design
- **experts-council**: Multi-model review
- **copilot-cli-skill**: Parallel worker execution

### Engineering Preferences

Shared across all modes via `shared/engineering-preferences.md`:
- Coding conventions
- Anti-patterns to avoid
- CORRECTION: protocol for mid-execution fixes
- Visual vocabulary for diagrams

---

## 10. KEY CONSTRAINTS & RULES

### The Unbreakable Rules (No Exceptions)

1. **NEVER edit files directly** — all file mutations through subagents, regardless of size/complexity
2. **NEVER run build/test commands** — dispatch via routing decision
3. **NEVER accept claims without evidence** — evaluate subagent output semantically
4. **No secrets in code** — no tokens, credentials, private keys
5. **No guessing on risk** — for security, data loss, architecture: present options, ask user
6. **Dispatch atomicity** — dispatch is the only mutating tool in a response (except sql for bookkeeping)
7. **Dispatch routing** — MUST evaluate task() vs workers before dispatching
8. **Backlog tracking** — all work links to backlog items
9. **Commit hygiene** — no temp files, screenshots, .sqlite, reports
10. **Scope discipline** — if >8 files or >2 new classes, challenge necessity first

### Model Selection (Forge-GPT)

| Phase | Role | Model |
|-------|------|-------|
| Explore | SCOUT | claude-sonnet-4.6 |
| Assess | CREATIVE | gpt-5.4 |
| Ideate | CREATIVE | gpt-5.4 |
| Design | CREATIVE | gpt-5.4 |
| Plan | PLANNER | gpt-5.4 |
| Execute | EXECUTOR | gpt-5.4 |
| Verify | VERIFIER | gpt-5.4 |
| Product | CREATIVE | gpt-5.4 |
| Retrospective | CREATIVE | gpt-5.4 |
| Memory | ARCHIVIST | claude-sonnet-4.6 |
| GC | SCOUT | claude-sonnet-4.6 |

**Floor**: claude-sonnet-4.6 minimum for any Forge-GPT dispatch. Never use Haiku or fast models.

---

## 11. VISUAL VOCABULARY

The system uses standardized diagram types:

- **①Component Box**: Module boundaries and dependencies
- **②Layer Stack**: Architectural layers
- **③Dependency Tree**: File structure with annotations
- **④Sequence Flow**: Data/control flow between components
- **⑤State Machine**: Entity lifecycle flows
- **⑥Parallel Tracks**: Concurrent execution phases
- **⑦Tradeoff Matrix**: Approaches/options compared across dimensions
- **⑧Impact Grid**: Features/items by value vs effort
- **⑨Before/After**: Current state vs proposed state
- **⑩Dashboard**: Build/test/lint/coverage status

---

## 12. COORDINATE WITH EXISTING CODEBASE

The system integrates with:

- **Architecture skills**: `backend-architecture`, `frontend-architecture` — constrain design to documented patterns
- **Backlog skill**: Task tracking and bookkeeping
- **Product-hub**: `.product/` repository management
- **forge-harness**: Metrics, GC scans, retrospective support

---

## 13. EXTERNAL VOICE (User Communication)

**Coordinator communicates like a senior engineer peer**:
- Lead with outcome or recommendation
- Use tables for 3+ items
- Use `→` for dependency flow
- Translate subagent output into natural language
- Keep internal routing, lane names, Mission Brief, constraint IDs, and protocol markers hidden
- Strip `[done]`, `[blocked]`, `[needs_input]`, `DEVIATIONS:`, `UNKNOWNS:`, `REMAINING RISKS:`, `CORRECTION:` before user sees

**Light phase visibility**:
- "Looking into this..." (Explore)
- "Here are a few approaches..." (Ideate)
- "Working through the design..." (Design)
- "Breaking this down into steps..." (Plan)
- "Implementing now..." (Execute)
- "Checking the implementation..." (Verify)

---

## CONCLUSION

Forge is a sophisticated **dispatch coordination system** that operationalizes the idea that humans should control *intent* while agents handle *implementation*. It achieves this through:

1. **Clear routing** to the right mode for each phase
2. **Structured design levels** (Capabilities → Components → Interactions → Contracts)
3. **Atomic decomposition** (Plan phase produces verifiable DONE WHEN criteria)
4. **Continuous verification** (both plan and implementation verified before proceeding)
5. **Harness-first retrospectives** (failures improve the system, not just the artifact)
6. **Memory extraction** (session learnings persist across contexts)
7. **Codebase health monitoring** (GC mode finds entropy before it metastasizes)

The entire system is built on the principle that **dispatching is doing**. The coordinator never edits, builds, or implements — it classifies intent, packages context, dispatches, evaluates, and bridges to the next phase.

