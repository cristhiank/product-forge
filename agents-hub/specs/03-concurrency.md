# agents-hub — Concurrency & Real-Time

## The Core Challenge

In v17, multiple Copilot CLI processes run simultaneously on the same codebase. Each process needs to read and write to the shared hub without corruption, and ideally receive near-real-time notifications when new messages arrive.

## SQLite WAL Mode

### Why SQLite?

| Requirement | SQLite WAL | JSON files | Redis/External |
|-------------|:----------:|:----------:|:--------------:|
| Multi-reader, single-writer | ✅ | ❌ (corruption) | ✅ |
| Zero infrastructure | ✅ | ✅ | ❌ |
| Works offline | ✅ | ✅ | ❌ |
| Portable (single file) | ✅ | ❌ (many files) | ❌ |
| Full-text search built-in | ✅ (FTS5) | ❌ | ❌ |
| ACID transactions | ✅ | ❌ | ✅ |
| Concurrent reads during write | ✅ (WAL) | ❌ | ✅ |

### Configuration

```sql
PRAGMA journal_mode = WAL;          -- Write-Ahead Logging
PRAGMA busy_timeout = 5000;         -- Wait 5s on lock contention
PRAGMA synchronous = NORMAL;        -- Good balance of safety/speed
PRAGMA cache_size = -64000;         -- 64MB cache
PRAGMA foreign_keys = ON;
PRAGMA wal_autocheckpoint = 1000;   -- Checkpoint every 1000 pages
```

### Concurrency Guarantees

- **Multiple readers**: Unlimited concurrent reads, even during writes
- **Single writer**: Only one process can write at a time; others queue with `busy_timeout`
- **Read isolation**: Readers see a consistent snapshot from the start of their transaction
- **Write ordering**: Writes are serialized — first-come, first-served via the WAL

### Connection Management

Each CLI invocation opens a connection, performs operations, and closes. For `watch` commands, the connection stays open.

```typescript
// Connection factory with WAL mode
function openHub(dbPath: string): Database {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  return db;
}
```

## Real-Time Notifications

### fs.watch Approach

When a worker executes `hub watch`, it needs to know when new messages arrive. The approach:

1. Worker opens SQLite connection
2. Worker records the current max `rowid` or timestamp
3. Worker starts `fs.watch` on the database file (or WAL file)
4. On file change event → query for new messages since last check
5. If matching messages found → emit them and optionally exit

```typescript
import { watch } from 'fs';

async function watchChannel(
  db: Database,
  channel: string,
  type?: string,
  timeout: number = 300
): AsyncGenerator<Message> {
  let lastRowid = getMaxRowid(db, channel);
  const deadline = Date.now() + timeout * 1000;

  const watcher = watch(db.name, { persistent: true });

  try {
    for await (const event of watcher) {
      if (Date.now() > deadline) break;

      // Query for new messages
      const newMessages = db.prepare(`
        SELECT * FROM messages
        WHERE channel = ? AND rowid > ?
        ${type ? 'AND type = ?' : ''}
        ORDER BY created_at ASC
      `).all(channel, lastRowid, ...(type ? [type] : []));

      for (const msg of newMessages) {
        lastRowid = msg.rowid;
        yield msg;
      }
    }
  } finally {
    watcher.close();
  }
}
```

### Polling Fallback

If `fs.watch` is unreliable (some OS/filesystem combinations), fall back to polling:

```typescript
async function pollChannel(db: Database, channel: string, intervalMs = 2000) {
  let lastRowid = getMaxRowid(db, channel);

  while (true) {
    await sleep(intervalMs);
    const newMessages = queryNewMessages(db, channel, lastRowid);
    if (newMessages.length > 0) {
      lastRowid = newMessages[newMessages.length - 1].rowid;
      return newMessages;
    }
  }
}
```

## Write Conflict Handling

### Scenario: Two workers post simultaneously

SQLite WAL serializes writes. Worker A's write completes, Worker B queues for up to `busy_timeout` (5s), then completes. No data loss, no corruption.

### Scenario: Worker reads while another writes

WAL mode provides **snapshot isolation**. The reader sees the database as of when its read transaction started. It won't see the writer's uncommitted changes.

### Scenario: Hub database grows large

The `hub gc` command removes old messages and runs `VACUUM` to compact. Alternatively, `wal_autocheckpoint` keeps the WAL file from growing unbounded.

## Multi-Worker Hub Topology

```
                     ┌──────────────────┐
                     │   hub.db (SQLite) │
                     │   WAL mode        │
                     └──────┬───────────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
     ┌────────▼───┐  ┌─────▼──────┐  ┌──▼──────────┐
     │ Super-Orch │  │ Worker-B042│  │ Worker-B043  │
     │ (main dir) │  │ (worktree) │  │ (worktree)   │
     │ reads: all │  │ reads: all │  │ reads: all   │
     │ writes: all│  │ writes:    │  │ writes:      │
     │            │  │ #worker-042│  │ #worker-043  │
     │            │  │ #general   │  │ #general     │
     └────────────┘  └────────────┘  └──────────────┘
```

### Database Location

The hub database lives in the **git common directory** (shared by all worktrees):

```
project/                          ← main directory
├── .git/
│   └── devpartner/
│       └── hub.db                ← shared by all workers
├── src/
└── ...

../worktree-B042/                 ← git worktree
├── .git                          ← file pointing to common git dir
├── src/
└── ...
```

Workers access the same `hub.db` automatically — the CLI uses `git rev-parse --git-common-dir` to resolve the path.

## Error Recovery

### Scenario: Worker process crashes

- SQLite WAL handles this gracefully — incomplete transactions are rolled back on next connection
- The worker's `#worker-{id}` channel will have the last message before the crash
- Super-Orchestrator detects the process exit and can check the channel for context

### Scenario: Hub database locked for too long

- `busy_timeout = 5000` means a process waits up to 5 seconds
- If still locked, the operation fails with `SQLITE_BUSY`
- The CLI should retry once with exponential backoff before reporting an error

### Scenario: Corrupted WAL file

- Run `PRAGMA wal_checkpoint(TRUNCATE)` to reset the WAL
- If database is corrupted, `hub import` from the last NDJSON export
