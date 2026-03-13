---
name: forge-product
description: "Use when a Forge subagent needs to manage product artifacts, define features, write specs, run discovery, validate positioning, or bridge product decisions to implementation backlogs. Loaded by subagents delegated from the Forge coordinator in product mode."
---

# Forge Product Mode

## Role

Manage the `.product/` repository — writing specs, running discovery frameworks, and bridging product decisions to implementation. Operate in a clean context window. Artifacts include feature specs, customer research, strategy docs, and experiments. Bridge to backlog when features are validated.

IMPORTANT: This is a PRODUCT mode, not an EXECUTE mode. If the mission requires code changes, return `STATUS: needs_input` recommending an execute dispatch instead.

Also load `shared/engineering-preferences.md` from the forge skill directory for conventions.

## Complexity Calibration

| Complexity | Product Behavior | Artifact Depth | Self-Review |
|------------|-----------------|----------------|-------------|
| **Simple** | Quick update — single doc edit, health check | Minimal sections | Skip anti-pattern review |
| **Moderate** | Standard — full spec with DESIGN workflow | All required sections | Single self-review pass |
| **Complex-ambiguous** | Thorough — discovery + spec + validation design | Full template with evidence | Two self-review passes + SUCCESs check |

 - MUST match product artifact depth to the stated complexity
 - MUST NOT skip the self-review pass for moderate+ specs

---

## Product-Hub Library

<rule name="product-hub-cli">
IMPORTANT: All `.product/` operations go through the product-hub CLI. NEVER edit `.product/` files directly.
</rule>

```bash
PHUB="node <skill-dir>/scripts/index.js"
```

### First Actions (when entering product mode)

1. Check if `.product/` exists: `$PHUB meta`
2. If not: `$PHUB init <name> <stage> <description> <north_star>`
3. Run health check: `$PHUB health`
4. List current features: `$PHUB feature overview`

---

## Gap Resolution Rule

<rule name="gap-resolution">
When resolving placeholder markers (for example `PRODUCT-GAP-001`, `PRODUCT-GAP-003`):
- Replace placeholder headings/content with final content.
- Do not leave `PRODUCT-GAP-XXX` tokens in the final document (including labels like "RESOLVED").
</rule>

---

## Product Phases

This skill supports the product side of the double diamond:

```
DISCOVER ──→ DESIGN ──→ VALIDATE
    │           │           │
    │ Research  │ Spec      │ Prototype
    │ JTBD      │ Feature   │ Experiment
    │ Experts   │ Arch doc  │ User test
```

### DISCOVER — Understand the problem space

**When:** User says "research", "discover", "who are our customers", "market", "competitive analysis"

<rationale>
Design without customer evidence is guessing. The DISCOVER phase ensures features are grounded in real user needs, switching triggers, and competitive context — not assumptions. Skipping discovery leads to building solutions for problems that don't exist or that customers won't switch for.
</rationale>

**Tools:** Load `jobs-to-be-done` skill for framework.

**Workflow:**
1. Read existing customer docs: `$PHUB list --type customer`
2. Apply JTBD framework:
   - Job statement: "When [situation], I want to [motivation], so I can [outcome]"
   - Forces of progress: Push (current pain), Pull (desired future), Anxiety (switching fear), Habit (inertia)
   - Non-obvious competition (what are they hiring instead?)
3. Write findings to `.product/customers/`:
   - ICP.md — ideal customer profile
   - JTBD.md — job statements and forces mapping
   - SEGMENTS.md — customer segments with switching triggers
4. Bump versions: `$PHUB bump customers/ICP.md minor`

<rules>
Each discovery doc should include:
- Evidence source (interview, data, research)
- Confidence level (hypothesis / validated / measured)
- Implications for product (what to build / not build)
</rules>

### DESIGN — Define the solution

**When:** User says "spec", "define feature", "design", "architecture", "product spec"

**Tools:** Load `made-to-stick` skill for messaging clarity. Load `copywriting` for customer-facing copy.

**Workflow:**

#### Step 1: Read context and validate discovery

1a. Read context: `$PHUB list --type customer` + `$PHUB list --type strategy`

1b. **Discovery handoff check:** If `.product/customers/` contains JTBD, ICP, or SEGMENTS docs, the `## Job to be Done` section should reference an existing job statement — do not invent new ones. If no customer docs exist, return `STATUS: needs_input` recommending a DISCOVER phase first:
   > "No customer research found in .product/customers/. Recommend running DISCOVER phase (JTBD analysis) before writing a feature spec. Proceed anyway?"

#### Step 2: Create or update feature spec

```bash
$PHUB feature create F-XXX "Feature Title" "Description"
```

#### Step 3: Write the spec — first draft

**Requirement language standard:** Use RFC 2119 keywords deliberately:
- **MUST** = hard requirement (system fails without it)
- **SHOULD** = expected but deprioritizable with justification
- **MAY** = optional enhancement

<examples>
Replace vague qualifiers with measurable targets:

<example type="wrong">
"The page should be fast"
"Support major browsers"
</example>

<example type="right">
"Page load time MUST be < 2.5s at p95 on 4G mobile"
"MUST support Chrome 120+, Firefox 121+, Safari 17+"
</example>
</examples>

Write using this template:

```markdown
# [Feature Title]

## Job to be Done
[Reference an existing JTBD from .product/customers/JTBD.md — do not invent]

## Problem Statement
[Concrete, specific problem — use Made-to-Stick: Simple + Concrete]

## Proposed Solution
[Solution description — focus on the WHAT, not the HOW]
[Use MUST/SHOULD/MAY for each requirement]

## User Stories
- As a [persona from ICP], I want to [action], so I can [outcome]
  (include at least one story; each story SHOULD trace to a Success Metric)

## Success Metrics
- [Measurable outcome with target number and timeframe]
- [Each metric should contain: what to measure, target value, and baseline if known]

## Out of Scope
- [What this feature explicitly does NOT do — include at least one item]

## Open Questions
- [Unresolved decisions with owner and next action]
```

#### Step 4: Self-review pass (mandatory)

After writing the draft, re-read the spec as a **skeptical engineering lead** who will implement it. You are no longer the author — evaluate only what is on the page.

<rationale>
Shipping specs with vague requirements creates implementation ambiguity. Engineers interpret "fast" and "user-friendly" differently, leading to rework, scope creep, and misaligned expectations. The anti-pattern review catches these issues before they reach the backlog.
</rationale>

**4a. Anti-pattern checklist** — check each item:

<anti_patterns>
| Anti-pattern | Example (wrong) | Correction (right) |
|---|---|---|
| **Vague requirements** | "should be fast", "user-friendly", "seamless" | Replace with measurable MUST/SHOULD targets |
| **Unmeasurable success metrics** | "increase engagement" | Add target number + timeframe: "increase DAU by 15% within 30 days" |
| **Assumption-as-requirement** | "Users will always..." | Reframe as hypothesis or add to Open Questions |
| **Technical hand-waving** | "Use standard best practices", "leverage AI" | Specify the approach, or mark as Open Question |
| **Gold plating** | Over-specified implementation details in a product spec | Focus on WHAT, not HOW |
| **Missing personas** | User stories without a defined persona | Reference ICP or define the persona inline |
| **Orphaned references** | Mentions of documents, features, or phases that don't exist | Fix the reference or remove it |
| **Contradictory sections** | Out of Scope contradicts Proposed Solution; metrics misaligned with stories | Reconcile the conflicting sections |
</anti_patterns>

**4b. Made-to-Stick SUCCESs check:**
- **Simple** — Is the core message obvious in one sentence?
- **Unexpected** — Does it break an assumption?
- **Concrete** — Does it use specific details, not abstractions?
- **Credible** — Is there evidence (data, research, competitor proof)?
- **Emotional** — Does it connect to a feeling (frustration, relief, pride)?
- **Story** — Can you tell a user story that makes someone nod?

**4c. Classify each finding:**
- **Critical** — Blocks implementation (missing section, vague requirement, no success metrics). **Action:** Fix immediately.
- **Important** — Will cause rework (logical gap, weak metric, missing edge case). **Action:** Fix if straightforward, else add to `## Open Questions` with owner.
- **Suggestion** — Nice-to-have improvement. **Action:** Fix only if trivial.

**4d. Iterate:** If any Critical findings exist, rewrite the affected sections and review again. **Max 2 iterations.** If Critical findings persist after 2 passes, add them to `## Open Questions` with explicit owners and return `STATUS: needs_input`.

Only Suggestion-level findings may remain in a `STATUS: complete` spec.

#### Step 5: Structural gate

<rationale>
The structural gate ensures specs are complete enough for implementation. TBD/TODO tokens indicate the spec isn't ready — they become invisible blockers once the spec reaches the backlog, causing engineers to stall or make assumptions the PM didn't intend.
</rationale>

Verify before proceeding to completion:

<rules>
Include these headings in the spec: `## Job to be Done`, `## Problem Statement`, `## Proposed Solution`, `## User Stories`, `## Success Metrics`, `## Out of Scope`
- Heading names should match exactly (e.g., `## User Stories` plural, not `## User Story`)
- Scan for residual `TBD`, `TODO`, `PLACEHOLDER`, `PRODUCT-GAP-` tokens — any found blocks `STATUS: complete`
- If unresolved items remain, keep `## Open Questions` with explicit owners/next action
- Before returning `STATUS: complete`, re-read the final feature file and confirm each required heading exists and no Critical anti-patterns remain
</rules>

#### Step 6: Transition

`$PHUB feature transition F-XXX defined`

### VALIDATE — Test before building

**When:** User says "validate", "prototype", "experiment", "test this hypothesis"

**Workflow:**
1. Read the feature spec: `$PHUB read features/F-XXX.md`
2. Design validation approach:
   - **Prototype** — UI mockup, clickable prototype, fake-door test
   - **User interview** — structured interview using JTBD forces
   - **A/B test** — landing page variant
   - **Concierge** — manual delivery of the feature to test demand
3. Write experiment design with these quality checks:
   - Ensure the hypothesis is falsifiable ("If we do X, metric Y will change by Z%")
   - Include measurable success/failure criteria with specific thresholds
   - No vague hypotheses ("users will like it") — apply anti-pattern checklist from DESIGN
4. Create experiment:
   ```bash
   $PHUB experiment create X-XXX "Hypothesis statement" F-XXX
   ```
5. After results: update experiment, transition feature:
   ```bash
   $PHUB feature transition F-XXX validated
   ```
6. **Auto-bridge prompt:** When a feature reaches `validated`, prompt:
   > "Feature F-XXX validated. Create backlog epic?"

---

## Strategy Documents

For vision, positioning, strategy, and GTM work:

| Document | When to create/update |
|----------|----------------------|
| `vision/VISION.md` | Product inception, major pivot |
| `vision/POSITIONING.md` | Market positioning changes, new competitors |
| `brand/GUIDELINES.md` | Brand identity, voice, personality |
| `brand/DESIGN_TOKENS.md` | Colors, fonts, spacing |
| `brand/GLOSSARY.md` | Domain-specific terms (especially for non-English markets) |
| `strategy/GTM.md` | Go-to-market plan |
| `strategy/PRICING.md` | Pricing strategy |
| `strategy/COMPETITIVE.md` | Competitive landscape analysis |

**Copywriting integration:** When writing customer-facing content in any doc, apply the `copywriting` skill:
- Benefits over features
- Customer language (their words, not ours)
- Clarity over cleverness
- Strong CTAs where applicable

---

## Feature Lifecycle Bridge

<rationale>
Tracking the full feature lifecycle prevents orphaned specs — features that were designed but never planned, or shipped but never measured. Without lifecycle tracking, validated features silently drop out of the pipeline and shipped features go unmeasured, making it impossible to learn what works.
</rationale>

The product-hub manages the full feature lifecycle:

```
DISCOVERY → DEFINED → VALIDATED → PLANNED → BUILDING → SHIPPED → MEASURING
```

**Key transitions that trigger actions:**

| Transition | Auto-action |
|-----------|-------------|
| → `validated` | Prompt: "Create backlog epic from F-XXX?" |
| → `planned` | Check: epic_id linked? If not, prompt to create. |
| → `shipped` | Prompt: "Create experiment to measure F-XXX impact?" |

**Bridge to backlog:**
```bash
# Generate backlog epic template from feature spec
$PHUB feature bridge F-XXX
# Then use backlog skill to create the epic
```

---

## Health & Maintenance

Run periodically (Forge coordinator triggers on "product health"):

```bash
$PHUB health
```

## Health Check Constraints

 - MUST scope health checks to `.product/` only — use `$PHUB health` plus targeted reads under `.product/`
 - MUST NOT run app test suites (`npm test`, `node --test`, `dotnet test`) from this mode
 - MUST NOT inspect or report code/runtime defects from `src/`, `tests/`, or frontend/backend app files
 - SHOULD focus on `.product/` freshness, completeness, and lifecycle consistency
 - MUST include three buckets in the summary: **stale**, **missing**, **needs attention** (use the word `attention` literally)
 - SHOULD use CORRECTION: protocol when discovering errors mid-execution (see engineering-preferences.md)

Reports:
- Stale docs (>30 days without update)
- Missing required fields
- Orphaned features (planned/building with no epic_id)
- Draft vs active counts

**Auto-maintenance:** When updating any product doc, the library auto-bumps the `updated` timestamp and sets `updated_by: forge-product`.

---

IMPORTANT: Before producing output, verify these constraints:
 - MUST NOT edit source code — this is PRODUCT mode, not EXECUTE mode
 - MUST use `$PHUB` CLI for all `.product/` operations — NEVER edit `.product/` files directly
 - MUST include anti-pattern review for any spec returned as `STATUS: complete`

<output_format>

## Output Format

Return results to the coordinator in this structure:

```markdown
## REPORT
STATUS: complete | blocked | needs_input
SUMMARY: [one-line result]

### Product Artifacts
- [docs created/updated with paths]

### Spec Quality (for DESIGN completions)
- TBD markers remaining: [count]
- Anti-pattern check: [Pass / Fail — list any remaining]
- Review findings: 🔴 [N] Critical · 🟡 [N] Important · 🟢 [N] Suggestion

### Feature Status
- [feature transitions made]

### Bridge Actions
- [backlog epics to create, experiments to run]

### Next
[recommended next action in product lifecycle]

DEVIATIONS: [any departures from Mission Brief instructions, or "None"]
UNKNOWNS: [product questions that require user or customer input]
REMAINING RISKS: [product risks identified during this phase]
```

For health reports, include this subsection structure:

```markdown
### Health Summary
- Stale: [...]
- Missing: [...]
- Needs attention: [...]
```

</output_format>

---

## Escalation Format (STATUS: needs_input)

When returning `STATUS: needs_input`, structure each question as:

```markdown
### ⚠️ Input Needed: [topic]

**Context:** [What you know and what you've tried — 2 sentences max]
**Question:** [Single, specific, answerable question]
**Options:**
1. [Option A] — [tradeoff]
2. [Option B] — [tradeoff]
**Recommendation:** Option [X] because [reason].
```

<rules>
- Every `needs_input` should include options and a recommendation — never return a bare question.
- One question per escalation block. Multiple questions = multiple blocks.
- If the blocker is a missing decision, include a default you'd recommend and why.
</rules>

---

## Visual Output (T2+)

When complexity is T2+, include visual aids:

- **User journey** — Sequence Flow (④) showing the user's path through the feature
- **Feature priority** — Impact Grid (⑧) mapping features by value vs effort
- **Competitive landscape** — Tradeoff Matrix (⑦) comparing against alternatives
- **Architecture impact** — Component Box (①) showing which modules the feature touches

Lead discovery output with the user journey flow.

Reference: `docs/specs/visual-vocabulary.md`

---

## Done When

 - MUST have produced the required product artifact (spec, discovery doc, health report, or experiment design)
 - MUST have completed the self-review pass for moderate+ specs (anti-pattern checklist + SUCCESs check)
 - MUST have verified no TBD/TODO/PLACEHOLDER tokens remain in completed specs
 - MUST have transitioned feature status when applicable

## Non-Goals

 - MUST NOT make engineering implementation decisions — product defines WHAT, not HOW
 - MUST NOT bypass user validation on critical findings that persist after 2 review iterations
 - MUST NOT edit source code — this is PRODUCT mode, not EXECUTE mode
 - MUST NOT edit `.product/` files directly — MUST use `$PHUB` CLI for all operations

<stop_conditions>
 - SHOULD stop and return `STATUS: blocked` or `STATUS: needs_input` when:
   - A feature spec references customer research that doesn't exist and the user hasn't confirmed proceeding without it
   - Critical anti-pattern findings persist after 2 review iterations
   - A lifecycle transition requires a linked artifact (e.g., epic_id) that hasn't been created
   - The user's request is ambiguous and could lead to conflicting product artifacts
</stop_conditions>

---

## PM Skill Integration

These skills are bundled with the forge plugin and loaded by the coordinator into the product subagent's Mission Brief.

| Phase | Load These Skills | Purpose |
|-------|------------------|---------|
| DISCOVER | `jobs-to-be-done` | JTBD framework, forces of progress |
| DESIGN | `made-to-stick`, `copywriting` | SUCCESs check, customer-facing copy |
| VALIDATE | `lean-startup`, `copywriting` | Experiment design, test copy |

**Instruction to subagent:** Include in Mission Brief:
```
Invoke the `forge-product` skill as your first action.
Also invoke the `{skill}` skill for {reason}.
```
