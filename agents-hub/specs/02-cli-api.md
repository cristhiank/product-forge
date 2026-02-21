# agents-hub — CLI & API Reference

## Overview

The hub provides a single CLI entry point: `hub.js`. All commands return JSON. The CLI is designed to be called from agent prompts via bash.

## Global Options

| Flag | Description | Default |
|------|-------------|---------|
| `--db <path>` | Path to SQLite database | `.devpartner/hub.db` |
| `--json` | Force JSON output (default) | `true` |
| `--pretty` | Pretty-print JSON | `false` |

## Initialization

### `hub init`

Creates a new hub database with default channels.

```bash
$HUB init [--mode single|multi] [--hub-id <uuid>]
```

- `--mode single` (default): Creates `#main` channel
- `--mode multi`: Creates `#main` + `#general` channels

**Output:**
```json
{
  "hub_id": "uuid",
  "mode": "single",
  "db_path": ".devpartner/hub.db",
  "channels": ["#main"]
}
```

## Channel Management

### `hub channel create`

```bash
$HUB channel create <name> [--description <text>] [--worker-id <id>]
```

### `hub channel list`

```bash
$HUB channel list [--include-stats]
```

**Output:**
```json
{
  "channels": [
    {"name": "#main", "message_count": 42, "last_activity": "2026-02-21T16:00:00Z"},
    {"name": "#worker-B042", "message_count": 15, "last_activity": "2026-02-21T16:30:00Z"}
  ]
}
```

## Posting Messages

### `hub post`

Post a new top-level message to a channel.

```bash
$HUB post --channel <name> --type <type> --author <role> \
  --content <text> [--tags '<json-array>'] [--metadata '<json-object>'] \
  [--worker-id <id>]
```

**Parameters:**

| Param | Required | Description |
|-------|----------|-------------|
| `--channel` | Yes | Target channel (`#main`, `#general`, `#worker-B042`) |
| `--type` | Yes | `note`, `decision`, `request`, `status` |
| `--author` | Yes | Agent role (`scout`, `orchestrator`, `executor`, `user`, etc.) |
| `--content` | Yes | Message content (markdown) |
| `--tags` | No | JSON array of tag strings |
| `--metadata` | No | JSON object with type-specific data |
| `--worker-id` | No | Worker identifier for multi-worker tracking |

**Output:**
```json
{
  "id": "msg-uuid",
  "channel": "#main",
  "type": "note",
  "created_at": "2026-02-21T16:52:00Z"
}
```

### `hub reply`

Reply to an existing message (creates a thread).

```bash
$HUB reply --thread <message-id> --author <role> \
  --content <text> [--tags '<json-array>'] [--metadata '<json-object>']
```

The reply inherits the parent's `channel` and `type` by default. Override with `--type` if needed (e.g., replying to a `request` with a `note`).

## Reading Messages

### `hub read`

Read messages from a channel with optional filters.

```bash
$HUB read [--channel <name>] [--type <type>] [--author <role>] \
  [--tags <tag1,tag2>] [--since <iso-timestamp>] [--until <iso-timestamp>] \
  [--limit <n>] [--offset <n>] [--thread <message-id>] \
  [--unresolved] [--worker-id <id>]
```

**Filters:**

| Filter | Description |
|--------|-------------|
| `--channel` | Filter by channel (omit for all channels) |
| `--type` | Filter by message type |
| `--author` | Filter by author role |
| `--tags` | Comma-separated tags (AND logic) |
| `--since` | Messages after this timestamp |
| `--until` | Messages before this timestamp |
| `--limit` | Max results (default: 50) |
| `--thread` | Read all replies in a thread |
| `--unresolved` | Only requests where `metadata.resolved != true` |

**Output:**
```json
{
  "messages": [...],
  "total": 42,
  "has_more": true
}
```

### `hub read-thread`

Shortcut for reading a full thread (original message + all replies).

```bash
$HUB read-thread <message-id>
```

## Search

### `hub search`

Full-text search across all messages using FTS5 with BM25 ranking.

```bash
$HUB search <query> [--channel <name>] [--type <type>] \
  [--tags <tag1,tag2>] [--limit <n>] [--since <iso-timestamp>]
```

**Query syntax:**
- Simple terms: `auth bcrypt` (implicit AND)
- Exact phrase: `"password hashing"`
- OR: `auth OR authentication`
- NOT: `auth NOT deprecated`
- Prefix: `authent*`

**Output:**
```json
{
  "results": [
    {
      "id": "msg-uuid",
      "channel": "#main",
      "type": "note",
      "author": "scout",
      "content": "Auth uses bcrypt...",
      "rank": -2.45,
      "snippet": "...uses <mark>bcrypt</mark> for password <mark>hashing</mark>..."
    }
  ],
  "total": 5
}
```

## Watching (Real-Time)

### `hub watch`

Block and wait for new messages matching criteria. Uses fs.watch on the SQLite WAL file for near-real-time notification.

```bash
$HUB watch [--channel <name>] [--type <type>] \
  [--timeout <seconds>] [--count <n>]
```

- `--timeout`: Max seconds to wait (default: 300, 0 = forever)
- `--count`: Return after N matching messages (default: 1)

**Output:** Streams JSON messages as they arrive, one per line (NDJSON).

```json
{"id":"msg-uuid","channel":"#worker-B042","type":"request","author":"executor","content":"Blocked: ...","created_at":"..."}
```

**Use case — blocked worker waiting for resolution:**
```bash
# Worker posts request, then watches for reply
MSG_ID=$($HUB post --channel '#worker-B042' --type request --author executor \
  --content "Blocked: need auth API signature" | jq -r '.id')

# Watch for replies to this thread
$HUB watch --channel '#worker-B042' --type note --timeout 120
```

## Status

### `hub status`

Quick overview of the hub state. Designed to be compact (~100-200 tokens).

```bash
$HUB status [--channel <name>] [--verbose]
```

**Output:**
```json
{
  "hub_id": "uuid",
  "mode": "multi-worker",
  "uptime_minutes": 45,
  "channels": {
    "#general": {"messages": 12, "unresolved_requests": 0},
    "#worker-B042": {"messages": 28, "unresolved_requests": 1},
    "#worker-B043": {"messages": 22, "unresolved_requests": 0}
  },
  "total_messages": 62,
  "total_unresolved": 1,
  "recent_activity": [
    {"channel": "#worker-B042", "type": "request", "content": "Blocked: ...", "at": "..."}
  ]
}
```

## Message Updates

### `hub update`

Update an existing message (e.g., mark a request as resolved).

```bash
$HUB update <message-id> [--content <text>] [--metadata '<json-object>'] \
  [--tags '<json-array>'] [--author <role>]
```

Merges metadata (doesn't replace). Sets `updated_at`.

## Bulk Operations

### `hub export`

Export all messages (or filtered subset) as NDJSON for archival or analysis.

```bash
$HUB export [--channel <name>] [--since <timestamp>] [--format ndjson|csv]
```

### `hub import`

Import messages from NDJSON (for restoring or migrating).

```bash
$HUB import <file.ndjson>
```

## Maintenance

### `hub gc`

Garbage collect old messages, compact database.

```bash
$HUB gc [--older-than <duration>] [--dry-run]
```

### `hub stats`

Database statistics: size, message counts by type/channel, FTS index health.

```bash
$HUB stats
```
