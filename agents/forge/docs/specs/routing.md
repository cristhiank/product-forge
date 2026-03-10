# Routing

> Intent classification, T1 eligibility, dispatch mechanism selection, and context packaging.

---

## Intent Classification

When a user message arrives, the coordinator classifies it before taking any action.

```
User message
│
├── Quick question (factual, answerable from known context, 0 files touched)
│   → Answer directly. No delegation.
│
├── Explore request (investigate, understand, scan, classify, trace)
│   → Dispatch SCOUT subagent
│
├── Ideate request (explore options, approaches, architecture decision)
│   → Dispatch CREATIVE subagent (ideate mode)
│
├── Design request (whiteboard, components, interfaces, contracts)
│   → Dispatch CREATIVE subagent (design mode)
│
├── Plan request (create plan, break down, decompose, user stories)
│   → Dispatch PLANNER subagent
│
├── Execute request (implement, fix, build, refactor, proceed, do it)
│   → Evaluate complexity → dispatch EXECUTOR subagent or workers
│
├── Verify request (review, check, validate, audit)
│   → Dispatch VERIFIER subagent
│
├── Memory request (extract memories, save learnings)
│   → Dispatch ARCHIVIST subagent
│
├── Experts council (ask the experts, multi-model review, get perspectives)
│   → Invoke experts-council skill
│
├── Navigation (what's next, backlog status, priorities)
│   → Invoke backlog skill
│
├── Product request (discover, define feature, validate, product spec)
│   → Dispatch product subagent
│
├── Ad-hoc fix (fix this error, this CSS is wrong, specific bug)
│   → Dispatch EXECUTOR with targeted context
│
└── Ambiguous / unclear
    → Ask user 1-3 focused clarifying questions before routing
```

---

## T1 Eligibility

Answer directly (no delegation) when ALL of these are true:

- Touches 0 source files
- No codebase investigation needed
- No build or test needed
- No security-sensitive judgment needed
- Answerable from the user message plus already-known context
- Can be produced in < 30 seconds

If ANY of these are false, delegate. A one-line typo fix still gets dispatched.

---

## Dispatch Mechanism Selection

Before every dispatch, determine the mechanism:

```
Count items + check file overlap
│
├── 0 files → Answer inline (T1)
│
├── 1-2 items or overlapping files → task() subagent
│   Subagent gets: fresh context window, all tools except task()
│   Cannot: spawn sub-subagents, invoke experts council
│
├── 3+ independent items in different files → copilot-cli-skill workers
│   Workers get: full Copilot instance, own process, own session
│   Can: call task(), load skills, run full explore→execute→verify
│   Communication: via agents-hub (async)
│
└── Mixed → group by dependency
    Independent groups → parallel workers
    Dependent items within group → sequential in one worker
```

### Agent type selection

| Agent type | Tools | Speed | Use when |
|-----------|-------|-------|----------|
| `general-purpose` | All except task() | Normal | Most work — loads mode skill |
| `explore` (built-in) | grep/glob/view only | Fast | Simple file/symbol lookups, no skill loading needed |

**Critical:** The built-in `explore` agent cannot load skills. If the dispatch requires a mode skill (e.g., `forge-explore`), use `general-purpose`.

---

## Context Packaging

What to include in a dispatch:

1. **Mode skill invocation** — first line loads the correct mode
2. **Objective** — clear statement of what to accomplish
3. **Relevant findings** — only findings relevant to this specific task (summarized)
4. **Code snippets** — only code the subagent needs to see
5. **Constraints** — scope boundaries, off-limits files, time limits
6. **Prior decisions** — only if the subagent needs them
7. **Design artifacts** — when DESIGN phase completed, include agreed contracts (frozen)
8. **Tier classification** — so the subagent knows the complexity level

What NOT to include:

1. Full conversation history
2. Findings from unrelated phases
3. Other subagent outputs verbatim — summarize instead
4. Hub message logs — use structured findings
5. Backlog state dumps — only the relevant items

---

## Experts Council Routing

**Invoke council when:**
- Architecture/design question with 2+ viable approaches and low confidence
- Post-implementation delta review needed
- Complex feature requiring long-term choices (data models, API contracts)
- Planning surfaces 3+ competing strategies

**Do not invoke council for:**
- Factual questions with clear answers
- Simple implementation tasks
- Bug fixes with obvious root cause
- Questions answerable from codebase evidence alone

---

## Post-Dispatch Protocol

After a dispatch returns:

1. **Evaluate** — Does the output address the objective with evidence? (semantic judgment)
2. **Summarize** — Translate subagent output into a user-facing summary
3. **Bookkeep** — Update backlog item status if applicable
4. **Bridge** — Explain what was done, what it unblocked, and recommend the next action
5. **Stop** — Do not continue working after summarizing

The coordinator does not "finish up" work after a subagent returns. If more work is needed, it dispatches again.
