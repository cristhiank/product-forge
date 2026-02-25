---
name: copilot-cli-skill
description: >-
  Spawn and manage autonomous Copilot CLI worker processes in isolated git worktrees.
  Use this skill to run multiple parallel Copilot sessions, each working independently
  on different branches and tasks without interfering with your main development environment.
---

# Copilot CLI Skill

Manage autonomous Copilot CLI workers in isolated git worktrees.

## First Actions

When this skill loads, do these immediately:

1. **Check existing workers** — `$WORKER exec 'return sdk.listAll()'` — see if any workers are running
2. **Check worker status** — `$WORKER exec 'return sdk.checkWorker("<id>")'` — get details on specific worker
3. **Clean up stale workers** — `$WORKER exec 'return sdk.cleanupAll()'` — remove completed/failed workers

## Quick Reference — SDK (Preferred)

Use `worker exec` with SDK helpers. The `sdk` and `manager` objects are pre-loaded.

```bash
WORKER="node <skill-dir>/scripts/index.js --repo-root ."

# Spawn a worker
$WORKER exec --agent Orchestrator --autopilot \
  'return sdk.spawnWorker("implement magic link authentication per plan.md")'

# Spawn with options
$WORKER exec 'return sdk.spawnWorker("investigate auth bug #42", {
  agent: "Orchestrator",
  model: "claude-opus-4.6",
  allowAllPaths: true,
  noAskUser: true,
  maxAutopilotContinues: 20
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

## Agent Type Selection

The `agent` option determines which agent profile runs in the worker. **Match agent type to task intent:**

| Task Intent | Agent | Why |
|-------------|-------|-----|
| Implement a feature / write code | `Orchestrator` or `Executor` | These agents edit files, run builds, update backlog |
| Review / verify code changes | `Verifier` | Read-only analysis, produces verdict reports |
| Explore codebase, find patterns | `Scout` | Read-only exploration, caches snippets |

**Common mistake:** Spawning a worker with `--agent Verifier` for an implementation task. The Verifier will review existing code instead of writing new code. Always use `Orchestrator` (or `Executor` for focused implementation) when the goal is to produce code changes.

---

## Task Deduplication (taskId)

Use `taskId` to prevent duplicate workers for the same logical task:

```bash
# First spawn — creates worker
$WORKER exec 'return sdk.spawnWorker("implement B-042", { taskId: "B-042", agent: "Orchestrator" })'

# Second spawn with same taskId — throws error with existing worker info
$WORKER exec 'return sdk.spawnWorker("implement B-042", { taskId: "B-042" })'
# Error: taskId already active: B-042 (workerId=abc123, status=running, pid=1234)
```

The dedup check considers workers in `running` or `spawning` status as active. Workers in `completed`, `failed`, or `spawn_failed` status don't block new spawns with the same taskId.

---

## SDK Method Reference

| Method | Description |
|--------|-------------|
| `sdk.spawnWorker(prompt, opts?)` | Spawn new worker. opts: `{ agent?, model?, taskId?, autoCommit?, allowAll?, addDirs?, allowAllPaths?, allowAllUrls?, allowTools?, denyTools?, availableTools?, excludedTools?, allowUrls?, denyUrls?, disallowTempDir?, noAskUser?, disableParallelToolsExecution?, stream?, autopilot?, maxAutopilotContinues?, worktreeBase?, branchPrefix?, contextProviders? }` |
| `sdk.checkWorker(workerId)` | Get detailed status (pid, status, prompt, exitCode, logTail). ⚠️ logTail is only last 20 lines — for deeper log access, use shell monitoring (see below) |
| `sdk.awaitWorker(workerId, opts?)` | Block until worker reaches terminal state. opts: `{ pollIntervalMs? (default 3000), timeoutMs? (default: no limit), onProgress? }`. Returns final `WorkerStatus`. Throws on timeout. |
| `sdk.listAll()` | List all workers with basic info (id, pid, status) |
| `sdk.cleanupWorker(workerId, force?)` | Kill process, remove worktree, clean state |
| `sdk.cleanupAll(force?)` | Clean up all non-running workers (or all if force=true) |
| `sdk.validateWorker(workerId, opts?)` | Validate worker output: commits, file scope, build. opts: `{ buildCommand?, requiredPathPrefixes?, forbiddenPathPrefixes?, requireCommits? (default true) }`. Returns `ValidationResult`. |

**Worker Status Values:**

- `spawning` — Worker process is starting up (readiness probe in progress)
- `running` — Worker process is confirmed active
- `completed` — Worker exited successfully (exit code 0)
- `completed_no_exit` — Process stopped but no exit metadata found (likely success, wrapper was killed)
- `failed` — Worker exited with error (exit code non-zero)
- `spawn_failed` — Worker process failed to start (crashed before producing output)
- `unknown` — Status cannot be determined (old workers without metadata fall back to this)

**Additional Status Fields (when process stopped):**

- `exitCode: number | null` — Process exit code (0 = success, non-zero = failure)
- `completedAt: string | null` — ISO timestamp when worker completed
- `logTail: string[]` — Last 20 non-empty lines from output.log
- `errorSummary: string | null` — Last log line if failed (quick error diagnosis)

### Latest Copilot CLI Feature Support

Worker spawn now supports these modern Copilot CLI controls:

- `allowAll` → `--allow-all` (equivalent to allow-all-tools/paths/urls)
- `allowTools` / `denyTools` → `--allow-tool` / `--deny-tool`
- `availableTools` / `excludedTools` → `--available-tools` / `--excluded-tools`
- `allowUrls` / `denyUrls` → `--allow-url` / `--deny-url`
- `noAskUser` → `--no-ask-user`
- `maxAutopilotContinues` → `--max-autopilot-continues`
- `disableParallelToolsExecution` → `--disable-parallel-tools-execution`
- `stream` → `--stream on|off`

### Low-Level Manager Access

The `manager` object is also in scope:

| Method | Description |
|--------|-------------|
| `manager.spawn(opts)` | Spawn with full SpawnOptions |
| `manager.getStatus(workerId)` | Detailed WorkerStatus |
| `manager.listWorkers()` | List basic worker info |
| `manager.cleanup(workerId, force?)` | Clean up single worker |
| `manager.validateWorker(workerId, opts?)` | Validate worker output (low-level) |

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
    │   │   ├── exit.json       # Exit code + timestamp (when completed)
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
2. Worker runs `copilot` via wrapper script in that worktree
3. Process runs detached (survives terminal close)
4. Output streams to `output.log` for monitoring
5. On exit, wrapper script captures exit code and timestamp in `exit.json`
6. If `autoCommit` is enabled and exit code is 0, wrapper auto-commits uncommitted changes
7. **Cleanup** terminates process, removes worktree, deletes branch

**Auto-Commit:** When spawned with `autoCommit: true` (or a custom commit message string), the wrapper automatically runs `git add -A && git commit` on successful exit. This ensures worker output is always committed before cleanup. Use this to avoid the common problem of losing uncommitted changes during worktree removal.

```bash
# Enable auto-commit with default message
$WORKER exec 'return sdk.spawnWorker("implement feature", { autoCommit: true })'

# Enable auto-commit with custom message
$WORKER exec 'return sdk.spawnWorker("implement feature", { autoCommit: "feat: implement B-042 magic link auth" })'
```

**Exit Handling:** When a worker exits, the wrapper script writes `exit.json`:

```json
{
  "exitCode": 0,
  "completedAt": "2026-02-22T05:41:00Z"
}
```

This enables callers to distinguish successful completion (exit 0) from failures (exit non-zero). Workers without `exit.json` fall back to `unknown` status for backward compatibility.

---

## Context Providers

Workers can receive structured context (symlinks, env vars, files, prompt sections) via the `contextProviders` option. See `references/context-providers.md` for the full schema, template variables, and usage examples.

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
# List all workers (SDK — quick overview)
$WORKER exec 'return sdk.listAll()'

# Clean up all stopped
$WORKER exec 'return sdk.cleanupAll()'
```

---

## Monitoring Workers (Shell — Preferred)

For monitoring worker progress, **use shell tools directly** instead of the SDK. Shell gives you more context, real-time streaming, and flexible filtering. The SDK's `checkWorker()` only returns the last 20 log lines — often not enough to understand what a worker is doing.

### SDK vs Shell Decision Matrix

| Operation | Use SDK | Use Shell |
|-----------|---------|-----------|
| Spawn a worker | ✅ `sdk.spawnWorker()` | ❌ |
| List workers | ✅ `sdk.listAll()` | ❌ |
| Quick status (running/completed/failed) | ✅ `sdk.checkWorker(id)` | ✅ `cat .copilot-workers/<id>/exit.json` |
| Read worker logs | ❌ (20 lines only) | ✅ `tail -100 output.log` |
| Search logs for errors | ❌ (not supported) | ✅ `grep -i 'error\|fail' output.log` |
| Real-time log streaming | ❌ (not possible) | ✅ `tail -f output.log` (async bash) |
| Clean up workers | ✅ `sdk.cleanupWorker(id)` | ❌ |

### Shell Monitoring Patterns

**Quick status check** — is it running, done, or failed?
```bash
# Check if process is alive
cat .copilot-workers/<id>/worker.pid | xargs ps -p 2>/dev/null && echo "RUNNING" || echo "STOPPED"

# Check exit status (if stopped)
cat .copilot-workers/<id>/exit.json 2>/dev/null || echo "Still running (no exit.json)"
```

**Read recent log output** — more context than SDK's 20 lines:
```bash
# Last 100 lines
tail -100 .copilot-workers/<id>/output.log

# Last 200 lines with line numbers
tail -200 .copilot-workers/<id>/output.log | cat -n
```

**Search for errors or patterns:**
```bash
# Find errors
grep -i 'error\|failed\|exception\|blocked\|stuck' .copilot-workers/<id>/output.log

# Find tool calls and results
grep -i 'tool\|function\|calling' .copilot-workers/<id>/output.log | tail -20

# Count total lines (rough progress indicator)
wc -l .copilot-workers/<id>/output.log
```

**Real-time streaming** (async bash mode — for active monitoring):
```bash
# Stream live output (use async bash + read_bash to check periodically)
tail -f .copilot-workers/<id>/output.log
```

**Multi-worker scan** — check all workers at once:
```bash
# Quick health check across all workers
for d in .copilot-workers/*/; do
  id=$(basename "$d")
  status="running"
  [ -f "$d/exit.json" ] && status=$(cat "$d/exit.json" | head -1)
  lines=$(wc -l < "$d/output.log" 2>/dev/null || echo 0)
  echo "$id: $status ($lines log lines)"
done
```

### When to Use Each

- **Spawning/Cleanup** → Always SDK (`sdk.spawnWorker()`, `sdk.cleanupWorker()`). These manage worktrees, branches, and PIDs — don't replicate that logic.
- **"Is it done?"** → Shell is faster: `cat .copilot-workers/<id>/exit.json`. No Node process overhead.
- **"What is it doing?"** → Shell: `tail -100 .copilot-workers/<id>/output.log`. SDK only gives 20 lines.
- **"Is it stuck?"** → Shell: `grep -i 'error\|blocked' output.log` or check if log size is growing: `wc -l output.log`, wait, `wc -l output.log` again.
- **"I need real-time updates"** → Shell: `tail -f output.log` via async bash. SDK cannot stream.
- **"Did it do the right thing?"** → SDK: `sdk.validateWorker(id, opts)`. Checks commits, file scope, and build.

---

## Validating Worker Output

After a worker completes, use `validateWorker()` to verify it actually did what it was supposed to — check commits exist, files are in the right scope, and the build passes. This catches "silent scope leaks" where a worker succeeds at the wrong thing.

```bash
# Basic validation — just check for commits
$WORKER exec 'return sdk.validateWorker("<worker-id>")'

# Validate scope — files must be under src/auth/
$WORKER exec 'return sdk.validateWorker("<worker-id>", {
  requiredPathPrefixes: ["src/auth/", "tests/auth/"]
})'

# Validate scope with forbidden paths
$WORKER exec 'return sdk.validateWorker("<worker-id>", {
  requiredPathPrefixes: ["verticals/pet_boarding/"],
  forbiddenPathPrefixes: ["verticals-forms-api/"]
})'

# Full validation with build
$WORKER exec 'return sdk.validateWorker("<worker-id>", {
  requiredPathPrefixes: ["src/"],
  buildCommand: "npm run build"
})'
```

**ValidationResult fields:**

| Field | Type | Description |
|-------|------|-------------|
| `valid` | boolean | Overall pass/fail |
| `hasCommits` | boolean | Whether the branch has commits beyond HEAD |
| `commitCount` | number | Number of commits on the branch |
| `commitMessages` | string[] | Commit messages |
| `filesChanged` | string[] | Files changed on the branch |
| `scopeViolations` | string[] | Files outside required or inside forbidden prefixes |
| `buildPassed` | boolean \| null | Build result (null if no buildCommand) |
| `buildOutput` | string | Build stdout+stderr |
| `errors` | string[] | Error messages encountered |

**CLI usage:**

```bash
# Validate with CLI
$WORKER validate <worker-id> --required-path-prefix src/auth/ --required-path-prefix tests/auth/
$WORKER validate <worker-id> --build-command "npm run build" --forbidden-path-prefix node_modules/
$WORKER validate <worker-id> --no-require-commits
```

---

## Error Handling

```bash
# Spawn failures return JSON error
$WORKER exec 'return sdk.spawnWorker("task")' 
# If git worktree creation fails → {"error": "Failed to create worktree: ..."}

# Check worker exit status
result=$($WORKER exec 'return sdk.checkWorker("<id>")')
# status: "completed" (exit 0) | "failed" (exit non-zero) | "running" | "unknown"
# exitCode: 0 (success) or non-zero (failure)
# errorSummary: last log line when failed — quick error diagnosis

# Common errors:
# - "Worktree already exists" → Clean up first: sdk.cleanupWorker(id)
# - Worker "failed" with no errorSummary → Check full log: tail -50 .copilot-workers/<id>/output.log
# - Worker "unknown" → Old worker without exit.json; check if process alive via worker.pid
```

---

## Safety and Best Practices

### ✅ Do

- **Limit access** with `addDirs` to relevant directories
- **Monitor output logs** with shell commands (`tail`, `grep`) — see Monitoring Workers section
- **Use `sdk.checkWorker()`** only for quick status; use shell for deeper log inspection
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
- **Context Providers:** `references/context-providers.md` — Full schema, template variables, and usage examples
