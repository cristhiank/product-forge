# Lifecycle

> Phase transitions, entry/exit conditions, skip rules, and the design-aware flow.

---

## Phase Machine

Every non-trivial task flows through phases. The coordinator drives transitions; subagents execute within phases.

```
EXPLORE ──→ IDEATE ──→ DESIGN ──→ PLAN ──→ EXECUTE ──→ VERIFY ──→ ITERATE
   │           │          │         │          │           │
   │           │          │         │          │           └─→ findings → PLAN (new items)
   │           │          │         │          └─→ blocker → user
   │           │          │         └─→ plan verified → EXECUTE
   │           │          └─→ contracts agreed → PLAN
   │           └─→ user selects approach → DESIGN or PLAN
   └─→ evidence gathered → IDEATE or PLAN
```

### Phase Definitions

| Phase | Purpose | Delegates to | Output |
|-------|---------|-------------|--------|
| EXPLORE | Understand the codebase and classify complexity | SCOUT subagent | Findings, tier classification |
| IDEATE | Generate and evaluate approaches | CREATIVE subagent | Approaches with tradeoffs, recommendation |
| DESIGN | Progressive refinement of chosen approach | CREATIVE subagent | Design artifact with frozen contracts |
| PLAN | Decompose into atomic executable steps | PLANNER subagent | Ordered steps with DONE WHEN criteria |
| EXECUTE | Implement the plan | EXECUTOR subagent or workers | Code changes with evidence |
| VERIFY | Independently validate the result | VERIFIER subagent | Verdict: approved / revision_required / blocked |
| ITERATE | Decide what's next | Coordinator (inline) | Next action or completion |

---

## Transition Rules

| From | Condition | To |
|------|-----------|-----|
| START | Any request | Classify → route to appropriate phase |
| EXPLORE | Findings gathered | IDEATE (if options needed) or PLAN (if approach is clear) |
| IDEATE | User selects approach | DESIGN (T2+) or PLAN (T1) |
| DESIGN | Contracts agreed | PLAN |
| DESIGN | Needs input | Back to user |
| PLAN | Plan produced | VERIFY (plan review) |
| PLAN | User says "proceed" | EXECUTE |
| EXECUTE | All steps done | VERIFY (result review) |
| EXECUTE | Blocker | Back to user |
| VERIFY | Approved | ITERATE or COMPLETE |
| VERIFY | Revision required | PLAN (new items) or EXECUTE (with feedback) |
| VERIFY | Blocked | Back to user |
| Any | "What's next?" | Check backlog → present options |
| Any | Ad-hoc request | Classify and route (may skip phases) |

---

## Phase Skip Rules

Not every task needs every phase.

### Design depth by tier

| Tier | Complexity | Design entry | Phases used |
|------|-----------|-------------|-------------|
| T1 (0-2) | Trivial | Skip design entirely | EXPLORE (optional) → EXECUTE → VERIFY (optional) |
| T2 (3-4) | Simple | Level 4 only (contracts) | EXPLORE → IDEATE (optional) → DESIGN (brief) → PLAN → EXECUTE → VERIFY |
| T3 (5-6) | Moderate | Level 2→4 | EXPLORE → IDEATE → DESIGN → PLAN → EXECUTE → VERIFY |
| T4-T5 (7+) | Complex | Level 1→4 (full) | All phases, full progression |

### User overrides

- "Skip the design" → route to PLAN directly
- "Just give me contracts" → DESIGN Level 4 only
- "Full design please" → DESIGN Level 1→4 regardless of tier
- "Just fix it" → EXECUTE with targeted context (coordinator gathers minimal context first)

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
| IDEATE | DESIGN (T2+) | PLAN (T1) |
| DESIGN | PLAN | EXECUTE (if plan is trivial, T2) |
| PLAN | EXECUTE (on user "proceed") | VERIFY (plan check) first |
| EXECUTE | VERIFY | Skip for T1 |
| VERIFY (clean) | ITERATE / COMPLETE | — |
| VERIFY (findings) | PLAN (new items) → EXECUTE | Report if informational only |
