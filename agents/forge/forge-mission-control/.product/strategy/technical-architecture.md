---
type: strategy
version: 1.0.0
status: draft
created: "2026-07-13"
updated: "2026-07-13"
updated_by: forge
tags: [architecture, technical, strategy]
---

# Technical Architecture

## System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    forge-mission-control                       │
│                                                               │
│  CLI Entry Point (commander)                                  │
│    ├── parse args (repo path, port, flags)                    │
│    ├── run Discovery Engine (F-001)                           │
│    └── start Server                                           │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  HTTP Server (Fastify)                                  │   │
│  │                                                         │   │
│  │  Routes:                                                │   │
│  │    /              → Dashboard home                      │   │
│  │    /product/*     → Product mode (F-002)                │   │
│  │    /backlog/*     → Backlog mode (F-003)                │   │
│  │    /agents/*      → Agents mode (F-004)                 │   │
│  │    /api/*         → JSON endpoints                      │   │
│  │    /events        → SSE stream                          │   │
│  │    /assets/*      → Static files                        │   │
│  │                                                         │   │
│  │  ┌──────────────────────────────────────────────────┐   │   │
│  │  │  Data Providers (adapters to existing systems)    │   │   │
│  │  │                                                   │   │   │
│  │  │  ProductProvider ──→ product-hub SDK               │   │   │
│  │  │  BacklogProvider ──→ backlog API                   │   │   │
│  │  │  AgentsProvider  ──→ agents-hub Hub class          │   │   │
│  │  │  WorkersProvider ──→ copilot-cli WorkerManager     │   │   │
│  │  └──────────────────────────────────────────────────┘   │   │
│  │                                                         │   │
│  │  ┌──────────────────────────────────────────────────┐   │   │
│  │  │  Renderer (SSR HTML)                              │   │   │
│  │  │                                                   │   │   │
│  │  │  layout()  → shell, sidebar, nav                  │   │   │
│  │  │  product/  → vision, features, experiments        │   │   │
│  │  │  backlog/  → board, detail, stats                 │   │   │
│  │  │  agents/   → workers, messages, costs, detail     │   │   │
│  │  │  shared/   → cards, tables, badges, markdown      │   │   │
│  │  └──────────────────────────────────────────────────┘   │   │
│  └────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. Adapter Pattern — Don't Rebuild, Wrap

Each data source is accessed through its existing TypeScript API:

| Provider | Wraps | Import |
|----------|-------|--------|
| `ProductProvider` | product-hub `ProductRepository` | `agents/forge/product-hub/src` |
| `BacklogProvider` | backlog `BacklogApi` | `skills/backlog/src` |
| `AgentsProvider` | agents-hub `Hub` class | `skills/agents-hub/src` |
| `WorkersProvider` | copilot-cli-skill `WorkerManager` | `skills/copilot-cli-skill/src` |

**Why**: These systems have well-tested APIs with edge case handling. Reimplementing file parsing or SQLite queries would be fragile and diverge over time.

### 2. SSR HTML — No Frontend Build Step

Following the established pattern from agents-hub and backlog:
- HTML generated server-side as template strings
- Single CSS file (dark theme)
- Vanilla JS for interactivity (SSE, form submissions)
- Optional: htmx for progressive enhancement (fetch + swap HTML fragments)

**Why**: Zero build step = instant startup. No node_modules bloat from React/Vue. Matches existing codebase conventions.

### 3. Fastify over Express

- Better TypeScript support (decorators, typed plugins)
- Schema-based validation for API routes
- Plugin system for clean separation of modes
- 2-3x faster than Express in benchmarks
- Each mode registers as a Fastify plugin

### 4. File Watching + SSE for Real-Time

- `fs.watch` on `.product/` and `.backlog/` directories
- Hub polling interval for agent updates (reuse agents-hub pattern)
- SSE endpoint streams events to browser
- Browser reconnects automatically on disconnect

## Project Structure

```
forge-mission-control/
├── .product/                    # Product artifacts (this folder)
├── src/
│   ├── cli.ts                   # CLI entry point (commander)
│   ├── server.ts                # Fastify server setup
│   ├── discovery.ts             # Auto-discovery engine (F-001)
│   │
│   ├── providers/               # Data adapters
│   │   ├── types.ts             # Shared provider interfaces
│   │   ├── product.ts           # ProductProvider
│   │   ├── backlog.ts           # BacklogProvider
│   │   ├── agents.ts            # AgentsProvider
│   │   └── workers.ts           # WorkersProvider
│   │
│   ├── routes/                  # HTTP route handlers
│   │   ├── home.ts              # Dashboard home
│   │   ├── product.ts           # /product/* routes
│   │   ├── backlog.ts           # /backlog/* routes
│   │   ├── agents.ts            # /agents/* routes
│   │   └── api.ts               # /api/* JSON endpoints
│   │
│   ├── render/                  # SSR HTML templates
│   │   ├── layout.ts            # Shell, sidebar, nav
│   │   ├── components.ts        # Shared components (cards, badges, tables)
│   │   ├── markdown.ts          # Markdown → HTML renderer
│   │   ├── product-views.ts     # Product mode views
│   │   ├── backlog-views.ts     # Backlog mode views
│   │   └── agents-views.ts      # Agents mode views
│   │
│   ├── styles/                  # CSS
│   │   └── main.css             # Single stylesheet (dark theme)
│   │
│   └── events.ts                # SSE + file watcher
│
├── package.json
├── tsconfig.json
└── README.md
```

## Dependency Strategy

### Runtime Dependencies (minimal)
- `fastify` — HTTP server
- `commander` — CLI argument parsing
- `open` — Auto-open browser
- `gray-matter` — Markdown frontmatter parsing (if not importing from product-hub)
- `chokidar` — File system watching (more reliable than fs.watch)

### Workspace Imports (from monorepo siblings)
- `agents/forge/product-hub/src` → ProductRepository, types
- `skills/backlog/src` → BacklogApi, types  
- `skills/agents-hub/src` → Hub, types
- `skills/copilot-cli-skill/src` → WorkerManager, types

### Build
- `tsc` → compile TypeScript to `dist/`
- No bundler needed (server-side only)
- `bin` entry in package.json for `forge-ui` command

## Implementation Phases

### Phase 0 — Skeleton (1 session)
- [ ] package.json, tsconfig.json, basic CLI
- [ ] Discovery engine
- [ ] Fastify server with shell layout
- [ ] Empty mode pages with "Coming soon"

### Phase 1 — Read + Light Actions (2-3 sessions)
- [ ] Product mode: doc browser, feature board, search
- [ ] Backlog mode: kanban board, item detail, stats
- [ ] Agents mode: workers table, worker detail, messages, costs
- [ ] SSE for real-time updates
- [ ] Light actions: move backlog items, sync workers, stop workers

### Phase 2 — Full Control Plane (future)
- [ ] Inline editing for product docs and backlog items
- [ ] Worker spawning from UI
- [ ] Experiment management
- [ ] Session reports and export
