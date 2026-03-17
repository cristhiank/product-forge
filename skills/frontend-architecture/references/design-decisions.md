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

## Notification Strategy: Toast vs Banner vs Dialog

**Toast when:**
- Transient feedback after CRUD operations (created, updated, deleted)
- Non-blocking — user doesn't need to act
- Auto-dismiss after 5–6 seconds
- Position: top-right corner (doesn't block content)

**Banner (inline) when:**
- Persistent error that blocks functionality (API down, auth expired)
- Placed immediately after page header, not floating
- Includes retry action
- Uses `role="alert"` for accessibility

**Dialog when:**
- Destructive action requiring explicit confirmation (delete, deactivate)
- Uses `role="alertdialog"` for accessibility
- Default button: Cancel (non-destructive), destructive button: explicit red
- Clear, non-technical description of consequence

**Never use toast for:** persistent errors (use banner), confirmations (use dialog), errors requiring action (use banner with retry).

## Save Strategy: Batch vs Per-Field vs Auto-Save

**Batch save (sticky footer) when:**
- Settings or configuration pages with multiple fields
- User edits several fields before committing
- Dirty state tracked at section/tab level (not per-field)
- Visual signal: sticky footer slides up showing dirty count + Discard + Save

**Per-field save when:**
- Individual toggle switches with immediate effect (enable/disable feature)
- Fields that affect other fields in real-time
- Only when each field is independently meaningful

**Auto-save when:**
- Document or content editing (rich text, notes)
- Real-time collaboration contexts
- Debounced (500ms+), with visual "Saved" indicator

**Default for admin/settings:** Batch save with sticky footer. Per-field save is a UX anti-pattern for settings pages — multiple toasts for individual saves overwhelm the user.

## Entity Management: Master-Detail vs Tabs vs Separate Pages

**Master-detail (sidebar list + detail panel) when:**
- Managing a collection of entities (agents, providers, skills, servers, users)
- Entities share a common shape but differ in detail (different settings per type)
- User frequently switches between entities while editing
- Multiple entity types coexist in the same workspace (use sidebar sections or a type filter)
- Desktop-primary professional tool where screen width supports two panels

**Layout anatomy:**
- **Entity sidebar** — Filterable, scrollable list of entities. Shows name + status badge. Grouped by type or category when multiple entity types coexist.
- **Detail panel** — Fills remaining space. Shows entity metadata at top, tabbed or sectioned content below. Inline editing, no separate edit dialogs.
- **Scope/context filter** — Optional top-level filter when entities exist in multiple scopes (admin/user, platform/tenant). One filter replaces duplicate sections.

**When entities are inline-editable in the detail panel:**
- Dirty state tracked at section level, not per-field
- Sticky footer with Discard + Save appears on edit
- Read-only entities (immutable sources) disable editing controls but still show detail panel

**Tabs (within a page) when:**
- Fewer than 4 entity types, each with substantially different UI
- Sections are fully independent — editing one never affects another
- Entity lists are short enough that a sidebar adds more chrome than value

**Separate pages (route-per-entity-type) when:**
- Entity types have completely different schemas, workflows, and APIs
- No benefit to seeing multiple entity types simultaneously
- Deep entity detail (sub-pages, nested routes) would complicate a master-detail layout

**Warning sign**: Separate sections or tabs per scope (admin tab + user tab showing the same entity type) is a duplication smell. Unify with a scope filter.

## Scope/View Unification

When the same entity type exists in multiple scopes (e.g., platform agents vs tenant agents, admin users vs regular users), prefer **one view with a scope filter** over **separate sections or duplicate components**.

**Unify when:**
- Entity shape is identical or nearly identical across scopes
- CRUD operations are the same (even if permissions differ)
- Users need to see/compare entities across scopes
- Maintaining separate components leads to divergent behavior

**Keep separate when:**
- Scopes have fundamentally different UI workflows (not just different permissions)
- Entity schemas differ substantially between scopes
- Cross-scope visibility is a security concern

**Implementation pattern:**
- Single entity list component receives `scope` as a parameter
- API client accepts `scope` to route to the correct backend endpoints
- `isReadOnly` and `canCreate` derived from scope + user permissions
- Detail panel adapts fields based on scope (hide/show, not duplicate)

## Form Layout: FieldRow vs FormGrid

**FieldRow (label LEFT, control RIGHT) when:**
- Settings/configuration pages
- Fields are mostly booleans (switches), selects, and short text
- Compact density needed — each field takes one horizontal line
- Label width: fixed 140–200px, control fills remaining space
- Spacing between rows: 0.5rem (compact) or 1rem (standard)

**FormGrid (label ABOVE, responsive grid) when:**
- Data entry forms (create/edit entities)
- Fields are mostly text inputs, textareas, date pickers
- Need 2–3 columns on desktop, 1 column on mobile
- Grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`, gap: 1.5rem

**Warning sign:** 4+ text fields rendered as a plain vertical stack with no visual structure is always wrong. Apply FormGrid. 6+ boolean/select fields stacked vertically without structure is wrong. Apply FieldRow.
