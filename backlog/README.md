# Backlog MCP Server (`backlog`)

This MCP server exposes a **single code-execution tool** named **`backlog`** that allows agents to maintain this repo’s folder-based backlog under `app/.backlog/`.

## Key properties

- **Exactly one MCP tool:** `backlog`
- **Code-execution pattern:** user code runs in a restricted `node:vm` sandbox (modeled after `agents-board`)
- **Filesystem-backed by default:** rooted at `app/.backlog` (configurable)
- **Snapshot-first history:** `updateBody()` stores previous content under `<root>/.history/<id>/...` with an auto-incremented version

## Tool API (from inside the sandbox)

Use `backlog.help()` to get the full API reference and repo-specific conventions.

Operations (v1):

- `help()`
- `list()`
- `get()`
- `search()`
- `stats()`
- `create()`
- `move()`
- `complete()`
- `archive()`
- `validate()`
- `updateBody()`
- `getHistory()`

## Running locally

```bash
cd app/agent_runtime/mcp_servers/backlog
npm ci
npm test
npm run build

# Start MCP server on stdio (typical MCP usage)
node dist/cli.js serve --root app/.backlog
```

Notes:
- The CLI intentionally accepts (and ignores) the positional `serve` token, mirroring the `agents-board` CLI style.
- `--root` is resolved relative to the current working directory.

## MCP configuration example

See `backlog.mcp.json` for an example config entry.

## Using the backlog MCP server in VS Code

To use this MCP server inside VS Code, you need an MCP-capable VS Code extension (the exact UI varies by extension/version, but they generally all ask for the same information: a command + args for the stdio server).

### 1) Build the server

From the repo root:

```bash
cd app/agent_runtime/mcp_servers/backlog
npm ci
npm run build
```

### 2) Add an MCP server entry in your VS Code MCP client

Configure a server named `backlog` that launches `node` and points at the built CLI.

If your VS Code MCP client supports `${workspaceFolder}` substitution (many do), use this:

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

If your client does **not** support `${workspaceFolder}`, use absolute paths instead.

### 3) Verify it’s working

In your VS Code chat (or the extension’s tool playground), call:

- `backlog.help()`

You should see the API reference and examples.

### Notes

- **Tool name:** when connecting directly from VS Code to this MCP server, the server exposes exactly **one** tool named `backlog`.
- **Backlog root:** set `--root` to the backlog directory you want to manage (typically `app/.backlog`).
- **Workspace trust:** most VS Code MCP clients require the folder to be trusted before enabling local process tools.

## Safety

- All filesystem operations are root-anchored under the configured backlog root.
- IDs are validated (`B-040`, `B-040.1`, etc.).
- Sandbox code has no access to `fs`, `process`, `require`, timers, or network APIs.
