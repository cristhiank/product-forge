# B-003: Core TypeScript Types

**Created:** 2026-02-21  
**Completed:** 2026-02-21  
**Updated:** 2026-02-21  
**Type:** Epic  
**Priority:** High  
**Status:** Done  
**Estimate:** TBD  
**Verified-By:** N/A  
**Parent:** N/A  
**Depends-On:** [B-001]  
**Tags:** [types, core]  

---

## Goal

Define all TypeScript types per spec 07-architecture.md: Message interface (id, channel, type union 'note'|'decision'|'request'|'status', author, content, tags string[], threadId, metadata Record<string,unknown>, workerId, createdAt, updatedAt). PostOptions, ReplyOptions, UpdateOptions, ReadOptions, SearchOptions, WatchOptions, SearchResult (extends Message with rank + highlightedContent). Channel, ChannelInfo, HubMeta, HubStatus, HubStats types. Export from src/core/types.ts.

## Acceptance Criteria

- [ ]

