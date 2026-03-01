# Forge Eval Results — Progressive Tracking

## Eval System Overview

Two eval runners:
- `run-evals.py`: 30 single-turn test cases (8 categories)
- `run-loops.py`: 7 multi-phase workflow loops (24 total turns)

Grading: mechanical (tool usage from events.jsonl) + LLM (Opus qualitative) + outcome (test pass/fail).

---

## Baseline: Pre-Fix (publish bug active)

**Date:** 2026-03-01
**State:** publish.sh sed command stripping all content before `## Identity`, including skill-loading instruction

### Historical Session Grades
| Session | Description | Score | Grade | Violations |
|---------|------------|:-----:|:-----:|:----------:|
| `e5564f1e` | Pricing epic (11 turns) | 42% | D | 11 |
| `9fe7478b` | Bug fixes (16 turns) | 29% | F | 25 |

### Key Metrics (Baseline)
| Metric | Value |
|--------|:-----:|
| Skill loading rate | 0% |
| Dispatch rate | 0% |
| Pure dispatch rate | 0% |
| Mission Brief quality | 0% |

---

## Round 1: Publish Bug Fixed + Dispatch Identity

**Date:** 2026-03-01
**Changes:** Fixed publish.sh sed command, added dispatch identity, pressure table, dispatch examples, bash policy

### Single-Turn Results (14 runs)
| Category | Pass | Total | Rate |
|----------|:----:|:-----:|:----:|
| dispatch-required | 1 | 4 | 25% |
| pressure-signal | 3 | 5 | 60% |
| fixture | 0 | 4 | 0% |
| multi-turn | 0 | 1 | 0% |

### Key Metrics (Round 1)
| Metric | Baseline | Round 1 | Change |
|--------|:--------:|:-------:|:------:|
| Skill loading rate | 0% | 71% | 🟢 +71pp |
| Dispatch rate (any) | 0% | 86% | 🟢 +86pp |
| Pure dispatch | 0% | 40% | 🟢 +40pp |
| Pressure pass rate | 0% | 60% | 🟢 +60pp |

---

## Round 2: Transaction Rules + Post-Dispatch Protocol

**Date:** 2026-03-01
**Changes:** Dispatch Transaction Rules (task() is atomic), Post-Dispatch Protocol (summarize→bridge→STOP), no-triviality-exemption, new ❌ examples for dual-action patterns

### Full 7-Loop Results (20 turns across 7 loops)

| Loop | Turns Pass | Dispatch | Inline | Skills | Outcome | Time |
|------|:----:|:----:|:----:|:----:|:----:|:----:|
| 1. Implementation (E→P→X→V) | 0/4 | 3 | 3 | forge,explore,execute,verify | 6/10 tests | 209s |
| 2. Expert review+fix | 0/3 | 9 | 13 | forge,council,execute,arch | 11/11 tests ✅ | 955s |
| 3. Product bridge | 0/3 | 3 | 6 | forge,product,JTBD,plan,arch | F-002 ✅ | 754s |
| 4. Epic parallel | 0/1 | 1 | 0 | forge,execute,arch | 10/10 tests ✅ | 110s |
| 5. Bug triage | 0/2 | 2 | 2 | forge,execute | 6/10 tests | 111s |
| 6. UX review | 1/3 | 5 | 5 | forge,council,execute,frontend | HTML ✅ | 633s |
| 7. Greenfield | 0/4 | 3 | 0 | forge,execute,plan,arch | notif.js ✅ | 539s |
| **TOTAL** | **1/20** | **26** | **29** | | **5/7 outcomes** | **53min** |

### Key Metrics (Round 2)
| Metric | Baseline | Round 1 | Round 2 | Change |
|--------|:--------:|:-------:|:-------:|:------:|
| Skill loading | 0% | 71% | **100%** | 🟢 +100pp |
| Any dispatch | 0% | 86% | **90%** | 🟢 +90pp |
| Pure dispatch | 0% | 40% | **47%** (Loops 4,7) | 🟡 +47pp |
| Outcome pass | — | — | **71%** (5/7 loops) | 🟢 new metric |
| Pressure pass | 0% | 60% | — | held |

### Failure Pattern Analysis

**Pattern 1: "Dispatch then continue" (most common)**
Agent dispatches task() correctly, subagent returns REPORT, then coordinator keeps going with inline edits. 8/20 turns exhibit this.

**Pattern 2: "Dispatch AND edit in parallel" (3/20 turns)**
Agent calls task() and edit in the same response.

**Pattern 3: "Skip dispatch for small project" (3/20 turns)**
Fixture sandboxes with small codebases — agent skips dispatch.

### Positive Signals

- **Architecture skill injection working**: backend-arch loaded for backend tasks, frontend-arch for frontend
- **Product skill chain working**: forge-product + jobs-to-be-done loaded correctly
- **Expert council functioning**: 4 task() calls (3 members + chairman) per council turn
- **Loop 4 and 7 achieved pure dispatch**: proves the architecture CAN work
- **Outcomes are strong**: 5/7 loops produced correct code/artifacts

---

## DevPartner v17 Comparison

| Metric | v17 (8 agents) | Forge (1 agent) | Notes |
|--------|:--------------:|:---------------:|-------|
| Total lines | 5248 | 2008 | 62% reduction |
| Manual switching | Required | None | Major UX win |
| Token waste | High (981-line SKILL per agent) | Low (on-demand) | Efficiency win |
| Process discipline | High (architectural) | 5-47% (prompt-based) | v17 wins |
| Outcome quality | Unknown (no evals) | 71% (5/7 loops) | Forge has data |
| Skill loading | Unknown | 100% | Forge verified |

### Why v17 Had Better Discipline (Expert Council Analysis)

1. **Role purity**: v17 Orchestrator was 343 lines of PURE delegation. Forge agent.md has personality traits that conflict with dispatch ("resourceful" implies doing work yourself)
2. **Conditional permissions**: v17 allowed T1-T2 inline (Direct Mode), strict dispatch for T3+. Forge's absolute "never edit" creates cognitive dissonance
3. **Named agent barriers**: v17 dispatched to "Executor" (named role). Forge dispatches to "general-purpose" (no semantic barrier)
4. **Rigid state machine**: v17 had mandatory phases (0→1→2→3→4). Forge has flexible routing

---

## Next Steps (Planned)

### Phase 1: Role Purity (from expert council recommendation)
- Strip agent.md to pure dispatch identity
- Move Personality, Session Start, Engineering Preferences to SKILL.md
- Add v17-style anti-pattern table
- Add tool permissions matrix
- Add named-mode dispatch table

### Phase 2: Conditional Permissions (if Phase 1 < 50% purity)
- Allow T1-T2 inline editing explicitly
- Strict dispatch for T3+
