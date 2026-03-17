# UX Review and Audit Workflow

Use this workflow when evaluating, auditing, or evolving a frontend application's UX. This covers the evaluation and design phase that precedes implementation.

## Phase 1: Gather Evidence

### 1.1 Product Context

Before looking at code, read the project's product spec and brand documents:
- Brand guidelines (voice, tone, archetype, core verbs)
- Color system / design tokens (color names, semantic roles, WCAG compliance)
- Target user personas and their primary tasks
- Key product principles and non-negotiables

These are **constraints**, not inspirations. Implementation must align with them.

### 1.2 Code Review

Perform a structured sweep of the frontend codebase:
- **Component inventory**: Count total components, shared vs feature-specific, reuse rate
- **Pattern consistency**: How many different loading patterns? Error handling approaches? Form implementations?
- **Token usage**: Are design tokens defined? Are they actually used, or are values hard-coded?
- **i18n coverage**: Are strings extracted? Any mixed-language content?
- **Accessibility basics**: Semantic HTML, ARIA usage, keyboard navigation, focus management

### 1.3 Live Inspection (Playwright)

Capture evidence from the running application:
- Screenshots at 3 viewports: mobile (375px), tablet (768px), desktop (1280px)
- Navigate all primary routes and key user flows
- Check for: loading states, error states, empty states, responsive behavior
- Run accessibility audit: h1 count per page, touch target sizes (≥44px), color contrast

**Auth tip**: If the app requires authentication, intercept API routes with mock data or reuse an existing authenticated session. Don't waste cycles capturing login pages.

## Phase 2: Evaluate

For each page or flow, assess against these dimensions:

| Dimension | What to check |
|-----------|--------------|
| **Brand alignment** | Does it match product spec voice, colors, and design principles? |
| **Component reuse** | How many one-off vs shared components? Copy-paste debt? |
| **Visual hierarchy** | Are important elements visually prominent? Is there a clear reading order? |
| **Responsive behavior** | Does it degrade gracefully or break? Is mobile an afterthought? |
| **Loading / error / empty** | Skeleton? Error boundary with recovery action? Empty state with CTA? |
| **Accessibility** | Keyboard navigable? Screen reader friendly? Touch targets adequate? |
| **Information density** | Appropriate for the user persona (professional dense vs consumer spacious)? |
| **Progressive disclosure** | Complex forms/settings broken into digestible sections? |
| **Interaction polish** | Button press feedback? Proper easing? No `transition: all`? Hover gated for touch? |
| **Form patterns** | FieldRow for settings? FormGrid for data entry? No unstyled vertical stacks? |

### Animation & Interaction Checks

During evaluation, specifically check for these common issues:

| Issue | Check | Fix |
|-------|-------|-----|
| `transition: all` | grep for `transition: all` or `transition:all` | Specify exact properties |
| Missing `:active` on buttons | Inspect button elements for `:active` rule | Add `scale(0.97)` feedback |
| Hover on touch devices | Check for hover styles without `@media (hover: hover)` | Gate behind media query |
| Animations >300ms | Check transition/animation durations | Reduce UI animations to 150–250ms |
| `ease-in` on UI elements | Check easing functions | Switch to `ease-out` or custom curve |
| Hard-coded animation values | grep for inline `300ms`, `ease`, without tokens | Use motion tokens |
| No `prefers-reduced-motion` | Check for reduced-motion media query | Add reduced-motion fallback |

### Review Output Format

When presenting UI review findings, always use a Before/After/Why table:

| Before | After | Why |
|--------|-------|-----|
| `padding: 24px` | `padding: var(--card-padding)` | Use design tokens, not hard-coded values |
| No loading state on page | Skeleton matching final content | Users need visual feedback during data fetch |
| Plain vertical form, 8 fields | FormGrid with 2-col responsive grid | Vertical stacks lack visual structure |

Never present findings as a list of "Before:" / "After:" on separate lines — always use a markdown table.

## Phase 3: Classify Findings

Organize findings into priority tiers:

### P0 — Bugs and Accessibility Failures
- Crashes, broken routes, data loss
- Accessibility violations (missing alt text, broken keyboard nav, contrast failures)
- i18n broken (wrong language, raw interpolation tokens visible)
- Brand violations visible to end users (wrong colors, off-brand voice)

### P1 — Structural / Foundation Issues
- Missing shared components (same pattern copy-pasted 5+ times)
- Inconsistent patterns (3 different loading approaches, mixed error handling)
- Missing design tokens (hard-coded colors/spacing throughout)
- Navigation or layout structural problems

### P2 — Polish and Enhancement
- Visual refinement (hover states, transitions, micro-interactions)
- Dark mode consistency
- Advanced accessibility (reduced motion, high contrast)
- Performance optimization (code splitting, lazy loading, image optimization)

## Phase 4: Produce Actionable Output

The evaluation should produce one of:

### Quick Assessment (for small reviews)
A prioritized list of findings with severity, affected files, and suggested fix approach.

### Phased Improvement Epic (for major reviews)
- Phase 0: P0 fixes (bugs, accessibility, brand violations)
- Phase 1: Foundation (shared components, tokens, structural patterns)
- Phase 2: Polish (visual refinement, motion, dark mode, performance)

Each item should include:
- Clear title and description
- Affected files or components
- Dependencies on other items
- Effort estimate (XS/S/M/L)

### Design Direction Exploration (for visual evolution)
When the current look and feel needs rethinking:
1. Document the current-state diagnosis (what specifically feels wrong and why)
2. Propose 2-3 concrete alternatives with different tradeoffs
3. Build a visual showcase (HTML mockup or Playwright comparison) for stakeholder review
4. Let the stakeholder choose before investing in implementation

## Phase 5: Implement Redesign

When the evaluation reveals structural problems that require a redesign (not just bug fixes), follow this phased workflow. Each phase has explicit entry criteria — do not skip ahead.

### 5.1 Test Harness (unblocked, start immediately)

Before changing any production code, ensure coverage exists for the flows you're about to rewrite:

- **Backend integration tests** — Full CRUD happy path for every entity type the UI manages. Confirms the API contract is correct independently of the frontend.
- **E2E tests (Playwright or equivalent)** — Cover the primary user flows: create, edit, delete, navigate between entities. These tests serve as regression safety nets during the rewrite.

Both can run in parallel. They test the *current* behavior, not the target state.

### 5.2 Fix Critical Bugs (blocked by 5.1)

Fix bugs identified in the assessment that affect data integrity or block primary flows. Do NOT redesign layout yet — fix within the existing structure.

**Why fix before redesign:**
- Bugs in the current code may mask API contract issues that would silently break the new UI
- Tests written in 5.1 should pass after bug fixes, confirming the API layer works
- Reduces variables when debugging the new layout (if something breaks, it's the layout change, not a pre-existing bug)

### 5.3 Layout Rewrite (blocked by 5.2)

Replace the page structure with the target layout. This is the highest-risk phase — it touches the most files.

**Approach:**
1. Build the new layout shell (e.g., master-detail container, entity sidebar, detail panel placeholder)
2. Migrate entity-specific content into the new shell, one entity type at a time
3. Consolidate duplicated API clients and hooks during migration (see [feature-modules.md](references/feature-modules.md) § API/Hook Consolidation)
4. Unify duplicated scope-specific views using a scope filter (see [design-decisions.md](references/design-decisions.md) § Scope/View Unification)

**Consolidation targets during layout rewrite:**
- Multiple API files per feature → single unified API client
- Multiple hooks wrapping the same data → single hook with scope/type parameters
- Duplicate components per scope (admin/user) → single component with scope prop

### 5.4 Section-by-Section Polish (blocked by 5.3)

With the new layout in place, polish each section independently:

- Detail panels for each entity type (fields, validation, conditional UI)
- Transport-conditional or type-conditional fields (show/hide based on entity subtype)
- Empty states, loading skeletons, error handling per section
- Interaction polish (hover, focus, press feedback per the interaction-polish spec)

These can often be parallelized across entity types since each section is independent.

### 5.5 Post-Implementation Review

After implementation, perform a targeted review:

- Run E2E tests against the new layout (update selectors if the UI structure changed)
- Verify that consolidated APIs still handle all edge cases per scope
- Check for business logic regressions (permissions, read-only states, scope boundaries)
- Review interaction states (hover, focus, disabled) on all new components

**Common post-redesign issues:**
- E2E test selectors targeting removed/renamed UI elements
- Read-only logic not accounting for all scope combinations
- Selection state bugs when entity names collide across scopes
- Optimistic UI that doesn't roll back on server failure

## Anti-Patterns to Avoid

- **Reviewing without evidence**: Don't critique UX from code alone. Always inspect the running app.
- **Boiling the ocean**: Don't try to fix everything in one pass. Phase it.
- **Ignoring product spec**: The brand guidelines are constraints, not optional. Check alignment first.
- **Generic advice**: "Improve accessibility" is not actionable. "Add aria-label to the 5 icon-only buttons in the sidebar" is.
- **Skipping empty states**: Every data-driven page needs an explicit empty state. This is the most commonly missed pattern.
- **Redesigning without tests**: Never rewrite a page that has no test coverage. Write tests for current behavior first (5.1), then rewrite.
- **Fixing bugs during redesign**: Fix bugs in the existing structure first (5.2). Mixing bug fixes with layout changes makes regressions impossible to attribute.
- **Patching instead of rewriting**: If the existing component doesn't match the target layout, rewrite it from the spec. Incremental patches on a structurally wrong component compound into unmaintainable drift.
