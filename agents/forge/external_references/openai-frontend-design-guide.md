# OpenAI: Designing Delightful Frontends with GPT-5.4

> **Source**: <https://developers.openai.com/blog/designing-delightful-frontends-with-gpt-5-4>
> **Retrieved**: 2026-03-22
> **Relevance**: Prompt engineering for high-quality frontend generation. Directly applicable to Forge's `frontend-design` skill, `frontend-architecture` skill, and any mode that spawns frontend work (execute, design, ideate).

---

## TL;DR

When prompts are underspecified, models fall back to high-frequency training patterns — producing plausible but generic UIs. The fix: **clear design constraints, visual references, structured narratives, and defined design systems**. This guide captures OpenAI's official techniques and two production-ready system prompts.

---

## Key Model Capabilities (GPT-5.4, applicable to frontier models generally)

1. **Stronger image understanding** — can generate/analyze mood boards, use image search & generation tools natively. Instruct the model to create visual options *before* selecting final assets.
2. **More functionally complete apps** — more reliable over long-horizon tasks; complex games and experiences achievable in 1-2 turns.
3. **Computer Use & Verification** — first mainline model trained for computer use. Playwright integration enables inspecting rendered pages, testing viewports, navigating flows, detecting state/navigation issues, and **visually verifying** output against reference UI.

---

## Practical Tips Quickstart

> Adopt these four practices as a minimum:

1. **Select low reasoning level** to begin with — more reasoning is not always better for frontend; low/medium often yield stronger results.
2. **Define your design system and constraints upfront** — typography, color palette, layout rules.
3. **Provide visual references or a mood board** — attach screenshots to provide visual guardrails.
4. **Define a narrative or content strategy upfront** — guide the model's content creation with structure.

---

## Prompt 1: Frontend Task Hard Rules

> Use as a system-level instruction block for any frontend generation task. Prevents the most common failure modes (generic layouts, card soup, weak branding, purple-on-white defaults).

```
## Frontend tasks

When doing frontend design tasks, avoid generic, overbuilt layouts.

**Use these hard rules:**
- One composition: The first viewport must read as one composition, not a dashboard (unless it's a dashboard).
- Brand first: On branded pages, the brand or product name must be a hero-level signal, not just nav text or an eyebrow. No headline should overpower the brand.
- Brand test: If the first viewport could belong to another brand after removing the nav, the branding is too weak.
- Typography: Use expressive, purposeful fonts and avoid default stacks (Inter, Roboto, Arial, system).
- Background: Don't rely on flat, single-color backgrounds; use gradients, images, or subtle patterns to build atmosphere.
- Full-bleed hero only: On landing pages and promotional surfaces, the hero image should be a dominant edge-to-edge visual plane or background by default. Do not use inset hero images, side-panel hero images, rounded media cards, tiled collages, or floating image blocks unless the existing design system clearly requires it.
- Hero budget: The first viewport should usually contain only the brand, one headline, one short supporting sentence, one CTA group, and one dominant image. Do not place stats, schedules, event listings, address blocks, promos, "this week" callouts, metadata rows, or secondary marketing content in the first viewport.
- No hero overlays: Do not place detached labels, floating badges, promo stickers, info chips, or callout boxes on top of hero media.
- Cards: Default: no cards. Never use cards in the hero. Cards are allowed only when they are the container for a user interaction. If removing a border, shadow, background, or radius does not hurt interaction or understanding, it should not be a card.
- One job per section: Each section should have one purpose, one headline, and usually one short supporting sentence.
- Real visual anchor: Imagery should show the product, place, atmosphere, or context. Decorative gradients and abstract backgrounds do not count as the main visual idea.
- Reduce clutter: Avoid pill clusters, stat strips, icon rows, boxed promos, schedule snippets, and multiple competing text blocks.
- Use motion to create presence and hierarchy, not noise. Ship at least 2-3 intentional motions for visually led work.
- Color & Look: Choose a clear visual direction; define CSS variables; avoid purple-on-white defaults. No purple bias or dark mode bias.
- Ensure the page loads properly on both desktop and mobile.
- For React code, prefer modern patterns including useEffectEvent, startTransition, and useDeferredValue when appropriate if used by the team. Do not add useMemo/useCallback by default unless already used; follow the repo's React Compiler guidance.

Exception: If working within an existing website or design system, preserve the established patterns, structure, and visual language.
```

---

## Prompt 2: Frontend Skill (Full System Prompt)

> A comprehensive skill prompt for visually-led frontend work. Covers landing pages, apps, imagery, copy, motion, and hard failure rejection patterns. Use as a skill definition or inject into the system prompt for design-heavy tasks.

```
---
name: frontend-skill
description: Use when the task asks for a visually strong landing page, website, app, prototype, demo, or game UI. This skill enforces restrained composition, image-led hierarchy, cohesive content structure, and tasteful motion while avoiding generic cards, weak branding, and UI clutter.
---

# Frontend skill

Use this skill when the quality of the work depends on art direction, hierarchy, restraint, imagery, and motion rather than component count.

Goal: ship interfaces that feel deliberate, premium, and current. Default toward award-level composition: one big idea, strong imagery, sparse copy, rigorous spacing, and a small number of memorable motions.

## Working Model

Before building, write three things:

- visual thesis: one sentence describing mood, material, and energy
- content plan: hero, support, detail, final CTA
- interaction thesis: 2-3 motion ideas that change the feel of the page

Each section gets one job, one dominant visual idea, and one primary takeaway or action.

## Beautiful Defaults

- Start with composition, not components.
- Prefer a full-bleed hero or full-canvas visual anchor.
- Make the brand or product name the loudest text.
- Keep copy short enough to scan in seconds.
- Use whitespace, alignment, scale, cropping, and contrast before adding chrome.
- Limit the system: two typefaces max, one accent color by default.
- Default to cardless layouts. Use sections, columns, dividers, lists, and media blocks instead.
- Treat the first viewport as a poster, not a document.

## Landing Pages

Default sequence:

1. Hero: brand or product, promise, CTA, and one dominant visual
2. Support: one concrete feature, offer, or proof point
3. Detail: atmosphere, workflow, product depth, or story
4. Final CTA: convert, start, visit, or contact

Hero rules:

- One composition only.
- Full-bleed image or dominant visual plane.
- Canonical full-bleed rule: on branded landing pages, the hero itself must run edge-to-edge with no inherited page gutters, framed container, or shared max-width; constrain only the inner text/action column.
- Brand first, headline second, body third, CTA fourth.
- No hero cards, stat strips, logo clouds, pill soup, or floating dashboards by default.
- Keep headlines to roughly 2-3 lines on desktop and readable in one glance on mobile.
- Keep the text column narrow and anchored to a calm area of the image.
- All text over imagery must maintain strong contrast and clear tap targets.

If the first viewport still works after removing the image, the image is too weak. If the brand disappears after hiding the nav, the hierarchy is too weak.

Viewport budget:

- If the first screen includes a sticky/fixed header, that header counts against the hero. The combined header + hero content must fit within the initial viewport at common desktop and mobile sizes.
- When using `100vh`/`100svh` heroes, subtract persistent UI chrome (`calc(100svh - header-height)`) or overlay the header instead of stacking it in normal flow.

## Apps

Default to Linear-style restraint:

- calm surface hierarchy
- strong typography and spacing
- few colors
- dense but readable information
- minimal chrome
- cards only when the card is the interaction

For app UI, organize around:

- primary workspace
- navigation
- secondary context or inspector
- one clear accent for action or state

Avoid:

- dashboard-card mosaics
- thick borders on every region
- decorative gradients behind routine product UI
- multiple competing accent colors
- ornamental icons that do not improve scanning

If a panel can become plain layout without losing meaning, remove the card treatment.

## Imagery

Imagery must do narrative work.

- Use at least one strong, real-looking image for brands, venues, editorial pages, and lifestyle products.
- Prefer in-situ photography over abstract gradients or fake 3D objects.
- Choose or crop images with a stable tonal area for text.
- Do not use images with embedded signage, logos, or typographic clutter fighting the UI.
- Do not generate images with built-in UI frames, splits, cards, or panels.
- If multiple moments are needed, use multiple images, not one collage.

The first viewport needs a real visual anchor. Decorative texture is not enough.

## Copy

- Write in product language, not design commentary.
- Let the headline carry the meaning.
- Supporting copy should usually be one short sentence.
- Cut repetition between sections.
- do not include prompt language or design commentary into the UI
- Give every section one responsibility: explain, prove, deepen, or convert.

If deleting 30 percent of the copy improves the page, keep deleting.

## Utility Copy For Product UI

When the work is a dashboard, app surface, admin tool, or operational workspace, default to utility copy over marketing copy.

- Prioritize orientation, status, and action over promise, mood, or brand voice.
- Start with the working surface itself: KPIs, charts, filters, tables, status, or task context. Do not introduce a hero section unless the user explicitly asks for one.
- Section headings should say what the area is or what the user can do there.
- Good: "Selected KPIs", "Plan status", "Search metrics", "Top segments", "Last sync".
- Avoid aspirational hero lines, metaphors, campaign-style language, and executive-summary banners on product surfaces unless specifically requested.
- Supporting text should explain scope, behavior, freshness, or decision value in one sentence.
- If a sentence could appear in a homepage hero or ad, rewrite it until it sounds like product UI.
- If a section does not help someone operate, monitor, or decide, remove it.
- Litmus check: if an operator scans only headings, labels, and numbers, can they understand the page immediately?

## Motion

Use motion to create presence and hierarchy, not noise.

Ship at least 2-3 intentional motions for visually led work:

- one entrance sequence in the hero
- one scroll-linked, sticky, or depth effect
- one hover, reveal, or layout transition that sharpens affordance

Prefer Framer Motion when available for:

- section reveals
- shared layout transitions
- scroll-linked opacity, translate, or scale shifts
- sticky storytelling
- carousels that advance narrative, not just fill space
- menus, drawers, and modal presence effects

Motion rules:

- noticeable in a quick recording
- smooth on mobile
- fast and restrained
- consistent across the page
- removed if ornamental only

## Hard Rules

- No cards by default.
- No hero cards by default.
- No boxed or center-column hero when the brief calls for full bleed.
- No more than one dominant idea per section.
- No section should need many tiny UI devices to explain itself.
- No headline should overpower the brand on branded pages.
- No filler copy.
- No split-screen hero unless text sits on a calm, unified side.
- No more than two typefaces without a clear reason.
- No more than one accent color unless the product already has a strong system.

## Reject These Failures

- Generic SaaS card grid as the first impression
- Beautiful image with weak brand presence
- Strong headline with no clear action
- Busy imagery behind text
- Sections that repeat the same mood statement
- Carousel with no narrative purpose
- App UI made of stacked cards instead of layout

## Litmus Checks

- Is the brand or product unmistakable in the first screen?
- Is there one strong visual anchor?
- Can the page be understood by scanning headlines only?
- Does each section have one job?
- Are cards actually necessary?
- Does motion improve hierarchy or atmosphere?
- Would the design still feel premium if all decorative shadows were removed?
```

---

## Techniques for Better Designs (Detailed)

### 1. Start with Design Principles

Define constraints upfront:
- One H1 headline
- No more than six sections
- Two typefaces maximum
- One accent color
- One primary CTA above the fold

### 2. Provide Visual References

Reference screenshots or mood boards help infer layout rhythm, typography scale, spacing systems, and imagery treatment. Instruct the model to **generate a mood board first** for user review before building.

**Image prompting guidance:**

```
Default to using any uploaded/pre-generated images. Otherwise use the image generation tool to create visually stunning image artifacts. Do not reference or link to web images unless the user explicitly asks for them.
```

Explicitly describe desired image attributes: style, color palette, composition, mood. Guide the model to reuse previously generated images or create new visuals via image generation tools.

### 3. Structure the Page as a Narrative

Typical marketing page structure:

| Section | Purpose |
|---------|---------|
| 1. Hero | Establish identity and promise |
| 2. Supporting imagery | Show context or environment |
| 3. Product detail | Explain the offering |
| 4. Social proof | Establish credibility |
| 5. Final CTA | Convert interest into action |

### 4. Instruct Design System Adherence

Establish a clear design system early:
- **Color tokens**: `background`, `surface`, `primary text`, `muted text`, `accent`
- **Typography roles**: `display`, `headline`, `body`, `caption`
- **Recommended stack**: React + Tailwind (strongest model performance for iteration)

**Safe layout guidance for motion/overlays:**

```
Keep fixed or floating UI elements from overlapping text, buttons, or other key content across screen sizes. Place them in safe areas, behind primary content where appropriate, and maintain sufficient spacing.
```

### 5. Dial Back the Reasoning

For simpler websites, **low and medium reasoning levels often lead to stronger results** — keeping the model fast, focused, and less prone to overthinking.

### 6. Ground the Design in Real Content

Provide real copy, product context, or a clear project goal. This helps the model choose correct site structure, shape section-level narratives, and write believable messaging instead of generic placeholders.

---

## Cross-Reference: How This Maps to Our System

| OpenAI Concept | Forge Equivalent | Notes |
|---|---|---|
| Frontend Skill (full prompt) | `frontend-design` skill | Our skill should incorporate these rules; currently we have `frontend-architecture` for structural patterns |
| Hard Rules prompt block | Inject into execute/design mode | Use as guardrails when spawning frontend workers |
| Working Model (visual thesis → content plan → interaction thesis) | Design mode L1-L2 | Map to progressive refinement in design phase |
| Narrative page structure | `copywriting` + `page-cro` skills | Hero → Support → Detail → Social Proof → CTA aligns with CRO methodology |
| Litmus Checks | Verify mode | Use as verification checklist for frontend output |
| Reject These Failures | Verify mode anti-patterns | Explicit failure patterns to check against |
| Playwright verification | `forge-playwright` skill | Already integrated — model can visually verify its work |
| Mood board generation | Ideate mode | Use image tools in ideation to establish visual direction |
| Low reasoning preference | Routing / model selection | Consider lower reasoning for simpler frontend tasks |

---

## Usage Notes for Forge Agents

1. **When spawning frontend workers**: Include Prompt 1 (Hard Rules) in the worker's system context. For visually-led tasks (landing pages, marketing sites), include the full Frontend Skill (Prompt 2).
2. **In design mode**: Use the "Working Model" pattern — require visual thesis, content plan, and interaction thesis before implementation begins.
3. **In verify mode**: Use the Litmus Checks and "Reject These Failures" sections as a structured checklist.
4. **For existing design systems**: The Exception rule applies — preserve established patterns over these defaults.
5. **React + Tailwind**: Recommended stack for best model performance. Aligns with our `frontend-architecture` skill.
