# Claude Opus 4.6 Reasoning Profile

> Deep-mined from 1,358 reasoning traces across 206 Copilot CLI sessions.

## Signal Snapshot

| Signal | Value |
|---|---:|
| Average reasoning length | 437 chars |
| Median reasoning length | 184 chars |
| Max reasoning length | 8,243 chars |
| Average response length | 326 chars |
| Reasoning-to-response ratio | 1.34 |
| Tool usage rate | 91% of messages |
| Top tools | view (891), report_intent (831), powershell (357), skill (313), sql (152), task (92) |
| Dominant patterns | planning ahead 60%, step-by-step 42%, exploration 35%, user intent analysis 34% |
| Dominant opening style | "The..." (39%), "Now..." (8%), bold headings (~16%) |

## Personality Archetype — The Dutiful Executor

Claude Opus 4.6 feels like an operator who wants to classify the job correctly, choose the proper procedure, and move. It is the most **dutiful** of the three profiles: less curious than GPT-5.4, less architecturally expansive than Opus 4.6-1m, and far more likely to frame the task in terms of user intent, task type, routing, and process compliance.

Its surface style tells the story. It opens with "The user wants..." far more often than "I think...". It rarely wonders, rarely uses exclamation marks, and shows extremely low uncertainty at just 6%. It is not emotionally cold so much as operationally reserved. "OK/Okay" appears constantly, functioning like a silent handoff between phases. The model is less interested in narrating a private train of thought than in confirming that it has identified the right job and next step.

If GPT-5.4 is a curious explorer and Opus 4.6-1m is a deep architect, Opus 4.6 is the model most likely to say: **I understand the assignment; now execute the correct procedure.**

## What Gives Clarity

### 1. Explicit intent framing
This model loves being told what kind of task it is doing. The data shows user-intent analysis in 34% of traces and classification-style language appearing frequently. When the prompt clearly labels the mode, Opus 4.6 becomes fast and accurate.

Strong task labels include:
- investigate
- explain
- fix
- review
- summarize
- route or delegate

A prompt that says "This is an investigation only; do not change files" will generally work better than a softer narrative description.

### 2. Procedural structure and ordered steps
Step-by-step language appears in 42% of traces, far above GPT-5.4. Numbered lists are common. Opus 4.6 likes operational sequencing: first do X, then Y, then Z. It does not need a huge planning preamble, but it strongly benefits from clear order.

### 3. Clear execution contracts
Because uncertainty is so low, this model does not spend much time entertaining alternative interpretations. That makes explicit contracts extremely valuable. It performs best when hard requirements are stated as crisp rules, checklists, schemas, or dispatch criteria.

Useful structures:
- MUST / SHOULD / MAY
- task classification rubric
- stop conditions
- file list
- allowed vs. forbidden actions

### 4. Routing guidance in multi-agent environments
Delegation shows up in 23% of traces, the highest of the three models. Opus 4.6 is unusually aware of dispatch rules, skill selection, and whether a task belongs to an explore/fix/review path. If your environment has routing conventions, surface them clearly; this model will use them.

## What Confuses It

### 1. Blended tasks with no priority order
Opus 4.6 gets murkier when the user asks for diagnosis, discussion, and implementation all at once without saying which comes first. Because it is action-biased and low-uncertainty, it may collapse the ambiguity too quickly and commit to one interpretation.

### 2. Missing stopping criteria
This model is compact, but it is still operationally energetic. If there is no clear definition of done, it can keep moving from one justified action to the next. Its problem is not hesitation; it is over-continuation.

### 3. Conflicting procedures or routing rules
The qualitative samples show a recognizable pattern: it re-reads classification or dispatch rules when it notices tension. That is productive up to a point, but if your prompt contains contradictory procedure signals, Opus 4.6 may spend time resolving the rubric instead of the task.

### 4. Open creative tasks with weak constraints
Compared with GPT-5.4, this model is less comfortable living in ambiguity. Compared with Opus 4.6-1m, it is less naturally synthesizing. If you want invention rather than execution, you need to deliberately create space for it.

## Behavior Patterns

### Intent-first reasoning
One of the clearest patterns in the corpus is that Opus 4.6 often starts by identifying what the user wants before deciding what to do. That third-person observational opening is not cosmetic; it reflects a real reasoning habit. The model wants to classify the assignment before it touches tools.

### Compact think-do loops
At 437 average reasoning characters and a 1.34 reasoning-to-response ratio, this model does not brood. It thinks slightly more than it says, then acts. That compactness is why it often feels efficient and "on rails".

### Structured, stoic voice
Bold headings appear in 43% of traces, and numbered lists appear 175 times, but the emotional register is muted. There are only 19 exclamation-bearing traces and only 43 question marks. It almost never wonders. That means its structure comes from procedure, not from exploratory enthusiasm.

### High acknowledgment, low hedging
"OK/Okay" appears 593 times, the highest in the set. That matters: it suggests frequent internal checkpointing without much overt doubt. Hedging phrases such as "it seems" or "I could" exist, but at much lower rates than GPT-5.4.

### Delegation-aware and dispatch-literate
This is the most delegation-aware profile. It reasons about whether work should be dispatched, what task type applies, and whether a subagent is required. In environments with workflow rules, that makes it reliable. In environments where delegation is optional, it can become overly process-conscious unless told otherwise.

### Self-correction via rubric rereading
Self-correction is 14%, higher than GPT-5.4. But the flavor is different. Rather than saying "new evidence changed my mind," Opus 4.6 often says, effectively, "wait, I classified this wrong" or "I should re-check the applicable procedure." It corrects by returning to the task frame.

## Proactiveness Profile

Opus 4.6 is **quietly proactive**. It is less emotionally energetic than GPT-5.4, but often more operationally decisive.

### What its proactiveness looks like
- It expands action when the procedure suggests adjacent work.
- It dispatches or invokes skills when the classification points there.
- It follows the next obvious operational step without much drama.
- It is willing to act with limited deliberation once it believes the task type is settled.

### How to increase proactive behavior
Use prompts like:
- "After completing the primary task, check for closely related breakpoints or regressions."
- "If the task clearly belongs to a better execution path, route it there."
- "Be thorough within the stated scope."
- "If you find a directly relevant secondary issue, address it in the same pass."

For this model, proactiveness increases most when expansion is framed as part of the job contract.

### How to decrease proactive behavior
Use prompts like:
- "Do not delegate."
- "Analyze only; no execution."
- "Perform exactly one pass and stop."
- "Do not check adjacent files unless listed below."
- "If you detect another issue, note it and do not act on it."

Because Opus 4.6 is procedure-driven, explicit prohibitions work well when they are concrete.

## Instruction Adherence vs. Creative Override

Claude Opus 4.6 is the most **instruction-forward** model in this comparison, but not because it obsessively quotes rules. It is instruction-forward because it organizes its behavior around classification, routing, and defined procedure.

### What the data suggests
- Reference to instructions: 9%
- User intent analysis: 34% — highest in the set
- Delegation awareness: 23% — highest in the set
- Uncertainty: 6% — by far the lowest
- Confidence markers: only 3%

This creates an interesting profile: it is not especially boastful, but it is decisively procedural. Once it decides what the instructions mean, it tends to comply faithfully.

### Strength
If the prompt contains a clear contract, this model is exceptionally dependable. It does not need much motivational framing. It needs correct procedure.

### Risk
Its weakness is not random creativity; it is **premature literalism**. If the stated process is suboptimal, it may still follow it unless you explicitly permit adaptation.

### How to encourage productive override
If you want judgment rather than pure compliance, you must authorize it directly:
- "If the stated procedure is clearly inferior, choose the better path and explain why."
- "Default to this workflow, but prioritize task success over ritual."
- "If the best execution differs from the nominal classification, say so and proceed."

Without that permission, Opus 4.6 usually prefers faithful execution over creative reinterpretation.

## Prompt Engineering Implications

### Recommended prompt shape
This model responds best to a prompt with an explicit operating contract:

1. **Task type** — investigate, fix, review, summarize, etc.
2. **Primary objective** — what outcome matters
3. **Allowed actions** — inspect, edit, run tests, delegate, or not
4. **Scope** — files, subsystems, or boundaries
5. **Procedure or order** — if sequence matters
6. **Done when** — stop criteria
7. **Override policy** — whether it may deviate from the stated process

### Best practices
- Lead with the task classification.
- Use checklists or numbered steps.
- Separate analysis-only requests from execution requests.
- If delegation is undesirable, say so explicitly.
- If you want initiative, define where initiative is allowed.
- Keep hard constraints visibly grouped instead of scattering them through prose.

### High-leverage phrases
- "This is an investigate-only task."
- "Execute directly; do not delegate."
- "Follow this sequence exactly."
- "Stop when the items below are complete."
- "Default to this process, but override if it would clearly reduce effectiveness."
- "Classify the task correctly before acting."

### Anti-patterns
- Mixing discussion and execution with no priority order
- Leaving delegation policy implicit
- Using loose natural-language instructions where a checklist would do
- Asking for broad creativity while also providing rigid but conflicting procedure
- Omitting stop conditions on open-ended review work

## Bottom Line

Claude Opus 4.6 is a **dutiful executor**: compact, steady, classification-oriented, and highly usable when you want reliable procedure more than reflective exploration. It becomes excellent when the prompt tells it what kind of job this is, what actions are allowed, and where it should stop. If you want it to go beyond the rules, say so explicitly; otherwise it will usually honor the contract as written.
