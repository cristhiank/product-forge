# Design Artifacts

> Self-contained HTML review documents that make design decisions visible, navigable, and reviewable in a browser — replacing terminal-only tables with rich visual communication.

---

## Principle

Design communication should match the cognitive complexity of the design. A 3-service architecture with data flows, state machines, and failure modes cannot be effectively reviewed as a stream of markdown tables in a terminal. When the design has spatial relationships (components, flows, states), it deserves spatial visualization.

The artifact exists to elicit structured, actionable feedback. Every element — tabs, diagrams, anchors, feedback panel — serves the review workflow. If it doesn't help the reviewer give better feedback, it doesn't belong.

<rationale>
The pattern that major AI development platforms have converged on is: agent generates self-contained HTML → user views in browser → structured feedback returns to CLI. This separates the reading experience (browser, rich visuals, navigation) from the conversation (terminal, text, iteration). The browser is the review surface; the terminal is the conversation surface.
</rationale>

---

## When to Generate

Design artifacts are triggered by **complexity and design level**, not by every task.

| Trigger | Artifact? | Rationale |
|---------|-----------|-----------|
| T1 (simple) tasks | No | No design needed — not worth the context switch |
| T2 (moderate), Level 4 only | No | Contract alignment fits comfortably in terminal output |
| T2+ with 3+ components | Yes | Spatial relationships benefit from visual layout |
| T3+ (complex), Level 2-3 | Yes | Component maps, data flows, state machines need diagrams |
| T4-T5 (system), Level 1-4 | Yes | Full design progression demands navigable document |
| User explicitly requests | Yes | Always honor explicit requests |

The design mode subagent decides whether to generate an artifact based on these triggers. When in doubt, generate — the cost is low and the value is high.

---

## Artifact Format

A design review artifact is a **single self-contained HTML file** that opens in a browser.

### Structure

```
┌─────────────────────────────────────────────────────┐
│  🏗️ Design Review: [Feature Name]          [Draft]  │
├──────────┬──────────────────────────────────────────┤
│          │                                           │
│ Overview │  [Active tab content]                     │
│          │                                           │
│ Arch.    │  - Diagrams (Mermaid / Markmap)           │
│          │  - Detail tables                          │
│ Flows    │  - Decision rationale                     │
│          │  - Design questions                       │
│ State    │                                           │
│          │                                           │
│ Decide   │                                           │
│          │                                           │
│ Questions│                                           │
│          │                                           │
├──────────┴──────────────────────────────────────────┤
│  Feedback: [✅ Approve] [⚠️ Flag] [💬 Comment]       │
│  [Copy Feedback]                                     │
└─────────────────────────────────────────────────────┘
```

### Tabs

Map design levels to tabs. Include only the tabs that are relevant to the current design.

| Tab | Content | Design Level | Diagram Type |
|-----|---------|-------------|-------------|
| **Overview** | Scope tree, capabilities, constraints | L1 | Markmap mind map |
| **Architecture** | Component map, domain model, boundaries | L2 | Mermaid flowchart / C4 |
| **Flows** | Sequence diagrams, integration points | L3 | Mermaid sequence |
| **State & Data** | State machines, ER diagrams, consistency | L3 | Mermaid state / ER |
| **Decisions** | Decision log with rationale, alternatives | All | Table |
| **Questions** | Open design questions with severity | All | Table |

Not every artifact needs all tabs. An L4-only contract alignment may only need Decisions and Questions. A full L1-L4 progression includes all tabs.

---

## Diagram Rendering

### Primary: Mermaid.js (CDN)

Mermaid diagrams are rendered client-side via a CDN script tag. This keeps artifact file size small (~5-10KB of content) and works on any machine with a browser.

```html
<script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
```

### JSON Intermediate Representation

<rationale>
LLM-generated Mermaid syntax has moderate reliability — arrow types, identifier quoting, and syntax variations between diagram types cause ~10-20% of diagrams to fail on first generation. A structured JSON intermediate eliminates this class of errors because a deterministic template handles Mermaid's idiosyncrasies. The JSON is also useful for debugging and for the feedback loop.
</rationale>

The agent generates design data as structured JSON. A deterministic JavaScript function embedded in the HTML template converts JSON to Mermaid syntax.

**JSON schema for diagram data:**

```json
{
  "diagrams": [
    {
      "id": "arch-overview",
      "type": "flowchart",
      "title": "System Architecture",
      "nodes": [
        {"id": "web", "label": "Web App", "group": "frontend", "shape": "box"},
        {"id": "api", "label": "API Gateway", "group": "backend", "shape": "box"},
        {"id": "db", "label": "PostgreSQL", "group": "data", "shape": "cylinder"}
      ],
      "edges": [
        {"from": "web", "to": "api", "label": "REST/GraphQL", "style": "solid"},
        {"from": "api", "to": "db", "label": "queries", "style": "solid"}
      ],
      "groups": [
        {"id": "frontend", "label": "Frontend"},
        {"id": "backend", "label": "Backend Services"},
        {"id": "data", "label": "Data Layer"}
      ]
    }
  ]
}
```

Supported diagram types and their JSON→Mermaid mappings:

| Type | JSON `type` value | Mermaid output | Use for |
|------|------------------|----------------|---------|
| Architecture | `flowchart` | `flowchart TD` | Component maps, system topology |
| Sequence | `sequence` | `sequenceDiagram` | Data flows, API interactions |
| State machine | `state` | `stateDiagram-v2` | Entity lifecycles, workflow states |
| ER diagram | `er` | `erDiagram` | Domain models, data relationships |
| Mind map | `mindmap` | Markmap (separate lib) | L1 overview, scope trees |

### Hand-Drawn Theme (Default)

<rationale>
The hand-drawn/sketchy aesthetic psychologically signals "this is a draft — please critique." Polished, pixel-perfect diagrams unconsciously signal "this is decided," which suppresses the feedback the review is designed to elicit. The default theme should encourage participation, not discourage it.
</rationale>

All Mermaid diagrams use the hand-drawn look by default:

```
%%{init: {'look': 'handDrawn', 'theme': 'neutral'}}%%
```

The artifact includes a toggle button: **Draft View / Clean View**. Draft is the default. Clean view uses the standard Mermaid theme — useful when the design is finalized and ready for documentation.

### Degradation Chain

When diagram generation fails, degrade gracefully — never deliver a broken artifact.

```
1. JSON → Mermaid (primary path)
      ↓ fails?
2. Simplified diagram (fewer nodes, simpler arrows)
      ↓ still fails?
3. Mermaid raw text (let user paste into mermaid.live)
      ↓ not applicable?
4. Styled HTML layout (CSS boxes + flexbox, zero dependencies)
      ↓ fallback
5. Enhanced terminal output (tables + inline flow notation)
```

The artifact should indicate which rendering path was used. If degradation occurred, include the original JSON so the user can debug or the agent can retry.

---

## Anchor Convention

Every reviewable element in the artifact gets a unique anchor ID. This enables precise feedback from the browser back to the CLI.

### ID Prefixes

| Prefix | Element Type | Example |
|--------|-------------|---------|
| `#ctx-` | Context/scope items | `#ctx-auth-flow` |
| `#svc-` | Services/components | `#svc-order-router` |
| `#flow-` | Sequence flows | `#flow-checkout-happy` |
| `#state-` | State machine states | `#state-order-processing` |
| `#dec-` | Design decisions | `#dec-003-async-queue` |
| `#q-` | Open questions | `#q-002-retry-strategy` |
| `#tab-` | Tab sections | `#tab-architecture` |

### Usage in Feedback

The artifact footer displays the anchor reference. Users can give precise feedback:

```
re: #svc-auth — should this handle token refresh, or delegate to a dedicated service?
re: #dec-003 — I prefer option B (in-memory cache over Redis)
re: #flow-checkout-happy — missing error path when payment provider is unavailable
```

The agent parses anchor references to know exactly which element to revise.

---

## Feedback Mechanism

The artifact includes a structured feedback panel at the bottom of each tab.

### Per-Section Controls

Each major section (diagram, table, decision) has:
- ✅ **Approve** — this section looks good
- ⚠️ **Flag** — needs revision (opens comment field)
- 💬 **Comment** — add context without rejecting (opens comment field)

### Copy Feedback Button

A "Copy All Feedback" button generates structured markdown for clipboard:

```markdown
## Design Review Feedback
### Architecture (#tab-architecture): ⚠️ Flagged
- #svc-auth: Should handle refresh tokens, not delegate
- #svc-router: Approve

### Flows (#tab-flows): ✅ Approved

### Decision #dec-003: Rejected
Comment: Redis is overkill for this scale, use in-memory cache

### Question #q-002: Answered
Answer: Use exponential backoff with 3 retries, 30s max
```

The user pastes this into the CLI. The agent parses the structured feedback and knows exactly what to revise, what to keep, and what questions are answered.

---

## Artifact Lifecycle

### Generation

```
Design subagent completes a level (L2, L3, or full L1-L4)
  │
  ├── Generates JSON design data (nodes, edges, decisions, questions)
  ├── Writes single HTML file to session workspace
  │     ~/.copilot/session-state/{session-id}/design-review.html
  ├── Opens in browser: open design-review.html (macOS) / xdg-open (Linux)
  └── Outputs to CLI: "Design review opened in browser. Use anchor IDs for precise feedback."
```

### Iteration

When the user provides feedback (via clipboard paste or CLI text):

```
Agent reads feedback
  │
  ├── Parses anchor references (#svc-auth, #dec-003)
  ├── Revises the relevant JSON data sections
  ├── Regenerates the HTML artifact (same file path)
  └── Outputs to CLI: "Updated. Refresh browser to see changes."
```

The user refreshes the browser tab to see the updated artifact.

### Persistence

Artifacts live in the session workspace (`~/.copilot/session-state/`). They are:
- ✅ Available during the session
- ✅ Included in session checkpoints
- ❌ Not committed to the repository (unless user explicitly asks)

---

## Template Requirements

The HTML template is a stable shell. The agent injects design data as JSON into a `<script>` block. The template's JavaScript renders the data into tabs, diagrams, tables, and feedback controls.

### Required Template Capabilities

| Capability | Implementation |
|-----------|---------------|
| Tabbed navigation | Vanilla JS, no framework |
| Mermaid rendering | CDN import, client-side render |
| Markmap rendering | CDN import for overview tab |
| Dark theme | CSS custom properties, system-preference aware |
| Hand-drawn toggle | Re-render Mermaid with different init config |
| Anchor IDs | `id` attributes on all sections, auto-generated from JSON |
| Feedback panel | Per-tab approve/flag/comment + clipboard API |
| Responsive layout | CSS grid, works on standard laptop screen |
| Zero external dependencies at runtime | CDN scripts only, no npm/node required |

### Template Location

The template is packaged with the Forge skill as a reference artifact. The design mode subagent uses it as the base for generating review documents.

---

## Anti-Patterns

- ❌ Generating an artifact for simple tasks (T1, single-component changes) — the context switch isn't worth it
- ❌ Putting implementation code in the artifact — it's a design document, not a codebase
- ❌ Generating diagrams without the JSON intermediate — direct Mermaid generation is unreliable
- ❌ Skipping the feedback panel — the artifact exists to collect feedback
- ❌ Using anchor IDs without documenting them in the artifact footer — users need to know the convention
- ❌ Delivering a broken artifact — always degrade gracefully through the degradation chain
- ❌ Generating multiple HTML files for one design — one artifact per design review, with tabs for multiple levels

---

## Integration with Design Mode

The design mode subagent (`forge-design` / `forge-design-gpt`) integrates with this spec at these points:

1. **After L2 (Components)** — Generate/update artifact with Architecture tab (component map, domain model)
2. **After L3 (Interactions)** — Update artifact with Flows tab (sequence diagrams) and State tab (state machines)
3. **After L4 (Contracts)** — Update artifact with contract type signatures (as code blocks in a Contracts tab)
4. **At every level** — Update Decisions and Questions tabs

The artifact is cumulative — each level adds to the same document. The user reviews the whole design in context, not isolated fragments.
