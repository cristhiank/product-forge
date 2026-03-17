# Lifecycle

> Phase transitions, entry/exit conditions, skip rules, and the design-aware flow.

---

## Phase Machine

Every non-trivial task flows through phases. The coordinator drives transitions; subagents execute within phases.

### Complexity Gate (Pre-Phase)

Before entering the phase machine, the coordinator classifies task complexity:

```
User message
│
├── CLASSIFY complexity: simple / moderate / complex-ambiguous
│
├── Simple → fast-track: minimal phases, act with momentum
├── Moderate → standard flow: explore → plan → execute → verify
└── Complex-ambiguous → full synthesis: all phases, full design progression
```

This gate determines how aggressively phases may be skipped (see Phase Skip Rules below) and how much reasoning budget each phase receives. Classification happens once at task entry and may be revised if exploration reveals unexpected complexity.

### Behavioral Protocol (7-Step)

The phase machine's behavioral manifestation follows this protocol, which maps to the phases but operates at the per-turn level:

```
1. CLASSIFY    — Determine task type and complexity (simple / moderate / complex-ambiguous)
2. SCOPE       — State objective, done criteria, and explicit non-goals
3. ORIENT      — If complex: list assumptions, assess system impact, identify risks
                 If simple: skip to step 4
4. PLAN        — Outline approach in bounded steps (proportional to complexity)
5. EXECUTE     — Act with momentum. Adhere to contracts. Use tight edit loops.
6. VERIFY      — Confirm exit criteria are met. Run relevant checks.
7. CLOSE       — State what was done, log any deviations, flag remaining risks. Stop.
```

Steps 1-3 map to EXPLORE/IDEATE/DESIGN phases. Steps 4-7 map to PLAN/EXECUTE/VERIFY/ITERATE. For simple tasks, steps 2-3 may collapse into a single sentence. The protocol ensures every task — regardless of complexity — follows a classify→act→verify→close arc.

```
EXPLORE ──→ IDEATE ──→ ASSESS ──→ DESIGN ──→ PLAN ──→ VERIFY(plan) ──→ EXECUTE ──→ VERIFY(result) ──→ ITERATE
   │           │          │          │         │           │                │            │
   │           │          │          │         │           │                │            └─→ findings → PLAN
   │           │          │          │         │           │                └─→ blocker → user
   │           │          │          │         │           └─→ plan verified → EXECUTE
   │           │          │          │         └─→ plan produced → VERIFY(plan)
   │           │          │          └─→ contracts agreed → PLAN
   │           │          └─→ scope mode + decisions → DESIGN
   │           └─→ user selects approach → ASSESS (T3+) or DESIGN or PLAN
   └─→ evidence gathered → IDEATE or PLAN
```

### Phase Definitions

| Phase | Purpose | Delegates to | Output |
|-------|---------|-------------|--------|
| EXPLORE | Understand the codebase and classify complexity | SCOUT subagent | Findings, tier classification |
| IDEATE | Generate and evaluate approaches | CREATIVE subagent | Approaches with tradeoffs, recommendation |
| ASSESS | Challenge premises, validate the problem, set strategic frame | CREATIVE subagent (assess mode) | Premise validation, scope mode, JTBD, delight opportunities |
| DESIGN | Progressive refinement of chosen approach | CREATIVE subagent | Design artifact with frozen contracts |
| PLAN | Decompose into atomic executable steps | PLANNER subagent | Ordered steps with DONE WHEN criteria |
| VERIFY | Independently validate plans or results | VERIFIER subagent | Verdict: approved / revision_required / blocked |
| EXECUTE | Implement the plan | EXECUTOR subagent or workers | Code changes with evidence |
| ITERATE | Decide what's next | Coordinator (inline) | Next action or completion |
| RETROSPECTIVE | Analyze failures, propose harness patches | Verify verdict + failed run context | Root cause classification + harness patch proposals | Optional — after VERIFY failure (T3+), user rejection, or explicit request |

---

## Transition Rules

| From | Condition | To |
|------|-----------|-----|
| START | Any request | Classify complexity → route to appropriate phase |
| EXPLORE | Findings gathered | IDEATE (if options needed) or PLAN (if approach is clear) |
| IDEATE | User selects approach | ASSESS (T3+) or DESIGN (T2) or PLAN (T1) |
| ASSESS | Findings presented, user decides | DESIGN (with scope mode and decisions) |
| ASSESS | Needs input | Back to user |
| DESIGN | Contracts agreed | PLAN |
| DESIGN | Needs input | Back to user |
| PLAN | Plan produced | VERIFY (plan review, T3+) or EXECUTE (T1-T2) |
| VERIFY (plan) | Plan approved | EXECUTE |
| VERIFY (plan) | Revision required | PLAN (refine) |
| EXECUTE | All steps done | VERIFY (result review) |
| EXECUTE | Blocker | Back to user |
| VERIFY (result) | Approved | ITERATE or COMPLETE |
| VERIFY (result) | Revision required | PLAN (new items) or EXECUTE (with feedback) |
| VERIFY (result) | Blocked | Back to user |
| Any | "What's next?" | Check backlog → present options |
| Any | Ad-hoc request | Classify and route (may skip phases) |

### RETROSPECTIVE Transitions

| From | To | Condition |
|------|----|-----------|
| VERIFY (revision_required) | RETROSPECTIVE | T3+ task, auto-suggested |
| User rejection | RETROSPECTIVE | User says "what went wrong", "improve the harness" |
| Explicit request | RETROSPECTIVE | User says "retrospective" at any point |
| RETROSPECTIVE (done) | User decision | Present patches → user approves/rejects → apply or discard |

---

## Phase Skip Rules

Not every task needs every phase.

### Design depth by tier

Simple tasks (T1) skip aggressively — they may go directly from classification to execution with only a brief scope statement. The complexity gate ensures this aggressive skipping is a deliberate routing decision, not oversight.

| Tier | Complexity | Design entry | Phases used |
|------|-----------|-------------|-------------|
| T1 (0-2) | Trivial | Skip design entirely | EXPLORE (optional) → EXECUTE → VERIFY (optional) |
| T2 (3-4) | Simple | Level 4 only (contracts) | EXPLORE → IDEATE (optional) → DESIGN (brief) → PLAN → EXECUTE → VERIFY |
| T3 (5-6) | Moderate | Level 2→4 | EXPLORE → IDEATE → ASSESS (light) → DESIGN → PLAN → VERIFY (plan) → EXECUTE → VERIFY (result) |
| T4-T5 (7+) | Complex | Level 1→4 (full) | All phases, full progression including ASSESS (deep) + VERIFY (plan) |

### User overrides

- "Skip the design" → route to PLAN directly
- "Just give me contracts" → DESIGN Level 4 only
- "Full design please" → DESIGN Level 1→4 regardless of tier
- "Just fix it" → EXECUTE with targeted context (coordinator gathers minimal context first)
- "Challenge this" / "CEO review" → ASSESS (any tier, explicit invocation)
- "Skip assess" → route to DESIGN directly (bypass CEO gate)

### When to skip EXPLORE

- Task scope is already clear from user message + prior session context
- Single file, obvious change, no ambiguity
- User has already provided the relevant findings

### When to skip VERIFY

- T1 tasks (trivial changes)
- Change is self-evidently correct (typo fix, config value change)
- User explicitly says "don't review, just ship it"

---

## Design-Aware Flow (T3+)

For complex tasks, the DESIGN phase creates frozen contracts that ground all subsequent work:

```
EXPLORE → IDEATE → user selects approach
                        │
                   ┌────▼────┐
                   │ DESIGN  │  Progressive: Capabilities → Components
                   │         │  → Interactions → Contracts
                   └────┬────┘  (each level: present → user feedback → advance)
                        │
                   PLAN (grounded in agreed contracts)
                        │
                   VERIFY (plan)
                        │
                   EXECUTE (contract-driven)
                        │
                   VERIFY (result — includes scope drift audit)
```

Key property: contracts frozen after DESIGN become the specification for PLAN and EXECUTE. Deviations require escalation back to the coordinator and user.

---

## Post-Completion Routing

| Completed phase | Default next | Alternative |
|----------------|-------------|-------------|
| EXPLORE | IDEATE (if options needed) | PLAN directly (if approach is obvious) |
| IDEATE | ASSESS (T3+) or DESIGN (T2) | PLAN (T1) |
| ASSESS | DESIGN (with scope mode context) | — |
| DESIGN | PLAN | EXECUTE (if plan is trivial, T2) |
| PLAN | VERIFY (plan, T3+) or EXECUTE (T1-T2) | EXECUTE directly (on user "proceed") |
| VERIFY (plan, clean) | EXECUTE | — |
| VERIFY (plan, findings) | PLAN (refine) | — |
| EXECUTE | VERIFY (result) | Skip for T1 |
| VERIFY (result, clean) | ITERATE / COMPLETE | — |
| VERIFY (result, findings) | PLAN (new items) → EXECUTE | Report if informational only |

---

## Utility Phases

Utility phases operate outside the main lifecycle. They do not participate in the explore → ... → verify progression.

### GC (Codebase Health)

**Purpose:** Scan codebase for entropy and decay. Produce prioritized findings and propose backlog items.

**Trigger:** Explicit user request ("run gc", "scan for debt") or periodic suggestion (every 10+ runs).

**Output:** Codebase health report with findings ordered by severity, plus proposed backlog items.

**Not part of main lifecycle:** GC runs independently and does not transition to or from implementation phases.

---

## Agentic Flywheel

The Forge lifecycle includes a self-improvement loop where session outcomes feed back into the harness:

```
EXECUTE → VERIFY → (failure) → RETROSPECTIVE → harness patches
                                                      ↓
                                              Mode files improve
                                                      ↓
                                              Future runs produce better results
```

**Components:**
1. **Metrics collection** — forge-harness tracks dispatch, verify results, retries, user satisfaction
2. **Retrospective analysis** — On failure, identifies root cause and proposes targeted harness patches
3. **Memory evolution** — Memory mode proposes harness improvements based on extracted learnings
4. **GC scanning** — Periodic codebase health checks fight entropy

**Reference:** [Humans and Agents](https://martinfowler.com/articles/exploring-gen-ai/humans-and-agents.html) — Martin Fowler. The "on the loop" posture: humans build and maintain the harness, agents run the how loop.
