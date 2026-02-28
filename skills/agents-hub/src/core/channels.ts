/**
 * Channels module - Channel management and validation
 */

import type Database from 'better-sqlite3';
import type { Channel, ChannelInfo } from './types.js';
import { now } from '../utils/time.js';

/**
 * Validate channel name format
 * Must start with # and contain only lowercase letters, numbers, and hyphens
 */
function validateChannelName(name: string): void {
  if (!/^#[a-z0-9-]+$/.test(name)) {
    throw new Error(
      `Invalid channel name: ${name}. Must start with # and contain only lowercase letters, numbers, and hyphens.`
    );
  }
}

/**
 * Create a new channel
 */
export function createChannel(
  db: Database.Database,
  name: string,
  opts: {
    createdBy: string;
    description?: string;
    workerId?: string;
  }
): Channel {
  validateChannelName(name);

  const createdAt = now();

  const stmt = db.prepare(`
    INSERT INTO channels (name, created_at, created_by, description, worker_id)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(
    name,
    createdAt,
    opts.createdBy,
    opts.description || null,
    opts.workerId || null
  );

  const row = db.prepare('SELECT * FROM channels WHERE name = ?').get(name) as any;

  return {
    name: row.name,
    createdAt: row.created_at,
    createdBy: row.created_by,
    description: row.description,
    workerId: row.worker_id,
  };
}

/**
 * List all channels, optionally with statistics
 */
export function listChannels(
  db: Database.Database,
  includeStats = false
): Channel[] | ChannelInfo[] {
  if (!includeStats) {
    const rows = db.prepare('SELECT * FROM channels ORDER BY created_at DESC').all();
    return rows.map((row: any) => ({
      name: row.name,
      createdAt: row.created_at,
      createdBy: row.created_by,
      description: row.description,
      workerId: row.worker_id,
    }));
  }

  // Include statistics: message count and last activity
  const rows = db
    .prepare(
      `
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
  `
    )
    .all();

  return rows.map((row: any) => ({
    name: row.name,
    createdAt: row.created_at,
    createdBy: row.created_by,
    description: row.description,
    workerId: row.worker_id,
    messageCount: row.message_count,
    lastActivity: row.last_activity,
  }));
}

/**
 * Ensure a channel exists (create if it doesn't exist)
 * Uses INSERT OR IGNORE for safe concurrent implicit creation
 */
export function ensureChannel(
  db: Database.Database,
  name: string,
  createdBy: string
): Channel {
  validateChannelName(name);

  const createdAt = now();

  // INSERT OR IGNORE: safe for concurrent calls
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO channels (name, created_at, created_by)
    VALUES (?, ?, ?)
  `);

  stmt.run(name, createdAt, createdBy);

  // Return the channel (whether just created or already existing)
  const row = db.prepare('SELECT * FROM channels WHERE name = ?').get(name) as any;

  return {
    name: row.name,
    createdAt: row.created_at,
    createdBy: row.created_by,
    description: row.description,
    workerId: row.worker_id,
  };
}
