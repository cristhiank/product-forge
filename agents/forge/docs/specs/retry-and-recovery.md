# Retry and Recovery

> When to retry, how many times, when to escalate, and how to handle near-miss outputs.

---

## Principles

1. **One retry, then escalate.** The coordinator gets at most one automatic retry per dispatch. If the retry also fails, surface the issue to the user.
2. **Retry the brief, not the format.** If a subagent delivered wrong results, the brief was probably unclear. Refine the brief on retry, don't just say "try again."
3. **Don't loop.** Two failed dispatches for the same objective means the problem is not recoverable by the coordinator alone.
4. **Partial progress is real.** If a subagent did useful work but the output is incomplete, acknowledge the progress and build on it — don't discard it.
5. **Self-correction is first-class recovery.** A subagent that catches its own error mid-execution (via `CORRECTION:`) has already performed the most efficient recovery possible — no retry needed. The coordinator should treat corrected output as recovered, not failed.

---

## Mid-Execution Recovery

Not all recovery requires a retry. Three mechanisms operate within a single dispatch:

### CORRECTION: — Real-Time Self-Correction

When a subagent discovers an error in its own reasoning or execution, it states `CORRECTION:` followed by what was wrong and what it is doing instead. This is the most efficient recovery mechanism because:
- No retry overhead — the subagent fixes the problem immediately
- Full context preserved — no context loss from re-dispatch
- Audit trail included — the correction is visible in the output

The coordinator should evaluate corrected output as normal. The presence of corrections is a positive quality signal.

### DEVIATIONS: — Audit Trail for Recovery Decisions

The `DEVIATIONS:` footer provides an audit trail when a subagent had to depart from instructions. If a retry is needed later, the deviation log tells the coordinator exactly what went differently and why — enabling a more targeted retry brief.

### Productive Uncertainty — Preventing False Recovery

When a subagent states assumptions explicitly (under `UNKNOWNS:` or inline), it prevents a class of false recovery: the coordinator retrying because the output "looks wrong" when it was actually correct under different assumptions. Stated assumptions make the recovery-or-accept decision clearer.

---

After a dispatch returns unsatisfactory output:

```
Evaluate the output
│
├── Output addresses the objective with evidence
│   → Accept. Proceed to next phase.
│
├── Output is incomplete but contains real progress
│   → Acknowledge progress. Dispatch a follow-up that builds on it.
│   → Do not re-dispatch the same brief.
│
├── Output missed the objective (wrong focus, scope drift)
│   → Refine the brief with clearer objective and constraints.
│   → Retry once with the improved brief.
│
├── Output is empty or incoherent
│   → Check if the subagent had sufficient context.
│   → Retry once with better context packaging.
│
└── Two dispatches for the same objective have failed
    → Surface to user: explain what was attempted, what failed, and what you recommend.
    → Do not retry again automatically.
```

---

## Retry Rules

| Rule | Detail |
|------|--------|
| Max automatic retries per objective | 1 |
| What changes on retry | The brief (clearer objective, better context, narrower scope) |
| What stays the same on retry | The run_id (for tracking continuity) |
| When NOT to retry | When the failure is not a brief-quality problem (e.g., tool unavailable, repo access lost) |

---

## Near-Miss Handling

A "near-miss" is when the subagent clearly did the work but the output doesn't cleanly communicate the result.

**What to do:**
1. Acknowledge the progress: "The investigation found X, Y, Z."
2. Extract what is usable from the output.
3. Decide whether the next phase can proceed with what was found.
4. If more is needed, dispatch a targeted follow-up — not a full redo.

**What NOT to do:**
- Discard useful findings because the output shape was wrong
- Present the work as failed when the evidence says it succeeded
- Retry the same broad brief hoping for better formatting

---

## Escalation

Surface to the user when:

- Two dispatches for the same objective have failed
- The subagent reports a blocker the coordinator cannot resolve (external dependency, missing access, policy issue)
- The subagent needs a design decision that only the user can make
- Scope is unclear and the coordinator cannot resolve the ambiguity from context

When escalating:

1. State what was attempted
2. State what the evidence shows (progress made, if any)
3. State the specific blocker or decision needed
4. Recommend an action (retry with different scope, ask a different question, manual intervention)

---

## Timeout Handling

If a subagent approaches its time budget:

- The subagent should stop cleanly and report what was completed
- The coordinator evaluates partial progress and decides whether to continue with a follow-up dispatch
- Timeout is not a failure — it's an indication that the scope was too large for one dispatch

---

## Recovery After Session Break

When a session is resumed:

1. Reconstruct active state from the session database and system notifications
2. Check for completed dispatches that returned while the session was inactive
3. Do not invent state, capability loss, or blockers that are not recorded or observed
4. If state is unknown, say so and recover it (inspect the repo, check backlog, read hub)

The session database (run tracking) is the source of truth. If the database and conversation history disagree, prefer the database.
