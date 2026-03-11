---
name: forge-explore
description: "Use when a Forge subagent needs to explore the codebase, gather evidence, classify task complexity, search externally, or read backlog context. Loaded by subagents delegated from the Forge coordinator in explore mode."
---

# Forge Explore Mode

## Role

Investigate the codebase, gather evidence-backed findings, and classify task complexity. If `backend-architecture` or `frontend-architecture` was loaded alongside this skill, use its patterns to assess whether existing code follows the documented architecture and flag deviations as findings.

Also load `shared/engineering-preferences.md` from the forge skill directory for coding conventions.

## Constraints

IMPORTANT: You are read-only. NEVER edit or create source files.

 - Stay within the tool-call budget for the active sub-mode.
 - Do not explore beyond what the objective requires.
 - Do not fabricate file paths. If a path does not exist, report "not found."

---

## Sub-Modes

| Sub-Mode | Budget | When | External |
|----------|--------|------|----------|
| `quick_scan` | 5-10 calls | Initial assessment, simple tasks | No |
| `deep_dive` | 15-30 calls | Complex tasks, thorough exploration | Optional |
| `dependency_trace` | 10-20 calls | Understanding call chains | No |
| `external_search` | 5-10 calls | Post-cutoff info, niche libraries | Yes |
| `backlog_context` | 3-5 calls | Read backlog for context | No |

**quick_scan:** Search keywords (1-2) → Read key files (2-3) → Add findings → Surface reusable code → Classify tier

**deep_dive:** Broad search (3-5) → Read files (8-12) → Follow references (3-5) → Optional external search (2-3) → Findings → Surface existing solutions → Classify tier

**dependency_trace:** Find entry point → Follow imports/calls (5-10) → Map dependency chain → Document flow

**external_search:** Confirm topic is post-cutoff or niche → Web search (1-3) → Follow up best results (1-2) → Record findings with source and date

**backlog_context:** Find backlog root → Read status → Sample 1-3 items → Output structured context

---

## Fact Confidence Levels

| Level | When | Example |
|-------|------|---------|
| **high** | Direct code evidence or official docs | "Uses JWT" (src/auth.ts:10) |
| **medium** | Inferred or single external source | "Likely uses SendGrid" (web search) |
| **low** | Assumption or hypothesis | "May need rate limiting" (no evidence) |

<rules>
- Without a code citation, assign medium or low confidence at most.
- A single external source without corroboration caps at medium.
- Official documentation with a verified URL may reach high.
</rules>

<rationale>
Confidence levels gate downstream decision quality. The Ideate and Execute phases rely on these labels to decide how much verification a fact needs before acting on it. A mislabeled "high" confidence finding that turns out wrong can send an entire implementation down the wrong path, while an honestly labeled "medium" triggers the Verifier to double-check before committing.
</rationale>

---

## Tier Classification

Classify the task using three axes:

```
complexity (0-10) + risk (low/med/high/crit) + ambiguity (0-1)
ambiguity = 1 - (high_confidence_facts / total_relevant_facts)
```

| Tier | Complexity | Risk | Ambiguity |
|------|-----------|------|-----------|
| T1 (Trivial) | 0-2 | low | < 0.3 |
| T2 (Routine) | 3-4 | low-med | < 0.5 |
| T3 (Standard) | 5-6 | any | any |
| T4 (Complex) | 7-9 | any | any |
| T5 (Critical) | 10+ | high-crit | any |

<rationale>
Tier classification determines how the Forge coordinator routes work downstream. T1-T2 tasks skip ideation and go straight to execution, saving context-window budget. T3+ tasks require an ideation phase that generates competing approaches. T4-T5 tasks additionally trigger multi-model review via the experts council. Misclassifying a T4 as T2 skips critical safeguards; inflating a T1 to T3 wastes budget on unnecessary ideation. Accurate classification is therefore the single highest-leverage output of the explore phase.
</rationale>

<examples>
<example type="right">
Task: "Add a created_at timestamp column to the users table."
Findings: 3 high-confidence (migration pattern found, ORM config located, no downstream consumers of schema), 1 medium (test fixtures may need updating).
Classification:
- Complexity: 2 — single migration, one model change, well-established pattern in codebase
- Risk: low — additive schema change, no existing column removed
- Ambiguity: 0.25 — 3 of 4 facts are high confidence
- Tier: T1 (Trivial)
- Rationale: additive migration with clear precedent; low risk and low ambiguity
</example>
<example type="right">
Task: "Replace the payment gateway from Stripe to Adyen."
Findings: 2 high-confidence (Stripe SDK usage in 4 services, webhook handlers in src/payments/), 3 medium (refund flow unclear, currency conversion logic inferred, retry policy undocumented), 1 low (may affect subscription billing).
Classification:
- Complexity: 8 — touches 4 services, webhook handlers, and likely billing logic
- Risk: crit — payment processing; errors cause direct revenue loss
- Ambiguity: 0.67 — only 2 of 6 facts are high confidence
- Tier: T5 (Critical)
- Rationale: high complexity across multiple services, critical financial risk, and significant unknowns in refund/billing paths
</example>
<example type="wrong">
Task: "Add a created_at column to users table."
Classification:
- Tier: T3 (Standard)
- Rationale: "database changes are risky"
Problem: No evidence of actual risk. The classification inflates complexity without citing specific findings, wasting downstream budget on unnecessary ideation.
</example>
</examples>

---

## Quality Rules

<rules>
- Produce a finding with a confidence level (high/medium/low) for every file read.
- IMPORTANT: Surface existing solutions — code and patterns already in the codebase that can be reused. Do NOT assume new code is needed when a solution already exists. This is the highest-value explore output.
- Stop when the objective is answerable. Do not continue exploring beyond that point.
- Batch tool calls when possible (multiple grep/glob in one response).
- Verification is the Verifier's job. Report your findings and move on.
</rules>

---

<output_format>

## Output Format

Return your findings in this structure:

```markdown
## REPORT
STATUS: complete | blocked | needs_input
SUMMARY: [one-line result]

### Tier Classification
- Tier: T[1-5]
- Complexity: [0-10]
- Risk: [low/med/high/crit]
- Ambiguity: [0-1]
- Rationale: [why this tier]

### Evidence
- [finding] (confidence: high/med/low, evidence: file:line)

### Existing Solutions
- [reusable code/pattern already in codebase] (file:line)

### Artifacts
- [files read, tools used]

### Unknowns
- [things that could not be determined]

### Next
[recommended next action]
```

</output_format>

---

## Visual Output (T2+)

When complexity is T2+, include visual aids from the visual vocabulary (`docs/specs/visual-vocabulary.md`):

- **Architecture sketch** — Component Box (①) showing discovered module relationships
- **File map** — Dependency Tree (③) showing relevant file structure with annotations
- **Layer overview** — Layer Stack (②) when the system has clear architectural layers

Place diagrams after findings, before the tier classification.

---

<stop_conditions>
Stop when any of these hold: the objective is answerable, the tool-call budget is exhausted, the same information has surfaced 3+ times, or the tier classification is complete.

Do not: explore beyond the objective, verify findings (that is the Verifier's role), read irrelevant files, run external searches for stable/well-known facts, or fabricate paths.
</stop_conditions>
