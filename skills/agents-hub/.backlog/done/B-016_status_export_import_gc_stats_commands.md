# B-016: Status, Export, Import, GC & Stats Commands

**Created:** 2026-02-21  
**Completed:** 2026-02-21  
**Updated:** 2026-02-21  
**Type:** Epic  
**Priority:** Medium  
**Status:** Done  
**Estimate:** TBD  
**Verified-By:** N/A  
**Parent:** N/A  
**Depends-On:** [B-004, B-005]  
**Tags:** [maintenance, operations]  

---

## Goal

Implement the maintenance and operational commands in Hub class per spec 02-cli-api.md: (1) status(channel?) — compact overview (~100-200 tokens): hub_id, mode, uptime, per-channel message counts + unresolved request counts, total_messages, total_unresolved, recent_activity (last 5 events). (2) export(opts) — NDJSON output of all messages (or filtered by channel/since), also support CSV format. (3) import(ndjson) — read NDJSON, INSERT messages, return count. (4) gc(olderThan, dryRun) — DELETE messages older than duration, run VACUUM, respect dry-run flag. (5) stats() — DB file size, message counts by type and channel, FTS index health, WAL file size.

## Acceptance Criteria

- [ ]

