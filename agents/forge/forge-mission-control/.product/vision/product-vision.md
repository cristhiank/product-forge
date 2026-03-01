---
type: vision
version: 1.0.0
status: draft
created: "2026-07-13"
updated: "2026-07-13"
updated_by: forge
tags: [mission-control, developer-tools, dashboard]
---

# Forge Mission Control — Product Vision

## The Problem

When working on a Forge-managed project, critical information lives in 3+ disconnected systems:

1. **Product artifacts** (`.product/`) — Vision, brand, features, experiments, strategy docs. You read them via CLI or raw file browsing. No overview, no status at a glance.

2. **Backlog items** (`.backlog/`) — Epics, stories, tasks across `next/working/done/archive` folders. The backlog CLI helps, but there's no visual board to see the full picture, dependencies, or progress.

3. **Agent activity** (`.git/devpartner/hub.db` + `.copilot-workers/`) — Active workers, their transcripts, token costs, tool usage, errors, and session history. The agents-hub CLI and serve mode help, but they're isolated from the product and backlog context.

**The result**: Context switching. You jump between CLIs, raw files, and separate `hub serve` / `backlog serve` tabs. There's no single place to see "what's the state of this project?"

## The Vision

**Forge Mission Control** is a local web dashboard that auto-discovers and unifies all Forge project data into a single browser UI.

```
forge-ui ~/dev/my-project
→ Discovers .product/, .backlog/, .copilot-workers/, .git/devpartner/
→ Starts local server at http://localhost:3700
→ Opens browser to the Mission Control dashboard
```

### What You See

| Mode | Source | Key Views |
|------|--------|-----------|
| **Product** | `.product/` | Vision overview, feature lifecycle board, brand guide, experiments tracker |
| **Backlog** | `.backlog/` | Kanban board (next→working→done), item detail, stats, dependency graph |
| **Agents** | `.git/devpartner/hub.db` + `.copilot-workers/` | Active workers, live transcripts, cost dashboard, timeline, incidents |

### What You Can Do (Incrementally)

**Phase 1 — Read + Light Actions**
- Navigate all product docs with rendered markdown
- Browse backlog as a visual kanban board
- View agent activity, worker status, transcripts
- Trigger worker sync, move backlog items between folders

**Phase 2 — Full Control Plane**
- Edit product specs inline
- Create/manage backlog items
- Start/stop workers
- Run experiments and track results

## Key Design Principles

1. **Auto-discovery, zero config** — Point to a repo root. It finds everything.
2. **Read-first, act-second** — Start as the best observer. Actions come incrementally.
3. **Unified, not monolithic** — Each mode (Product/Backlog/Agents) is a self-contained view backed by its existing data source. No data duplication.
4. **Leverage existing CLIs** — Don't rebuild what exists. Call the product-hub, backlog, and agents-hub APIs/CLIs under the hood.
5. **Local-only, fast** — No cloud, no auth, no accounts. Starts in <2 seconds. Just a local web server.

## Success Metrics

- **Primary**: Time to answer "what's happening in this project?" drops from minutes (multiple CLIs) to seconds (one dashboard).
- **Secondary**: Reduced context switching — fewer terminal tabs, fewer raw file reads.
- **Tertiary**: Agent cost awareness — seeing costs in real-time changes spending behavior.

## What This Is NOT

- Not a replacement for the CLIs — they remain the primary agent interface
- Not a cloud service or hosted platform
- Not a project management tool (Jira, Linear) — it reads YOUR files, YOUR data
- Not a code editor or IDE extension (yet)
