/**
 * SQLite database connection factory with WAL mode configuration
 */

import Database from 'better-sqlite3';

/**
 * Opens a SQLite database with optimized settings for concurrent access
 * 
 * Configuration:
 * - WAL mode for better concurrency
 * - 5 second busy timeout
 * - NORMAL synchronous mode (balanced safety/performance)
 * - Foreign keys enabled
 * - 64MB cache size
 * - Auto-checkpoint every 1000 pages
 * 
 * @param dbPath - Path to the SQLite database file
 * @returns Configured Database instance
 */
export function openDatabase(dbPath: string): Database.Database {
  const db = new Database(dbPath);

  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');

  // Set busy timeout to 5 seconds
  db.pragma('busy_timeout = 5000');

  // Use NORMAL synchronous mode (balanced safety/performance)
  db.pragma('synchronous = NORMAL');

  // Enable foreign key constraints
  db.pragma('foreign_keys = ON');

  // Set cache size to 64MB (negative value = KB)
  db.pragma('cache_size = -64000');

  // Auto-checkpoint every 1000 pages
  db.pragma('wal_autocheckpoint = 1000');

  return db;
}
