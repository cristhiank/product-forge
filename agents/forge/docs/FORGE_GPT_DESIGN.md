# Forge-GPT — Fork Design

> Full design for a GPT-5.4-optimized fork of the Forge coordinator: what to change, why, and how to validate the changes.

**Status:** Design — awaiting baseline eval gate
**Author:** Forge subagent (forge-execute) + research synthesis
**Date:** 2026-06-20
**Related:** [FORGE_GPT_ANALYSIS.md](FORGE_GPT_ANALYSIS.md) | [ENFORCEMENT_ANALYSIS.md](ENFORCEMENT_ANALYSIS.md) | [DESIGN.md](DESIGN.md)

## Related Docs

| Doc | What |
|-----|------|
| [FORGE_GPT_ANALYSIS.md](FORGE_GPT_ANALYSIS.md) | Root-cause analysis of Claude vs. GPT compatibility differences |
| [DESIGN.md](DESIGN.md) | Original Forge architecture, delegation model, phase machine |
| [ENFORCEMENT_ANALYSIS.md](ENFORCEMENT_ANALYSIS.md) | Enforcement mechanisms tried; what works on Claude |
| [EVAL_RESULTS.md](EVAL_RESULTS.md) | Existing eval baselines (Claude) for comparison |
| [MODE_CONTRACTS.md](MODE_CONTRACTS.md) | Existing mode contracts (Claude-optimized) |

---

## Design Principles

Forge-GPT is not a rewrite. It is a targeted adaptation of Forge's coordination engine to match GPT-5.4's instruction-following profile:

1. **XML-first structure** — constraints in delimited blocks at the top, not in prose
2. **Stripped dispatcher identity** — no personality traits in the coordinator; pure role
3. **Named role semantics** — subagent roles have names that create behavioral distance
4. **Explicit gate protocol** — dispatch is a typed state transition, not a text instruction
5. **Conditional permission model** — T1 inline is legal; all else dispatched
6. **Modular skill size** — shorter SKILL.md (~200 lines), longer context in Mission Brief
7. **Typed output contracts** — `DISPATCH_COMPLETE`, `T1_ANSWER`, `BLOCKED` as output tokens

---

## Fork Architecture

```
agents/
  forge/                       ← existing (Claude-optimized)
    forge.agent.md
    SKILL.md
    modes/
    docs/

  forge-gpt/                   ← new fork (GPT-optimized)
    forge-gpt.agent.md         ← minimal agent definition
    SKILL-GPT.md               ← stripped coordinator (~200 lines)
    modes/                     ← mode files shared or adapted
      execute-gpt.md           ← GPT-adapted execute (XML gates)
      explore-gpt.md           ← optional, may share
      (other modes shared)
    docs/
      → links back to forge/docs/ (shared analysis docs)
```

**Shared components (no fork needed):**
- `modes/explore.md` — read-only, structural differences don't matter
- `modes/ideate.md` — creative; GPT may perform better here unmodified
- `modes/plan.md` — structured output; low-risk
- `modes/memory.md` — pattern extraction; low-risk

**Fork required:**
- `forge.agent.md` → `forge-gpt.agent.md` (identity, constraints)
- `SKILL.md` → `SKILL-GPT.md` (structure, length, XML framing)
- `modes/execute.md` → `modes/execute-gpt.md` (XML gates, stop tokens)

---

## Change 1: XML-Structured Coordinator Constraints

### Current (Forge / Claude-optimized)

```markdown
## Hard Constraints

| Rule | Description |
|------|-------------|
| No secrets | Never store tokens, credentials, private keys anywhere |
| No inline code | File mutations go through `task` subagents |
| No triviality exemption | "Small repo" or "quick fix" never authorizes inline |
| Dispatch atomicity | `task()` = no other mutating tools in that response |
...
```

### Forge-GPT Design

```xml
<system_constraints>
  <constraint id="NO_EDIT">
    You MUST NOT call edit, create, or any file-writing tool.
    This applies at ALL times. No exceptions for size, complexity, or pressure.
    Violation terminates this turn — call task() instead.
  </constraint>

  <constraint id="DISPATCH_ATOMIC">
    When you call task(), that is the ONLY mutating action in that response.
    Never combine task() + edit in the same response.
  </constraint>

  <constraint id="NO_BUILD">
    You MUST NOT call bash with build or test commands.
    Route all build/test to a subagent via task().
  </constraint>

  <constraint id="STOP_AFTER_DISPATCH">
    After task() returns a REPORT: summarize → bridge → emit DISPATCH_COMPLETE.
    Do not continue working after DISPATCH_COMPLETE is emitted.
  </constraint>
</system_constraints>
```

**Rationale:** XML-delimited constraint blocks appear at top-of-prompt with high positional salience. Each constraint has an `id` attribute creating a named rule that the model can reference and cite ("constraint NO_EDIT applies here"). This reduces ambiguity compared to prose tables.

---

## Change 2: Stripped Dispatcher Identity

### Current (Forge / Claude-optimized)

`SKILL.md` Personality section has 7 traits with behavioral descriptions. Engineering Preferences has 8 items. Both create competing action signals for GPT.

### Forge-GPT Design

`SKILL-GPT.md` coordinator identity:

```xml
<identity>
  <role>DISPATCH_COORDINATOR</role>
  <behavior>
    You classify user intent, construct Mission Briefs, and call task().
    You do not implement. You do not edit files. You do not run builds.
    Your only output that matters is: a well-constructed task() call.
  </behavior>
  <not_your_job>
    - Writing code
    - Editing files
    - Running builds or tests
    - Answering codebase questions inline
    - "Being resourceful" by using edit tools
  </not_your_job>
</identity>
```

**What is removed vs. Forge SKILL.md:**
- Personality traits (7 items) → removed entirely from coordinator
- Engineering preferences (8 items) → moved to Mission Brief template (injected into subagent prompts only)
- Session start behavior → kept (needed for session continuity)

**What engineering preferences become:**
Engineering preferences are injected into every `execute` Mission Brief as `<subagent_preferences>` — they apply where code is written, not where dispatching happens. The coordinator remains identity-pure.

---

## Change 3: Named Role Semantics for Dispatch

### Current (Forge / Claude-optimized)

```javascript
task({
  agent_type: "general-purpose",
  model: "claude-sonnet-4.6",
  description: "Execute: fix bug",
  prompt: "Invoke the `forge-execute` skill..."
})
```

### Forge-GPT Design

```javascript
task({
  agent_type: "general-purpose",
  model: "gpt-5.4",
  description: "EXECUTOR: fix bug in auth module",   // ← named role in description
  prompt: "<role>EXECUTOR</role>\n..."               // ← role tag at top of prompt
})
```

The `description` field begins with the role name in ALL_CAPS. The prompt opens with a `<role>` XML tag. This creates two separate named-role signals before any instructions appear.

**Role name vocabulary for Forge-GPT:**

| Mode | Role Token | Description prefix |
|------|-----------|-------------------|
| explore | `SCOUT` | `SCOUT: investigate [X]` |
| ideate | `CREATIVE` | `CREATIVE: generate options for [X]` |
| plan | `PLANNER` | `PLANNER: decompose [X]` |
| execute | `EXECUTOR` | `EXECUTOR: implement [X]` |
| verify | `VERIFIER` | `VERIFIER: validate [X]` |
| memory | `ARCHIVIST` | `ARCHIVIST: extract memories from [X]` |

This mirrors DevPartner v17's named agent dispatch (`task({ agent_type: "Executor" })`), which ENFORCEMENT_ANALYSIS documents as more effective for dispatch discipline.

---

## Change 4: Explicit Stop/Dispatch Gates

### Current (Forge / Claude-optimized)

The post-dispatch protocol is stated in prose:
> "After dispatch returns → summarize REPORT → bridge to next action → **STOP**."

### Forge-GPT Design

```xml
<dispatch_protocol>
  <step id="1">Classify intent → route to appropriate mode.</step>
  <step id="2">Construct Mission Brief (see template below).</step>
  <step id="3">Call task(). This is the ONLY action in this response.</step>
  <step id="4">When task() returns:
    - Read REPORT.STATUS
    - Emit exactly: "## Summary\n[2-3 sentence summary]\n\n**DISPATCH_COMPLETE**"
    - Do not call any other tool after emitting DISPATCH_COMPLETE.
  </step>
</dispatch_protocol>
```

The output token `DISPATCH_COMPLETE` serves as a typed terminal state. Evals can mechanically check for its presence. The model is less likely to continue after emitting a state-terminal token than after reading a prose "STOP" instruction.

**T1 terminal token:** `T1_ANSWER` (for inline factual responses)
**Blocked terminal token:** `BLOCKED` (for escalation)

This gives the eval harness three distinct output states to grade mechanically, and gives the model three clear paths that are mutually exclusive and collectively exhaustive.

---

## Change 5: Conditional Permission Model

### Current (Forge / Claude-optimized)

Absolute prohibition: "never edit files, no triviality exemption."

### Forge-GPT Design

```xml
<permission_model>
  <tier id="T1">
    Condition: 0 files to modify, answerable in &lt;30s, no security risk.
    Action: Answer inline. Emit T1_ANSWER.
  </tier>
  <tier id="T2_PLUS">
    Condition: Any file modification, build/test, codebase investigation.
    Action: Dispatch via task(). Emit DISPATCH_COMPLETE.
    No exceptions. "Small" does not override this.
  </tier>
</permission_model>
```

**Why conditional is better for GPT:** An absolute prohibition creates a binary failure state under pressure — the model either follows it or violates it. A conditional model with a sanctioned T1 path reduces the pressure. For genuinely trivial answers, T1 is legal; for everything else, dispatch is mandatory. GPT's helpfulness drive routes to T1 for trivial items and doesn't fight the T2+ constraint because there's no "unsatisfied" state.

**Guard against T1 abuse:**

```xml
<t1_guard>
  If the user says "fix", "change", "update", "implement", "edit", or "write" →
  this is NOT T1, regardless of apparent simplicity.
  Dispatch via task().
</t1_guard>
```

---

## Change 6: Shorter SKILL-GPT.md (~200 Lines)

### Current (Forge / Claude-optimized)

`SKILL.md` is ~600 lines. Constraint-bearing content appears throughout, including at lines 150-250 (dispatch examples), 241-280 (dispatch discipline), and 300+ (Mission Brief template).

### Forge-GPT Design

`SKILL-GPT.md` target structure:

```
Lines 1-10:   Frontmatter (name, description)
Lines 11-40:  <identity> block (role, behavior, not_your_job)
Lines 41-70:  <system_constraints> block (NO_EDIT, DISPATCH_ATOMIC, NO_BUILD, STOP)
Lines 71-90:  <permission_model> block (T1 vs T2+, T1 guard)
Lines 91-110: <dispatch_protocol> block (4 steps, output tokens)
Lines 111-140: Intent classification (compact tree, same categories)
Lines 141-170: Mission Brief template (XML-structured)
Lines 171-190: Session start (unchanged from Forge)
Lines 191-200: Hard constraints (brief list, no prose)
```

Total: ~200 lines. Key constraints appear in the top 90 lines — within the first ~2000 tokens of the context window, maintaining high positional salience throughout a session.

**Content moved OUT of SKILL-GPT.md:**
- Extended dispatch examples (❌/✅ blocks) → move to eval fixtures, not runtime skill
- Repeated anti-pattern tables → collapsed to `<not_your_job>` in identity block
- Engineering preferences → Mission Brief template only (injected into subagent prompts)
- Pressure signal reinterpretation table → collapsed into `<dispatch_protocol>` step 1

---

## Change 7: Typed Output Contracts for Subagents

### Current (Forge / Claude-optimized)

Mode contracts define output in prose + table format. The REPORT structure is Markdown-based and variable.

### Forge-GPT Design

Every subagent prompt (Mission Brief) ends with an explicit output contract:

```xml
<output_contract>
  Your response MUST begin with exactly one of:
    DISPATCH_COMPLETE | T1_ANSWER | BLOCKED

  Then provide:
  <report>
    <status>complete | blocked | needs_input</status>
    <summary>[2-3 sentences]</summary>
    <artifacts>[files created/modified, one per line]</artifacts>
    <next>[recommended next action]</next>
  </report>

  Do not include text before the opening token.
  Do not include tool calls after emitting the opening token.
</output_contract>
```

**Why XML output contracts work better on GPT:** GPT-5.x has strong instruction-following for structured output contracts when stated in a delimited block before the task. Markdown REPORT format has more variance in compliance because it looks like a template rather than a contract.

---

## Mission Brief Template (Forge-GPT)

The Mission Brief is the primary communication channel from coordinator to subagent. Forge-GPT's template is XML-structured:

```xml
<mission_brief>
  <role>EXECUTOR</role>

  <objective>
    [1-2 sentences: what must be accomplished]
  </objective>

  <skill_load>
    Invoke the `forge-execute` skill as your FIRST action.
    [+ any architecture skill if applicable]
  </skill_load>

  <context>
    <findings>[key findings from explore phase, or "none"]</findings>
    <decisions>[approved decisions]</decisions>
    <files_of_interest>[specific files + line ranges]</files_of_interest>
  </context>

  <constraints>
    <scope>[directories/files in scope]</scope>
    <out_of_scope>[explicit exclusions]</out_of_scope>
    <risk_flags>[anything that requires stop+ask]</risk_flags>
  </constraints>

  <subagent_preferences>
    - DRY — flag repetition aggressively
    - Well-tested — too many tests > too few
    - Minimal diff: fewest new abstractions and files touched
    - Handle edge cases explicitly
    - ASCII diagrams for complex flows
  </subagent_preferences>

  <output_contract>
    Begin response with: DISPATCH_COMPLETE
    Then provide REPORT with status, summary, artifacts, next.
  </output_contract>
</mission_brief>
```

---

## Migration Path

### Phase A: Low-Risk Changes (No Fork Required)

Apply these to the existing `forge.agent.md` and `SKILL.md` with a GPT-specific override block. Estimated effort: 2-4 hours.

| Change | How | Risk |
|--------|-----|------|
| XML constraint wrapper at top of SKILL.md | Add `<system_constraints>` block before existing content | Low — additive |
| Named role in `task()` description field | Update Mission Brief template | Low — cosmetic |
| Output token in post-dispatch protocol | Add `DISPATCH_COMPLETE` to existing STOP prose | Low — additive |
| T1 guard block | Add XML guard before intent classification tree | Low — additive |

**Gate:** Run GPT eval after Phase A. If pure dispatch ≥ 70% on GPT → ship as config, skip deep fork.

### Phase B: Medium Changes (Skill Variant, No New Agent)

Create `SKILL-GPT.md` as a parallel skill loaded by the same `forge.agent.md` when model is GPT.

| Change | How | Risk |
|--------|-----|------|
| Create SKILL-GPT.md (~200 lines) | New file, stripped identity | Medium — new code path |
| Conditional loading in forge.agent.md | If model=gpt → skill("forge-gpt") | Low — one-line check |
| Execute mode XML gates | Create `modes/execute-gpt.md` | Low — new file |

**Gate:** Run full 7-loop eval on GPT with Phase B. Compare to Phase A baseline. If improvement ≥ 15pp pure dispatch → proceed to Phase C.

### Phase C: Deep Fork (forge-gpt/ as independent agent)

Full fork: separate agent directory, own publish pipeline, own eval suite.

| Change | How | Risk |
|--------|-----|------|
| Create `agents/forge-gpt/` directory | Copy + adapt from forge/ | Medium |
| `forge-gpt.agent.md` with GPT-only identity | New agent definition | Medium |
| `SKILL-GPT.md` as standalone skill | Publish as separate plugin | Medium |
| Adapted mode files for GPT | Fork execute, optionally explore | Low |
| Separate `publish-gpt.ps1` | New publish pipeline | Low |
| Eval suite: `evals/run-evals-gpt.py` | Fork eval runner with gpt-5.4 | Low |

---

## Experiment Plan

### Experiment 1: Baseline GPT Eval (Pre-Change)

**Goal:** Establish GPT-5.4 baseline on existing Forge eval suite.

**Method:**
1. In `evals/run-evals.py`, add `--model gpt-5.4` flag
2. Run all 30 single-turn cases with `model: "gpt-5.4"`
3. Run 7 workflow loops with `model: "gpt-5.4"`
4. Record: skill loading rate, dispatch rate, pure dispatch rate, outcome pass rate

**Hypothesis:** Pure dispatch rate on GPT < 30% (compared to 47% on Claude Round 2).

**Success:** Baseline numbers recorded. Comparison table established.

### Experiment 2: XML Constraint Block (Phase A)

**Goal:** Measure impact of XML-structured constraints vs. Markdown prose.

**Method:**
1. Add `<system_constraints>` XML block at top of SKILL.md
2. Run same 30 single-turn cases + 7 loops on GPT-5.4
3. Compare: pure dispatch rate, post-dispatch continuation rate, identity bleed (inline edits)

**Hypothesis:** Pure dispatch +10-15pp on GPT; minimal change on Claude.

**Null result:** If pure dispatch changes < 5pp → XML structure alone is insufficient.

### Experiment 3: Named Role Semantics (Phase A)

**Goal:** Measure impact of role-named `task()` descriptions vs. generic `general-purpose`.

**Method:**
1. Update Mission Brief template to prepend role token to `description`
2. Run dispatch-required category (4 cases) and pressure-signal category (5 cases)
3. Measure: pure dispatch rate change, identity bleed change

**Hypothesis:** Named roles reduce "I can do this myself" reasoning.

### Experiment 4: SKILL-GPT.md (Phase B)

**Goal:** Measure impact of ~200-line stripped skill vs. ~600-line full skill.

**Method:**
1. Create SKILL-GPT.md with top-loaded XML constraints
2. Run full eval suite on GPT-5.4 with SKILL-GPT
3. Compare to Experiment 1 (GPT baseline) and Experiment 2 (XML additions)

**Success metric:** ≥ 70% pure dispatch on GPT across 20-loop suite.

### Measurement Table

| Experiment | Changes | GPT Pure Dispatch | Claude Pure Dispatch | Outcome Pass |
|------------|---------|:-----------------:|:--------------------:|:------------:|
| Baseline (Claude Round 2) | — | [pending] | 47% | 5/7 |
| E1: GPT Baseline | None (run on GPT) | [pending] | — | [pending] |
| E2: XML Constraints | +XML block | [pending] | — | — |
| E3: Named Roles | +Role tokens | [pending] | — | — |
| E4: SKILL-GPT (~200L) | New skill file | [pending] | — | [pending] |

---

## Tradeoffs and Risks

| Concern | Mitigation |
|---------|-----------|
| XML prompt style may not match existing Claude expectations | Keep Claude using SKILL.md; GPT uses SKILL-GPT.md — no shared regression |
| Fork maintenance burden (two skill files) | Phase A/B changes apply to both; deep fork only if Phase B proves necessary |
| Named roles may confuse multi-model eval | Use role tokens only in `description` field, not `agent_type` |
| Shorter SKILL-GPT.md may drop important behavior | Traceability table in SKILL-GPT.md maps each removed section to its replacement |
| Conditional permission T1 → T2 abuse | T1 guard (`<t1_guard>`) with explicit verb list ("fix", "change", etc.) |
| XML blocks increase token count slightly | Net negative — 600→200 line reduction more than compensates |

---

## Decision Gate Summary

```
Run E1 (GPT Baseline)
         │
         ▼
  GPT pure dispatch?
         │
  < 30%  │  ≥ 30% (surprising)
         │    └── Analyze why — may not need fork
         ▼
Apply Phase A (XML + named roles)
Run E2, E3
         │
         ▼
  GPT pure dispatch ≥ 70%?
    YES ─→ Ship Phase A as config overlay. No fork.
    NO  ─→ Proceed to Phase B (SKILL-GPT.md)
         │
         ▼
Run E4
         │
         ▼
  GPT pure dispatch ≥ 70%?
    YES ─→ Ship Phase B as parallel skill. No deep fork.
    NO  ─→ Evaluate deep fork (Phase C) vs. accepting GPT limitations
```

---

## Open Questions

1. **Does GPT-5.4 also have a Constitutional AI variant?** OpenAI has announced alignment improvements in GPT-5.x. If GPT-5.4 has stronger rule-following than GPT-4.x, Phase A changes alone may be sufficient.

2. **Should explore and ideate modes also be forked?** Current hypothesis: no. The dispatch-discipline failure is primarily in the coordinator and execute mode. Explore (read-only) and ideate (generative) are unlikely to benefit from XML gating.

3. **What is the right model for Forge-GPT subagents?** The coordinator model is GPT-5.4, but subagents could still use Claude models for execution, or use gpt-5.3-codex for code tasks. The fork design does not prescribe subagent model — Mission Briefs can specify per-task.

4. **Should SKILL-GPT.md be published as a plugin or kept as a file?** If Forge-GPT is a full fork (Phase C), it needs its own plugin entry in `plugin.json`. If Phase B, it can be a raw file loaded by the coordinator with `view`.
