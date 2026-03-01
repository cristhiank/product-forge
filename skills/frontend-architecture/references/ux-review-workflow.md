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

## Anti-Patterns to Avoid

- **Reviewing without evidence**: Don't critique UX from code alone. Always inspect the running app.
- **Boiling the ocean**: Don't try to fix everything in one pass. Phase it.
- **Ignoring product spec**: The brand guidelines are constraints, not optional. Check alignment first.
- **Generic advice**: "Improve accessibility" is not actionable. "Add aria-label to the 5 icon-only buttons in the sidebar" is.
- **Skipping empty states**: Every data-driven page needs an explicit empty state. This is the most commonly missed pattern.
