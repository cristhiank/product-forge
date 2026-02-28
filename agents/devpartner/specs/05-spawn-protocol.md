# DevPartner v17 — Copilot CLI Spawn Protocol

## Overview

v17 spawns independent Copilot CLI sessions as worker processes. This document specifies exactly how the Super-Orchestrator launches, monitors, and controls these processes.

## Copilot CLI Flags Reference

| Flag | Purpose | Required |
|------|---------|:--------:|
| `-p "<prompt>"` | Non-interactive mode with prompt | ✅ |
| `--agent <name>` | Use specific custom agent | ✅ |
| `--allow-all` | Skip all permission prompts | ✅ |
| `--autopilot` | Continue without user interaction | ✅ |
| `--no-ask-user` | Disable ask_user tool | ✅ |
| `--model <model>` | Override default model | Optional |
| `--share <path>` | Export session to file | Optional |
| `--resume <id>` | Resume previous session | For retries |

## Spawn Command Template

```bash
cd <worktree-path> && copilot \
  -p "<worker-prompt>" \
  --agent Orchestrator \
  --allow-all \
  --autopilot \
  --no-ask-user \
  --model claude-sonnet-4.6
```

## Worker Prompt Template

The prompt must be self-contained — the worker has no conversation history.

```markdown
You are Worker {worker_id}, operating in parallel mode as part of DevPartner v17.

## Your Task
{backlog_item_title}: {backlog_item_description}

## Context
- Backlog item: {backlog_id}
- Branch: feature/{backlog_id}
- Worktree: {worktree_path}
- Hub database: {hub_db_absolute_path}
- Your channel: #worker-{worker_id}

## Instructions
1. Invoke the `devpartner` skill as your first action
2. Invoke the `agents-hub` skill for all communication
3. Post your progress to channel #worker-{worker_id}
4. Search all hub channels before exploring files (other workers may have useful findings)
5. If blocked on something outside your scope, post a request:
   hub post --channel '#worker-{worker_id}' --type request --author orchestrator \
     --content "Blocked: [describe]" --metadata '{"severity":"blocker","target":"super-orchestrator"}'
   Then: hub watch --channel '#worker-{worker_id}' --timeout 300
6. When complete, post:
   hub post --channel '#worker-{worker_id}' --type status --author orchestrator \
     --content "Complete: {task_summary}" --tags '["complete"]' \
     --metadata '{"files_changed":[...],"backlog_id":"{backlog_id}"}'
7. Do NOT modify main branch. Stay on feature/{backlog_id}.
8. Follow all commit hygiene rules (no temp files, git status before every commit).

## Additional Context
{any relevant context from other workers or prior exploration}
```

## Process Management

### Spawning

```typescript
// Super-Orchestrator spawns workers
async function spawnWorker(config: WorkerConfig): Promise<WorkerProcess> {
  const cmd = buildSpawnCommand(config);
  
  // Use bash async mode with detach for independent process
  const process = spawn('bash', ['-c', cmd], {
    cwd: config.worktreePath,
    detached: true,    // Survives parent exit
    stdio: 'pipe',     // Capture stdout/stderr
    env: { ...process.env, HUB_DB: config.hubDbPath }
  });

  return {
    pid: process.pid,
    workerId: config.workerId,
    backlogId: config.backlogId,
    startedAt: new Date().toISOString(),
    process
  };
}
```

### Monitoring

```bash
# Check if process is alive
kill -0 <PID> 2>/dev/null && echo "alive" || echo "dead"

# Check hub for worker status
hub read --channel '#worker-B042' --type status --limit 1

# Check for unresolved requests
hub read --type request --unresolved
```

### Monitoring Loop (Super-Orchestrator)

```
while (activeWorkers.length > 0):
  for each worker in activeWorkers:
    if not isProcessAlive(worker.pid):
      # Process exited — check if clean completion
      lastStatus = hub read --channel '#worker-{id}' --type status --tags complete --limit 1
      if lastStatus:
        handleCompletion(worker)
      else:
        handleCrash(worker)
      activeWorkers.remove(worker)
    
  # Check for blocked workers (even alive ones)
  requests = hub read --type request --unresolved
  for each request in requests:
    resolveRequest(request)
  
  sleep(10)  # seconds
```

### Stopping a Worker

```bash
# Graceful: send SIGTERM
kill <PID>

# Force: send SIGKILL after timeout
kill <PID> && sleep 10 && kill -9 <PID> 2>/dev/null
```

**Note**: The Copilot CLI process may spawn child processes. Use process group kill:

```bash
# Kill entire process group
kill -- -<PGID>
```

## Session Recovery

### Resume After Crash

```bash
# If worker crashed, resume its session
copilot --resume <session-id> \
  --agent Orchestrator \
  --allow-all \
  --autopilot \
  --no-ask-user \
  -p "Continue from where you left off. Check hub channel #worker-{id} for last status."
```

### Resume After Block Resolution

```bash
# If worker exited with block code, resume with resolution
copilot --resume <session-id> \
  --agent Orchestrator \
  --allow-all \
  --autopilot \
  --no-ask-user \
  -p "Your blocked request has been resolved. Check hub thread for resolution details."
```

## Resource Management

### Max Concurrent Workers

Default: 3 workers. Configurable based on:
- Machine resources (CPU, memory)
- API rate limits (model calls per minute)
- Copilot premium request budget

### Model Selection

| Worker Type | Default Model | Rationale |
|---|---|---|
| Standard backlog item | claude-sonnet-4.6 | Balance of quality/speed/cost |
| Complex/security item | claude-opus-4.6 | Higher reasoning for complex tasks |
| Simple documentation | claude-haiku-4.5 | Fast, cheap for simple work |

Super-Orchestrator selects model based on backlog item complexity.

## Environment Variables

| Variable | Purpose | Example |
|---|---|---|
| `HUB_DB` | Absolute path to hub database | `/home/user/project/.devpartner/hub.db` |
| `WORKER_ID` | Worker identifier | `B042` |
| `WORKER_CHANNEL` | Hub channel name | `#worker-B042` |

## Security Considerations

- `--allow-all` bypasses all permission prompts — workers must be trusted
- Workers can only push to their feature branch (git branch protection)
- Workers should not have access to secrets not needed for their task
- Hub database is the only shared resource — SQLite WAL prevents corruption
