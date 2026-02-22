# agents-hub — CLI & API Reference

Complete reference for all 14 hub commands. All commands return JSON by default.

---

## Global Options

Available for all commands:

| Flag | Description | Default |
|------|-------------|---------|
| `--db <path>` | Path to SQLite database | `.git/devpartner/hub.db` |
| `--json` | Force JSON output | `true` |
| `--pretty` | Pretty-print JSON | `false` |

**Example:**
```bash
$HUB status --db /custom/path/hub.db --pretty
```

---

## Initialization

### `hub init`

Creates a new hub database with default channels.

**Synopsis:**
```bash
$HUB init [--mode single|multi] [--hub-id <uuid>]
```

**Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `--mode` | No | `single` (default): Creates `#main` only<br>`multi`: Creates `#main` + `#general` |
| `--hub-id` | No | Custom hub UUID (auto-generated if omitted) |

**Output:**
```json
{
  "hub_id": "550e8400-e29b-41d4-a716-446655440000",
  "mode": "single",
  "db_path": ".git/devpartner/hub.db",
  "channels": ["#main"]
}
```

**Example:**
```bash
# Single-worker mode (v16)
$HUB init --mode single

# Multi-worker mode (v17)
$HUB init --mode multi
```

---

## Channel Management

### `hub channel create`

Create a new channel.

**Synopsis:**
```bash
$HUB channel create <name> [--description <text>] [--worker-id <id>]
```

**Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `<name>` | Yes | Channel name (must start with `#`) |
| `--description` | No | Human-readable channel purpose |
| `--worker-id` | No | Worker identifier for multi-worker tracking |

**Output:**
```json
{
  "id": "ch-uuid",
  "name": "#worker-B042",
  "description": "Worker B042: Implement password reset",
  "worker_id": "B042",
  "created_at": "2026-02-21T16:00:00Z"
}
```

**Example:**
```bash
$HUB channel create '#worker-B042' --worker-id B042 \
  --description "Worker B042: Implement password reset"
```

---

### `hub channel list`

List all channels with optional statistics.

**Synopsis:**
```bash
$HUB channel list [--include-stats]
```

**Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `--include-stats` | No | Include message counts and last activity |

**Output:**
```json
{
  "channels": [
    {
      "name": "#main",
      "message_count": 42,
      "last_activity": "2026-02-21T16:00:00Z"
    },
    {
      "name": "#worker-B042",
      "message_count": 15,
      "last_activity": "2026-02-21T16:30:00Z"
    }
  ]
}
```

**Example:**
```bash
$HUB channel list --include-stats
```

---

## Posting Messages

### `hub post`

Post a new top-level message to a channel.

**Synopsis:**
```bash
$HUB post --channel <name> --type <type> --author <role> \
  --content <text> [--tags '<json-array>'] [--metadata '<json-object>'] \
  [--worker-id <id>]
```

**Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `--channel` | Yes | Target channel (e.g., `#main`, `#worker-B042`) |
| `--type` | Yes | Message type: `note`, `decision`, `request`, `status` |
| `--author` | Yes | Agent role (e.g., `scout`, `executor`, `orchestrator`) |
| `--content` | Yes | Message content (markdown supported) |
| `--tags` | No | JSON array of tag strings |
| `--metadata` | No | JSON object with type-specific data |
| `--worker-id` | No | Worker identifier for multi-worker tracking |

**Message Types:**

| Type | Purpose | Common Metadata Fields |
|------|---------|------------------------|
| `note` | Findings, snippets, context | `path`, `lines`, `snippet_id` |
| `decision` | Proposals, approvals | `status`, `approach_id` |
| `request` | Help, blockers, scout requests | `severity`, `target`, `resolved`, `request_type` |
| `status` | Progress updates | `step`, `total_steps`, `checkpoint_number` |

**Output:**
```json
{
  "id": "msg-550e8400-e29b-41d4-a716-446655440000",
  "channel": "#main",
  "type": "note",
  "created_at": "2026-02-21T16:52:00Z"
}
```

**Examples:**

```bash
# Post a finding
$HUB post --channel '#main' --type note --author scout \
  --content "Auth uses bcrypt for password hashing" \
  --tags '["finding","auth","security"]' \
  --metadata '{"path":"src/auth.ts","lines":[45,60]}'

# Post a blocker request
$HUB post --channel '#worker-B042' --type request --author executor \
  --content "Blocked: type mismatch in SharedTypes.AuthResponse" \
  --tags '["blocked","types"]' \
  --metadata '{"severity":"blocker","target":"super-orchestrator","resolved":false}'

# Post a progress update
$HUB post --channel '#main' --type status --author executor \
  --content "Step 2/4: Email service implemented" \
  --metadata '{"step":2,"total_steps":4}'

# Post a decision proposal
$HUB post --channel '#main' --type decision --author creative \
  --content "Approach: Use token-based password reset flow" \
  --metadata '{"status":"proposed","approach_id":"D-1"}'
```

---

### `hub reply`

Reply to an existing message (creates a thread).

**Synopsis:**
```bash
$HUB reply --thread <message-id> --author <role> \
  --content <text> [--tags '<json-array>'] [--metadata '<json-object>'] \
  [--type <type>]
```

**Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `--thread` | Yes | Parent message ID |
| `--author` | Yes | Agent role |
| `--content` | Yes | Reply content |
| `--tags` | No | JSON array of tag strings |
| `--metadata` | No | JSON object |
| `--type` | No | Override type (inherits parent's type by default) |

**Output:**
```json
{
  "id": "msg-uuid",
  "parent_id": "msg-parent-uuid",
  "channel": "#main",
  "type": "note",
  "created_at": "2026-02-21T16:55:00Z"
}
```

**Examples:**

```bash
# Approve a decision
$HUB reply --thread $DECISION_ID --author orchestrator \
  --content "Approved. Proceed with token-based flow." \
  --metadata '{"status":"approved"}'

# Resolve a blocker
$HUB reply --thread $REQUEST_ID --author super-orchestrator \
  --content "Resolution: Pull latest from main (commit abc123)" \
  --metadata '{"resolved":true}'

# Answer a scout request
$HUB reply --thread $REQUEST_ID --author scout \
  --content "sendEmail(to: string, subject: string, body: string): Promise<void>" \
  --metadata '{"resolved":true,"path":"src/email/service.ts","lines":[45,48]}'
```

---

## Reading Messages

### `hub read`

Read messages from a channel with optional filters.

**Synopsis:**
```bash
$HUB read [--channel <name>] [--type <type>] [--author <role>] \
  [--tags <tag1,tag2>] [--since <iso-timestamp>] [--until <iso-timestamp>] \
  [--limit <n>] [--offset <n>] [--thread <message-id>] \
  [--unresolved] [--worker-id <id>]
```

**Parameters:**

| Parameter | Description | Default |
|-----------|-------------|---------|
| `--channel` | Filter by channel (omit for all channels) | All |
| `--type` | Filter by message type | All |
| `--author` | Filter by author role | All |
| `--tags` | Comma-separated tags (AND logic) | None |
| `--since` | Messages after this timestamp (ISO 8601) | None |
| `--until` | Messages before this timestamp (ISO 8601) | None |
| `--limit` | Max results | 50 |
| `--offset` | Skip N results (pagination) | 0 |
| `--thread` | Read all replies in a thread | None |
| `--unresolved` | Only `request` messages where `metadata.resolved != true` | false |
| `--worker-id` | Filter by worker ID | None |

**Output:**
```json
{
  "messages": [
    {
      "id": "msg-uuid",
      "channel": "#main",
      "type": "note",
      "author": "scout",
      "content": "Auth uses bcrypt for password hashing",
      "tags": ["finding", "auth"],
      "metadata": {"path": "src/auth.ts", "lines": [45, 60]},
      "created_at": "2026-02-21T16:00:00Z",
      "updated_at": null,
      "parent_id": null
    }
  ],
  "total": 42,
  "has_more": true
}
```

**Examples:**

```bash
# All messages in #main
$HUB read --channel '#main'

# Recent notes
$HUB read --type note --limit 10

# Unresolved requests (blockers)
$HUB read --type request --unresolved

# Messages with specific tags
$HUB read --tags auth,security

# Messages since timestamp
$HUB read --since '2026-02-21T16:00:00Z'

# Paginated results
$HUB read --limit 20 --offset 40

# Messages by specific author
$HUB read --author scout --type note
```

---

### `hub read-thread`

Shortcut for reading a full thread (original message + all replies).

**Synopsis:**
```bash
$HUB read-thread <message-id>
```

**Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `<message-id>` | Yes | Thread root message ID |

**Output:**
```json
{
  "thread": [
    {
      "id": "msg-root",
      "content": "Blocked: type mismatch...",
      "type": "request",
      "created_at": "2026-02-21T16:00:00Z"
    },
    {
      "id": "msg-reply-1",
      "parent_id": "msg-root",
      "content": "Resolution: Pull latest...",
      "type": "note",
      "created_at": "2026-02-21T16:05:00Z"
    }
  ],
  "total": 2
}
```

**Example:**
```bash
# Read full thread for a request
$HUB read-thread $REQUEST_ID
```

---

## Search

### `hub search`

Full-text search across all messages using FTS5 with BM25 ranking.

**Synopsis:**
```bash
$HUB search <query> [--channel <name>] [--type <type>] \
  [--tags <tag1,tag2>] [--limit <n>] [--since <iso-timestamp>]
```

**Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `<query>` | Yes | FTS5 search query (see syntax below) |
| `--channel` | No | Filter by channel |
| `--type` | No | Filter by message type |
| `--tags` | No | Comma-separated tags (AND logic) |
| `--limit` | No | Max results (default: 20) |
| `--since` | No | Messages after timestamp |

**Query Syntax:**

| Syntax | Example | Description |
|--------|---------|-------------|
| Simple terms | `auth bcrypt` | Implicit AND: both terms must match |
| Exact phrase | `"password hashing"` | Exact phrase match |
| OR | `auth OR authentication` | Either term matches |
| NOT | `auth NOT deprecated` | First term but not second |
| Prefix | `authent*` | Prefix matching |

**Output:**
```json
{
  "results": [
    {
      "id": "msg-uuid",
      "channel": "#main",
      "type": "note",
      "author": "scout",
      "content": "Auth uses bcrypt for password hashing",
      "rank": -2.45,
      "snippet": "...uses <mark>bcrypt</mark> for password <mark>hashing</mark>...",
      "created_at": "2026-02-21T16:00:00Z"
    }
  ],
  "total": 5
}
```

**Examples:**

```bash
# Simple search
$HUB search "auth bcrypt"

# Search with OR
$HUB search "auth OR authentication"

# Exact phrase
$HUB search '"password reset"'

# Search in specific channel
$HUB search "auth" --channel '#worker-B042'

# Search with type filter
$HUB search "blocked" --type request

# Search with tag filter
$HUB search "auth" --tags security,finding

# Recent search results only
$HUB search "auth" --since '2026-02-21T16:00:00Z'
```

---

## Watching (Real-Time)

### `hub watch`

Block and wait for new messages matching criteria. Uses fs.watch on SQLite WAL for near-real-time notification.

**Synopsis:**
```bash
$HUB watch [--channel <name>] [--type <type>] \
  [--timeout <seconds>] [--count <n>]
```

**Parameters:**

| Parameter | Description | Default |
|-----------|-------------|---------|
| `--channel` | Watch specific channel | All |
| `--type` | Watch specific message type | All |
| `--timeout` | Max seconds to wait (0 = forever) | 300 |
| `--count` | Return after N matching messages | 1 |

**Output:**

Streams JSON messages as they arrive (NDJSON format):

```json
{"id":"msg-uuid","channel":"#worker-B042","type":"request","author":"executor","content":"Blocked: ...","created_at":"2026-02-21T17:00:00Z"}
```

**Examples:**

```bash
# Wait for any request
$HUB watch --type request --timeout 120

# Wait for messages in specific channel
$HUB watch --channel '#worker-B042' --timeout 60

# Wait for resolution (after posting request)
MSG_ID=$($HUB post --channel '#worker-B042' --type request --author executor \
  --content "Blocked: need auth signature" | jq -r '.id')
$HUB watch --channel '#worker-B042' --timeout 300

# Watch indefinitely
$HUB watch --timeout 0
```

**Use Cases:**

1. **Blocked worker waiting for resolution** — Worker posts request, then watches channel for reply
2. **Super-Orchestrator monitoring** — Watch for blockers across all channels
3. **Event-driven coordination** — React to status updates from other workers

---

## Status

### `hub status`

Quick overview of hub state. Compact output (~100-200 tokens).

**Synopsis:**
```bash
$HUB status [--channel <name>] [--verbose]
```

**Parameters:**

| Parameter | Description |
|-----------|-------------|
| `--channel` | Status for specific channel only |
| `--verbose` | Include recent activity details |

**Output:**
```json
{
  "hub_id": "550e8400-e29b-41d4-a716-446655440000",
  "mode": "multi-worker",
  "uptime_minutes": 45,
  "channels": {
    "#general": {
      "messages": 12,
      "unresolved_requests": 0
    },
    "#worker-B042": {
      "messages": 28,
      "unresolved_requests": 1
    },
    "#worker-B043": {
      "messages": 22,
      "unresolved_requests": 0
    }
  },
  "total_messages": 62,
  "total_unresolved": 1,
  "recent_activity": [
    {
      "channel": "#worker-B042",
      "type": "request",
      "content": "Blocked: type mismatch...",
      "created_at": "2026-02-21T16:55:00Z"
    }
  ]
}
```

**Examples:**

```bash
# Quick overview
$HUB status

# Verbose with recent activity
$HUB status --verbose

# Single channel status
$HUB status --channel '#worker-B042'
```

---

## Message Updates

### `hub update`

Update an existing message (e.g., mark request as resolved).

**Synopsis:**
```bash
$HUB update <message-id> [--content <text>] [--metadata '<json-object>'] \
  [--tags '<json-array>'] [--author <role>]
```

**Parameters:**

| Parameter | Description |
|-----------|-------------|
| `<message-id>` | Message ID to update |
| `--content` | Replace content |
| `--metadata` | Merge metadata (doesn't replace) |
| `--tags` | Replace tags |
| `--author` | Update author (rare) |

**Output:**
```json
{
  "id": "msg-uuid",
  "updated_at": "2026-02-21T17:00:00Z"
}
```

**Examples:**

```bash
# Mark request as resolved
$HUB update $MSG_ID --metadata '{"resolved":true}'

# Update decision status
$HUB update $DECISION_ID --metadata '{"status":"approved"}'

# Add tags
$HUB update $MSG_ID --tags '["finding","auth","reviewed"]'
```

**Note:** Metadata is **merged**, not replaced. To remove a field, explicitly set it to `null`.

---

## Bulk Operations

### `hub export`

Export all messages (or filtered subset) as NDJSON for archival or analysis.

**Synopsis:**
```bash
$HUB export [--channel <name>] [--since <timestamp>] [--format ndjson|csv] [--output <file>]
```

**Parameters:**

| Parameter | Description | Default |
|-----------|-------------|---------|
| `--channel` | Export specific channel | All |
| `--since` | Export messages after timestamp | All |
| `--format` | Output format (`ndjson` or `csv`) | `ndjson` |
| `--output` | Output file path | stdout |

**Output (NDJSON):**
```json
{"id":"msg-1","channel":"#main","type":"note","content":"..."}
{"id":"msg-2","channel":"#main","type":"status","content":"..."}
```

**Examples:**

```bash
# Export all messages
$HUB export > messages.ndjson

# Export specific channel
$HUB export --channel '#worker-B042' --output worker-B042.ndjson

# Export recent messages
$HUB export --since '2026-02-21T00:00:00Z' --format csv
```

---

### `hub import`

Import messages from NDJSON (for restoring or migrating).

**Synopsis:**
```bash
$HUB import <file.ndjson> [--skip-duplicates]
```

**Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `<file.ndjson>` | Yes | NDJSON file to import |
| `--skip-duplicates` | No | Skip messages with duplicate IDs |

**Output:**
```json
{
  "imported": 42,
  "skipped": 3,
  "errors": 0
}
```

**Example:**
```bash
$HUB import messages.ndjson --skip-duplicates
```

---

## Maintenance

### `hub gc`

Garbage collect old messages, compact database.

**Synopsis:**
```bash
$HUB gc [--older-than <duration>] [--dry-run]
```

**Parameters:**

| Parameter | Description | Default |
|-----------|-------------|---------|
| `--older-than` | Delete messages older than duration (e.g., `30d`, `90d`) | No deletion |
| `--dry-run` | Show what would be deleted without deleting | false |

**Output:**
```json
{
  "messages_deleted": 150,
  "size_before_mb": 25.4,
  "size_after_mb": 12.1,
  "compacted": true
}
```

**Examples:**

```bash
# Delete messages older than 90 days
$HUB gc --older-than 90d

# Dry run to see what would be deleted
$HUB gc --older-than 30d --dry-run

# Compact without deleting
$HUB gc
```

---

### `hub stats`

Database statistics: size, message counts by type/channel, FTS index health.

**Synopsis:**
```bash
$HUB stats
```

**Output:**
```json
{
  "db_size_mb": 12.5,
  "total_messages": 420,
  "by_type": {
    "note": 250,
    "decision": 50,
    "request": 80,
    "status": 40
  },
  "by_channel": {
    "#main": 200,
    "#worker-B042": 120,
    "#worker-B043": 100
  },
  "fts_index_size_mb": 3.2,
  "fts_index_health": "good"
}
```

**Example:**
```bash
$HUB stats
```

---

## Error Handling

All commands return JSON with error details on failure:

```json
{
  "error": "Channel not found",
  "code": "ERR_CHANNEL_NOT_FOUND",
  "details": {
    "channel": "#worker-B999"
  }
}
```

Exit codes:
- `0` — Success
- `1` — General error
- `2` — Invalid arguments
- `3` — Database error
- `42` — Worker blocked (special exit code for multi-worker coordination)

**Example error handling in bash:**
```bash
if ! MSG_ID=$($HUB post --channel '#main' --type note --author scout --content "..." | jq -r '.id'); then
  echo "Failed to post message"
  exit 1
fi
```

---

## Performance Notes

- **FTS5 search** is fast for full-text queries (BM25 ranking)
- **Watch** uses SQLite WAL file watching for near-real-time updates (~100-500ms latency)
- **Read with filters** uses indexes on `channel`, `type`, `author`, and timestamps
- Database is write-ahead log (WAL) mode for concurrent reads during writes
- Recommended max: 10K messages per channel for optimal performance
