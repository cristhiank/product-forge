---
name: frontend-architecture
description: >-
  Use when creating, modifying, or reviewing any frontend code — components,
  pages, routes, layouts, forms, API clients, hooks, state management, styling,
  design tokens, loading states, error boundaries, modals, streaming UI, or tests.
  Provides architecture patterns and structural rules for feature modules,
  composition root, design system layers, third-party wrapping, validation policy,
  internationalization, and frontend telemetry. Applies to any framework,
  language, or business domain.
---

# Frontend Architecture

Architectural principles, patterns, and structural rules for building frontend applications. Technology-agnostic and domain-agnostic. Assumes a component-based SPA architecture.

When in doubt, follow this skill instead of improvising a new pattern.

## When This Skill Activates

1. **Check product context** — Look for product spec, brand guidelines, design system docs, or color token files in the project. These are constraints, not suggestions. Brand voice, color tokens, and design principles override generic defaults.
2. **Assess fit** — Identify which principles below apply to the current task. Skip sections that don't apply — a one-component fix doesn't need a full architecture assessment.
3. **Cite decisions** — When making a design or architecture choice, briefly note which principle or product spec constraint guided it. Example: "Using accordion for settings form (design-system: progressive disclosure; form has 7 sections)."
4. **Flag deviations** — If you deviate from a principle or product spec, note why. Deviations with good rationale are fine — silent deviations erode trust.
5. **Propagate to workers** — When spawning sub-agents for frontend tasks, include in their prompt:
   - "Load the frontend-architecture skill"
   - Design token file paths (e.g., `styles/tokens.css`, `globals.css`)
   - Shared component inventory (existing reusable components to use, not reinvent)
   - Brand constraints from product spec (voice, colors, key rules)
   - i18n approach (key format, namespace strategy, locale detection method)

## Design Decision Artifacts

When facing a non-trivial design or architecture choice, produce the appropriate artifact inline:

**Quick Decision** (default — use for most choices):
> **Decision**: [what] | **Principle**: [which one] | **Alternative**: [rejected option and why]

**Tradeoff Matrix** (use when 2+ viable approaches compete):

| Criteria | Option A | Option B |
|----------|----------|----------|
| [relevant dimension] | [assessment] | [assessment] |

For common "choose X vs Y" frontend decisions, see [design-decisions.md](references/design-decisions.md).
For UX review and audit workflows, see [ux-review-workflow.md](references/ux-review-workflow.md).

## Tech Stack Selection Criteria

Whatever framework, styling system, and component library are chosen, the stack should optimize for:

- **Boring and predictable for humans** — Conventions over configuration. A new developer understands the codebase within a day.
- **Easy for tools and automation** — Structured outputs, declarative specs, clear contracts.
- **Safe by default** — No untrusted HTML rendering, no arbitrary code execution from external inputs.
- **Easy to refactor as the product grows** — Loose coupling between features, strong contracts at boundaries.

Prefer:
- A single component framework (not a mix)
- A single styling approach (pick one: utility-first CSS, CSS-in-JS, or CSS modules)
- A curated primitive library for accessible controls, vendored when possible
- A single router with data-loading capabilities
- A single API client strategy
- A single deployable bundle (SPA) unless there is a strong reason for server rendering

## Core Principles

1. **One app, many feature modules** — Single application composed from feature modules. Each feature owns its routes, UI, and data calls.

2. **Clear boundaries, no sneaky coupling** — Features do not import each other's internals. Cross-feature access goes through explicit public exports.

3. **Composition over cleverness** — Simple composition of components, hooks, and functions. No over-abstracted hooks, global stores, or magic helpers.

4. **Host is boring** — Application entry point, router, and providers only wire things together. No business logic, no data fetching, no domain rules.

5. **Single API client, typed contracts** — All backend calls go through a shared API client and feature-specific client modules. No scattered raw HTTP calls.

6. **Design system first** — Primitives and design tokens in a shared UI layer. Features build on project-level components, not ad-hoc markup.

7. **Wrap third-party libraries** — Third-party rendering libraries never imported directly by features. Wrapped behind project-owned components and specs.

8. **External content is untrusted** — Any content from outside the frontend codebase passes through a validation and policy layer before reaching the renderer.

9. **Streaming is progressive refinement** — Streaming data renders within stable containers. Layout must not thrash. Updates animate inside their frames.

10. **Interaction polish is not optional** — Every interactive element has explicit hover, active, focus, and disabled states. Animations use custom easing curves and respect motion tokens. Buttons give press feedback. Forms use structured layouts (FieldRow, FormGrid), never unstyled vertical stacks. See [interaction-polish.md](references/interaction-polish.md) for the full framework.

## Project Structure

Feature-first layout:

```
src/
  app/
    entry                   # Application bootstrap
    router                  # Route tree definition
    providers               # Top-level providers (i18n, telemetry, auth, etc.)
    layout/
      root-layout
      app-shell-layout

  features/
    feature-a/
    feature-b/
    shared-shell/           # Nav, sidebar, top bar, shell layout

  shared/
    ui/
      primitives/           # Vendored or wrapped accessible component library
      components/           # Project-level components built on primitives
    hooks/                  # Generic hooks, not domain-specific
    api/                    # Shared API client and cross-cutting API helpers
    lib/                    # Pure utilities without framework dependencies
    types/                  # Cross-cutting types only when truly needed

  i18n/                     # Internationalization setup and resources

  styles/
    globals                 # Global style layers and overrides
    tokens                  # Design tokens as variables
```

Rules:
- `features/*` contains domain and UX logic for a capability
- `shared/*` contains reusable, domain-neutral code
- `app/*` only composes features and shared pieces
- No feature imports another feature's subfolders — only public exports from barrel file
- No feature imports a third-party rendering library directly — only project-owned wrappers

## Composition Root

### Entry Point

Responsibilities: create app root, wrap with providers, provide router. Prohibited: business logic, API calls, feature-specific imports beyond route registration.

### Providers

Single place for cross-cutting providers: i18n, auth context, telemetry, toast/modal roots, streaming client. No business logic.

### Router

The router file owns the route tree. Route modules live inside their owning feature. Each route defines its loader, mutation handler, component, and error boundary. Presentational components receive data via props from route-level containers — they do not call router data hooks directly.

## Feature Module Structure

```
features/<feature>/
  index                     # Public surface (barrel file)
  routes/
    <n>-route
  components/
    *.component
  api/
    *-client
  hooks/
    use-something
  types/
    *.types
```

Only the barrel file should be imported from outside the feature. Importing internal components, hooks, or API clients from another feature is forbidden.

For details, see [feature-modules.md](references/feature-modules.md).

## Key Reference Documents

| Topic | Reference |
|-------|-----------|
| Feature modules and API clients | [feature-modules.md](references/feature-modules.md) |
| State management and data flow | [state-management.md](references/state-management.md) |
| Design system, UI layers, styling | [design-system.md](references/design-system.md) |
| Third-party library wrapping | [third-party-wrapping.md](references/third-party-wrapping.md) |
| Validation and safety policy | [validation-policy.md](references/validation-policy.md) |
| Streaming and progressive UX | [streaming-ux.md](references/streaming-ux.md) |
| Testing strategy and E2E with real backend | [testing-strategy.md](references/testing-strategy.md) |
| Telemetry and observability | [telemetry.md](references/telemetry.md) |
| Common frontend design decision trees | [design-decisions.md](references/design-decisions.md) |
| UX review and audit workflow | [ux-review-workflow.md](references/ux-review-workflow.md) |
| Interaction polish, animation, and UX drift prevention | [interaction-polish.md](references/interaction-polish.md) |

## Internationalization

- URL path segment is the source of truth for locale (e.g., `/en/app/home`)
- A layout component at the locale level parses, normalizes, redirects, switches language, sets document lang attribute
- Features consume translations through the i18n system, never switch locale directly
- Translation resources are namespaced by feature

## Error Handling and Loading

### Route Errors

Each logical section gets an error boundary at the route level. Error boundaries: user-friendly message, recovery action (retry, reload, navigate back), optional debug identifier in non-production.

### Loading States

- Full-page loading for initial application loads
- Skeleton components for table, card, panel loading
- Inline spinners only for localized, in-place feedback
- Stage-based skeletons matching the streaming stage model for progressive content

## Evolution

This architecture evolves when:
- A repeated pattern appears in three or more features
- Existing rules block a clearly better, simpler solution
- Backend changes affect contracts or cross-module dependencies

Changes should be intentional, reviewed, and applied in code within the same iteration. Architecture documents that drift from the actual codebase are worse than no documents.
