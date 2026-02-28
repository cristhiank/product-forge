/**
 * Messages module - CRUD operations for messages
 */

import type Database from 'better-sqlite3';
import type {
  Message,
  PostOptions,
  ReplyOptions,
  UpdateOptions,
  ReadOptions,
} from './types.js';
import { generateId } from '../utils/ids.js';
import { now } from '../utils/time.js';
import { safeJsonParse } from '../utils/json.js';

/**
 * Convert database row to Message object
 */
function rowToMessage(row: any): Message {
  return {
    id: row.id,
    channel: row.channel,
    type: row.type,
    author: row.author,
    content: row.content,
    tags: safeJsonParse<string[]>(row.tags) || [],
    threadId: row.thread_id,
    metadata: safeJsonParse<Record<string, unknown>>(row.metadata) || {},
    workerId: row.worker_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Post a new message to a channel
 */
export function postMessage(db: Database.Database, opts: PostOptions): Message {
  const id = generateId();
  const createdAt = now();
  const tags = JSON.stringify(opts.tags || []);
  const metadata = JSON.stringify(opts.metadata || {});

  const stmt = db.prepare(`
    INSERT INTO messages (id, channel, type, author, content, tags, metadata, created_at, worker_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    opts.channel,
    opts.type,
    opts.author,
    opts.content,
    tags,
    metadata,
    createdAt,
    opts.workerId || null
  );

  const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
  return rowToMessage(row);
}

/**
 * Reply to an existing message (creates a threaded message)
 */
export function replyToMessage(
  db: Database.Database,
  threadId: string,
  opts: ReplyOptions
): Message {
  // Look up parent message to get channel and default type
  const parent = db.prepare('SELECT channel, type FROM messages WHERE id = ?').get(threadId) as
    | { channel: string; type: string }
    | undefined;

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

  stmt.run(
    id,
    parent.channel,
    type,
    opts.author,
    opts.content,
    tags,
    threadId,
    metadata,
    createdAt
  );

  const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
  return rowToMessage(row);
}

/**
 * Update an existing message (metadata is merged, not replaced)
 */
export function updateMessage(
  db: Database.Database,
  id: string,
  opts: UpdateOptions
): Message {
  const existing = db.prepare('SELECT metadata FROM messages WHERE id = ?').get(id) as
    | { metadata: string }
    | undefined;

  if (!existing) {
    throw new Error(`Message ${id} not found`);
  }

  const updatedAt = now();
  const parts: string[] = [];
  const params: any[] = [];

  if (opts.content !== undefined) {
    parts.push('content = ?');
    params.push(opts.content);
  }

  if (opts.tags !== undefined) {
    parts.push('tags = ?');
    params.push(JSON.stringify(opts.tags));
  }

  if (opts.metadata !== undefined) {
    // Merge metadata: read existing, assign new, stringify
    const existingMeta = safeJsonParse<Record<string, unknown>>(existing.metadata) || {};
    const mergedMeta = { ...existingMeta, ...opts.metadata };
    parts.push('metadata = ?');
    params.push(JSON.stringify(mergedMeta));
  }

  parts.push('updated_at = ?');
  params.push(updatedAt);
  params.push(id);

  const sql = `UPDATE messages SET ${parts.join(', ')} WHERE id = ?`;
  db.prepare(sql).run(...params);

  const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
  return rowToMessage(row);
}

/**
 * Read messages with optional filters
 */
export function readMessages(
  db: Database.Database,
  opts: ReadOptions = {}
): { messages: Message[]; total: number; hasMore: boolean } {
  const whereClauses: string[] = [];
  const params: any[] = [];

  if (opts.channel) {
    whereClauses.push('channel = ?');
    params.push(opts.channel);
  }

  if (opts.type) {
    whereClauses.push('type = ?');
    params.push(opts.type);
  }

  if (opts.author) {
    whereClauses.push('author = ?');
    params.push(opts.author);
  }

  if (opts.workerId) {
    whereClauses.push('worker_id = ?');
    params.push(opts.workerId);
  }

  if (opts.threadId !== undefined) {
    if (opts.threadId === null) {
      whereClauses.push('thread_id IS NULL');
    } else {
      whereClauses.push('thread_id = ?');
      params.push(opts.threadId);
    }
  }

  if (opts.since) {
    whereClauses.push('created_at >= ?');
    params.push(opts.since);
  }

  if (opts.until) {
    whereClauses.push('created_at <= ?');
    params.push(opts.until);
  }

  // Tags filter: ALL requested tags must exist (AND logic)
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

  // Unresolved filter: metadata.resolved is not true
  if (opts.unresolved === true) {
    whereClauses.push(`json_extract(metadata, '$.resolved') IS NOT true`);
  }

  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // Get total count (without limit/offset)
  const countSql = `SELECT COUNT(*) as count FROM messages ${whereClause}`;
  const { count: total } = db.prepare(countSql).get(...params) as { count: number };

  // Get messages with limit/offset
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

/**
 * Read a message thread (parent + all replies)
 */
export function readThread(db: Database.Database, messageId: string): Message[] {
  // Get parent message
  const parent = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);

  if (!parent) {
    throw new Error(`Message ${messageId} not found`);
  }

  // Get all replies (messages where thread_id = messageId)
  const replies = db
    .prepare('SELECT * FROM messages WHERE thread_id = ? ORDER BY created_at ASC')
    .all(messageId);

  return [parent, ...replies].map(rowToMessage);
}
