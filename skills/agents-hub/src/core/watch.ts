/**
 * Watch module - Real-time message streaming with file watching and polling fallback
 */

import type Database from 'better-sqlite3';
import { watch as fsWatch } from 'node:fs';
import type { Message, WatchOptions } from './types.js';
import { safeJsonParse } from '../utils/json.js';

/**
 * Promise-based setTimeout helper
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
 * Watch for new messages in real-time
 * 
 * Yields messages as they arrive in the database. Uses fs.watch on the DB file
 * with a polling fallback. Supports filtering by channel and type.
 * 
 * @param db - Database instance
 * @param dbPath - Path to the database file (for fs.watch)
 * @param opts - Watch options (channel, type, timeout, count)
 * @returns AsyncGenerator yielding messages as they arrive
 * 
 * @example
 * ```typescript
 * for await (const msg of watchMessages(db, './hub.db', { channel: 'agents', timeout: 60 })) {
 *   console.log('New message:', msg.content);
 * }
 * ```
 */
export async function* watchMessages(
  db: Database.Database,
  dbPath: string,
  opts: WatchOptions = {}
): AsyncGenerator<Message, void, unknown> {
  const timeout = opts.timeout ?? 300; // Default 300 seconds
  const maxCount = opts.count;
  const deadline = timeout === 0 ? Infinity : Date.now() + timeout * 1000;
  
  let yieldedCount = 0;
  let lastRowid = 0;
  
  // Get initial max rowid
  const whereClauses: string[] = [];
  const params: any[] = [];
  
  if (opts.channel) {
    whereClauses.push('channel = ?');
    params.push(opts.channel);
  }
  
  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const maxRowStmt = db.prepare(`SELECT MAX(rowid) as max_rowid FROM messages ${whereClause}`);
  const maxRow = maxRowStmt.get(...params) as { max_rowid: number | null };
  lastRowid = maxRow.max_rowid || 0;
  
  // Helper to query for new messages
  const queryNewMessages = (): Message[] => {
    const queryWhere: string[] = ['rowid > ?'];
    const queryParams: any[] = [lastRowid];
    
    if (opts.channel) {
      queryWhere.push('channel = ?');
      queryParams.push(opts.channel);
    }
    
    if (opts.type) {
      queryWhere.push('type = ?');
      queryParams.push(opts.type);
    }
    
    const sql = `
      SELECT * FROM messages
      WHERE ${queryWhere.join(' AND ')}
      ORDER BY created_at ASC
    `;
    
    const rows = db.prepare(sql).all(...queryParams);
    return rows.map(rowToMessage);
  };
  
  // Try fs.watch first, fall back to polling
  let watcher: ReturnType<typeof fsWatch> | null = null;
  let usePolling = false;
  
  try {
    watcher = fsWatch(dbPath, { persistent: false });
    
    // Main event loop
    while (Date.now() < deadline) {
      // Check for new messages
      const newMessages = queryNewMessages();
      
      for (const msg of newMessages) {
        yield msg;
        yieldedCount++;
        
        // Update lastRowid from the actual database
        const rowidStmt = db.prepare('SELECT rowid FROM messages WHERE id = ?');
        const rowidRow = rowidStmt.get(msg.id) as { rowid: number } | undefined;
        if (rowidRow && rowidRow.rowid > lastRowid) {
          lastRowid = rowidRow.rowid;
        }
        
        // Check if we've reached the count limit
        if (maxCount !== undefined && yieldedCount >= maxCount) {
          return;
        }
      }
      
      // Wait for next change event or timeout
      if (!usePolling && watcher) {
        const timeRemaining = deadline - Date.now();
        if (timeRemaining <= 0) break;
        
        // Wait for fs.watch event with timeout
        await new Promise<void>((resolve) => {
          const timer = global.setTimeout(() => {
            resolve();
          }, Math.min(timeRemaining, 2000));
          
          watcher!.once('change', () => {
            global.clearTimeout(timer);
            resolve();
          });
          
          watcher!.once('error', () => {
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
        // Polling fallback
        const timeRemaining = deadline - Date.now();
        if (timeRemaining <= 0) break;
        
        await delay(Math.min(2000, timeRemaining));
      }
    }
  } catch (error) {
    // If fs.watch fails, fall back to polling
    usePolling = true;
    
    while (Date.now() < deadline) {
      const newMessages = queryNewMessages();
      
      for (const msg of newMessages) {
        yield msg;
        yieldedCount++;
        
        const rowidStmt = db.prepare('SELECT rowid FROM messages WHERE id = ?');
        const rowidRow = rowidStmt.get(msg.id) as { rowid: number } | undefined;
        if (rowidRow && rowidRow.rowid > lastRowid) {
          lastRowid = rowidRow.rowid;
        }
        
        if (maxCount !== undefined && yieldedCount >= maxCount) {
          return;
        }
      }
      
      const timeRemaining = deadline - Date.now();
      if (timeRemaining <= 0) break;
      
      await delay(Math.min(2000, timeRemaining));
    }
  } finally {
    // Clean up watcher
    if (watcher) {
      watcher.close();
    }
  }
}
