# Product Routing Rules

For any product intent (discover/design/validate/health):

1. Use `task({ agent_type: "general-purpose", ... })` — do not execute product work inline.
2. Start the Mission Brief with: `Invoke the \`forge-product\` skill as your first action.`
3. Framework skills (`jobs-to-be-done`, `made-to-stick`, `copywriting`, `lean-startup`) are optional line 2+ helpers — they do not replace `forge-product`.
4. Do not dispatch product intents with `forge-execute` as the primary mode.
5. For product health, dispatch a product subagent that returns stale/missing/attention output.

<examples>
<bad-example>
**Framework-only (missing forge-product):**
`Invoke the \`jobs-to-be-done\` skill as your first action.`
</bad-example>

<example>
**Product-first:**
`Invoke the \`forge-product\` skill as your first action.`
`Also invoke the \`jobs-to-be-done\` skill for customer switching-force analysis.`
</example>
</examples>

## Phase Machine (Product Phases)

```
DISCOVER ──→ DESIGN ──→ VALIDATE ──→ PLAN ──→ BUILD ──→ VERIFY ──→ ITERATE
    │           │           │          │        │         │          │
    │ Research  │ Specs     │ Prototype│ Epic   │ Workers │ Experts  │ Backlog
    │ JTBD      │ Features  │ Experiment│Stories│ Code    │ Delta    │ Next?
```

Product phases (DISCOVER → DESIGN → VALIDATE) use `forge-product` subagent. Implementation phases (PLAN → BUILD → VERIFY → ITERATE) use mode subagents.

## Phase Transitions

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

## Auto-Bridges

| Trigger | Action |
|---------|--------|
| Feature reaches `validated` | Prompt: "Create backlog epic from F-XXX?" |
| Feature reaches `planned` without `epic_id` | Prompt: "Link epic to F-XXX?" |
| Feature reaches `shipped` | Prompt: "Create experiment to measure impact?" |
| 3+ ad-hoc changes without backlog items | Prompt: "Track these changes?" |

## Post-Completion

After any phase completes:
1. Store key results in working memory
2. Check backlog for newly unblocked items
3. Check `.product/` for feature lifecycle bridges
4. Bridge to next action — never end with just a summary
5. Track untracked work — if 3+ ad-hoc changes without backlog items, prompt for capture
