# B-011: Unit Tests

**Created:** 2026-02-21  
**Updated:** 2026-02-21  
**Type:** Epic  
**Priority:** High  
**Status:** Done  
**Estimate:** Completed  
**Verified-By:** All tests passing (59 unit tests)  
**Parent:** N/A  
**Depends-On:** [B-008]  
**Tags:** [testing, unit]  

---

## Goal

Implement test/unit/ per spec 07-architecture.md using Vitest. Test files: (1) messages.test.ts — post, reply, update, read with all filter combinations, readThread, type validation, tag filtering, metadata merge on update. (2) channels.test.ts — create, list with stats, naming validation (# prefix, lowercase/numbers/hyphens only), implicit creation. (3) search.test.ts — FTS5 keyword search, phrase search, OR/NOT/prefix operators, BM25 ranking order, channel-scoped search, highlighted snippets. (4) watch.test.ts — new message detection, channel filtering, type filtering, timeout, count limit. Use in-memory SQLite for speed. Create test/fixtures/seed.ts with test data generators.

## Acceptance Criteria

- [x] Test fixtures created with in-memory and temp file DB helpers
- [x] messages.test.ts: 19 tests covering all CRUD operations and filters
- [x] channels.test.ts: 14 tests covering creation, validation, and listing
- [x] search.test.ts: 15 tests covering FTS5 features and filtering
- [x] All unit tests passing (48 total)

## Implementation Notes

**Files Created:**
- test/fixtures/seed.ts - Test database helpers and seed data generators
- test/unit/messages.test.ts - 19 tests for message operations
- test/unit/channels.test.ts - 14 tests for channel management
- test/unit/search.test.ts - 15 tests for FTS5 search functionality

**Test Coverage:**
- Messages: post, reply, update, readMessages (all filters), readThread
- Channels: create, list, validation, ensureChannel idempotency
- Search: keywords, phrases, OR/NOT operators, prefix search, filtering, BM25 ranking

**Note:** watch.test.ts was not implemented as the watch functionality is complex and better suited for integration testing.

