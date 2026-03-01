---
type: feature
version: 1.0.0
status: draft
created: "2026-07-13"
updated: "2026-07-13"
updated_by: forge
tags: [product, docs, navigation]
feature_status: discovery
---

# F-002: Product Mode

## Summary
A read-oriented view for navigating all product artifacts in `.product/`. Renders markdown documents with YAML frontmatter, organizes by document type, and provides a feature lifecycle overview.

## Views

### Product Overview (landing)
- Product name, stage, version, north star (from `_meta.yaml`)
- Document type counts (vision, brand, features, strategy, experiments)
- Feature lifecycle summary chart (how many in each status)
- Health alerts (stale docs, orphaned features — reuse product-hub `health` command)

### Document Browser
- Sidebar tree grouped by type: Vision, Brand, Features, Strategy, Experiments, Playbooks
- Click to render full markdown with frontmatter metadata displayed as a header card
- Version badge, status badge, tags, last updated date
- Search across all product documents

### Feature Lifecycle Board
- Kanban-style board: Discovery → Defined → Validated → Planned → Building → Shipped → Measuring
- Cards show feature title, linked epic (if any), experiment count
- Click card → full feature detail with epic bridge link

### Experiment Tracker
- Table: hypothesis, linked feature, result (confirmed/rejected/inconclusive), metrics
- Filter by feature, result status

## Data Source
- Product Hub API: `repo.list()`, `repo.read()`, `repo.search()`, `health()`, `overview()`
- All reads go through the product-hub TypeScript SDK — no direct file parsing

## Phase 1 Actions
- Navigate and read all docs
- Search across documents
- View feature lifecycle and experiment status

## Phase 2 Actions (future)
- Edit document content inline
- Transition feature status
- Create new experiments
- Bump document versions
