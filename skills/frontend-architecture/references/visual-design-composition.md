# Visual Design & Composition

Rules, patterns, and anti-patterns for visual hierarchy, hero composition, brand presence, imagery, landing pages, and card usage. Applies to marketing sites, landing pages, branded surfaces, and any visually-led frontend work.

For app/product UI composition, see [design-system.md](design-system.md).
For interaction animation, see [interaction-polish.md](interaction-polish.md).
For scroll-linked and marketing motion, see [page-motion.md](page-motion.md).

> Source: distilled from OpenAI's "Designing Delightful Frontends" guide (2026) and production frontend review patterns.

## Pre-Build Working Model

Before building any visually-led page, write three things:

1. **Visual thesis** — one sentence describing mood, material, and energy.
   _Example: "Warm analog textures, editorial typography, calm and grounded."_
2. **Content plan** — hero → support → detail → final CTA.
   _What goes in each section, in one line each._
3. **Interaction thesis** — 2–3 motion ideas that change the feel of the page.
   _Example: "Parallax hero image, staggered section reveals on scroll, hover lift on feature cards."_

Each section gets **one job**, one dominant visual idea, and one primary takeaway or action. If a section has two jobs, split it.

## Hero Composition

The first viewport is the most important design surface. Treat it as a **poster**, not a document.

### Hero Budget

The first viewport should usually contain only:
- Brand or product name (hero-level signal, not just nav text)
- One headline
- One short supporting sentence
- One CTA group
- One dominant image or visual

Avoid placing in the first viewport: stats, schedules, event listings, address blocks, promos, "this week" callouts, metadata rows, or secondary marketing content.

### Full-Bleed Rule

On branded landing pages and promotional surfaces, the hero image should be a **dominant edge-to-edge visual plane or background** by default.

- The hero itself must run edge-to-edge with no inherited page gutters, framed container, or shared `max-width`
- Constrain only the inner text/action column
- Do not use inset hero images, side-panel hero images, rounded media cards, tiled collages, or floating image blocks unless the existing design system clearly requires it

### Brand Hierarchy

- The brand or product name must be a hero-level signal, not just nav text or an eyebrow
- No headline should overpower the brand on branded pages
- **Brand test**: If the first viewport could belong to another brand after removing the nav, the branding is too weak
- **Image test**: If the first viewport still works after removing the image, the image is too weak

### Hero — What to Avoid

| Element | Placement | Why it fails |
|---------|-----------|-------------|
| Detached labels, floating badges, promo stickers | On top of hero media | Competes with the dominant image; breaks composition |
| Cards of any kind | Inside the hero | Hero is a composition, not a container |
| Stat strips or logo clouds | First viewport | Splits attention; violates hero budget |
| Pill clusters or floating dashboards | First viewport | Visual clutter; belongs in product UI, not hero |
| Split-screen hero | Unless text sits on a calm, unified side | Text needs a stable, contrast-safe zone |

### Viewport Budget for Sticky Headers

If the first screen includes a sticky/fixed header, that header counts against the hero. The combined header + hero content must fit within the initial viewport at common desktop and mobile sizes.

When using `100vh`/`100svh` heroes:
```css
/* Subtract persistent UI chrome */
height: calc(100svh - var(--header-height));
/* Or overlay the header instead of stacking it in normal flow */
```

## Landing Page Structure

Default narrative sequence for marketing pages:

| # | Section | Purpose |
|---|---------|---------|
| 1 | **Hero** | Establish identity and promise. Brand + headline + CTA + dominant visual. |
| 2 | **Support** | One concrete feature, offer, or proof point. |
| 3 | **Detail** | Atmosphere, workflow, product depth, or story. |
| 4 | **Social proof** | Establish credibility (testimonials, logos, metrics). |
| 5 | **Final CTA** | Convert interest into action. |

Rules:
- No more than six sections total
- One H1 headline per page
- Two typefaces maximum
- One accent color
- One primary CTA above the fold

## Card Philosophy

**Default: no cards.** Use sections, columns, dividers, lists, and media blocks instead.

Cards are allowed **only** when they are the container for a user interaction (clickable card, selectable option, draggable item). If removing a border, shadow, background, or radius does not hurt interaction or understanding, it should not be a card.

**Never use cards in the hero.**

### When Cards Are Appropriate

| Context | Card? | Why |
|---------|-------|-----|
| Clickable navigation tile (e.g., dashboard shortcut) | ✅ Yes | Card IS the interaction |
| Selectable option in a grid (e.g., plan picker) | ✅ Yes | Card IS the interaction |
| Draggable kanban item | ✅ Yes | Card IS the interaction |
| Content section on a landing page | ❌ No | Use layout (sections, columns) |
| Feature showcase | ❌ No | Use media blocks or columns |
| Stats display | ❌ No | Use inline text or data rows |
| Hero content | ❌ Never | Hero is a composition, not a container |

## Imagery

Imagery must do **narrative work** — it should show the product, place, atmosphere, or context. Decorative gradients and abstract backgrounds do not count as the main visual idea.

### Image Rules

- Use at least one strong, real-looking image for brands, venues, editorial pages, and lifestyle products
- Prefer in-situ photography over abstract gradients or fake 3D objects
- Choose or crop images with a stable tonal area for text overlay
- Do not use images with embedded signage, logos, or typographic clutter fighting the UI
- Do not generate images with built-in UI frames, splits, cards, or panels
- If multiple moments are needed, use multiple images, not one collage
- All text over imagery must maintain strong contrast and clear tap targets

### Image Prompting (for AI-generated assets)

When using image generation tools:
- Explicitly describe desired attributes: style, color palette, composition, mood
- Generate a mood board or several options before selecting final assets
- Reuse previously generated images when possible
- Do not reference or link to web images unless explicitly requested

## Typography

- Use expressive, purposeful fonts — avoid default stacks (Inter, Roboto, Arial, system-ui) for branded/marketing work
- Two typefaces maximum without a clear reason for more
- **Exception**: Product/app UI may use system or standard UI fonts when the design system specifies them

## Color & Visual Direction

- Choose a clear visual direction; define CSS variables
- Avoid purple-on-white defaults — no purple bias or dark mode bias
- Don't rely on flat, single-color backgrounds; use gradients, images, or subtle patterns to build atmosphere
- One accent color unless the product already has a strong multi-color system

## Copy Principles for Visual Pages

- Write in product language, not design commentary
- Let the headline carry the meaning
- Supporting copy: usually one short sentence
- Cut repetition between sections
- Do not include prompt language or design commentary in the UI
- Give every section one responsibility: explain, prove, deepen, or convert
- **If deleting 30% of the copy improves the page, keep deleting**

## Visual Quality Litmus Checks

Use these after building any visually-led page:

| Check | Question |
|-------|----------|
| **Brand** | Is the brand or product unmistakable in the first screen? |
| **Visual anchor** | Is there one strong visual anchor (not just decorative texture)? |
| **Scannability** | Can the page be understood by scanning headlines only? |
| **Section focus** | Does each section have exactly one job? |
| **Card necessity** | Are cards actually necessary, or can layout replace them? |
| **Motion value** | Does motion improve hierarchy or atmosphere (not just exist)? |
| **Chrome test** | Would the design still feel premium if all decorative shadows were removed? |
| **Brand test** | If the first viewport could belong to another brand after removing the nav, is branding too weak? |
| **Image test** | If the first viewport still works after removing the image, is the image too weak? |

## Common Visual Failures

When reviewing visual output, check for these patterns and their fixes:

| Failure | Why it happens | Better alternative |
|---------|---------------|-------------------|
| Generic SaaS card grid as the first impression | Default pattern from training data | Full-bleed hero with one composition |
| Beautiful image with weak brand presence | Brand is only in the nav | Make brand name hero-level |
| Strong headline with no clear action | Missing or buried CTA | Pair every headline with one clear CTA |
| Busy imagery behind text | Poor image crop or no tonal area | Choose/crop images with calm text zones |
| Sections that repeat the same mood statement | Copy drift without section jobs | Assign one job per section: explain, prove, deepen, or convert |
| Carousel with no narrative purpose | Decorative filler | Remove, or make each slide advance a story beat |
| App UI made entirely of stacked cards | Cards used as default layout | Replace with sections, columns, lists, media blocks |
| Boxed or center-column hero when brief calls for full bleed | Inherited `max-width` constraints | Hero runs edge-to-edge; only inner text column is constrained |
| Filler copy that says nothing specific | Placeholder habits | Cut until every word earns its place |

## Existing Design System Exception

When working within an existing website or design system, **preserve the established patterns, structure, and visual language**. These rules apply to new builds and redesigns, not to incremental changes within an established system.
