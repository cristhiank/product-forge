# Forge Process Discipline — Enforcement Analysis

## The Problem

The Forge coordinator dispatches subagents correctly (~90% dispatch rate) but ALSO edits files inline (~47% of the time). It does both, not either/or. This document analyzes why and catalogs the enforcement mechanisms tried.

## Root Cause Chain

```
1. Agent has tools: ["*"]
   └─→ edit/create tools are available
       └─→ LLM's training to be "helpful" overrides text instructions
           └─→ Coordinator edits inline alongside dispatching
```

The fundamental tension: **the LLM is trained to complete tasks using available tools, and edit/create are available.** Text-based instructions ("don't edit") fight the model's base training.

## Enforcement Mechanisms Tried

### ✅ What works (from eval evidence)

| Mechanism | Where | Impact | Evidence |
|-----------|-------|--------|----------|
| **Skill loading instruction** | agent.md line 5 + Critical First Action block | 100% skill loading (up from 0%) | All round 2 sessions load forge skill |
| **Pressure Reinterpretation Table** | agent.md | 60% pressure resistance (up from 0%) | "proceed", "just fix it", "keep going" correctly dispatched |
| **Dispatch ❌/✅ examples** | agent.md | Visible improvement in dispatch initiation | 90% dispatch rate |
| **Bash Usage Policy** | agent.md | Reduces mutating bash (but not eliminated) | Round 2 fewer bash violations |
| **Architecture skill injection** | SKILL.md Stack Detection | 100% correct arch skill loading | backend-arch for .cs, frontend-arch for .tsx |

### ❌ What doesn't work (yet)

| Mechanism | Where | Why It Fails | Evidence |
|-----------|-------|-------------|----------|
| **"Dispatching IS doing" identity** | agent.md | Competes with personality traits ("resourceful", "opinionated") | Agent dispatches AND edits — identity is split |
| **Self-interrupt pattern** | agent.md | LLM doesn't "catch itself" mid-generation | Inline edits happen without pause |
| **Post-Dispatch Protocol** | agent.md | Agent follows it sometimes but "finishes up" after | 8/20 turns show post-dispatch continuation |
| **Dispatch Transaction Rules** | agent.md | Agent can emit task()+edit in same parallel call | 3/20 turns show parallel dual-action |
| **"No triviality exemption"** | agent.md | Small codebases still trigger shortcuts | 3/20 turns skip dispatch entirely |

### 🟡 Partially effective

| Mechanism | Where | Impact | Limitation |
|-----------|-------|--------|-----------|
| **Dispatch Transaction Rules** | agent.md | Reduced but not eliminated parallel calls | LLMs can still batch tool calls |
| **Conditional tool framing** | agent.md | Agent knows to dispatch but also uses edit | Framing competes with tool availability |

## Structural Analysis: Why v17 Worked Better

DevPartner v17's Orchestrator had `tools: ["*"]` — same as Forge. But it maintained process discipline through:

### 1. Role Purity
v17 Orchestrator was 343 lines of **100% coordination behavior**. Zero personality traits, zero engineering preferences, zero session management. The LLM's identity was ONLY "coordinator."

Forge agent.md has: dispatch rules (57%) + personality (7 traits) + preferences (8 items) + session start + hard constraints. The personality traits ("resourceful", "opinionated") create competing identity frames.

### 2. Conditional Permission Model
v17 had an explicit permissions matrix:
- T1-T2 (Direct Mode): Orchestrator CAN edit files
- T3+ (Delegate Mode): Orchestrator CANNOT edit files

This gave the LLM a "legal path" for trivial tasks. Forge's absolute "never edit" creates cognitive dissonance — the LLM sees edit tools, sees a trivial task, and fights its own training.

### 3. Named Agent Semantic Barriers
v17 dispatched to named roles: `task({ agent_type: "Executor" })`. The name "Executor" creates a cognitive boundary.

Forge dispatches to `task({ agent_type: "general-purpose" })`. No semantic distinction between "I do it" and "I dispatch someone to do it."

### 4. Rigid State Machine
v17: Phase 0→1→2→3→3b→4→4b→4c→Completion. Each phase had typed transitions.
Forge: Flexible intent tree where any intent routes to any mode. No mandatory phase ordering.

## Recommended Next Steps (from Expert Council)

### Phase 1: Role Purity
1. Move Personality, Session Start, Engineering Preferences from agent.md → SKILL.md
2. Add v17-style anti-pattern table (6 rows, Do Not → Do Instead)
3. Add tool permissions matrix (coordinator tools vs subagent tools)
4. Add named-mode dispatch table for semantic barriers

### Phase 2: Conditional Permissions (if Phase 1 < 50% purity)
1. Allow T1-T2 inline editing (removes "fight" for trivial tasks)
2. Strict dispatch for T3+

## Measurement

All enforcement changes are validated via the eval suite:
- `run-evals.py`: 30 single-turn cases (8 categories)
- `run-loops.py`: 7 workflow loops (24 turns)
- Key metrics: skill loading rate, dispatch rate, pure dispatch rate, outcome pass rate
