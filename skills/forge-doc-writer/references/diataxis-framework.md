# Diátaxis Documentation Framework

> Based on Daniele Procida's framework (https://diataxis.fr/).
> Used by Django, Cloudflare, Canonical, Stripe, LangChain, Gatsby.

---

## The Four Quadrants

```
                 PRACTICAL                    THEORETICAL
              (doing things)               (understanding)
         ┌─────────────────────┬─────────────────────────┐
LEARNING │                     │                          │
(study)  │    TUTORIALS        │     EXPLANATION          │
         │    "Teach me"       │     "Help me understand" │
         │    Step-by-step     │     Background, context  │
         │    Learning-oriented│     Understanding-orient.│
         ├─────────────────────┼──────────────────────────┤
WORKING  │                     │                          │
(apply)  │    HOW-TO GUIDES    │     REFERENCE             │
         │    "Help me do X"   │     "Give me the facts"  │
         │    Task-oriented    │     Information-oriented  │
         │    Problem-solving  │     Lookup, exhaustive    │
         └─────────────────────┴──────────────────────────┘
```

---

## Quadrant Rules

### Tutorial — "Teach me by doing"

**Purpose:** Help a beginner learn by completing a meaningful exercise.

**Rules:**
- Put the user "on rails" — every step has one clear action and one expected outcome
- Guarantee success — if they follow the steps, it works. No ambiguous choices.
- Start from a known state (clean environment, fresh install, default config)
- Keep it linear — no branching, no "if you prefer X, do Y instead"
- Celebrate progress — acknowledge milestones ("You just created your first tool!")
- End with something working — the reader should have a visible result

**What does NOT belong in a tutorial:**
- Theory or architecture explanations (link to Explanation docs)
- Exhaustive option lists (link to Reference docs)
- Edge cases or error handling (link to How-To guides)
- Alternative approaches ("You could also use...")

**Example titles:**
- "Build Your First Custom Tool in 15 Minutes"
- "Create a Pet Boarding Booking Flow from Scratch"
- "Getting Started with the Memory Module"

---

### How-To Guide — "Help me solve this specific problem"

**Purpose:** Provide practical steps to accomplish a specific task.

**Rules:**
- Assume the reader is competent — they know the basics, they need to solve X
- Be goal-oriented — title starts with "How to..." or states the task clearly
- Be flexible — mention alternatives when they matter
- Focus on the task, not the concept — if they need theory, link to Explanation
- Include prerequisites — what must be true before starting
- Show the expected result at the end

**What does NOT belong in a how-to guide:**
- Teaching fundamentals from scratch (that's a Tutorial)
- Listing every possible option (that's Reference)
- Explaining why the system works this way (that's Explanation)

**Example titles:**
- "How to Add a New Messaging Channel"
- "How to Configure Multi-Tenant Memory Isolation"
- "How to Write Architecture Tests for Module Boundaries"

---

### Reference — "Give me the facts"

**Purpose:** Provide exhaustive, structured, lookup-friendly technical information.

**Rules:**
- Be exhaustive — document EVERY interface, method, parameter, option
- Be structured — consistent format across all entries (tables, signatures, types)
- Be neutral — state facts, don't persuade or guide
- Be precise — exact types, exact defaults, exact constraints
- Mirror the code structure — organize reference docs to match source code layout
- Keep it up to date — stale reference is worse than no reference

**What does NOT belong in reference:**
- Step-by-step instructions (that's a How-To)
- Conceptual explanations (that's Explanation)
- Learning exercises (that's a Tutorial)

**Format patterns for reference docs:**
```markdown
## IToolProvider (Interface)

| Member | Type | Description |
|--------|------|-------------|
| `Name` | `string` | Unique tool identifier |
| `Schema` | `JsonSchema` | Input parameter schema |
| `ExecuteAsync()` | `Task<ToolResult>` | Executes the tool with given context |

**Registered by:** `AddAgent()` in `AgentModule.cs`
**Lifetime:** Scoped
**Namespace:** `Haruk.Agent.Contracts`
```

---

### Explanation — "Help me understand why"

**Purpose:** Provide background, context, rationale, and conceptual understanding.

**Rules:**
- Start with the big picture before diving into details
- Explain trade-offs, not just decisions ("We chose X over Y because...")
- Connect concepts to each other — show how parts relate
- Use analogies when they genuinely help
- Include diagrams for system relationships (Mermaid preferred)
- Reference the code but don't list every method

**What does NOT belong in explanation:**
- Step-by-step instructions (that's Tutorial or How-To)
- Exhaustive API listings (that's Reference)
- Task-oriented recipes (that's How-To)

**Example titles:**
- "Architecture: Why a Modular Monolith?"
- "How the Prompt Pipeline Assembles Context"
- "Memory Scoping: From Principal to Tenant to Global"

---

## Decision Tree: "Which Quadrant?"

```
Is the reader trying to LEARN something new?
├── YES → Is it hands-on, step-by-step?
│         ├── YES → TUTORIAL
│         └── NO  → EXPLANATION
└── NO  → Is the reader trying to DO a specific task?
          ├── YES → HOW-TO GUIDE
          └── NO  → Is the reader looking up specific facts?
                    ├── YES → REFERENCE
                    └── NO  → EXPLANATION (default for conceptual content)
```

---

## When to Bend the Rules

Diátaxis is advisory, not law. Acceptable deviations:

1. **Quick Start sections** in README files blend Tutorial + Reference. That's fine — READMEs serve as entry points, not deep docs.

2. **Inline examples in Reference** — A code example in a Reference doc is helpful when it shows usage, not when it teaches.

3. **Context paragraphs in How-To** — A sentence or two of context before steps is fine. A full architecture overview is not.

4. **ADRs** — Architecture Decision Records don't fit neatly into Diátaxis. They're their own type: decision documentation.

5. **Product docs** — User-facing docs are primarily How-To but may include Tutorial elements for onboarding flows.

When you deviate, note the primary quadrant and the secondary purpose:
```markdown
<!-- Diátaxis: primarily Reference, with inline How-To examples -->
```

---

## Separation Principle

The most common documentation mistake is **mixing quadrants in one document**. This creates docs that are too long to look up facts in and too scattered to learn from.

**Signs of quadrant mixing:**
- A "Getting Started" tutorial that also lists every configuration option
- A Reference page that includes a 10-step setup guide
- An Explanation doc that includes code snippets the reader should run

**Fix:** Split the document. Link between quadrants. Each doc has ONE primary job.

---

## Sources

- Diátaxis official: https://diataxis.fr/
- Sequin case study: https://blog.sequinstream.com/we-fixed-our-documentation-with-the-diataxis-framework/
- I'd Rather Be Writing analysis: https://idratherbewriting.com/blog/what-is-diataxis-documentation-framework
- Good Docs Project templates: https://thegooddocsproject.dev/
