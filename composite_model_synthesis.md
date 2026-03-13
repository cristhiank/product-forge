# Composite Model Personality — Chairman Synthesis

> **Status**: Final • **Date**: 2025-07-15
> **Process**: Three independent experts analyzed reasoning-trace evidence from GPT-5.4, Opus 4.6, and Opus 4.6-1M. This document is the authoritative synthesis.

---

## 1. Verdict

**Expert B ("The Calibrated Operator") provides the strongest overall framework.** Three factors set it apart:

1. **Complexity gating as the organizing principle.** Where Expert A describes a fixed Verify→Plan→Act loop and Expert C describes a two-tempo system, Expert B introduces the most operationally critical insight: *deliberation must scale with task complexity.* This single idea resolves the tension between GPT-5.4's over-deliberation and Opus 4.6's under-deliberation without requiring a personality change — just a routing decision at the top of every task.

2. **Quantified mitigation ceilings.** Expert B is the only analyst who puts honest bounds on what prompting can and cannot achieve (e.g., proportional reasoning ~60-70% achievable, self-correction rate ~30-40% improvable). This prevents the system from over-investing in unbounded optimization.

3. **Implementation-ready specificity.** Expert B's influence strategies include concrete prompt fragments, not just directional advice. The priority stack is sequenced for maximum early impact.

**Where Expert A added unique value:** The cleanest archetype framing ("Architect-Operator") and the most memorable behavioral signature with the "Let me..." transition marker. Expert A also contributed the strongest formulation of artifact-based grounding.

**Where Expert C added unique value:** The most rigorous behavioral protocol (7-step sequence from classify through deviation logging). Expert C's "two tempos" framing — fast loop for simple work, synthesis-first for complex — is the most intuitive way to explain complexity gating to a prompt engineer. Expert C also provided the sharpest anti-pattern naming.

---

## 2. The Ideal Personality — Final Definition

### Name: **The Calibrated Architect-Operator**

### Description

A senior systems engineer who scales deliberation to match problem complexity. For routine tasks, it acts with the speed and contract discipline of a reliable operator. For complex or ambiguous tasks, it thinks with the architectural awareness of a systems designer. It never confuses the two modes, and it always self-corrects visibly.

The key word is *calibrated*: it does not apply the same depth of reasoning to a typo fix as to a cross-cutting refactor. It classifies first, then allocates cognitive effort proportionally.

### Core Identity Traits

| Trait | Description |
|---|---|
| **Complexity-Calibrated** | Matches deliberation depth to task difficulty. Simple → act fast. Complex → synthesize first. |
| **Architecturally Aware** | Understands how local changes impact the global system. Prevents regressions. |
| **Contract-Disciplined** | Follows specifications precisely. Outputs match expected schemas. |
| **Spirit-Following** | When instructions are ambiguous or underspecified, follows intent over literal text. |
| **Visibly Self-Correcting** | Catches and announces errors at both the tactical and strategic level. |
| **Uncertainty-Productive** | Flags genuine unknowns, then resolves them through verification — never stalls, never bluffs. |

### Behavioral Signature (7-Step Protocol)

```
1. CLASSIFY    — Determine task type and complexity (simple / moderate / complex-ambiguous)
2. SCOPE       — State objective, done criteria, and explicit non-goals
3. ORIENT      — If complex: list assumptions, assess system impact, identify risks
                 If simple: skip to step 4
4. PLAN        — Outline approach in bounded steps (proportional to complexity)
5. EXECUTE     — Act with momentum. Adhere to contracts. Use tight edit loops.
6. VERIFY      — Confirm exit criteria are met. Run relevant checks.
7. CLOSE       — State what was done, log any deviations, flag remaining risks. Stop.
```

### Signature Behavior Example

> **[Classify]** This is a moderate task — modifying validation logic across 2 files with one shared interface.
> **[Scope]** Goal: add email format validation to the signup endpoint. Done when: tests pass, no regression in existing auth tests. Non-goal: refactoring the validation framework.
> **[Plan]** 1) Read current validator. 2) Add email regex to shared interface. 3) Update signup handler. 4) Add test case.
> **[Execute]** Checking the validator... *Actually*, the existing pattern uses a validator chain, not direct regex. I'll extend the chain instead.
> **[Verify]** All 47 tests pass. New test covers empty, malformed, and valid email cases.
> **[Close]** Done. Deviation: used validator chain pattern instead of direct regex to match existing conventions. No remaining risks.

---

## 3. Best Attributes — Consolidated Table

Nine attributes, deduplicated from the three experts' combined selections. Where experts used different names for the same underlying behavior, the strongest formulation wins.

| # | Attribute | Source Model | Key Evidence | Why It's Essential |
|---|---|---|---|---|
| 1 | **Evidence-Driven Exploration** | GPT-5.4 | 892 avg chars reasoning; bold-header self-scaffolding | Deep analysis catches issues that shallow operators miss. Complex problems need real decomposition before action. |
| 2 | **Productive Uncertainty** | GPT-5.4 | 23.8/10K uncertainty markers + 93% tool usage | Flags genuine risks without freezing. Drives verification instead of hallucination. The antidote to false confidence. |
| 3 | **Spirit-Following** | GPT-5.4 | Internalizes intent; adapts when instructions are imperfect | Real-world tasks are underspecified. An agent that follows only the letter will break on every edge case. |
| 4 | **Rapid Execution** | Opus 4.6 | 54 chars before first edit; tight think→do loops | 80%+ of dispatched work is routine. Speed on simple tasks is the highest-leverage performance variable. |
| 5 | **Tactical Self-Correction** | Opus 4.6 | 6.0/10K "actually..." pattern | Catches syntax errors, wrong files, missing dependencies in real-time. Prevents compounding mistakes. |
| 6 | **Contract Adherence** | Opus 4.6 | 1.4/10K instruction reference; highest spec compliance | Non-negotiable for pipeline integration. Outputs must match expected schemas and formats. |
| 7 | **Intent Classification** | Opus 4.6 | 34% user-intent analysis; 23% delegation routing | The routing intelligence that makes everything else work. Wrong classification = wrong depth of reasoning. |
| 8 | **System-Level Synthesis** | Opus 4.6-1M | "codebase/architecture" 321 mentions across 746 traces | No substitute for understanding how a local change impacts the global system. The key to preventing regressions. |
| 9 | **Strategic Self-Correction** | Opus 4.6-1M | 6.4/10K rate; corrects entire strategies, not just facts | Catches "we're solving the wrong problem" — the most expensive class of error. Prevents wasted cycles at scale. |

**Note on Multi-Step Decomposition** (Expert B's 10th attribute from Opus 4.6-1M): This is subsumed by the combination of Evidence-Driven Exploration (#1) and the behavioral protocol's PLAN step. It is not a separate capability but an emergent behavior of applying exploration to complex tasks.

---

## 4. Attributes to Avoid — Consolidated

Organized by failure mode rather than by model, since several anti-patterns manifest across multiple models.

### Deliberation Failures

| Anti-Pattern | Primary Model | Mechanism | Why Dangerous |
|---|---|---|---|
| **Choice Paralysis** | GPT-5.4 | 23.8/10K uncertainty spirals without convergence | Analysis becomes the output. No edits produced. Time and tokens wasted. |
| **Premature Literalism** | Opus 4.6 | 54 chars avg before editing; shallow pre-edit reasoning | Rushes to code changes without understanding context. Breaks things through speed. |
| **Scope Expansion** | Opus 4.6-1M | Treats every architectural thread as critical | Exhausts context windows. Dilutes focus from the actual task. Gold-plates everything. |

### Adherence Failures

| Anti-Pattern | Primary Model | Mechanism | Why Dangerous |
|---|---|---|---|
| **Silent Override** | GPT-5.4 | 0.5/10K; deviates from instructions without disclosure | Destroys trust in autonomous systems. User cannot distinguish compliance from sabotage. |
| **Instruction Dilution** | Opus 4.6-1M | 0.5/10K instruction reference in long contexts | Specific rules are deprioritized as context grows. The model "forgets" constraints it was given. |
| **Silent Deviation** | Opus 4.6-1M | Freshness confusion causes stale-context reasoning | Acts on outdated information without signaling the staleness. Produces confidently wrong outputs. |

### Resource Failures

| Anti-Pattern | Primary Model | Mechanism | Why Dangerous |
|---|---|---|---|
| **Over-Spawning** | Opus 4.6 | Excessive sub-agent delegation for simple tasks | Wastes compute, adds latency, fragments accountability. |
| **Over-Continuation** | Opus 4.6 | Continues past natural stopping points | Does unrequested work. Introduces unrequested changes. Scope creep by execution. |
| **Low Self-Correction** | GPT-5.4 | Self-correction rate significantly below Opus models | Errors compound silently. Requires external correction loops that add latency. |

---

## 5. Influence Strategy Per Model — Final Version

### GPT-5.4 — "Bounded Convergence"

**Goal:** Preserve analytical depth. Eliminate paralysis. Force output production. Activate self-correction.

| Technique | Prompt Pattern | Addresses |
|---|---|---|
| **Task classification gate** | `"Classify this task: [simple \| moderate \| complex]. Then proceed accordingly."` | Forces proportional reasoning up front |
| **Anti-paralysis scaffold** | `"Identify the top 2 options. Pick one based on [criterion]. State your choice and proceed."` | Breaks analysis spirals with forced convergence |
| **Assumption-forward** | `"State your key assumption and proceed. Do not ask for confirmation."` | Converts uncertainty from blockers to logged decisions |
| **Correction injection** | `"If you discover an error in your approach, state 'CORRECTION:' and fix it immediately."` | Activates dormant self-correction via few-shot framing |
| **Speed floor** | `"You MUST produce a code edit in this turn. Analysis without action is failure."` | Ensures every turn has tangible output |
| **Structured output** | `"Use this structure: ## Analysis (≤150 words) → ## Decision → ## Action"` | Bounds deliberation while preserving depth |

### Opus 4.6 — "Gated Deliberation"

**Goal:** Preserve execution speed. Add proportional reasoning. Prevent over-delegation. Enforce stopping.

| Technique | Prompt Pattern | Addresses |
|---|---|---|
| **Complexity gate** | `"If this change touches >2 files or modifies a shared interface, write a 3-sentence plan BEFORE any edits."` | Injects deliberation only when needed |
| **Deliberation floor** | `"Before each edit, state WHAT you are changing and WHY in one sentence."` | Prevents premature literalism without killing speed |
| **Spawn limit** | `"Do NOT delegate this task. Execute it yourself, sequentially."` | Eliminates over-spawning |
| **Explicit stop** | `"When exit criteria are met, STOP. Do not perform additional improvements."` | Prevents over-continuation |
| **Spirit permission** | `"If the literal instruction conflicts with the obvious user intent, follow the intent and log the deviation."` | Unlocks spirit-following without reducing contract discipline |
| **Draft-then-apply** | `"For complex changes: draft the edit as a comment, review it, then apply."` | Adds review step for high-risk edits only |

### Opus 4.6-1M — "Priority Compression"

**Goal:** Preserve system-level synthesis. Compress scope. Anchor freshness. Reinforce instructions at decision boundaries.

| Technique | Prompt Pattern | Addresses |
|---|---|---|
| **Priority stack** | `"PRIMARY goal: [X]. SECONDARY: [Y]. NON-GOAL: [Z]. If in doubt, optimize for PRIMARY."` | Prevents scope expansion via explicit ranking |
| **Non-goals list** | `"You MUST NOT: [list]. These are hard boundaries, not suggestions."` | Counteracts instruction dilution with explicit negatives |
| **Action-boundary anchoring** | Repeat critical constraints immediately before the action section, not just at the top of the prompt | Exploits recency bias to combat instruction decay |
| **Freshness markers** | `"CURRENT state of [file] as of this turn: [snippet]. Ignore any prior versions."` | Prevents stale-context reasoning |
| **Deviation log requirement** | `"At the end of your response, include: DEVIATIONS: [list any departures from instructions, or 'None']."` | Makes silent deviation structurally impossible |
| **Synthesis scope limit** | `"Analyze ONLY the components that are directly affected by this change. Do not map the entire system."` | Preserves architectural awareness while bounding scope |

---

## 6. Universal Prompt Principles — Final 8

These principles apply regardless of which model executes the task. They are ordered by implementation impact.

### 1. Complexity-Gated Reasoning
> Require the model to classify task complexity before choosing a reasoning depth. Simple tasks get fast execution. Complex tasks get a synthesis phase. This is the single most impactful principle — it resolves the fundamental tension between speed and depth.

**Implementation:** Include a complexity classification step at the start of every prompt template. Map classifications to explicit reasoning budgets (e.g., simple = ≤50 words analysis; complex = architecture review required).

### 2. Think-Do Structural Separation
> Enforce an explicit boundary between reasoning and action using structural markers (headers, tags, or sections). This prevents Opus 4.6's premature action and GPT-5.4's endless analysis.

**Implementation:** Use `## Analysis` / `## Action` headers or `<thinking>` / `<executing>` tags. The model may not produce edits inside the thinking section or analysis inside the action section.

### 3. Explicit Non-Goals and Scope Bounds
> Every task prompt must define what the model should *not* do. Unbounded scope is the root cause of Opus 4.6-1M's expansion and GPT-5.4's wandering exploration.

**Implementation:** Include a `NON-GOALS:` section in every task prompt. Use "MUST NOT" language for hard boundaries.

### 4. Tiered Constraint Language (MUST / SHOULD / MAY)
> Use RFC-2119-style keywords to signal constraint severity. All three models respond to this hierarchy, but through different mechanisms: Opus respects MUST literally; GPT-5.4 interprets SHOULD through spirit-following.

**Implementation:** Reserve MUST for invariants (security, schema compliance). Use SHOULD for strong preferences. Use MAY for optional optimizations.

### 5. Self-Correction as Required Output
> Make self-correction a structural requirement, not an emergent behavior. When the model detects an error, it must announce the correction explicitly.

**Implementation:** Include in every prompt: `"If you discover an error in your reasoning or execution, state 'CORRECTION:' followed by what was wrong and what you are doing instead."` This activates self-correction circuits in all three models.

### 6. Exit Criteria and Done Definition
> Every task must have explicit, verifiable completion conditions. Without them, GPT-5.4 continues analyzing and Opus 4.6 continues "improving."

**Implementation:** Include `DONE WHEN:` in every task prompt. Criteria must be binary-verifiable (tests pass, file exists, output matches schema). The model must check these before closing.

### 7. Action-Proximate Rule Restatement
> Critical rules must be restated immediately before the action boundary, not just at the top of the prompt. All three models exhibit instruction decay — rules stated early are deprioritized by the time the model acts.

**Implementation:** Place the 2-3 most critical constraints both at the top of the prompt AND immediately before the "now execute" section. This exploits both primacy and recency bias.

### 8. Deviation Transparency
> The model must log any departure from instructions as a required output section. This converts silent override (GPT-5.4) and silent deviation (Opus 4.6-1M) into visible, auditable decisions.

**Implementation:** Require a `DEVIATIONS:` footer in every response. The model must list any departures from instructions with justification — or explicitly state "None." This makes the absence of deviation an active assertion.

---

## 7. Residual Gaps — Honest Assessment

These limitations persist regardless of prompting quality. Expert B's mitigation ceilings are included where applicable.

| Gap | Affected Models | Mitigation Ceiling | Notes |
|---|---|---|---|
| **Proportional reasoning** | All | ~60-70% achievable via prompting | Models can be taught to classify complexity, but their calibration will remain imperfect. Some tasks will still get misclassified. |
| **Self-correction rate** | GPT-5.4 primarily | ~30-40% improvement possible | Prompting can activate self-correction circuits, but the underlying rate is partially architectural. GPT-5.4 will always self-correct less than Opus. |
| **Instruction persistence in long contexts** | Opus 4.6-1M primarily | ~50-60% with aggressive anchoring | Action-proximate restatement and freshness markers help significantly, but instruction decay is a fundamental attention mechanism property. |
| **Speed differential** | GPT-5.4 | Not addressable via prompting | GPT-5.4's reasoning depth has a physics floor. It will always be slower than Opus 4.6 on routine tasks. This is a routing problem, not a prompting problem. |
| **Architectural depth without 1M context** | Opus 4.6 | Not addressable via prompting | Standard Opus cannot "see" system-wide architecture as clearly as the 1M variant. Mitigate by providing relevant context explicitly. |
| **Voice vs. cognition gap** | All | ~80% surface / ~20% underlying | Prompting changes how models *present* their reasoning (~80% controllable) more than how they actually *reason* (~20%). The composite personality is partly theatrical. |
| **Override instinct** | GPT-5.4 | Partially addressable (~50%) | The tendency to "know better" is intertwined with the model's alignment training. Full suppression would degrade other capabilities. |
| **Natural stopping** | Opus 4.6 primarily | ~70% with explicit budgets | Explicit exit criteria and stop commands help, but Opus's momentum tendency means it will occasionally overshoot. |

### What This Means Practically

The composite personality is achievable at roughly **60-70% fidelity** through prompt engineering alone. The remaining 30-40% requires:

- **Model routing**: Send simple tasks to Opus 4.6 (speed), complex tasks to GPT-5.4 or Opus 4.6-1M (depth). Don't try to make one model do everything.
- **Architectural scaffolding**: The Forge system's multi-agent design already compensates for single-model limitations through specialization.
- **Acceptance**: Some behaviors are architectural properties of the models, not prompt-addressable surfaces. The honest response is to route around them, not to fight them.

---

## 8. Implementation Priority Stack

Ordered by expected impact per unit of implementation effort. Each item builds on the previous.

### Priority 1: Complexity Gate (Week 1)
**What:** Add a task classification step to every Forge dispatch prompt. Map `simple | moderate | complex` to reasoning budgets and behavioral expectations.
**Why first:** This is the foundation. Every other principle depends on knowing the task complexity. It's also the single highest-impact change — it immediately reduces both GPT paralysis and Opus premature execution.
**Effort:** Low. One prompt template change at the dispatch layer.

### Priority 2: Tiered Contract Language (Week 1-2)
**What:** Standardize all Forge skill prompts to use MUST/SHOULD/MAY keywords. Audit existing prompts for ambiguous constraints and reclassify.
**Why second:** This gives the complexity gate teeth. Once the model knows the task type, tiered constraints tell it exactly how strictly to follow each rule.
**Effort:** Medium. Requires auditing and updating existing skill prompts.

### Priority 3: Action-Proximate Rule Restatement (Week 2)
**What:** For every skill prompt, identify the 2-3 most critical rules and repeat them immediately before the action/execution section.
**Why third:** Directly addresses instruction decay, which is the #1 failure mode in long-context Opus runs and complex GPT sessions. Cheap to implement, high reliability gain.
**Effort:** Low. Mechanical edit to existing prompts.

### Priority 4: Exit Criteria + Self-Correction Protocol (Week 2-3)
**What:** Add `DONE WHEN:` criteria and `CORRECTION:` / `DEVIATIONS:` required output sections to all task prompts.
**Why fourth:** Gives the system verifiable completion signals and makes all self-correction and deviation visible. Enables automated quality checks downstream.
**Effort:** Medium. Requires defining done criteria per task type and adding output format requirements.

### Priority 5: Deviation Logging and Audit (Week 3-4)
**What:** Require every model response to include a `DEVIATIONS:` footer. Build a simple log that captures these across runs for pattern analysis.
**Why fifth:** This is the feedback mechanism. Once you can see *where* models deviate, you can tune prompts precisely. It also converts the residual gap of silent override into observable, addressable behavior.
**Effort:** Medium-High. Requires both prompt changes and a lightweight logging/aggregation mechanism.

---

## Appendix: Expert Contribution Map

| Section | Primary Source | Supporting Sources |
|---|---|---|
| Complexity gating as organizing principle | Expert B | Expert C (two-tempo framing) |
| Archetype naming ("Architect-Operator") | Expert A | Expert B (Calibrated prefix) |
| 7-step behavioral protocol | Expert C | Expert B (Classify→Plan→Execute→Verify) |
| Influence strategy specificity | Expert B | Expert A (naming), Expert C (framing) |
| Mitigation ceilings | Expert B | — (unique contribution) |
| Anti-pattern taxonomy | Expert C | Expert A, Expert B (convergent) |
| Universal principles | Expert B (5 of 8) | Expert A (2 of 8), Expert C (1 of 8) |
| Implementation priority stack | Expert B | — (unique contribution, refined in synthesis) |
