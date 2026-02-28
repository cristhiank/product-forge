# B-007: Real-Time Watch (fs.watch + Polling)

**Created:** 2026-02-21  
**Completed:** 2026-02-21  
**Updated:** 2026-02-21  
**Type:** Epic  
**Priority:** High  
**Status:** Done  
**Estimate:** TBD  
**Verified-By:** N/A  
**Parent:** N/A  
**Depends-On:** [B-002, B-004]  
**Tags:** [watch, realtime, concurrency]  

---

## Goal

Implement src/core/watch.ts per spec 03-concurrency.md. (1) Primary: fs.watch on the SQLite WAL file — on change event, query for new messages where rowid > last seen rowid. Filter by channel, type. Yield matching messages as AsyncGenerator<Message>. (2) Fallback: polling at 2s interval when fs.watch is unreliable. (3) Support --timeout (seconds, default 300, 0=forever) and --count (return after N matches, default 1). (4) Output NDJSON (one JSON per line). (5) Handle edge cases: WAL file not existing yet, watcher errors, graceful cleanup on timeout/count reached. Performance target: <500ms notification latency.

## Acceptance Criteria

- [ ]

