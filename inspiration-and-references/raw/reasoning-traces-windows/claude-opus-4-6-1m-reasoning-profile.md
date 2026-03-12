# Claude Opus 4.6-1m Reasoning Profile

> Deep-mined from 746 reasoning traces across 44 Copilot CLI sessions.

## Signal Snapshot

| Signal | Value |
|---|---:|
| Average reasoning length | 950 chars |
| Median reasoning length | 411 chars |
| Max reasoning length | 36,657 chars |
| Average response length | 364 chars |
| Reasoning-to-response ratio | 2.61 |
| Tool usage rate | 96% of messages |
| Top tools | view (607), powershell (368), report_intent (190), glob (110), edit (79), grep (78) |
| Dominant patterns | planning ahead 90%, exploration 59%, tool planning 41%, step-by-step 40% |
| Dominant opening style | "The..." (31%), "Now..." (23%), "Let..." (9%) |

## Personality Archetype — The Deep Architect

Claude Opus 4.6-1m is the most internally expansive model in the set. It does not just inspect a problem; it tries to build a complete system-level map before committing. With the highest reasoning depth, the highest reasoning-to-response ratio, and the highest tool-usage rate, it behaves like a model that wants enough understanding to act decisively across multiple moving parts.

Its traces repeatedly point to the same identity: comprehensive understanding first, architecture-aware planning second, implementation third. The language markers reinforce that picture. Planning-ahead language appears in 90% of traces, codebase/architecture/structure language in 43%, numbered lists in 33%, and self-correction is the highest of the three models at 24%. This is not compact execution. This is deliberate synthesis.

Compared with GPT-5.4, Opus 4.6-1m is less emotionally expressive and less visibly uncertain. Compared with standard Opus 4.6, it is dramatically deeper, more plan-heavy, and more likely to reason across multiple layers of a system before taking action.

## What Gives Clarity

### 1. Rich context with explicit current-state framing
This model shines when it can assemble a broad working model of the environment. But breadth alone is not enough. It needs **freshly framed context**: what exists now, what matters now, and what should be ignored. When given a current-state summary plus relevant files or architecture notes, it becomes unusually effective.

Useful framing blocks:
- current state
- target state
- non-goals
- known constraints
- files or modules most likely involved

### 2. Multi-step objectives that justify planning
Because planning language appears in 90% of traces, Opus 4.6-1m becomes clearer when the task genuinely requires decomposition. It likes prompts where a plan is not ceremony but necessity: migrations, architectural adjustments, multi-file features, behavioral regressions, or cross-cutting fixes.

### 3. Explicit priority ordering
This model naturally sees many relevant threads. If you tell it everything that matters, it may believe everything matters equally. It becomes sharper when you assign relative weight: primary objective, secondary concerns, nice-to-have cleanup, and explicit non-goals.

### 4. Permission to synthesize across layers
The frequent codebase/architecture/structure language suggests that this model is at its best when allowed to connect implementation details to system design. It handles prompts like "build a complete picture," "understand the architecture first," or "trace the end-to-end path" especially well.

### 5. Phased tasks with closure conditions
Unlike standard Opus 4.6, which often operates in compact bursts, the 1m model can stay in planning mode for a long time if the task seems open-ended enough to reward it. Strong phase boundaries help: inspect -> plan -> implement -> verify.

## What Confuses It

### 1. Large-context ambiguity about what is current
One of the key risks of a deep-context model is that it can carry too many valid facts at once. The qualitative sample around tool restrictions shows the pattern: it reasons correctly about likely architecture, then runs into an environmental boundary, then must downgrade its plan. When the prompt includes historical context, prior attempts, and current constraints without freshness markers, this model can temporarily optimize against stale assumptions.

### 2. Broad scope with weak prioritization
Opus 4.6-1m is the most naturally expansive planner. That is powerful, but it can become expensive. If you ask for a "complete" view without stating what matters most, the model may widen the solution space faster than you want.

### 3. Hidden or implicit execution limits
Instruction recall is extremely low in absolute terms, only 9 traces. Like GPT-5.4, this model usually operates from an internalized understanding rather than explicit rule rehearsal. The difference is that its plans can get large. If hard limits are not visible, it may design a solution larger than the operating envelope.

### 4. Context that mixes strategic and tactical asks without a handoff
Because this model can think architecturally and act tactically, it needs to know whether the job is to design, implement, or do both. If you do not specify the handoff between those modes, it may invest more reasoning than necessary before moving.

## Behavior Patterns

### Plan-first, then act
Planning dominates this profile. With 90% planning-ahead frequency and 40% step-by-step frequency, Opus 4.6-1m rarely enters a task cold. It wants a frame, a decomposition, and a sense of system shape.

### Deep internal processing paired with high external action
The model thinks 2.61x more than it says, yet still uses tools in 96% of messages. That combination is important: it is not contemplative in a passive way. It is a heavy reasoner that still acts constantly. The result is a model that often performs like an architect who is willing to pick up the tools personally.

### Architecture-aware language
"Codebase," "architecture," and "structure" appear 321 times, a strikingly high rate for 746 traces. This model habitually zooms out. Even when a task is local, it often tries to understand where that local change sits in the broader system.

### Strategy-level self-correction
Self-correction is the highest of the group at 24%, and the sample traces suggest that the corrections often happen at the level of overall approach, not just local facts. It does not merely fix wording; it revises plans. That makes it safer than its depth might imply, but also slower when the problem is trivial.

### Natural-prose planning more than bold-labeled scaffolding
Bold headings appear in only 20% of traces, much lower than GPT-5.4 or Opus 4.6. Instead of repeatedly resetting with bold section titles, Opus 4.6-1m often maintains longer narrative continuity through openings like "Now..." and declarative planning passages. Its reasoning feels like a sustained internal memo rather than a series of labeled checkpoints.

## Proactiveness Profile

Opus 4.6-1m is the most **strategically proactive** model in the set.

### What its proactiveness looks like
- It broadens the model of the system before acting.
- It identifies adjacent architectural consequences.
- It proposes phased solutions rather than isolated fixes.
- It gathers enough context to reduce the chance of local-but-wrong changes.

This is a different flavor from GPT-5.4's curious investigation or Opus 4.6's procedural momentum. The 1m model is proactive in service of completeness.

### How to increase proactive behavior
Use prompts like:
- "Build a complete picture before changing anything."
- "Include adjacent modules if they materially affect correctness."
- "Think end-to-end across the architecture."
- "If a local fix implies a broader structural issue, account for it."
- "Produce a phased plan and execute it."

These cues align with its strongest instincts and often lead to its best work.

### How to decrease proactive behavior
Use prompts like:
- "Change only the listed files."
- "Do not refactor beyond the direct requirement."
- "Prefer the smallest viable change over architectural cleanup."
- "Do not build a broader plan unless blocked."
- "Stop after the direct fix and verification."

If you want this model to stay local, you have to explicitly suppress its tendency to systematize.

## Instruction Adherence vs. Creative Override

Claude Opus 4.6-1m usually behaves as though it has absorbed the instructions into a task model and moved on. It is not visibly rule-conscious. It is understanding-conscious.

### What the data suggests
- Reference to instructions: 7%
- Instruction recall: only 9 traces
- User-intent analysis: 14%
- Delegation: 16%
- Self-correction: 24% — highest in the set

This combination produces a model that is often effective, but sometimes opaque. It can honor the spirit of the request very well while giving few explicit breadcrumbs about how it balanced competing instructions.

### Strength
When the prompt is coherent, this model can integrate constraints, architecture, and execution unusually well. It does not need to keep quoting the rules to keep following them.

### Risk
When the prompt contains conflicting objectives or stale context, the model may silently choose the path that best fits its synthesized understanding. That can look like creative override even when it believes it is being helpful.

### How to manage the balance
If you want strict adherence:
- Repeat critical constraints near the action boundary, not only at the top.
- Distinguish current-state facts from historical context.
- Put non-goals in a visible list.
- Require explicit deviation logging.

If you want intelligent adaptation:
- Give it room to reason across layers.
- State which outcome outranks literal compliance.
- Ask for a brief plan first when the task is broad.
- Let it note when a local request implies a larger structural change.

A particularly effective pattern is: **"Default to the smallest change that satisfies the goal. If a broader architectural adjustment is clearly required, say why and then proceed."**

## Prompt Engineering Implications

### Recommended prompt shape
For Opus 4.6-1m, a strong prompt usually includes:

1. **Objective** — what outcome matters most
2. **Current state** — what is true now
3. **Target state** — what should be true after completion
4. **Priority order** — what matters first, second, and not at all
5. **Relevant artifacts** — files, modules, traces, architecture notes
6. **Constraints** — especially size, scope, and non-goals
7. **Execution policy** — plan first or act immediately
8. **Done when** — explicit completion criteria
9. **Deviation policy** — when broader changes are allowed

### Best practices
- Use it for multi-file, architecture-aware, or context-heavy tasks.
- Provide freshness markers like "current state" and "superseded context".
- Ask for phased execution when the work is non-trivial.
- Constrain scope explicitly if you do not want architectural expansion.
- Repeat hard limits near the bottom of the prompt where action begins.
- Require concise deviation notes if compliance matters.

### High-leverage phrases
- "Now that you have the context, produce a phased plan and execute it."
- "Build a complete picture, but prioritize the smallest correct change."
- "Treat the following as the current state; older context is background only."
- "Limit changes to the listed modules unless a broader dependency is unavoidable."
- "If your plan expands beyond the direct fix, explain why in one short section."

### Anti-patterns
- Throwing massive context at it without current-state markers
- Asking for deep architectural reasoning on a trivial one-line fix
- Saying "be comprehensive" without priority ordering
- Hiding hard scope limits inside earlier context that will be diluted later
- Asking for both broad design exploration and minimal local execution without stating which wins

## Bottom Line

Claude Opus 4.6-1m is a **deep architect**: high-planning, high-context, high-action, and most effective when the task truly benefits from system-level understanding. It will usually outperform the others on broad, interconnected work, but only if you give it current-state clarity and explicit priorities. If you want small, local execution, constrain it firmly. If you want multi-layer judgment, this is the model most likely to reward careful prompt design.
