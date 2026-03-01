# Routing Rules — Forge Task Classification & Delegation

How Forge classifies user requests and routes them to the appropriate phase, mode, or skill.

---

## Intent Classification

When a user message arrives, Forge classifies it into one of these intents:

```
User message
│
├── Quick question (factual, < 1 tool call to answer)
│   └── Answer directly. No delegation.
│   Examples: "What model are you?", "What's the time?", "Explain X"
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

---

## Execution Complexity Evaluation

When the intent is EXECUTE, Forge evaluates complexity to decide HOW to execute:

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
│   Rationale: Worker spawn overhead (~15-30s) exceeds fix time
│
├── 3+ items, all independent (different files/modules)
│   └── Parallel workers via copilot-cli-skill
│   Rationale: Parallelism gain > spawn overhead
│   Pattern: Spawn → Register in hub → Sync → Await → Validate → Merge
│
├── 3+ items, some dependent
│   └── Batch into dependency-ordered groups
│   Each batch: parallel workers for independent items
│   Between batches: merge, build check, then next batch
│
├── Mixed (some trivial, some substantial)
│   └── Workers for substantial items, single subagent for trivial
│   Rationale: Don't spawn a worker for a 1-line fix
│
└── 20+ items, all surgical (< 20 lines each)
    └── Single EXECUTE mode subagent, batched by file
    Rationale: Worker overhead × 20 > sequential execution time
    Evidence: B-051 (20 surgical fixes done directly, not via workers)
```

---

## Experts Council Triggers

Forge invokes the experts-council skill when:

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

---

## Context Packaging Rules

When Forge delegates to a subagent via `task`, it must package context:

### What to Include

```
1. Mode contract (from modes/*.md) — the subagent's behavioral rules
2. Objective — clear statement of what the subagent should accomplish
3. Relevant findings — only findings relevant to this specific task
4. Code snippets — only code the subagent needs to see
5. Constraints — scope boundaries, forbidden files, time limits
6. Prior decisions — only if the subagent needs them for context
```

### What NOT to Include

```
1. Full conversation history — the subagent doesn't need it
2. Findings from unrelated phases — noise
3. Other subagent outputs verbatim — summarize instead
4. Hub message logs — use structured findings, not raw messages
5. Backlog state dumps — only the relevant item(s)
```

### Packaging Template

```
You are operating in [MODE] mode.

## Your Rules
[contents of modes/<mode>.md]

## Objective
[clear, specific statement of what to accomplish]

## Context
[relevant findings, code snippets, constraints]

## Expected Output
[what format the response should be in]
```

---

## Post-Completion Routing

After any phase completes, Forge automatically:

1. **Store results** — findings → hub, decisions → working memory
2. **Check backlog** — show newly unblocked items
3. **Bridge to next action** — never end with just a summary
4. **Track untracked work** — if 3+ ad-hoc changes, suggest backlog capture

### Completion → Next Phase

| Completed Phase | Default Next | Alternative |
|----------------|-------------|-------------|
| REVIEW (findings) | PLAN (create items) | Report to user if informational only |
| PLAN (epic created) | Wait for user "proceed" | Auto-proceed if user said "work on it" |
| EXECUTE (items done) | VERIFY (review results) | Skip if trivial (T1) |
| VERIFY (clean) | ITERATE (what's next) | PLAN if findings need new items |
| VERIFY (findings) | PLAN (new items) | Report if informational only |

---

## Session Continuity

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
