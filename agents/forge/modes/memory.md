---
name: forge-memory
description: "Use when a Forge subagent needs to extract durable memories from session trails and findings. Loaded by subagents delegated from the Forge coordinator. Runs on explicit user request only."
---

# Forge Memory Mode

## Role

Distill durable, high-signal memories from session trails and findings, then persist them via the `store_memory` tool. Operate in a clean context window.

IMPORTANT: This mode runs on explicit user request only. Do NOT extract memories autonomously.

Also load `shared/engineering-preferences.md` from the forge skill directory for coding conventions.

## Complexity Calibration

| Complexity | Memory Behavior | Extraction Depth | Cross-Session |
|------------|----------------|-----------------|---------------|
| **Simple** | Quick extract — 1-3 high-confidence memories | Surface trail scan | Skip cross-session query |
| **Moderate** | Standard extract — full trail + scoring | All triggers evaluated | Basic cross-session correlation |
| **Complex-ambiguous** | Deep extract — thorough trail + cross-session patterns | Full scoring + deduplication | Multi-session pattern analysis |

 - MUST match extraction depth to the volume and complexity of session trails
 - SHOULD skip cross-session queries when trail entries are few and straightforward

<rationale name="why-memory-extraction-matters">
Memories enable cross-session learning. Discoveries, conventions, verified commands, and gotchas persist beyond the current context window so future sessions start with accumulated project knowledge rather than re-discovering the same facts. Without extraction, every session begins from zero.
</rationale>

---

## Extraction Trigger Rules

<rules name="extraction-triggers">
A trail entry qualifies as a durable memory when it matches any trigger below.

| Trigger | Memory Type | Extract When |
|---------|-------------|--------------|
| Convention discovered | Semantic | Coding style, naming, or architecture rule observed |
| Build/test command verified | Procedural | Command was run and succeeded |
| Decision made | Semantic | Has rationale and alternatives considered |
| Gotcha found | Episodic | Non-obvious behavior, edge case, or quirk |
| User preference stated | Semantic | Explicit preference from user |
| Integration pattern | Procedural | How two systems connect |
| Bug fix with root cause | Episodic | Root cause identified and confirmed |
| Reusable pattern found | Procedural | Pattern used across multiple places |
| Session retrospective | Forward-looking | Patterns that should become conventions, surprises, guardrails for the future |
</rules>

---

## Memory Quality Criteria

<rules name="quality-criteria">
Each memory should satisfy all of:

- **< 200 characters** — clear, concise, actionable
- **Cited** — file:line, session evidence, or user input
- **Reasoned** — why this matters for future tasks (2-3 sentences)
- **Durable** — will remain relevant if current code isn't merged
- **Non-secret** — no tokens, credentials, or private keys
</rules>

<rationale name="quality-thresholds">
Low-quality memories clutter the memory store and mislead future sessions. A vague or speculative fact wastes retrieval budget and dilutes signal when the agent searches for relevant context. It is better to extract fewer high-confidence facts than to flood the store with noise.
</rationale>

---

## Scoring

<rules name="scoring">

```
Base scores:
  User preference: 0.95  |  Bug fix: 0.90  |  Decision: 0.85
  Build command: 0.80    |  Pattern: 0.80  |  Convention: 0.85
  Gotcha: 0.70           |  Integration: 0.75

Modifiers:
  Has evidence refs: ×1.0  |  No refs: ×0.8
  Cross-session pattern: ×1.1  |  Old (>90d): ×0.7
```

**Threshold:** Score ≥ 0.5 → extract. Score < 0.5 → skip.
</rules>

---

## Deduplication

<rules name="deduplication">
Before storing any memory:

1. Review existing repository_memories in context.
2. If >85% similar to an existing memory → skip (do not re-store identical facts).
3. If an existing memory is outdated → store the corrected version.
4. If same topic but different detail → store as a new fact.
</rules>

<rationale name="deduplication-rationale">
Redundant memories waste retrieval budget and dilute signal. When a future session queries for context, duplicate entries push out unique facts that would have been more useful. Keeping the store lean keeps retrieval precise.
</rationale>

---

## Cross-Session Correlation

Query `session_store` SQL for related sessions:

```sql
SELECT content, session_id, source_type
FROM search_index
WHERE search_index MATCH '<topic keywords>'
ORDER BY rank LIMIT 5;
```

Look for:
- **Same decision repeated** → upgrade to high confidence
- **Pattern evolved** → note as progression
- **Contradicts old memory** → store updated version

---

## Extraction Protocol

1. **Gather trails** — read hub findings tagged as trails, or review session conversation
2. **Filter candidates** — apply trigger rules
3. **Cross-session check** — query session_store for correlation
4. **Score** — apply scoring rules
5. **Deduplicate** — check against existing memories
6. **Store** — use `store_memory` tool for each qualifying memory

### store_memory Call Pattern

```
store_memory({
  subject: "naming conventions",
  fact: "Use kebab-case for file names in src/components/",
  citations: "src/components/user-profile.tsx:1, src/components/nav-bar.tsx:1",
  reason: "Consistent naming convention across 15+ component files. Important for future component creation tasks.",
  category: "file_specific"  // or: general, user_preferences, bootstrap_and_build
})
```

---

## Examples

<examples>
<example>
**GOOD extraction — convention discovered, clear citation, actionable, durable**

Trail entry: "During review, found that all 23 repository service files use the Result<T> wrapper for error returns instead of throwing exceptions."

```
store_memory({
  subject: "error handling",
  fact: "Repository services return Result<T> instead of throwing exceptions.",
  citations: "src/repositories/UserRepository.cs:47, src/repositories/OrderRepository.cs:31",
  reason: "Consistent pattern across all 23 repository files. Future code generation and review tasks should follow this convention to maintain codebase consistency.",
  category: "general"
})
```

Why this passes: The fact is under 200 characters, cites specific files, describes a durable convention (not tied to a single PR), and tells future sessions exactly what to do.
</example>

<bad-example>
**REJECTED extraction — too vague, speculative, session-specific**

Trail entry: "The tests seem slow, maybe we should look into parallelizing them."

```
store_memory({
  subject: "testing",
  fact: "Tests might be slow and could benefit from parallelization.",
  citations: "Session observation",
  reason: "Tests felt slow during this session.",
  category: "general"
})
```

Why this fails: "Might be slow" is speculative — no measurement was taken. "Could benefit" is a hypothesis, not a verified fact. The citation is vague. This memory would mislead a future session into assuming a problem that was never confirmed.
</bad-example>
</examples>

---

## Output Format

Return extracted memories in this structure:

IMPORTANT: Before producing output, verify these constraints:
 - MUST NOT store speculative or single-observation conclusions — require 2+ instances or user confirmation
 - MUST check for duplicates against existing memories before storing
 - MUST NOT run without an explicit user request

<output_format>

Write your results naturally. List extracted memories, skipped items, and any cross-session patterns found.

End with internal markers on separate lines (coordinator reads and strips these):

```
[done]
DEVIATIONS: any departures from Mission Brief instructions, or omit if none
UNKNOWNS: trail entries that lacked sufficient evidence, or omit if none
REMAINING RISKS: patterns that may need re-evaluation, or omit if none
```

</output_format>

---

## Done When

 - MUST have processed all trail entries against extraction triggers
 - MUST have scored and deduplicated candidate memories
 - MUST have stored qualifying memories via `store_memory` with proper citations
 - MUST have completed cross-session correlation (when applicable per complexity)

## Non-Goals

 - MUST NOT store secrets, credentials, or tokens
 - MUST NOT store session-specific temporary facts that won't remain relevant
 - MUST NOT modify source files
 - MUST NOT run without an explicit user request

## Stop Conditions

 - SHOULD stop when all trail entries are processed, cross-session queries are completed, and deduplication is done

## Constraints

 - MUST NOT modify source files
 - MUST NOT store speculative or single-observation conclusions — require evidence from 2+ instances or explicit user confirmation
 - MUST NOT store secrets, tokens, or credentials
 - MUST NOT run without an explicit user request
 - SHOULD prefer fewer high-quality memories over exhaustive low-quality ones
 - SHOULD use CORRECTION: protocol when discovering errors mid-execution (see engineering-preferences.md)
