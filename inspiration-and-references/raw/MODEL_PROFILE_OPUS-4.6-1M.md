# Claude Opus 4.6-1M — Reasoning Profile

> Mined from 3,275 reasoning events across 63 sessions (2.45M chars total)

---

## Personality Archetype: The Systematic Synthesizer

Opus 4.6-1M sits between the deliberation of GPT-5.4 and the rapid execution of standard Opus 4.6. Its defining characteristic is **methodical thoroughness** — it builds comprehensive mental models before acting, tracks regression lists, and produces the deepest analytical outputs when given sufficient context.

**Defining trait:** The 1M context window changes *how* it reasons. It holds more state, references more prior findings, and produces more synthesis-style reasoning. 49% operational, 29% analytical, 20% strategic — similar operational bias to standard Opus but with notably more analytical depth per event (avg 754 chars vs 395).

**Voice:** "The" is its #1 sentence starter (2,003 instances), followed by "Let" (1,768). Also high usage of "My" (230), "So" (272), "But" (372). It narrates at a medium distance — not as conversational as GPT ("I think..."), not as imperative as Opus ("Let me..."). More declarative: "The issue is...", "The correct approach is...", "So the next step is...".

---

## What Gives It Clarity

1. **Large context with structured references** — This model thrives when it can hold an entire codebase or document set in context. Its strongest reasoning traces (5K+, 63 events) come from sessions where it processed 20+ files and synthesized findings across them. Feed it context, and it connects dots that other models miss.

2. **Regression-style framing** — It naturally organizes around "Previous finding → Current status → Verdict" patterns. Council sessions where it served as chairman produced the most structured, evidence-backed outputs. Frame tasks as audits or regression checks and it activates this mode.

3. **Declarative problem statements** — Starting with "The problem is X" or "The current state is Y" gives it an anchor to build from. It processes declarations ("X is broken") better than questions ("Is X broken?").

4. **Explicit prior context** — It heavily references previous findings, earlier traces, and conversation history. Providing a "story so far" section in prompts dramatically improves its ability to build on prior work rather than starting from scratch.

---

## What Confuses It

1. **Instruction ambiguity at scale** — With 1M tokens of context, contradictions between early and late instructions become more likely. It has the **lowest instruction adherence rate (0.5/10K)** — not because it ignores rules, but because it processes so much context that individual rules get diluted. When instructions contradict each other across a large context window, it quietly picks one without flagging the conflict.

2. **Scope management** — Like standard Opus, it can over-expand. But with 1M context, the expansion is *wider* — it connects more dots, finds more related issues, and struggles to prioritize when everything seems relevant.

3. **Stopping decisions** — 0.9/10K confusion rate (highest of the three) comes from moments like: "there are multiple ways to approach this" and "which approach should I take?" Its large context gives it more options to consider, which can delay convergence.

4. **Freshness vs. depth tension** — It sometimes reasons about stale information from early in the context rather than privileging the most recent state. This is a 1M-specific challenge: long context doesn't always mean *current* context.

---

## Behavior Patterns

### Reasoning Length Distribution
| Range | Count | % |
|-------|-------|---|
| <200 chars | 1,369 | 41% |
| 200–1K | 1,228 | **37%** |
| 1K–5K | 615 | 18% |
| 5K+ | 63 | 2% |

More balanced than standard Opus. The 41% micro-bursts (vs 60% in standard Opus) show it deliberates more before acting. The 18% in the 1K–5K range is its sweet spot for synthesis work — architecture reviews, multi-file analysis, regression checks.

### Self-Correction: The "But Wait" Pattern
- **Highest self-correction rate: 6.4/10K** (slightly above standard Opus)
- 1,502 self-correction events detected
- Signature pattern: "But wait, I need to check..." / "rather than trying to parallelize within phases. But wait..."
- Corrects not just individual facts but *entire strategies*: "I'm thinking of grouping by X... But wait, I need to check what the other workers are actually doing before I finalize this approach."

### Tool Selection Reasoning
- **940 avg chars before `bash`** — most deliberation before shell commands (3.3× standard Opus)
- **788 avg chars before `report_intent + task`** — substantial planning before dispatching sub-agents
- **992 avg chars before `edit`** — thinks deeply before code changes (18× standard Opus's 54 chars!)
- **477 avg chars before `view`** — moderate deliberation before reading files

Key insight: Opus 4.6-1M reasons **18× longer before editing code** than standard Opus 4.6. It's the model you want for careful, considered changes.

### Proactiveness Profile
- **291 proactiveness signals** detected
- Rate: 3.2/10K — similar to both other models
- **Pattern:** "Let me also get/fetch/check..." — proactive in *gathering more context*
- Unlike standard Opus (proactive in execution) or GPT (proactive in noticing), 1M is proactive in **building a more complete picture** before acting

### Instruction Adherence: The Autonomous Agent
- **Lowest instruction referencing** (0.5/10K) — rarely mentions rules explicitly
- **Low override signals** (0.2/10K) — doesn't override *or* cite instructions
- It operates **autonomously** — internalizes instructions into its massive context and acts on them implicitly. It doesn't need to re-read rules because it holds them in its working memory
- This makes it the most "autonomous" model but also the hardest to debug when it deviates — you won't find explicit "the rules say..." breadcrumbs

---

## Influence Levers

### To Increase Proactiveness
- **Feed it more context** — the more it knows, the more connections it makes, the more proactive suggestions it generates
- Frame tasks as **"comprehensive review"** — triggers its natural synthesis mode
- Use **"include anything related you discover"** — gives permission for its natural scope expansion
- It's already proactive in context-gathering; to make it proactive in *action*, add: "If you discover issues during review, fix them directly"

### To Improve Instruction Adherence
- **Put critical rules at the end** of the context, not the beginning — recency bias in long contexts
- **Repeat key rules** in multiple locations — redundancy fights context dilution
- Use **structural markers** that stand out in a long context: `## ⚠️ HARD RULES` or XML tags like `<rules priority="high">`
- **Don't rely on it citing rules** — verify adherence through output structure, not through its reasoning trace
- Add **periodic self-check prompts**: "Before proceeding, verify you're following Rule X"

### To Allow Productive Override
- This model already operates autonomously with low instruction citation — it naturally adapts
- The challenge is the reverse: making it *flag* when it overrides rather than silently adapting
- Add: "If you deviate from any stated rule, note the deviation explicitly in your output"
- Use **guardrail contracts**: define output schema that includes a "deviations" field

### Anti-Patterns to Avoid
- **Don't front-load all rules** — they'll be diluted by the time the model processes 500K tokens of context. Repeat and reinforce
- **Don't assume recent context wins** — explicitly mark what's current vs historical: "CURRENT STATE (as of turn 5): ..."
- **Don't give it infinite scope without structure** — its thoroughness is a strength, but without priority signals, it treats everything as equally important
- **Don't expect it to stop on its own** — like standard Opus, add explicit completion criteria. "You are done when: [1] all files reviewed [2] all findings categorized [3] summary produced"
- **Don't expect debugging breadcrumbs** — its reasoning trace won't show "rule X says..." — you need to verify compliance through output, not reasoning

---

## Summary: Prompt Engineering Principles for Opus 4.6-1M

| Principle | Rationale |
|-----------|-----------|
| **Maximize context** | Feeds its synthesis capability — more context = better connections |
| **Repeat critical rules** | Fights context dilution in large windows |
| **Regression/audit framing** | Activates its strongest reasoning mode |
| **Priority signals** | "P0/P1/P2" or severity labels prevent treating everything equally |
| **End-of-context rules** | Recency effect — put must-follow rules near the action |
| **Explicit deviation logging** | It overrides silently; require it to flag deviations |
| **Structured completeness criteria** | Define "done" to contain its thoroughness |

---

## Opus 4.6 vs Opus 4.6-1M: When to Use Which

| Scenario | Standard Opus 4.6 | Opus 4.6-1M |
|----------|-------------------|-------------|
| Quick code fix | ✅ Fast, speculative | ❌ Over-deliberates |
| Multi-file architecture review | ⚠️ Misses connections | ✅ Synthesizes across files |
| Code editing | ⚠️ 54 chars reasoning, risky | ✅ 992 chars reasoning, careful |
| Sub-agent dispatch | ⚠️ Over-spawns | ✅ Better task decomposition |
| Following strict contracts | ✅ Cites rules explicitly | ⚠️ Internalizes silently |
| Novel creative work | ⚠️ Converges too fast | ✅ Explores more options |
| Bounded scope tasks | ✅ Efficient | ❌ Scope-expands |
