# B-002: Database Layer (SQLite + WAL)

**Created:** 2026-02-21  
**Completed:** 2026-02-21  
**Updated:** 2026-02-21  
**Type:** Epic  
**Priority:** High  
**Status:** Done  
**Estimate:** TBD  
**Verified-By:** N/A  
**Parent:** N/A  
**Tags:** [database, sqlite, core]  

---

## Goal

Implement the database foundation per specs 01-data-model.md and 03-concurrency.md. Includes: (1) connection.ts — SQLite connection factory with WAL mode, busy_timeout=5000, synchronous=NORMAL, foreign_keys=ON, cache_size=-64000. (2) schema.ts — CREATE TABLE messages (id TEXT PK, channel, type, author, content, tags JSON, thread_id FK, metadata JSON, created_at, updated_at, worker_id) + 6 indexes + hub_meta table + channels table. (3) FTS5 virtual table messages_fts with porter+unicode61 tokenizer and 3 sync triggers (INSERT/DELETE/UPDATE). (4) migrations/ — schema versioning system. Performance target: posts <50ms, reads <20ms.

## Acceptance Criteria

- [ ]

