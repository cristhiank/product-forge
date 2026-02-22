---
name: experts-council
description: "ALWAYS use when the user says \"ask the experts\", \"explore options for\", \"ask gemini, opus and gpt\", \"experts council\", \"multi-model review\", \"ask multiple models\", \"council review\", \"get different perspectives\", \"what do the models think\", or wants diverse LLM perspectives on any topic — code reviews, architecture decisions, brainstorming, gap analysis, approach evaluation, domain naming, or second-pass verification. Spawns 3 parallel task calls to different model providers (Gemini, Opus, GPT), anonymizes responses, then synthesizes via a chairman model."
---

# Experts Council

2-stage multi-model deliberation protocol. Spawn 3 LLMs in parallel, anonymize responses, synthesize via chairman.

## Council Roster (Fixed)

| Seat | Model ID | Provider |
|------|----------|----------|
| 1 | `gemini-3-pro-preview` | Google |
| 2 | `claude-opus-4.6` | Anthropic |
| 3 | `gpt-5.3-codex` | OpenAI |

## Protocol

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
- Include the full user query/question verbatim
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
   | # | Finding | Detail |

2. **Majority View** — Where 2 agree and 1 dissents. Present as:
   | # | Majority Position | Dissenting View |

3. **Unique Insights** — Novel findings from only 1 expert that others missed.

4. **Conflicts** — Direct contradictions between experts. Note both positions.

5. **Recommendation** — Your synthesized recommendation incorporating the strongest elements from all responses. Be decisive.

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

## Output Format

Present the chairman's synthesis to the user as:

```markdown
## 🏛️ Council Verdict: [topic summary]

### ✅ Consensus (all 3 agree)
| # | Finding | Detail |
|---|---------|--------|
| 1 | ... | ... |

### ⚖️ Majority View (2 vs 1)
| # | Majority Position | Dissenting View |
|---|-------------------|-----------------|
| 1 | ... | ... |

### 💡 Unique Insights
- **[Model]**: [finding no one else caught]

### ⚠️ Conflicts
- [description of contradiction, if any]

### 🎯 Recommendation
[Chairman's synthesized recommendation]

---
*Council: Gemini 3 Pro · Opus 4.6 · GPT-5.3 Codex | Chairman: [model]*
*Responses were anonymized during synthesis to prevent bias*
```

## Caller Checklist

1. ☐ Construct the council prompt with full context inline
2. ☐ Spawn 3 parallel `task` calls (all `general-purpose`, different `model`)
3. ☐ Wait for all 3 to complete
4. ☐ Anonymize responses (A, B, C) — keep private mapping
5. ☐ Select chairman (best response's model, or default opus)
6. ☐ Spawn chairman synthesis with anonymized responses
7. ☐ De-anonymize in final output
8. ☐ Present using output format above

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
