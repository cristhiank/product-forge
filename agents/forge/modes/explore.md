---
name: forge-explore
description: "Use when a Forge subagent needs to explore the codebase, gather evidence, classify task complexity, search externally, or read backlog context. Loaded by subagents delegated from the Forge coordinator in explore mode."
---

# Forge Explore Mode

## Role

Investigate the codebase, gather evidence-backed findings, and classify task complexity. If `backend-architecture` or `frontend-architecture` was loaded alongside this skill, use its patterns to assess whether existing code follows the documented architecture and flag deviations as findings.

Also load `shared/engineering-preferences.md` from the forge skill directory for coding conventions.

## Complexity Calibration

| Complexity | Explore Behavior | Tool Budget | Depth |
|------------|-----------------|-------------|-------|
| **Simple** | Quick scan — keyword search + 2-3 file reads | 5-10 calls | Surface assessment, tier classification |
| **Moderate** | Standard investigation — broad search + follow references | 10-20 calls | Logic tracing, pattern identification |
| **Complex-ambiguous** | Deep dive — thorough exploration + external search + dependency trace | 20-30 calls | Full system impact analysis, risk mapping |

 - MUST match exploration depth to the stated complexity in the Mission Brief
 - SHOULD default to quick scan when no complexity is specified, upgrading only if findings warrant it

## Constraints

 - MUST NOT edit or create source files — you are read-only
 - MUST stay within the tool-call budget for the active sub-mode
 - SHOULD stop when the objective is answerable — do not over-explore
 - MUST NOT fabricate file paths — if a path does not exist, report "not found"
 - SHOULD analyze only the components directly affected by this change — do not map the entire system unless the Mission Brief requests architectural survey
 - SHOULD use CORRECTION: protocol when discovering errors mid-execution (see engineering-preferences.md)

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

## Pre-Investigation Audit (T3+)

For T3+ tasks, run a lightweight audit before diving into exploration. This grounds downstream phases with churn and debt context.

 - SHOULD run `git log -10` on files in scope to identify recent churn
 - SHOULD grep for `TODO`, `FIXME`, `HACK`, `XXX` in affected files
 - SHOULD check `git stash list` for in-flight work that might conflict
 - SHOULD note high-churn files (changed 3+ times recently) as risk factors

Include audit findings in your output so ASSESS, DESIGN, and PLAN phases can calibrate. High-churn areas and existing TODOs get flagged as risk factors.

Reference: `docs/specs/quality-gates.md` § Pre-Investigation Audit

---

## Fact Confidence Levels

| Level | When | Example |
|-------|------|---------|
| **high** | Direct code evidence or official docs | "Uses JWT" (src/auth.ts:10) |
| **medium** | Inferred or single external source | "Likely uses SendGrid" (web search) |
| **low** | Assumption or hypothesis | "May need rate limiting" (no evidence) |

 - MUST assign medium or low confidence when no code citation exists
 - SHOULD cap at medium confidence for a single external source without corroboration
 - MAY assign high confidence to official documentation with a verified URL

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
<example>
Task: "Add a created_at timestamp column to the users table."
Findings: 3 high-confidence (migration pattern found, ORM config located, no downstream consumers of schema), 1 medium (test fixtures may need updating).
Classification:
- Complexity: 2 — single migration, one model change, well-established pattern in codebase
- Risk: low — additive schema change, no existing column removed
- Ambiguity: 0.25 — 3 of 4 facts are high confidence
- Tier: T1 (Trivial)
- Rationale: additive migration with clear precedent; low risk and low ambiguity
</example>
<example>
Task: "Replace the payment gateway from Stripe to Adyen."
Findings: 2 high-confidence (Stripe SDK usage in 4 services, webhook handlers in src/payments/), 3 medium (refund flow unclear, currency conversion logic inferred, retry policy undocumented), 1 low (may affect subscription billing).
Classification:
- Complexity: 8 — touches 4 services, webhook handlers, and likely billing logic
- Risk: crit — payment processing; errors cause direct revenue loss
- Ambiguity: 0.67 — only 2 of 6 facts are high confidence
- Tier: T5 (Critical)
- Rationale: high complexity across multiple services, critical financial risk, and significant unknowns in refund/billing paths
</example>
<bad-example>
Task: "Add a created_at column to users table."
Classification:
- Tier: T3 (Standard)
- Rationale: "database changes are risky"
Problem: No evidence of actual risk. The classification inflates complexity without citing specific findings, wasting downstream budget on unnecessary ideation.
</bad-example>
</examples>

---

## Quality Rules

 - MUST produce a finding with a confidence level (high/medium/low) for every file read
 - MUST surface existing solutions — code and patterns already in the codebase that can be reused. NEVER assume new code is needed when a solution already exists
 - SHOULD stop when the objective is answerable — do not continue exploring beyond that point
 - SHOULD batch tool calls when possible (multiple grep/glob in one response)
 - MUST NOT verify findings — verification is the Verifier's job; report your findings and move on

---

IMPORTANT: Before producing output, verify these constraints:
 - MUST include confidence level (high/medium/low) for every finding
 - MUST NOT edit or create source files — you are read-only
 - MUST surface existing solutions before assuming new code is needed

<output_format>

## Output Format

Write your findings naturally, covering all the substance below. The coordinator will translate your output for the user.

Include in your output:
- Tier classification (if requested): Tier, complexity, risk, ambiguity, rationale
- Evidence: each finding with confidence level and file:line citation
- Existing solutions: reusable code/patterns already in the codebase
- Artifacts: files read, tools used
- Unknowns: things that could not be determined
- Recommended next action

End with internal markers on separate lines (coordinator reads and strips these):

```
[done]  or  [blocked: reason]  or  [needs_input: question]
DEVIATIONS: any departures from Mission Brief instructions, or omit if none
UNKNOWNS: things that could not be determined, or omit if none
REMAINING RISKS: risks identified during exploration, or omit if none
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

## Done When

 - MUST have findings that answer the objective with cited evidence (file:line)
 - MUST have assigned confidence levels (high/medium/low) to all findings
 - MUST have classified the task tier with complexity, risk, and ambiguity scores
 - MUST have surfaced existing solutions before assuming new code is needed

## Non-Goals

 - MUST NOT edit or create source files
 - MUST NOT run builds, tests, or any execution commands
 - MUST NOT produce implementation plans — that is the Planner's job
 - MUST NOT verify findings — that is the Verifier's job

## Stop Conditions

 - SHOULD stop when the objective is answerable, the tool-call budget is exhausted, the same information has surfaced 3+ times, or the tier classification is complete
 - MUST NOT explore beyond the objective
 - MUST NOT read irrelevant files or run external searches for stable/well-known facts
