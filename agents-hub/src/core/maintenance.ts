/**
 * Maintenance module - Status, stats, export/import, and garbage collection
 */

import type Database from 'better-sqlite3';
import { statSync } from 'node:fs';
import type { HubStatus, HubStats, Message, MessageType } from './types.js';
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
 * Parse duration string (e.g., "30d", "24h", "7d") into milliseconds
 */
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([dhm])$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}. Use format like "30d", "24h", "60m"`);
  }
  
  const value = parseInt(match[1], 10);
  const unit = match[2];
  
  switch (unit) {
    case 'd': return value * 24 * 60 * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'm': return value * 60 * 1000;
    default: throw new Error(`Unknown duration unit: ${unit}`);
  }
}

/**
 * Get hub status overview
 * 
 * Returns hub metadata, per-channel statistics, and recent activity.
 * 
 * @param db - Database instance
 * @returns HubStatus object with hub info, channel stats, and recent activity
 * 
 * @example
 * ```typescript
 * const status = getStatus(db);
 * console.log(`Hub ${status.hubId} has ${status.totalMessages} messages`);
 * console.log(`Unresolved requests: ${status.totalUnresolved}`);
 * ```
 */
export function getStatus(db: Database.Database): HubStatus {
  // Read hub metadata
  const metaRows = db.prepare('SELECT key, value FROM hub_meta').all() as Array<{ key: string; value: string }>;
  const meta = Object.fromEntries(metaRows.map(r => [r.key, r.value]));
  
  const hubId = meta.hub_id || 'unknown';
  const mode = (meta.mode === 'multi' ? 'multi' : 'single') as 'single' | 'multi';
  
  // Per-channel statistics
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
  `).all() as Array<{ channel: string; messages: number; unresolved: number }>;
  
  const channels: HubStatus['channels'] = {};
  let totalMessages = 0;
  let totalUnresolved = 0;
  
  for (const row of channelStatsRows) {
    channels[row.channel] = {
      messages: row.messages,
      unresolvedRequests: row.unresolved,
    };
    totalMessages += row.messages;
    totalUnresolved += row.unresolved;
  }
  
  // Recent activity
  const recentRows = db.prepare(`
    SELECT channel, type, created_at as timestamp
    FROM messages
    ORDER BY created_at DESC
    LIMIT 5
  `).all() as Array<{ channel: string; type: MessageType; timestamp: string }>;
  
  const recentActivity = recentRows.map(row => ({
    channel: row.channel,
    type: row.type,
    timestamp: row.timestamp,
  }));
  
  return {
    hubId,
    mode,
    channels,
    totalMessages,
    totalUnresolved,
    recentActivity,
  };
}

/**
 * Get detailed hub statistics
 * 
 * Returns database file sizes, message counts by type and channel, and FTS index health.
 * 
 * @param db - Database instance
 * @param dbPath - Path to the database file (for file size stats)
 * @returns HubStats object with detailed statistics
 * 
 * @example
 * ```typescript
 * const stats = getStats(db, './hub.db');
 * console.log(`DB size: ${stats.dbSizeBytes} bytes`);
 * console.log(`FTS indexed: ${stats.ftsStatus.indexed} messages`);
 * ```
 */
export function getStats(db: Database.Database, dbPath: string): HubStats {
  // Get file sizes
  let dbSizeBytes = 0;
  let walSizeBytes = 0;
  
  try {
    dbSizeBytes = statSync(dbPath).size;
  } catch {
    // File may not exist yet
  }
  
  try {
    walSizeBytes = statSync(`${dbPath}-wal`).size;
  } catch {
    // WAL file may not exist
  }
  
  // Messages by type
  const typeRows = db.prepare(`
    SELECT type, COUNT(*) as count
    FROM messages
    GROUP BY type
  `).all() as Array<{ type: MessageType; count: number }>;
  
  const messagesByType: Record<MessageType, number> = {
    note: 0,
    decision: 0,
    request: 0,
    status: 0,
  };
  
  for (const row of typeRows) {
    messagesByType[row.type] = row.count;
  }
  
  // Messages by channel
  const channelRows = db.prepare(`
    SELECT channel, COUNT(*) as count
    FROM messages
    GROUP BY channel
  `).all() as Array<{ channel: string; count: number }>;
  
  const messagesByChannel: Record<string, number> = {};
  for (const row of channelRows) {
    messagesByChannel[row.channel] = row.count;
  }
  
  // Total messages
  const totalRow = db.prepare('SELECT COUNT(*) as count FROM messages').get() as { count: number };
  const totalMessages = totalRow.count;
  
  // FTS health check
  const messagesCount = totalMessages;
  const ftsRow = db.prepare('SELECT COUNT(*) as count FROM messages_fts').get() as { count: number };
  const ftsCount = ftsRow.count;
  
  return {
    dbSizeBytes,
    walSizeBytes,
    messagesByType,
    messagesByChannel,
    totalMessages,
    ftsStatus: {
      indexed: ftsCount,
      unindexed: Math.max(0, messagesCount - ftsCount),
    },
  };
}

/**
 * Export messages to NDJSON format
 * 
 * Returns newline-delimited JSON (NDJSON) for all messages matching the filters.
 * Each line is a complete Message object.
 * 
 * @param db - Database instance
 * @param opts - Optional filters (channel, since timestamp)
 * @returns NDJSON string (one message per line)
 * 
 * @example
 * ```typescript
 * const ndjson = exportMessages(db, { channel: 'agents', since: '2024-01-01T00:00:00Z' });
 * fs.writeFileSync('export.ndjson', ndjson);
 * ```
 */
export function exportMessages(
  db: Database.Database,
  opts?: { channel?: string; since?: string }
): string {
  const whereClauses: string[] = [];
  const params: any[] = [];
  
  if (opts?.channel) {
    whereClauses.push('channel = ?');
    params.push(opts.channel);
  }
  
  if (opts?.since) {
    whereClauses.push('created_at >= ?');
    params.push(opts.since);
  }
  
  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  
  const sql = `
    SELECT * FROM messages
    ${whereClause}
    ORDER BY created_at ASC
  `;
  
  const rows = db.prepare(sql).all(...params);
  const messages = rows.map(rowToMessage);
  
  return messages.map(msg => JSON.stringify(msg)).join('\n');
}

/**
 * Import messages from NDJSON format
 * 
 * Parses NDJSON input and inserts each message into the database.
 * Uses INSERT OR IGNORE to handle duplicate IDs gracefully.
 * 
 * @param db - Database instance
 * @param ndjson - Newline-delimited JSON string
 * @returns Number of messages successfully imported
 * 
 * @example
 * ```typescript
 * const ndjson = fs.readFileSync('export.ndjson', 'utf-8');
 * const count = importMessages(db, ndjson);
 * console.log(`Imported ${count} messages`);
 * ```
 */
export function importMessages(db: Database.Database, ndjson: string): number {
  const lines = ndjson.split('\n').filter(line => line.trim().length > 0);
  let imported = 0;
  
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO messages (
      id, channel, type, author, content, tags, thread_id, metadata, created_at, updated_at, worker_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  for (const line of lines) {
    try {
      const msg = JSON.parse(line) as Message;
      
      // Convert camelCase to snake_case for DB
      const result = stmt.run(
        msg.id,
        msg.channel,
        msg.type,
        msg.author,
        msg.content,
        JSON.stringify(msg.tags),
        msg.threadId,
        JSON.stringify(msg.metadata),
        msg.createdAt,
        msg.updatedAt,
        msg.workerId
      );
      
      if (result.changes > 0) {
        imported++;
      }
    } catch {
      // Skip invalid lines
      continue;
    }
  }
  
  return imported;
}

/**
 * Garbage collect old messages
 * 
 * Deletes messages older than the specified duration.
 * Optionally runs VACUUM to reclaim disk space.
 * 
 * @param db - Database instance
 * @param olderThan - Duration string (e.g., "30d", "24h", "7d"). Default: "30d"
 * @param dryRun - If true, only count messages without deleting. Default: false
 * @returns Object with number of messages removed
 * 
 * @example
 * ```typescript
 * // Preview: see how many would be deleted
 * const preview = garbageCollect(db, "30d", true);
 * console.log(`Would delete ${preview.removed} messages`);
 * 
 * // Actually delete and vacuum
 * const result = garbageCollect(db, "30d");
 * console.log(`Deleted ${result.removed} messages`);
 * ```
 */
export function garbageCollect(
  db: Database.Database,
  olderThan = '30d',
  dryRun = false
): { removed: number } {
  // Calculate threshold timestamp
  const durationMs = parseDuration(olderThan);
  const threshold = new Date(Date.now() - durationMs).toISOString();
  
  if (dryRun) {
    // Just count
    const countRow = db.prepare('SELECT COUNT(*) as count FROM messages WHERE created_at < ?').get(threshold) as { count: number };
    return { removed: countRow.count };
  }
  
  // Delete old messages
  const result = db.prepare('DELETE FROM messages WHERE created_at < ?').run(threshold);
  const removed = result.changes;
  
  // Run VACUUM to reclaim space
  if (removed > 0) {
    db.exec('VACUUM');
  }
  
  return { removed };
}




