# agents-hub — SKILL.md Specification

## Overview

This document specifies the SKILL.md file that will be published to `~/.copilot/skills/agents-hub/SKILL.md`. This is the primary interface agents use to learn about and interact with the hub.

---

## Skill Definition

```yaml
---
name: agents-hub
description: >-
  ALWAYS use when any agent needs to communicate, share knowledge, post findings,
  request help, track progress, or search for context. Covers posting notes
  (findings, snippets, constraints), decisions, help requests, and status updates.
  Supports channels for multi-worker parallel sessions. Required for all
  DevPartner agent coordination. Use when you see: status update, finding,
  blocked, need help, share context, search board, check progress, post
  decision, coordinate, what did worker find, channel, hub.
  ⛔ CRITICAL: Never read .devpartner/ files directly — always use the hub CLI.
---
```

## Trigger Words

The skill must trigger on these phrases (based on agents-board adoption failures):

### Must-trigger
- "post to hub", "check hub", "hub status", "search hub"
- "share finding", "post finding", "add note"
- "blocked", "need help", "stuck", "can't proceed"
- "what has been found", "what do we know", "what's the status"
- "coordinate", "check other workers", "cross-reference"
- "decision", "propose", "approve"
- "progress", "checkpoint", "how far along"

### Should-trigger
- "context", "prior findings", "what did scout find"
- "share", "communicate", "tell other agents"
- "plan", "next step", "what's remaining"

## Anti-Patterns

The SKILL.md must include this section prominently:

```markdown
⛔ CRITICAL: Never Browse .devpartner/ Directly

WRONG:
  cat .devpartner/hub.db
  ls .devpartner/
  sqlite3 .devpartner/hub.db "SELECT ..."

RIGHT:
  $HUB search "auth"
  $HUB read --channel '#main' --type note
  $HUB status
```

## Quick Reference Card

The SKILL.md should include a compact reference that fits in ~200 tokens:

```markdown
## Quick Reference

HUB="node <skill-dir>/scripts/hub.js"

# Post knowledge
$HUB post --channel '#main' --type note --author scout --content "..." --tags '["..."]'

# Search
$HUB search "query" [--channel '#main'] [--limit 10]

# Read
$HUB read [--channel '#main'] [--type note] [--since '2026-...'] [--limit 20]

# Request help
$HUB post --channel '#worker-B042' --type request --author executor \
  --content "Blocked: ..." --metadata '{"severity":"blocker","target":"super-orchestrator"}'

# Check status
$HUB status

# Watch for messages (blocking)
$HUB watch [--channel '#main'] [--type request] [--timeout 120]

Types: note | decision | request | status
Severity: info | minor | major | blocker
```
