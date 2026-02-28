/**
 * Test fixtures and utilities for agents-hub tests
 */

import Database from 'better-sqlite3';
import { openDatabase } from '../../src/db/connection.js';
import { initSchema } from '../../src/db/schema.js';
import { postMessage } from '../../src/core/messages.js';
import { createChannel } from '../../src/core/channels.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtempSync, rmSync } from 'fs';
import type { PostOptions } from '../../src/core/types.js';

/**
 * Create a test database (in-memory or file-based)
 * @param useFile - If true, creates a temp file DB (needed for watch, stats). Otherwise in-memory.
 * @returns Object with db, dbPath, and cleanup function
 */
export function createTestDb(useFile = false): {
  db: Database.Database;
  dbPath: string;
  cleanup: () => void;
} {
  if (useFile) {
    const dir = mkdtempSync(join(tmpdir(), 'hub-test-'));
    const dbPath = join(dir, 'test.db');
    const db = openDatabase(dbPath);
    initSchema(db);
    return {
      db,
      dbPath,
      cleanup: () => {
        db.close();
        rmSync(dir, { recursive: true, force: true });
      },
    };
  }

  const db = openDatabase(':memory:');
  initSchema(db);
  return {
    db,
    dbPath: ':memory:',
    cleanup: () => db.close(),
  };
}

/**
 * Seed test messages across multiple channels and types
 * @param db - Database instance
 * @param count - Number of messages to create (default: 10)
 * @returns Array of created messages
 */
export function seedMessages(
  db: Database.Database,
  count = 10
): Array<{ id: string; channel: string; type: string }> {
  const channels = ['#general', '#dev', '#alerts'];
  const types: Array<'note' | 'decision' | 'request' | 'status'> = [
    'note',
    'decision',
    'request',
    'status',
  ];
  const authors = ['alice', 'bob', 'charlie'];
  const tags = ['urgent', 'bug', 'feature', 'docs', 'performance'];

  // Create channels first
  for (const channel of channels) {
    createChannel(db, channel, { createdBy: 'test' });
  }

  const messages: Array<{ id: string; channel: string; type: string }> = [];

  for (let i = 0; i < count; i++) {
    const channel = channels[i % channels.length];
    const type = types[i % types.length];
    const author = authors[i % authors.length];
    const messageTags = [tags[i % tags.length]];

    const opts: PostOptions = {
      channel,
      type,
      author,
      content: `Test message ${i + 1}: This is a test message with content`,
      tags: messageTags,
      metadata: { index: i, testData: true },
    };

    const msg = postMessage(db, opts);
    messages.push({ id: msg.id, channel: msg.channel, type: msg.type });
  }

  return messages;
}

/**
 * Create a message with specific content for search testing
 * @param db - Database instance
 * @param content - Message content
 * @param opts - Optional message options
 * @returns Created message
 */
export function createTestMessage(
  db: Database.Database,
  content: string,
  opts: Partial<PostOptions> = {}
): { id: string; content: string } {
  // Ensure channel exists
  const channel = opts.channel || '#general';
  try {
    createChannel(db, channel, { createdBy: 'test' });
  } catch {
    // Channel may already exist
  }

  const message = postMessage(db, {
    channel,
    type: opts.type || 'note',
    author: opts.author || 'test',
    content,
    tags: opts.tags,
    metadata: opts.metadata,
  });

  return { id: message.id, content: message.content };
}
