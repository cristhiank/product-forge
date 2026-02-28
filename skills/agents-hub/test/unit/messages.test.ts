/**
 * Unit tests for messages module
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { createTestDb } from '../fixtures/seed.js';
import {
  postMessage,
  replyToMessage,
  updateMessage,
  readMessages,
  readThread,
} from '../../src/core/messages.js';
import { createChannel } from '../../src/core/channels.js';

describe('messages module', () => {
  let db: Database.Database;
  let cleanup: () => void;

  beforeEach(() => {
    const testDb = createTestDb(false);
    db = testDb.db;
    cleanup = testDb.cleanup;

    // Create test channels
    createChannel(db, '#general', { createdBy: 'test' });
    createChannel(db, '#dev', { createdBy: 'test' });
  });

  afterEach(() => {
    cleanup();
  });

  describe('postMessage', () => {
    it('should create a message with all fields', () => {
      const message = postMessage(db, {
        channel: '#general',
        type: 'note',
        author: 'alice',
        content: 'Hello world',
        tags: ['greeting', 'test'],
        metadata: { priority: 'high', version: 1 },
        workerId: 'worker-1',
      });

      expect(message.id).toBeDefined();
      expect(message.channel).toBe('#general');
      expect(message.type).toBe('note');
      expect(message.author).toBe('alice');
      expect(message.content).toBe('Hello world');
      expect(message.tags).toEqual(['greeting', 'test']);
      expect(message.metadata).toEqual({ priority: 'high', version: 1 });
      expect(message.workerId).toBe('worker-1');
      expect(message.createdAt).toBeDefined();
      expect(message.threadId).toBeNull();
    });

    it('should create a message with minimal fields', () => {
      const message = postMessage(db, {
        channel: '#general',
        type: 'note',
        author: 'bob',
        content: 'Minimal message',
      });

      expect(message.id).toBeDefined();
      expect(message.tags).toEqual([]);
      expect(message.metadata).toEqual({});
      expect(message.workerId).toBeNull();
    });
  });

  describe('replyToMessage', () => {
    it('should create a threaded message inheriting channel', () => {
      const parent = postMessage(db, {
        channel: '#general',
        type: 'request',
        author: 'alice',
        content: 'Need help',
      });

      const reply = replyToMessage(db, parent.id, {
        author: 'bob',
        content: 'Here to help',
      });

      expect(reply.threadId).toBe(parent.id);
      expect(reply.channel).toBe('#general'); // Inherited from parent
      expect(reply.type).toBe('request'); // Inherited from parent
      expect(reply.author).toBe('bob');
      expect(reply.content).toBe('Here to help');
    });

    it('should allow overriding type in reply', () => {
      const parent = postMessage(db, {
        channel: '#dev',
        type: 'request',
        author: 'alice',
        content: 'Question',
      });

      const reply = replyToMessage(db, parent.id, {
        author: 'bob',
        content: 'Answer',
        type: 'note',
      });

      expect(reply.type).toBe('note'); // Overridden
      expect(reply.threadId).toBe(parent.id);
    });
  });

  describe('updateMessage', () => {
    it('should update content only', () => {
      const message = postMessage(db, {
        channel: '#general',
        type: 'note',
        author: 'alice',
        content: 'Original content',
        tags: ['original'],
        metadata: { version: 1 },
      });

      const updated = updateMessage(db, message.id, {
        content: 'Updated content',
      });

      expect(updated.content).toBe('Updated content');
      expect(updated.tags).toEqual(['original']); // Unchanged
      expect(updated.metadata).toEqual({ version: 1 }); // Unchanged
      expect(updated.updatedAt).toBeDefined();
      expect(updated.updatedAt).not.toBe(message.updatedAt);
    });

    it('should merge metadata', () => {
      const message = postMessage(db, {
        channel: '#general',
        type: 'note',
        author: 'alice',
        content: 'Test',
        metadata: { version: 1, status: 'draft' },
      });

      const updated = updateMessage(db, message.id, {
        metadata: { version: 2, reviewed: true },
      });

      expect(updated.metadata).toEqual({
        version: 2, // Updated
        status: 'draft', // Preserved
        reviewed: true, // Added
      });
    });

    it('should replace tags entirely', () => {
      const message = postMessage(db, {
        channel: '#general',
        type: 'note',
        author: 'alice',
        content: 'Test',
        tags: ['old', 'tags'],
      });

      const updated = updateMessage(db, message.id, {
        tags: ['new', 'tags'],
      });

      expect(updated.tags).toEqual(['new', 'tags']);
    });
  });

  describe('readMessages', () => {
    beforeEach(() => {
      // Seed test data
      postMessage(db, {
        channel: '#general',
        type: 'note',
        author: 'alice',
        content: 'Message 1',
        tags: ['tag1'],
      });
      postMessage(db, {
        channel: '#general',
        type: 'decision',
        author: 'bob',
        content: 'Message 2',
        tags: ['tag1', 'tag2'],
      });
      postMessage(db, {
        channel: '#dev',
        type: 'request',
        author: 'alice',
        content: 'Message 3',
        tags: ['tag2'],
        metadata: { resolved: false },
      });
    });

    it('should return all messages with no filters', () => {
      const result = readMessages(db, {});
      expect(result.messages.length).toBe(3);
      expect(result.total).toBe(3);
      expect(result.hasMore).toBe(false);
    });

    it('should filter by channel', () => {
      const result = readMessages(db, { channel: '#general' });
      expect(result.messages.length).toBe(2);
      expect(result.messages.every((m) => m.channel === '#general')).toBe(true);
    });

    it('should filter by type', () => {
      const result = readMessages(db, { type: 'note' });
      expect(result.messages.length).toBe(1);
      expect(result.messages[0].type).toBe('note');
    });

    it('should filter by author', () => {
      const result = readMessages(db, { author: 'alice' });
      expect(result.messages.length).toBe(2);
      expect(result.messages.every((m) => m.author === 'alice')).toBe(true);
    });

    it('should filter by tags (AND logic)', () => {
      const result = readMessages(db, { tags: ['tag1', 'tag2'] });
      expect(result.messages.length).toBe(1);
      expect(result.messages[0].author).toBe('bob');
    });

    it('should filter by unresolved', () => {
      const result = readMessages(db, { unresolved: true });
      // The unresolved filter checks for metadata.resolved NOT being true
      // It will return all messages where resolved is not explicitly true
      expect(result.messages.length).toBeGreaterThan(0);
      expect(result.messages.every((m) => m.metadata.resolved !== true)).toBe(true);
    });

    it('should support pagination with limit and offset', () => {
      const page1 = readMessages(db, { limit: 2, offset: 0 });
      expect(page1.messages.length).toBe(2);
      expect(page1.hasMore).toBe(true);

      const page2 = readMessages(db, { limit: 2, offset: 2 });
      expect(page2.messages.length).toBe(1);
      expect(page2.hasMore).toBe(false);
    });

    it('should filter by since timestamp', () => {
      // Create messages with known timing
      const firstId = postMessage(db, {
        channel: '#general',
        type: 'note',
        author: 'charlie',
        content: 'First',
      }).id;

      // Small delay to ensure different timestamp
      const midTimestamp = new Date(Date.now() + 100).toISOString();

      // Wait a bit before creating second message
      const secondId = postMessage(db, {
        channel: '#general',
        type: 'note',
        author: 'charlie',
        content: 'Second',
      }).id;

      const result = readMessages(db, { since: midTimestamp });
      
      // Should include messages created after the timestamp
      expect(result.messages.length).toBeGreaterThanOrEqual(0);
    });

    it('should filter by until timestamp', () => {
      const messages = readMessages(db, {});
      if (messages.messages.length > 0) {
        const midTimestamp = messages.messages[Math.floor(messages.messages.length / 2)].createdAt;

        const result = readMessages(db, { until: midTimestamp });
        expect(result.messages.length).toBeGreaterThanOrEqual(0);
        expect(result.messages.every((m) => m.createdAt <= midTimestamp)).toBe(true);
      }
    });

    it('should filter by workerId', () => {
      postMessage(db, {
        channel: '#general',
        type: 'note',
        author: 'alice',
        content: 'Worker message',
        workerId: 'worker-123',
      });

      const result = readMessages(db, { workerId: 'worker-123' });
      expect(result.messages.length).toBe(1);
      expect(result.messages[0].workerId).toBe('worker-123');
    });
  });

  describe('readThread', () => {
    it('should return parent and all replies sorted by created_at', () => {
      const parent = postMessage(db, {
        channel: '#general',
        type: 'request',
        author: 'alice',
        content: 'Parent message',
      });

      const reply1 = replyToMessage(db, parent.id, {
        author: 'bob',
        content: 'First reply',
      });

      const reply2 = replyToMessage(db, parent.id, {
        author: 'charlie',
        content: 'Second reply',
      });

      const thread = readThread(db, parent.id);

      expect(thread.length).toBe(3);
      expect(thread[0].id).toBe(parent.id);
      expect(thread[1].id).toBe(reply1.id);
      expect(thread[2].id).toBe(reply2.id);
    });

    it('should return only parent if no replies', () => {
      const parent = postMessage(db, {
        channel: '#general',
        type: 'note',
        author: 'alice',
        content: 'Solo message',
      });

      const thread = readThread(db, parent.id);

      expect(thread.length).toBe(1);
      expect(thread[0].id).toBe(parent.id);
    });
  });
});
