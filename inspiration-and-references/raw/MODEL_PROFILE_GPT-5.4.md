# GPT-5.4 — Reasoning Profile

> Mined from 1,534 reasoning events across 16 sessions (1.36M chars total)

---

## Personality Archetype: The Contemplative Analyst

GPT-5.4 is a **deliberator**. It thinks longer per event (avg 892 chars, median 469) than Opus, favors understanding *why* before deciding *what*, and approaches problems by building mental models rather than jumping into tool calls.

**Defining trait:** It reasons *about* the problem more than it reasons *toward* the next action. 46% of its reasoning events are analytical ("the issue is...", "because...", "this means...") vs only 28% operational ("let me check..."). This is the inverse of Opus.

**Voice:** Highly first-person — 72 "I" per 10K chars (2.3× Opus). Sentences frequently start with "It", "The", "Let", "Maybe", "Since", "However". It narrates its own thought process conversationally, almost journaling its way through problems.

---

## What Gives It Clarity

1. **Bold-header scaffolding in its own thinking** — GPT-5.4 self-organizes with `**Bold labels**` (10.3/10K) as cognitive anchors. When it creates these headers, it stays on track. Prompts that mirror this structure (clear labeled sections) reduce its deliberation time.

2. **Concrete problem framing** — It excels when the problem is well-defined. Its strongest traces come from code review scenarios where it can trace through specific files and find specific bugs. It produces excellent analytical depth ("The Facebook email mapper is using `hardcoded-attribute-idp-mapper` which literally sets the user attribute `email` to the **string literal** 'email'").

3. **Clear success criteria** — When it knows what "done" looks like, it converges faster. Ambiguous goals trigger its uncertainty loop.

4. **Numbered steps** (5.5/10K) — It naturally organizes into numbered plans. Prompts that ask for step-by-step approaches align with its native reasoning style.

---

## What Confuses It

1. **Choice paralysis** — GPT-5.4 has the highest uncertainty rate of any model: **23.8 per 10K chars** (8× higher than Opus). Words like "maybe" (226 sentence starters), "perhaps", "probably", "might be" saturate its reasoning. When faced with multiple valid approaches, it can spiral into deliberation without converging.

2. **Open-ended scope** — It struggles with "review everything and find issues" more than "check if X is correct". It produces better work when given focused targets.

3. **Contradicting signals** — 64 instances of instruction tension detected. It notices contradictions ("the frontend might not use the authorization contract since it includes the catalog, but there is an endpoint that exists") but can get stuck weighing them rather than choosing.

4. **Low self-correction rate (2.1/10K)** — Unlike Opus which frequently says "actually, wait..." to correct course, GPT-5.4 tends to commit to its first interpretation. When that interpretation is wrong, it doesn't naturally self-correct — it just adds more uncertainty hedging.

---

## Behavior Patterns

### Reasoning Length Distribution
| Range | Count | % |
|-------|-------|---|
| <200 chars | 108 | 7% |
| 200–1K | 1,025 | **66%** |
| 1K–5K | 385 | 25% |
| 5K+ | 16 | 1% |

The sweet spot is 200–1K chars — it consistently reasons at this depth. The 5K+ traces are its deepest analytical work (code reviews, architecture evaluations).

### Tool Selection Reasoning
- **846 avg chars before `bash`** — substantial deliberation before running commands
- **934 avg chars before `apply_patch`** — thinks longest before editing code
- **559 avg chars before `rg + view`** — less deliberation for read-only exploration
- **828 avg chars before `bash + sql`** — heavy reasoning when combining tools

GPT-5.4 thinks *about* what tool to use rather than trying tools speculatively. This makes it accurate but slower.

### Proactiveness Profile
- **186 proactiveness signals** detected ("I should also check...", "It might be useful to...")
- Rate: 2.7/10K — moderate. It notices tangential opportunities but hedges rather than acts.
- **Pattern:** "I should also → check/inspect/verify" — it proactively *investigates* but doesn't proactively *fix* without being asked.

### Instruction Adherence
- **Lowest explicit instruction referencing** (0.8/10K) — rarely says "the instructions say..." or "according to the rules..."
- **Highest override tendency** (0.5/10K) — more likely to say "but it's better to..." or "pragmatically..."
- GPT-5.4 internalizes instructions as background context rather than explicitly tracking them. It follows the *spirit* more than the *letter*.

---

## Influence Levers

### To Increase Proactiveness
- Frame objectives as "comprehensive" or "thorough" — triggers its analytical depth
- Give explicit permission: "go beyond the specific request if you spot related improvements"
- Reduce choice overload by pre-narrowing the option space ("choose between A or B" not "figure out the best approach")

### To Improve Instruction Adherence
- Use **bold labeled sections** that mirror its natural reasoning structure
- State rules as **positive constraints** ("always do X") not negative ("don't do Y") — GPT-5.4 processes positive frames more naturally
- Include a checklist format — it naturally gravitates toward numbered lists

### To Allow Productive Override
- Add explicit escape hatches: "If you determine a more effective approach exists, note the deviation and proceed"
- Frame instructions as *defaults* not *absolutes*: "default approach is X; override with justification"
- GPT-5.4 already naturally overrides via pragmatic reasoning — just make it explicit that this is welcome

### Anti-Patterns to Avoid
- **Don't give vague scope** — it will spiral into uncertainty hedging
- **Don't use heavy "CRITICAL/MUST/NEVER" language** — it doesn't rebel, but it also doesn't internalize aggressive tone better than neutral framing
- **Don't ask it to "just do it"** — it needs to deliberate. Rushing produces lower quality, not faster output
- **Don't present >3 options** without ranking — triggers choice paralysis

---

## Summary: Prompt Engineering Principles for GPT-5.4

| Principle | Rationale |
|-----------|-----------|
| **Frame before act** | Give it the "why" and success criteria upfront; it will find the "how" |
| **Narrow the option space** | Pre-filter to 2-3 approaches to prevent deliberation spirals |
| **Use bold-label structure** | Mirrors its natural reasoning scaffolding |
| **Positive constraints** | "Always X" > "Never Y" — aligned with its processing style |
| **Explicit override permission** | It naturally wants to pragmatically deviate; make that welcome |
| **Focused scope** | "Check X for Y" > "Review everything" |
