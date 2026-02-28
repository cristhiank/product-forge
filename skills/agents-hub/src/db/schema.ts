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

  // Workers table - track worker processes (Copilot CLI sessions in worktrees)
  db.exec(`
    CREATE TABLE IF NOT EXISTS workers (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      channel TEXT NOT NULL,
      agent_type TEXT,
      agent_name TEXT,
      worktree_path TEXT,
      events_path TEXT,
      pid INTEGER,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','failed','lost')),
      exit_code INTEGER,
      last_event_at TEXT,
      last_event_type TEXT,
      events_offset INTEGER DEFAULT 0,
      tool_calls INTEGER DEFAULT 0,
      turns INTEGER DEFAULT 0,
      errors INTEGER DEFAULT 0,
      registered_at TEXT NOT NULL,
      completed_at TEXT,
      metadata TEXT DEFAULT '{}'
    )
  `);

  // Operator actions table - audit retries/stops and their outcomes
  db.exec(`
    CREATE TABLE IF NOT EXISTS operator_actions (
      id TEXT PRIMARY KEY,
      worker_id TEXT NOT NULL,
      action_type TEXT NOT NULL CHECK(action_type IN ('retry_sync','stop_worker')),
      status TEXT NOT NULL CHECK(status IN ('succeeded','failed')),
      requested_at TEXT NOT NULL,
      completed_at TEXT NOT NULL,
      error TEXT,
      metadata TEXT DEFAULT '{}'
    )
  `);

  // Create indexes for efficient querying
  db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(type)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_worker ON messages(worker_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_channel_type ON messages(channel, type)`);

  // Worker indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_workers_status ON workers(status)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_workers_session ON workers(session_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_operator_actions_worker ON operator_actions(worker_id, completed_at DESC)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_operator_actions_type_status ON operator_actions(action_type, status)`);

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
