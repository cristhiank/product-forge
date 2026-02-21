# agents-hub — Data Model

## Overview

agents-hub uses a **single-table message store** backed by SQLite. All entities are messages in channels. Type-specific data lives in a flexible `metadata` JSON blob.

## Channels

Channels are logical namespaces for messages. They are not separate databases — just a `TEXT` column on the messages table.

### Channel Naming Convention

| Pattern | Purpose | Example |
|---------|---------|---------|
| `#main` | Default channel in single-worker mode | Every hub has this |
| `#general` | Cross-worker announcements, user directives | Multi-worker mode |
| `#worker-{id}` | Worker's private workspace | `#worker-B042` |
| `#review` | Code review / verification findings | Optional |
| Custom | User-defined for any purpose | `#frontend`, `#api` |

### Channel Rules

- Channels are created on first write (implicit) or explicitly via `hub channel create`
- `#main` is created automatically on `hub init`
- In multi-worker mode, `#general` is created automatically
- Channel names must start with `#` and contain only lowercase letters, numbers, and hyphens

### Visibility Model

| Actor | Read | Write |
|-------|------|-------|
| Super-Orchestrator | All channels | All channels |
| Worker Orchestrator | All channels | Own `#worker-{id}` + `#general` |
| Subagents (Scout, etc.) | Own worker's channel + `#general` | Own worker's channel |
| User | All channels | All channels |

## Messages

### Schema

```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,              -- UUID v4
  channel TEXT NOT NULL,            -- '#main', '#general', '#worker-B042'
  type TEXT NOT NULL,               -- 'note', 'decision', 'request', 'status'
  author TEXT NOT NULL,             -- agent role: 'scout', 'orchestrator', 'user', etc.
  content TEXT NOT NULL,            -- main content (markdown)
  tags TEXT DEFAULT '[]',           -- JSON array of strings
  thread_id TEXT,                   -- parent message ID (NULL = top-level)
  metadata TEXT DEFAULT '{}',       -- JSON object for type-specific data
  created_at TEXT NOT NULL,         -- ISO-8601 UTC
  updated_at TEXT,                  -- ISO-8601 UTC (for edits)
  worker_id TEXT,                   -- which worker authored this (for multi-worker tracking)
  FOREIGN KEY (thread_id) REFERENCES messages(id)
);

-- Indexes
CREATE INDEX idx_messages_channel ON messages(channel);
CREATE INDEX idx_messages_type ON messages(type);
CREATE INDEX idx_messages_thread ON messages(thread_id);
CREATE INDEX idx_messages_created ON messages(created_at);
CREATE INDEX idx_messages_worker ON messages(worker_id);
CREATE INDEX idx_messages_channel_type ON messages(channel, type);
```

### Message Types

#### `note` — Knowledge and observations

Replaces: fact, snippet, trail, constraint from agents-board.

A note is any piece of knowledge an agent wants to share. Tags distinguish subtypes.

```json
{
  "id": "msg-a1b2c3",
  "channel": "#main",
  "type": "note",
  "author": "scout",
  "content": "Auth module uses bcrypt for password hashing with 12 salt rounds",
  "tags": ["auth", "security", "finding"],
  "metadata": {
    "confidence": "high",
    "path": "src/auth/hash.ts",
    "lines": [15, 28],
    "git_hash": "abc123",
    "evidence": [
      {"type": "file", "ref": "src/auth/hash.ts:15-28"}
    ]
  }
}
```

**Tag conventions for notes:**

| Tag | Meaning | Replaces |
|-----|---------|----------|
| `finding` | Discovered fact about codebase | Fact |
| `snippet` | Cached file content | Snippet |
| `trail` | Memory candidate for extraction | Trail |
| `constraint` | Requirement or limitation | Constraint |
| `plan` | Execution plan | Plan entity |
| `external` | From web search / external source | — |
| `checkpoint` | Progress checkpoint | — |

#### `decision` — Choices and proposals

Replaces: decision + alternative from agents-board.

```json
{
  "id": "msg-d4e5f6",
  "channel": "#main",
  "type": "decision",
  "author": "creative",
  "content": "Use crypto.randomBytes for token generation",
  "tags": ["security", "tokens"],
  "metadata": {
    "status": "proposed",
    "rationale": "Cryptographically secure, no external deps",
    "alternatives": [
      {"name": "uuid v4", "pros": ["Simple"], "cons": ["Not crypto-secure"]},
      {"name": "nanoid", "pros": ["Short IDs"], "cons": ["External dep"]}
    ],
    "based_on": ["msg-a1b2c3"]
  }
}
```

**Decision lifecycle:**
1. Creative posts `decision` with `status: "proposed"`
2. Orchestrator replies in thread with `status: "approved"` or `status: "rejected"`
3. The thread forms the complete decision record

#### `request` — Help needed

Replaces: alert, scout_request from agents-board.

```json
{
  "id": "msg-g7h8i9",
  "channel": "#worker-B042",
  "type": "request",
  "author": "executor",
  "content": "Blocked: conflicting type definitions in shared auth module. Need resolution.",
  "tags": ["blocked", "auth"],
  "metadata": {
    "severity": "blocker",
    "target": "super-orchestrator",
    "resolved": false,
    "request_type": "help"
  }
}
```

**Request types:**

| `request_type` | Purpose |
|----------------|---------|
| `help` | General help request |
| `scout` | Need codebase information (replaces scout_requests) |
| `review` | Need code review / verification |
| `user` | Need human input |
| `blocked` | Worker is stuck, needs resolution |

**Resolution**: Super-Orchestrator (or Orchestrator) replies in thread. The reply's metadata includes `{"resolved": true}`.

#### `status` — Progress updates

Replaces: plan step status, phase transitions from agents-board.

```json
{
  "id": "msg-j0k1l2",
  "channel": "#worker-B042",
  "type": "status",
  "author": "executor",
  "content": "Step 2/5 complete: email service integrated",
  "tags": ["progress"],
  "metadata": {
    "step": 2,
    "total_steps": 5,
    "phase": "execution",
    "files_changed": ["src/email/service.ts", "src/email/templates.ts"],
    "files_created": ["src/email/__tests__/service.test.ts"]
  }
}
```

## Full-Text Search

```sql
CREATE VIRTUAL TABLE messages_fts USING fts5(
  content,
  tags,
  metadata,
  content=messages,
  content_rowid=rowid,
  tokenize='porter unicode61'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER messages_ai AFTER INSERT ON messages BEGIN
  INSERT INTO messages_fts(rowid, content, tags, metadata)
  VALUES (new.rowid, new.content, new.tags, new.metadata);
END;

CREATE TRIGGER messages_ad AFTER DELETE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, content, tags, metadata)
  VALUES ('delete', old.rowid, old.content, old.tags, old.metadata);
END;

CREATE TRIGGER messages_au AFTER UPDATE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, content, tags, metadata)
  VALUES ('delete', old.rowid, old.content, old.tags, old.metadata);
  INSERT INTO messages_fts(rowid, content, tags, metadata)
  VALUES (new.rowid, new.content, new.tags, new.metadata);
END;
```

### Search query examples

```sql
-- Simple keyword search
SELECT * FROM messages WHERE id IN (
  SELECT id FROM messages m JOIN messages_fts f ON m.rowid = f.rowid
  WHERE messages_fts MATCH 'auth AND bcrypt'
) ORDER BY created_at DESC;

-- Channel-scoped search
SELECT * FROM messages
WHERE channel = '#worker-B042'
AND id IN (SELECT id FROM messages m JOIN messages_fts f ON m.rowid = f.rowid WHERE messages_fts MATCH 'blocked')
ORDER BY created_at DESC;

-- Cross-channel search for all unresolved requests
SELECT * FROM messages
WHERE type = 'request'
AND json_extract(metadata, '$.resolved') = false
ORDER BY created_at DESC;
```

## Semantic Search (Future)

```sql
-- Embeddings table for semantic search
CREATE TABLE embeddings (
  message_id TEXT PRIMARY KEY,
  vector BLOB NOT NULL,            -- float32 array, serialized
  model TEXT NOT NULL,              -- e.g., 'text-embedding-3-small'
  created_at TEXT NOT NULL,
  FOREIGN KEY (message_id) REFERENCES messages(id)
);
```

Hybrid search: FTS5 for keyword recall + cosine similarity on embeddings for semantic relevance. Rank fusion to combine scores.

## Hub Metadata

```sql
CREATE TABLE hub_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Example entries
INSERT INTO hub_meta VALUES ('schema_version', '1.0');
INSERT INTO hub_meta VALUES ('created_at', '2026-02-21T16:52:00Z');
INSERT INTO hub_meta VALUES ('mode', 'multi-worker');  -- or 'single'
INSERT INTO hub_meta VALUES ('hub_id', 'uuid-here');
```

## Channels Table

```sql
CREATE TABLE channels (
  name TEXT PRIMARY KEY,            -- '#main', '#general', '#worker-B042'
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,         -- agent role or 'system'
  description TEXT,                 -- optional channel purpose
  worker_id TEXT                    -- for worker channels, links to the worker
);
```
