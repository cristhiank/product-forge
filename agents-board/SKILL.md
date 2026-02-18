---
name: agents-board
description: >-
  Use when any agent needs to read or write shared state — facts, decisions,
  plans, alerts, snippets, trails, or constraints. Covers creating tasks,
  checking task status, posting facts or decisions, setting or advancing plans,
  raising alerts, searching the board, caching file snippets, and viewing
  progress. Required for multi-agent coordination in DevPartner workflows.
  Provides persistent shared state with full-text search, role-based write
  permissions, and audit trails.
---

# Agents Board

A shared filesystem blackboard that lets stateless agents build on each other's work. Each agent reads and writes structured entities to disk — no middleman needed for data transfer.

## When to Use

Use this skill whenever an agent or the user needs to interact with the shared board. This includes:

- Creating or resuming a task (shared coordination scope)
- Reading or posting facts, decisions, alerts, snippets, trails, or constraints
- Setting, advancing, or completing plan steps
- Searching the board for context or prior findings
- Checking task status, progress, or active alerts
- Caching file content as snippets for other agents to reference

## Quick Start

The board CLI is at `scripts/board.js`. It supports **CLI commands** for simple operations and **exec** for JavaScript composition. All output is JSON.

```bash
BOARD="node <skill-dir>/scripts/board.js"

# Create a task (scopes all entities)
TASK=$($BOARD create-task --goal "Implement password reset" | jq -r '.task_id')

# Add facts (evidence-backed assertions)
$BOARD add-fact --task-id $TASK --agent researcher \
  --content "Auth uses bcrypt for hashing" --confidence high \
  --evidence '[{"type":"file","reference":"src/auth.ts:15-23"}]' \
  --tags "auth,security"

# Search (FTS5 with BM25 ranking)
$BOARD search "authentication" --task-id $TASK --limit 5

# Set a plan with steps
$BOARD set-plan --task-id $TASK --agent planner \
  --goal "Implement password reset" --approach "Token-based email flow" \
  --steps '[{"title":"Create token generator","description":"...","done_when":"Tests pass"}]'

# Advance and complete steps
$BOARD advance-step --task-id $TASK --agent implementer
$BOARD complete-step --task-id $TASK --agent implementer --verification true

# Get a ~100-token status overview
$BOARD view --task-id $TASK

# See all commands
$BOARD help
```

### Code Execution (multi-step queries)

```bash
$BOARD exec --task-id $TASK --agent coordinator --code '
  const facts = board.getFacts({ confidence: ["high"] });
  const plan = board.getPlan();
  const alerts = board.getAlerts({ resolved: false });
  return {
    fact_count: facts.length,
    current_step: plan?.steps?.findIndex(s => s.status === "in_progress"),
    active_alerts: alerts.filter(a => a.severity === "blocker").length
  };
'
```

The `board` object exposes the full API — see [API Reference](references/api-reference.md).

## Core Concepts

### Entities

The board stores 7 entity types. Each has an auto-incrementing ID within its task scope.

| Entity | ID | Purpose |
|--------|----|---------|
| **Fact** | `F-N` | Evidence-backed assertions about the codebase or domain |
| **Decision** | `D-N` | Proposed and approved/rejected choices |
| **Alert** | `A-N` | Issues requiring attention (blocker, warning, info) |
| **PlanStep** | `S-N` | Ordered steps in an execution plan |
| **Snippet** | `X-N` | Cached file content with line ranges |
| **Trail** | `T-N` | Markers for decision rationale and lessons learned |
| **Constraint** | `C-N` | Requirements or limitations on the task |

### Role-Based Permissions

Every write operation requires an `--agent <role>` flag. The board enforces which roles can perform which operations. Define roles to match your agent architecture — the board doesn't prescribe agent names or workflows.

### Progressive Context Loading

1. **Status** (~100 tokens): `view` — goal, progress, alert count
2. **Targeted queries** (~200 tokens): `get-facts --confidence high`, `search "auth"`
3. **Full detail** (as needed): `get-plan`, `exec --code '...'`

Load only what the current step needs. Never dump everything into a prompt.

### Storage Layout

```
.dev_partner/
├── tasks/
│   └── <task_id>/
│       ├── meta.json        # Task metadata, ID sequences
│       ├── mission.json     # Goal, constraints
│       ├── status.json      # Phase, progress
│       ├── plan.json        # Execution plan with steps
│       ├── facts.jsonl      # Append-only facts
│       ├── decisions.jsonl  # Append-only decisions
│       ├── alerts.jsonl     # Append-only alerts
│       ├── snippets.jsonl   # Cached file content
│       ├── trails.jsonl     # Decision markers
│       └── .index/          # SQLite FTS5 indexes
├── archive/                 # Completed/cancelled tasks
└── audit/                   # Operation logs
```

## References

- **[API Reference](references/api-reference.md)** — All CLI commands, exec API, flags, output formats
- **[Examples](references/examples.md)** — Complete workflow patterns with CLI commands
