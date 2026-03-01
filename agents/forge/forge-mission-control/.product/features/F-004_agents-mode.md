---
type: feature
version: 1.0.0
status: active
created: '2026-03-01'
updated: '2026-03-01'
updated_by: forge-product
tags:
  - agents
  - workers
  - monitoring
  - transcripts
feature_status: discovery
epic_id: B-001
---
# F-004: Agents Mode

## Summary
Real-time monitoring dashboard for AI agent interactions. Shows active workers, their transcripts, cost tracking, and the agents-hub message board. Merges data from agents-hub (SQLite) and copilot-cli-skill (.copilot-workers/ files).

## Views

### Workers Overview
- Summary cards: active / completed / failed / lost worker counts
- Total session cost (USD)
- Active workers table: ID, agent type, status, health, turns, errors, cost, last event
- Auto-refresh via SSE (reuse agents-hub `/events` pattern)

### Worker Detail
- Worker metadata: agent, model, branch, worktree path, timestamps
- Live transcript (conversation view from events.jsonl)
- Tool usage breakdown (calls, duration, failures)
- Token usage & cost breakdown (per model, per provider)
- Output log tail
- Actions: stop worker, trigger sync

### Hub Message Board
- Timeline of all hub messages (notes, decisions, requests, status updates)
- Thread view for conversations
- Channel filter
- Unresolved requests highlighted
- Search across messages

### Cost Dashboard
- Total cost across all workers in current session
- Per-worker cost breakdown (table + bar chart)
- Per-model cost breakdown
- Token usage over time (if multiple sync points available)

### Incidents
- Failed workers with error summaries
- Lost workers (no heartbeat)
- Unresolved help requests
- Action buttons: retry sync, stop

## Data Sources
- Agents Hub API: `Hub.listWorkers()`, `Hub.getWorker()`, `Hub.workerSync()`, `Hub.readMessages()`, `Hub.searchMessages()`, `Hub.getOpsSummary()`
- Copilot CLI Skill API: `WorkerManager.list()`, `WorkerManager.getStatus()`, reads from `.copilot-workers/` meta.json, exit.json, output.log
- Merge: Match workers by ID across both systems

## Phase 1 Actions
- Browse workers and their statuses
- View transcripts (conversation mode)
- View hub messages and threads
- Trigger worker sync
- Stop a worker

## Phase 2 Actions (future)
- Spawn new workers from the UI
- Edit worker prompts/context
- Export session reports
- Comparative analysis (cost per task)
