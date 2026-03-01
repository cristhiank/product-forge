# Consolidation Map — v17 Agents → Forge

Detailed per-agent analysis of what content merges into Forge, what gets eliminated as duplication, and what unique logic is preserved in mode files.

---

## Summary

| Source | v17 Lines | Unique Preserved | Eliminated | Reduction |
|--------|:---------:|:----------------:|:----------:|:---------:|
| SKILL.md (constitution) | 981 | ~500 (streamlined) | ~481 (ceremony, XML formats) | 49% |
| Orchestrator | 343 | ~150 (routing, state machine) | ~193 (load-order, subagent prompt examples) | 56% |
| Scout | 348 | ~120 (exploration logic) | ~228 (duplicated rules, XML envelope) | 66% |
| Creative | 419 | ~100 (ideation logic) | ~319 (duplicated rules, search permissions, XML) | 76% |
| Planner | 472 | ~150 (planning protocol) | ~322 (duplicated rules, input formats, XML) | 68% |
| Verifier | 448 | ~150 (verification checklists) | ~298 (duplicated rules, multi-agent reflexion, XML) | 67% |
| Executor | 323 | ~130 (execution protocol) | ~193 (duplicated rules, input formats, XML) | 60% |
| Memory-Miner | 309 | ~100 (extraction logic) | ~209 (duplicated rules, tool permissions, XML) | 68% |
| Super-Orchestrator | 438 | 438 (stays separate) | 0 | 0% |
| SOUL.md | 43 | ~30 (merged into SKILL) | ~13 | 70% |
| ADDITIONAL.md | 143 | ~80 (merged into SKILL) | ~63 | 56% |
| **Total** | **4,267** | **~1,948** | **~2,319** | **54%** |

After restructuring into Forge format (~1,550 lines), the effective reduction is **~64%**.

---

## Per-Agent Breakdown

### Orchestrator (343 lines → Forge core + SKILL.md routing)

**Preserved (~150 lines → Forge.agent.md + SKILL.md):**
- Tier routing table (Direct/Delegate modes) → becomes task routing in SKILL.md
- Delegate Mode state machine (Phases 0-4c) → becomes Forge phase machine
- Phase skip rules per tier
- Closure checks (4c)
- User-facing output formats
- Parallel mode detection (for worker spawning decisions)

**Eliminated (~193 lines):**
- Load-order contract (8 lines) — no inter-agent loading
- `task` delegation parameter docs (30 lines) — Forge packages prompts directly
- subagent prompt examples for each role (70 lines) — replaced by mode file injection
- `scout_requests` handling (15 lines) — Forge delegates directly
- Context packaging rules (8 lines) — no cross-agent serialization
- Anti-patterns list (30 lines) — merged into SKILL.md once
- Error handling for subagent failures (20 lines) — simplified

### Scout (348 lines → modes/explore.md ~120 lines)

**Preserved:**
- 5 exploration sub-modes table (quick_scan, deep_dive, dependency_trace, external_search, backlog_context)
- Tier classification output format and criteria
- Fact confidence levels (high/medium/low with thresholds)
- Backlog context mode protocol
- Exploration strategy per mode (when to stop, what to cache)

**Eliminated (~228 lines):**
- Load-order contract + constitution inheritance list (20 lines)
- SEARCH-FIRST protocol (15 lines) — already in constitution, duplicated
- Git-aware snippet caching rules (20 lines) — duplicated from constitution
- Snippet formatting guidelines (15 lines) — duplicated
- External search strategy (12 lines) — duplicated from constitution
- Output XML envelope (`<scout_report>`) format (40 lines) — no inter-agent XML
- `scout_requests` response format (15 lines) — no inter-agent requests
- Anti-patterns (20 lines) — merged into SKILL.md
- Tool permissions table (10 lines) — all tools available in subagent context
- Hub posting examples (15 lines) — inherited from SKILL.md

### Creative (419 lines → modes/ideate.md ~100 lines)

**Preserved:**
- **Mandatory contrarian option** (25 lines) — must include at least 1 non-obvious approach
- **Differentiation check** (25 lines) — verify 2+ dimensions differ between approaches
- Approach structure template (15 lines) — name, positioning, tradeoffs format
- Web/docs search permission (5 lines) — can search externally for references
- Recommendation rationale format (10 lines)

**Eliminated (~319 lines):**
- Load-order contract + inherited list (20 lines)
- Multi-model support section (10 lines) — handled by experts-council
- Context budget rules (8 lines) — merged with SKILL.md
- Tools available/not available tables (15 lines) — all tools in subagent
- External search permission decision tree (20 lines) — simplified to 5 lines
- `scout_requests` pattern (15 lines) — Forge handles context
- Output XML envelope (`<creative_report>`) (50 lines) — no inter-agent XML
- Hub posting examples (20 lines) — inherited
- Anti-patterns (15 lines) — merged
- Detailed approach evaluation rubric (40 lines) — simplified
- Context packaging for Creative input (30 lines) — Forge packages

### Planner (472 lines → modes/plan.md ~150 lines)

**Preserved:**
- **Planning protocol (11 steps)** (25 lines) — core decomposition logic
- **DONE WHEN criteria format** (25 lines) — verifiable completion criteria per step
- **Dependency analysis** (20 lines) — step ordering and blocking relationships
- **micro_plan template** (25 lines) — T3 compact plan format
- **full_plan template** (45 lines) — T4-T5 detailed plan format
- Risk analysis framework (compact, 10 lines)
- Assumptions verification checklist (compact, 10 lines)

**Eliminated (~322 lines):**
- Load-order contract (8 lines)
- Permissions & tools (8 lines)
- Input formats (compact + full plan input) (30 lines) — no inter-agent prompts
- Output XML envelope (`<planner_report>`) (45 lines) — no XML
- `scout_requests` pattern (5 lines)
- Trail logging table (10 lines) — merged
- Quality gates (20 lines) — merged
- Anti-patterns (20 lines) — merged
- Effort estimation detailed rubric (12 lines) — simplified
- Detailed plan examples (60 lines) — reference file

### Verifier (448 lines → modes/verify.md ~150 lines)

**Preserved:**
- **Pass limits: 2 maximum** (20 lines) — critical safety mechanism
- **Plan verification checklist** (35 lines) — 12+ checks for plan quality
- **Result verification checklist** (35 lines) — 15+ checks for implementation quality
- **Hallucination detection patterns** (15 lines) — known hallucination triggers
- Differential verification protocol (15 lines) — verify only NEW claims
- Tier-based verification modes (15 lines) — T1 light, T4-T5 thorough
- Backlog state verification (10 lines) — confirm items moved correctly

**Eliminated (~298 lines):**
- Load-order contract (8 lines)
- Multi-model audit mode (30 lines) — moved to experts-council integration
- Context budget (8 lines) — merged
- Tools table (5 lines)
- Input formats (plan input, result input) (15 lines) — no inter-agent format
- Multi-agent reflexion protocol (15 lines) — simplified to self-critique rules
- Output XML envelope (`<verifier_report>`) (40 lines) — no XML
- Anti-patterns (15 lines) — merged
- Detailed verdict format with scoring (30 lines) — simplified

### Executor (323 lines → modes/execute.md ~130 lines)

**Preserved:**
- **Interleaved thinking protocol** (35 lines) — code little → test little → repeat
- **Pre-commit checklist** (25 lines) — file type validation, git status, temp cleanup
- **Verifier critique handling** (15 lines) — how to respond to revision_required
- **Trail logging (mandatory)** (15 lines) — at least 1 trail per task
- Scope discipline rules (10 lines) — stay within plan boundaries
- Execution protocol (10 lines) — step-by-step approach

**Eliminated (~193 lines):**
- Load-order contract (8 lines)
- Context & tools tables (8 lines)
- Input formats (executor input XML) (15 lines) — no inter-agent format
- Backlog bookkeeping section (15 lines) — already in constitution
- Git-aware snippet updates (12 lines) — already in constitution
- Output XML envelope (`<executor_report>`) (25 lines) — no XML
- Error handling for build failures (10 lines) — merged
- Anti-patterns (25 lines) — merged
- Detailed examples (40 lines) — reference file

### Memory-Miner (309 lines → modes/memory.md ~100 lines)

**Preserved:**
- **6 extraction trigger rules** (45 lines) — what qualifies as a durable memory
- Memory types table (8 lines) — episodic, semantic, procedural
- **Extraction protocol (7 steps)** (45 lines) — systematic extraction workflow
- Memory file format specification (30 lines) — how to write memory files
- Deduplication rules (10 lines)

**Eliminated (~209 lines):**
- Load-order contract (5 lines)
- Input format (trail input XML) (10 lines) — no inter-agent format
- Output format XML (25 lines) — simplified
- Tool permissions table (12 lines)
- Anti-patterns (15 lines) — merged
- Scoring rubric for memory quality (20 lines) — simplified
- Cross-session correlation section (15 lines) — simplified

### Super-Orchestrator (438 lines → stays separate, updated refs)

**No consolidation.** This agent:
- Spawns independent OS-level processes (Copilot CLI on git worktrees)
- Manages parallel execution across multiple isolated environments
- Handles merge conflicts between branches
- Operates at a fundamentally different layer (process management vs. task coordination)

**Only change:** Update worker spawn to use `--agent Forge` instead of `--agent Orchestrator`.

---

## What Gets Eliminated Globally

### Inter-Agent Communication Protocol (~400 lines across all agents)

Every v17 agent has:
- XML input format definition (`<scout_input>`, `<executor_input>`, etc.)
- XML output format definition (`<scout_report>`, `<executor_report>`, etc.)
- Context packaging rules (what to include in subagent prompts)
- `scout_requests` pattern (how to ask Scout for information)

In Forge, **none of this exists** because:
- Forge packages mode contract + context directly into `task` prompts
- Subagents return plain text/markdown, not XML envelopes
- No inter-agent request protocol — Forge mediates everything

### Duplicated Constitution References (~200 lines across all agents)

Each agent repeats:
- "Invoke devpartner skill as your first action"
- Load-order contracts describing what's inherited
- Lists of inherited behaviors
- Duplicated anti-patterns and quality rules

In Forge, mode files are self-contained context packages — they include their own rules without referencing external constitutions.

### Permission Matrices (~100 lines across all agents)

Each v17 agent has explicit tool permission tables. In Forge, the `task` tool gives subagents access to all tools by default. Mode contracts specify restrictions (e.g., "In explore mode, do NOT edit files") as behavioral rules rather than permission matrices.
