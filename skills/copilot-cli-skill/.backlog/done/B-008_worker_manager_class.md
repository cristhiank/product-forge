# B-008: WorkerManager Class and Types

**Created:** 2026-02-21  
**Updated:** 2026-02-25  
**Type:** Feature  
**Priority:** High  
**Status:** Done  
**Estimate:** TBD  
**Verified-By:** N/A  
**Parent:** N/A  
**Depends-On:** [B-007]  
**Tags:** [library, workers, typescript]  

---

## Goal

Convert bash scripts (spawn-worker.sh, worker-status.sh, cleanup-worker.sh) to a TypeScript `WorkerManager` class with full types.

## Types (src/types.ts)

- `SpawnOptions` — prompt, branch, agent, model, skills, planFile, resume, etc.
- `WorkerInfo` — workerId, pid, status, worktreePath, branchName, prompt, startedAt, agent, model
- `WorkerStatus` — extends WorkerInfo with worktreeExists, logSizeBytes, logLines
- `CleanupResult` — workerId, status, worktreeRemoved, branchDeleted, stateRemoved

## WorkerManager (src/workers.ts)

- `constructor(repoRoot: string)` — sets up paths
- `spawn(opts: SpawnOptions): WorkerInfo` — create worktree, build copilot command, spawn detached process, write meta/pid
- `getStatus(workerId: string): WorkerStatus` — read PID, check alive, read meta
- `listWorkers(): WorkerInfo[]` — list all worker directories
- `cleanup(workerId: string, force?: boolean): CleanupResult` — kill process, remove worktree/branch/state

## Acceptance Criteria

- [ ] Types defined in src/types.ts
- [ ] WorkerManager class in src/workers.ts
- [ ] All 4 methods implemented
- [ ] Same behavior as bash scripts
- [ ] JSON output format matches bash script output
