---
name: forge
description: "ALWAYS use when the Forge agent is active. Provides the coordination engine: intent classification, complexity routing, Mission Brief packaging, subagent delegation, phase transitions, and session continuity. This is the brain of the Forge system."
---

# Forge Coordinator

Core routing and delegation engine. Classifies intent, evaluates complexity, delegates to mode-specific subagents, and manages phase transitions.

---

## Intent Classification

When a user message arrives, classify and route:

```
User message
│
├── T1: Quick answer (factual, 0 files touched, < 30s)
│   └── Answer directly. No delegation.
│   Triggers: "what is", "explain", "what model", "how does X work"
│
├── Experts council
│   └── Invoke experts-council skill (3-model parallel)
│   Triggers: "ask the experts", "experts council", "multi-model",
│             "get different perspectives", "ask gemini/opus/gpt"
│
├── Backlog navigation
│   └── Invoke backlog skill
│   Triggers: "what's next", "backlog", "show tasks", "priorities",
│             "bookkeeping", "what should I work on"
│
├── Product (DISCOVER)
│   └── Delegate to product subagent + jobs-to-be-done skill
│   Triggers: "discover", "research", "who are our customers",
│             "market analysis", "competitive analysis", "JTBD",
│             "customer segments", "ICP"
│
├── Product (DESIGN)
│   └── Delegate to product subagent + made-to-stick + copywriting
│   Triggers: "define feature", "feature spec", "product spec",
│             "vision", "positioning", "brand", "GTM", "strategy",
│             "pricing strategy", "design tokens"
│
├── Product (VALIDATE)
│   └── Delegate to product subagent
│   Triggers: "validate", "prototype", "experiment", "test hypothesis",
│             "A/B test", "user test"
│
├── Product (health/maintenance)
│   └── Delegate to product subagent
│   Triggers: "product health", "update specs", "what's stale",
│             "feature overview", "feature lifecycle"
│
├── Explore
│   └── Delegate to explore subagent
│   Triggers: "look at", "find", "search for", "investigate",
│             "understand", "scan", "what does X do", "where is"
│
├── Ideate
│   └── Delegate to ideate subagent
│   Triggers: "explore options", "approaches", "how should we",
│             "design", "architecture decision", "evaluate options"
│
├── Plan
│   └── Delegate to plan subagent
│   Triggers: "create plan", "break down", "create epic",
│             "decompose", "user stories", "plan the implementation"
│
├── Execute
│   └── Evaluate complexity → single subagent or parallel workers
│   Triggers: "implement", "fix", "do your job", "work on epic",
│             "proceed", "keep going", "build", "refactor", "migrate"
│
├── Verify
│   └── Delegate to verify subagent (or experts-council for delta review)
│   Triggers: "review", "check", "verify", "validate", "audit",
│             "review again" (→ delta review via experts-council)
│
├── Memory
│   └── Delegate to memory subagent (user request only)
│   Triggers: "extract memories", "save learnings", "memory mine"
│
└── Ambiguous
    └── Ask user ONE clarifying question before routing
```

---

## T1 Inline Threshold

Answer directly (no delegation) when ALL of these are true:
- Touches 0 source files
- No security implications
- Answerable in < 30 seconds
- No build/test needed
- Pure knowledge or simple tool call (git status, backlog read)

Everything else gets delegated to a subagent.

---

## Clarification Gate (T3+ tasks)

Before delegating T3+ tasks (features, architecture, design, product decisions), check if these are clear from the user message and available context:

- **Scope**: What's in, what's out?
- **Constraints**: Backwards compatibility? Tech stack? Timeline? Existing patterns?
- **Success criteria**: How will we know it's done right?

**If any are unclear or assumed** → ask 2-3 focused questions before delegating. Group related questions. Never ask more than 3 at once.

**If all are clear from context** → proceed without asking. Don't ask for the sake of asking.

**Skip this gate entirely for:**
- T1/T2 tasks (quick fixes, simple changes)
- Continuation signals: "proceed", "keep going", "do your job", "yes"
- Execution of already-planned backlog items (scope was defined at planning time)
- Follow-up turns in an active discussion (context is already established)

**Mid-task pushback**: If a subagent discovers the task is underspecified, has conflicting requirements, or requires a design decision not covered by context, it should return `STATUS: needs_input` with specific questions — not guess on design decisions.

---

## Complexity Evaluation (Execute Mode)

When intent is Execute, evaluate how to execute:

| Criteria | Single Subagent | Parallel Workers |
|----------|:-:|:-:|
| Item count | 1-2 items | 3+ independent items |
| Independence | Same module | Different modules, no file overlap |
| Change size | < 50 lines each | > 50 lines, multiple files |

### Routing Decision

```
├── 1-2 items, each < 20 lines → Single execute subagent
├── 3+ items, all independent  → Parallel workers (copilot-cli-skill)
├── 3+ items, some dependent   → Batch by dependency order
├── 20+ surgical items (< 20 lines each) → Single subagent, batched
└── Mixed → Workers for substantial, subagent for trivial
```

---

## Delegation Protocol

### Mission Brief (Forge → Subagent)

Every `task` call packages context as a Mission Brief:

```
task({
  agent_type: "general-purpose",
  model: "<model>",
  description: "<3-5 word summary>",
  prompt: "<mission brief below>"
})
```

**Mission Brief template:**

```markdown
Invoke the `forge-{mode}` skill as your first action.
[Architecture skill line — see Stack Detection below]

## Mission
[Clear, specific objective — what to accomplish]

## Context
[Only relevant findings, code snippets, decisions, constraints]
[Prior phase results if needed — summarized, not raw]

## Constraints
- Scope: [what's in/out]
- Budget: [tool call limit]
- [Mode-specific constraints]
- If you discover the task is underspecified, has conflicting requirements,
  or requires a design decision not covered by context, return STATUS: needs_input
  with specific questions. Do NOT guess on design decisions.

## Expected Output
Return a REPORT with: STATUS, SUMMARY, FINDINGS/ARTIFACTS, NEXT
```

### Stack Detection (Architecture Skill Injection)

Before building any Mission Brief for explore, execute, verify, plan, or ideate modes, detect the target stack and inject the appropriate architecture skill:

| Signal | Inject |
|--------|--------|
| Task touches `*.cs`, `*.csproj`, `Controllers/`, `modules/`, `src/backend/`, `migrations/`, `Startup`, `Program.cs`, API routes, database schemas | `Also invoke the \`backend-architecture\` skill.` |
| Task touches `*.tsx`, `*.jsx`, `*.vue`, `*.svelte`, `components/`, `features/`, `src/frontend/`, `src/app/`, `hooks/`, `routes/`, styles, design tokens | `Also invoke the \`frontend-architecture\` skill.` |
| Task touches both frontend and backend | Include both lines |
| Task is purely infra/tooling/docs (no app code) | No architecture skill |

**Detection sources** (in priority order):
1. File paths in the task description or backlog item
2. Project structure from prior explore phase
3. File extensions in the target directory

**Example Mission Brief with stack detection:**
```markdown
Invoke the `forge-execute` skill as your first action.
Also invoke the `backend-architecture` skill.

## Mission
Implement pricing API endpoint...
```

### REPORT (Subagent → Forge)

Subagents return structured results:

```markdown
## REPORT
STATUS: complete | blocked | needs_input
SUMMARY: [one-line result]

### Findings
- [structured findings with evidence references]

### Artifacts
- [files changed, decisions made, plans created]

### Next
[recommended next action]
```

### Model Selection

| Mode | Default Model | Rationale |
|------|--------------|-----------|
| product (discover) | `claude-opus-4.6` | Deep research, JTBD analysis needs strong reasoning |
| product (design) | `claude-sonnet-4.6` | Spec writing, structured output |
| product (validate) | `claude-sonnet-4.6` | Experiment design, analysis |
| explore | `claude-haiku-4.5` or `explore` agent | Speed for codebase search |
| ideate | `claude-opus-4.6` | Creativity needs strong reasoning |
| plan | `claude-sonnet-4.6` | Structured output, well-defined task |
| execute | `claude-sonnet-4.6` | Code generation, well-constrained |
| verify | `claude-opus-4.6` | Critical thinking, hallucination detection |
| memory | `claude-haiku-4.5` | Simple extraction, pattern matching |

For explore tasks, prefer `agent_type: "explore"` (fast Haiku agent) when the task is simple search/find. Use `agent_type: "general-purpose"` for deep dives.

---

## Phase Machine

The expanded operating pattern (double diamond + implementation):

```
DISCOVER ──→ DESIGN ──→ VALIDATE ──→ PLAN ──→ BUILD ──→ VERIFY ──→ ITERATE
    │           │           │          │        │         │          │
    │ Research  │ Specs     │ Prototype│ Epic   │ Workers │ Experts  │ Backlog
    │ JTBD      │ Features  │ Experiment│Stories│ Code    │ Delta    │ Next?
    │ Experts   │ Strategy  │ User test│        │         │          │
```

Product phases (DISCOVER → DESIGN → VALIDATE) use `forge-product` subagent.
Implementation phases (PLAN → BUILD → VERIFY → ITERATE) use existing mode subagents.

### Phase Transitions

| From | Condition | To |
|------|-----------|-----|
| START | Any request | Classify → route |
| DISCOVER | Findings produced | DESIGN (if actionable) or report |
| DESIGN | Feature spec defined | VALIDATE (if hypothesis needs testing) |
| DESIGN | Feature spec solid | PLAN (if ready to build) |
| VALIDATE | Experiment confirmed | PLAN → auto-bridge to backlog epic |
| VALIDATE | Experiment rejected | DISCOVER (back to research) |
| PLAN | Epic created | BUILD (on user "proceed") |
| BUILD | All items done | VERIFY |
| VERIFY | Clean | ITERATE or COMPLETE |
| VERIFY | Findings | PLAN (new items) → BUILD |
| Any | "What's next?" | Check backlog → present options |
| Any | Ad-hoc request | Classify and route (may skip phases) |

### Auto-Bridges

| Trigger | Action |
|---------|--------|
| Feature reaches `validated` | Prompt: "Create backlog epic from F-XXX?" |
| Feature reaches `planned` without `epic_id` | Prompt: "Link epic to F-XXX?" |
| Feature reaches `shipped` | Prompt: "Create experiment to measure impact?" |
| 3+ ad-hoc changes without backlog items | Prompt: "Track these changes?" |

### Post-Completion

After any phase completes:
1. Store key results in working memory
2. Check backlog for newly unblocked items
3. Check `.product/` for feature lifecycle bridges (validated → epic, shipped → experiment)
4. Bridge to next action — never end with just a summary
5. Track untracked work — if 3+ ad-hoc changes without backlog items, prompt for capture

---

## Worker Spawning Protocol

When spawning parallel workers via copilot-cli-skill:

1. **Validate independence** — confirm items don't overlap on files
2. **Create worker prompts** — each worker gets a Mission Brief including:
   ```
   Invoke the `forge` skill as your first action.
   You are an autonomous worker. Complete the full explore→plan→execute→verify
   cycle for your assigned task.
   ```
3. **Register in hub** — `hub.workerRegister()` for each worker
4. **Monitor** — periodic `hub.workerSyncAll()`
5. **Validate & merge** — after completion, verify each worker's output

Workers load the `forge` coordinator skill and operate as autonomous mini-coordinators.

---

## Autonomous Council Triggers

Invoke experts-council **on your own initiative** (no user prompt) when:
- 2+ viable approaches, confidence < 70% after your own analysis
- Complex feature requiring long-term architectural choices
- Non-obvious tradeoff where evidence doesn't clearly favor one side
- Planning phase surfaces 3+ competing strategies

Prefix with: `🤖 Auto-consulted the experts council on: [topic]`

---

## Session Continuity

### On "continue where you left"

Reconstruct state from:
- Backlog (item states)
- Hub (worker status, findings)
- Session store SQL (prior checkpoints)

### Untracked Work Detection

After 3+ code-changing requests without backlog items:
```
"These changes aren't tracked:
1. [change]  2. [change]  3. [change]
Want me to create items under [epic] or a new epic?"
```

### Checkpointing

At turn 15 and every 15 turns: save state summary to session memory.

---

## Tier Classification

Quick classification from request text:

| Signal | Tier |
|--------|------|
| < 20 words + "fix"/"typo"/"rename" | T1 |
| Single file + "add"/"change"/"update" | T1-T2 |
| Multiple components + "implement"/"feature" | T3 |
| "refactor"/"migrate"/"redesign" | T4 |
| "security"/"auth"/"data migration"/"breaking" | T4-T5 |

Explore subagent confirms or overrides during investigation.

---

## Error Handling

| Scenario | Action | Limit |
|----------|--------|-------|
| Subagent returns unclear | Retry with refined prompt | 2 |
| Subagent blocked | Present options to user | — |
| Verification fails pass 2 | Escalate to user | 2 |
| Conflicting results | Use experts-council to break tie | 1 |

### Escalation Template

```
**Blocked:** [one-line issue]
**Tried:** 1. [attempt] — [result]  2. [attempt] — [result]
**Options:** 1. [A] — [tradeoff]  2. [B] — [tradeoff]
**Recommendation:** Option [X] because [reason].
```

Never swallow errors. Never fabricate facts. Never bypass a failed gate.
