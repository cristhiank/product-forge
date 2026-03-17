# Interaction Polish & Animation

Principles, decision frameworks, and concrete patterns for making interfaces feel responsive, intentional, and polished. Applies to any SaaS or professional tool UI.

> "All those unseen details combine to produce something that's just stunning, like a thousand barely audible voices all singing in tune." — Paul Graham

Every decision here exists because invisible correctness compounds. Users never consciously notice a well-timed easing curve or a button that gives press feedback — but they notice the aggregate. Interfaces that get these details right feel "good" for reasons people can't articulate.

## The Animation Decision Framework

Before writing any animation, answer these questions in order:

### 1. Should this animate at all?

**How often will users see this animation?**

| Frequency | Decision |
|-----------|----------|
| 100+ times/day (keyboard shortcuts, command palette, toggle) | No animation. Ever. |
| Tens of times/day (hover effects, list navigation, tab switches) | Remove or drastically reduce (≤100ms) |
| Occasional (modals, drawers, toasts, panels) | Standard animation |
| Rare / first-time (onboarding, celebrations, feedback) | Can add delight |

Never animate keyboard-initiated actions. They are repeated hundreds of times daily. Animation makes them feel delayed and disconnected.

### 2. What is the purpose?

Every animation must answer "why does this animate?"

Valid purposes:
- **Spatial consistency** — toast enters and exits from the same direction
- **State indication** — a morphing button shows state change
- **Feedback** — button scales down on press, confirming the interface heard the user
- **Preventing jarring changes** — elements appearing without transition feel broken

If the purpose is "it looks cool" and the user sees it often — don't animate.

### 3. What easing should it use?

```
Is the element entering or exiting?
  → ease-out (starts fast, feels responsive)

Is it moving or morphing on screen?
  → ease-in-out (natural acceleration/deceleration)

Is it a hover or color change?
  → ease

Is it constant motion (progress bar, marquee)?
  → linear

Default → ease-out
```

**Use custom easing curves.** Built-in CSS easings are too weak — they lack the punch that makes animations feel intentional.

```css
/* Strong ease-out for UI interactions */
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);

/* Strong ease-in-out for on-screen movement */
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);

/* Drawer/sheet curve */
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
```

**Never use `ease-in` for UI animations.** It starts slow, making the interface feel sluggish. A dropdown with `ease-in` at 300ms *feels* slower than `ease-out` at the same duration.

### 4. How fast should it be?

| Element | Duration |
|---------|----------|
| Button press feedback | 100–160ms |
| Tooltips, small popovers | 125–200ms |
| Dropdowns, selects | 150–250ms |
| Modals, drawers, panels | 200–400ms |

**Rule: UI animations stay under 300ms.** A 180ms dropdown feels more responsive than a 400ms one. Faster perceived speed directly affects how users perceive your app's performance.

### 5. Specify exact properties

Never use `transition: all`. It animates properties you don't intend (padding, color, box-shadow) and causes jank on unrelated layout changes.

```css
/* Bad */
transition: all 300ms;

/* Good */
transition: transform 200ms var(--ease-out), opacity 200ms var(--ease-out);
```

## Component Interaction Patterns

### Buttons must feel responsive

Add `transform: scale(0.97)` on `:active`. This gives instant feedback — the UI feels like it's truly listening.

```css
.button {
  transition: transform 160ms var(--ease-out);
}
.button:active {
  transform: scale(0.97);
}
```

The scale should be subtle (0.95–0.98). Applies to any pressable element.

### Never animate from scale(0)

Nothing in the real world disappears and reappears. Start from `scale(0.95)` or higher, combined with opacity:

```css
/* Bad — appears from nothing */
.entering { transform: scale(0); }

/* Good — natural entrance */
.entering { transform: scale(0.95); opacity: 0; }
```

### Make popovers origin-aware

Popovers should scale from their trigger, not from center. **Exception: modals** — modals keep `transform-origin: center` because they're not anchored to a trigger.

```css
.popover {
  transform-origin: var(--radix-popover-content-transform-origin);
}
```

### Tooltips: skip delay on subsequent hovers

Delay before first tooltip to prevent accidental activation. Once one is open, adjacent tooltips open instantly with no animation:

```css
.tooltip[data-instant] {
  transition-duration: 0ms;
}
```

### Gate hover animations for touch devices

Touch devices trigger hover on tap, causing false positives:

```css
@media (hover: hover) and (pointer: fine) {
  .element:hover { transform: scale(1.02); }
}
```

### Asymmetric enter/exit timing

Deliberate actions (hold-to-delete) should be slow. System responses should be snappy. Slow where the user is deciding, fast where the system is responding.

## CSS Animation Performance

### Only animate transform and opacity

These skip layout and paint, running on the GPU. Animating `padding`, `margin`, `height`, or `width` triggers full rendering pipeline.

### CSS animations beat JavaScript under load

CSS animations run off the main thread. When the browser is busy loading content, JS-based animations (requestAnimationFrame) drop frames. CSS remains smooth. Use CSS for predetermined animations; JS for dynamic, interruptible ones.

### Avoid CSS variable updates during animation

Changing a CSS variable on a parent recalculates styles for all children. Update `transform` directly on the element:

```js
// Bad: triggers recalc on all children
element.style.setProperty('--offset', `${distance}px`);

// Good: only affects this element
element.style.transform = `translateY(${distance}px)`;
```

### Use Web Animations API for programmatic control

WAAPI gives JavaScript control with CSS performance — hardware-accelerated, interruptible, no library needed:

```js
element.animate(
  [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }],
  { duration: 400, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'forwards' }
);
```

### Use CSS transitions over keyframes for interruptible UI

Transitions can be interrupted and retargeted mid-animation. Keyframes restart from zero. For rapidly-triggered interactions (toasts, toggles), transitions produce smoother results.

## Accessibility for Motion

### prefers-reduced-motion

Reduced motion means fewer and gentler animations, not zero. Keep opacity and color transitions that aid comprehension. Remove movement and position animations.

```css
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; }
  .element { transition: opacity 200ms ease; /* no transform */ }
}
```

### Touch target compliance

Minimum 44px × 44px for all interactive elements on mobile. Use `min-h-11 flex items-center` to achieve without inflating visual padding. Exception: small close/action icons in tight layouts can be 32px if necessary.

## Stagger Animations

When multiple elements enter together, stagger their appearance with 30–80ms delays between items. This creates a cascading effect that feels more natural than everything appearing simultaneously.

Keep stagger delays short. Long delays make the interface feel slow. Never block interaction while stagger animations play.

## Common UX Drift Patterns

These patterns appear repeatedly when AI agents build UI without strong guardrails. Each is a documented anti-pattern from real implementation sessions:

### Tables overflow containers

**Symptom**: Horizontal scrollbar appears, table extends beyond viewport.
**Root cause**: Agent adds too many visible columns without constraining table width.
**Prevention**: Always set `overflow-x: auto` on table containers. Default to showing 3-5 key columns on desktop, fewer on mobile. Use `table-layout: fixed` or explicit column widths when column count exceeds 5.

### Forms rendered as unstyled vertical stacks

**Symptom**: Plain vertical form with no visual structure — just labels and inputs stacked top to bottom.
**Root cause**: Agent defaults to the simplest layout without applying the FieldRow or FormGrid pattern.
**Prevention**: Never render 4+ fields as a plain vertical stack. Settings forms use FieldRow (label LEFT, control RIGHT). Data entry forms use FormGrid (responsive grid, label ABOVE input). Always check which pattern applies.

### Agent ignores compact density spec

**Symptom**: Consumer-style generous padding/spacing in a professional tool context.
**Root cause**: Agent uses default spacing values rather than the compact tokens defined in the design system.
**Prevention**: When building professional/admin UI, always use the compact spacing tokens (field-gap: 0.5rem, section-gap: 1.5rem). Check the design system tokens file before writing CSS.

### Tabs don't match reference design

**Symptom**: Tabs render as default browser-style or minimal unstyled tabs when the spec shows a specific design.
**Root cause**: Agent doesn't inspect the HTML reference mockup provided in the product spec.
**Prevention**: Always check for HTML reference mockups in the product spec. Compare your output visually (Playwright screenshot) against the reference. If they don't match, rewrite — don't patch.

### "Soft adjustments" instead of rewrites

**Symptom**: Agent tweaks individual CSS values on broken UI instead of rebuilding from the spec.
**Root cause**: Agent optimizes for minimal diff rather than correct output.
**Prevention**: If the existing component doesn't follow the spec, rewrite it from the spec — don't adjust what's broken. Small patches compound into unmaintainable drift.

### Navigation state bugs

**Symptom**: Sidebar menu hides on selection, collapsed state isn't persisted, active item not highlighted.
**Root cause**: Missing state management for selection and collapse.
**Prevention**: Sidebar must track: active route (derived from URL), collapsed/expanded (persisted to localStorage), mobile open/closed (sheet-based).

## UI Polish Review Checklist

When reviewing UI code, use a Before/After/Why table:

| Before | After | Why |
|--------|-------|-----|
| `transition: all 300ms` | `transition: transform 200ms var(--ease-out)` | Specify exact properties; avoid `all` |
| `transform: scale(0)` | `transform: scale(0.95); opacity: 0` | Nothing appears from nothing |
| `ease-in` on dropdown | `ease-out` with custom curve | `ease-in` feels sluggish; `ease-out` gives instant feedback |
| No `:active` state on button | `transform: scale(0.97)` on `:active` | Buttons must feel responsive to press |
| `transform-origin: center` on popover | `transform-origin: var(--popover-origin)` | Popovers scale from trigger, modals stay centered |
| Duration >300ms on UI element | Reduce to 150–250ms | UI animations must feel instant |
| Hover animation without media query | `@media (hover: hover) and (pointer: fine)` | Touch devices trigger false hover states |
| Keyframes on rapidly-triggered element | CSS transitions | Transitions are interruptible; keyframes restart |
| Same enter/exit speed | Make exit faster than enter | Slow where deciding, fast where responding |
| All items appear simultaneously | Stagger delay 30–80ms between items | Cascading entrance feels more natural |
| Plain vertical form with 6+ fields | FieldRow or FormGrid pattern | Vertical stacks lack visual structure |
| Table exceeding viewport width | `overflow-x: auto`, max 5 visible columns | Tables must respect container boundaries |
| Consumer spacing in admin tool | Compact tokens (0.5rem field gap) | Professional tools use dense layouts |
