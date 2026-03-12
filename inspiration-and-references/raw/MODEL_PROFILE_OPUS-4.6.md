# Claude Opus 4.6 — Reasoning Profile

> Mined from 7,668 reasoning events across 424 sessions (3.03M chars total)

---

## Personality Archetype: The Rapid Operator

Opus 4.6 is an **action-first executor**. It produces the shortest average reasoning (395 chars, median just 97 chars) but at massive volume — 7,668 events, 4× more than any other model. It thinks in tight operational bursts: identify next action → reason briefly → execute → repeat.

**Defining trait:** 47% of its reasoning is operational ("let me check/read/search/create") vs only 26% analytical. When it encounters a problem, it reaches for tools *immediately* rather than building a mental model first. Its top sentence starter is "Let" (2,942 instances) — as in "Let me check...", "Let me read...", "Let me verify...".

**Voice:** Less first-person than GPT (31.7 "I" per 10K vs 72), more imperative. Frequent starters: "Let", "The", "This", "But", "Now", "Read", "Check", "Create". It talks *to itself* in commands rather than narrating a thought process.

---

## What Gives It Clarity

1. **Action-oriented framing** — Opus thrives when instructions are phrased as operations: "Read X, then create Y, then verify Z". It translates vague goals into concrete action sequences almost instantly.

2. **Rich structural scaffolding** — It uses the most formatting in its reasoning: **bold markers** (18.2/10K), **bullet lists** (8.5/10K), **numbered lists** (21.0/10K). Prompts that provide structured context (tables, labeled sections, checklists) get processed faster.

3. **Contract-driven tasks** — When given a schema, protocol, or template to follow, Opus excels. It treats contracts as operational checklists and methodically fills them in. The experts-council verdicts (its strongest outputs) follow a rigid table-based format.

4. **Immediate feedback loops** — Opus produces 60% of its reasoning events under 200 chars. It doesn't need to think deeply about each step — it prefers many small steps with tool verification between them. Give it the ability to check its work frequently.

---

## What Confuses It

1. **Ambiguous stopping criteria** — Opus's operational momentum means it can keep going indefinitely. Without clear "done" signals, it will keep finding more things to check, more files to read, more patterns to verify. It's the model most likely to exhaust tool budgets.

2. **Multi-layered intent** — When a user message contains both a question ("should we...?") and an implicit action ("let's do X"), Opus tends to answer the question briefly and immediately proceed to action. It can miss nuanced "let's discuss first" signals.

3. **Contradicting contracts** — It references instructions more than GPT (1.4/10K) but has the lowest override tendency (0.2/10K). When two rules conflict, it tends to follow the most recently stated one rather than reasoning about which is more important.

4. **Over-spawning sub-agents** — Known behavioral pattern (documented in `CLAUDE_AGENTIC_PROMPTING.md`). Its action-first nature makes it dispatch sub-agents aggressively. It may launch 4 parallel agents where 2 would suffice.

---

## Behavior Patterns

### Reasoning Length Distribution
| Range | Count | % |
|-------|-------|---|
| <200 chars | 4,665 | **60%** |
| 200–1K | 2,199 | 28% |
| 1K–5K | 768 | 10% |
| 5K+ | 36 | 0.5% |

60% of reasoning is micro-bursts under 200 chars. This is "check → act → check → act" rhythm. The 5K+ events (36) are deep analysis moments — code reviews, architecture evaluations — where it switches to analytical mode.

### Self-Correction: The "Actually" Pattern
- **Highest self-correction rate: 6.0/10K** (3× GPT-5.4)
- 1,705 self-correction events detected
- Signature pattern: "Actually, I'm reconsidering..." / "Actually, from my knowledge..." / "Wait, let me check..."
- Opus catches its own mistakes *during execution* rather than before starting. It explores, hits a wall, corrects, and continues. This is its strength — rapid error recovery.

### Tool Selection Reasoning
- **287 avg chars before `bash`** — minimal deliberation, just executes
- **54 avg chars before `apply_patch`** — almost no reasoning before editing (!)
- **491 avg chars before `report_intent + view`** — thinks more when doing contextual reading
- **297 avg chars before `report_intent + skill`** — brief reasoning before skill invocation

Opus barely reasons before editing code (54 chars avg). It edits speculatively and relies on tests/verification to catch errors. This is efficient when tests exist, risky when they don't.

### Proactiveness Profile
- **404 proactiveness signals** — highest absolute count
- Rate: 3.1/10K — similar to GPT but expressed differently
- **Pattern:** "Let me also..." — it proactively *expands scope* during execution rather than suggesting expansions
- It doesn't ask "should I also check X?" — it just checks X

### Instruction Adherence
- **Highest instruction referencing** (1.4/10K) — explicitly tracks rules and contracts
- **Lowest override tendency** (0.2/10K) — rarely deviates from stated instructions
- Opus follows instructions faithfully but can be *too* faithful — it may execute a suboptimal instruction literally rather than adapting

---

## Influence Levers

### To Increase Proactiveness
- Already highly proactive — the challenge is *directing* its proactiveness
- Use **"also consider..."** phrasing to guide its natural expansion tendency
- Frame scope as **inclusive**: "This includes but is not limited to..." triggers broader coverage
- Opus naturally does "Let me also check..." — just ensure the right things are in its checklist

### To Improve Instruction Adherence (without rigidity)
- Use **tiered instructions**: "MUST" for hard requirements, "PREFER" for soft ones, "MAY" for optional
- The **contract format** works best — schemas, templates, checklists. Opus treats these as operational specs
- Avoid narrative instructions — use structured rules. Opus processes "Rule 1: X. Rule 2: Y." faster than "When doing X, remember to Y because Z"
- **Add explicit stopping criteria** — "Stop after finding 5 issues" or "Stop when all files in /src are reviewed"

### To Allow Productive Override
- Add **escape hatch clauses**: "If a rule would produce worse results, note the deviation and explain why"
- Opus currently has the lowest override rate — it needs *explicit permission* to deviate
- Use **"unless you determine..."** phrasing: "Follow format X unless you determine a different format better communicates the findings"
- Frame overrides as **operational decisions** not philosophical ones: "Choose the approach that requires fewer tool calls" rather than "Use your best judgment"

### Anti-Patterns to Avoid
- **Don't use heavy "CRITICAL/MUST" language everywhere** — Opus overtriggers on urgency signals and may over-scope
- **Don't give unlimited scope** — it will explore exhaustively. Always bound the search space
- **Don't rely on it to stop itself** — add explicit tool budgets, iteration limits, or done-criteria
- **Don't expect deep deliberation** — if you need analytical depth, ask for it explicitly: "Before acting, write a 3-paragraph analysis of..."
- **Don't assume it reads full instructions** — Opus processes structured rules better than long prose. If prose is necessary, put the critical rules in bold or at the top

---

## Summary: Prompt Engineering Principles for Opus 4.6

| Principle | Rationale |
|-----------|-----------|
| **Structured contracts** | Tables, schemas, checklists — mirrors its operational processing |
| **Explicit bounds** | Tool budgets, iteration limits, stopping criteria — contains its momentum |
| **Tiered rules** | MUST/PREFER/MAY — lets it distinguish hard from soft constraints |
| **Action-oriented language** | "Read X, create Y, verify Z" — aligned with its operational style |
| **Permission to override** | Explicitly state when deviation is welcome — it won't deviate by default |
| **Small, frequent checkpoints** | Aligned with its burst-reasoning rhythm |
