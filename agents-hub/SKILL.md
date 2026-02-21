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
  ⛔ CRITICAL: Never read .devpartner/ files directly — always use the hub CLI.
---

# agents-hub

A lightweight messaging hub for multi-agent coordination in DevPartner workflows. Provides channels, full-text search, request/response threading, and real-time watching for agent-to-agent communication.

## Quick Reference — SDK (Preferred)

Use `hub exec` with SDK helpers. The `sdk` and `hub` objects are pre-loaded.

```bash
HUB="node <skill-dir>/scripts/hub.js"

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

## ⛔ CRITICAL: Never Browse .devpartner/ Directly

**WRONG:**
```bash
cat .devpartner/hub.db
ls .devpartner/
sqlite3 .devpartner/hub.db "SELECT ..."
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

### Low-Level Hub Access

The `hub` object is also in scope for operations not covered by SDK:

| Method | Description |
|--------|-------------|
| `hub.post(opts)` | Raw post: `{ channel, type, author, content, tags?, metadata? }` |
| `hub.reply(threadId, opts)` | Raw reply: `{ author, content, tags?, metadata? }` |
| `hub.read(opts?)` | Read with filters: `{ channel?, type?, author?, tags?, since?, limit? }` |
| `hub.search(query, opts?)` | FTS5 search |
| `hub.readThread(messageId)` | Full thread |
| `hub.update(id, opts)` | Update message |
| `hub.channelCreate(name, opts?)` | Create channel |
| `hub.channelList(includeStats?)` | List channels |

---

## Channel Awareness

### Single-Worker Mode (v16 compatible)
- One `#main` channel
- All agents (Scout, Creative, Planner, Executor, Verifier) share one channel

### Multi-Worker Mode (v17)
- `#general` for cross-worker announcements
- `#worker-{item-id}` per parallel worker (e.g., `#worker-B042`, `#worker-B043`)
- Super-Orchestrator monitors all channels

```bash
# Initialize multi-worker hub
$HUB init --mode multi

# Create worker channel
$HUB channel create '#worker-B042' --worker-id B042
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

## Common Workflows

### 1. Post a Finding
```bash
$HUB exec --channel '#main' --author scout \
  'return sdk.postFinding("Auth uses bcrypt for password hashing", {
    tags: ["auth", "security"],
    path: "src/auth.ts",
    lines: [45, 60]
  })'
```

### 2. Search for Context
```bash
# Full-text search
$HUB exec --channel '#main' 'return sdk.search("auth bcrypt")'

# Search specific channel
$HUB exec 'return sdk.search("auth", { channel: "#worker-B042" })'
```

### 3. Request Help When Blocked
```bash
$HUB exec --channel '#worker-B042' --author executor \
  'return sdk.requestHelp("Blocked: SharedTypes.AuthResponse type mismatch", "blocker", {
    target: "super-orchestrator"
  })'
```

### 4. Resolve a Request
```bash
$HUB exec --author orchestrator \
  'return sdk.resolveRequest("<thread-id>", "Worker B043 updated SharedTypes in commit abc123. Pull latest.")'
```

### 5. Log Progress and Trails
```bash
# Progress update
$HUB exec --channel '#main' --author executor \
  'return sdk.postProgress(3, 4, "Implemented token generation, POST and GET endpoints")'

# Trail entry
$HUB exec --channel '#main' --author executor \
  'return sdk.logTrail("[IMPL]", "Implemented magic link auth", {
    details: "Created token generator + endpoints",
    evidence: ["src/auth/magic-token.ts", "src/routes/auth.ts"]
  })'
```

### 6. Decision Workflow
```bash
# Propose
$HUB exec --channel '#main' --author creative \
  'return sdk.proposeDecision("Use email magic link with 15-min token expiration", {
    approachId: "D-1",
    tags: ["auth", "magic-link"]
  })'

# Approve (using the returned message id)
$HUB exec --author orchestrator \
  'return sdk.approveDecision("<thread-id>", "Approved: proceed with D-1")'
```

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
- **Direct file access** — Use hub exec, not `cat .devpartner/hub.db`
- **Source code storage** — Use snippets in board, not full files in hub
- **Large binary data** — Hub is for text messages only
- **Secret storage** — Never post tokens, credentials, private keys

---

## Integration with Agents Board

The hub **complements** the agents-board skill:

| Tool | Purpose | When to Use |
|------|---------|-------------|
| **agents-board** | Task state, plan, snippets, facts, trails | Primary workflow orchestration |
| **agents-hub** | Agent-to-agent messaging, cross-worker coordination | Communication & discovery |

---

## Trigger Words

This skill should activate when agents mention:

**Must-trigger:**
- "post to hub", "check hub", "hub status", "search hub"
- "share finding", "post finding", "add note"
- "blocked", "need help", "stuck", "can't proceed"
- "what has been found", "what do we know", "what's the status"
- "coordinate", "check other workers", "cross-reference"
- "decision", "propose", "approve"
- "progress", "checkpoint", "how far along"

**Should-trigger:**
- "context", "prior findings", "what did scout find"
- "share", "communicate", "tell other agents"
- "trail", "log", "audit"
