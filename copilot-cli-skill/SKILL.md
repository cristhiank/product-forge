---
name: copilot-cli-skill
description: >-
  Spawn and manage autonomous Copilot CLI worker processes in isolated git worktrees.
  Use this skill to run multiple parallel Copilot sessions, each working independently
  on different branches and tasks without interfering with your main development environment.
---

# Copilot CLI Skill

Manage autonomous Copilot CLI workers in isolated git worktrees.

## What This Skill Provides

Three scripts for spawning, monitoring, and cleaning up independent Copilot CLI workers:

1. **`spawn-worker.sh`** — Create a new worker in an isolated git worktree
2. **`worker-status.sh`** — Check status of running workers
3. **`cleanup-worker.sh`** — Terminate worker and remove its worktree

## When to Use

Use this skill when you want to:

- **Run parallel tasks** — Work on multiple features/bugs simultaneously without context switching
- **Delegate long-running work** — Spawn a worker for extensive refactoring while continuing other work
- **Isolate risky changes** — Test experimental approaches in separate worktrees
- **Background processing** — Let a worker handle time-consuming tasks (documentation, test generation) autonomously

## Quick Start

### Spawn a Worker

```bash
./scripts/spawn-worker.sh \
  --prompt "implement magic link authentication per plan.md" \
  --agent Executor \
  --add-dir ./src/auth \
  --add-dir ./tests/auth \
  --autopilot
```

Output:
```json
{
  "worker_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "pid": 12345,
  "worktree_path": "/Users/you/worktrees/a1b2c3d4-...",
  "branch_name": "worker/a1b2c3d4-...",
  "state_dir": ".copilot-workers/a1b2c3d4-...",
  "output_log": ".copilot-workers/a1b2c3d4-.../output.log",
  "status": "running"
}
```

### Check Status

```bash
# List all workers
./scripts/worker-status.sh --list

# Check specific worker
./scripts/worker-status.sh a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

### Monitor Output

```bash
tail -f .copilot-workers/<worker-id>/output.log
```

### Clean Up

```bash
./scripts/cleanup-worker.sh a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

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

### State Management

Each worker's state is tracked in `.copilot-workers/<worker-id>/`:

- **`meta.json`** — Worker configuration and metadata
- **`worker.pid`** — Process ID for status checks and cleanup
- **`output.log`** — Complete Copilot CLI output

## Common Patterns

### Pattern: Feature Implementation

```bash
./scripts/spawn-worker.sh \
  --prompt "implement rate limiting per references/rate-limit-spec.md" \
  --agent Executor \
  --model claude-sonnet-4.6 \
  --add-dir ./src/middleware \
  --add-dir ./tests/middleware \
  --autopilot
```

### Pattern: Bug Investigation

```bash
./scripts/spawn-worker.sh \
  --prompt "investigate session expiration bug - see issue #42" \
  --agent Scout \
  --model claude-opus-4.6 \
  --add-dir ./src/auth \
  --allow-all-paths
```

### Pattern: Documentation Generation

```bash
./scripts/spawn-worker.sh \
  --prompt "generate API documentation for all routes in src/routes/" \
  --agent Executor \
  --add-dir ./src/routes \
  --add-dir ./docs \
  --autopilot
```

### Pattern: Parallel Test Suites

```bash
# Worker 1: Unit tests
./scripts/spawn-worker.sh --prompt "write unit tests for src/auth/" --agent Executor --add-dir ./src/auth --add-dir ./tests/unit --autopilot

# Worker 2: Integration tests
./scripts/spawn-worker.sh --prompt "write integration tests for API routes" --agent Executor --add-dir ./src/routes --add-dir ./tests/integration --autopilot
```

## Script Reference

### spawn-worker.sh

**Required:**
- `--prompt <text>` — Task for the worker

**Optional:**
- `--agent <agent>` — Scout, Executor, Planner, Creative, Verifier
- `--model <model>` — claude-opus-4.6, claude-sonnet-4.6, etc.
- `--worktree-base <path>` — Base directory for worktrees (default: `../worktrees/`)
- `--branch-prefix <prefix>` — Branch name prefix (default: `worker`)
- `--add-dir <dir>` — Allow access to specific directory (repeatable)
- `--allow-all-paths` — Allow all file access
- `--allow-all-urls` — Allow all URL access
- `--autopilot` — Enable autonomous multi-turn execution

See `references/cli-flags.md` for detailed flag documentation.

### worker-status.sh

```bash
# List all workers
./scripts/worker-status.sh --list

# Get specific worker status
./scripts/worker-status.sh <worker-id>
```

Output includes: worker ID, PID, status (running/stopped), worktree path, log size, and metadata.

### cleanup-worker.sh

```bash
# Graceful cleanup
./scripts/cleanup-worker.sh <worker-id>

# Force kill if needed
./scripts/cleanup-worker.sh <worker-id> --force
```

Terminates the process, removes the worktree, deletes the branch, and cleans up state files.

## Prompt Templates

For common worker scenarios, see `references/prompt-templates.md`:

- Standard feature implementation
- Bug investigation and fixing
- Documentation generation
- Refactoring tasks
- Custom agent delegation

## Safety and Best Practices

### ✅ Do

- **Use `--add-dir`** to limit worker access to relevant directories
- **Monitor output logs** periodically to check progress
- **Clean up completed workers** to avoid worktree clutter
- **Use specific prompts** with clear success criteria
- **Choose appropriate agents** (Scout for exploration, Executor for implementation)

### ⚠️ Don't

- **Avoid `--allow-all-paths`** unless necessary (security risk)
- **Don't spawn too many workers** — each consumes system resources
- **Don't forget to clean up** — orphaned worktrees waste disk space
- **Don't use for interactive tasks** — workers run autonomously without user input

## Troubleshooting

### Worker shows "stopped" but worktree exists

The process crashed or was killed externally. Check `output.log` for errors, then clean up:

```bash
./scripts/cleanup-worker.sh <worker-id> --force
```

### Worktree creation fails

Ensure the worktree base directory exists and is writable:

```bash
mkdir -p ../worktrees
```

### Worker not making progress

Check the output log:

```bash
tail -f .copilot-workers/<worker-id>/output.log
```

If stuck, the prompt may be ambiguous or the worker may need more context. Clean up and respawn with a clearer prompt.

## Advanced Usage

### Custom Worktree Location

```bash
./scripts/spawn-worker.sh \
  --prompt "..." \
  --worktree-base /tmp/copilot-workers
```

### Resume Worker Session

Workers don't currently support resume. To continue work from a stopped worker:

1. Review the worker's branch: `git checkout worker/<worker-id>`
2. Check progress and manually continue, OR
3. Spawn a new worker with updated prompt: `--prompt "continue from where worker X left off"`

### Multi-Model Workflows

Spawn multiple workers with different models for the same task, then compare results:

```bash
./scripts/spawn-worker.sh --prompt "..." --model claude-opus-4.6 --agent Executor
./scripts/spawn-worker.sh --prompt "..." --model gpt-5.3-codex --agent Executor
./scripts/spawn-worker.sh --prompt "..." --model gemini-3-pro-preview --agent Executor
```

Review each worker's branch to select the best implementation.

---

## References

- **CLI Flags:** `references/cli-flags.md` — Detailed Copilot CLI flag documentation
- **Prompt Templates:** `references/prompt-templates.md` — Reusable prompt patterns for common scenarios
