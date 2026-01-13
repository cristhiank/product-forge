# Agent Collaboration Board MCP Server

The Agent Collaboration Board MCP Server exposes the board system via the Model Context Protocol (MCP), enabling AI agents to collaborate on software development tasks through a shared state machine. **Supports multiple concurrent tasks with explicit task targeting.**

## Tool Surface (Minimal Architecture)

The server intentionally exposes **two** MCP tools:

1. `task` — task lifecycle (`create`, `list`, `archive`)
2. `board` — **JavaScript code execution** against a sandboxed `board` API (all reads/writes/search happen here)



## Data Storage

### Location: Project-Specific

The board data is stored **per-project**, not shared globally. The server determines the project path using this priority:

1. **`--path` CLI argument** - Explicit path via command line
2. **`AGENT_COLLAB_PROJECT` environment variable** - Primary (set in MCP config)
3. **Current working directory** (`process.cwd()`) - Default fallback

### Multi-Task Directory Structure

```
<project-root>/
└── .dev_partner/
  ├── tasks/
  │   ├── 20260109-143025-123/  # Task 1 board
  │   │   ├── meta.json
  │   │   ├── mission.json
  │   │   ├── status.json
  │   │   ├── plan.json
  │   │   ├── facts.jsonl
  │   │   ├── decisions.jsonl
  │   │   ├── alerts.jsonl
  │   │   ├── snippets.jsonl
  │   │   ├── trails.jsonl
  │   │   └── .index/
  │   │       ├── direct.db
  │   │       ├── graph.db
  │   │       ├── temporal.db
  │   │       └── ck/
  │   │           └── documents/
  │   └── ...
  ├── archive/                   # Archived (completed/cancelled) tasks
  │   └── <task_id>/
  └── audit/
    └── <task_id>.jsonl        # Audit trail per task
```

### Important Notes

1. **Multiple concurrent tasks**: Work on multiple tasks simultaneously without conflicts
2. **Explicit task targeting**: Every operation requires a `task_id` parameter
3. **Task isolation**: Each task has independent board state
4. **No global active task**: Multiple agents can work on different tasks concurrently
5. **Git-friendly**: Add `.dev_partner/` to `.gitignore` if you don't want to track board state

## Installation & Configuration

### Prerequisites

```bash
cd /path/to/agents-board
npm install
npm run build
```

### VS Code (Claude Code Extension)

Create `.mcp.json` in your **project root**:

**Option 1: Using `--path` argument (recommended)**
```json
{
  "mcpServers": {
    "agent-collab-board": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/agents-board/dist/cli.js", "serve", "--path", "/path/to/your/project"]
    }
  }
}
```

**Option 2: Using environment variable**
```json
{
  "mcpServers": {
    "agent-collab-board": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/agents-board/dist/cli.js", "serve"],
      "env": {
        "AGENT_COLLAB_PROJECT": "/path/to/your/project"
      }
    }
  }
}
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "agent-collab-board": {
      "command": "node",
      "args": ["/absolute/path/to/agents-board/dist/cli.js", "serve", "--path", "/path/to/your/project"]
    }
  }
}
```

### Claude Code CLI

```bash
# Add for current project
claude mcp add --transport stdio --scope project agent-collab-board -- \
  node /path/to/agents-board/dist/cli.js serve

# Add globally (uses cwd of each session)
claude mcp add --transport stdio agent-collab-board -- \
  node /path/to/agents-board/dist/cli.js serve
```

### Verify Installation

```bash
claude mcp list
```

## Available Tools

### `task` tool

`task` manages task lifecycle. It is the only way to create/list/archive tasks.

Supported operations:

- `create` — create a task, returns `task_id`
- `list` — list all tasks
- `archive` — archive a task (must be `complete` or `cancelled`)

### `board` tool

`board` executes JavaScript code in a sandbox with a single injected object: `board`.

Use:

- `board.help()` to view the full API reference
- `board.view()` / `board.view("minimal", agent)` / `board.view("enhanced", agent, options)` for compiled views
- `board.getFacts()` / `board.addFact()` / `board.setPlan()` / `board.raiseAlert()` etc for reads/writes

All permission checks are enforced based on the `agent` parameter passed to the MCP tool.

## MCP Resources

The server exposes resources for direct reading. Resources use the format `board://<task_id>/<type>`:

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

## Agent Roles & Permissions

| Role | Primary Purpose |
|------|----------------|
| `orchestrator` | Workflow control, task management, plan setting, decision approval |
| `scout` | Codebase exploration, fact gathering |
| `creative` | Ideation, decision proposals |
| `verifier` | Validation, fact verification |
| `executor` | Implementation, step execution |

### Permission Matrix

The runtime permission checks are enforced by the board API (see `board.help()` for write operation details).

At a high level:

- **Orchestrator**: workflow control (mission/plan/decision approval, archive)
- **Scout**: facts, constraints
- **Creative**: propose decisions
- **Verifier**: verify facts + update status
- **Executor**: step execution + implementation updates

## Workflow Phases

```
setup → exploration → ideation → planning → plan_verify → execution → result_verify → complete
                                    ↓              ↓              ↓
                                 blocked       blocked         blocked
```

| Phase | Description |
|-------|-------------|
| `setup` | Task created, mission defined |
| `exploration` | Scout gathers facts about codebase |
| `ideation` | Creative proposes approaches (optional for simple tasks) |
| `planning` | Orchestrator creates execution plan |
| `plan_verify` | Verifier validates plan feasibility |
| `execution` | Executor implements steps |
| `result_verify` | Verifier validates implementation |
| `complete` | Task finished successfully |
| `blocked` | Waiting on blocker resolution |
| `cancelled` | Task abandoned |

## Example Usage

### Creating a Task
Create a task:

```json
{
  "tool": "task",
  "arguments": {
    "operation": "create",
    "goal": "Add user authentication to the API",
    "context": "Express.js backend, PostgreSQL database",
    "constraints": ["Must use JWT tokens", "No breaking changes to existing endpoints"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "task_id": "20260109-143025-123",
  "goal": "Add user authentication to the API",
  "phase": "setup"
}
```

### Listing Tasks

```json
{
  "tool": "task",
  "arguments": { "operation": "list" }
}
```

**Response:**
```json
{
  "tasks": [
    {
      "task_id": "20260109-143025-123",
      "goal": "Add user authentication to the API",
      "phase": "execution",
      "current_step": 2,
      "total_steps": 5
    },
    {
      "task_id": "20260109-150030-456",
      "goal": "Fix pagination bug",
      "phase": "complete",
      "current_step": 3,
      "total_steps": 3
    }
  ],
  "total": 2
}
```

### Adding a Fact (requires task_id)
Facts are written via the `board` tool by executing code:

```json
{
  "tool": "board",
  "arguments": {
    "task_id": "20260109-143025-123",
    "agent": "scout",
    "code": "return board.addFact({ content: 'User model exists in src/models/user.ts with email and password fields', confidence: 'high', evidence: [{ type: 'file', reference: 'src/models/user.ts:15-25', excerpt: 'export interface User { email: string; password: string; }' }], tags: ['models', 'auth'] });"
  }
}
```

### Setting a Plan (requires task_id)
Plans are set via `board.setPlan(...)`:

```json
{
  "tool": "board",
  "arguments": {
    "task_id": "20260109-143025-123",
    "agent": "orchestrator",
    "code": "return board.setPlan({ goal: 'Implement JWT authentication', approach: 'Add auth middleware and login/register endpoints', steps: [{ action: 'Create JWT utility functions', files: ['src/utils/jwt.ts'], verification: 'Unit tests pass' }, { action: 'Add auth middleware', files: ['src/middleware/auth.ts'], depends_on: [1], verification: 'Middleware blocks unauthenticated requests' }, { action: 'Create login endpoint', files: ['src/routes/auth.ts'], depends_on: [1, 2], verification: 'Login returns valid JWT' }] });"
  }
}
```

### Archiving a Completed Task

```json
{
  "tool": "task",
  "arguments": { "operation": "archive", "task_id": "20260109-150030-456" }
}
```

## Troubleshooting

### task_id is required

All task-scoped operations require an explicit `task_id`. First create a task:

```json
{ "tool": "task", "arguments": { "operation": "create", "goal": "Your task goal" } }
```

Then use the returned `task_id` for all subsequent operations.

### Task not found

Use `task` with `operation: "list"` to see available tasks and their IDs.

### Permission denied

Each tool validates the agent role. Ensure you're using the correct agent for the operation (see Permission Matrix above).

### Search returns no results

The search index is built incrementally. After adding entities, they're immediately indexed. If using a fresh task, add some facts first.

## File Formats

### meta.json
```json
{
  "schema_version": "2.0",
  "task_id": "20260109-143025-123",
  "created_at": "2026-01-09T14:25:30.000Z",
  "updated_at": "2026-01-09T15:30:00.000Z",
  "phase": "execution",
  "classification": "standard",
  "sequences": { "fact": 5, "decision": 2, "alert": 1, "step": 4, "constraint": 2 }
}
```

### facts.jsonl (one JSON object per line)
## API Reference

Run:

```json
{
  "tool": "board",
  "arguments": {
    "task_id": "<task_id>",
    "agent": "scout",
    "code": "return board.help();"
  }
}
```

…to retrieve the full, current API surface, including snippets and trails.
```json
{"id":"F-1","content":"Uses Express.js","confidence":"high","evidence":[{"type":"file","reference":"package.json"}],"source":"scout","discovered_at":"2026-01-09T14:26:00.000Z","tags":["framework"]}
{"id":"F-2","content":"PostgreSQL 14 database","confidence":"high","evidence":[{"type":"file","reference":"docker-compose.yml"}],"source":"scout","discovered_at":"2026-01-09T14:26:30.000Z","tags":["database"]}
```
