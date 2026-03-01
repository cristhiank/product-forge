# Frontend Design Decision Frameworks

Use these when choosing between competing valid approaches. Each framework gives the "choose X when…" conditions — not a single right answer.

## Layout: Sidebar vs Top Nav vs Hybrid

**Sidebar when:**
- More than 5 navigation items
- Desktop-primary or professional tool interface
- Need for grouped/collapsible sections (e.g., admin panels, dashboards)
- Persistent context (user, tenant, environment) displayed alongside nav

**Top nav when:**
- Fewer than 5 items
- Content-first or marketing/consumer experience
- Full-width content is more important than persistent navigation

**Hybrid (sidebar desktop, bottom tabs mobile) when:**
- App serves both desktop and mobile users with different tasks
- Desktop needs grouped nav, mobile needs thumb-reachable tabs
- Collapse sidebar to icon-only or sheet drawer on smaller viewports

## Form Layout: Single Page vs Accordion vs Stepper vs Tabs

**Single page when:**
- Fewer than 5 fields total
- Simple linear flow with no sections
- User needs to see all fields at once (e.g., search filters)

**Accordion / collapsible sections when:**
- More than 3 logical sections
- User needs an overview of all sections at a glance
- Sections are independently editable (no sequential dependency)
- Good default for settings pages and configuration forms

**Stepper / wizard when:**
- Sequential dependency between steps (step 2 depends on step 1 answers)
- Complex validation per step (show errors before proceeding)
- Onboarding flows where progressive disclosure reduces overwhelm

**Tabs when:**
- Sections are fully independent (editing one never affects another)
- User typically works in one section at a time
- Each section is substantial enough to warrant its own view

**Warning sign**: A single-page form with more than 7 sections and no navigation is a "mega-scroll" — always break it up.

## Component Density: Consumer vs Professional

**Consumer (spacious) when:**
- Onboarding and first-time user experiences
- Mobile-primary interface
- Emotional/brand-forward design (landing pages, marketing)
- Users perform infrequent, deliberate actions

**Professional (dense) when:**
- Repeat daily-use tool (dashboards, admin consoles, data management)
- Desktop-primary interface
- Users value information density over whitespace
- Tabular data, metrics, and operational status displays

**Adaptive when:**
- Same app serves both personas (e.g., onboarding is spacious, daily dashboard is dense)
- Use a density token or scale system rather than hard-coding spacing per component

## Responsive Strategy

**Scale-down (desktop-first) when:**
- Desktop is the primary use case, mobile is occasional access
- Admin tools, analytics dashboards, configuration panels
- Complex layouts that don't translate meaningfully to small screens

**Mobile-first when:**
- Field workers, consumer apps, or emerging-market users on low-end devices
- Core actions must work on a 360px viewport
- Performance on constrained networks is critical

**Breakpoint-adaptive (different UX per viewport) when:**
- Desktop and mobile genuinely need different interfaces (e.g., dashboard grid vs mobile card stack)
- Field-specific views (e.g., campo/field mode vs office/desktop mode)
- Worth the extra development cost for meaningfully better UX at each breakpoint

**Default**: Start with the primary viewport, ensure the secondary viewport is usable. Don't build two full interfaces unless the UX difference justifies the cost.

## Empty States

**Contextual guidance when:**
- First-time users who haven't created any data yet
- Include: illustration or icon, explanation of what goes here, primary CTA to create first item

**Minimal placeholder when:**
- Filtered or searched results returned nothing
- Include: brief message, suggestion to adjust filters, no CTA to create

**Rule**: Every data-driven page or list must have an explicit empty state component. Never show a blank white area or only a loading spinner that resolves to nothing.

## Shared Component vs Feature Component

**Shared component (`shared/ui/components/`) when:**
- Used by 3+ features
- Domain-neutral (no business vocabulary in props or rendering)
- Stable interface unlikely to diverge per feature

**Feature component (`features/<feature>/components/`) when:**
- Used by only 1-2 features
- Contains domain-specific logic, vocabulary, or layout
- Likely to evolve differently per feature

**Promote to shared when:**
- A feature component is copy-pasted into a third feature
- Extract the domain-neutral parts into shared, keep domain-specific wrappers in features

## Icon Strategy

**Icon library (e.g., Lucide, Heroicons) when:**
- Need consistent, professional icon set across the app
- Accessibility matters (proper SVG structure, aria labels)
- Brand guidelines specify an icon style

**Emoji when:**
- Never in production UI for professional/SaaS tools
- Acceptable only in informal contexts (chat messages, user-generated content)
- Always fails brand alignment for operational interfaces

**Custom SVGs when:**
- Brand requires unique iconography not available in libraries
- Very few icons needed (logo, brand mark)
- Wrap in a project-owned component regardless
