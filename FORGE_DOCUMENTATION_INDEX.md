# FORGE SYSTEM DOCUMENTATION INDEX

This directory contains complete documentation of the **Forge Agent System** — a sophisticated multi-agent dispatch coordinator that operationalizes Martin Fowler's "Why Loop / How Loop" paradigm.

## Files You Just Read

### 1. **FORGE_SYSTEM_COMPLETE.md** (38 KB, 1102 lines)
**The definitive reference guide.** Covers:
- Executive summary & foundational concepts
- Why Loop / How Loop boundary
- Dispatch routing decision tree
- All 11 modes/phases in complete detail
- Complexity tiers and phase selection
- Post-dispatch evaluation protocol
- Closing markers and external voice
- Tool permissions and constraints

**Use this when**: You need complete, detailed specifications for any phase or pattern.

### 2. **FORGE_MODES_QUICK_REFERENCE.md** (14 KB, 280 lines)
**Quick lookup guide.** Contains:
- All 11 modes at a glance (single-page visual)
- Complexity tier matrix
- Design levels breakdown
- Tool permission tables
- Dispatch routing decision tree
- Model selection table
- Closing markers reference
- Integration flow diagram
- Key constraints summary

**Use this when**: You need fast lookups or want to see the big picture at once.

## Source Files You Should Know About

In `/Users/crilopez/dev/mcp/agents/forge/`:
- **forge.agent.md** — Coordinator bootstrap rules and operating principles
- **SKILL.md** — Complete coordinator routing and dispatch logic (400+ lines)
- **modes/** — All 11 mode specifications:
  - `ideate.md` (206 lines)
  - `design.md` (746 lines — the most comprehensive)
  - `plan.md` (294 lines)
  - `execute.md` (273 lines)
  - `verify.md` (353 lines)
  - `assess.md` (208 lines)
  - `explore.md` (221 lines)
  - `retrospective.md` (155 lines)
  - `memory.md` (285 lines)
  - `gc.md` (139 lines)
  - `product.md` (459 lines)

In `/Users/crilopez/dev/mcp/agents/forge-gpt/`:
- **forge-gpt.agent.md** — Forge-GPT bootstrap (optimized for GPT models)
- **SKILL.md** — Forge-GPT coordinator with lane locking
- **modes/** — GPT-optimized versions of all 11 modes

In `/Users/crilopez/dev/mcp/`:
- **plugin.json** — Forge plugin metadata
- **plugin-shared.json** — Shared skills metadata

## Key Concepts at a Glance

### The Core Operating Principle
```
COORDINATOR (Why Loop)
  ├─ Classifies user intent
  ├─ Builds Mission Briefs
  ├─ Dispatches via task() or workers
  └─ Evaluates output semantically
       ↓
SUBAGENTS (How Loop)
  ├─ Operate in clean context windows
  ├─ Follow the agreed harness
  └─ Produce intermediate artifacts
```

**CRITICAL**: Dispatching IS doing. The coordinator NEVER edits files, runs builds, or implements code.

### The 11 Modes/Phases

1. **EXPLORE** — Gather evidence, classify complexity (SCOUT)
2. **ASSESS** — Challenge premises, CEO quality gate (CREATIVE)
3. **IDEATE** — Generate 2-3 differentiated approaches (CREATIVE)
4. **DESIGN** — Progressive refinement through 4 levels (CREATIVE)
5. **PLAN** — Atomic steps with DONE WHEN criteria (PLANNER)
6. **VERIFY** — Validate plan or implementation (VERIFIER)
7. **EXECUTE** — Implement following plan exactly (EXECUTOR)
8. **RETROSPECTIVE** — Fix harness, not artifact (ANALYST)
9. **MEMORY** — Extract durable knowledge (ARCHIVIST)
10. **GC** — Scan for entropy and debt (SCOUT)
11. **PRODUCT** — Feature specs, discovery, validation (CREATIVE)

### The Design Guard (T3+ Magic)

For moderate and complex tasks (T3+), **ASSESS and DESIGN are mandatory** before PLAN or EXECUTE — regardless of how the user phrases the request.

```
User: "implement it" (T3+ task)
  → Auto-chain: ASSESS → DESIGN → PLAN → VERIFY → EXECUTE
User: "plan it" (T3+ task)
  → Auto-chain: ASSESS → DESIGN → PLAN → VERIFY → EXECUTE
```

This prevents implementations that skip strategic review.

### Complexity Tiers

| Tier | Complexity | When? | Key Phases |
|------|:-:|----------|---------|
| T1 | 0-2 | Typo fixes, quick answers | Skip most phases |
| T2 | 3-4 | Single file, known patterns | Skip ASSESS/design |
| T3 | 5-6 | Multi-file, standard patterns | ASSESS → DESIGN (L2-L4) → PLAN → VERIFY → EXECUTE |
| T4-T5 | 7+ | Cross-module, novel patterns, high risk | Full: EXPLORE → ASSESS (deep) → IDEATE → DESIGN (L1-L4) → PLAN → VERIFY → EXECUTE |

### Design Levels (DESIGN Mode Only)

```
Level 1: CAPABILITIES  (scope + constraints)
  ↓ [user approves]
Level 2: COMPONENTS    (domain model + architecture)
  ↓ [user approves]
Level 3: INTERACTIONS  (failure modes, state machines, consistency)
  ↓ [user approves]
Level 4: CONTRACTS     (frozen interfaces for TDD)
```

Each level is a checkpoint — present, wait for feedback, incorporate, advance.

### The Three Lanes

Every coordinator turn operates in ONE lane:
- **T1_ANSWER**: Answer inline, no delegation
- **DISPATCH**: Classify → build Brief → task() or workers
- **BLOCKED**: Ask clarifying questions

## How to Use This Documentation

### For Visualization/Architecture Understanding
Start with **FORGE_MODES_QUICK_REFERENCE.md** — see the entire system at a glance.

### For Building New Modes
Read **FORGE_SYSTEM_COMPLETE.md** § Design Mode (sections on Design Levels, Tools, Output Format, Constraints).

### For Understanding Dispatch Routing
Read **FORGE_SYSTEM_COMPLETE.md** § Coordinator Routing and Dispatch Routing Decision.

### For Post-Dispatch Evaluation
Read **FORGE_SYSTEM_COMPLETE.md** § Post-Dispatch Evaluation.

### For Mission Brief Construction
Read **FORGE_SYSTEM_COMPLETE.md** § Mission Brief Structure and look at SKILL.md in forge/forge-gpt.

### For Understanding Verification
Read **FORGE_SYSTEM_COMPLETE.md** § VERIFY Mode, then read agents/forge/modes/verify.md for complete checklist details.

### For Understanding Execution
Read **FORGE_SYSTEM_COMPLETE.md** § EXECUTE Mode, paying attention to Contract-Driven TDD section.

## Critical Rules (No Exceptions)

1. ❌ **NEVER edit files directly** — all file mutations through subagents
2. ❌ **NEVER run build/test yourself** — dispatch instead
3. ✅ **Always route substantive work** through appropriate mode
4. ✅ **Always use task() with mode: "sync"** — evaluate inline
5. ✅ **Always dispatch routing** before acting (task vs workers)
6. ✅ **Always verify T3+ plans** before executing
7. ✅ **Always include ASSESS/DESIGN** for T3+ tasks

## Shared Infrastructure

These skills/tools work across all modes:
- **forge-harness** — Metrics, GC scans, run ledger
- **backlog** — Task tracking and bookkeeping
- **product-hub** — Product artifact management (.product/ repository)
- **jobs-to-be-done** — JTBD framework for product discovery
- **made-to-stick** — SUCCESs framework for spec clarity
- **experts-council** — Multi-model review
- **shared/engineering-preferences.md** — Coding conventions, anti-patterns, visual vocabulary

## External Voice (User Communication)

The coordinator communicates like a **senior engineer peer**:
- Lead with outcome or recommendation
- Use tables for 3+ items, use `→` for flows
- Translate internal work into natural language
- **Hide**: lane names, role names, Mission Brief XML, constraint IDs, protocol markers
- **Show**: recommendations, risks, next steps

## Model Selection (Forge-GPT)

| Phase | Model |
|-------|-------|
| EXPLORE, MEMORY, GC | claude-sonnet-4.6 |
| ASSESS, IDEATE, DESIGN, PLAN, EXECUTE, VERIFY, PRODUCT, RETROSPECTIVE | gpt-5.4 |

**Floor**: claude-sonnet-4.6 minimum. Never use Haiku or "fast" models.

## Visual Vocabulary (10 Types)

Used throughout designs and diagrams:
- ① Component Box — Module boundaries
- ② Layer Stack — Architectural layers
- ③ Dependency Tree — File structure
- ④ Sequence Flow — Data flow
- ⑤ State Machine — Entity lifecycle
- ⑥ Parallel Tracks — Concurrent phases
- ⑦ Tradeoff Matrix — Option comparison
- ⑧ Impact Grid — Value vs effort
- ⑨ Before/After — State delta
- ⑩ Dashboard — Build/test status

## Next Steps: Building a Visualization

If you're creating a system visualization (flow diagram, mind map, interactive tool), focus on:

1. **The routing decision tree** (INT: What determines which mode runs?)
2. **The 11 modes** (VIS: One section per mode with inputs/outputs)
3. **The design levels** (HIE: 4 sequential checkpoints)
4. **The guard rails** (RULE: Design guard for T3+, verify gates, etc.)
5. **The complexity matrix** (MATRIX: What phase for each tier?)
6. **Tool permissions** (TABLE: Who can call what?)
7. **Closing markers** (REF: What the coordinator strips before user sees)

The reference documents are intentionally detailed so you can extract any specific information needed.

---

**Generated**: March 14, 2026  
**System**: Forge Agent Coordinator v1.0  
**Scope**: Forge (Opus-optimized) + Forge-GPT (GPT-optimized)  
**Principle**: Humans control intent, agents handle implementation.
