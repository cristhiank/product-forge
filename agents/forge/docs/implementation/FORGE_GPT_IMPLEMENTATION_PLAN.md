# Forge GPT implementation plan

> Working execution plan for turning `FORGE_GPT_DESIGN.md` into the implementation-ready specification for a dedicated `forge-gpt` fork.

**Status:** Approved working plan
**Date:** 2026-03-06
**Related:** [../FORGE_GPT_DESIGN.md](../FORGE_GPT_DESIGN.md) | [../FORGE_GPT_ANALYSIS.md](../FORGE_GPT_ANALYSIS.md)

## Goal

Update `agents\forge\docs\FORGE_GPT_DESIGN.md` so it becomes the implementation-ready specification for the strongest practical `forge-gpt` agent that fits the current Copilot CLI runtime.

## Locked decisions

- Primary target is a dedicated `forge-gpt` fork.
- The design doc should be implementation-ready, not just explanatory.
- Architecture choice is **Approach B: contract-driven GPT fork**.
- v1 stays inside the current runtime model: L0 coordinator + L1 subagents via `task()`.
- GPT-family models are the baseline for coordinator and subagent behavior in this fork.
- Prompt-only overlays and a layered front-controller architecture are out of scope for v1.

## Workstreams

### 1. Reframe the architecture choice
- Replace overlay-first language with an explicit fork decision.
- Keep the A/B/C evaluation summary brief in the design doc and point deeper reasoning to `FORGE_GPT_ANALYSIS.md`.
- State clearly why Approach B wins and what parts of A/C are reused as techniques rather than architectures.

### 2. Define machine-checkable contracts
- Lock definitions for `pure dispatch`, T1 eligibility, risk, terminal states, and shared-mode eligibility.
- Add versioned Mission Brief and REPORT schemas.
- Separate coordinator terminal tokens from subagent report status values.
- Add schema validation rules before the coordinator can emit `DISPATCH_COMPLETE`.

### 3. Define runtime governance
- Add lane locking (`T1_ANSWER`, `DISPATCH`, `BLOCKED`) before any tool call.
- Add run ledger semantics (`run_id`, `brief_hash`, retries, status transitions).
- Add idempotency keys for side effects.
- Add timeout rules and trust-boundary rules.
- Define the default parallel-work policy for v1.

### 4. Define the fork artifact set
- `agents\forge-gpt\forge-gpt.agent.md`
- `agents\forge-gpt\SKILL.md`
- `agents\forge-gpt\modes\execute.md`
- `agents\forge-gpt\modes\verify.md`
- `agents\forge-gpt\schemas\mission-brief.v1.md`
- `agents\forge-gpt\schemas\report.v1.md`
- GPT-specific eval entry point or extension to the current eval runner

Use conventional source filenames for plugin compatibility; the skill names still stay
`forge-gpt`, `forge-execute-gpt`, and `forge-verify-gpt`.
A standalone GPT-focused build script now exists at `build-forge-gpt-plugin.ps1`; wiring the main `build-plugin.ps1` flow to publish `forge-gpt` remains optional follow-up work.

### 5. Strengthen GPT-specific prompting guidance
- Top-load constraints and terminal-state rules.
- Use violation/correction examples instead of long prose-only warnings.
- Prefer compact fact packages over giant Mission Briefs.
- Document how to emulate deeper reasoning in the current runtime even when `reasoning_effort` is not exposed.

### 6. Replace outdated or speculative content
- Remove overlay-first rollout phases as the main plan.
- Resolve packaging within the current plugin bundle.
- Replace keyword-only T1 detection with semantic gating.
- Remove speculative questions that no longer affect the chosen direction.

## Output files for this pass

| File | Purpose |
|------|---------|
| `agents\forge\docs\FORGE_GPT_DESIGN.md` | Final implementation-ready GPT fork spec |
| `agents\forge\docs\implementation\FORGE_GPT_IMPLEMENTATION_PLAN.md` | Execution plan and artifact order for follow-up implementation |

## Current built state

### Runtime view

```text
User request
    |
    v
agents\forge-gpt\forge-gpt.agent.md
    |
    v  loads
agents\forge-gpt\SKILL.md
    |
    +--> dispatches to agents\forge-gpt\modes\execute.md
    |        (skill name: forge-execute-gpt)
    |
    +--> dispatches to agents\forge-gpt\modes\verify.md
    |        (skill name: forge-verify-gpt)
    |
    +--> can reuse shared Forge modes
    |        - agents\forge\modes\explore.md
    |        - agents\forge\modes\ideate.md
    |        - agents\forge\modes\plan.md
    |        - agents\forge\modes\memory.md
    |
    \--> validates against shared contracts
             - agents\forge-gpt\schemas\mission-brief.v1.md
             - agents\forge-gpt\schemas\report.v1.md
```

### Build / bundle view

```text
forge-gpt source artifacts
    + shared forge modes
    + bundled infra / architecture skills
                |
                v
      build-forge-gpt-plugin.ps1
                |
                v
          dist-forge-gpt\
            plugin.json                (name: forge-gpt)
            agents\Forge-GPT.agent.md
            skills\forge-gpt\SKILL.md
            skills\forge-execute-gpt\SKILL.md
            skills\forge-verify-gpt\SKILL.md
            skills\forge-{explore,ideate,plan,memory}\SKILL.md
            skills\forge-{gpt,execute-gpt,verify-gpt}\
              references\schemas\{mission-brief.v1.md, report.v1.md}
            skills\{experts-council,backlog,agents-hub,copilot-cli-skill}\...
            skills\{backend-architecture,frontend-architecture}\...
```

### What this means right now

- **Already built:** dedicated GPT coordinator source files, GPT execute/verify modes, Mission Brief + REPORT contracts, and a standalone `forge-gpt` bundle script.
- **Intentionally shared for now:** `explore`, `ideate`, `plan`, and `memory` still come from the base Forge mode set.
- **Still pending:** GPT-specific eval runner work, any decision to fork more shared modes, and optional integration into the main `build-plugin.ps1` publishing flow.

## Done when

- `FORGE_GPT_DESIGN.md` reads as the primary spec for `forge-gpt`, not a tentative experiment note.
- Required artifacts, contracts, rollout phases, and eval gates are explicit.
- The design stays compatible with the current Copilot CLI runtime and plugin packaging model.
- The doc resolves the main weaknesses found in earlier GPT and architecture analysis.

## Notes

- The experts council converged on a contract-driven fork and highlighted four especially high-value additions: schema validation, timeout behavior, stronger GPT-specific prompt patterns, and a clearer coordinator/subagent token split.
- `FORGE_GPT_ANALYSIS.md` already contains the deep option analysis, so the design doc can stay decisive and implementation-oriented.
- Documentation stays shared under `agents\forge\docs\` for v1 to avoid duplicating analysis/design files before the fork artifacts exist.
