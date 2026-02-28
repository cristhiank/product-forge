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
