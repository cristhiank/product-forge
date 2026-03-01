---
type: feature
version: 1.0.0
status: active
created: '2026-03-01'
updated: '2026-03-01'
updated_by: forge-product
tags:
  - backlog
  - kanban
  - tasks
feature_status: discovery
epic_id: B-001
---
# F-003: Backlog Mode

## Summary
A kanban board and detail view for browsing backlog items across all projects. Reuses the backlog skill's API for data access.

## Views

### Kanban Board
- 4 columns: Next → Working → Done → Archive
- Cards show: ID, title, priority badge, kind badge, tags, dependency count
- Cards link to item detail
- Project filter (if multi-project)
- Sort by: priority, created date, dependency count

### Item Detail
- Full metadata: ID, kind, priority, status, tags, project
- Rendered markdown body
- Dependencies section: items this depends on (with status badges)
- Related items section
- Reverse dependencies: items that depend on this one

### Stats & Health
- Items per folder (bar chart or counts)
- Per-project breakdown
- Health score with hygiene alerts (stale items, stuck work, old done items)
- Dependency graph visualization (stretch goal)

## Data Source
- Backlog API: `list()`, `get()`, `search()`, `stats()`, `hygiene()`
- Goes through the backlog TypeScript SDK — no direct file parsing

## Phase 1 Actions
- Browse the kanban board
- View item details
- Search items
- Move items between folders (pick, complete, archive)

## Phase 2 Actions (future)
- Create new items
- Edit item content
- Manage dependencies
- Bulk operations (archive all done items)
