# Routing Rules — Forge Task Classification & Delegation

How Forge classifies user requests and routes them to the appropriate phase, mode, or skill.

---

## Intent Classification

<rules name="intent_classification">

When a user message arrives, classify it into one of these intents:

```
User message
│
├── Quick question (factual, < 1 tool call to answer)
│   └── Answer directly. No delegation.
│
├── Review request ("ask the experts", "deep review", "evaluate")
│   └── Invoke experts-council skill
│   Route: Forge Phase 1 (REVIEW)
│
├── Planning request ("create backlog", "create epic", "user stories")
│   └── Invoke backlog skill + optionally PLAN mode subagent
│   Route: Forge Phase 2 (PLAN)
│
├── Execution request ("work on epic", "do your job", "implement", "proceed")
│   └── Evaluate complexity → workers or EXECUTE mode subagent
│   Route: Forge Phase 3 (EXECUTE)
│
├── Verification request ("review again", "check the implementation")
│   └── Invoke experts-council (delta review) or VERIFY mode subagent
│   Route: Forge Phase 4 (VERIFY)
│
├── Navigation request ("what's next?", "backlog status", "what should I work on")
│   └── Invoke backlog skill (brief, list unblocked)
│   Route: Forge Phase 5 (ITERATE)
│
├── Ad-hoc fix ("fix this error", "this CSS is wrong", specific bug)
│   └── Delegate to EXECUTE mode subagent with targeted context
│   Track: count untracked changes, prompt for backlog after 3+
│
├── Research request ("look at X", "scrape these websites", "compare options")
│   └── Delegate to EXPLORE mode subagent with research context
│   May chain: EXPLORE → IDEATE if options requested
│
├── Infrastructure request ("publish", "make windows compatible", "reorganize")
│   └── Delegate to EXECUTE mode subagent with infra context
│
└── Ambiguous / unclear
    └── Ask user ONE clarifying question before routing
```

<examples name="intent_dispatch">

| User says | Classified as | Routed to |
|-----------|---------------|-----------|
| "What model are you?" | Quick question | Answer directly, no delegation |
| "What's the time?" | Quick question | Answer directly, no delegation |
| "Ask the experts about this design" | Review request | experts-council skill → Phase 1 |
| "Create an epic for the auth refactor" | Planning request | backlog skill + PLAN subagent → Phase 2 |
| "Work on epic AUTH-01" | Execution request | Complexity eval → EXECUTE subagent or workers → Phase 3 |
| "Review the implementation" | Verification request | VERIFY subagent or experts-council delta → Phase 4 |
| "What should I work on next?" | Navigation request | backlog skill (brief) → Phase 5 |
| "Fix this CSS alignment bug" | Ad-hoc fix | EXECUTE subagent with targeted context |
| "Compare Redis vs Memcached for our cache" | Research request | EXPLORE subagent, may chain → IDEATE |
| "Make the build Windows-compatible" | Infrastructure request | EXECUTE subagent with infra context |

</examples>

</rules>

---

## Execution Complexity Evaluation

<rules name="execution_routing">

When the intent is EXECUTE, evaluate complexity to decide HOW to execute:

### Decision Matrix

| Criteria | Direct Subagent | Parallel Workers |
|----------|:-:|:-:|
| Item count | 1-2 items | 3+ independent items |
| Change size per item | < 50 lines | > 50 lines, multiple files |
| Independence | Same module, sequential | Different modules, no file overlap |
| Estimated time per item | < 5 min | > 5 min |
| Isolation needed | Low (simple edits) | High (risky changes, new features) |

### Routing Decision

```
Count items in epic/request
│
├── 1-2 items, each < 20 lines change
│   └── Single EXECUTE mode subagent (sequential)
│
├── 3+ items, all independent (different files/modules)
│   └── Parallel workers via copilot-cli-skill
│   Pattern: Spawn → Register in hub → Sync → Await → Validate → Merge
│
├── 3+ items, some dependent
│   └── Batch into dependency-ordered groups
│   Each batch: parallel workers for independent items
│   Between batches: merge, build check, then next batch
│
├── Mixed (some trivial, some substantial)
│   └── Workers for substantial items, single subagent for trivial
│
└── 20+ items, all surgical (< 20 lines each)
    └── Single EXECUTE mode subagent, batched by file
    Evidence: B-051 (20 surgical fixes done directly, not via workers)
```

<rationale name="execution_routing_decisions">

- **1-2 small items → single subagent:** Worker spawn overhead (~15-30s) exceeds the time to apply the fix directly. The coordination cost of parallel workers outweighs the benefit for small changes.
- **3+ independent items → parallel workers:** When items touch different modules with no file overlap, parallelism gain exceeds spawn overhead. Each worker operates in an isolated worktree, eliminating merge conflicts.
- **Mixed trivial + substantial → split approach:** Spawning a worker for a 1-line fix wastes resources. Trivial items execute faster inline while substantial items benefit from isolation.
- **20+ surgical items → single subagent, batched:** Worker overhead multiplied by 20+ exceeds sequential execution time. Grouping by file minimizes file I/O and keeps context coherent.

</rationale>

</rules>

---

## Experts Council Triggers

<rules name="experts_council">

### Explicit Triggers (user says)
- "Ask the experts"
- "Get different perspectives"
- "Multi-model review"
- "Ask gemini, opus and gpt"

### Autonomous Triggers (Forge decides)
- Architecture/design question with 2+ viable approaches and confidence < 70%
- Post-implementation review needed (delta review with prior findings)
- Complex feature requiring long-term choices (data models, API contracts)
- Planning phase surfaces 3+ competing strategies

### Do NOT Invoke Council For
- Factual questions with clear answers
- Simple implementation tasks
- Bug fixes with obvious root cause
- Questions the agent can answer from codebase evidence alone

<examples name="council_dispatch">

| Situation | Invoke council? | Why |
|-----------|:-:|-----|
| "Should we use REST or GraphQL for the new API?" | Yes | Architecture decision, 2+ viable approaches |
| "Fix the null pointer in line 42" | No | Obvious root cause, no design ambiguity |
| "Review the auth refactor we just finished" | Yes | Post-implementation delta review benefits from multiple perspectives |
| "What does this function do?" | No | Factual question answerable from codebase |

</examples>

</rules>

---

## Context Packaging Rules

<rules name="context_packaging">

When Forge delegates to a subagent via `task`, it packages context as follows:

### What to Include

```
1. Mode contract (from modes/*.md) — the subagent's behavioral rules
2. Objective — clear statement of what the subagent should accomplish
3. Relevant findings — only findings relevant to this specific task
4. Code snippets — only code the subagent needs to see
5. Constraints — scope boundaries, off-limits files, time limits
6. Prior decisions — only if the subagent needs them for context
7. Design artifacts — when DESIGN phase completed, include agreed contracts
8. Tier classification — so the subagent knows the complexity level
```

### What NOT to Include

```
1. Full conversation history
2. Findings from unrelated phases
3. Other subagent outputs verbatim — summarize instead
4. Hub message logs — use structured findings, not raw messages
5. Backlog state dumps — only the relevant item(s)
```

<rationale name="context_exclusions">

Subagents run in clean context windows with limited token budgets. Including irrelevant material has three costs:

- **Signal dilution:** Full conversation history and unrelated findings bury the actual objective. Subagents perform better when context is focused and task-specific.
- **Hallucination risk:** Verbatim outputs from other subagents may contain assumptions or partial conclusions that the new subagent treats as established facts. Summarizing forces Forge to distill only what is confirmed.
- **Token waste:** Hub message logs and backlog dumps are verbose. Structured findings convey the same information in a fraction of the tokens, leaving room for the subagent to reason and produce output.

</rationale>

### Packaging Template

```
You are operating in [MODE] mode.

## Your Rules
[contents of modes/<mode>.md]

## Objective
[clear, specific statement of what to accomplish]

## Context
[relevant findings, code snippets, constraints]

## Design Contracts (when available)
[agreed types, interfaces, and signatures from DESIGN phase]
[Note: these contracts are FROZEN — deviations require escalation]

## Expected Output
[what format the response should be in]
```

<examples name="context_package">

**EXPLORE subagent for auth investigation:**
```
You are operating in EXPLORE mode.

## Your Rules
[explore mode contract]

## Objective
Investigate the authentication flow in src/auth/. Classify task tier for
replacing JWT library from jsonwebtoken to jose.

## Context
- User wants to migrate JWT library for ESM compatibility
- Current auth files: src/auth/token.ts, src/auth/middleware.ts
- Prior finding: jsonwebtoken is CJS-only (high confidence)

## Expected Output
Structured findings with file references, dependency map, and tier classification.
```

</examples>

</rules>

---

## Post-Completion Routing

<rules name="post_completion">

After any phase completes, Forge automatically:

1. **Store results** — findings → hub, decisions → working memory
2. **Check backlog** — show newly unblocked items
3. **Bridge to next action** — never end with just a summary
4. **Track untracked work** — if 3+ ad-hoc changes, suggest backlog capture

### Completion → Next Phase

| Completed Phase | Default Next | Alternative |
|----------------|-------------|-------------|
| REVIEW (findings) | PLAN (create items) | Report to user if informational only |
| IDEATE (approach selected) | DESIGN (T2+) | PLAN directly for T1 |
| DESIGN (contracts agreed) | PLAN (grounded in contracts) | EXECUTE if plan is trivial (T2) |
| PLAN (epic created) | Wait for user "proceed" | Auto-proceed if user said "work on it" |
| EXECUTE (items done) | VERIFY (review results) | Skip if trivial (T1) |
| VERIFY (clean) | ITERATE (what's next) | PLAN if findings need new items |
| VERIFY (findings) | PLAN (new items) | Report if informational only |

</rules>

---

## Design-Depth Calibration

<rules name="design_depth">

When routing through the DESIGN phase, select the entry point based on task tier:

| Forge Tier | Design Entry | Levels Covered | Examples |
|-----------|-------------|----------------|---------|
| T1 (0-2) | Skip DESIGN | None | Date formatter, typo fix, config change |
| T2 (3-4) | Level 4: Contracts | Contracts only | Validation helper, new API endpoint |
| T3 (5-6) | Level 2: Components | Components → Interactions → Contracts | Notification service, auth flow |
| T4-T5 (7+) | Level 1: Capabilities | Full progression (all 4 levels) | Third-party API, event pipeline, payment integration |

<rationale name="design_depth_calibration">

Design-depth calibration exists to match design investment to task risk. Without it, Forge either over-designs trivial tasks (wasting time on a 4-level design process for a typo fix) or under-designs complex ones (jumping straight to code for a multi-service integration and discovering architectural misalignment mid-implementation).

The tier thresholds are calibrated from observed outcomes:
- **T1 tasks** that went through DESIGN produced identical plans to those that skipped it — the overhead added no value.
- **T3+ tasks** that skipped DESIGN frequently required mid-execution rework when component boundaries or interface contracts turned out to be wrong.
- **T2 tasks** sit at the boundary: a brief contracts-only pass catches interface mismatches without the cost of full architectural review.

</rationale>

### Design Routing Decision

```
Approach selected (from IDEATE or user)
│
├── Tier classification available?
│   ├── No → Dispatch EXPLORE first to classify tier
│   └── Yes ↓
│
├── T1 (0-2)
│   └── Skip DESIGN → route to PLAN or direct EXECUTE
│
├── T2 (3-4)
│   └── DESIGN (Level 4 only: Contracts)
│       Brief session — align types/signatures, then → PLAN
│
├── T3 (5-6)
│   └── DESIGN (Level 2→4: Components, Interactions, Contracts)
│       Standard design — catch architectural misalignment, then → PLAN
│
└── T4-T5 (7+)
    └── DESIGN (Level 1→4: Full Capabilities through Contracts)
        Thorough design — full scope alignment, then → PLAN
```

### User Override

The user can always override design depth:
- "Skip the design" → route to PLAN directly (note: design skipped)
- "Just give me contracts" → DESIGN Level 4 only
- "Full design please" → DESIGN Level 1→4 regardless of tier

</rules>

---

## Session Continuity

<rules name="session_continuity">

### On Session Start

```
1. Check for running workers → present status
2. Check backlog → show working items
3. Check hub → any pending requests?
4. Resume or fresh start?
```

### On Session Break ("continue where you left")

Forge reconstructs state from:
- Backlog (what items are in which state)
- Hub (worker status, last sync results)
- Session store (prior session checkpoints)
- Working memory (accumulated decisions from this session)

### Untracked Work Detection

If the user makes 3+ requests that result in code changes without backlog items:
```
"These changes aren't tracked in the backlog:
1. [change summary]
2. [change summary]
3. [change summary]
Want me to create items under [epic] or a new epic?"
```

<rationale name="untracked_work_detection">

Ad-hoc fixes are a natural part of development, but they create invisible technical debt when untracked. After 3+ untracked changes, the risk compounds: changes lack context for future reviewers, regression scope is unknown, and the backlog no longer reflects reality. The prompt at 3 changes balances flexibility (not nagging after every small fix) with discipline (surfacing drift before it accumulates). Capturing these changes retroactively preserves the project's decision trail and keeps the backlog accurate for priority decisions.

</rationale>

</rules>
