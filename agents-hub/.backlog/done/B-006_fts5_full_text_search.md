# B-006: FTS5 Full-Text Search

**Created:** 2026-02-21  
**Updated:** 2026-02-21  
**Type:** Epic  
**Priority:** High  
**Status:** Done  
**Estimate:** TBD  
**Verified-By:** N/A  
**Parent:** N/A  
**Depends-On:** [B-002, B-004]  
**Tags:** [search, fts5, core]  

---

## Goal

Implement src/core/search.ts per specs 01-data-model.md and 02-cli-api.md. Functions: (1) search(query, opts) — FTS5 MATCH query with BM25 ranking, support simple terms (implicit AND), exact phrases, OR, NOT, prefix operators. (2) Apply post-filters: channel, type, tags, since timestamp, limit. (3) Return SearchResult[] with rank score and highlighted content (using snippet() or highlight() FTS5 auxiliary functions). (4) Channel-scoped search. (5) Cross-channel search for unresolved requests via json_extract. Performance target: <100ms for typical queries.

## Acceptance Criteria

- [ ]

