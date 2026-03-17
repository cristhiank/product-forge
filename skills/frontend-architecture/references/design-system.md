# Design System, UI Layers, and Styling

## Layered Component Architecture

The UI is organized in three layers:

### 1. Primitives

Accessible, domain-neutral components from a component library, vendored or wrapped into `shared/ui/primitives`. Treated as project-owned code. When modifying, keep accessibility behavior intact.

### 2. Project-Level Components

Built on top of primitives in `shared/ui/components`. Capture recurring layout and behavior patterns, enforce consistent spacing, sizing, and responsive breakpoints. Remain domain-neutral.

### 3. Feature-Specific Components

Domain-specific UI that lives inside the owning feature, not in the shared layer.

### Rules

- Features default to using project-level components, not raw primitives, for shared patterns
- Domain-specific components live inside the feature, not in the shared UI layer

## Styling Discipline

Regardless of the styling approach chosen (utility-first CSS, CSS modules, CSS-in-JS):

- Define design tokens (colors, radii, shadows, typography, motion) as variables in a central file
- Components consume tokens, never hard-coded values
- If a new token is needed, add it to the token system first, then use it
- Avoid global selectors that override scoped or utility-based styles

## Design System Principles

These apply regardless of visual identity:

- **Surface hierarchy** — A small, fixed number of surface levels (typically 2–3). Refactor hierarchy rather than adding levels.
- **Borders as functional indicators** — Use borders for interactive states (focus, selection, hover, error, drag target), not static decoration. Separate regions using tonal steps, shadows, and spacing.
- **Progressive disclosure of chrome** — UI controls (action menus, drag handles, resize handles) appear on interaction, not by default. Clean at rest, informative on engagement.
- **Consistent motion** — Small set of timing tokens (fast, normal, slow) used consistently. Motion replaces ornament for conveying state changes.
- **Data density when appropriate** — For professional or analytical interfaces, tighter vertical rhythm and denser layouts are preferable to consumer-app padding. Match density to the user's task.

## Panel and Layout Patterns

For multi-panel layouts:
- Subtle, IDE-style splitters rather than thick dividers or nested card-in-card patterns
- Splitters become more visible on hover to indicate interactivity
- Avoid deep nesting of elevated surfaces

For overlay elements (dropdowns, command palettes, popovers):
- Overlays may use distinct visual treatments (blur, transparency) to differentiate from primary surfaces
- Reserve these treatments strictly for floating elements, never for primary panels or content areas

## Motion Tokens

Define a small, fixed set of motion tokens consumed by all components. Never hard-code easing or duration values inline.

```css
/* Easing */
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);        /* UI interactions */
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);     /* On-screen movement */
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);       /* Drawers and sheets */

/* Duration */
--duration-fast: 150ms;      /* Button feedback, tooltips */
--duration-normal: 200ms;    /* Dropdowns, selects, popovers */
--duration-slow: 350ms;      /* Modals, drawers, page transitions */
```

Rules:
- Components consume motion tokens, never hard-coded `300ms ease` values
- UI animations stay under 300ms — a 180ms dropdown feels faster than a 400ms one
- Always use `ease-out` for elements entering or exiting
- Never use `ease-in` for UI — it starts slow and feels sluggish
- Respect `prefers-reduced-motion` — reduce or remove transform-based motion

For the full animation decision framework, see [interaction-polish.md](references/interaction-polish.md).

## Spacing and Density System

Professional admin/SaaS tools use **compact density** by default. Consumer and onboarding flows may use standard density.

| Token | Compact | Standard | Usage |
|-------|---------|----------|-------|
| `--field-gap` | 0.5rem (8px) | 1rem (16px) | Between form fields in a section |
| `--section-gap` | 1.5rem (24px) | 2rem (32px) | Between major page sections |
| `--card-padding` | 1rem (16px) | 1.5rem (24px) | Internal padding of cards/panels |
| `--page-padding` | 1.5rem (24px) | 2rem (32px) | Page-level horizontal padding |

Rules:
- Default to compact density for desktop admin/operational interfaces
- Use standard density only for onboarding, mobile, and consumer-facing flows
- Components consume spacing tokens, never hard-coded padding/margin values
- If a new spacing value is needed, add it to the token system first

## Interaction States

Every interactive element must have explicit states:

| State | Visual Signal | Requirement |
|-------|--------------|-------------|
| **Default** | Resting appearance | Always defined |
| **Hover** | Subtle background change or lift | Gate behind `@media (hover: hover)` |
| **Active/Pressed** | Scale down (0.97) or color shift | Immediate feedback, <100ms |
| **Focus** | Visible focus ring (2px offset) | Keyboard accessibility, never remove |
| **Disabled** | Reduced opacity (0.5), no pointer events | Visually distinct from enabled |
| **Loading** | Spinner icon swap, disabled, text change | Never leave button active during async |

## Page Architecture Patterns

Every data-fetching page follows a three-state shell:

```
IF loading → render full skeleton (shape matches final content)
ELSE IF error → render header + ErrorBanner (role="alert") + optional retry
ELSE → render header + content sections
```

Rules:
- Never use a spinner for page-level initial loading — always skeleton
- Skeleton shapes must match final content (cards → card grid skeleton, table → table skeleton)
- Error banner sits immediately after the page header, not in a modal
- Every data-driven list must have an explicit empty state (icon + title + CTA)
