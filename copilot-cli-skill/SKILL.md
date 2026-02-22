---
name: copilot-cli-skill
description: >-
  Spawn and manage autonomous Copilot CLI worker processes in isolated git worktrees.
  Use this skill to run multiple parallel Copilot sessions, each working independently
  on different branches and tasks without interfering with your main development environment.
---

# Copilot CLI Skill

Manage autonomous Copilot CLI workers in isolated git worktrees.

## Quick Reference — SDK (Preferred)

Use `worker exec` with SDK helpers. The `sdk` and `manager` objects are pre-loaded.

```bash
WORKER="node <skill-dir>/scripts/worker.js --repo-root ."

# Spawn a worker
$WORKER exec --agent Orchestrator --autopilot \
  'return sdk.spawnWorker("implement magic link authentication per plan.md")'

# Spawn with options
$WORKER exec 'return sdk.spawnWorker("investigate auth bug #42", {
  agent: "Orchestrator",
  model: "claude-opus-4.6",
  allowAllPaths: true
})'

# List all workers
$WORKER exec 'return sdk.listAll()'

# Check specific worker
$WORKER exec 'return sdk.checkWorker("<worker-id>")'

# Clean up a worker
$WORKER exec 'return sdk.cleanupWorker("<worker-id>")'

# Clean up all stopped workers
$WORKER exec 'return sdk.cleanupAll()'
```

The `--agent`, `--model`, and `--autopilot` flags set SDK defaults.

---

## When to Use

- **Run parallel tasks** — Work on multiple features/bugs simultaneously
- **Delegate long-running work** — Spawn a worker for extensive refactoring
- **Isolate risky changes** — Test experimental approaches in separate worktrees
- **Background processing** — Let a worker handle time-consuming tasks autonomously

---

## SDK Method Reference

| Method | Description |
|--------|-------------|
| `sdk.spawnWorker(prompt, opts?)` | Spawn new worker. opts: `{ agent?, model?, autopilot?, worktreeBase?, addDirs?, allowAllPaths?, allowAllUrls?, contextProviders? }` |
| `sdk.checkWorker(workerId)` | Get detailed status: pid, status, prompt, worktree, log size |
| `sdk.listAll()` | List all workers with basic info (id, pid, status) |
| `sdk.cleanupWorker(workerId, force?)` | Kill process, remove worktree, clean state |
| `sdk.cleanupAll(force?)` | Clean up all stopped workers (or all if force=true) |

### Low-Level Manager Access

The `manager` object is also in scope:

| Method | Description |
|--------|-------------|
| `manager.spawn(opts)` | Spawn with full SpawnOptions |
| `manager.getStatus(workerId)` | Detailed WorkerStatus |
| `manager.listWorkers()` | List basic worker info |
| `manager.cleanup(workerId, force?)` | Clean up single worker |

---

## How It Works

### Architecture

```
Main Repo (working on feature-x)
    │
    ├── .copilot-workers/
    │   ├── worker-1/
    │   │   ├── meta.json       # Worker metadata
    │   │   ├── worker.pid      # Process ID
    │   │   └── output.log      # Copilot output
    │   └── worker-2/
    │       └── ...
    │
    └── ../worktrees/
        ├── worker-1/           # Isolated git worktree
        │   └── (full repo checkout on branch worker/worker-1)
        └── worker-2/
            └── ...
```

### Workflow

1. **Spawn** creates a new git worktree and branch
2. Worker runs `copilot` with specified flags in that worktree
3. Process runs detached (survives terminal close)
4. Output streams to `output.log` for monitoring
5. **Cleanup** terminates process, removes worktree, deletes branch

---

## Context Providers

Workers can receive structured context — symlinks, environment variables, files, and prompt sections — via the `contextProviders` option. The **caller** assembles and passes providers; the skill applies them to the worktree.

### Usage

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

### Provider Schema

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

### Template Variables

- `{{repoRoot}}` — Main repository root (where spawn was called)
- `{{worktreePath}}` — Worker's worktree directory
- `{{workerId}}` — Unique worker ID (UUID)

### Behavior

- If no `contextProviders` are passed, spawn works exactly as before
- Symlinks are created in the worktree; skipped with a warning if source doesn't exist
- Environment variables are merged into the worker process (`process.env` + provider env)
- Files are written into the worktree at the specified relative paths
- Prompt sections are appended to the worker's prompt
- Provider results are stored in `meta.json` for debugging

---

## Common Patterns

### Feature Implementation

```bash
$WORKER exec --agent Orchestrator --model claude-sonnet-4.6 --autopilot \
  'return sdk.spawnWorker("implement rate limiting per references/rate-limit-spec.md", {
    addDirs: ["./src/middleware", "./tests/middleware"]
  })'
```

### Bug Investigation

```bash
$WORKER exec 'return sdk.spawnWorker("investigate session expiration bug - see issue #42", {
  agent: "Orchestrator",
  model: "claude-opus-4.6",
  allowAllPaths: true
})'
```

### Parallel Workers

```bash
# Worker 1: Unit tests
$WORKER exec --agent Orchestrator --autopilot \
  'return sdk.spawnWorker("write unit tests for src/auth/", { addDirs: ["./src/auth", "./tests/unit"] })'

# Worker 2: Integration tests
$WORKER exec --agent Orchestrator --autopilot \
  'return sdk.spawnWorker("write integration tests for API routes", { addDirs: ["./src/routes", "./tests/integration"] })'
```

### Multi-Model Comparison

```bash
$WORKER exec 'return [
  sdk.spawnWorker("implement auth refactor", { agent: "Orchestrator", model: "claude-opus-4.6" }),
  sdk.spawnWorker("implement auth refactor", { agent: "Orchestrator", model: "gpt-5.3-codex" }),
  sdk.spawnWorker("implement auth refactor", { agent: "Orchestrator", model: "gemini-3-pro-preview" })
]'
```

### Monitor & Cleanup

```bash
# Check progress
tail -f .copilot-workers/<worker-id>/output.log

# List all workers
$WORKER exec 'return sdk.listAll()'

# Clean up all stopped
$WORKER exec 'return sdk.cleanupAll()'
```

---

## Safety and Best Practices

### ✅ Do

- **Limit access** with `addDirs` to relevant directories
- **Monitor output logs** periodically to check progress
- **Clean up completed workers** to avoid worktree clutter
- **Use specific prompts** with clear success criteria
- **Choose appropriate agents** — use `--agent` to route workers to the right agent for the task

### ⚠️ Don't

- **Avoid `allowAllPaths: true`** unless necessary
- **Don't spawn too many workers** — each consumes system resources
- **Don't forget to clean up** — orphaned worktrees waste disk space
- **Don't use for interactive tasks** — workers run autonomously

---

## Troubleshooting

### Worker shows "stopped" but worktree exists

The process crashed or was killed. Check `output.log`, then clean up:
```bash
$WORKER exec 'return sdk.cleanupWorker("<worker-id>", true)'
```

### Worker not making progress

```bash
tail -f .copilot-workers/<worker-id>/output.log
```

If stuck, clean up and respawn with a clearer prompt.

---

## References

- **CLI Flags:** `references/cli-flags.md` — Copilot CLI flag documentation
- **Prompt Templates:** `references/prompt-templates.md` — Reusable prompt patterns
