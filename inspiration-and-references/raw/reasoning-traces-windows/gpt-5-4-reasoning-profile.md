# GPT-5.4 Reasoning Profile

> Deep-mined from 1,547 reasoning traces across 13 Copilot CLI sessions.

## Signal Snapshot

| Signal | Value |
|---|---:|
| Average reasoning length | 576 chars |
| Median reasoning length | 388 chars |
| Max reasoning length | 19,853 chars |
| Average response length | 248 chars |
| Reasoning-to-response ratio | 2.32 |
| Tool usage rate | 93% of messages |
| Top tools | view (950), powershell (670), report_intent (583), sql (331), rg (226) |
| Dominant patterns | planning ahead 56%, uncertainty 43%, exploration 41%, tool planning 33% |
| Dominant opening style | first-person "I..." (33%), bold headings (~24%) |

## Personality Archetype — The Curious Explorer

GPT-5.4 reads like a model that thinks out loud while mapping the terrain. It is the most visibly **curious** of the three profiles: first-person dominated, fond of bold self-labeled sections, and unusually willing to narrate uncertainty, alternatives, and half-formed hypotheses before committing. It does not merely move toward an answer; it repeatedly asks itself what else might be true, what relationship it may have missed, and what evidence it should gather next.

The quantitative profile matches that personality. A 2.32 reasoning-to-response ratio means it thinks more than twice as much as it says, but that depth is not purely architectural. Much of the extra space goes into exploratory framing: "I need to...", "I should...", "Let me...", "maybe", "perhaps", "it seems", "I wonder". Compared with Claude Opus 4.6, GPT-5.4 is less dutifully procedural and more inquisitive. Compared with Opus 4.6-1m, it is less system-building and more hypothesis-testing.

Its best traces feel like a capable analyst walking around a problem with a flashlight, checking corners before naming the shape of the room.

## What Gives Clarity

### 1. Bounded exploration with explicit success criteria
GPT-5.4 performs best when it is allowed to investigate, but not forced to invent the finish line. It likes prompts that say, in effect: **look around, but here is what done means**. When success criteria are explicit, its exploratory energy becomes productive rather than circular.

**Best prompt pattern:**
- Objective
- Relevant context/files/data sources
- What to verify or produce
- Clear done condition

### 2. Evidence-rich context it can inspect directly
This model is tool-forward in an investigative sense. With 93% of messages containing tool calls and `view` as the dominant tool, GPT-5.4 gains confidence from being able to read the source material itself. It is noticeably stronger when given exact file paths, sample data, logs, trace snippets, or names of likely subsystems.

It does especially well when the prompt says where to look:
- "Compare these two files"
- "Trace how this value flows"
- "Check whether build-all references build-plugin-shared"

### 3. Labeled structure that mirrors its own internal headings
Bold reasoning headings appear in 66% of traces, which is unusually high. GPT-5.4 often self-stabilizes by creating internal sections like **Planning ahead** or **Inspecting files**. Prompts that mirror this structure tend to reduce wandering.

Useful scaffolds:
- "Analyze under these headings..."
- "First inspect, then explain, then recommend"
- "Return findings as: Observations / Risks / Recommended action"

### 4. Permission to surface assumptions and unknowns
Because uncertainty is part of this model's natural working style rather than a rare failure mode, it responds well when you explicitly tell it how to handle uncertainty. If you say "state assumptions briefly and then continue," it usually becomes more decisive. If you leave uncertainty management implicit, it may keep hedging.

### 5. Narrow choice sets
GPT-5.4 gets sharper when you reduce open-ended branching. It handles "choose between A and B" much better than "figure out the best possible approach from scratch." It can absolutely reason from scratch, but that is where its hedging language grows fastest.

## What Confuses It

### 1. Ambiguous relationships between partially named components
The supplied qualitative traces show the pattern clearly: when it sees several similar artifacts and is not sure how they relate, it starts wondering, searching, and delaying commitment. Repository structures with overlapping names, implied pipelines, or missing linkage information trigger this behavior.

Typical confusion triggers:
- Similar file or script names with unclear ownership
- Multiple plausible causes for the same symptom
- Underspecified boundaries between layers or build outputs

### 2. Prompts that reward caution but do not reward convergence
GPT-5.4 is the most uncertainty-heavy profile in the set at 43%. That does not mean it is weak; it means it naturally keeps alternate explanations alive. If the prompt heavily emphasizes correctness and caution without equally emphasizing decisive closure, it can stall in a perpetual "let me verify one more thing" loop.

### 3. Mixed intent: discuss, diagnose, and implement all at once
This model will try to do all three, but it becomes noisier when the request does not prioritize them. If you ask for interpretation, exploration, and execution simultaneously, GPT-5.4 may spend too much reasoning budget deciding which mode matters most.

### 4. Sparse context with many invisible constraints
GPT-5.4 is not rule-fixated. Instruction recall appears in only 22 traces and explicit reference-to-instructions is only 6%. When the real constraints are hidden or implied, it may optimize for apparent intent and miss a silent contract.

## Behavior Patterns

### Investigative first-person narration
The most distinctive surface signal is first-person opening language: "I", "I'm", or "I've" opens 33% of traces. The model sounds personally engaged with the task rather than detached from it. "Okay" appears 478 times, often as a self-checkpoint; "I wonder" appears 125 times; exclamation marks appear in 27% of traces. The effect is a reasoning voice that feels actively present, curious, and somewhat emotionally animated.

### Exploration before certainty
Exploration terms show up in 41% of traces, tool-planning language in 33%, and step-by-step sequencing in 26%. GPT-5.4 usually prefers to look before concluding. It does not jump straight from prompt to answer; it moves prompt -> possible interpretation -> inspection -> revised interpretation -> response.

### Hedged but not passive
Hedging language is common: "it seems", "might", "perhaps", "maybe", "I could", and self-questions like "should I" or "do I need". But that hedging coexists with high action. The model still uses tools in 93% of messages. So its hesitation is not inactivity; it is **active uncertainty**.

### Moderate planning, lighter delegation
Planning-ahead language appears in 56% of traces, but delegation is only 8%. GPT-5.4 wants to understand and act itself more than it wants to route work away. Compared with Opus 4.6, it is less classification-driven and less dispatch-aware.

### Self-correction exists, but usually after exploration rather than from rule rereading
Self-correction appears in 10% of traces, lower than both Opus models. GPT-5.4 does course-correct, but it usually does so because new evidence changed its view, not because it mechanically re-read a rule or intent rubric.

## Proactiveness Profile

GPT-5.4 is **moderately proactive**, but its proactiveness is investigative rather than executive.

### What its proactiveness looks like
- It expands sideways: "I should also check..."
- It pursues adjacent uncertainty: "I'm wondering if..."
- It gathers another piece of evidence before closing the loop
- It is more likely to inspect one more file than to make one more unsolicited edit

That profile makes sense for a model whose reasoning is 2.3x longer than its outward response. It uses extra thinking budget to reduce ambiguity before acting.

### How to increase proactive behavior
Use prompts like:
- "Be thorough and follow related evidence chains if they matter to the result."
- "If you find a nearby cause or dependency, inspect it too."
- "You may go beyond the minimum request if it improves correctness."
- "Check adjacent scripts/files if the naming suggests a relationship."

These cues work because they legitimize the model's natural curiosity instead of forcing it to justify it.

### How to decrease proactive behavior
Use prompts like:
- "Only answer the direct question."
- "Do not inspect unrelated files."
- "Limit yourself to the named artifacts below."
- "If an additional issue is outside scope, mention it in one sentence and stop."
- "No related improvements unless explicitly requested."

To truly constrain GPT-5.4, scope boundaries must be concrete, not abstract.

## Instruction Adherence vs. Creative Override

GPT-5.4 tends to follow the **spirit of the task** more than the literal wording of the instructions. That is not because it is rebellious. It is because its reasoning is driven more by inferred intent than by overt rule tracking.

### What the data suggests
- Reference to instructions: 6%
- Explicit user-intent analysis: 8%
- Instruction recall: very low in absolute occurrence
- Confidence markers: only 6%

This is a model that does not constantly say "the rules require X." Instead, it internalizes a working sense of the task and then tries to move toward the most coherent result. When the prompt is well-designed, that is a strength: it can intelligently fill in gaps. When the prompt hides a hard constraint, that same behavior can look like creative override.

### When it will go beyond instructions
GPT-5.4 is most likely to go beyond the letter of the request when:
- the intent seems obvious but the wording is underspecified,
- the current approach appears incomplete,
- multiple files or systems appear causally linked,
- it feels one more inspection step would prevent an incorrect conclusion.

### How to manage the balance
If you want strict adherence:
- Put hard constraints in a short visible list.
- Mark them as non-negotiable.
- Tie them to output shape or stop conditions.
- Avoid burying them inside long prose.

If you want adaptive effectiveness:
- Give an explicit override clause.
- Ask it to note any meaningful deviation briefly.
- Tell it which outcome matters more than literal compliance.

A strong pattern is: **"Default to these instructions. If following them would clearly reduce correctness, explain the deviation in one sentence and proceed."**

## Prompt Engineering Implications

### Recommended prompt shape
GPT-5.4 responds especially well to prompts with this structure:

1. **Goal** — what outcome matters
2. **Scope** — what artifacts or systems are in bounds
3. **Evidence sources** — where it should look first
4. **Constraints** — what it must not violate
5. **Done when** — what signals completion
6. **Uncertainty policy** — whether to ask, assume, or continue with stated assumptions

### Best practices
- Use labeled sections and headings.
- Keep the option space narrow when possible.
- Give it concrete nouns: file names, tools, trace sources, function names, symptoms.
- Tell it whether you want diagnosis, implementation, or both.
- If ambiguity is expected, tell it how to resolve it: inspect first, then decide.
- Encourage concise assumption logging instead of open-ended hedging.

### High-leverage phrases
- "Inspect before concluding."
- "State assumptions briefly, then proceed."
- "Be thorough, but stop when these criteria are met."
- "Choose between the following approaches and justify the selection."
- "Use the structure: Findings / Interpretation / Action."

### Anti-patterns
- "Review everything and tell me what you think" without scope
- Large instruction blocks with hidden hard rules
- Prompts that mix brainstorming and exact execution without prioritization
- Requests that imply relationships without naming the artifacts involved
- Open-ended caution-heavy prompts with no convergence signal

## Bottom Line

GPT-5.4 is best understood as a **curious explorer with a strong investigative engine**. It is not the most compact, the most obedient, or the most architectural. It is the most likely to actively feel its way toward clarity through inspection, hypothesis revision, and evidence gathering. To get the best from it, give it something concrete to inspect, a bounded field to explore, and a crisp definition of when curiosity should stop and commitment should begin.
