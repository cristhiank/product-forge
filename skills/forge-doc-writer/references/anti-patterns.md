# Documentation Anti-Patterns

Learned from 50+ documentation sessions. Each anti-pattern includes the symptom, why it's harmful, and how to fix it.

---

## AP-1: Empty Placeholders

**Symptom:** Sections with no real content — just headers and empty checkboxes.
```markdown
## Acceptance Criteria

- [ ]
```

**Why it's harmful:** Downstream agents and humans trust the section exists and skip validation. The placeholder persists forever because "it's already there."

**Fix:** Never write an empty section. Either fill it with real content or remove the heading entirely. If content is pending, write explicitly: "TODO: [specific description of what's needed]."

---

## AP-2: Phantom Diagrams

**Symptom:** Promising a visual that never materializes.
```markdown
See the architecture diagram below for how components interact.

[No diagram follows]
```

**Why it's harmful:** Readers lose trust. The doc claims to explain visually but delivers nothing. Common when agents default to tables instead of diagrams.

**Fix:** If you reference a diagram, create it. Use Mermaid (preferred), ASCII art, or a table as fallback. If you can't create a visual, don't promise one — describe the relationship in prose.

---

## AP-3: Stale Code Examples

**Symptom:** Code snippets that reference deprecated APIs, old parameter names, or removed methods.
```csharp
// This method was renamed 3 months ago
var result = service.OldMethodName(param);
```

**Why it's harmful:** Developers copy-paste and get compile errors. They lose trust in all examples.

**Fix:** Before including any code example, verify it compiles against the current source code. Check that:
- Method names exist and match current signatures
- Parameter types are current
- Return types are current
- Imports/namespaces are correct

---

## AP-4: Theory in Tutorials

**Symptom:** A "Getting Started" tutorial that spends 500 words explaining architecture before the user writes a line of code.

**Why it's harmful:** The user came to DO something. Theory before action causes dropout. They'll learn "why" after they've seen it work.

**Fix:** Put the user on rails immediately. First step = first action. Link to the Explanation doc for architectural context: "Want to understand how this works under the hood? See [Architecture Overview](./explanation/architecture.md)."

---

## AP-5: Instructions in Reference Docs

**Symptom:** A Reference page that includes a 10-step setup guide mixed with API tables.

**Why it's harmful:** Reference docs are for LOOKUP. A developer scanning for a method signature doesn't want to wade through a tutorial. And a learner following steps doesn't want API tables interrupting their flow.

**Fix:** Split into two docs. The Reference doc lists facts (interfaces, types, config). The How-To guide provides the steps. Link between them.

---

## AP-6: Documentation Sprawl

**Symptom:** The same module is documented in 3+ locations with no clear canonical source.

**Example from session history:**
```
harness/docs/agent.md          → API reference style
docs/haruk_core_harness/03-AGENT-MODULE.md → Architecture narrative
AGENTS.md                      → AI agent context
harness/product_spec/02-architecture.md → Design rationale
```

**Why it's harmful:** A developer finds 4 docs about "Agent" and doesn't know which is authoritative. Contradictions creep in because updates happen in one location but not others.

**Fix:** Consolidate to ONE canonical location per topic. Archive superseded docs in `_archive/` with an `AGENTS.md` warning that lists known inaccuracies and points to the current doc.

---

## AP-7: Missing Audience Statement

**Symptom:** A doc written for "everyone" that serves no one well.

**Why it's harmful:** A harness-core developer needs internals and module boundaries. A vertical developer needs extension points and DI patterns. An end user needs task instructions. One doc can't serve all three well.

**Fix:** State the audience in the first line or the doc frontmatter:
```markdown
> **Audience:** Developer integrators building verticals on the Haruk agent harness.
```

---

## AP-8: Soft Quality Gates

**Symptom:** Critical rules buried deep in a doc — page 12 of a 15-page spec.

**Why it's harmful:** Agents load SKILL.md and focus on the first sections. Rules at the bottom of a long doc are effectively invisible. This caused the "empty acceptance criteria" bug — the quality rule was at line 299 of a 470-line doc.

**Fix:** Put non-negotiable rules at the TOP of the document. Use a dedicated `## CRITICAL` section before everything else:
```markdown
## CRITICAL — Quality Gates

These rules are NON-NEGOTIABLE. Read before doing anything else.

1. Every doc MUST have [X]
2. Never write [Y]
```

---

## AP-9: Mixing Quadrants

**Symptom:** A single doc tries to be a tutorial AND a reference AND an explanation.

**Why it's harmful:** It's too long to look up facts in. It's too scattered to learn from. It's too detailed to skim for concepts.

**Fix:** Split into separate docs, one per Diátaxis quadrant. Link between them. Each doc has ONE primary purpose.

---

## AP-10: Single-Variant Updates

**Symptom:** Updating one agent's docs but forgetting the other variant.

**Example:** Updating `agents/forge/modes/design.md` (Claude) but not `agents/forge-gpt/modes/design.md` (GPT).

**Why it's harmful:** The agents diverge. One has the new rules, the other doesn't. Users get inconsistent behavior depending on which agent they use.

**Fix:** Always update both variants together. After editing any file in `agents/forge/`, check if the corresponding file exists in `agents/forge-gpt/` and update it too.

---

## AP-11: Build Script Drift

**Symptom:** Adding a new skill or mode but forgetting to add it to all 6 build scripts.

**Why it's harmful:** The skill works in dev but doesn't ship in the built plugin. Users can't access it.

**Fix:** After adding any new skill, mode, or spec, update ALL 6 build scripts:
- `build-plugin.sh` + `build-plugin.ps1`
- `build-forge-gpt-plugin.sh` + `build-forge-gpt-plugin.ps1`
- `build-all.sh` + `build-all.ps1`

Verify the component count increases after building.

---

## AP-12: Stale Competitive Data

**Symptom:** Market research docs with fabricated or outdated pricing, user counts, or feature claims.

**Example from session history:** "Competitor X costs $800/mo" when the actual price was $53/mo. This led to a flawed competitive analysis.

**Why it's harmful:** Strategic decisions based on wrong data. The error compounds through business plans, pricing models, and go-to-market strategy.

**Fix:** Always fact-check competitive claims against primary sources. Include URLs. Date-stamp the research. Flag any claim that couldn't be verified: "⚠️ Unverified — could not find public pricing."
