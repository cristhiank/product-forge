# B-010: spawn-lifecycle

**Created:** 2026-02-24  
**Completed:** 2026-02-24  
**Updated:** 2026-02-24  
**Type:** Story  
**Priority:** Medium  
**Status:** Done  
**Estimate:** TBD  
**Verified-By:** N/A  
**Parent:** N/A  
**Tags:** []  

---

## Goal

Implement Meta-Status-Machine for worker spawn lifecycle

## Acceptance Criteria

- [x] Readiness probe: spawn() writes status='spawning', transitions to 'running' or 'spawn_failed'
- [x] Terminal state fix: getStatus() returns 'completed_no_exit' when process dead + no exit.json
- [x] Lifecycle lock: cleanup() rejects non-force cleanup while worker is 'spawning'
- [x] taskId dedup: spawn() detects active workers with same taskId and throws
- [x] isProcessRunning() checks positive PID before group check
- [x] listWorkers() surfaces all lifecycle states including spawning/spawn_failed/completed_no_exit
- [x] SDK + CLI --task-id passthrough
- [x] 7 node:test cases, all passing

