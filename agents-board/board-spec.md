# Agent Collaboration Board — Current Specification

This document describes what is **implemented** in this repository.

## MCP Tool Surface
The MCP server intentionally exposes **two** tools:

1. `task` — task lifecycle (`create`, `list`, `archive`)
2. `board` — JavaScript code execution against an injected `board` API object

No other MCP tools are part of the supported surface.

## Storage Layout
Boards are **task-scoped** and stored under a project’s `.dev_partner` directory:

```
<project-root>/
  .dev_partner/
    tasks/
      <task_id>/
        meta.json
        mission.json
        status.json
        plan.json (optional)
        facts.jsonl
        decisions.jsonl
        alerts.jsonl
        snippets.jsonl
        trails.jsonl
        .index/
          direct.db
          graph.db
          temporal.db
          ck/...
    audit/
      <task_id>.jsonl
    archive/
      <task_id>/
```

There is **no** supported single-board directory.

## Core Board API (Conceptual)
The injected `board` API is task-scoped and provides:

- Read: `board.view()`, `board.getFacts()`, `board.getPlan()`, `board.getStatus()`, `board.search()`, ...
- Write (role-gated): `board.addFact()`, `board.setPlan()`, `board.raiseAlert()`, `board.completeStep()`, ...
- Trails: `board.appendTrail()` writes to `trails.jsonl` as memory-candidate events.

For the canonical list of methods and permissions, use:

- `board.help()` (runtime)
- `src/board.ts`, `src/mcp/server.ts` (source)

