# FORGE SYSTEM — MODES QUICK REFERENCE

## The 11 Modes / Phases at a Glance

```
┌─────────────────────────────────────────────────────────────────┐
│                    COORDINATOR ROUTING DECISION                  │
│  (Forge or Forge-GPT classify user intent → lane → dispatch)    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────────────────┐
│                          THE 11 MODES/PHASES                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. EXPLORE     → Gather evidence, classify complexity (SCOUT)             │
│     Input:  User request + vague codebase                                  │
│     Output: Findings, confidence levels, tier classification               │
│     ✅ Read-only; surface existing solutions                               │
│                                                                              │
│  2. ASSESS      → Challenge premises, CEO quality gate (CREATIVE)          │
│     Input:  Task request + exploration findings                            │
│     Output: T3: 3 findings | T4-T5: 7 findings                             │
│     ✅ Determines scope mode (EXPAND/HOLD/REDUCE)                          │
│                                                                              │
│  3. IDEATE      → Generate differentiated approaches (CREATIVE)            │
│     Input:  Approved decision to move forward                              │
│     Output: 2-3 approaches with tradeoffs, 1+ contrarian                   │
│     ✅ MUST differ in 2+ dimensions                                        │
│                                                                              │
│  4. DESIGN      → Progressive refinement through levels (CREATIVE)         │
│     Input:  Approved approach                                              │
│     Output: Contracts frozen for PLAN/EXECUTE                              │
│     ✅ 4 levels: Capabilities → Components → Interactions → Contracts      │
│     ✅ HTML design review artifact for T3+ with 3+ components              │
│                                                                              │
│  5. PLAN        → Atomic steps, dependencies, DONE WHEN (PLANNER)          │
│     Input:  Approved design contracts                                      │
│     Output: Steps with verifiable DONE WHEN + risk/assumptions             │
│     ✅ Includes: test coverage map, observability, deploy/rollout          │
│                                                                              │
│  6. VERIFY      → Validate plan or implementation (VERIFIER)               │
│     Input:  Completed plan or implementation                               │
│     Output: approved/revision_required/blocked                             │
│     ✅ 2-pass limit; checklist-driven; cite all defects                    │
│                                                                              │
│  7. EXECUTE     → Build it, test it, verify as you go (EXECUTOR)           │
│     Input:  Approved plan                                                  │
│     Output: Implemented features + build/test evidence                     │
│     ✅ Contract-Driven TDD; code little → test little → repeat             │
│     ✅ Backlog updates + trail logging required                            │
│                                                                              │
│  8. RETROSPECTIVE → Fix the harness, not the artifact (ANALYST)            │
│     Input:  Failed verification or rejection                               │
│     Output: Root cause + max 5 concrete patches                            │
│     ✅ Classifies one primary root cause from 6 categories                 │
│     ✅ Proposals to mode files, Mission Brief templates, gates              │
│                                                                              │
│  9. MEMORY      → Extract durable knowledge (ARCHIVIST)                    │
│     Input:  Session trails + findings                                      │
│     Output: Stored memories + harness improvement proposals                │
│     ✅ Runs on explicit user request only                                  │
│     ✅ High confidence only; deduplicate                                   │
│                                                                              │
│  10. GC (Garbage Collector) → Scan for entropy (SCOUT)                     │
│      Input:  Codebase                                                      │
│      Output: Health report + backlog proposals                             │
│      ✅ Deterministic scans: debt, stale-docs, dead-exports                │
│      ✅ Proposals grouped into atomic backlog items                        │
│                                                                              │
│  11. PRODUCT    → Feature specs, discovery, validation (CREATIVE)          │
│      Input:  Product request (DISCOVER/DESIGN/VALIDATE/BRIDGE)             │
│      Output: Product artifacts + implementation handoff                    │
│      ✅ Anti-pattern review mandatory for specs                            │
│      ✅ JTBD, Made-to-Stick, copywriting skill integration                 │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

## Complexity Tiers & Phase Selection

| Tier | Complexity | Explore | Assess | Ideate | Design | Plan | Execute | Verify |
|------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| **T1** | 0-2 | Opt | Skip | Skip | Skip | Skip | Direct | Opt |
| **T2** | 3-4 | Opt | Skip | Optional | L4 only | Opt | Direct | Opt |
| **T3** | 5-6 | Rec | Light | ✅ | L2-L4 | ✅ | ✅ | ✅ |
| **T4-T5** | 7+ | ✅ | Deep | ✅ | L1-L4 | ✅ | ✅ | ✅ |

**Legend**: Opt=Optional, Rec=Recommended, ✅=Required, Skip=Not used

## Design Levels (DESIGN Mode Only)

```
Level 1: CAPABILITIES
├─ Scope + constraints
├─ Core requirements
├─ Quality constraints (throughput, latency, availability)
├─ Design questions
└─ Entry: T4-T5 only

    ↓ [user approves]

Level 2: COMPONENTS
├─ Domain model (entities, aggregates, boundaries)
├─ Component map + responsibilities
├─ Reuse-first analysis (new vs existing)
├─ Trust boundaries
├─ Design decisions with rationale
└─ Entry: T3, T4-T5

    ↓ [user approves]

Level 3: INTERACTIONS
├─ Primary flow (happy path)
├─ Data flow diagram
├─ ⚠️ FAILURE MODES (required for T3+)
├─ State machines
├─ Consistency model
├─ Error & Rescue Registry (T3+ required)
└─ Design questions

    ↓ [user approves]

Level 4: CONTRACTS (FROZEN)
├─ Domain types (interfaces, enums)
├─ Public API (function signatures, no bodies)
├─ Event contracts
├─ Schema changes
├─ Migration notes
└─ Enables TDD: tests written from contracts
```

## Post-Dispatch Evaluation Checklist

```
After task() returns:

1. Does it address the objective?
2. Is expected evidence present for the role?
   - SCOUT: findings + file refs + confidence?
   - EXECUTOR: files + build/test evidence?
   - VERIFIER: verdict + file:line citations?
   - PLANNER: steps + DONE WHEN criteria?
   - CREATIVE: approaches + tradeoffs or artifact?

3. Outcome classification:
   ├─ Complete → summarize → bookkeep → bridge → stop
   ├─ Needs input → switch to BLOCKED, ask question
   ├─ Failed → retry once if recoverable, else surface
   └─ Blocked → surface blocker

4. Scope & risk check → surface drift or security issues
5. Deviation check → log non-trivial deviations
6. Correction check → verify CORRECTION: statements acted on
```

## Closing Markers (Stripped Before User Sees)

```
[done]  or  [blocked: reason]  or  [needs_input: question]
DEVIATIONS: departures from Mission Brief (omit if none)
UNKNOWNS: unresolved facts (omit if none)
REMAINING RISKS: high-impact uncertainties (omit if none)
```

## Tool Permissions Quick Table

| Tool | Coordinator | Subagent | Worker |
|------|:-:|:-:|:-:|
| task() | ✅ single | ❌ no nesting | ✅ can nest |
| skill() | ✅ | ✅ | ✅ |
| view/grep/glob | ✅ read | ✅ full | ✅ full |
| bash (git, CLI) | ✅ | ✅ | ✅ |
| bash (build/test) | ❌ delegate | ✅ | ✅ |
| edit/create | ❌ delegate | ✅ | ✅ |

## Dispatch Routing Decision Tree

```
Work arrives
  │
  ├─ 0 files touched? → T1_ANSWER (answer inline)
  │
  ├─ 1-2 items OR overlapping files? → task() subagent
  │
  └─ 3+ independent items in different files? → copilot-cli-skill workers
```

## Model Selection (Forge-GPT Only)

```
EXPENSIVE (gpt-5.4):
├─ ASSESS, IDEATE, DESIGN, PLAN
├─ EXECUTE, VERIFY
├─ PRODUCT, RETROSPECTIVE
└─ Any creative/architectural phase

EFFICIENT (claude-sonnet-4.6):
├─ EXPLORE (investigate, lookup)
├─ MEMORY (archivist)
└─ GC (scanner)

FLOOR: claude-sonnet-4.6 minimum. Never use Haiku/fast models.
```

## The Design Guard (T3+ Magic)

```
User says "implement it" or "plan it" for T3+ task
  ↓
Is ASSESS completed this session?
  ├─ No → Dispatch ASSESS first (non-negotiable)
  │        Present findings interactively
  │        Collect decisions
  │        Then dispatch DESIGN
  │
  └─ Yes → Is DESIGN completed?
             ├─ No → Dispatch DESIGN (non-negotiable)
             └─ Yes → Proceed to PLAN/EXECUTE

This prevents implementations that skip strategic review.
```

## Pressure Signals → Dispatch

All user pressure signals mean "dispatch now":

| User says | Translation | Action |
|-----------|------------|--------|
| "proceed", "do it", "keep going" | Dispatch next | Route → brief → task() |
| "just fix it", "stop asking" | Dispatch immediately | Route → brief → task() |
| "do your job", "stop delegating" | Still dispatch | NEVER edit yourself |
| "parallelize" | Use workers | copilot-cli-skill workers |

**There is NO user signal that authorizes coordinator self-editing.**

---

## Visual Vocabulary (10 Diagram Types)

```
①  Component Box     — Module boundaries + dependencies
②  Layer Stack       — Architectural layers
③  Dependency Tree   — File structure + annotations
④  Sequence Flow     — Data/control flow between components
⑤  State Machine     — Entity lifecycle flows
⑥  Parallel Tracks   — Concurrent execution phases
⑦  Tradeoff Matrix   — Options compared across dimensions
⑧  Impact Grid       — Items by value vs effort
⑨  Before/After      — Current vs proposed state
⑩  Dashboard         — Build/test/lint/coverage status
```

Used in: EXPLORE (T2+), IDEATE (T2+), DESIGN (T2+), PLAN (T2+), VERIFY (T2+)

---

## Integration Flow

```
┌─ EXPLORE ─→ findings + tier
│                  ↓
├─ ASSESS ──→ premise challenge + scope mode
│      ↓ [interactive, collect decisions]
│      ↓
├─ IDEATE ──→ 2-3 approaches
│      ↓ [user selects]
│      ↓
├─ DESIGN ──→ frozen contracts (L1-L4)
│      ↓ [user approves]
│      ↓
├─ PLAN ───→ atomic steps + DONE WHEN
│      ↓
├─ VERIFY ──→ plan verified (T3+)
│      ↓
├─ EXECUTE →→ files + build/test evidence
│      ↓
├─ VERIFY ──→ implementation verified
│      ↓ [if revision_required:]
│      ↓
└─ RETROSPECTIVE → harness patches
```

---

## Key Constraints (No Exceptions)

1. ❌ NEVER edit files directly
2. ❌ NEVER run build/test yourself
3. ❌ NEVER accept claims without evidence
4. ✅ Always dispatch for file mutations
5. ✅ Always use task() with mode: "sync"
6. ✅ Always dispatch routing (task vs workers)
7. ✅ Always update backlog + log trails
8. ✅ Always verify plan (T3+) before execute
9. ✅ Always include failure modes (T3+)
10. ✅ Always strip protocol markers before user sees

---

## Coordinator Communication (External Voice)

Write like a senior engineer peer:
- Lead with outcome, not process
- Use tables for 3+ items
- Translate internal work into natural language
- Hide: lane names, role names, Mission Brief, constraint IDs, markers
- Keep: recommendations, risks, next steps

| Internal | What user sees |
|----------|----------------|
| Lane: DISPATCH | "Implementing now..." |
| SCOUT dispatch | "Looking into this..." |
| CREATIVE dispatch | "Here are approaches..." |
| PLANNER dispatch | "Breaking this down..." |
| VERIFIER dispatch | "Checking this..." |

