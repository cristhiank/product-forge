# Page Motion & Scroll Effects

Motion patterns for marketing pages, landing pages, and visually-led surfaces. Covers scroll-linked animation, hero entrance sequences, sticky storytelling, and library-specific guidance.

For **app UI animation** (buttons, popovers, toasts, drawers, transitions), see [interaction-polish.md](interaction-polish.md).
For **motion tokens and easing curves**, see [design-system.md](design-system.md).

> The split: `interaction-polish.md` governs motion users see hundreds of times a day in product UI. This document governs motion users see once per visit on marketing/visual pages — where delight and atmosphere matter more than raw speed.

## When This Applies

Use page motion when:
- Building a landing page, marketing site, or promotional surface
- The task is visually-led (art direction matters more than component count)
- The brief mentions "atmosphere," "premium feel," "delight," or "storytelling"

Skip page motion when:
- Building a dashboard, admin tool, or data-heavy product UI
- The page is operational (status, metrics, configuration)
- Users visit the page hundreds of times (motion becomes noise)

## Motion Budget

Ship at least **2–3 intentional motions** for visually-led work:

1. **One entrance sequence in the hero** — establishes presence and energy
2. **One scroll-linked, sticky, or depth effect** — creates spatial narrative
3. **One hover, reveal, or layout transition** — sharpens affordance and interactivity

If every section animates identically, the motion has no hierarchy. Vary intensity: hero is the loudest, middle sections are subtler, final CTA re-escalates.

## Hero Entrance Patterns

The hero entrance sets the tone for the entire page. Choose one approach:

### Staggered Reveal
Elements enter in sequence: background → image → headline → body → CTA.

```jsx
// Framer Motion example
const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } }
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.23, 1, 0.32, 1] } }
};

<motion.div variants={stagger} initial="hidden" animate="visible">
  <motion.h1 variants={fadeUp}>Headline</motion.h1>
  <motion.p variants={fadeUp}>Supporting text</motion.p>
  <motion.div variants={fadeUp}><CTA /></motion.div>
</motion.div>
```

### Scale-In Image
Hero image scales from slightly larger (1.05–1.1) to 1.0 while fading in. Creates a cinematic "landing" feel.

### Parallax Depth
Background image scrolls slower than foreground content. Use sparingly — one parallax layer per page maximum.

### Clip-Path Reveal
Image reveals through an expanding clip-path (circle, polygon, or inset). High-impact, use for bold brand statements.

## Scroll-Linked Effects

### Section Reveals on Scroll

Sections fade and slide into view as the user scrolls. The most common and safest scroll animation.

```jsx
// Framer Motion — section reveal on scroll
<motion.section
  initial={{ opacity: 0, y: 40 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, margin: "-100px" }}
  transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
>
  {children}
</motion.section>
```

Rules:
- Use `viewport.once: true` — sections should reveal once, not re-animate on every scroll pass
- Negative viewport margin triggers animation before the section is fully visible (feels more responsive)
- Keep `y` offset small (20–40px) — large offsets look like bugs

### Scroll-Linked Opacity and Scale

Elements fade, scale, or translate proportionally to scroll position. Good for hero images that dim as the user scrolls past.

```jsx
const { scrollYProgress } = useScroll();
const opacity = useTransform(scrollYProgress, [0, 0.3], [1, 0]);
const scale = useTransform(scrollYProgress, [0, 0.3], [1, 0.95]);

<motion.div style={{ opacity, scale }}>
  <HeroImage />
</motion.div>
```

### Sticky Storytelling

A section sticks while inner content transitions (text changes, images swap, progress advances). Creates a "scrollytelling" effect.

Use when:
- Explaining a multi-step process or product workflow
- Showing before/after or progression
- The narrative has 3–5 distinct beats

Implementation:
- Outer container has height proportional to number of beats (e.g., `height: 300vh` for 3 beats)
- Inner sticky element (`position: sticky; top: 0`) stays pinned
- Scroll progress drives which beat is active
- Crossfade between beats using opacity transitions

### Horizontal Scroll Sections

Content scrolls horizontally as the user scrolls vertically. High-impact but high-risk — use only when the content is a sequence (timeline, process, gallery).

Rules:
- Never trap the user — vertical scroll must resume naturally after the horizontal section
- Provide visual indicator that horizontal scrolling is happening
- Mobile: fall back to a standard vertical stack or swipeable carousel

## Hover and Reveal Effects

### Image Hover Lift
Cards or media blocks lift slightly on hover with a subtle shadow increase.

```css
@media (hover: hover) and (pointer: fine) {
  .media-block:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.08);
    transition: transform 300ms var(--ease-out), box-shadow 300ms var(--ease-out);
  }
}
```

### Content Reveal on Hover
Additional information (description, CTA) appears on hover over a media block. Keep hidden content minimal — if it's important, show it by default.

### Shared Layout Transitions
When navigating between related views (e.g., grid item → detail), animate the shared element (image, card frame) between positions using Framer Motion's `layoutId`.

```jsx
// Grid view
<motion.div layoutId={`item-${id}`}>
  <Image src={thumb} />
</motion.div>

// Detail view
<motion.div layoutId={`item-${id}`}>
  <Image src={full} />
  <DetailContent />
</motion.div>
```

## Library Guidance

### Framer Motion (Preferred for React)

Use Framer Motion when available for:
- Section reveals (`whileInView`)
- Shared layout transitions (`layoutId`)
- Scroll-linked opacity, translate, or scale shifts (`useScroll`, `useTransform`)
- Sticky storytelling (scroll progress → active beat)
- Carousels that advance narrative, not just fill space
- Menus, drawers, and modal presence effects

### CSS-Only Alternatives

When Framer Motion is unavailable:
- `@keyframes` + `animation-timeline: scroll()` for scroll-linked effects (modern browsers)
- `IntersectionObserver` + CSS classes for section reveals
- `position: sticky` + scroll event listeners for sticky storytelling
- CSS `transition` for hover effects (always preferred over JS for simple interactions)

### Performance Rules

- Scroll-linked JS animations must use `requestAnimationFrame` or `useTransform` (never raw scroll listeners updating state)
- Prefer `transform` and `opacity` — avoid animating `width`, `height`, `padding`, or `margin`
- Test on mobile — scroll-linked effects that feel smooth on desktop can jank on phones
- Respect `prefers-reduced-motion`: replace movement-based animations with simple opacity fades

## Motion Anti-Patterns

| Pattern | Problem | Fix |
|---------|---------|-----|
| Every section animates identically | No motion hierarchy — feels templated | Vary intensity: hero loud, middle subtle, CTA re-escalates |
| Animation replays on every scroll pass | Distracting on return visits | Use `viewport.once: true` |
| Large Y offset on scroll reveal (>60px) | Looks like broken layout, not animation | Keep offset to 20–40px |
| Horizontal scroll with no escape | User feels trapped | Ensure vertical scroll resumes naturally |
| Parallax on mobile | Jank and scroll hijacking | Disable parallax below tablet breakpoint |
| Motion for motion's sake | Noise, not hierarchy | Every animation must answer "why does this animate?" |
| Scroll-linked layout shifts | CLS penalty, jarring experience | Only animate `transform` and `opacity` |

## Motion Checklist

Before shipping a visually-led page, verify:

- [ ] Hero has an entrance sequence that sets the page's energy
- [ ] At least one scroll-linked or sticky effect creates spatial narrative
- [ ] At least one hover or reveal effect sharpens interactivity
- [ ] Motion is noticeable in a quick screen recording
- [ ] Motion is smooth on mobile (test on a real device or throttled emulation)
- [ ] Motion is fast and restrained (no gratuitous delays)
- [ ] Motion is consistent across the page (same easing, proportional timing)
- [ ] `prefers-reduced-motion` is respected
- [ ] No section re-animates on return scroll (unless intentional)
