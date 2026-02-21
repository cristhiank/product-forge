/**
 * Database schema initialization for the Agents Hub
 */

import type Database from 'better-sqlite3';

/**
 * Initializes the database schema with all required tables, indexes, and triggers.
 * This function is idempotent - safe to call multiple times.
 * 
 * Creates:
 * - messages table with metadata and threading support
 * - channels table for channel management
 * - hub_meta table for schema versioning and metadata
 * - FTS5 virtual table for full-text search
 * - Triggers to keep FTS index synchronized
 * - Indexes for efficient querying
 * 
 * @param db - Database instance (from openDatabase)
 */
export function initSchema(db: Database.Database): void {
  // Messages table - core message storage
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

  // Channels table - channel metadata
  db.exec(`
    CREATE TABLE IF NOT EXISTS channels (
      name TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      description TEXT,
      worker_id TEXT
    )
  `);

  // Hub metadata table - schema versioning and hub configuration
  db.exec(`
    CREATE TABLE IF NOT EXISTS hub_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // Create indexes for efficient querying
  db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(type)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_worker ON messages(worker_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_channel_type ON messages(channel, type)`);

  // FTS5 virtual table for full-text search
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

  // Trigger: Sync FTS on INSERT
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS messages_fts_insert
    AFTER INSERT ON messages
    BEGIN
      INSERT INTO messages_fts(rowid, content, tags, metadata)
      VALUES (new.rowid, new.content, new.tags, new.metadata);
    END
  `);

  // Trigger: Sync FTS on DELETE (external content tables require 'delete' command)
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS messages_fts_delete
    AFTER DELETE ON messages
    BEGIN
      INSERT INTO messages_fts(messages_fts, rowid, content, tags, metadata)
      VALUES ('delete', old.rowid, old.content, old.tags, old.metadata);
    END
  `);

  // Trigger: Sync FTS on UPDATE (delete old + insert new for external content)
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
