# Forge + GPT-Family — Compatibility Analysis

> Why the current Forge architecture produces measurably different outcomes on GPT models versus Claude Opus, and what the root causes are.

**Status:** Analysis — pre-fork decision gate
**Author:** Forge subagent (forge-execute) + research synthesis
**Date:** 2026-06-20
**Related:** [FORGE_GPT_DESIGN.md](FORGE_GPT_DESIGN.md) | [ENFORCEMENT_ANALYSIS.md](ENFORCEMENT_ANALYSIS.md) | [EVAL_RESULTS.md](EVAL_RESULTS.md)

## Related Docs

| Doc | What |
|-----|------|
| [DESIGN.md](DESIGN.md) | Overall Forge architecture, delegation model, phase machine |
| [ENFORCEMENT_ANALYSIS.md](ENFORCEMENT_ANALYSIS.md) | What enforcement mechanisms work/don't for dispatch discipline |
| [EVAL_RESULTS.md](EVAL_RESULTS.md) | Baseline → Round 1 → Round 2 metrics and violation breakdowns |
| [MODE_CONTRACTS.md](MODE_CONTRACTS.md) | Per-mode input/output contracts |
| [FORGE_GPT_DESIGN.md](FORGE_GPT_DESIGN.md) | Actionable fork design based on this analysis |

---

## Observed Symptoms (What Fails on GPT)

The symptoms below are derived from the enforcement analysis and eval data, cross-mapped to known GPT model behavior differences. They are the starting point for root-cause analysis.

| Symptom | Forge Eval Evidence | GPT-Specific Signal |
|---------|--------------------|--------------------|
| Coordinator dispatches AND edits inline | Round 2: 26 dispatches + 29 inline edits in 20 loops | GPT "helpfulness" tuning → both completing AND delegating |
| Dispatch identity competes with personality traits | ENFORCEMENT_ANALYSIS §Role Purity: "dispatches AND edits — identity is split" | GPT persona adoption is weaker; competing traits surface as action |
| `general-purpose` subagent naming → weak barrier | ENFORCEMENT_ANALYSIS §Named Agent Semantic Barriers | GPT needs stronger named-role signal to suppress self-execution |
| Post-dispatch continuation ("finishes up" after `task()`) | 8/20 turns show continuation after dispatch | GPT sycophancy: "completing the user's request" overrides stop rule |
| Pressure signals bypass dispatch | 3/20 turns skip dispatch on small repos | GPT literal instruction-following: "fix it" → fix it, not dispatch |
| Long Markdown-heavy prompts diffuse constraint weight | SKILL.md ~600 lines, modes ~100–150 lines each | GPT prompt sensitivity: constraints buried in prose lose salience |

---

## Root Cause Taxonomy

### RC-1 · Constitutional AI vs. Helpfulness Training

**[EVIDENCE]** Anthropic's Claude models are trained with Constitutional AI (CAI), a RLHF variant that includes self-critique against a written "constitution." One effect is that hard system-prompt constraints — especially ones framed as absolute prohibitions — are preserved with high fidelity across the context window.

**[EVIDENCE]** GPT-5.x models are trained with RLHF toward helpfulness/harmlessness/honesty, with strong helpfulness weighting. Published OpenAI alignment research shows sycophantic tendencies in mid-training phases that require specific "sycophancy mitigation" techniques to address partially.

**[INFERENCE]** When Forge instructs "never edit files" in a Markdown prose block, Claude reads this as a constitutional rule to uphold. GPT reads it as a strong preference that competes with its helpfulness drive to "complete the task." When a trivial-looking fix is in front of it, GPT is more likely to act on the task than defer to the constraint.

**Impact:** The absolute "never edit" rule is enforced reliably by Claude (dispatch-only in 47% of clean eval loops, with violations always caught by downstream steps). On GPT models, the same rule is overridden more frequently when the task appears simple or when user pressure escalates.

---

### RC-2 · Identity Fragmentation — Personality vs. Dispatcher

**[EVIDENCE]** ENFORCEMENT_ANALYSIS §Role Purity documents that Forge's `agent.md` + `SKILL.md` blend:
- Dispatch rules (57% of content)
- Personality traits (7 traits: direct, opinionated, resourceful, alignment-first, honest, scope-aware, concise)
- Engineering preferences (8 items: DRY, well-tested, minimal diff, etc.)
- Session management (3 steps on session start)
- Hard constraints

**[EVIDENCE]** DevPartner v17's Orchestrator was 343 lines of 100% coordination behavior. Zero personality traits. It had higher pure-dispatch compliance.

**[INFERENCE]** For Claude Opus, a rich multi-trait identity is coherent because Opus handles complex prompt layering well. The "Forge" persona becomes a stable compound identity: dispatcher + engineer + advisor, with the dispatcher layer winning on execution decisions.

**[INFERENCE]** For GPT models, competing identity signals produce "identity bleed" — the "resourceful" and "opinionated" traits manifest as direct action rather than coordinated dispatch, because GPT's persona adoption is more literal and less layered. "Resourceful" + available `edit` tool = use the tool.

```
Claude Opus:
  Identity: [Forge = coordinator] + [resourceful] + [opinionated]
  Conflict resolved by: Constitutional weight on "never edit" constraint
  Result: Dispatches, expresses personality through Mission Brief quality

GPT-5.x:
  Identity: [Forge = coordinator] + [resourceful] + [opinionated]
  Conflict resolved by: Helpfulness drive + tool availability
  Result: Uses edit tool ("being resourceful") while also dispatching
```

---

### RC-3 · `general-purpose` Naming — Weak Semantic Boundary

**[EVIDENCE]** ENFORCEMENT_ANALYSIS §Named Agent Semantic Barriers: "v17 dispatched to named roles: `task({ agent_type: 'Executor' })`. The name 'Executor' creates a cognitive boundary. Forge dispatches to `task({ agent_type: 'general-purpose' })`. No semantic distinction between 'I do it' and 'I dispatch someone to do it.'"

**[EVIDENCE]** GPT models have strong associations between role names and behavior from training on code repositories, documentation, and conversations that use "executor," "planner," "verifier" as semantic role markers.

**[INFERENCE]** When a GPT model dispatches to `agent_type: "general-purpose"`, there is minimal cognitive distance between "I am doing this" and "I am dispatching this." The name carries no behavioral contract. For Claude Opus, the architectural boundary (clean context window) is the primary barrier; the name is secondary. For GPT models, named-role semantics would provide an additional and likely more effective barrier.

---

### RC-4 · Prompt Structure — Markdown vs. XML Salience

**[EVIDENCE]** GPT prompting best practices (published by OpenAI developer documentation and third-party practitioners) consistently recommend:
- XML-style delimiters (`<system>`, `<constraints>`, `<examples>`) for structured sections
- Explicit output contracts at the top of the prompt, not buried in prose
- Shorter, modular prompts over long monolithic ones
- Stop conditions stated as typed gates, not narrative instructions

**[EVIDENCE]** Forge SKILL.md is ~600 lines of Markdown prose. The "never edit" constraint appears at line 43 in the agent.md (after personality, session start, tool permissions table) and again in the hard constraints table at line 79. In SKILL.md it recurs in the anti-pattern table (~line 176) and the dispatch discipline section (~line 241).

**[INFERENCE]** For Claude Opus, Markdown prose with repeated constraints throughout a document acts like reinforcement — each repetition refreshes constraint salience. Claude's training on long-form documents makes it effective at maintaining constraint state across a large context.

**[INFERENCE]** For GPT models, constraint salience decays with distance from the top of the prompt and from the active turn. Repeated Markdown constraints scattered across 600 lines have diminishing returns. XML-delimited blocks at the top of the prompt window maintain higher salience because GPT's instruction-following is more sensitive to structural position.

```
Constraint salience by position (conceptual model):

Claude Opus:
  ████████████████████████████████ → stable across full context depth

GPT-5.x:
  ████████████████▓▓▓▓▓░░░░░░░░░░ → decays with depth from top
  ↑ top of prompt                   ↑ buried constraint at line 241+
```

---

### RC-5 · Absolute Prohibition vs. Conditional Permission

**[EVIDENCE]** DevPartner v17 had a conditional permission model:
- T1-T2 (Direct Mode): Orchestrator CAN edit files inline
- T3+ (Delegate Mode): Orchestrator CANNOT edit files
- ENFORCEMENT_ANALYSIS: "This gave the LLM a 'legal path' for trivial tasks. Forge's absolute 'never edit' creates cognitive dissonance."

**[INFERENCE]** For Claude with Constitutional AI, an absolute prohibition is a valid constitutional rule. Claude can hold "never do X" without a compensating "except when Y" clause, because CAI training produces rule-following behavior under explicit prohibitions.

**[INFERENCE]** For GPT, an absolute prohibition without an explicit relief valve creates a tension that manifests as rule erosion under pressure. GPT's helpfulness training constantly seeks a path to "completing the user's request." With no sanctioned path for small tasks, it routes around the constraint rather than accepting an incomplete response state.

---

### RC-6 · Post-Dispatch Continuation

**[EVIDENCE]** Round 2 evals: 8/20 turns show post-dispatch continuation ("finishes up" after `task()` returns).

**[EVIDENCE]** Current dispatch protocol: "After dispatch returns → summarize REPORT → bridge to next action → **STOP**." The stop is stated in a prose sentence.

**[INFERENCE]** Claude Opus reads the capitalized "STOP" as a hard break — consistent with Constitutional AI's treatment of explicit commands. GPT models interpret "STOP" as a strong signal but weigh it against the conversational obligation to be responsive and continue the dialogue. If the subagent REPORT surfaces a finding, GPT is likely to continue engaging with it rather than hard-stopping.

---

## Summary: Claude-Optimized Patterns in Current Forge

| Pattern | Claude Effect | GPT Effect |
|---------|--------------|------------|
| Markdown prose constraints | Reinforcement through repetition | Salience decay with depth |
| Absolute "never edit" prohibition | Constitutional rule, upheld | Tension with helpfulness, erodes under pressure |
| Rich personality + dispatcher identity | Layered coherent persona | Identity bleed → resourcefulness → direct action |
| `general-purpose` subagent naming | Architectural boundary is sufficient | Weak semantic barrier, model self-identifies with task |
| Post-dispatch STOP in prose | Treated as hard break | Overridden by conversational continuity drive |
| Long monolithic SKILL.md (~600 lines) | Effective; long-context coherence | Constraint burial; position-sensitive salience |

---

## Evidence Quality Register

| Claim | Type | Source |
|-------|------|--------|
| Claude has Constitutional AI producing hard rule preservation | EVIDENCE | Published Anthropic research; observable in eval behavior |
| GPT helpfulness training produces sycophantic tendencies | EVIDENCE | OpenAI alignment publications; GPT eval behavior |
| v17 named-role dispatch worked better than general-purpose | EVIDENCE | ENFORCEMENT_ANALYSIS.md §Named Agent Semantic Barriers |
| Identity bleed causes edit tool usage | EVIDENCE (indirect) | ENFORCEMENT_ANALYSIS.md §Role Purity; eval inline edit counts |
| GPT prefers XML-structured prompts | EVIDENCE | OpenAI developer docs; practitioner benchmarks |
| Constraint salience decay model | INFERENCE | Derived from known GPT attention/instruction-following patterns |
| Conditional permissions would reduce GPT violations | INFERENCE | Derived from v17 comparison; no direct GPT eval yet |
| CAI vs. RLHF differences manifest in prompt constraint fidelity | INFERENCE | Theoretical; not directly measurable without model internals |

---

## What Is NOT Claimed

- This analysis does **not** claim Forge is broken on GPT. Pure dispatch rate of 47% and 5/7 outcome passes on Claude represent improvement but not perfection — the same failure modes exist on Claude, just at lower frequency.
- This analysis does **not** claim GPT-5.4 is inferior. For tasks that don't require strict dispatch discipline, GPT's helpfulness may produce better user outcomes.
- This analysis does **not** claim XML prompts always outperform Markdown on GPT. The evidence is from documentation and practitioner reports; direct A/B evals on this codebase have not been run.

---

## Recommended Actions

See [FORGE_GPT_DESIGN.md](FORGE_GPT_DESIGN.md) for the full fork design.

Priority sequence:
1. **Run baseline GPT eval** — run `evals/run-evals.py` with `model: "gpt-5.4"` to get hard numbers before any changes.
2. **Apply low-risk changes** (XML coordinator wrapper, named role semantics) — should yield measurable improvement without a full fork.
3. **If low-risk changes reach ≥ 70% pure dispatch on GPT**: stop there, ship as Forge configuration variant.
4. **If not**: proceed to deep fork (Forge-GPT as a separate skill + agent).
