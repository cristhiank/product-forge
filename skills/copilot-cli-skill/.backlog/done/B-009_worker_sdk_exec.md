# B-009: WorkerSDK and Exec Subcommand

**Created:** 2026-02-21  
**Updated:** 2026-02-25  
**Type:** Feature  
**Priority:** High  
**Status:** Done  
**Estimate:** TBD  
**Verified-By:** N/A  
**Parent:** N/A  
**Depends-On:** [B-008]  
**Tags:** [sdk, cli, exec, agent-api]  

---

## Goal

Create WorkerSDK convenience class and CLI with exec subcommand, mirroring the agents-hub pattern.

## WorkerSDK (src/sdk.ts)

- `constructor(manager: WorkerManager)` — wraps manager
- `spawnWorker(prompt, opts?)` — spawn with sensible defaults
- `checkWorker(workerId)` — get status
- `listAll()` — list all workers
- `cleanupWorker(workerId, force?)` — cleanup single worker
- `cleanupAll(force?)` — cleanup all stopped workers

## CLI (src/cli.ts)

Commander.js CLI with commands:
- `worker spawn --prompt '...' [--agent Executor] [--model sonnet]`
- `worker status [worker-id]` / `worker status --list`
- `worker cleanup <worker-id> [--force]`
- `worker exec '<code>'` — eval with sdk in scope

## Acceptance Criteria

- [ ] WorkerSDK class in src/sdk.ts
- [ ] CLI in src/cli.ts with all commands
- [ ] exec subcommand works with sdk in scope
- [ ] Bundle to scripts/worker.js
- [ ] Rewrite SKILL.md for code-gen approach
