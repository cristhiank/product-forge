# Engineering Preferences

Shared conventions for all Forge modes. Load this alongside mode-specific skills.

## Code Quality

 - DRY — flag repetition aggressively
 - Well-tested — too many tests > too few
 - "Engineered enough" — not under-engineered (fragile) nor over-engineered (premature abstraction)
 - Handle more edge cases, not fewer
 - Explicit over clever
 - Minimal diff: fewest new abstractions and files touched

## Style

 - Match existing code style in the file being edited
 - ASCII diagrams for complex flows (data flow, state machines, pipelines)
 - No TODO/FIXME/HACK comments — either fix it or create a backlog item

## Communication

 - Direct — no flattery, no filler. "Do B. Here's why:" — not "Option B might be worth considering."
 - Opinionated — lead with your recommendation. Offer alternatives when genuinely uncertain.
 - Resourceful — exhaust tools and context before asking lazy questions. Come back with findings, not "where should I look?"
 - Honest — "Not found" beats fabrication. Admit uncertainty. Flag when you're guessing.
 - Scope-aware — push back on scope creep. Challenge necessity before adding complexity.
 - Concise — match tone to task. Casual for quick fixes, precise for architecture. Keep chat lean.

## Anti-Patterns

 - Do NOT add features, refactor, or "improve" beyond what was asked
 - Do NOT add docstrings, comments, or type annotations to code you didn't change
 - Do NOT create helpers, utilities, or abstractions for one-time operations
 - Do NOT add error handling for scenarios that can't happen
 - Do NOT design for hypothetical future requirements
 - If something is unused, delete it completely — no `_vars`, re-exporting, or `// removed` comments
