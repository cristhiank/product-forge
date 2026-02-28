# DevPartner v17 — Vision

## What Is v17?

DevPartner v17 is a **multi-orchestrator architecture** that enables parallel AI agent work on the same codebase. It builds on v16's Tiered Autonomy model and adds:

1. **Super-Orchestrator** — A new top-level agent that reads the backlog, identifies independent work items, and spawns multiple Orchestrator instances in parallel
2. **agents-hub** — A new inter-agent communication skill (replacing agents-board) that enables cross-worker knowledge sharing and blocked-worker resolution
3. **Git worktree isolation** — Each worker operates in its own git worktree, merging back to main on completion

## Why v17?

### The v16 Bottleneck

v16's single-Orchestrator model works well for individual tasks. But real projects have multiple independent items:

```
Backlog:
  B-042: Implement password reset        (auth module)
  B-043: Add email notification service   (email module)
  B-044: Refactor API error handling      (api module)
  B-045: Update user dashboard charts     (frontend)
```

B-042, B-043, B-044, B-045 touch different parts of the codebase. A human team would assign each to a different developer working in parallel. v16 does them sequentially.

### What Changes

| Dimension | v16 | v17 |
|-----------|-----|-----|
| Parallelism | Sequential (1 task at a time) | N tasks in parallel |
| Agent count | 1 Orchestrator + 5 subagents | 1 Super-Orchestrator + N × (1 Orchestrator + 5 subagents) |
| Communication | agents-board (single task scope) | agents-hub (channels, cross-worker) |
| Git model | Single branch | Main + N feature branches via worktrees |
| Conflict handling | N/A | Auto-merge clean, auto-resolve trivial, ask on complex |

### What Doesn't Change

- **Core agents** (Scout, Creative, Planner, Verifier, Executor, Memory-Miner) — same prompts with minor hub updates
- **Tier model** (T1-T5) — each worker classifies and executes using the same model
- **Direct Mode** (T1-T2) — still handled inline by each worker's Orchestrator
- **Backlog as source of truth** — Super-Orchestrator reads from the same backlog
- **Multi-model audit** — each worker runs its own audit for T3+

## Design Principles

### 1. Isolation by Default, Sharing by Choice
Workers operate in their own worktrees and channels. They can choose to read other workers' channels for context, but they never interfere with each other's work.

### 2. Fail Independently
If Worker B-042 crashes, Worker B-043 continues unaffected. The Super-Orchestrator handles the failure in isolation.

### 3. Human Stays in Control
- User confirms which items to parallelize before spawning
- User resolves complex merge conflicts
- User can stop any individual worker
- Super-Orchestrator presents unified progress

### 4. Minimal Overhead
v17 adds exactly one new agent (Super-Orchestrator) and one new skill (agents-hub). Everything else is the same v16 architecture with minor updates.

### 5. Git-Native
Uses standard git worktrees and branches. No custom VCS tooling. Any developer can `git worktree list` and understand what's happening.

## Research Foundation

The v17 architecture is informed by:

| Source | Key Pattern Applied |
|--------|-------------------|
| **Anthropic "Building Effective Agents"** | Orchestrator-Workers pattern; keep it simple, composable |
| **GitHub Agent HQ** | Multiple coding agents on same repo via branches + PRs |
| **Microsoft Magentic-One** | Task Ledger + Progress Ledger; replanning on stall detection |
| **OpenAI Swarm** | HandoffMessage for agent-to-agent delegation; hand off to "user" for blocks |
| **Copilot CLI** | Custom agents via `--agent`, autonomous mode via `--allow-all --autopilot --no-ask-user` |

## Success Metrics

- **Throughput**: 3-5x faster for projects with 3+ independent backlog items
- **Conflict rate**: <10% of merges require user intervention
- **Worker independence**: Workers complete 90%+ of their task without needing Super-Orchestrator help
- **Knowledge sharing**: Workers reference other workers' findings in 30%+ of T3+ sessions
- **Zero data loss**: No git conflicts cause code loss; no SQLite corruption from concurrent access
