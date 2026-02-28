# DevPartner v17 — Constitution Changes

## Overview

The v17 constitution extends v16 with parallel work concepts. Most of v16 remains unchanged — the core tier model, Direct Mode, agent roles, and workflow rules carry forward.

## What Changes

### 1. New Agent: Super-Orchestrator

Added to the agent table:

| Agent | Purpose | Phase |
|-------|---------|-------|
| `Super-Orchestrator` | Coordinate parallel Orchestrators, manage worktrees, resolve blocks | Session-level |
| `Scout` | (unchanged) | Phase 1 |
| `Creative` | (unchanged) | Phase 2 |
| `Planner` | (unchanged) | Phase 3 |
| `Verifier` | (unchanged) | Phase 3b/4b/4c |
| `Executor` | (unchanged) | Phase 4 |
| `Memory-Miner` | (unchanged) | On request |

### 2. agents-hub Replaces agents-board

All board references change:

| v16 | v17 |
|-----|-----|
| `board.addFact(...)` | `hub post --type note --tags '["finding"]'` |
| `board.addSnippet(...)` | `hub post --type note --tags '["snippet"]' --metadata '{"path":"..."}'` |
| `board.proposeDecision(...)` | `hub post --type decision --metadata '{"status":"proposed"}'` |
| `board.approveDecision(...)` | `hub reply --thread <id> --metadata '{"status":"approved"}'` |
| `board.raiseAlert(...)` | `hub post --type request --metadata '{"severity":"..."}'` |
| `board.appendTrail(...)` | `hub post --type note --tags '["trail"]'` |
| `board.setPlan(...)` | `hub post --type note --tags '["plan"]'` |
| `board.advanceStep()` | `hub post --type status --metadata '{"step":N}'` |
| `board.search("...")` | `hub search "..."` |
| `board.view()` | `hub status` |

### 3. Channel Awareness

New section: **Channel Protocol**

```markdown
## Channel Protocol

### Single-Worker Mode (default)
- All messages go to `#main`
- Identical to v16 workflow

### Multi-Worker Mode (v17 parallel)
- Super-Orchestrator creates `#general` + `#worker-{id}` per worker
- Workers post to their own channel + `#general`
- Workers may read any channel for cross-pollination
- Search is cross-channel by default

### Blocked Worker Protocol
When blocked:
1. Post request to own channel with `severity: blocker`
2. Watch for resolution (hub watch)
3. Super-Orchestrator detects and resolves
4. Worker reads resolution and continues
```

### 4. Permissions Matrix Update

| Operation | Super-Orch | Orchestrator | Scout | Creative | Planner | Verifier | Executor |
|-----------|:----------:|:------------:|:-----:|:--------:|:-------:|:--------:|:--------:|
| Spawn workers | Yes | - | - | - | - | - | - |
| Manage worktrees | Yes | - | - | - | - | - | - |
| Read all channels | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Write #general | Yes | Yes | - | - | - | - | - |
| Write #worker-{own} | - | Yes | Yes | Yes | Yes | Yes | Yes |
| Resolve requests | Yes | Yes* | - | - | - | - | - |
| Merge branches | Yes | - | - | - | - | - | - |

*Orchestrator resolves requests within its own worker scope (e.g., scout_requests). Super-Orchestrator resolves cross-worker requests.

### 5. Search-First Rule (replaces Snippets-First)

```markdown
## Search-First Rule

**NEVER read a file without searching the hub first.**

// WRONG
const content = view("src/auth.ts");

// RIGHT
const results = hub search "src/auth.ts" --type note --tags snippet --limit 3
if (results.length === 0) {
  const content = view("src/auth.ts");
  hub post --type note --tags '["snippet"]' --metadata '{"path":"src/auth.ts"}'
}
```

### 6. Worktree Awareness

New section for agents that may run in worktrees:

```markdown
## Worktree Awareness

Agents may be running in a git worktree (parallel mode). Detect with:
  git rev-parse --git-common-dir
  # If output != .git, you're in a worktree

When in a worktree:
- You are on a feature branch, not main
- The hub database is shared with all workers
- Your channel is #worker-{id}
- Commit to your branch freely
- Do NOT force-push, rebase, or modify main
- Do NOT switch branches
```

### 7. Hard Constraints (additions)

| Rule | Description |
|------|-------------|
| **No cross-worktree writes** | Workers must not write to files outside their worktree |
| **No branch switching** | Workers stay on their assigned branch |
| **Hub is the only IPC** | Workers communicate only through agents-hub, never through files or signals |

## What Doesn't Change

- Tier model (T1-T5) and classification
- Direct Mode (T1-T2) protocol
- Delegate Mode phases (1-4c)
- Multi-model audit protocol
- Backlog integration
- Commit hygiene rules
- Memory triggers and trails
- Tool call budgets
- Context pruning rules
- Error escalation
- Evidence format
