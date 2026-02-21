# B-004: Message CRUD Operations

**Created:** 2026-02-21  
**Updated:** 2026-02-21  
**Type:** Epic  
**Priority:** High  
**Status:** Done  
**Estimate:** TBD  
**Verified-By:** N/A  
**Parent:** N/A  
**Depends-On:** [B-002, B-003]  
**Tags:** [messages, crud, core]  

---

## Goal

Implement src/core/messages.ts per specs 01-data-model.md and 02-cli-api.md. Functions: (1) postMessage — INSERT with UUID v4 id, validate type enum, JSON-serialize tags/metadata, set created_at to ISO-8601 UTC. (2) replyToMessage — same as post but sets thread_id, inherits channel from parent, optionally inherits type. (3) updateMessage — partial update, merge metadata (not replace), set updated_at. (4) readMessages — parameterized SELECT with all ReadOptions filters (channel, type, author, tags AND logic, since/until timestamps, limit/offset, thread, unresolved via json_extract on metadata.resolved, worker_id). (5) readThread — get parent + all replies ordered by created_at. All queries must use parameterized statements (no SQL injection).

## Acceptance Criteria

- [ ]

