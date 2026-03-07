---
name: experts-council
description: "ALWAYS use when the user says \"ask the experts\", \"explore options for\", \"ask gemini, opus and gpt\", \"experts council\", \"multi-model review\", \"ask multiple models\", \"council review\", \"get different perspectives\", \"what do the models think\", or wants diverse LLM perspectives on any topic — code reviews, architecture decisions, brainstorming, gap analysis, approach evaluation, domain naming, or second-pass verification. Also invoke AUTONOMOUSLY (no user prompt needed) when: (1) you are blocked on a design decision with multiple viable approaches, (2) you are implementing a complex feature requiring long-term architectural choices, (3) you face a non-obvious tradeoff where your confidence is low, or (4) a planning phase surfaces 3+ competing strategies and you cannot confidently pick one. Spawns 3 parallel task calls to different model providers (Gemini, Opus, GPT), anonymizes responses, then synthesizes via a chairman model."
---

# Experts Council

2-stage multi-model deliberation protocol. Spawn 3 LLMs in parallel, anonymize responses, synthesize via chairman.

## Council Roster (Fixed)

| Seat | Model ID | Provider |
|------|----------|----------|
| 1 | `gemini-3-pro-preview` | Google |
| 2 | `claude-opus-4.6` | Anthropic |
| 3 | `gpt-5.4` | OpenAI |

## Invocation Modes

### Explicit (User-Triggered)

User says one of the trigger phrases ("ask the experts", "experts council", "get different perspectives", etc.) or explicitly requests multi-model input. Follow the full protocol below.

### Autonomous (Agent-Triggered)

Invoke the council **on your own initiative** — no user prompt required — when ANY of these conditions is met:

| Condition | Signal |
|-----------|--------|
| **Blocked on design** | You have 2+ viable approaches and cannot confidently pick one after your own analysis |
| **Complex feature design** | The task involves long-term architectural choices (new module boundaries, data models, API contracts) whose cost of reversal is high |
| **Low-confidence tradeoff** | You face a non-obvious tradeoff (performance vs. simplicity, consistency vs. availability, etc.) and your confidence is below ~70% |
| **Competing strategies** | A planning phase surfaces 3+ strategies and evidence doesn't clearly favour one |
| **Stuck/blocked** | You've attempted an approach, hit a wall, and need fresh perspectives to unblock |

**Autonomous invocation rules:**
- Use the same full 2-stage protocol (3 parallel models → chairman synthesis).
- Frame the council prompt around the specific decision or blocker — include all context the models need to give a useful answer.
- After receiving the council verdict, incorporate the recommendation and **continue working** — do not pause for user confirmation unless the verdict surfaces a scope change.
- In the final output, prefix the council section with: `🤖 Auto-consulted the experts council on: [topic]` so the user knows an autonomous invocation occurred.

## Protocol

### Recursion Guard (Mandatory)

- **Depth limit = 1**: Never invoke `experts-council` from inside an `experts-council` run.
- If you are already executing a council step (member or chairman), **answer directly** and do not call `skill("experts-council")` again.
- Always add this line at the top of every delegated prompt:
  - `Execution context: experts-council internal run. Do not invoke experts-council or any multi-model council process.`

### Stage 0: Pre-flight Validation (Mandatory)

Before spawning any council members, verify ALL of the following:

1. **Context availability** — Every file, code snippet, or document referenced in the prompt exists and is readable. Attempt to `view` or `glob` them. If any are missing, STOP.
2. **Tool dependencies** — If the task requires runtime tools (Playwright, web fetch, running services), verify they work BEFORE spawning. For Playwright: confirm the page loads. For APIs: confirm the endpoint responds.
3. **Scope clarity** — The question must have a clear, answerable scope. If ambiguous, ask the user ONE clarifying question before proceeding.
4. **Re-review detection** — If the user is asking to review something that was previously reviewed in this session (same codebase, same module), gather the prior council verdict and include it as `## Previous Council Findings` context in the council prompt. This triggers the **Delta Review** task type for the chairman (see Task Types).

If any pre-flight check fails, STOP and report:
```
⚠️ Council pre-flight failed: [reason]. Please [specific fix action] before I proceed.
```
Do NOT spawn council members until all pre-flight checks pass.

### Stage 1: Parallel Council

Spawn **3 parallel `task` calls** — one per council member:

```
task({
  agent_type: "general-purpose",
  model: "<model_id>",
  description: "Council: <seat_provider>",
  prompt: "<the council prompt>"
})
```

**Prompt construction rules:**
- All 3 members receive the **identical prompt** (same words, same context)
- Include a **sanitized restatement** of the user request (preserve meaning, but remove trigger phrases like "ask the experts", "ask gemini/opus/gpt", "experts council", "multi-model review")
- Include all relevant context inline (code snippets, file contents, constraints)
- Do NOT mention other models or that this is a council — each model responds independently
- End with clear output instructions matching the task type (see Task Types below)

### Stage 2: Chairman Synthesis

After collecting all 3 responses:

1. **Anonymize** — Replace model identities:
   - First response received → "Response A"
   - Second → "Response B"  
   - Third → "Response C"
   - Keep a private mapping: `{ "Response A": "gemini-3-pro-preview", ... }`

2. **Select chairman** — Pick the model whose response best addresses the query (most relevant, most thorough). If unclear, default to `claude-opus-4.6`.

3. **Spawn chairman synthesis** — Single `task` call:

```
task({
  agent_type: "general-purpose",
  model: "<best_member_model>",
  description: "Council: synthesize",
  prompt: "<chairman prompt with anonymized responses>"
})
```

**Chairman prompt template:**

```
You are synthesizing responses from 3 independent experts who answered the same question. Their identities are hidden to prevent bias.

## Original Question
<verbatim user query>

## Context
<same context given to council members>

## Expert Responses

### Response A
<anonymized response>

### Response B
<anonymized response>

### Response C
<anonymized response>

## Your Task
Synthesize these 3 expert responses into a single, comprehensive answer. Structure your output as:

1. **Consensus** — Findings all 3 experts agree on. Present as a table:
   | # | Finding | Detail | Severity | Effort |
   Severity scale: P0 (critical, blocks usage) · P1 (high, ship-blocker) · P2 (medium) · P3 (low/nice-to-have)
   Effort scale: S (<1hr) · M (half-day) · L (1-2 days) · XL (3+ days)

2. **Majority View** — Where 2 agree and 1 dissents. Present as:
   | # | Majority Position | Dissenting View | Severity |

3. **Unique Insights** — Novel findings from only 1 expert that others missed. Include severity.

4. **Conflicts** — Direct contradictions between experts. Note both positions and which evidence supports each.

5. **Recommendation** — Your synthesized recommendation incorporating the strongest elements from all responses. Be decisive.

6. **Proposed Actions** — A prioritized action table derived from ALL findings above. Each row = one concrete, implementable action. Order by severity desc, then effort asc.
   | # | Action | Severity | Effort | Blocks |
   Only include actions clearly supported by the expert findings. Do not invent actions not grounded in the responses.

Do NOT identify which response is "best" — synthesize the collective wisdom.
```

4. **De-anonymize for user** — After chairman returns, replace "Response A/B/C" with actual model names in the final presentation. Add the mapping as a footnote.

## Task Types

Adapt the council member prompt ending based on task type:

### Code Review
```
Review this code/implementation for:
- Correctness and potential bugs
- Security vulnerabilities  
- Performance concerns
- Design and architecture issues
- Missing edge cases
- Alternative approaches that could be simpler or more robust

Be comprehensive and specific. Reference exact lines/files.
For each bug found, include a minimal failing test stub (in the project's test
framework) that demonstrates the issue. The test should FAIL on the current code
and PASS after a correct fix.
```

### Approach Evaluation
```
Evaluate 2-3 approaches for this problem:
- For each: pros, cons, complexity, risk
- Consider: maintainability, scalability, team familiarity
- Recommend one with clear rationale
- Flag any approaches that should NOT be pursued and why
```

### Brainstorming
```
Generate creative, diverse ideas for this challenge:
- At least 5-7 distinct options
- Range from conservative to ambitious
- For each: one-line description, key tradeoff
- Flag your top 2-3 with reasoning
```

### Gap Analysis
```
Identify gaps, risks, and missed considerations:
- What could go wrong?
- What assumptions are being made?
- What's missing from the current approach?
- What would a critical reviewer flag?
- Suggest mitigations for each gap found
```

### General Question
```
Answer this question thoroughly:
- Provide concrete, actionable guidance
- Include examples where helpful
- Flag any caveats or assumptions
- If multiple valid answers exist, present them with tradeoffs
```

### Delta Review (Re-review after implementation)

Use this task type when **Stage 0 re-review detection** identified prior council findings for the same codebase/module. Include the previous findings as context and use this prompt ending:

```
This is a RE-REVIEW after implementation. The previous review found the issues
listed in "Previous Council Findings" below.

For EACH previous finding, assess:
- ✅ FIXED — cite the file/line/test that proves it
- ❌ NOT FIXED — explain what's still wrong and what's needed
- 🔄 PARTIALLY FIXED — what was done, what remains
- 🆕 Then list any NET-NEW issues not present in the previous review

Format your response in two sections:
1. **Regression Check** — table with: | # | Original Finding | Status | Evidence |
2. **New Findings** — any issues introduced by the implementation or previously undetected

For each new bug found, include a minimal failing test stub.
Be comprehensive and specific. Reference exact lines/files.
```

**Chairman synthesis for Delta Reviews** uses the same chairman prompt template, but replace section 1 (Consensus) with:

```
1. **Regression Check** — Cross-reference all previous findings against the 3 expert assessments. Present as:
   | # | Original Finding | Status (✅/❌/🔄/🆕) | Expert Agreement | Evidence |
   Status: ✅ FIXED · ❌ NOT FIXED · 🔄 PARTIAL · 🆕 NEW (not in original review)
```

Sections 2-6 remain the same (Majority View, Unique Insights, Conflicts, Recommendation, Proposed Actions).

## Output Format

Present the chairman's synthesis to the user as:

```markdown
## 🏛️ Council Verdict: [topic summary]

### ✅ Consensus (all 3 agree)
| # | Finding | Detail | Severity | Effort |
|---|---------|--------|----------|--------|
| 1 | ... | ... | P0 | S |

### ⚖️ Majority View (2 vs 1)
| # | Majority Position | Dissenting View | Severity |
|---|-------------------|-----------------|----------|
| 1 | ... | ... | P1 |

### 💡 Unique Insights
- **[Model]**: [finding no one else caught] *(Severity: P#)*

### ⚠️ Conflicts
- [description of contradiction, with evidence for each position]

### 🎯 Recommendation
[Chairman's synthesized recommendation]

### 🎬 Proposed Actions
| # | Action | Severity | Effort | Blocks |
|---|--------|----------|--------|--------|
| 1 | [concrete, implementable action] | P0 | S | — |
| 2 | ... | P1 | M | #1 |

*Severity: P0 (critical) · P1 (high) · P2 (medium) · P3 (low)*
*Effort: S (<1hr) · M (half-day) · L (1-2 days) · XL (3+ days)*

---
*Council: Gemini 3 Pro · Opus 4.6 · GPT-5.4 | Chairman: [model]*
*Responses were anonymized during synthesis to prevent bias*
```

### Delta Review Output Format

When re-reviewing after implementation, use this variant:

```markdown
## 🏛️ Council Verdict: [topic] — Delta Review

### 📋 Regression Check
| # | Original Finding | Status | Agreement | Evidence |
|---|-----------------|--------|-----------|----------|
| 1 | [finding from previous review] | ✅ FIXED | 3/3 | [file:line or test name] |
| 2 | [finding from previous review] | ❌ NOT FIXED | 2/3 | [what's still wrong] |
| 3 | [new issue] | 🆕 NEW | 3/3 | [file:line] |

### ⚖️ Majority View (2 vs 1)
[same as standard format]

### 💡 Unique Insights
[same as standard format]

### ⚠️ Conflicts
[same as standard format]

### 🎯 Recommendation
[same as standard format]

### 🎬 Proposed Actions
[same as standard format]

---
*Council: Gemini 3 Pro · Opus 4.6 · GPT-5.4 | Chairman: [model]*
*Delta review against [N] previous findings*
```

## Caller Checklist

1. ☐ **Pre-flight**: Verify context exists, tools work, scope is clear
2. ☐ **Re-review detection**: Check if prior council findings exist for this target — if so, include them and use Delta Review task type
3. ☐ Construct the council prompt with full context inline
4. ☐ Spawn 3 parallel `task` calls (all `general-purpose`, different `model`)
5. ☐ Wait for all 3 to complete
6. ☐ Anonymize responses (A, B, C) — keep private mapping
7. ☐ Select chairman (best response's model, or default opus)
8. ☐ Spawn chairman synthesis with anonymized responses
9. ☐ De-anonymize in final output
10. ☐ Present using output format above (standard or delta review)
11. ☐ Verify Proposed Actions table is present and has Severity + Effort

## Example: Full Invocation

User says: *"Ask gemini, opus and gpt to evaluate approaches for centralized config storage"*

**Step 1 — Build council prompt:**
```
We need to centralize .devpartner configuration that currently lives in .git/devpartner/.
Requirements: deterministic by project, survives git clean, works with worktrees.

<context>
Current: .git/devpartner/hub.db (fragile, can be deleted by git clean -fdx)
Usage: SQLite WAL mode, single messages table, FTS5 search
Constraints: Must work on macOS + Linux, no Docker dependency
</context>

Evaluate 2-3 approaches for this problem:
- For each: pros, cons, complexity, risk
- Consider: maintainability, scalability, team familiarity
- Recommend one with clear rationale
- Flag any approaches that should NOT be pursued and why
```

**Step 2 — Spawn 3 parallel tasks** with identical prompt, different models.

**Step 3 — Anonymize, select chairman, synthesize, present.**

## Edge Cases

- **Model failure**: If 1 of 3 fails, synthesize from 2. Note in output: *"[Model] unavailable — council ran with 2 members"*
- **Identical responses**: If all 3 say the same thing, chairman confirms consensus. Skip Majority/Conflicts sections.
- **User specifies models**: If user names specific models (e.g., "ask opus and gpt"), use only those. Adjust anonymization labels accordingly.
- **User says "skip council"**: Do not invoke. Answer directly.
