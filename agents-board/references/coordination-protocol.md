# Coordination Protocol

Workflow phases, gates, auto-proceed rules, context budgets, and pass limits.

---

## Workflow Phases

The task progresses through 8 states:

```
setup → exploration → ideation → planning → plan_verify → execution → result_verify → complete
```

Additional terminal states: `blocked`, `cancelled`

### Phase Descriptions

| Phase | Agent | Purpose | Output |
|-------|-------|---------|--------|
| **setup** | Orchestrator | Initialize task, parse user input | Goal, context, constraints |
| **exploration** | Scout | Discover facts, cache snippets | Facts (F-n), snippets (X-n) |
| **ideation** | Creative | Generate approaches, propose decisions | Decision proposals (D-n) |
| **planning** | Orchestrator | Create execution plan from approved approach | Plan (P-1) with steps |
| **plan_verify** | Verifier | Validate plan before execution | Approved/revision required |
| **execution** | Executor | Implement plan steps | Code changes, trails (TR-n) |
| **result_verify** | Verifier | Validate execution results | Pass/fail with critique |
| **complete** | Orchestrator | Finalize, archive trail | Task summary |

---

## Phase Collapsing by Complexity

Not all tasks need the full pipeline. Orchestrator collapses phases based on complexity score (0-10+).

### Complexity Scoring

| Score | Type | Characteristics |
|-------|------|-----------------|
| 0-2 | **Simple** | Single file, < 50 lines, well-understood pattern |
| 3-6 | **Standard** | Multiple files, moderate scope, established patterns |
| 7-9 | **Complex** | Architectural changes, novel patterns, many files |
| 10+ | **Security/Critical** | Security implications, data integrity, user safety |

### Collapsed Workflows

#### Simple (0-2)

```
setup → exploration → planning → execution → result_verify → complete
```

**Skip:** ideation (Creative), plan_verify
**Rationale:** Approach is obvious, plan is straightforward

**Example:** Add a new utility function to existing module

---

#### Standard (3-6)

```
setup → exploration → ideation → planning → plan_verify → execution → result_verify → complete
```

**Skip:** Deep-dive exploration (if high-confidence facts available)
**Rationale:** May need creative thinking, plan should be verified

**Example:** Implement magic link authentication

---

#### Complex (7-9)

```
setup → exploration (deep-dive) → ideation → planning → plan_verify → execution → result_verify → complete
```

**Skip:** None
**Rationale:** Requires thorough understanding, multiple approaches, rigorous verification

**Example:** Refactor authentication system to support multiple strategies

---

#### Security/Critical (10+)

```
setup → exploration (deep-dive) → ideation → planning → plan_verify → execution → result_verify (thorough) → USER GATE → complete
```

**Skip:** Never skip verification
**Additional:** User gate before completion, extended verification

**Example:** Implement payment processing, change access control logic

---

## Auto-Proceed Rules (Gates)

Gates determine when Orchestrator should proceed automatically vs. ask user.

### Post-Exploration Gate

**Auto-proceed if:**
- ✅ Complexity ≤ 2 (Simple)
- ✅ No `blocking_questions` raised by Scout
- ✅ No security/safety concerns
- ✅ High-confidence facts ≥ 3

**User gate if:**
- ❌ Complexity ≥ 7 (Complex)
- ❌ Scout raised `blocking_questions`
- ❌ Missing critical information (facts < 3)
- ❌ Security/safety tags present

**Orchestrator message format (user gate):**
```
Scout discovered N facts about the codebase.

Key findings:
- [F-1] Fact 1
- [F-2] Fact 2

Blocking questions:
- Q1: ...
- Q2: ...

How should I proceed?
```

---

### Post-Ideation Gate

**Auto-proceed if:**
- ✅ Only 1 viable approach proposed
- ✅ Complexity ≤ 4
- ✅ No conflicting decisions
- ✅ Approach aligns with existing patterns (facts)

**User gate if:**
- ❌ Multiple viable approaches (≥ 2)
- ❌ Complexity ≥ 7
- ❌ Novel architectural decision
- ❌ Trade-offs require domain knowledge

**Orchestrator message format (user gate):**
```
Creative proposed N approaches:

[D-1] Approach A
- Pros: ...
- Cons: ...

[D-2] Approach B
- Pros: ...
- Cons: ...

Recommendation: [D-1] because ...

Which approach should I use?
```

---

### Post-Plan-Verify Gate

**Auto-proceed if:**
- ✅ Complexity ≤ 6 (Standard)
- ✅ Verifier approved with 0 blocking issues
- ✅ All plan steps have clear done_when criteria

**User gate if:**
- ❌ Complexity ≥ 7 (Complex)
- ❌ Verifier flagged blocking issues
- ❌ Plan requires user confirmation

**Orchestrator message format (user gate):**
```
Plan verified with M issues:

Blocking issues:
- [Issue 1]

Non-blocking concerns:
- [Issue 2]

Proceed with execution?
```

---

### Post-Execution Gate

**Auto-proceed if:**
- ✅ Simple task (complexity ≤ 2)
- ✅ All steps completed successfully
- ✅ No alerts raised

**User gate ALWAYS if:**
- ❌ Complexity ≥ 7 (Complex)
- ❌ Security/critical task (≥ 10)
- ❌ User requested review

**Orchestrator message format:**
```
Execution complete. M/N steps done.

Changes:
- Created: [files]
- Modified: [files]

Ready for verification.
```

---

### Post-Result-Verify Gate

**Auto-complete if:**
- ✅ Verifier passed all checks
- ✅ Complexity ≤ 6
- ✅ No warnings

**User gate if:**
- ❌ Verifier found issues (even minor)
- ❌ Security/critical task
- ❌ User requested final review

**Orchestrator message format (user gate):**
```
Verification found N issues:

Critical:
- [Issue 1]

Warnings:
- [Issue 2]

Options:
A. Fix and re-verify
B. Accept as-is
C. Cancel task

Recommendation: [Option] because ...
```

---

## Context Budgets

Limits to prevent token bloat and maintain focus.

### Per-Agent Limits

| Resource | Scout | Creative | Verifier | Executor |
|----------|:-----:|:--------:|:--------:|:--------:|
| Snippets | 5 | 3 | 5 | 3 per step |
| Facts | 10 | 5 | 10 | 5 per step |
| Tool calls | 15-25 | 5-10 | 15-25 | varies |
| Snippet size | 100 lines | 50 lines | 100 lines | 100 lines |

### Snippet Selection Priority

When budget exceeded, Orchestrator selects by priority:

1. **Target files** (tagged `target` or in plan steps)
2. **Recent** (created/updated in current phase)
3. **High-confidence evidence** (referenced by high-confidence facts)
4. **Relevant tags** (match current step or decision)

### Fact Selection Priority

1. **High confidence** first
2. **Verified** over unverified
3. **Recent** over old
4. **Relevant tags** (match current phase)

### Tool Call Guidelines

| Task Complexity | Scout | Executor | Verifier |
|----------------|:-----:|:--------:|:--------:|
| Simple (0-2) | 5-8 | 3-5 per step | 3-5 |
| Standard (3-6) | 10-15 | 5-10 per step | 8-12 |
| Complex (7-9) | 15-25 | 10-20 per step | 15-25 |
| Security (10+) | 20-30 | 15-25 per step | 20-30 |

**Rationale:** Balance thoroughness with efficiency.

---

## Pass Limits (HARD)

Prevent infinite loops when verification fails.

### Plan Verification

**Max passes:** 2

**Pass 1:**
- Verifier reviews entire plan
- Flags all issues (blocking + non-blocking)
- Returns critique with specific line items

**Pass 2:**
- Verifier re-checks ONLY flagged items
- Passes if blocking issues resolved
- Ignores new issues (scope creep)

**If Pass 2 fails:**
- Orchestrator escalates with `severity="blocker"` alert
- Presents options to user:
  - A. Simplify plan
  - B. Get more information (Scout deep-dive)
  - C. Cancel task

---

### Result Verification

**Max passes:** 2

**Pass 1:**
- Verifier checks execution against plan `done_when` criteria
- Validates code quality, tests, build
- Returns critique with specific issues

**Pass 2:**
- Verifier re-checks ONLY flagged items
- Executor must explain what changed from Pass 1
- Passes if criteria met

**If Pass 2 fails:**
- Orchestrator escalates with options:
  - A. Accept current state (document limitations)
  - B. Revise plan (reduce scope)
  - C. Get user guidance
  - D. Cancel task

---

### Escalation Protocol

When max passes exceeded:

```javascript
board.raiseAlert({
  severity: "blocker",
  title: "Verification failed after 2 passes",
  description: `
    Attempted:
    - Pass 1: [issues found]
    - Pass 2: [remaining issues]
    
    Options:
    A. [Option 1] - [tradeoffs]
    B. [Option 2] - [tradeoffs]
    C. [Option 3] - [tradeoffs]
    
    Recommendation: [Option] because [rationale]
  `,
  tags: ["verification", "escalation", "user_decision"]
});
```

Orchestrator then presents to user and awaits decision.

---

## Self-Contained Prompts

Every subagent invocation must be fully self-contained. No "check the board" instructions.

### Required Elements

```xml
<objective>
[Clear, specific task for this agent]
</objective>

<context>
[All necessary information inline]
- Task ID: T-1
- Complexity: 5
- Phase: execution
- Facts: [F-1 through F-5 with full content]
- Snippets: [X-1 through X-3 with full content]
- Decisions: [D-1 approved decision with full details]
- Plan: [Current step with done_when criteria]
</context>

<constraints>
[All constraints that apply]
- [Constraint 1]
- [Constraint 2]
</constraints>

<output>
[Expected output format]
Return XML with ...
</output>

<recap>
[3-5 bullet summary of above]
- Goal: ...
- Context: ...
- Output: ...
</recap>
```

### Why Self-Contained?

1. **Stateless agents** — Each invocation is independent
2. **Debuggable** — Complete context visible in prompt
3. **Reproducible** — Same input → same output
4. **No assumptions** — Agent doesn't "remember" previous calls

### Anti-Pattern

❌ **Don't do this:**
```xml
<objective>
Continue execution from where you left off.
Check the board for current step.
</objective>
```

✅ **Do this:**
```xml
<objective>
Implement Step 2: Add POST /auth/magic endpoint
</objective>

<context>
Current step: 2 of 4
Step title: Add POST /auth/magic endpoint
Description: Accept email, generate token, send link
Done when:
- Endpoint returns 200
- Email sent via SendGrid
- Token stored in Redis

Relevant snippets:
[X-1] src/auth/token.ts (token generation logic)
[X-2] src/services/email.ts (SendGrid integration)

Relevant facts:
[F-3] SendGrid API key stored in env var SENDGRID_API_KEY
[F-5] Redis client available at src/lib/redis.ts

Approved decision:
[D-1] Use crypto.randomBytes for token generation
</context>
```

---

## Phase Transition Rules

### From Exploration to Ideation

**Transition when:**
- Scout completed (no active scout_requests)
- Facts ≥ 3 with high confidence
- No blocking questions OR user answered them

**Skip ideation if:**
- Complexity ≤ 2 (approach is obvious)
- User provided explicit implementation instructions

---

### From Ideation to Planning

**Transition when:**
- At least 1 decision proposed
- Orchestrator approved a decision OR auto-selected (only 1 option)

**Loop back to exploration if:**
- Creative raised scout_requests
- Critical unknowns discovered

---

### From Planning to Plan-Verify

**Always transition** (never skip plan verification)

**Exception:** Complexity 0-1 AND single-step plan

---

### From Plan-Verify to Execution

**Transition when:**
- Verifier approved plan
- All blocking issues resolved
- User approved (if gated)

**Loop back to planning if:**
- Blocking issues in Pass 2
- User requested plan changes

---

### From Execution to Result-Verify

**Transition when:**
- Executor completed all steps OR failed with escalation

**Always transition** (never skip result verification)

---

### From Result-Verify to Complete

**Transition when:**
- Verifier passed all checks
- User approved (if gated)
- No active blocker alerts

**Loop back to execution if:**
- Verifier found fixable issues
- Executor re-executed with changes

---

### To Blocked

**Transition when:**
- Blocker alert raised and not resolved
- User input required but not provided
- External dependency unavailable

**Recovery:** User resolves blocker → resume from current phase

---

### To Cancelled

**Transition when:**
- User explicitly cancels
- Unresolvable blocker
- Verification failed after escalation and user chose cancel

---

## Context Passing Between Agents

### Orchestrator → Scout

```javascript
{
  objective: "Explore codebase for authentication implementation",
  mode: "focused_query", // or quick_scan, deep_dive
  focus: ["Auth routes", "Token handling", "Email integration"],
  constraints: ["Do not modify files", "Focus on src/ directory"],
  task_id: "T-1"
}
```

### Scout → Orchestrator

```javascript
{
  facts: ["F-1", "F-2", "F-3"], // IDs only
  snippets: ["X-1", "X-2"], // IDs only
  blocking_questions: ["How should expired tokens be handled?"],
  confidence: "high", // overall confidence in findings
  scout_requests: [] // empty if complete
}
```

### Orchestrator → Creative

```javascript
{
  objective: "Design approach for magic link authentication",
  context: {
    facts: [/* full F-1, F-2, F-3 content */],
    snippets: [/* full X-1, X-2 content */],
    constraints: [...]
  },
  task_id: "T-1"
}
```

### Creative → Orchestrator

```javascript
{
  decisions: ["D-1", "D-2"], // IDs of proposed decisions
  recommendation: "D-1",
  rationale: "Aligns with existing patterns (X-1#L45)",
  scout_requests: ["What is the email rate limit?"] // if needs more info
}
```

### Orchestrator → Executor

```javascript
{
  objective: "Implement Step 2: Add POST /auth/magic endpoint",
  context: {
    plan: {/* current step details */},
    snippets: [/* relevant X-n */],
    facts: [/* relevant F-n */],
    decisions: [/* approved D-n */]
  },
  task_id: "T-1"
}
```

### Executor → Orchestrator

```javascript
{
  status: "completed", // or "failed", "needs_scout"
  step: 2,
  changes: {
    created: ["src/routes/auth.ts"],
    modified: ["src/app.ts"]
  },
  snippets_updated: ["X-2"], // refreshed after edit
  trails: ["TR-1", "TR-2"], // logged decisions
  scout_requests: [] // if needs more info
}
```

### Orchestrator → Verifier

```javascript
{
  mode: "plan_verify", // or "result_verify"
  objective: "Verify execution plan for magic link auth",
  context: {
    plan: {/* full plan */},
    facts: [/* supporting facts */],
    decisions: [/* approved decisions */]
  },
  pass_number: 1, // 1 or 2
  previous_critique: null, // or critique from pass 1
  task_id: "T-1"
}
```

### Verifier → Orchestrator

```javascript
{
  status: "approved", // or "revision_required"
  critique: [
    {
      severity: "blocking",
      item: "Step 3",
      issue: "Missing error handling",
      suggestion: "Add try/catch for email sending"
    }
  ],
  pass: 1,
  confidence: "high"
}
```

---

## Workflow State Machine

```
┌─────────┐
│  setup  │
└────┬────┘
     │
     ▼
┌─────────────┐     scout_requests     ┌──────────┐
│ exploration ├──────────────────────▶│ LOOP     │
└──────┬──────┘◀──────────────────────┘          │
       │                                          │
       │ (auto/gate)                              │
       ▼                                          │
┌──────────┐     scout_requests                  │
│ ideation ├──────────────────────────────────────┘
└────┬─────┘
     │ (decision approved)
     ▼
┌──────────┐
│ planning │
└────┬─────┘
     │
     ▼
┌──────────────┐     revision_required     ┌──────────┐
│ plan_verify  ├────────────────────────▶  │ LOOP (2x)│
└──────┬───────┘◀────────────────────────  └──────────┘
       │                                          │
       │ (approved)                               │ (max passes)
       │                                          ▼
       │                                    ┌──────────┐
       │                                    │ blocked  │
       │                                    └──────────┘
       ▼
┌───────────┐     scout_requests          ┌─────────────┐
│ execution ├─────────────────────────▶   │ exploration │
└─────┬─────┘                             └─────────────┘
      │
      ▼
┌───────────────┐     revision_required   ┌──────────┐
│ result_verify ├──────────────────────▶  │ LOOP (2x)│
└───────┬───────┘◀──────────────────────  └──────────┘
        │                                        │
        │ (approved)                             │ (max passes)
        │                                        ▼
        │                                  ┌──────────┐
        │                                  │ blocked  │
        │                                  └──────────┘
        │
        ▼
  ┌──────────┐
  │ complete │
  └──────────┘
```

---

## Summary

| Element | Rule |
|---------|------|
| **Phases** | 8 states, collapsible by complexity |
| **Gates** | Auto-proceed for simple, user gate for complex |
| **Context budgets** | Max 5 snippets, 10 facts per agent |
| **Pass limits** | Max 2 verification passes, then escalate |
| **Prompts** | Always self-contained with full context inline |
| **Transitions** | Explicit rules based on completion + confidence |
| **Escalation** | Present options with tradeoffs + recommendation |

This protocol ensures predictable, debuggable workflows that scale from trivial to critical tasks.
