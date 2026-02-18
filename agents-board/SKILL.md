---
name: agents-board
description: >-
  Multi-agent collaboration board for coordinating specialized agents on software tasks.
  Use when orchestrating Scout, Creative, Verifier, Executor, or Memory-Miner agents.
  Provides shared state (facts, decisions, plans, alerts, snippets, trails) with
  hybrid search, role-based permissions, and audit trails. Supports both CLI commands
  and JavaScript code execution for complex multi-step operations.
---

# Agents Board Skill

A shared blackboard that lets stateless agents build on each other's work without the Orchestrator becoming a context-stuffing bottleneck.

## When to Use

Use this skill when you need to:

- Coordinate multiple specialized agents on a software task
- Store and retrieve facts, decisions, plans, alerts, or snippets
- Search across board entities by keyword or semantic meaning
- Track workflow phases and plan execution progress
- Log trail markers for memory extraction
- Validate board state integrity

## Quick Start

The board CLI supports two modes: **commands** for simple operations and **exec** for JavaScript composition.

The CLI entry point is `scripts/board.js` in this skill directory. All commands require `--path` to specify the project root (defaults to `cwd`).

### CLI Commands (simple operations)

```bash
BOARD="node /path/to/agents-board/scripts/board.js"

# Task lifecycle
$BOARD create-task --goal "Implement auth" --context "Express.js backend"
$BOARD list-tasks
$BOARD archive-task --task-id T-1

# Facts
$BOARD add-fact --task-id T-1 --agent scout \
  --content "API uses JWT" --confidence high \
  --evidence '[{"type":"file","reference":"src/auth.ts"}]'
$BOARD get-facts --task-id T-1 --confidence high

# Plan
$BOARD set-plan --task-id T-1 --agent orchestrator --goal "Implement auth" \
  --approach "Add JWT middleware" --steps '[{"title":"Add middleware","description":"...","done_when":"Tests pass"}]'
$BOARD get-plan --task-id T-1
$BOARD advance-step --task-id T-1 --agent executor
$BOARD complete-step --task-id T-1 --agent executor

# Search (FTS5 keyword search with BM25 ranking)
$BOARD search "authentication patterns" --task-id T-1 --limit 5

# Status
$BOARD view --task-id T-1
$BOARD help
```

### Code Execution (complex multi-step operations)

```bash
node scripts/board.js exec --task-id T-1 --agent orchestrator --code '
  const facts = board.getFacts({ confidence: ["high"] });
  const plan = board.getPlan();
  const alerts = board.getAlerts({ resolved: false });
  return {
    fact_count: facts.length,
    current_step: plan?.steps?.findIndex(s => s.status === "in_progress"),
    blockers: alerts.filter(a => a.severity === "blocker").length
  };
'
```

The `board` object in code execution has the same API as the full board — see [API Reference](references/api-reference.md).

### JSON Output

All commands output JSON for easy parsing with `jq`:

```bash
# Get fact IDs
node scripts/board.js get-facts --task-id T-1 | jq -r '.[].id'

# Get current phase
node scripts/board.js view --task-id T-1 | jq -r '.phase'

# Count unresolved alerts
node scripts/board.js get-alerts --task-id T-1 --resolved false | jq 'length'
```

## Core Concepts

### Entity Types

| Entity | ID Format | Purpose | Written By |
|--------|-----------|---------|------------|
| **Fact** | `F-N` | Evidence-backed assertions | Scout, Verifier, Executor |
| **Decision** | `D-N` | Architectural choices | Creative (propose), Orchestrator (approve) |
| **Alert** | `A-N` | Issues requiring attention | Any agent |
| **PlanStep** | `S-N` | Atomic units of work | Orchestrator (set), Executor (advance/complete) |
| **Snippet** | `X-N` | Cached file content | Scout (primary), any agent |
| **Trail** | `T-N` | Memory candidates | Executor (primary) |
| **Constraint** | `C-N` | Requirements/limitations | Orchestrator, Scout |

### Workflow Phases

```
setup → exploration → ideation → planning → plan_verify → execution → result_verify → complete
```

Each phase has specific agents active. See [Coordination Protocol](references/coordination-protocol.md).

### Progressive Context Loading

1. **Metadata** (~100 tokens): `view` — phase, goal, progress, alert count
2. **Targeted queries** (~200 tokens): `get-facts --confidence high`, `search "auth"`
3. **Full detail** (as needed): `get-plan`, `exec --code '...'`

Never dump everything into the prompt. Load only what the current step needs.

### Storage

Board state is stored in `.dev_partner/tasks/<task_id>/` with JSONL files:

```
.dev_partner/
├── tasks/
│   └── <task_id>/
│       ├── meta.json        # Task metadata, sequences
│       ├── mission.json     # Goal, constraints
│       ├── status.json      # Phase, progress
│       ├── plan.json        # Execution plan
│       ├── facts.jsonl      # Append-only facts
│       ├── decisions.jsonl  # Append-only decisions
│       ├── alerts.jsonl     # Append-only alerts
│       ├── snippets.jsonl   # Cached file content
│       ├── trails.jsonl     # Memory candidates
│       └── .index/          # SQLite search indexes
├── archive/                 # Completed/cancelled tasks
└── audit/                   # Operation logs
```

## Agent Roles & Permissions

| Role | Can Write | Cannot Write |
|------|-----------|-------------|
| **orchestrator** | mission, plan, constraints, approve/reject decisions, alerts | facts, snippets |
| **scout** | facts, snippets, constraints, alerts | plan, decisions |
| **creative** | propose decisions, alerts | facts, plan, snippets |
| **verifier** | verify facts, alerts, status | plan, decisions, snippets |
| **executor** | advance/complete/fail steps, facts, snippets, trails, alerts | plan, decisions |

See [Agent Roles](references/agent-roles.md) for full permission matrix.

## Common Patterns

### Orchestrator: Package context for next agent

```bash
node scripts/board.js exec --task-id T-1 --agent orchestrator --code '
  const facts = board.getFacts({ confidence: ["high", "medium"] });
  const snippets = board.getSnippets({ staleness: "fresh" });
  const plan = board.getPlan();
  return {
    facts: facts.slice(0, 10).map(f => ({ id: f.id, content: f.content })),
    snippets: snippets.slice(0, 5).map(s => ({ id: s.id, path: s.path, purpose: s.purpose })),
    current_step: plan?.steps?.find(s => s.status === "pending")
  };
'
```

### Scout: Add fact with evidence

```bash
node scripts/board.js add-fact --task-id T-1 --agent scout \
  --content "Auth module uses bcrypt for password hashing" \
  --confidence high \
  --evidence "src/auth/hash.ts:15-23" \
  --tags "auth,security"
```

### Executor: Complete step with trail

```bash
# Complete step
node scripts/board.js complete-step --task-id T-1 --agent executor \
  --files-changed "src/auth/magic-token.ts" \
  --verification-passed

# Log trail (mandatory)
node scripts/board.js append-trail --task-id T-1 --agent executor \
  --marker "[DECISION]" \
  --summary "Used crypto.randomBytes for token generation" \
  --evidence "X-1#L45"
```

### Search: Find relevant context

```bash
# Find facts about authentication (hybrid search)
node scripts/board.js search "authentication security" --task-id T-1 --limit 5

# Find snippets by file path (keyword search)
node scripts/board.js search "src/auth" --task-id T-1 --mode keyword --types snippet
```

## References

For detailed information, see:

- **[`references/api-reference.md`](references/api-reference.md)** — Full CLI command documentation, exec API, all options
- **[`references/coordination-protocol.md`](references/coordination-protocol.md)** — Workflow phases, gates, auto-proceed rules, context budgets
- **[`references/agent-roles.md`](references/agent-roles.md)** — Role permissions, stop conditions, anti-patterns per agent
- **[`references/examples.md`](references/examples.md)** — Complete workflow examples for each agent role

---

**Summary:** Use `node scripts/board.js <command>` for simple operations, `node scripts/board.js exec --code '...'` for complex multi-step queries. All output is JSON. The board is the shared truth — agents write to it, read from it, and search across it.
