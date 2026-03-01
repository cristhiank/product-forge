# Stack Adaptation Guide

The principles in this skill are expressed as abstract patterns. This guide maps them to concrete idioms in common backend stacks.

Use this reference when the principle-to-code mapping is not obvious for the project's technology.

## Principle-to-Idiom Mapping

| Principle | Typical Expression | Alternatives |
|-----------|-------------------|-------------|
| Module isolation | Separate project/package per module | Folder convention with enforced import rules |
| Contract surface | Exported interfaces, DTOs, and event types | Public API types in a dedicated contracts folder or barrel file |
| Internal visibility | Language-level access control (internal, package-private) | Linter rules blocking cross-module imports of non-contract types |
| Dependency injection | Framework DI container | Factory functions, module-level singletons, or constructor parameters |
| Module registration | Entry point function that wires services + routes | Init function, plugin registration, or app-level composition |
| Typed configuration | Options/settings class bound from config source | Validated config object (schema validation on load) |
| Migration runner | Framework-integrated migration tool | Standalone migration library or hand-rolled versioned SQL runner |
| Architecture tests | Reflection-based or AST-based boundary tests | Linter plugins for import boundaries, or custom scripts |
| Middleware pipeline | Framework pipeline with ordered handlers | Function composition, decorator chains, or plugin hooks |
| Background workers | Hosted service or framework job runner | Timers, cron libraries, or queue consumers |

## Small Codebase Adaptation

Not every project is a multi-module platform. For smaller codebases:

| Platform-Scale Concept | Small-Codebase Equivalent |
|----------------------|--------------------------|
| Bounded context | Well-named folder or namespace |
| Module registration | Composition root file (e.g., `app.ts`, `main.py`) |
| Contract surface | Exported types from a folder's index/barrel file |
| Architecture tests | Linter rules or code review conventions |
| Migration runner | Simple ordered script execution |
| Shared kernel | `utils/` or `lib/` with no domain types |

**Scale the formality to the codebase.** A 2,000-line app with one developer does not need the same ceremony as a 50,000-line platform with five teams. Apply the principle at the level that prevents real problems without creating bureaucracy.

## When the Skill Feels Like a Poor Fit

If most of the skill's principles feel irrelevant to the current codebase, focus on these universals that apply at any scale:

1. **Single data owner per concept** — Even in a single-file app, don't let two unrelated functions mutate the same state
2. **Explicit contracts** — Define clear interfaces between logical subsystems, even if they're in the same file
3. **Pragmatic modeling** — Start simple, add structure when real complexity demands it
4. **Test the logic, mock the boundary** — Applies identically regardless of language or framework
5. **Migrations are forward-only** — Any project with a database benefits from versioned, ordered schema changes
