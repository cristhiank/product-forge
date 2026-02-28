---
name: agents-hub
description: >-
  ALWAYS use when any agent needs to communicate, share knowledge, post findings,
  request help, track progress, or search for context. Covers posting notes
  (findings, snippets, constraints), decisions, help requests, and status updates.
  Supports channels for multi-worker parallel sessions. Required for all
  DevPartner agent coordination. Use when you see: status update, finding,
  blocked, need help, share context, search board, check progress, post
  decision, coordinate, what did worker find, channel, hub.
  ⛔ CRITICAL: Never read .git/devpartner/ files directly — always use the hub CLI.
---

# agents-hub

A lightweight messaging hub for multi-agent coordination in DevPartner workflows. Provides channels, full-text search, request/response threading, and real-time watching for agent-to-agent communication.

## First Actions

When this skill loads, do these immediately:

1. **Check hub status** — `$HUB exec 'return sdk.status()'` — see if a hub exists and what's been posted
2. **Search for prior context** — `$HUB exec 'return sdk.search("<your-topic>")'` — find what other agents already discovered
3. **Post your arrival** — `$HUB exec --author <role> 'return sdk.postProgress(0, 1, "Starting work on <task>")'`
4. **Register active workers** (multi-worker/orchestrator only) — After each worker spawn:
   `$HUB exec --author orchestrator 'return sdk.registerWorker({ id: "<worker-id>", agentType: "<role>", worktreePath: "<path>", pid: <pid> })'`
5. **Sync before any status check** (multi-worker only) — Before checking worker health:
   `$HUB exec 'return sdk.syncAll()'`

> ⚠️ **Steps 4-5 are mandatory for multi-worker orchestration.** Without hub registration,
> the reactive hub cannot detect silent worker failures. copilot-cli-skill's `checkWorker`
> only sees process exit — the hub's reactor reads `events.jsonl` and can detect stale workers
> (no events for N minutes), workers with unreported errors, and workers that completed silently.

## Quick Reference — SDK (Preferred)

Use `hub exec` with SDK helpers. The `sdk` and `hub` objects are pre-loaded.

```bash
HUB="node <skill-dir>/scripts/index.js"

# Post a finding
$HUB exec --channel '#main' --author scout \
  'return sdk.postFinding("Auth uses bcrypt for hashing", { tags: ["auth", "security"], path: "src/auth.ts", lines: [45, 60] })'

# Search
$HUB exec --channel '#main' 'return sdk.search("auth bcrypt")'

# Get findings
$HUB exec --channel '#main' 'return sdk.getFindings()'

# Get unresolved requests
$HUB exec --channel '#main' 'return sdk.getUnresolved()'

# Request help (blocker)
$HUB exec --channel '#worker-B042' --author executor \
  'return sdk.requestHelp("Blocked: type mismatch in SharedTypes", "blocker", { target: "super-orchestrator" })'

# Resolve a request
$HUB exec --author orchestrator \
  'return sdk.resolveRequest("<thread-id>", "Fixed in commit abc123")'

# Log a trail
$HUB exec --channel '#main' --author executor \
  'return sdk.logTrail("[IMPL]", "Implemented magic link auth", { evidence: ["src/auth/magic-token.ts"] })'

# Hub status
$HUB exec 'return sdk.status()'
```

The `--channel` and `--author` flags set defaults so you don't repeat them in every call.

---

## ⚡ Communication Rules (Mandatory)

1. **Post progress after every meaningful step.** Don't work silently — your channel is your heartbeat.
2. **Channel routing:**
   - Single-worker → `#main`
   - Multi-worker → `#worker-{id}` for work, `#general` for blockers/completions
3. **Post immediately when:** you find something (finding), you're blocked (request), you finish a step (progress), or you make a decision (decision).
4. **Minimum cadence:** At least 1 status message per 3 tool calls. If you've done 3+ tool calls with no hub post, stop and post a progress update.
5. **Never go dark.** Other agents and the orchestrator monitor your channel. Silence = assumed stuck.

---

## ⛔ CRITICAL: Never Browse .git/devpartner/ Directly

**WRONG:**
```bash
cat .git/devpartner/hub.db
ls .git/devpartner/
sqlite3 .git/devpartner/hub.db "SELECT ..."
```

**RIGHT:**
```bash
$HUB exec --channel '#main' 'return sdk.search("auth")'
$HUB exec --channel '#main' 'return sdk.getFindings()'
$HUB exec 'return sdk.status()'
```

The hub database is managed by the CLI. Direct file access bypasses indexing, locks the database, and breaks cross-agent coordination.

---

## SDK Method Reference

### Findings & Notes

| Method | Description |
|--------|-------------|
| `sdk.postFinding(content, opts?)` | Post note tagged "finding". opts: `{ tags?, path?, lines?, metadata? }` |
| `sdk.postSnippet(path, content, opts?)` | Post note tagged "snippet". opts: `{ gitHash?, language?, tags? }` |
| `sdk.postConstraint(content, opts?)` | Post note tagged "constraint". opts: `{ tags?, path? }` |

### Decisions

| Method | Description |
|--------|-------------|
| `sdk.proposeDecision(content, opts?)` | Post decision (status=proposed). opts: `{ approachId?, tags? }` |
| `sdk.approveDecision(threadId, resolution)` | Reply with status=approved |
| `sdk.rejectDecision(threadId, reason)` | Reply with status=rejected |

### Requests & Blocking

| Method | Description |
|--------|-------------|
| `sdk.requestHelp(content, severity, opts?)` | Post request. severity: "info"\|"minor"\|"major"\|"blocker". opts: `{ target?, requestType? }` |
| `sdk.resolveRequest(threadId, resolution)` | Reply with resolved=true |

### Status & Progress

| Method | Description |
|--------|-------------|
| `sdk.postProgress(step, totalSteps, content, opts?)` | Post status with step info. opts: `{ filesChanged? }` |
| `sdk.postCheckpoint(content, opts?)` | Post status tagged "checkpoint". opts: `{ checkpointNumber?, filesChanged? }` |

### Trails

| Method | Description |
|--------|-------------|
| `sdk.logTrail(marker, summary, opts?)` | Post note tagged "trail". opts: `{ details?, evidence? }` |

### Queries

| Method | Description |
|--------|-------------|
| `sdk.getFindings(opts?)` | Read notes tagged "finding". opts: `{ channel?, since?, limit?, tags? }` |
| `sdk.getUnresolved(opts?)` | Read unresolved requests |
| `sdk.getDecisions(status?, opts?)` | Read decisions. status: "proposed"\|"approved"\|"rejected" |
| `sdk.search(query, opts?)` | Full-text search. opts: `{ channel?, tags?, limit?, since? }` |
| `sdk.status()` | Hub status overview |

### Worker Observability

| Method | Description |
|--------|-------------|
| `sdk.registerWorker(opts)` | Register worker. opts: `{ id, channel?, agentType?, agentName?, worktreePath?, pid? }` |
| `sdk.getWorkerStatus(id, sync?)` | Get worker status + health. sync=true (default) reads latest events first |
| `sdk.listWorkers(opts?)` | List workers. opts: `{ status?: "active"\|"completed"\|"failed"\|"lost" }` |
| `sdk.syncAll()` | Sync all active workers — reads events.jsonl, updates counters and status |

> For low-level `hub.*` methods (raw post/reply/read/search/thread/channel ops), see `references/low-level-api.md`.

---

## Channel Awareness

### Single-Worker Mode (default)
- One `#main` channel
- All agents (Scout, Creative, Planner, Executor, Verifier) share one channel
- Post **all** findings, progress, decisions, and trails to `#main`

### Multi-Worker Mode
- `#general` for cross-worker announcements, completions, and blockers
- `#worker-{item-id}` per parallel worker (e.g., `#worker-B042`, `#worker-B043`)
- Super-Orchestrator monitors all channels

**Channel routing in multi-worker mode:**

| What | Where | Example |
|------|-------|---------|
| Findings, snippets | Your `#worker-{id}` channel | Scout posts discovery to `#worker-B042` |
| Progress updates | Your `#worker-{id}` channel | Executor posts "step 2/4 done" |
| Blockers / help requests | Your `#worker-{id}` + `#general` | Executor blocked → posts to both |
| Completion | `#general` | Worker done → announce to all |
| Cross-worker questions | `#general` | "Has anyone changed SharedTypes?" |

### What to Post (and When)

| Trigger | Post Type | Example |
|---------|-----------|---------|
| Found something relevant | `sdk.postFinding(...)` | "Auth uses bcrypt, src/auth.ts:45" |
| Cached code for reference | `sdk.postSnippet(...)` | Code block with path |
| Completed a plan step | `sdk.postProgress(step, total, ...)` | "Step 2/4: POST endpoint done" |
| Blocked / need input | `sdk.requestHelp(...)` | "Type mismatch, need guidance" |
| Made a design choice | `sdk.proposeDecision(...)` | "Using approach D-1" |
| Finished a milestone | `sdk.postCheckpoint(...)` | "3/4 steps complete, build passing" |
| Task fully complete | `sdk.logTrail(...)` | "[IMPL] Feature implemented" |
| Every 3+ tool calls with no post | `sdk.postProgress(...)` | "Still working on X, exploring Y" |

```bash
# Initialize multi-worker hub
$HUB exec 'hub.init({ mode: "multi" })'

# Create worker channel
$HUB exec 'hub.channelCreate("#worker-B042", { workerId: "B042" })'
```

---

## Message Types Reference

| Type | Purpose | SDK Methods |
|------|---------|-------------|
| **note** | Findings, snippets, constraints, trails | `postFinding`, `postSnippet`, `postConstraint`, `logTrail` |
| **decision** | Propose/approve/reject decisions | `proposeDecision`, `approveDecision`, `rejectDecision` |
| **request** | Help requests, blockers | `requestHelp`, `resolveRequest` |
| **status** | Progress, checkpoints | `postProgress`, `postCheckpoint` |

### Severity Levels (for requests)

| Severity | Meaning | Response Time |
|----------|---------|---------------|
| `info` | FYI, no action needed | None |
| `minor` | Could use help, not blocking | When convenient |
| `major` | Slowing progress significantly | ASAP |
| `blocker` | Cannot proceed | Immediately |

---

## Error Handling

All `hub exec` commands return JSON. On failure, exit code is non-zero:

```bash
# Check for errors
result=$($HUB exec 'return sdk.postFinding("test")'); echo $?
# 0 = success, non-zero = failure

# Common errors:
# - "Hub not initialized" → Run from repo root, or check .git/devpartner/ exists
# - "Channel not found" → Create it first: hub.channelCreate("#worker-X")
# - "Database locked" → Another process is writing; retry after 1 second
```

---

## Worktree Usage (Parallel Workers)

When workers run in git worktrees, they automatically share the hub database. The CLI uses `git rev-parse --git-common-dir` to locate the database at `.git/devpartner/hub.db` in the common git directory. All worktrees resolve to the same location — no symlinks or special configuration needed.

**Legacy migration:** If a `.devpartner/hub.db` exists in the working directory, the CLI auto-migrates it to `.git/devpartner/hub.db` on first run.

---

## Worker Observability (Reactive Hub)

The hub tracks worker processes deterministically by reading their Copilot CLI session events. This provides **guaranteed** visibility even when workers don't post to the hub voluntarily.

> ⚠️ **Worker registration is mandatory for multi-worker orchestration.** Every spawned
> worker must be registered via `sdk.registerWorker()`. Without registration, the hub has
> zero visibility into worker health. This is the #1 cause of undetected worker failures.

### How It Works

1. **Register** — After spawning a worker, register it with the hub
2. **Auto-discover** — The hub finds the worker's `events.jsonl` (Copilot's structured session log)
3. **Sync** — Read new events, update tool call/turn/error counts, detect failures
4. **Health** — Detect stale/lost workers based on activity timestamps

### Quick Start

```bash
# Register a worker after spawning it
$HUB worker register --id abc123 --agent-type executor --agent-name "API worker" --worktree /path/to/worktree --pid 12345

# Sync all active workers (reads events.jsonl, updates counters)
$HUB worker sync

# List workers with status
$HUB worker list
$HUB worker list --status active

# Get detailed worker status (auto-syncs first)
$HUB worker status abc123
```

### Worker Lifecycle

| Status | Meaning |
|--------|---------|
| `active` | Worker is running (or recently registered) |
| `completed` | Worker finished successfully |
| `failed` | Worker encountered a session error or was aborted |
| `lost` | Worker has been inactive beyond the health threshold |

### What Gets Tracked

The reactor reads structured events from Copilot CLI's `events.jsonl`:

| Event | What It Gives |
|-------|---------------|
| `tool.execution_complete` | Tool call count, tool errors |
| `assistant.turn_end` | Turn count (activity pulse) |
| `session.error` | Error count, failure detection with message |
| `abort` | Abort detection (user or system) |
| `subagent.started/completed` | Subagent delegation tracking |
| `skill.invoked` | Which skills the worker loaded |
| `session.start` | Model selection, session context |

### SDK Usage

```bash
# Register + sync in one call
$HUB exec --channel '#general' --author orchestrator '
  const w = sdk.registerWorker({ id: "abc123", agentType: "executor", agentName: "API worker" });
  return w;
'

# Sync all and check for failures
$HUB exec '
  const results = sdk.syncAll();
  const failed = results.filter(r => r.status === "failed");
  const errors = results.filter(r => r.errors > 0);
  return { synced: results.length, failed: failed.length, withErrors: errors.length, details: results };
'

# Get worker status with health check
$HUB exec 'return sdk.getWorkerStatus("abc123")'
```

### Agent Type Conventions

`agentType` is a **display label** (the DevPartner role name: executor, scout, orchestrator, etc.), NOT a runtime identifier. The hub auto-detects the telemetry source format from the worker's `eventsPath` — Copilot CLI sessions are detected by their path pattern (`~/.copilot/session-state/`). Custom agent names work without any additional configuration.

### Silence Detection

After `syncAll()`, check for workers that are active but haven't posted to the hub. A "silent" worker has tool calls progressing (from events.jsonl) but zero hub messages. Silent workers may be working fine, but if silent AND showing errors, they need intervention.

```bash
# Detect silent workers (active with tool calls but no hub posts)
$HUB exec '
  const workers = sdk.listWorkers({ status: "active" });
  const silent = workers.filter(w => w.toolCalls > 10 && w.hubMessages === 0);
  return { silent: silent.map(w => ({ id: w.id, toolCalls: w.toolCalls, errors: w.errors })) };
'
```

### Orchestrator Monitoring Loop

After spawning a batch of workers, the orchestrator should run this loop:

```
1. Register all workers: sdk.registerWorker({ id, agentType, worktreePath, pid })
2. Every 30-60s: sdk.syncAll()
3. Check: any failed? any lost? any silent with errors?
4. Act: retry failed workers, investigate silent+errored workers
5. After all done: final syncAll() + verify all completed
```

This replaces ad-hoc `checkWorker` polling with deterministic, events-based monitoring.

---

## When to Use the Hub

### ✅ Always Use For:
- **Posting findings** — Scout discoveries, snippets, constraints
- **Requesting help** — Executor blocked, needs info, stuck
- **Status updates** — Progress tracking, checkpoints, completion
- **Cross-worker coordination** — Search what other workers found
- **Decision tracking** — Creative proposals, Orchestrator approvals
- **Trail logging** — Audit trail for MemoryMiner extraction

### ❌ Never Use For:
- **Direct file access** — Use hub exec, not `cat .git/devpartner/hub.db`
- **Source code storage** — Use snippets in board, not full files in hub
- **Large binary data** — Hub is for text messages only
- **Secret storage** — Never post tokens, credentials, private keys

---

## Dashboard vs CLI

The web dashboard (`$HUB serve`) provides read-only monitoring. For interactive debugging, use the CLI:

| Need | Tool | Command |
|------|------|---------|
| Overview / live monitoring | Dashboard | `$HUB serve --port 3000` |
| Search messages | CLI | `$HUB exec 'return sdk.search("blocked timeout")'` |
| Filter by channel | CLI | `$HUB exec --channel '#worker-B042' 'return sdk.getFindings()'` |
| Worker event details | CLI | `$HUB exec 'return sdk.getWorkerStatus("<id>", true)'` |
| Unresolved requests | CLI | `$HUB exec 'return sdk.getUnresolved()'` |

## After Modifying Hub Code

After any code change to `agents-hub/src/`:
1. `npm run build` — verifies TypeScript compiles AND ncc bundles correctly
2. `npm test` — runs all unit + integration tests
3. Restart `$HUB serve` — verify the dashboard renders
4. **Check for orphan files**: every exported function in `src/` should be imported somewhere
   — orphan files won't be included in the ncc bundle and will silently fail at runtime
