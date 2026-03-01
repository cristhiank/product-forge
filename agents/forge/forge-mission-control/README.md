# Forge Mission Control

Local web dashboard for navigating Forge project artifacts, backlog items, and AI agent activity.

## Quick Start

```bash
# Install dependencies
npm install

# Build
npm run build

# Run (point to any Forge-managed repo)
forge-ui /path/to/your/repo

# Or with options
forge-ui /path/to/your/repo --port 3700 --no-open
```

## What It Does

Point `forge-ui` at any repository root. It auto-discovers:

| Folder | Mode | What You See |
|--------|------|-------------|
| `.product/` | Product | Vision, brand, features, experiments |
| `.backlog/` | Backlog | Kanban board, item details, stats |
| `.git/devpartner/hub.db` | Agents | Workers, transcripts, costs, messages |
| `.copilot-workers/` | Workers | Process status, logs, exit reports |

Opens a browser dashboard at `http://localhost:3700` with a unified navigation across all discovered modes.

## Architecture

- **Server**: Fastify (SSR HTML, JSON API, SSE)
- **Rendering**: Server-side HTML templates (no frontend framework)
- **Data**: Adapters wrapping existing skill APIs (product-hub, backlog, agents-hub, copilot-cli-skill)
- **Real-time**: SSE + file watchers for live updates
- **Theme**: Dark control room aesthetic

See `.product/strategy/technical-architecture.md` for full architecture docs.

## Product Docs

All product artifacts live in `.product/`:
- `vision/` — Product vision and north star
- `features/` — Feature specs (F-001 through F-005)
- `brand/` — Design guide and visual language
- `strategy/` — Technical architecture and roadmap
