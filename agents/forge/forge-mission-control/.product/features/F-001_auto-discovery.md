---
type: feature
version: 1.0.0
status: draft
created: "2026-07-13"
updated: "2026-07-13"
updated_by: forge
tags: [core, discovery, cli]
feature_status: discovery
---

# F-001: Auto-Discovery Engine

## Summary
When `forge-ui <repo-root>` is invoked, automatically detect which Forge subsystems are present and configure the dashboard accordingly.

## Discovery Targets

| Folder / Path | System | Required? |
|---|---|---|
| `.product/` + `_meta.yaml` | Product Hub | Optional |
| `.backlog/` (or multi-project discovery) | Backlog | Optional |
| `.git/devpartner/hub.db` | Agents Hub | Optional |
| `.copilot-workers/` | Copilot Workers | Optional |

## Behavior

1. Scan the provided `<repo-root>` for each target
2. For each found system, register its data provider
3. Generate the sidebar navigation based on what was discovered
4. Missing systems show as disabled/grayed nav items with "Not found" hint
5. At least one system must be found, otherwise exit with helpful error

## Multi-Project Support

The backlog skill supports multi-project discovery (scans for `.backlog/` in subdirectories). Mission Control should inherit this behavior — if multiple backlog roots exist, show a project switcher.

## Edge Cases

- Repo has no `.git/` → Still works (just can't find devpartner hub.db at `.git/devpartner/`)
- Repo has legacy `.devpartner/hub.db` → agents-hub already handles this fallback
- Repo has product but no backlog → Show product mode only, backlog nav grayed out

## Acceptance Criteria

- [ ] CLI accepts a path argument and validates it exists
- [ ] Discovers all 4 subsystem types
- [ ] Dashboard sidebar reflects only discovered systems
- [ ] Graceful handling of partial discovery (1 of 4 systems present)
- [ ] Multi-backlog-root projects show a project switcher
