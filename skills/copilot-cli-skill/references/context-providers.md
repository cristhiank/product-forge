# Context Providers

Workers can receive structured context — symlinks, environment variables, files, and prompt sections — via the `contextProviders` option. The **caller** assembles and passes providers; the skill applies them to the worktree.

## Usage

```bash
# Via SDK (recommended)
$WORKER exec --agent Orchestrator --autopilot \
  'return sdk.spawnWorker("implement auth per plan", {
    contextProviders: [
      {
        provider: "my-context",
        version: "1.0",
        context: {
          symlinks: [{ source: "{{repoRoot}}/.shared-data", target: ".shared-data" }],
          env: { SHARED_DB: ".shared-data/db.sqlite" },
          prompt_sections: { tools: "Shared data available at .shared-data/" }
        }
      }
    ]
  })'

# Via CLI flag
$WORKER spawn --prompt "..." --context-providers '[{"provider":"my-ctx","version":"1.0","context":{...}}]'
```

## Provider Schema

```json
{
  "provider": "provider-name",
  "version": "1.0",
  "context": {
    "symlinks": [
      { "source": "{{repoRoot}}/.data", "target": ".data" }
    ],
    "env": {
      "MY_VAR": "value"
    },
    "files": {
      ".worker-init.json": "{ \"workerId\": \"{{workerId}}\" }"
    },
    "prompt_sections": {
      "tools": "Description of available tools for the worker."
    }
  }
}
```

All fields in `context` are optional. Only include what the worker needs.

## Template Variables

- `{{repoRoot}}` — Main repository root (where spawn was called)
- `{{worktreePath}}` — Worker's worktree directory
- `{{workerId}}` — Unique worker ID (UUID)

## Behavior

- If no `contextProviders` are passed, spawn works exactly as before
- Symlinks are created in the worktree; skipped with a warning if source doesn't exist
- **`env` vars are NOT forwarded to SDK sessions** — the `@github/copilot-sdk` `CopilotClient` runs in-process and does not inherit per-worker env overrides. If you need to pass values to the session, use `prompt_sections` or `files` instead.
- Files are written into the worktree at the specified relative paths
- Prompt sections are appended to the worker's prompt
- Provider results are stored in `meta.json` for debugging
