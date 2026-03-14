# Forge Agent Architecture — Design Document

> Next-generation single-agent coordinator that replaces DevPartner v17's 8 specialized agents with 1 coordinator agent + mode-specific context packages for subagent delegation.

**Status:** Built + Eval Phase  
**Previous:** DevPartner v17 (8 agents + constitution)  
**Author:** Cris Lopez + AI Council (Gemini 3 Pro, Opus 4.6, GPT-5.4)  
**Date:** 2026-02-28 (design), 2026-03-01 (evals + enforcement)

## Related Docs

| Doc | What |
|-----|------|
| [EXECUTION_ARCHITECTURE.md](EXECUTION_ARCHITECTURE.md) | Single-level task() constraint, flow charts, L0/L1/Worker capabilities |
| [ENFORCEMENT_ANALYSIS.md](ENFORCEMENT_ANALYSIS.md) | Process discipline mechanisms tried, what works/doesn't, v17 comparison |
| [EVAL_RESULTS.md](EVAL_RESULTS.md) | Progressive eval tracking, baseline → Round 1 → Round 2 metrics |
| [CONSOLIDATION_MAP.md](CONSOLIDATION_MAP.md) | DevPartner v17 → Forge mapping (which agents became which skills) |
| [MODE_CONTRACTS.md](MODE_CONTRACTS.md) | Input/output contracts for each forge-{mode} skill |
| [ROUTING_RULES.md](ROUTING_RULES.md) | Intent classification tree and routing logic |
| [FORGE_GPT_ANALYSIS.md](FORGE_GPT_ANALYSIS.md) | Why Forge is Claude-optimized: root-cause analysis of GPT compatibility gaps |
| [FORGE_GPT_DESIGN.md](FORGE_GPT_DESIGN.md) | Full Forge-GPT fork design: XML constraints, named roles, migration path, eval plan |

---

## Core Principle

> **The main context window is for task understanding and coordination — NOT for fine-grained execution.**

Detailed work (code exploration, ideation, planning, editing, verification) happens in **separate context windows** via the `task` tool. This preserves the coordinator's context from pollution by code-level details, tool outputs, and accumulated noise across 50+ turn mega-sessions.

This is NOT "mode switching within one prompt." The Forge NEVER reads code deeply, edits files, or runs builds. It **delegates all detailed work** to subagent calls that get clean, isolated context windows with only the relevant context for that specific task.

---

## Why Not Mode-Switching?

The experts council initially recommended collapsing agents into "modes" within a single prompt. This was wrong. Here's why:

| Approach | Context Impact | Quality |
|----------|---------------|---------|
| **Mode switching (rejected)** | Main context accumulates code, diffs, build output, test results → context rot after ~15 turns | Degrades as session grows |
| **Subagent delegation (chosen)** | Main context stays clean (only coordination). Each subagent gets a fresh window with exactly the context it needs | Consistent quality regardless of session length |

**Evidence from session `dee8b796`:** 16 turns across 3 epics (B-049, B-051, B-052) totaling 53 work items. The session lasted 20+ hours with multiple checkpoint/resume cycles. If the main thread had been doing execution work, context degradation would have been severe by turn 10.

**Evidence from session `78fe96e9`:** 56 turns spanning 4 epics + ad-hoc refinement + market research + UX prototyping. The orchestrator maintained coherence across all phases because it delegated detailed work to subagents, keeping its context focused on coordination.

---

## Architecture

```
┌───────────────────────────────────────────────────────────┐
│                    USER                                    │
│  "Ask the experts to review X"                            │
│  "Create backlog epic"                                    │
│  "Do your job on epic B-049"                              │
│  "What's next?"                                           │
└─────────────────────┬─────────────────────────────────────┘
                      │
                      ▼
┌───────────────────────────────────────────────────────────┐
│              Forge (Main Context)                      │
│                                                            │
│  ROLE: Coordinator. Understands tasks, classifies,         │
│  routes, monitors, reports. NEVER does detailed work.      │
│                                                            │
│  LOADS: Forge SKILL (routing rules, mode contracts,     │
│         Forge phase machine, delegation templates)      │
│                                                            │
│  TOOLS: task (delegation), ask_user, sql, bash (git only), │
│         backlog CLI, hub CLI                               │
│                                                            │
│  DOES NOT: edit files, read code deeply, run builds,       │
│  write tests, generate architecture docs                   │
│                                                            │
│  STATE: Forge phase, active workers, backlog state,     │
│  session history, accumulated decisions                    │
└──────┬────────┬────────┬────────┬────────┬────────────────┘
       │        │        │        │        │
       ▼        ▼        ▼        ▼        ▼
  ┌────────┐┌────────┐┌────────┐┌────────┐┌────────┐
  │EXPLORE ││IDEATE  ││ PLAN   ││EXECUTE ││VERIFY  │
  │(Scout) ││(Creatv)││(Plannr)││(Exec)  ││(Verif) │
  │        ││        ││        ││        ││        │
  │ Fresh  ││ Fresh  ││ Fresh  ││ Fresh  ││ Fresh  │
  │context ││context ││context ││context ││context │
  │window  ││window  ││window  ││window  ││window  │
  └────────┘└────────┘└────────┘└────────┘└────────┘
  task()     task()     task()     task()     task()

  Each subagent receives:
  - Mode contract (from modes/*.md)
  - Relevant context (findings, decisions, code snippets)
  - Clear objective and output format
  - NO conversation history from the main thread
```

### What Stays Outside Forge

| Component | Why Separate |
|-----------|-------------|
| **Super-Orchestrator** | Spawns parallel Copilot CLI processes on git worktrees. Process-level concern, not prompt-level. |
| **experts-council** | Requires 3 different models (Gemini, Opus, GPT) running independently. Model diversity is the point. |
| **Infrastructure skills** | backlog, agents-hub, copilot-cli-skill — CLIs/tools, not agent behavior. |
| **Domain skills** | backend-architecture, frontend-architecture, etc. — orthogonal knowledge, loaded on demand. |

---

## The Forge

The user's consistent operating pattern, extracted from 50+ sessions:

```
Phase 1: REVIEW ──→ "Ask the experts to deep review [X]"
                    Delegates to: experts-council skill (3 models)
                    Output: Council verdict with findings + proposed actions

Phase 2: PLAN ────→ "Create backlog epic with children"
                    Delegates to: backlog skill (create items)
                    May delegate to: PLAN mode subagent for complex decomposition
                    Output: Backlog epic with dependency-wired stories

Phase 3: EXECUTE ─→ "Do your job on epic B-NNN until completion"
                    Evaluates: item count, size, independence
                    Route A: 3+ independent items → copilot-cli-skill workers
                    Route B: 1-2 items or surgical fixes → EXECUTE mode subagent
                    Route C: Mixed → workers for big, subagent for small
                    Output: Code changes committed, backlog updated

Phase 4: VERIFY ──→ "Ask the experts to review again"
                    Delegates to: experts-council (delta review)
                    Output: Regression check + new findings

Phase 5: ITERATE ─→ Back to Phase 1 with findings, or "What's next?"
                    Delegates to: backlog skill (unblocked items)
                    Output: Next action options
```

### Phase Transitions

| From | Condition | To |
|------|-----------|-----|
| START | Any request | Classify → route to appropriate phase |
| REVIEW | Findings produced | PLAN (if actionable) or report to user |
| PLAN | Epic created | EXECUTE (if user says "proceed") |
| EXECUTE | All items done | VERIFY |
| VERIFY | Clean / minor findings | ITERATE or COMPLETE |
| VERIFY | Significant findings | PLAN (new items) → EXECUTE |
| Any | "What's next?" | Check backlog → present options |
| Any | Ad-hoc request | Classify and route (may skip phases) |

---

## What Changes from v17

### Files: 9 → 3

| v17 (current) | Forge (new) |
|---------------|----------------|
| `SKILL.md` (constitution, 981 lines) | `SKILL.md` (Forge coordinator rules, ~600 lines) |
| `orchestrator.agent.md` (343 lines) | `Forge.agent.md` (~200 lines) |
| `scout.agent.md` (348 lines) | `modes/explore.md` (~120 lines) |
| `creative.agent.md` (419 lines) | `modes/ideate.md` (~100 lines) |
| `planner.agent.md` (472 lines) | `modes/plan.md` (~150 lines) |
| `executor.agent.md` (323 lines) | `modes/execute.md` (~130 lines) |
| `verifier.agent.md` (448 lines) | `modes/verify.md` (~150 lines) |
| `memory_miner.agent.md` (309 lines) | `modes/memory.md` (~100 lines) |
| `super_orchestrator.agent.md` (438 lines) | `super-orchestrator.agent.md` (stays, updated refs) |
| `SOUL.md` (43 lines) | Merged into SKILL.md |
| `ADDITIONAL.md` (143 lines) | Merged into SKILL.md |
| **Total: ~4,267 lines** | **Total: ~1,550 lines (~64% reduction)** |

### What Gets Eliminated (Duplication)

Each v17 agent file contains ~40-60% duplicated content:
- Load-order contracts (8 lines × 8 agents = 64 lines)
- "Invoke devpartner skill first" instructions
- Tool permission tables (redundant with skill)
- Anti-pattern lists (same patterns repeated)
- XML output format envelopes (for inter-agent communication)
- Context packaging rules (how to format prompts for subagents)
- `scout_requests` handling (agents requesting codebase info)

In Forge, none of this exists because:
- One agent = no inter-agent protocol needed
- Mode files are context packages, not standalone agents
- No XML envelopes — the coordinator injects mode content into `task` prompts directly

### What Gets Preserved (Unique Logic)

Each mode file retains ONLY the unique logic from its v17 agent:

| Mode | Unique Logic Preserved |
|------|----------------------|
| **explore** | 5 exploration sub-modes, tier classification rules, fact confidence levels, backlog context mode |
| **ideate** | Mandatory contrarian option, differentiation check (2+ dimensions), approach structure template |
| **plan** | Planning protocol (11 steps), DONE WHEN criteria, dependency analysis, risk framework, micro/full plan templates |
| **execute** | Interleaved thinking protocol (code little → test little → repeat), pre-commit checklist, critique handling, trail mandatory |
| **verify** | Pass limits (2 max), plan verification checklist, result verification checklist, hallucination detection patterns, differential verification |
| **memory** | 6 extraction trigger rules, memory types, extraction protocol (7 steps), memory file format |

---

## Delegation Model

### How Forge Delegates

```
Forge decides to explore the codebase:
│
├── Reads modes/explore.md (the mode contract)
├── Packages: mode contract + objective + relevant context
├── Calls: task(agent_type="general-purpose", prompt=<packaged prompt>)
│
└── Receives: Structured findings from the subagent
    └── Forge stores findings in working memory + hub
```

### Key Difference from v17

| v17 | Forge |
|-----|----------|
| `task(agent_type="Scout", prompt=...)` — Copilot loads a separate agent file | `task(agent_type="general-purpose", prompt=...)` — Forge injects the mode contract into the prompt |
| Scout agent has its own system prompt (348 lines) | Subagent receives mode contract (~120 lines) + task-specific context |
| Agent file loaded by Copilot's agent framework | Mode contract loaded by Forge from `modes/*.md` and included in the `task` prompt |

**The subagent is still a separate context window.** The only change is that the mode definitions live in the Forge skill instead of as separate agent files. This means:
- One place to update behavior (not 8 files)
- Forge controls exactly what context each subagent gets
- No "constitution not loaded" failures (mode contracts are self-contained)

### Model Selection

Forge chooses the model per delegation based on task type. The authoritative model tables live in each agent's SKILL.md (`agents/forge/SKILL.md` and `agents/forge-gpt/SKILL.md`).

**Hard floor:** `claude-sonnet-4.6` is the absolute minimum for any dispatch. No haiku, no sonnet-4.5, no fast/cheap models.

| Mode | Forge (Claude) | Forge-GPT | Rationale |
|------|---------------|-----------|-----------|
| explore | `claude-sonnet-4.6` | `claude-sonnet-4.6` | Investigation needs capable reasoning — Haiku is insufficient |
| assess | `claude-opus-4.6` | `gpt-5.4` | CEO gate demands premium judgment |
| ideate | `claude-opus-4.6` | `gpt-5.4` | Creativity benefits from strongest reasoning |
| design | `claude-opus-4.6` | `gpt-5.4` | Architecture decisions require deep reasoning |
| plan | `claude-opus-4.6` | `gpt-5.4` | Decomposition requires precision and foresight |
| execute | `claude-sonnet-4.6` | `gpt-5.4` | Code generation — constrained but needs quality |
| verify | `claude-opus-4.6` | `gpt-5.4` | Critical review demands premium model |
| memory | `claude-sonnet-4.6` | `claude-sonnet-4.6` | Extraction still needs solid understanding |
| product | `claude-opus-4.6` | `gpt-5.4` | Strategy work needs premium reasoning |

---

## Self-Verification Concern

The experts council flagged that same-context self-verification degrades 6-20% vs cross-context verification. In Forge, this is **naturally mitigated** because:

1. **Verify mode runs in a separate context window** — the subagent that verifies has NO access to the executor's reasoning or shortcuts. It sees only the code diff.
2. **Multi-model audit via experts-council** — for T3+ tasks, 3 different models review independently. This is the strongest verification mechanism and stays external.
3. **Mandatory checklists** — verify mode includes explicit checklist items that must be filled before verdicting.

The concern would only apply if we did verification *inline* in the main Forge context (which we explicitly don't).

---

## Context Management Strategy

### Main Thread (Forge)

The coordinator accumulates only:
- User messages and decisions
- Phase transitions and routing decisions
- High-level summaries from subagents (not raw code/diffs)
- Backlog state and hub status

This keeps the main thread lean even across 50+ turn mega-sessions.

### Subagent Threads

Each subagent receives:
- Mode contract (~100-150 lines)
- Task-specific context (findings from prior phases, relevant code snippets)
- Clear objective and output format

No conversation history. No accumulated noise from prior phases.

### Hub as External Memory

The agents-hub serves as persistent shared state:
- Findings survive across subagent invocations
- Decisions are tracked with timestamps
- Worker progress is observable
- Forge can reconstruct state after session breaks

---

## Migration Path

### Phase 1: Write Forge Skill + Mode Files

1. Create `SKILL.md` — Forge coordinator rules, routing decision tree, delegation templates
2. Create `modes/*.md` — extract unique logic from each v17 agent, remove duplication
3. Create `Forge.agent.md` — coordinator agent definition (loads Forge skill)

### Phase 2: Validate on Real Tasks

1. Run 5 T1-T2 tasks — verify subagent delegation works for simple tasks
2. Run 5 T3 tasks — verify full Forge phase machine
3. Compare quality and speed vs v17

### Phase 3: Update Super-Orchestrator

1. Change worker spawn from `--agent Orchestrator` to `--agent Forge`
2. Workers are just Forge instances on worktrees — they get the same skill

### Phase 4: Deprecate v17 Agents

1. Archive v17 agent files to `agents/devpartner/archive/`
2. Update publish.sh to publish Forge instead of 8 agents
3. Keep v17 for rollback for 2 weeks

---

## Open Questions

1. **Should Forge do ANY direct work?** Current v17 Orchestrator has Direct Mode for T1-T2. The "pure coordinator" model says NO — even T1 tasks get delegated. But this adds latency for trivial questions. **Decision needed.**

2. **How does the Forge pass accumulated context to subagents?** Currently the Orchestrator manually packages context into XML prompts. In Forge, the Forge needs a pattern for "package the last 3 findings and the approved decision into this subagent's prompt." **Design pattern needed.**

3. **Should mode files be loaded dynamically or hardcoded in the skill?** The skill could either include all modes inline, or reference them as separate files loaded on demand. Separate files are cleaner but depend on the `view` tool reading them at runtime. **Implementation choice.**

4. **What happens when the user wants to do ad-hoc work outside the Forge?** (e.g., "fix this CSS" or "look at this URL"). Does Forge delegate even trivial requests, or handle some inline? **Ergonomics question.**

---

## References

- [CONSOLIDATION_MAP.md](./CONSOLIDATION_MAP.md) — Detailed per-agent analysis of what merges, what stays, what's eliminated
- [MODE_CONTRACTS.md](./MODE_CONTRACTS.md) — Formal mode schemas (entry criteria, allowed tools, required output, exit tests)
- [ROUTING_RULES.md](./ROUTING_RULES.md) — Decision tree for task classification and routing
- DevPartner v17 agents: `agents/devpartner/*.agent.md`
- Session evidence: `dee8b796` (16 turns, 3 epics), `78fe96e9` (56 turns, 4 epics)
- Expert council verdict: 2026-02-28 (Gemini 3 Pro, Opus 4.6, GPT-5.4)
