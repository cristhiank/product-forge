/**
 * Search module - FTS5 full-text search for messages
 */

import type Database from 'better-sqlite3';
import type { SearchOptions, SearchResult } from './types.js';
import { safeJsonParse } from '../utils/json.js';

/**
 * Search messages using FTS5 with BM25 ranking
 * 
 * Supports:
 * - Simple terms: "authentication"
 * - Exact phrases: "magic link"
 * - OR operator: "jwt OR token"
 * - NOT operator: "auth NOT password"
 * - Prefix matching: "authent*"
 * 
 * @param db - Database instance
 * @param query - FTS5 query string
 * @param opts - Optional filters (channel, type, tags, since, limit)
 * @returns Array of SearchResult with rank and highlighted content
 */
export function searchMessages(
  db: Database.Database,
  query: string,
  opts: SearchOptions = {}
): SearchResult[] {
  const whereClauses: string[] = ['messages_fts MATCH ?'];
  const params: any[] = [query];

  // Post-filters applied after FTS match
  if (opts.channel) {
    whereClauses.push('m.channel = ?');
    params.push(opts.channel);
  }

  if (opts.type) {
    whereClauses.push('m.type = ?');
    params.push(opts.type);
  }

  if (opts.since) {
    whereClauses.push('m.created_at >= ?');
    params.push(opts.since);
  }

  // Tags filter: ALL requested tags must exist (AND logic)
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

  const whereClause = whereClauses.join(' AND ');
  const limit = opts.limit || 50;

  // Join FTS table with messages table using rowid
  // Use bm25() for ranking (lower = better match)
  // Use highlight() for highlighting matched terms
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

  return rows.map((row: any) => ({
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
    rank: row.rank,
    highlightedContent: row.highlighted_content,
  }));
}
