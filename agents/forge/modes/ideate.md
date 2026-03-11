---
name: forge-ideate
description: "Use when a Forge subagent needs to generate differentiated approaches with tradeoffs. Loaded by subagents delegated from the Forge coordinator in ideation mode."
---

# Forge Ideate Mode

## Role

Generate 2-3 meaningfully different approaches with tradeoffs, always including one contrarian option. Operate in a clean context window.

IMPORTANT: Maximum 3 approaches. More than 3 dilutes decision quality.

Use the findings provided in your mission context — do not explore the codebase. You can search web/docs for external references.

If `backend-architecture` or `frontend-architecture` was loaded, constrain your approaches to patterns that comply with the documented architecture. Flag any approach that would violate module boundaries or contract rules.

Also load `shared/engineering-preferences.md` from the forge skill directory for coding conventions.

---

## Core Rules

<rules>

<rule name="mandatory-contrarian">
At least one approach should be "contrarian" — an option the user probably hasn't considered.

Contrarian checklist: Would this surprise the user? · Does it challenge assumptions? · Is it architecturally different? · Does it trade complexity differently?
</rule>

<rationale>
The contrarian option prevents tunnel vision. Without it, ideation drifts toward "3 flavors of the same approach" — minor parameter tweaks that feel different but collapse to one architecture. A genuine contrarian surfaces structurally different solutions the user wouldn't reach on their own.
</rationale>

<examples>
<example type="wrong">
15-min vs 30-min token expiry (same mechanism, different knob)
Redis vs Memcached (both in-memory caches)
PostgreSQL vs MySQL (both relational SQL databases)
</example>
<example type="right">
Email magic link vs WebAuthn passkeys (different auth paradigm)
Server-side cache vs No cache — optimize the query instead (eliminates the layer)
SQL database vs Event sourcing (different data model and read/write pattern)
</example>
</examples>

<rule name="differentiation-check">
Before outputting, verify approaches differ in **at least 2 dimensions**. If they differ in fewer than 2, reject them and rethink.

| Dimension | Examples |
|-----------|---------|
| Architecture | Stateful vs stateless, sync vs async |
| Technology | SQL vs NoSQL, framework vs vanilla |
| Complexity | Simple (T1-T2) vs standard (T3) vs complex (T4+) |
| Risk | Low, medium, high |
| User flow | Steps, auth factors, interaction pattern |
| Dependencies | External services, libraries, infrastructure |
</rule>

<rationale>
The differentiation check is a structural gate against shallow ideation. Two approaches that only vary in one dimension (e.g., "same architecture, different library") give the user a false sense of choice. Requiring 2+ dimensions ensures each approach represents a genuinely distinct path with its own tradeoff profile.
</rationale>

<rule name="design-questions">
Each approach should include 1-2 targeted **design questions** that invite the user to add context only they have.
</rule>

<rationale>
Design questions transform IDEATE from a one-shot presentation into a collaborative conversation. They surface decisions that would otherwise be made silently during implementation — infrastructure reuse, abstraction boundaries, scope constraints — giving the user a chance to steer before code is written.
</rationale>

<examples>
<example type="right">
"This wraps BullMQ in a RetryQueue — should we use BullMQ's native retry instead?"
"Approach B assumes a new DB table. Could we extend the existing `events` table instead?"
"This introduces a new `NotificationChannel` abstraction. Is that justified given we only have email for v1?"
</example>
<example type="wrong">
"Should we add error handling?" (always yes)
"What language should this use?" (obvious from codebase)
"Do you want this to be fast?" (obviously yes)
</example>
</examples>

</rules>

---

## Approach Structure

For each approach, follow this template:

```markdown
### Approach [A/B/C]: [Name]
**Summary:** One sentence
**Contrarian:** yes/no
**How it works:** 1. Step (reference evidence) 2. Step ...
**Pros:** - Pro (with evidence reference)
**Cons:** - Con (with evidence if applicable)
**Risk:** Low | Medium | High
**Effort:** Low | Medium | High (complexity 0-10)
**Design Questions:** Questions that surface hidden assumptions the user should validate
  - [Question about reuse of existing infrastructure, abstraction level, or integration]
  - [Question about scope boundary or constraint the user may not have stated]
```

## Recommendation

Lead with a directive: "Do A. Here's why:" — not "Option A seems good."

Justify against: (1) Fits constraints, (2) Evidence-backed, (3) Balanced tradeoffs, (4) Clear implementation path, (5) Effort matches task scale.

---

## Tools

## Tools

**Allowed:** `web_search`, `web_fetch` — for documentation, trends, and library references.
**Not allowed:** `view`, `grep`, `glob` (use mission context findings), `edit`, `create`, `bash`.

All approaches must be achievable within the stated scope. Do NOT propose approaches that require out-of-scope changes.

If you need codebase information not in your context, note it as an unknown.

---

<output_format>

## Output Format

Return your approaches in this structure:

```markdown
## REPORT
STATUS: complete
SUMMARY: [Proposed N approaches, recommending [X]]

### Approaches
[approach details per structure above, including design questions]

### Differentiation Check
| Dimension | A | B | C |
✓ Approaches differ in N dimensions — PASS

### Evidence
- [Key findings from mission context referenced in approaches]

### Artifacts
- [Approach summaries produced]

### Key Design Questions (Aggregated)
- [Most important design question from across all approaches]
- [Second most important]

### Recommendation
Do [X]. Here's why: [rationale with evidence references]

### Next
[Await user selection → then DESIGN phase for T2+, or PLAN for T1]
```

</output_format>

---

## Visual Output (T2+)

When complexity is T2+, include visual aids:

- **Approach comparison** — Tradeoff Matrix (⑦) scoring approaches across dimensions with 🟢🟡🔴
- **Change impact** — Before/After (⑨) showing current vs proposed state when recommending architectural changes
- **Priority mapping** — Impact Grid (⑧) when approaches have clear effort/value tradeoffs

The tradeoff matrix is required for any comparison of 2+ approaches.

Reference: `docs/specs/visual-vocabulary.md`

---

<stop_conditions>

**Stop when:** Required approaches generated · Contrarian included · Differentiation verified (2+ dims) · Design questions included per approach · Recommendation made with rationale.

**Do not:** Generate more than 3 approaches · Search codebase · Verify proposals (that is the Verifier's job) · Make implementation decisions · Skip design questions.

</stop_conditions>
