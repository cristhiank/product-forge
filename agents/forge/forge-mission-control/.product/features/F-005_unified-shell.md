---
type: feature
version: 1.0.0
status: active
created: '2026-03-01'
updated: '2026-03-01'
updated_by: forge-product
tags:
  - shell
  - navigation
  - ux
  - server
feature_status: defined
epic_id: B-001
---
# F-005: Unified Shell & Navigation

## Summary
The outer application shell that provides mode switching, sidebar navigation, project context, and the local web server infrastructure.

## Architecture

```
forge-ui <repo-root>
  │
  ├── CLI (commander)
  │     ├── Parse args: path, --port, --no-open
  │     ├── Run auto-discovery (F-001)
  │     └── Start HTTP server
  │
  ├── HTTP Server (fastify or express)
  │     ├── / → Dashboard home (project overview)
  │     ├── /product/* → Product Mode routes (F-002)
  │     ├── /backlog/* → Backlog Mode routes (F-003)
  │     ├── /agents/* → Agents Mode routes (F-004)
  │     ├── /api/* → JSON API for all modes
  │     ├── /events → SSE for real-time updates
  │     └── /assets/* → Static CSS/JS
  │
  └── Browser opens http://localhost:<port>
```

## Shell Layout

```
┌─────────────────────────────────────────────────────┐
│  🔥 Forge Mission Control    my-project (mvp)  v0.1 │
├────────┬────────────────────────────────────────────┤
│        │                                            │
│ 📋 Product  │         Main Content Area             │
│   Vision    │                                       │
│   Brand     │                                       │
│   Features  │                                       │
│             │                                       │
│ 📦 Backlog  │                                       │
│   Board     │                                       │
│   Stats     │                                       │
│             │                                       │
│ 🤖 Agents   │                                       │
│   Workers   │                                       │
│   Messages  │                                       │
│   Costs     │                                       │
│   Incidents │                                       │
│             │                                       │
├────────┴────────────────────────────────────────────┤
│  Status: 3 active workers │ 12 backlog items │ $4.20│
└─────────────────────────────────────────────────────┘
```

## Design Decisions

### SSR vs SPA
**Decision: Server-Side Rendered HTML** (like agents-hub and backlog today)
- Rationale: Zero build step, no frontend framework dependency, matches existing pattern
- CSS: Single stylesheet, dark theme (consistent with agents-hub)
- Interactivity: Vanilla JS + SSE for real-time updates, htmx for light actions
- Trade-off: Less dynamic UI, but simpler stack and faster startup

### Framework
**Decision: Fastify** (over Express)
- Rationale: Better TypeScript support, schema validation, plugin system, performance
- Alternative considered: Express (simpler but less structured for a multi-route app)

### Real-time Updates
**Decision: Server-Sent Events (SSE)**
- Rationale: Already proven in agents-hub, unidirectional (server→client), simpler than WebSocket
- File watchers for .product/ and .backlog/ changes
- Hub polling for agent updates

## CLI Interface

```bash
# Basic usage
forge-ui /path/to/repo

# With options
forge-ui /path/to/repo --port 3700 --no-open

# Options:
#   <path>       Repository root (default: cwd)
#   --port, -p   Port number (default: 3700)
#   --no-open    Don't auto-open browser
#   --verbose    Show server logs
```

## Acceptance Criteria

- [ ] CLI starts server and opens browser
- [ ] Shell renders with sidebar navigation
- [ ] Mode switching works (Product/Backlog/Agents)
- [ ] Only discovered modes are shown in sidebar
- [ ] Status bar shows live summary counts
- [ ] Dark theme consistent with agents-hub
- [ ] Server starts in <2 seconds
- [ ] Graceful shutdown on Ctrl+C
