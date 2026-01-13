# Agent Collaboration Board

A shared communication infrastructure for multi-agent software development workflows. The Board acts as a centralized state machine that enables specialized agents (orchestrator, scout, creative, verifier, executor) to collaborate on complex tasks.

## Features

- **Multi-Task Support**: Work on multiple concurrent tasks with explicit task targeting
- **MCP Server**: Exposes 2 minimal tools via Model Context Protocol using code execution pattern
- **Role-Based Permissions**: Each agent role has specific read/write capabilities
- **Step-Based Workflow**: Plan steps with dependencies, verification, and optional subtask decomposition
- **Entity Graph**: Facts, decisions, alerts, and constraints with relationship tracking
- **Hybrid Search**: Lexical (BM25) + semantic search across all entities (semantic/hybrid requires the external `ck` binary; otherwise a lightweight fallback search is used)
- **Temporal Tracking**: Timeline queries by phase, time range, or recency
- **Trail System**: Memory candidates for asynchronous extraction by MemoryMiner
- **Audit Log**: Complete operation history for debugging and analysis

## Installation

```bash
npm install @agent-collab/board
```

Requires Node.js >= 20.0.0

## Quick Start

### As MCP Server

```bash
# Run the MCP server
npx -p @agent-collab/board agent-collab-board serve

# Or specify project path
npx -p @agent-collab/board agent-collab-board serve --path /path/to/project
```

Configure in your MCP client (e.g., Claude Desktop):

```json
{
  "mcpServers": {
    "agent-collab-board": {
      "command": "npx",
      "args": ["-p", "@agent-collab/board", "agent-collab-board", "serve", "--path", "/path/to/project"]
    }
  }
}
```

### Programmatic Usage

```typescript
import { getBoardManager } from "@agent-collab/board";

// Get the board manager
const manager = getBoardManager("/path/to/project");

// Create a new task (returns task_id for all subsequent operations)
const { task_id, summary } = manager.createTask({
  goal: "Implement user authentication",
  context: "Express.js backend",
  constraints: ["Must use JWT tokens"],
});

// Get the board for this task
const board = manager.getBoard(task_id);

// Add facts (as scout)
board.addFact("scout", {
  content: "Auth module uses JWT tokens",
  confidence: "high",
  evidence: [{ type: "file", reference: "src/auth/jwt.ts" }],
});

// Set plan (as orchestrator)
board.setPlan("orchestrator", {
  goal: "Add OAuth2 support",
  approach: "Extend existing JWT auth with OAuth2 provider",
  steps: [
    { action: "Create OAuth2 config", files: ["src/auth/oauth.ts"], verification: "Config loads" },
    { action: "Add OAuth2 routes", files: ["src/routes/auth.ts"], verification: "Routes respond" },
  ],
});

// List all tasks
const tasks = manager.listTasks();
```

## Architecture

### Filesystem Layout

```
<project-root>/
└── .dev_partner/
    ├── tasks/
    │   ├── 20260109-143025-123/      # Task 1 (YYYYMMDD-HHMMSS-mmm format)
    │   │   ├── meta.json             # Schema version, task ID, sequences
    │   │   ├── mission.json          # Goal, constraints, routing
    │   │   ├── status.json           # Phase, progress, verification state
    │   │   ├── plan.json             # Steps with dependencies
    │   │   ├── facts.jsonl           # Append-only facts log
    │   │   ├── decisions.jsonl       # Append-only decisions log
    │   │   ├── alerts.jsonl          # Append-only alerts log
    │   │   ├── trails.jsonl          # Memory candidates
    │   │   └── .index/               # SQLite search indexes
    │   │       └── search.db
    │   ├── 20260109-150030-456/      # Task 2
    │   │   └── ...
    │   └── ...
    ├── archive/                       # Archived (completed/cancelled) tasks
    │   └── 20260108-091500-789/
    └── audit/
        └── <task_id>.jsonl           # Audit trail per task
```

### Key Design Principles

- **No global active task**: Multiple agents can work on different tasks concurrently
- **Explicit task targeting**: All operations require `task_id` parameter
- **Task isolation**: Each task has independent board state
- **Append-only logs**: Facts, decisions, alerts use JSONL for durability

## MCP Tools (2 Tools - Minimal Architecture)

**Important**: All task-scoped operations require explicit `task_id` parameter.

> **Minimal Architecture**: Following [Anthropic's MCP evolution](https://www.anthropic.com/engineering/code-execution-with-mcp), we achieved a 95% tool reduction (42 → 2) using code execution. The LLM writes JavaScript code to interact with the board API, enabling complex multi-step operations in a single call. See [TOOL_BEST_PRACTICES.md](docs/TOOL_BEST_PRACTICES.md) for design rationale.

### Tools
| Tool | Description |
|------|-------------|
| `task` | Task lifecycle (operation: create/list/archive) |
| `board` | Execute JavaScript code against board API |

### Task Operations

```typescript
// Create a new task
task({ operation: "create", goal: "Implement feature X", context: "...", constraints: [...] })

// List all tasks
task({ operation: "list" })

// Archive completed task
task({ operation: "archive", task_id: "..." })
```

### Board Code Execution

```typescript
// Get status and high-confidence facts
board({
  task_id: "...",
  agent: "scout",
  code: `
    const status = board.view();
    const facts = board.getFacts({ confidence: ['high'] });
    return { status, facts };
  `
})

// Add a fact with evidence
board({
  task_id: "...",
  agent: "scout",
  code: `
    return board.addFact({
      content: 'API uses JWT for authentication',
      confidence: 'high',
      evidence: [{ type: 'file', reference: 'src/auth.ts' }],
      tags: ['auth', 'security']
    });
  `
})

// Get API documentation
board({ task_id: "...", agent: "scout", code: "return board.help();" })
```

### Board API Reference

Use `board.help()` for full API documentation. Key operations:

**Quick Access**: `view()`, `view("minimal", agent)`, `view("enhanced", agent, options)`, `help()`

**Read**: `getMission()`, `getStatus()`, `getPlan()`, `getFacts(filter?)`, `getDecisions(filter?)`, `getAlerts(filter?)`

**Search**: `search(query)`, `advancedSearch(query)`, `textSearch(text, options?)`

**Graph**: `findRelated(id, options?)`, `findPath(from, to)`, `getSupporting(id)`, `getContradicting(id)`

**Write**: `addFact(...)`, `proposeDecision(...)`, `setPlan(...)`, `advanceStep()`, `completeStep(...)`, `raiseAlert(...)`

## Entity Types

### Fact
Evidence-backed assertions about the codebase or task.
```typescript
{
  id: "F-1",
  content: "Database uses PostgreSQL 14",
  confidence: "high" | "medium" | "low",
  evidence: [{ type: "file", reference: "docker-compose.yml", excerpt: "..." }],
  tags: ["database", "infrastructure"],
  supports?: ["D-1"],      // Supports decision D-1
  contradicts?: ["F-2"],   // Contradicts fact F-2
}
```

### Decision
Architectural or implementation choices.
```typescript
{
  id: "D-1",
  title: "Use Redis for caching",
  description: "...",
  rationale: "...",
  status: "proposed" | "approved" | "rejected" | "superseded",
  alternatives: [{ name: "Memcached", pros: [...], cons: [...] }],
  based_on: ["F-1", "F-3"],  // Facts supporting this decision
  affects: ["S-2", "S-3"],   // Plan steps affected
}
```

### PlanStep
Atomic unit of work with optional subtask decomposition.
```typescript
{
  id: "S-1",
  number: 1,
  action: "Create database schema",
  files: ["src/db/schema.sql"],
  depends_on: [],
  verification: "Migrations run successfully",
  status: "pending" | "in_progress" | "complete" | "failed" | "skipped",
  subtasks?: [
    { id: "S-1.1", action: "Create users table", status: "complete" },
    { id: "S-1.2", action: "Create posts table", status: "pending" },
  ],
}
```

### Alert
Issues or blockers requiring attention.
```typescript
{
  id: "A-1",
  severity: "blocker" | "major" | "minor" | "info",
  title: "Missing test coverage",
  description: "...",
  blocking_step?: "S-3",
  resolved: false,
}
```

### Constraint
Requirements or limitations on the task.
```typescript
{
  id: "C-1",
  description: "Must support Node.js 18+",
  source: "user" | "discovered",
}
```

## Workflow Phases

1. **setup** - Board created, mission defined
2. **exploration** - Scout gathers facts
3. **ideation** - Creative proposes decisions (optional)
4. **planning** - Orchestrator creates plan
5. **plan_verify** - Verifier validates plan
6. **execution** - Executor implements steps
7. **result_verify** - Verifier validates results
8. **complete** - Task finished
9. **blocked** / **cancelled** - Terminal states

## Agent Permissions

| Operation | orchestrator | scout | creative | verifier | executor |
|-----------|:------------:|:-----:|:--------:|:--------:|:--------:|
| task_create | ✓ | | | | |
| task_archive | ✓ | | | | |
| set_mission | ✓ | | | | |
| add_constraint | ✓ | ✓ | | | |
| add_fact | | ✓ | | ✓ | ✓ |
| verify_fact | | | | ✓ | |
| propose_decision | | | ✓ | | |
| approve/reject_decision | ✓ | | | | |
| set_plan | ✓ | | | | |
| advance/complete/fail_step | | | | | ✓ |
| decompose_step | | | | | ✓ |
| raise_alert | ✓ | ✓ | ✓ | ✓ | ✓ |
| resolve_alert | ✓ | | | ✓ | ✓ |

## Trail Markers

Trails are memory candidates for the MemoryMiner agent:

- `[BUG_FIX]` - Bug symptoms, root cause, and fix
- `[PREFERENCE]` - User or project preferences
- `[DECISION]` - Important architectural decisions
- `[PATTERN]` - Reusable patterns discovered
- `[SURPRISE]` - Unexpected behaviors or outcomes
- `[GATE]` - Phase transition outcomes

## MCP Resources

Resources use the format `board://<task_id>/<type>`:

| URI Format | Description |
|------------|-------------|
| `board://<task_id>/meta` | Board metadata |
| `board://<task_id>/mission` | Mission details |
| `board://<task_id>/plan` | Current plan |
| `board://<task_id>/status` | Current status |
| `board://<task_id>/facts` | All facts |
| `board://<task_id>/decisions` | All decisions |
| `board://<task_id>/alerts` | All alerts |
| `board://<task_id>/audit` | Audit trail |

## Documentation

- [MCP Server Guide](docs/MCP_SERVER.md) - Detailed MCP server configuration, tools, and examples

## Development

```bash
# Build
npm run build

# Run tests (watch mode)
npm test

# Run tests (one-shot)
npm run test:run

# Watch mode (TypeScript)
npm run dev

# Run MCP server
npm run mcp
```

## License

MIT
