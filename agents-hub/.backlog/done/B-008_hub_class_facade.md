# B-008: Hub Class Facade

**Created:** 2026-02-21  
**Completed:** 2026-02-21  
**Updated:** 2026-02-21  
**Type:** Epic  
**Priority:** High  
**Status:** Done  
**Estimate:** TBD  
**Verified-By:** N/A  
**Parent:** N/A  
**Depends-On:** [B-004, B-005, B-006, B-007]  
**Tags:** [facade, api, core]  

---

## Goal

Implement src/hub.ts per spec 07-architecture.md. Hub class wraps all core modules behind a clean API: static init(dbPath, mode) creates DB + default channels (#main for single, #main+#general for multi). Instance methods: channelCreate, channelList, post, reply, update, read, readThread, search, watch, status, export (NDJSON), import (NDJSON with count return), gc (remove old messages + VACUUM), stats (DB size, counts by type/channel, FTS health). Constructor opens connection via connection factory. This is the programmatic API; CLI delegates to Hub.

## Acceptance Criteria

- [ ]

