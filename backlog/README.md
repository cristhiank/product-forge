# Backlog MCP Server (`backlog`)

This MCP server exposes a **single code-execution tool** named **`backlog`** that allows agents to maintain folder-based backlogs. Supports both **single-project** and **multi-project** modes.

## Key properties

- **Exactly one MCP tool:** `backlog`
- **Code-execution pattern:** user code runs in a restricted `node:vm` sandbox (modeled after `agents-board`)
- **Filesystem-backed by default:** rooted at `app/.backlog` (configurable)
- **Multi-project support:** manage independent backlogs per subfolder with cross-project references and a global view
- **Snapshot-first history:** `updateBody()` stores previous content under `<root>/.history/<id>/...` with an auto-incremented version

## Tool API (from inside the sandbox)

Use `backlog.help()` to get the full API reference and repo-specific conventions.

Operations (v2):

- `help()`
- `projects()`
- `list({ project?, folder?, limit?, offset? })`
- `get({ id })`
- `search({ text, project?, folder?, limit? })`
- `globalSearch({ text, folder?, limit? })`
- `stats({ project? })`
- `globalStats()`
- `create({ kind, title, project?, description?, acceptance_criteria?, tags?, priority?, parent?, depends_on?, related? })`
- `move({ id, to })`
- `complete({ id, completedDate? })`
- `archive({ id })`
- `validate({ id })`
- `updateBody({ id, body, message? })`
- `getHistory({ id, limit? })`
- `xref({ id })`

## Multi-Project Mode

When working with multiple projects under one workspace, the server can manage independent backlogs per project while supporting cross-project references and unified views.

### Auto-Discovery

Scans a directory for subdirectories containing `.backlog/` folders:

```bash
node dist/cli.js serve --scan-dir /path/to/workspace
```

Given a workspace like:
```
workspace/
  frontend/.backlog/    → project "frontend"
  api/.backlog/         → project "api"
  shared/.backlog/      → project "shared"
```

### Explicit Roots

Specify project names and paths directly:

```bash
node dist/cli.js serve --roots frontend=./frontend/.backlog,api=./api/.backlog
```

### Config File

Use a `.backlog-projects.json` manifest:

```bash
node dist/cli.js serve --config .backlog-projects.json
```

```json
{
  "projects": [
    { "name": "frontend", "path": "frontend/.backlog" },
    { "name": "api", "path": "services/api/.backlog" }
  ]
}
```

### Project-Scoped IDs

In multi-project mode, IDs are qualified with the project name:

```javascript
// List items for a specific project
return backlog.list({ project: 'frontend', folder: 'next' })

// Get by qualified ID
return backlog.get({ id: 'api/B-001' })

// Create in a specific project
return backlog.create({ kind: 'task', title: 'New task', project: 'api' })

// Global search across all projects
return backlog.globalSearch({ text: 'auth' })
```

### Cross-Project References

Items can reference items from other projects using `depends_on` and `related`:

```javascript
return backlog.create({
  kind: 'task',
  title: 'Add auth UI',
  project: 'frontend',
  depends_on: ['api/B-002'],
  related: ['shared/B-001']
})

// Find all items referencing a given item
return backlog.xref({ id: 'api/B-002' })
```

## Running locally

```bash
cd app/agent_runtime/mcp_servers/backlog
npm ci
npm test
npm run build

# Single-project mode (backward-compatible)
node dist/cli.js serve --root app/.backlog

# Multi-project mode
node dist/cli.js serve --scan-dir /path/to/workspace
```

Notes:
- The CLI intentionally accepts (and ignores) the positional `serve` token, mirroring the `agents-board` CLI style.
- `--root` is resolved relative to the current working directory.

## MCP configuration example

See `backlog.mcp.json` for an example config entry.

## Using the backlog MCP server in VS Code

To use this MCP server inside VS Code, you need an MCP-capable VS Code extension.

### 1) Build the server

From the repo root:

```bash
cd app/agent_runtime/mcp_servers/backlog
npm ci
npm run build
```

### 2) Add an MCP server entry in your VS Code MCP client

#### Single Project

```json
{
  "mcpServers": {
    "backlog": {
      "command": "node",
      "args": [
        "${workspaceFolder}/app/agent_runtime/mcp_servers/backlog/dist/cli.js",
        "serve",
        "--root",
        "${workspaceFolder}/app/.backlog"
      ]
    }
  }
}
```

#### Multi-Project (scan directory)

```json
{
  "mcpServers": {
    "backlog": {
      "command": "node",
      "args": [
        "${workspaceFolder}/app/agent_runtime/mcp_servers/backlog/dist/cli.js",
        "serve",
        "--scan-dir",
        "${workspaceFolder}"
      ]
    }
  }
}
```

If your client does **not** support `${workspaceFolder}`, use absolute paths instead.

### 3) Verify it's working

In your VS Code chat (or the extension's tool playground), call:

- `backlog.help()`

You should see the API reference and examples, including available projects in multi-project mode.

### Notes

- **Tool name:** when connecting directly from VS Code to this MCP server, the server exposes exactly **one** tool named `backlog`.
- **Backlog root:** set `--root` for single project, or use `--scan-dir`/`--roots`/`--config` for multi-project.
- **Workspace trust:** most VS Code MCP clients require the folder to be trusted before enabling local process tools.

## Safety

- All filesystem operations are root-anchored under the configured backlog root(s).
- IDs are validated (`B-040`, `B-040.1`, etc.; `project/B-040` in multi-project mode).
- Sandbox code has no access to `fs`, `process`, `require`, timers, or network APIs.
