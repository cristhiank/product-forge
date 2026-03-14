---
name: copilot-cli-skill
description: >-
  Spawn and manage autonomous Copilot CLI worker processes in isolated git worktrees.
  Use this skill to run multiple parallel Copilot sessions, each working independently
  on different branches and tasks without interfering with your main development environment.
---

# Copilot CLI Skill

Manage autonomous Copilot SDK workers in isolated git worktrees.

## First Actions

When this skill loads, do these immediately:

1. **Check for running workers** — `$WORKER exec 'return sdk.listAll()'` — see if any workers are active
2. **If workers exist and are running**, present their status and ask: "Found [N] workers: [ids/status]. Resume monitoring, or clean up?"
3. **Clean up stale workers** — `$WORKER exec 'return sdk.cleanupAll()'` — remove completed/failed workers (only non-running)
4. **Check worker status** — `$WORKER exec 'return sdk.checkWorker("<id>")'` — get details on specific worker

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

# Send a follow-up message to a running worker
$WORKER send <worker-id> --message "Also update the tests to cover edge cases"

# Stream live events from a worker (in exec context)
$WORKER exec 'sdk.streamEvents("<worker-id>", e => console.error(JSON.stringify(e))); await sdk.awaitWorker("<worker-id>")'

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

### When NOT to Use Workers

| Criteria | Use Workers | Do Directly |
|----------|-------------|-------------|
| Items per batch | 3+ independent items | 1-2 items |
| Change size per item | 50+ lines, multiple files | <20 lines, 1-2 files |
| Isolation needed | Different modules, conflict risk | Same module, sequential edits |
| Total estimated time | >5 min per item | <2 min per item |

**Rule of thumb:** If the fix is "open file, change N lines, save" and N < 20, do it directly. Worker spawn overhead (~15-30s per worker) exceeds the fix time.

**Batch threshold:** Only spawn workers when you have 3+ truly independent items that would benefit from parallel execution. A single-item worker wastes overhead on worktree/branch/startup for no parallelism gain.

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
# Error: taskId already active: B-042 (workerId=abc123, status=running)
```

The dedup check considers workers in `running` or `spawning` status as active. Workers in `completed`, `failed`, or `spawn_failed` status don't block new spawns with the same taskId.

---

## SDK Method Reference

| Method | Description |
|--------|-------------|
| `sdk.spawnWorker(prompt, opts?)` | Spawn new worker. opts: `{ agent?, model?, taskId?, autoCommit?, allowAll?, addDirs?, allowAllPaths?, allowAllUrls?, allowTools?, denyTools?, availableTools?, excludedTools?, allowUrls?, denyUrls?, disallowTempDir?, noAskUser?, disableParallelToolsExecution?, stream?, autopilot?, maxAutopilotContinues?, worktreeBase?, branchPrefix?, contextProviders?, hooks?, tools?, errorPolicy? }` |
| `sdk.checkWorker(workerId)` | Get detailed status (status, prompt, exitCode, eventCount, turnCount, lastToolUsed, logTail of last 20 events) |
| `sdk.awaitWorker(workerId, opts?)` | Block until worker reaches terminal state. opts: `{ pollIntervalMs? (default 3000), timeoutMs? (default: no limit), onProgress? }`. Returns final `WorkerStatus`. Throws on timeout. |
| `sdk.sendMessage(workerId, message)` | Send a follow-up message to a running worker; returns the assistant's response text or null. |
| `sdk.streamEvents(workerId, callback)` | Subscribe to live `WorkerEvent`s from a worker in real time. Returns an unsubscribe function. |
| `sdk.listAll()` | List all workers with basic info (id, status, taskId) |
| `sdk.cleanupWorker(workerId, force?)` | Stop SDK session, remove worktree, clean state |
| `sdk.cleanupAll(force?)` | Clean up all non-running workers (or all if force=true) |
| `sdk.validateWorker(workerId, opts?)` | Validate worker output: commits, file scope, build. opts: `{ buildCommand?, requiredPathPrefixes?, forbiddenPathPrefixes?, requireCommits? (default true) }`. Returns `ValidationResult`. |

**Worker Status Values:**

- `spawning` — SDK session is initialising
- `running` — SDK session is active
- `completed` — Session exited successfully (exit code 0)
- `completed_no_exit` — Session stopped but no exit metadata found
- `failed` — Session exited with error (exit code non-zero)
- `spawn_failed` — Session failed to start
- `unknown` — Status cannot be determined

**Additional Status Fields (when session stopped):**

- `exitCode: number | null` — Exit code (0 = success, non-zero = failure)
- `completedAt: string | null` — ISO timestamp when session completed
- `logTail: string[]` — Last 20 events from `events.ndjson` as JSON strings
- `errorSummary: string | null` — Last `session.error` event message if failed
- `eventCount: number` — Total streaming events emitted
- `turnCount: number` — Number of assistant turns completed
- `lastToolUsed: string | null` — Name of the most recent tool invoked

### Low-Level Manager Access

The `manager` object is also in scope:

| Method | Description |
|--------|-------------|
| `manager.spawn(opts)` | Spawn with full SpawnOptions |
| `manager.getStatus(workerId)` | Detailed WorkerStatus |
| `manager.listWorkers()` | List basic worker info |
| `manager.cleanup(workerId, force?)` | Clean up single worker |
| `manager.validateWorker(workerId, opts?)` | Validate worker output |
| `manager.sendMessage(workerId, msg)` | Send follow-up message (low-level) |
| `manager.onEvent(workerId, callback)` | Subscribe to events (low-level); returns unsubscribe fn |

---

## Hooks & Custom Tools

Workers accept optional `hooks` and `tools` on spawn to intercept SDK lifecycle events and extend the model's toolset.

### Lifecycle Hooks (`hooks`)

```js
$WORKER exec 'return sdk.spawnWorker("implement auth", {
  agent: "Executor",
  hooks: {
    // Intercept tool calls — allow, deny, or modify args
    onPreToolUse: ({ toolName, toolArgs }) => {
      if (toolName === "shell" && String(toolArgs.command).includes("git push")) {
        return { permissionDecision: "deny" };
      }
      return { permissionDecision: "allow" };
    },
    // React after a tool completes — inject extra context
    onPostToolUse: ({ toolName, result }) => {
      if (toolName === "build" && String(result).includes("ERROR")) {
        return { additionalContext: "Build failed. Fix all compiler errors before continuing." };
      }
    },
    // Rewrite the initial prompt before submission
    onPromptSubmitted: ({ prompt }) => ({
      modifiedPrompt: prompt + "\n\nAlways write tests alongside implementation."
    }),
    // Recover from errors
    onError: ({ error }) => ({ errorHandling: "retry" }),
  }
})'
```

**Hook signatures:** `onPreToolUse({ toolName, toolArgs }) → { permissionDecision: 'allow'|'deny'|'ask', modifiedArgs?, additionalContext? }` · `onPostToolUse({ toolName, result }) → { additionalContext? }` · `onPromptSubmitted({ prompt }) → { modifiedPrompt? }` · `onSessionStart({ source }) → { additionalContext? }` · `onSessionEnd({ reason }) → void` · `onError({ error, context }) → { errorHandling: 'retry'|'skip'|'abort' }`

### Custom Tools (`tools`)

Register tools that the model can call during the session:

```js
$WORKER exec 'return sdk.spawnWorker("run migration", {
  tools: [{
    name: "notify_slack",
    description: "Post a message to the #deployments Slack channel",
    parameters: {
      type: "object",
      properties: { message: { type: "string" } },
      required: ["message"]
    },
    execute: async ({ message }) => {
      // call Slack webhook here
      return { ok: true };
    }
  }]
})'
```

---

## Event Streaming

Workers emit structured `WorkerEvent`s in real time to `events.ndjson`. Each event has a `type`, `data`, and `timestamp`.

**Event types:**

| type | data |
|------|------|
| `assistant.message_delta` | `{ deltaContent: string }` |
| `tool.execution_start` | `{ toolName: string, toolArgs: object }` |
| `tool.execution_complete` | `{ toolName: string, result: unknown }` |
| `session.idle` | `{}` |
| `session.error` | `{ error: string }` |
| `status.change` | `{ from: string, to: string }` |

### Streaming in Exec Context

```js
// Print every tool call as it happens, then wait for completion
$WORKER exec '
  const unsub = sdk.streamEvents("<worker-id>", evt => {
    if (evt.type === "tool.execution_start") {
      process.stderr.write("→ tool: " + evt.data.toolName + "\n");
    }
  });
  const result = await sdk.awaitWorker("<worker-id>");
  unsub();
  return result;
'
```

### Reading the Event Log

Events are persisted to `.copilot-workers/<id>/events.ndjson`:

```bash
# Tail live events (real-time, no buffering)
tail -f .copilot-workers/<worker-id>/events.ndjson

# Filter for tool calls only
grep '"tool.execution_start"' .copilot-workers/<worker-id>/events.ndjson | tail -20

# Count events as a rough progress indicator
wc -l .copilot-workers/<worker-id>/events.ndjson
```

### `onEvent` Callback on Spawn

Pass `onEvent` directly to `spawnWorker` for lightweight per-event handling without a separate subscription:

```js
$WORKER exec 'return sdk.spawnWorker("implement feature", {
  onEvent: evt => {
    if (evt.type === "session.error")
      process.stderr.write("worker error: " + evt.data.error + "\n");
  }
})'
```

---

## How It Works

### Architecture

```
Main Repo (working on feature-x)
    │
    ├── .copilot-workers/
    │   ├── <worker-id>/
    │   │   ├── meta.json        # Worker metadata (+ base_sha, session_id)
    │   │   ├── events.ndjson    # Streaming events (real-time)
    │   │   ├── history.json     # Retrospective data (post-completion)
    │   │   └── exit.json        # Exit code + timestamps
    │   └── ...
    │
    └── ../worktrees/
        ├── <worker-id>/         # Isolated git worktree
        │   └── (full repo checkout on branch worker/<id>)
        └── ...
```

### Workflow

1. **Spawn** creates a new git worktree and branch; records `base_sha` at creation time
2. **SessionRunner** starts a `CopilotClient` SDK session in-process for that worktree
3. Events stream in real time to `events.ndjson` via `StateStore.appendEvent()`
4. On completion, `history.json` is written with full retrospective data
5. On exit, `exit.json` is written with exit code and timestamps
6. If `autoCommit` is enabled and exit code is 0, uncommitted changes are auto-committed
7. **Cleanup** stops the SDK session, removes worktree and branch, deletes state

**Sessions are in-process:** They run inside the manager process and die with it. There are no detached OS processes or PID files.

**Auto-Commit:** When spawned with `autoCommit: true` (or a custom commit message string), the SDK session automatically runs `git add -A && git commit` on successful exit. This ensures worker output is always committed before cleanup. Use this to avoid the common problem of losing uncommitted changes during worktree removal.

```bash
# Enable auto-commit with default message
$WORKER exec 'return sdk.spawnWorker("implement feature", { autoCommit: true })'

# Enable auto-commit with custom message
$WORKER exec 'return sdk.spawnWorker("implement feature", { autoCommit: "feat: implement B-042 magic link auth" })'
```

**Exit Handling:** When a worker exits, `exit.json` is written with the exit code and timestamps. This enables callers to distinguish successful completion (exit 0) from failures (exit non-zero). Workers without `exit.json` fall back to `unknown` status for backward compatibility.

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

### Spawn → Await → Validate → Merge (Canonical Lifecycle)

```bash
# 1. Spawn
$WORKER exec --agent Orchestrator --autopilot \
  'return sdk.spawnWorker("implement B-042 magic link auth", {
    taskId: "B-042", autoCommit: true, addDirs: ["src/auth/", "tests/auth/"]
  })'

# 2. Await (event-driven)
$WORKER exec 'return sdk.awaitWorker("<worker-id>")'

# 3. Validate
$WORKER exec 'return sdk.validateWorker("<worker-id>", {
  requiredPathPrefixes: ["src/auth/", "tests/auth/"], buildCommand: "npm run build"
})'

# 4. Merge + clean up
git merge worker/<worker-id> --no-ff -m "feat: B-042 magic link auth"
$WORKER exec 'return sdk.cleanupWorker("<worker-id>")'
```

### Batch Orchestration Pattern

```bash
# Spawn workers
for task in B-042 B-043 B-044; do
  $WORKER exec "return sdk.spawnWorker('implement $task', { taskId: '$task', agent: 'Orchestrator', autoCommit: true })"
done

# Await all, then validate + merge each in dependency order
$WORKER exec 'return Promise.all([sdk.awaitWorker("id-1"), sdk.awaitWorker("id-2"), sdk.awaitWorker("id-3")])'
for id in id-1 id-2 id-3; do
  $WORKER exec "return sdk.validateWorker('$id')"
  git merge "worker/$id" --no-ff -m "merge: $id"
  $WORKER exec "return sdk.cleanupWorker('$id')"
done
```

**Grouping heuristic:** Items touching different directories can run in parallel safely.

---

## Monitoring Workers

### Decision Matrix

| Operation | SDK | Shell |
|-----------|-----|-------|
| Spawn / cleanup | ✅ `sdk.spawnWorker()`, `sdk.cleanupWorker()` | ❌ |
| Quick status | ✅ `sdk.checkWorker(id)` | ✅ `cat .copilot-workers/<id>/exit.json` |
| Real-time events | ✅ `sdk.streamEvents(id, cb)` | ✅ `tail -f events.ndjson` |
| Git progress | ❌ | ✅ `git -C <worktree> log --oneline -5` |
| Send follow-up | ✅ `sdk.sendMessage(id, msg)` | ✅ `$WORKER send <id> --message "..."` |
| Validate output | ✅ `sdk.validateWorker(id, opts)` | ❌ |

### Event-Based Monitoring

```bash
# Stream live events until completion
$WORKER exec '
  sdk.streamEvents("<worker-id>", evt => {
    if (["tool.execution_start","session.error"].includes(evt.type))
      process.stderr.write(JSON.stringify(evt) + "\n");
  });
  return sdk.awaitWorker("<worker-id>");
'

# Tail real-time NDJSON log
tail -f .copilot-workers/<worker-id>/events.ndjson
grep '"session.error"' .copilot-workers/<worker-id>/events.ndjson
```

### Git-Based Progress Check

```bash
git -C ../worktrees/<worker-id> log --oneline -10
git -C ../worktrees/<worker-id> diff --stat
```

### Sending Follow-up Messages

```bash
$WORKER send <worker-id> --message "Also add a regression test for the null-user edge case"
# Or: sdk.sendMessage("<worker-id>", "...")
```

---

## Validating Worker Output

`validateWorker()` diffs from `base_sha` (the SHA recorded at spawn time), ensuring the scope check is accurate even if the main branch has advanced.

```bash
# Basic — check commits exist
$WORKER exec 'return sdk.validateWorker("<worker-id>")'

# Scope check + build
$WORKER exec 'return sdk.validateWorker("<worker-id>", {
  requiredPathPrefixes: ["src/auth/", "tests/auth/"],
  buildCommand: "npm run build"
})'

# Forbidden paths
$WORKER exec 'return sdk.validateWorker("<worker-id>", {
  requiredPathPrefixes: ["verticals/pet_boarding/"],
  forbiddenPathPrefixes: ["verticals-forms-api/"]
})'
```

**ValidationResult:** `valid` · `hasCommits` · `commitCount` · `commitMessages` · `filesChanged` (since `base_sha`) · `scopeViolations` · `buildPassed` · `buildOutput` · `errors`

**CLI:** `$WORKER validate <id> --required-path-prefix src/ --build-command "npm run build"`

---

## Worker History & Retrospectives

After a worker completes, `history.json` is written to `.copilot-workers/<id>/history.json` with a full retrospective for analysis and audit.

**Key fields:** `workerId`, `taskId`, `prompt`, `startedAt`, `completedAt`, `exitCode`, `baseSha`, `turnCount`, `toolCalls` (per-tool counts + last args), `commits` (SHA + message + fileCount), `filesChanged`, `eventCount`, `durationMs`, `errorCount`, `lastError`.

```bash
# Read history for a completed worker
cat .copilot-workers/<worker-id>/history.json | jq '{turnCount, durationMs, errorCount, toolCalls}'

# Compare two workers side by side
jq -s 'map({workerId, durationMs, turnCount, errorCount})' \
  .copilot-workers/*/history.json
```

---

## Error Handling

### SDK Error Policies

Control automatic recovery behavior per session:

```js
$WORKER exec 'return sdk.spawnWorker("run migration", {
  errorPolicy: {
    onRateLimit: "retry",           // retry on HTTP 429
    onContextOverflow: "compact",   // compact context instead of aborting
    onToolError: "skip",            // skip failing tools
    maxRetries: 3
  }
})'
```

### Common Errors

```bash
# Spawn failure
# → {"error": "Failed to create worktree: ..."}

# Worker failed — inspect last error
$WORKER exec 'return sdk.checkWorker("<id>")'  # check errorSummary
grep '"session.error"' .copilot-workers/<id>/events.ndjson

# taskId conflict — clean up existing worker first
# → {"error": "taskId already active: B-042 (workerId=..., status=running)"}
$WORKER exec 'return sdk.cleanupWorker("<existing-id>")'

# Worker stuck — compare event counts over time; force cleanup if needed
wc -l .copilot-workers/<id>/events.ndjson
$WORKER exec 'return sdk.cleanupWorker("<id>", true)'
```

---

## Safety and Best Practices

### ✅ Do

- **Limit access** with `addDirs` to relevant directories
- **Use hooks** (`onPreToolUse`) to enforce tool restrictions programmatically
- **Use `sdk.streamEvents()`** or `tail -f events.ndjson` for live progress
- **Clean up completed workers** to avoid worktree clutter
- **Use specific prompts** with clear success criteria
- **Choose appropriate agents** — use `--agent` to route workers to the right agent for the task
- **Review `history.json`** after completion for retrospective analysis

### ⚠️ Don't

- **Avoid `allowAllPaths: true`** unless necessary
- **Don't spawn too many workers** — each runs an in-process SDK session (CPU/memory)
- **Don't forget to clean up** — orphaned worktrees waste disk space
- **Don't use for interactive tasks** — workers run autonomously; use `sendMessage` for mid-session guidance

---

## Troubleshooting

### Worker shows "failed" or "spawn_failed"

```bash
# See the last error event
grep '"session.error"' .copilot-workers/<worker-id>/events.ndjson | tail -3

# Force cleanup and respawn
$WORKER exec 'return sdk.cleanupWorker("<worker-id>", true)'
```

### Worker not making progress

```bash
# Check event count over time
wc -l .copilot-workers/<worker-id>/events.ndjson

# Send a nudge
$WORKER send <worker-id> --message "Are you stuck? Summarise your current state."

# Or stream events live to see what's happening
tail -f .copilot-workers/<worker-id>/events.ndjson
```

---

## References

- **CLI Flags:** `references/cli-flags.md` — SpawnOptions → SDK config mapping
- **Prompt Templates:** `references/prompt-templates.md` — Reusable prompt patterns
- **Context Providers:** `references/context-providers.md` — Full schema, template variables, and usage examples
