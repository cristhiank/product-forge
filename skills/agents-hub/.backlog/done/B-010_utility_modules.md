# B-010: Utility Modules

**Created:** 2026-02-21  
**Updated:** 2026-02-21  
**Type:** Epic  
**Priority:** Medium  
**Status:** Done  
**Estimate:** TBD  
**Verified-By:** N/A  
**Parent:** N/A  
**Depends-On:** [B-001]  
**Tags:** [utils, helpers]  

---

## Goal

Implement src/utils/ per spec 07-architecture.md: (1) ids.ts — UUID v4 generation for message IDs (use crypto.randomUUID or uuid package). (2) time.ts — ISO-8601 UTC helpers: now() returns current ISO string, parseISO() validates and parses ISO timestamps. (3) json.ts — safe JSON parse (returns null on failure, not throw), JSON stringify with optional pretty printing. These are pure utility functions with no dependencies on core modules.

## Acceptance Criteria

- [ ]

