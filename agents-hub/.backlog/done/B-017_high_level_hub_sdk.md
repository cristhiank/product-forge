# B-017: High-Level HubSDK Class

**Created:** 2026-02-21  
**Updated:** 2026-02-25  
**Type:** Feature  
**Priority:** High  
**Status:** Done  
**Estimate:** TBD  
**Verified-By:** N/A  
**Parent:** N/A  
**Depends-On:** [B-008, B-009]  
**Tags:** [sdk, library, agent-api]  

---

## Goal

Create `src/sdk.ts` with a `HubSDK` class that wraps the Hub class with domain-specific convenience methods for agent workflows. Instead of raw `hub.post({channel, type, author, content, tags, metadata})`, agents call `sdk.postFinding(content, {tags, path, lines})` with defaults pre-configured.

The SDK constructor accepts a Hub instance plus optional defaults (channel, author) so agents don't repeat them on every call.

## Methods

### Findings & Notes
- `postFinding(content, opts?)` — Post a note with type=note, tags includes "finding"
- `postSnippet(path, content, opts?)` — Post a note tagged "snippet" with path metadata
- `postConstraint(content, opts?)` — Post a note tagged "constraint"

### Decisions
- `proposeDecision(content, opts?)` — Post type=decision, metadata.status="proposed"
- `approveDecision(threadId, resolution)` — Reply with metadata.status="approved"
- `rejectDecision(threadId, reason)` — Reply with metadata.status="rejected"

### Requests & Blocking
- `requestHelp(content, severity, opts?)` — Post type=request with severity metadata
- `resolveRequest(threadId, resolution)` — Reply with metadata.resolved=true

### Status & Progress
- `postProgress(step, totalSteps, content, opts?)` — Post type=status with step metadata
- `postCheckpoint(content, opts?)` — Post type=status tagged "checkpoint"

### Trails
- `logTrail(marker, summary, opts?)` — Post a note tagged "trail" with marker metadata

### Queries
- `getFindings(opts?)` — Read notes tagged "finding"
- `getUnresolved(opts?)` — Read unresolved requests
- `getDecisions(status?, opts?)` — Read decisions filtered by status

## Acceptance Criteria

- [ ] HubSDK class created in src/sdk.ts
- [ ] All methods listed above implemented
- [ ] Default channel/author from constructor options
- [ ] Exported from src/index.ts
- [ ] Type-safe with full TypeScript types
