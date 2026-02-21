#!/usr/bin/env node

// dist/cli.js
import { Command } from "commander";
import { readFileSync } from "node:fs";

// dist/hub.js
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

// dist/db/connection.js
import Database from "better-sqlite3";
function openDatabase(dbPath) {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");
  db.pragma("cache_size = -64000");
  db.pragma("wal_autocheckpoint = 1000");
  return db;
}

// dist/db/schema.js
function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      channel TEXT NOT NULL,
      type TEXT NOT NULL,
      author TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT DEFAULT '[]',
      thread_id TEXT,
      metadata TEXT DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT,
      worker_id TEXT,
      FOREIGN KEY (thread_id) REFERENCES messages(id)
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS channels (
      name TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      description TEXT,
      worker_id TEXT
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS hub_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(type)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_worker ON messages(worker_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_channel_type ON messages(channel, type)`);
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
      content,
      tags,
      metadata,
      content=messages,
      content_rowid=rowid,
      tokenize='porter unicode61'
    )
  `);
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS messages_fts_insert
    AFTER INSERT ON messages
    BEGIN
      INSERT INTO messages_fts(rowid, content, tags, metadata)
      VALUES (new.rowid, new.content, new.tags, new.metadata);
    END
  `);
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS messages_fts_delete
    AFTER DELETE ON messages
    BEGIN
      INSERT INTO messages_fts(messages_fts, rowid, content, tags, metadata)
      VALUES ('delete', old.rowid, old.content, old.tags, old.metadata);
    END
  `);
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS messages_fts_update
    AFTER UPDATE ON messages
    BEGIN
      INSERT INTO messages_fts(messages_fts, rowid, content, tags, metadata)
      VALUES ('delete', old.rowid, old.content, old.tags, old.metadata);
      INSERT INTO messages_fts(rowid, content, tags, metadata)
      VALUES (new.rowid, new.content, new.tags, new.metadata);
    END
  `);
}

// dist/utils/time.js
function now() {
  return (/* @__PURE__ */ new Date()).toISOString();
}

// dist/core/channels.js
function validateChannelName(name) {
  if (!/^#[a-z0-9-]+$/.test(name)) {
    throw new Error(`Invalid channel name: ${name}. Must start with # and contain only lowercase letters, numbers, and hyphens.`);
  }
}
function createChannel(db, name, opts) {
  validateChannelName(name);
  const createdAt = now();
  const stmt = db.prepare(`
    INSERT INTO channels (name, created_at, created_by, description, worker_id)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(name, createdAt, opts.createdBy, opts.description || null, opts.workerId || null);
  const row = db.prepare("SELECT * FROM channels WHERE name = ?").get(name);
  return {
    name: row.name,
    createdAt: row.created_at,
    createdBy: row.created_by,
    description: row.description,
    workerId: row.worker_id
  };
}
function listChannels(db, includeStats = false) {
  if (!includeStats) {
    const rows2 = db.prepare("SELECT * FROM channels ORDER BY created_at DESC").all();
    return rows2.map((row) => ({
      name: row.name,
      createdAt: row.created_at,
      createdBy: row.created_by,
      description: row.description,
      workerId: row.worker_id
    }));
  }
  const rows = db.prepare(`
    SELECT
      c.name,
      c.created_at,
      c.created_by,
      c.description,
      c.worker_id,
      COUNT(m.id) as message_count,
      MAX(m.created_at) as last_activity
    FROM channels c
    LEFT JOIN messages m ON c.name = m.channel
    GROUP BY c.name
    ORDER BY c.created_at DESC
  `).all();
  return rows.map((row) => ({
    name: row.name,
    createdAt: row.created_at,
    createdBy: row.created_by,
    description: row.description,
    workerId: row.worker_id,
    messageCount: row.message_count,
    lastActivity: row.last_activity
  }));
}
function ensureChannel(db, name, createdBy) {
  validateChannelName(name);
  const createdAt = now();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO channels (name, created_at, created_by)
    VALUES (?, ?, ?)
  `);
  stmt.run(name, createdAt, createdBy);
  const row = db.prepare("SELECT * FROM channels WHERE name = ?").get(name);
  return {
    name: row.name,
    createdAt: row.created_at,
    createdBy: row.created_by,
    description: row.description,
    workerId: row.worker_id
  };
}

// dist/utils/ids.js
import { randomUUID } from "node:crypto";
function generateId() {
  return randomUUID();
}

// dist/utils/json.js
function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

// dist/core/messages.js
function rowToMessage(row) {
  return {
    id: row.id,
    channel: row.channel,
    type: row.type,
    author: row.author,
    content: row.content,
    tags: safeJsonParse(row.tags) || [],
    threadId: row.thread_id,
    metadata: safeJsonParse(row.metadata) || {},
    workerId: row.worker_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
function postMessage(db, opts) {
  const id = generateId();
  const createdAt = now();
  const tags = JSON.stringify(opts.tags || []);
  const metadata = JSON.stringify(opts.metadata || {});
  const stmt = db.prepare(`
    INSERT INTO messages (id, channel, type, author, content, tags, metadata, created_at, worker_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, opts.channel, opts.type, opts.author, opts.content, tags, metadata, createdAt, opts.workerId || null);
  const row = db.prepare("SELECT * FROM messages WHERE id = ?").get(id);
  return rowToMessage(row);
}
function replyToMessage(db, threadId, opts) {
  const parent = db.prepare("SELECT channel, type FROM messages WHERE id = ?").get(threadId);
  if (!parent) {
    throw new Error(`Parent message ${threadId} not found`);
  }
  const id = generateId();
  const createdAt = now();
  const tags = JSON.stringify(opts.tags || []);
  const metadata = JSON.stringify(opts.metadata || {});
  const type = opts.type || parent.type;
  const stmt = db.prepare(`
    INSERT INTO messages (id, channel, type, author, content, tags, thread_id, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, parent.channel, type, opts.author, opts.content, tags, threadId, metadata, createdAt);
  const row = db.prepare("SELECT * FROM messages WHERE id = ?").get(id);
  return rowToMessage(row);
}
function updateMessage(db, id, opts) {
  const existing = db.prepare("SELECT metadata FROM messages WHERE id = ?").get(id);
  if (!existing) {
    throw new Error(`Message ${id} not found`);
  }
  const updatedAt = now();
  const parts = [];
  const params = [];
  if (opts.content !== void 0) {
    parts.push("content = ?");
    params.push(opts.content);
  }
  if (opts.tags !== void 0) {
    parts.push("tags = ?");
    params.push(JSON.stringify(opts.tags));
  }
  if (opts.metadata !== void 0) {
    const existingMeta = safeJsonParse(existing.metadata) || {};
    const mergedMeta = { ...existingMeta, ...opts.metadata };
    parts.push("metadata = ?");
    params.push(JSON.stringify(mergedMeta));
  }
  parts.push("updated_at = ?");
  params.push(updatedAt);
  params.push(id);
  const sql = `UPDATE messages SET ${parts.join(", ")} WHERE id = ?`;
  db.prepare(sql).run(...params);
  const row = db.prepare("SELECT * FROM messages WHERE id = ?").get(id);
  return rowToMessage(row);
}
function readMessages(db, opts = {}) {
  const whereClauses = [];
  const params = [];
  if (opts.channel) {
    whereClauses.push("channel = ?");
    params.push(opts.channel);
  }
  if (opts.type) {
    whereClauses.push("type = ?");
    params.push(opts.type);
  }
  if (opts.author) {
    whereClauses.push("author = ?");
    params.push(opts.author);
  }
  if (opts.workerId) {
    whereClauses.push("worker_id = ?");
    params.push(opts.workerId);
  }
  if (opts.threadId !== void 0) {
    if (opts.threadId === null) {
      whereClauses.push("thread_id IS NULL");
    } else {
      whereClauses.push("thread_id = ?");
      params.push(opts.threadId);
    }
  }
  if (opts.since) {
    whereClauses.push("created_at >= ?");
    params.push(opts.since);
  }
  if (opts.until) {
    whereClauses.push("created_at <= ?");
    params.push(opts.until);
  }
  if (opts.tags && opts.tags.length > 0) {
    for (const tag of opts.tags) {
      whereClauses.push(`
        EXISTS (
          SELECT 1 FROM json_each(tags)
          WHERE json_each.value = ?
        )
      `);
      params.push(tag);
    }
  }
  if (opts.unresolved === true) {
    whereClauses.push(`json_extract(metadata, '$.resolved') IS NOT true`);
  }
  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
  const countSql = `SELECT COUNT(*) as count FROM messages ${whereClause}`;
  const { count: total } = db.prepare(countSql).get(...params);
  const limit = opts.limit || 50;
  const offset = opts.offset || 0;
  const sql = `
    SELECT * FROM messages
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `;
  const rows = db.prepare(sql).all(...params, limit, offset);
  const messages = rows.map(rowToMessage);
  const hasMore = offset + messages.length < total;
  return { messages, total, hasMore };
}
function readThread(db, messageId) {
  const parent = db.prepare("SELECT * FROM messages WHERE id = ?").get(messageId);
  if (!parent) {
    throw new Error(`Message ${messageId} not found`);
  }
  const replies = db.prepare("SELECT * FROM messages WHERE thread_id = ? ORDER BY created_at ASC").all(messageId);
  return [parent, ...replies].map(rowToMessage);
}

// dist/core/search.js
function searchMessages(db, query, opts = {}) {
  const whereClauses = ["messages_fts MATCH ?"];
  const params = [query];
  if (opts.channel) {
    whereClauses.push("m.channel = ?");
    params.push(opts.channel);
  }
  if (opts.type) {
    whereClauses.push("m.type = ?");
    params.push(opts.type);
  }
  if (opts.since) {
    whereClauses.push("m.created_at >= ?");
    params.push(opts.since);
  }
  if (opts.tags && opts.tags.length > 0) {
    for (const tag of opts.tags) {
      whereClauses.push(`
        EXISTS (
          SELECT 1 FROM json_each(m.tags)
          WHERE json_each.value = ?
        )
      `);
      params.push(tag);
    }
  }
  const whereClause = whereClauses.join(" AND ");
  const limit = opts.limit || 50;
  const sql = `
    SELECT
      m.*,
      bm25(messages_fts) as rank,
      highlight(messages_fts, 0, '<mark>', '</mark>') as highlighted_content
    FROM messages_fts
    JOIN messages m ON messages_fts.rowid = m.rowid
    WHERE ${whereClause}
    ORDER BY rank
    LIMIT ?
  `;
  const rows = db.prepare(sql).all(...params, limit);
  return rows.map((row) => ({
    id: row.id,
    channel: row.channel,
    type: row.type,
    author: row.author,
    content: row.content,
    tags: safeJsonParse(row.tags) || [],
    threadId: row.thread_id,
    metadata: safeJsonParse(row.metadata) || {},
    workerId: row.worker_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    rank: row.rank,
    highlightedContent: row.highlighted_content
  }));
}

// dist/core/watch.js
import { watch as fsWatch } from "node:fs";
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function rowToMessage2(row) {
  return {
    id: row.id,
    channel: row.channel,
    type: row.type,
    author: row.author,
    content: row.content,
    tags: safeJsonParse(row.tags) || [],
    threadId: row.thread_id,
    metadata: safeJsonParse(row.metadata) || {},
    workerId: row.worker_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
async function* watchMessages(db, dbPath, opts = {}) {
  const timeout = opts.timeout ?? 300;
  const maxCount = opts.count;
  const deadline = timeout === 0 ? Infinity : Date.now() + timeout * 1e3;
  let yieldedCount = 0;
  let lastRowid = 0;
  const whereClauses = [];
  const params = [];
  if (opts.channel) {
    whereClauses.push("channel = ?");
    params.push(opts.channel);
  }
  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
  const maxRowStmt = db.prepare(`SELECT MAX(rowid) as max_rowid FROM messages ${whereClause}`);
  const maxRow = maxRowStmt.get(...params);
  lastRowid = maxRow.max_rowid || 0;
  const queryNewMessages = () => {
    const queryWhere = ["rowid > ?"];
    const queryParams = [lastRowid];
    if (opts.channel) {
      queryWhere.push("channel = ?");
      queryParams.push(opts.channel);
    }
    if (opts.type) {
      queryWhere.push("type = ?");
      queryParams.push(opts.type);
    }
    const sql = `
      SELECT * FROM messages
      WHERE ${queryWhere.join(" AND ")}
      ORDER BY created_at ASC
    `;
    const rows = db.prepare(sql).all(...queryParams);
    return rows.map(rowToMessage2);
  };
  let watcher = null;
  let usePolling = false;
  try {
    watcher = fsWatch(dbPath, { persistent: false });
    while (Date.now() < deadline) {
      const newMessages = queryNewMessages();
      for (const msg of newMessages) {
        yield msg;
        yieldedCount++;
        const rowidStmt = db.prepare("SELECT rowid FROM messages WHERE id = ?");
        const rowidRow = rowidStmt.get(msg.id);
        if (rowidRow && rowidRow.rowid > lastRowid) {
          lastRowid = rowidRow.rowid;
        }
        if (maxCount !== void 0 && yieldedCount >= maxCount) {
          return;
        }
      }
      if (!usePolling && watcher) {
        const timeRemaining = deadline - Date.now();
        if (timeRemaining <= 0)
          break;
        await new Promise((resolve) => {
          const timer = global.setTimeout(() => {
            resolve();
          }, Math.min(timeRemaining, 2e3));
          watcher.once("change", () => {
            global.clearTimeout(timer);
            resolve();
          });
          watcher.once("error", () => {
            usePolling = true;
            global.clearTimeout(timer);
            resolve();
          });
        });
        if (usePolling) {
          watcher.close();
          watcher = null;
        }
      } else {
        const timeRemaining = deadline - Date.now();
        if (timeRemaining <= 0)
          break;
        await delay(Math.min(2e3, timeRemaining));
      }
    }
  } catch (error) {
    usePolling = true;
    while (Date.now() < deadline) {
      const newMessages = queryNewMessages();
      for (const msg of newMessages) {
        yield msg;
        yieldedCount++;
        const rowidStmt = db.prepare("SELECT rowid FROM messages WHERE id = ?");
        const rowidRow = rowidStmt.get(msg.id);
        if (rowidRow && rowidRow.rowid > lastRowid) {
          lastRowid = rowidRow.rowid;
        }
        if (maxCount !== void 0 && yieldedCount >= maxCount) {
          return;
        }
      }
      const timeRemaining = deadline - Date.now();
      if (timeRemaining <= 0)
        break;
      await delay(Math.min(2e3, timeRemaining));
    }
  } finally {
    if (watcher) {
      watcher.close();
    }
  }
}

// dist/core/maintenance.js
import { statSync } from "node:fs";
function rowToMessage3(row) {
  return {
    id: row.id,
    channel: row.channel,
    type: row.type,
    author: row.author,
    content: row.content,
    tags: safeJsonParse(row.tags) || [],
    threadId: row.thread_id,
    metadata: safeJsonParse(row.metadata) || {},
    workerId: row.worker_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
function parseDuration(duration) {
  const match = duration.match(/^(\d+)([dhm])$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}. Use format like "30d", "24h", "60m"`);
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case "d":
      return value * 24 * 60 * 60 * 1e3;
    case "h":
      return value * 60 * 60 * 1e3;
    case "m":
      return value * 60 * 1e3;
    default:
      throw new Error(`Unknown duration unit: ${unit}`);
  }
}
function getStatus(db) {
  const metaRows = db.prepare("SELECT key, value FROM hub_meta").all();
  const meta = Object.fromEntries(metaRows.map((r) => [r.key, r.value]));
  const hubId = meta.hub_id || "unknown";
  const mode = meta.mode === "multi" ? "multi" : "single";
  const channelStatsRows = db.prepare(`
    SELECT 
      channel,
      COUNT(*) as messages,
      SUM(CASE 
        WHEN type = 'request' AND json_extract(metadata, '$.resolved') IS NOT true 
        THEN 1 
        ELSE 0 
      END) as unresolved
    FROM messages
    GROUP BY channel
  `).all();
  const channels = {};
  let totalMessages = 0;
  let totalUnresolved = 0;
  for (const row of channelStatsRows) {
    channels[row.channel] = {
      messages: row.messages,
      unresolvedRequests: row.unresolved
    };
    totalMessages += row.messages;
    totalUnresolved += row.unresolved;
  }
  const recentRows = db.prepare(`
    SELECT channel, type, created_at as timestamp
    FROM messages
    ORDER BY created_at DESC
    LIMIT 5
  `).all();
  const recentActivity = recentRows.map((row) => ({
    channel: row.channel,
    type: row.type,
    timestamp: row.timestamp
  }));
  return {
    hubId,
    mode,
    channels,
    totalMessages,
    totalUnresolved,
    recentActivity
  };
}
function getStats(db, dbPath) {
  let dbSizeBytes = 0;
  let walSizeBytes = 0;
  try {
    dbSizeBytes = statSync(dbPath).size;
  } catch {
  }
  try {
    walSizeBytes = statSync(`${dbPath}-wal`).size;
  } catch {
  }
  const typeRows = db.prepare(`
    SELECT type, COUNT(*) as count
    FROM messages
    GROUP BY type
  `).all();
  const messagesByType = {
    note: 0,
    decision: 0,
    request: 0,
    status: 0
  };
  for (const row of typeRows) {
    messagesByType[row.type] = row.count;
  }
  const channelRows = db.prepare(`
    SELECT channel, COUNT(*) as count
    FROM messages
    GROUP BY channel
  `).all();
  const messagesByChannel = {};
  for (const row of channelRows) {
    messagesByChannel[row.channel] = row.count;
  }
  const totalRow = db.prepare("SELECT COUNT(*) as count FROM messages").get();
  const totalMessages = totalRow.count;
  const messagesCount = totalMessages;
  const ftsRow = db.prepare("SELECT COUNT(*) as count FROM messages_fts").get();
  const ftsCount = ftsRow.count;
  return {
    dbSizeBytes,
    walSizeBytes,
    messagesByType,
    messagesByChannel,
    totalMessages,
    ftsStatus: {
      indexed: ftsCount,
      unindexed: Math.max(0, messagesCount - ftsCount)
    }
  };
}
function exportMessages(db, opts) {
  const whereClauses = [];
  const params = [];
  if (opts?.channel) {
    whereClauses.push("channel = ?");
    params.push(opts.channel);
  }
  if (opts?.since) {
    whereClauses.push("created_at >= ?");
    params.push(opts.since);
  }
  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
  const sql = `
    SELECT * FROM messages
    ${whereClause}
    ORDER BY created_at ASC
  `;
  const rows = db.prepare(sql).all(...params);
  const messages = rows.map(rowToMessage3);
  return messages.map((msg) => JSON.stringify(msg)).join("\n");
}
function importMessages(db, ndjson) {
  const lines = ndjson.split("\n").filter((line) => line.trim().length > 0);
  let imported = 0;
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO messages (
      id, channel, type, author, content, tags, thread_id, metadata, created_at, updated_at, worker_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const line of lines) {
    try {
      const msg = JSON.parse(line);
      const result = stmt.run(msg.id, msg.channel, msg.type, msg.author, msg.content, JSON.stringify(msg.tags), msg.threadId, JSON.stringify(msg.metadata), msg.createdAt, msg.updatedAt, msg.workerId);
      if (result.changes > 0) {
        imported++;
      }
    } catch {
      continue;
    }
  }
  return imported;
}
function garbageCollect(db, olderThan = "30d", dryRun = false) {
  const durationMs = parseDuration(olderThan);
  const threshold = new Date(Date.now() - durationMs).toISOString();
  if (dryRun) {
    const countRow = db.prepare("SELECT COUNT(*) as count FROM messages WHERE created_at < ?").get(threshold);
    return { removed: countRow.count };
  }
  const result = db.prepare("DELETE FROM messages WHERE created_at < ?").run(threshold);
  const removed = result.changes;
  if (removed > 0) {
    db.exec("VACUUM");
  }
  return { removed };
}

// dist/hub.js
var Hub = class _Hub {
  db;
  dbPath;
  /**
   * Create a Hub instance from an existing database
   * @param dbPath - Path to SQLite database file
   */
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = openDatabase(dbPath);
    initSchema(this.db);
  }
  /**
   * Initialize a new Hub with metadata and default channels
   * @param dbPath - Path to SQLite database file
   * @param mode - Hub mode: 'single' for single-agent, 'multi' for multi-agent
   * @param hubId - Optional hub ID (auto-generated if not provided)
   * @returns Hub instance with initialized metadata
   */
  static init(dbPath, mode = "single", hubId) {
    const dir = dirname(dbPath);
    mkdirSync(dir, { recursive: true });
    const hub = new _Hub(dbPath);
    const id = hubId ?? generateId();
    const createdAt = now();
    const insertMeta = hub.db.prepare("INSERT INTO hub_meta (key, value) VALUES (?, ?)");
    insertMeta.run("schema_version", "1.0");
    insertMeta.run("created_at", createdAt);
    insertMeta.run("mode", mode);
    insertMeta.run("hub_id", id);
    createChannel(hub.db, "#main", {
      createdBy: "system",
      description: "Main communication channel"
    });
    if (mode === "multi") {
      createChannel(hub.db, "#general", {
        createdBy: "system",
        description: "General discussion and coordination"
      });
    }
    return hub;
  }
  // ============ Channel Methods ============
  /**
   * Create a new channel
   * @param name - Channel name (must start with #)
   * @param opts - Optional channel metadata
   * @returns Created channel
   */
  channelCreate(name, opts) {
    return createChannel(this.db, name, {
      createdBy: opts?.createdBy ?? "unknown",
      description: opts?.description,
      workerId: opts?.workerId
    });
  }
  /**
   * List all channels
   * @param includeStats - Include message counts and last activity
   * @returns Array of channels or channel info with stats
   */
  channelList(includeStats = false) {
    return listChannels(this.db, includeStats);
  }
  // ============ Message Methods ============
  /**
   * Post a new message to a channel
   * Automatically creates the channel if it doesn't exist
   * @param opts - Message options
   * @returns Created message
   */
  post(opts) {
    ensureChannel(this.db, opts.channel, opts.author);
    return postMessage(this.db, opts);
  }
  /**
   * Reply to an existing message (creates threaded message)
   * @param threadId - ID of the message to reply to
   * @param opts - Reply options
   * @returns Created reply message
   */
  reply(threadId, opts) {
    return replyToMessage(this.db, threadId, opts);
  }
  /**
   * Update an existing message
   * @param id - Message ID
   * @param opts - Update options
   * @returns Updated message
   */
  update(id, opts) {
    return updateMessage(this.db, id, opts);
  }
  /**
   * Read messages with optional filtering
   * @param opts - Query options
   * @returns Paginated message results
   */
  read(opts) {
    return readMessages(this.db, opts);
  }
  /**
   * Read all messages in a thread
   * @param messageId - ID of any message in the thread
   * @returns Array of messages in chronological order
   */
  readThread(messageId) {
    return readThread(this.db, messageId);
  }
  // ============ Search & Watch ============
  /**
   * Full-text search across messages
   * @param query - FTS5 search query
   * @param opts - Search options
   * @returns Ranked search results
   */
  search(query, opts) {
    return searchMessages(this.db, query, opts);
  }
  /**
   * Watch for new messages (async generator)
   * @param opts - Watch options
   * @returns Async generator yielding new messages
   */
  watch(opts) {
    return watchMessages(this.db, this.dbPath, opts);
  }
  // ============ Status & Maintenance ============
  /**
   * Get hub status overview
   * @returns Hub status with message counts and activity
   */
  status() {
    return getStatus(this.db);
  }
  /**
   * Export messages to NDJSON format
   * @param opts - Export options
   * @returns NDJSON string
   */
  export(opts) {
    return exportMessages(this.db, opts);
  }
  /**
   * Import messages from NDJSON format
   * @param ndjson - NDJSON string of messages
   * @returns Number of messages imported
   */
  import(ndjson) {
    return importMessages(this.db, ndjson);
  }
  /**
   * Garbage collect old messages
   * @param olderThan - ISO timestamp (messages older than this will be removed)
   * @param dryRun - If true, only count without deleting
   * @returns Object with number of messages removed
   */
  gc(olderThan, dryRun = false) {
    return garbageCollect(this.db, olderThan, dryRun);
  }
  /**
   * Get hub statistics
   * @returns Hub statistics including DB size and message counts
   */
  stats() {
    return getStats(this.db, this.dbPath);
  }
  /**
   * Close the database connection
   */
  close() {
    this.db.close();
  }
};

// dist/sdk.js
var HubSDK = class {
  hub;
  defaults;
  constructor(hub, defaults = {}) {
    this.hub = hub;
    this.defaults = defaults;
  }
  ch(override) {
    const c = override ?? this.defaults.channel;
    if (!c)
      throw new Error("No channel specified. Pass channel or set default in SDKOptions.");
    return c;
  }
  au(override) {
    const a = override ?? this.defaults.author;
    if (!a)
      throw new Error("No author specified. Pass author or set default in SDKOptions.");
    return a;
  }
  // ========== Findings & Notes ==========
  /** Post a finding (note tagged "finding") */
  postFinding(content, opts = {}) {
    const meta = { ...opts.metadata };
    if (opts.path)
      meta.path = opts.path;
    if (opts.lines)
      meta.lines = opts.lines;
    return this.hub.post({
      channel: this.ch(opts.channel),
      type: "note",
      author: this.au(opts.author),
      content,
      tags: uniqueTags(["finding"], opts.tags),
      metadata: meta
    });
  }
  /** Post a code snippet (note tagged "snippet" with path metadata) */
  postSnippet(path, content, opts = {}) {
    const meta = { path, ...opts.metadata };
    if (opts.gitHash)
      meta.git_hash = opts.gitHash;
    if (opts.language)
      meta.language = opts.language;
    return this.hub.post({
      channel: this.ch(opts.channel),
      type: "note",
      author: this.au(opts.author),
      content,
      tags: uniqueTags(["snippet"], opts.tags),
      metadata: meta
    });
  }
  /** Post a constraint (note tagged "constraint") */
  postConstraint(content, opts = {}) {
    const meta = { ...opts.metadata };
    if (opts.path)
      meta.path = opts.path;
    return this.hub.post({
      channel: this.ch(opts.channel),
      type: "note",
      author: this.au(opts.author),
      content,
      tags: uniqueTags(["constraint"], opts.tags),
      metadata: meta
    });
  }
  // ========== Decisions ==========
  /** Propose a decision (decision with status=proposed) */
  proposeDecision(content, opts = {}) {
    const meta = { status: "proposed", ...opts.metadata };
    if (opts.approachId)
      meta.approach_id = opts.approachId;
    return this.hub.post({
      channel: this.ch(opts.channel),
      type: "decision",
      author: this.au(opts.author),
      content,
      tags: opts.tags,
      metadata: meta
    });
  }
  /** Approve a decision (reply with status=approved) */
  approveDecision(threadId, resolution, opts = {}) {
    return this.hub.reply(threadId, {
      author: this.au(opts.author),
      content: resolution,
      metadata: { status: "approved" }
    });
  }
  /** Reject a decision (reply with status=rejected) */
  rejectDecision(threadId, reason, opts = {}) {
    return this.hub.reply(threadId, {
      author: this.au(opts.author),
      content: reason,
      metadata: { status: "rejected" }
    });
  }
  // ========== Requests & Blocking ==========
  /** Request help (post type=request with severity) */
  requestHelp(content, severity, opts = {}) {
    const meta = {
      severity,
      resolved: false,
      ...opts.metadata
    };
    if (opts.target)
      meta.target = opts.target;
    if (opts.requestType)
      meta.request_type = opts.requestType;
    return this.hub.post({
      channel: this.ch(opts.channel),
      type: "request",
      author: this.au(opts.author),
      content,
      tags: uniqueTags(["blocked"], opts.tags),
      metadata: meta
    });
  }
  /** Resolve a request (reply with resolved=true) */
  resolveRequest(threadId, resolution, opts = {}) {
    return this.hub.reply(threadId, {
      author: this.au(opts.author),
      content: resolution,
      metadata: { resolved: true }
    });
  }
  // ========== Status & Progress ==========
  /** Post progress update (status with step info) */
  postProgress(step, totalSteps, content, opts = {}) {
    const meta = {
      step,
      total_steps: totalSteps,
      ...opts.metadata
    };
    if (opts.filesChanged)
      meta.files_changed = opts.filesChanged;
    return this.hub.post({
      channel: this.ch(opts.channel),
      type: "status",
      author: this.au(opts.author),
      content,
      tags: uniqueTags(["progress"], opts.tags),
      metadata: meta
    });
  }
  /** Post a checkpoint (status tagged "checkpoint") */
  postCheckpoint(content, opts = {}) {
    const meta = { ...opts.metadata };
    if (opts.checkpointNumber)
      meta.checkpoint_number = opts.checkpointNumber;
    if (opts.filesChanged)
      meta.files_changed = opts.filesChanged;
    return this.hub.post({
      channel: this.ch(opts.channel),
      type: "status",
      author: this.au(opts.author),
      content,
      tags: uniqueTags(["checkpoint"], opts.tags),
      metadata: meta
    });
  }
  // ========== Trails ==========
  /** Log a trail entry (note tagged "trail" with marker) */
  logTrail(marker, summary, opts = {}) {
    const meta = { marker, ...opts.metadata };
    if (opts.evidence)
      meta.evidence = opts.evidence;
    const content = opts.details ? `${summary}

${opts.details}` : summary;
    return this.hub.post({
      channel: this.ch(opts.channel),
      type: "note",
      author: this.au(opts.author),
      content,
      tags: uniqueTags(["trail"], opts.tags),
      metadata: meta
    });
  }
  // ========== Queries ==========
  /** Get findings (notes tagged "finding") */
  getFindings(opts = {}) {
    return this.hub.read({
      channel: opts.channel ?? this.defaults.channel,
      type: "note",
      tags: uniqueTags(["finding"], opts.tags),
      since: opts.since,
      limit: opts.limit ?? 50
    }).messages;
  }
  /** Get unresolved requests */
  getUnresolved(opts = {}) {
    return this.hub.read({
      channel: opts.channel ?? this.defaults.channel,
      type: "request",
      unresolved: true,
      since: opts.since,
      limit: opts.limit ?? 50
    }).messages;
  }
  /** Get decisions, optionally filtered by status */
  getDecisions(status, opts = {}) {
    const messages = this.hub.read({
      channel: opts.channel ?? this.defaults.channel,
      type: "decision",
      since: opts.since,
      limit: opts.limit ?? 50
    }).messages;
    if (!status)
      return messages;
    return messages.filter((m) => m.metadata?.status === status);
  }
  /** Search messages across hub */
  search(query, opts = {}) {
    return this.hub.search(query, {
      channel: opts.channel ?? this.defaults.channel,
      tags: opts.tags,
      limit: opts.limit ?? 20,
      since: opts.since
    });
  }
  /** Get hub status overview */
  status() {
    return this.hub.status();
  }
};
function uniqueTags(base, extra) {
  if (!extra)
    return base;
  return [.../* @__PURE__ */ new Set([...base, ...extra])];
}

// dist/cli.js
function output(data, pretty) {
  console.log(JSON.stringify(data, null, pretty ? 2 : void 0));
}
function handleError(err) {
  const message = err instanceof Error ? err.message : String(err);
  console.log(JSON.stringify({ error: message }));
  process.exit(1);
}
function parseJson(str, field) {
  try {
    return JSON.parse(str);
  } catch {
    throw new Error(`Invalid JSON for ${field}: ${str}`);
  }
}
function parseTags(str) {
  return str.split(",").map((t) => t.trim()).filter(Boolean);
}
function runCli() {
  const program = new Command();
  program.name("hub").description("Agents Hub CLI - Distributed communication for AI agents").version("1.0.0").option("--db <path>", "Database path", ".devpartner/hub.db").option("--pretty", "Pretty-print JSON output", false);
  program.command("init").description("Initialize a new hub").option("--mode <mode>", "Hub mode: single or multi", "single").option("--hub-id <uuid>", "Hub ID (auto-generated if not provided)").action((opts) => {
    try {
      const dbPath = program.opts().db;
      const mode = opts.mode === "multi" ? "multi" : "single";
      const hub = Hub.init(dbPath, mode, opts.hubId);
      const status = hub.status();
      const channels = hub.channelList();
      hub.close();
      output({
        hub_id: status.hubId,
        mode: status.mode,
        db_path: dbPath,
        channels: channels.map((c) => c.name)
      }, program.opts().pretty);
    } catch (err) {
      handleError(err);
    }
  });
  const channel = program.command("channel").description("Channel management");
  channel.command("create").description("Create a new channel").argument("<name>", "Channel name (must start with #)").option("--description <text>", "Channel description").option("--worker-id <id>", "Worker ID").action((name, opts) => {
    try {
      const dbPath = program.opts().db;
      const hub = new Hub(dbPath);
      const result = hub.channelCreate(name, {
        description: opts.description,
        workerId: opts.workerId
      });
      hub.close();
      output(result, program.opts().pretty);
    } catch (err) {
      handleError(err);
    }
  });
  channel.command("list").description("List all channels").option("--include-stats", "Include message counts and last activity", false).action((opts) => {
    try {
      const dbPath = program.opts().db;
      const hub = new Hub(dbPath);
      const channels = hub.channelList(opts.includeStats);
      hub.close();
      output({ channels }, program.opts().pretty);
    } catch (err) {
      handleError(err);
    }
  });
  program.command("post").description("Post a new message to a channel").requiredOption("--channel <name>", "Channel name").requiredOption("--type <type>", "Message type: note, decision, request, status").requiredOption("--author <role>", "Author role").requiredOption("--content <text>", "Message content").option("--tags <json>", `Tags as JSON array (e.g., '["auth","security"]')`).option("--metadata <json>", "Metadata as JSON object").option("--worker-id <id>", "Worker ID").action((opts) => {
    try {
      const dbPath = program.opts().db;
      const hub = new Hub(dbPath);
      const postOpts = {
        channel: opts.channel,
        type: opts.type,
        author: opts.author,
        content: opts.content
      };
      if (opts.tags) {
        postOpts.tags = parseJson(opts.tags, "tags");
      }
      if (opts.metadata) {
        postOpts.metadata = parseJson(opts.metadata, "metadata");
      }
      if (opts.workerId) {
        postOpts.workerId = opts.workerId;
      }
      const message = hub.post(postOpts);
      hub.close();
      output({
        id: message.id,
        channel: message.channel,
        type: message.type,
        created_at: message.createdAt
      }, program.opts().pretty);
    } catch (err) {
      handleError(err);
    }
  });
  program.command("reply").description("Reply to an existing message").requiredOption("--thread <message-id>", "ID of the message to reply to").requiredOption("--author <role>", "Author role").requiredOption("--content <text>", "Reply content").option("--tags <json>", "Tags as JSON array").option("--metadata <json>", "Metadata as JSON object").option("--type <type>", "Message type (overrides parent type)").action((opts) => {
    try {
      const dbPath = program.opts().db;
      const hub = new Hub(dbPath);
      const replyOpts = {
        author: opts.author,
        content: opts.content
      };
      if (opts.tags) {
        replyOpts.tags = parseJson(opts.tags, "tags");
      }
      if (opts.metadata) {
        replyOpts.metadata = parseJson(opts.metadata, "metadata");
      }
      if (opts.type) {
        replyOpts.type = opts.type;
      }
      const message = hub.reply(opts.thread, replyOpts);
      hub.close();
      output({
        id: message.id,
        channel: message.channel,
        type: message.type,
        created_at: message.createdAt
      }, program.opts().pretty);
    } catch (err) {
      handleError(err);
    }
  });
  program.command("read").description("Read messages with optional filtering").option("--channel <name>", "Filter by channel").option("--type <type>", "Filter by message type").option("--author <role>", "Filter by author").option("--tags <t1,t2>", "Filter by tags (comma-separated)").option("--since <iso>", "Filter by timestamp (ISO 8601)").option("--until <iso>", "Filter by timestamp (ISO 8601)").option("--limit <n>", "Limit number of results", parseInt).option("--offset <n>", "Offset for pagination", parseInt).option("--thread <id>", "Filter by thread ID").option("--unresolved", "Show only unresolved requests", false).option("--worker-id <id>", "Filter by worker ID").action((opts) => {
    try {
      const dbPath = program.opts().db;
      const hub = new Hub(dbPath);
      const readOpts = {};
      if (opts.channel)
        readOpts.channel = opts.channel;
      if (opts.type)
        readOpts.type = opts.type;
      if (opts.author)
        readOpts.author = opts.author;
      if (opts.tags)
        readOpts.tags = parseTags(opts.tags);
      if (opts.since)
        readOpts.since = opts.since;
      if (opts.until)
        readOpts.until = opts.until;
      if (opts.limit)
        readOpts.limit = opts.limit;
      if (opts.offset)
        readOpts.offset = opts.offset;
      if (opts.thread)
        readOpts.threadId = opts.thread;
      if (opts.unresolved)
        readOpts.unresolved = true;
      if (opts.workerId)
        readOpts.workerId = opts.workerId;
      const result = hub.read(readOpts);
      hub.close();
      output({
        messages: result.messages,
        total: result.total,
        has_more: result.hasMore
      }, program.opts().pretty);
    } catch (err) {
      handleError(err);
    }
  });
  program.command("read-thread").description("Read all messages in a thread").argument("<message-id>", "ID of any message in the thread").action((messageId) => {
    try {
      const dbPath = program.opts().db;
      const hub = new Hub(dbPath);
      const messages = hub.readThread(messageId);
      hub.close();
      output({ messages }, program.opts().pretty);
    } catch (err) {
      handleError(err);
    }
  });
  program.command("search").description("Full-text search across messages").argument("<query>", "Search query (FTS5 syntax)").option("--channel <name>", "Filter by channel").option("--type <type>", "Filter by message type").option("--tags <t1,t2>", "Filter by tags (comma-separated)").option("--limit <n>", "Limit number of results", parseInt).option("--since <iso>", "Filter by timestamp (ISO 8601)").action((query, opts) => {
    try {
      const dbPath = program.opts().db;
      const hub = new Hub(dbPath);
      const searchOpts = {};
      if (opts.channel)
        searchOpts.channel = opts.channel;
      if (opts.type)
        searchOpts.type = opts.type;
      if (opts.tags)
        searchOpts.tags = parseTags(opts.tags);
      if (opts.limit)
        searchOpts.limit = opts.limit;
      if (opts.since)
        searchOpts.since = opts.since;
      const results = hub.search(query, searchOpts);
      hub.close();
      output({ results, total: results.length }, program.opts().pretty);
    } catch (err) {
      handleError(err);
    }
  });
  program.command("watch").description("Watch for new messages (NDJSON output)").option("--channel <name>", "Filter by channel").option("--type <type>", "Filter by message type").option("--timeout <seconds>", "Timeout in seconds (0 = forever)", parseInt).option("--count <n>", "Number of messages to wait for", parseInt).action(async (opts) => {
    try {
      const dbPath = program.opts().db;
      const hub = new Hub(dbPath);
      const watchOpts = {};
      if (opts.channel)
        watchOpts.channel = opts.channel;
      if (opts.type)
        watchOpts.type = opts.type;
      if (opts.timeout !== void 0)
        watchOpts.timeout = opts.timeout;
      if (opts.count)
        watchOpts.count = opts.count;
      const watcher = hub.watch(watchOpts);
      for await (const message of watcher) {
        console.log(JSON.stringify(message));
      }
      hub.close();
    } catch (err) {
      handleError(err);
    }
  });
  program.command("status").description("Get hub status overview").option("--channel <name>", "Get status for specific channel").action((opts) => {
    try {
      const dbPath = program.opts().db;
      const hub = new Hub(dbPath);
      const status = hub.status();
      hub.close();
      if (opts.channel) {
        const channelData = status.channels[opts.channel];
        if (!channelData) {
          throw new Error(`Channel not found: ${opts.channel}`);
        }
        output({
          hubId: status.hubId,
          mode: status.mode,
          channel: opts.channel,
          ...channelData
        }, program.opts().pretty);
      } else {
        output(status, program.opts().pretty);
      }
    } catch (err) {
      handleError(err);
    }
  });
  program.command("update").description("Update an existing message").argument("<message-id>", "Message ID to update").option("--content <text>", "New content").option("--metadata <json>", "Metadata as JSON object (merged)").option("--tags <json>", "Tags as JSON array").action((messageId, opts) => {
    try {
      const dbPath = program.opts().db;
      const hub = new Hub(dbPath);
      const updateOpts = {};
      if (opts.content)
        updateOpts.content = opts.content;
      if (opts.metadata) {
        updateOpts.metadata = parseJson(opts.metadata, "metadata");
      }
      if (opts.tags) {
        updateOpts.tags = parseJson(opts.tags, "tags");
      }
      const message = hub.update(messageId, updateOpts);
      hub.close();
      output(message, program.opts().pretty);
    } catch (err) {
      handleError(err);
    }
  });
  program.command("export").description("Export messages to NDJSON format").option("--channel <name>", "Export specific channel").option("--since <iso>", "Export messages since timestamp").option("--format <format>", "Export format: ndjson or csv", "ndjson").action((opts) => {
    try {
      const dbPath = program.opts().db;
      const hub = new Hub(dbPath);
      const exportOpts = {};
      if (opts.channel)
        exportOpts.channel = opts.channel;
      if (opts.since)
        exportOpts.since = opts.since;
      if (opts.format)
        exportOpts.format = opts.format;
      const ndjson = hub.export(exportOpts);
      hub.close();
      console.log(ndjson);
    } catch (err) {
      handleError(err);
    }
  });
  program.command("import").description("Import messages from NDJSON file").argument("<file>", "Path to NDJSON file").action((file) => {
    try {
      const dbPath = program.opts().db;
      const ndjson = readFileSync(file, "utf-8");
      const hub = new Hub(dbPath);
      const imported = hub.import(ndjson);
      hub.close();
      output({ imported }, program.opts().pretty);
    } catch (err) {
      handleError(err);
    }
  });
  program.command("gc").description("Garbage collect old messages").option("--older-than <duration>", "ISO timestamp (remove messages older than this)").option("--dry-run", "Count without deleting", false).action((opts) => {
    try {
      const dbPath = program.opts().db;
      const hub = new Hub(dbPath);
      const result = hub.gc(opts.olderThan, opts.dryRun);
      hub.close();
      output({ removed: result.removed }, program.opts().pretty);
    } catch (err) {
      handleError(err);
    }
  });
  program.command("stats").description("Get hub statistics").action(() => {
    try {
      const dbPath = program.opts().db;
      const hub = new Hub(dbPath);
      const stats = hub.stats();
      hub.close();
      output(stats, program.opts().pretty);
    } catch (err) {
      handleError(err);
    }
  });
  program.command("exec").description("Execute JavaScript code with Hub and SDK pre-loaded").argument("<code>", "JavaScript code to evaluate (hub and sdk are in scope)").option("--channel <name>", "Default channel for SDK operations").option("--author <role>", "Default author for SDK operations").action(async (code, opts) => {
    let hub;
    try {
      const dbPath = program.opts().db;
      hub = new Hub(dbPath);
      const sdk = new HubSDK(hub, {
        channel: opts.channel,
        author: opts.author
      });
      const fn = new Function("hub", "sdk", `return (async () => { ${code} })();`);
      const result = await fn(hub, sdk);
      if (result !== void 0) {
        output(result, program.opts().pretty);
      }
      hub.close();
    } catch (err) {
      hub?.close();
      handleError(err);
    }
  });
  program.parse();
}

// dist/skill-cli.js
runCli();
