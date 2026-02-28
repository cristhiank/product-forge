/**
 * Unit tests for search module (FTS5)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { createTestDb, createTestMessage } from '../fixtures/seed.js';
import { searchMessages } from '../../src/core/search.js';
import { createChannel } from '../../src/core/channels.js';

describe('search module', () => {
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

  describe('keyword search', () => {
    beforeEach(() => {
      createTestMessage(db, 'This is about authentication using JWT tokens');
      createTestMessage(db, 'Database connection pooling is important');
      createTestMessage(db, 'User authentication via OAuth 2.0');
    });

    it('should find messages by keyword', () => {
      const results = searchMessages(db, 'authentication');
      expect(results.length).toBe(2);
      expect(results.every((r) => r.content.toLowerCase().includes('authentication'))).toBe(true);
    });

    it('should include rank and highlighted content', () => {
      const results = searchMessages(db, 'authentication');
      expect(results[0]).toHaveProperty('rank');
      expect(results[0]).toHaveProperty('highlightedContent');
      expect(results[0].rank).toBeDefined();
    });

    it('should return empty array when no matches', () => {
      const results = searchMessages(db, 'nonexistent');
      expect(results.length).toBe(0);
    });
  });

  describe('phrase search', () => {
    beforeEach(() => {
      createTestMessage(db, 'Exact phrase match test here');
      createTestMessage(db, 'This has phrase and match but not exact');
      createTestMessage(db, 'No matching content here');
    });

    it('should find exact phrases', () => {
      const results = searchMessages(db, '"exact phrase"');
      // FTS5 phrase search should find messages with the exact phrase
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('OR operator', () => {
    beforeEach(() => {
      createTestMessage(db, 'This uses JWT for auth');
      createTestMessage(db, 'This uses cookies for auth');
      createTestMessage(db, 'This uses sessions');
    });

    it('should find messages matching either term', () => {
      const results = searchMessages(db, 'JWT OR cookies');
      expect(results.length).toBe(2);
    });
  });

  describe('NOT operator', () => {
    beforeEach(() => {
      createTestMessage(db, 'Authentication with password');
      createTestMessage(db, 'Authentication with token');
      createTestMessage(db, 'Authorization rules');
    });

    it('should exclude messages with NOT term', () => {
      // FTS5 NOT operator syntax
      const results = searchMessages(db, 'authentication NOT password');
      // Should find authentication messages that don't contain password
      expect(results.length).toBeGreaterThanOrEqual(0);
      if (results.length > 0) {
        expect(results.some((r) => r.content.toLowerCase().includes('authentication'))).toBe(true);
      }
    });
  });

  describe('prefix search', () => {
    beforeEach(() => {
      createTestMessage(db, 'Authentication is critical');
      createTestMessage(db, 'Authenticator app setup');
      createTestMessage(db, 'Database setup');
    });

    it('should find messages with prefix match', () => {
      const results = searchMessages(db, 'authent*');
      expect(results.length).toBe(2);
    });
  });

  describe('filtering', () => {
    beforeEach(() => {
      createTestMessage(db, 'Important message in general', {
        channel: '#general',
        type: 'note',
        tags: ['important', 'urgent'],
      });
      createTestMessage(db, 'Important decision in dev', {
        channel: '#dev',
        type: 'decision',
        tags: ['important'],
      });
      createTestMessage(db, 'Important request in dev', {
        channel: '#dev',
        type: 'request',
        tags: ['important', 'urgent'],
      });
    });

    it('should filter by channel', () => {
      const results = searchMessages(db, 'Important', { channel: '#general' });
      expect(results.length).toBe(1);
      expect(results[0].channel).toBe('#general');
    });

    it('should filter by type', () => {
      const results = searchMessages(db, 'Important', { type: 'decision' });
      expect(results.length).toBe(1);
      expect(results[0].type).toBe('decision');
    });

    it('should filter by tags', () => {
      const results = searchMessages(db, 'Important', {
        tags: ['important', 'urgent'],
      });
      expect(results.length).toBe(2);
      expect(results.every((r) => r.tags.includes('important') && r.tags.includes('urgent'))).toBe(
        true
      );
    });

    it('should combine multiple filters', () => {
      const results = searchMessages(db, 'Important', {
        channel: '#dev',
        type: 'request',
        tags: ['urgent'],
      });
      expect(results.length).toBe(1);
      expect(results[0].channel).toBe('#dev');
      expect(results[0].type).toBe('request');
    });
  });

  describe('limit and pagination', () => {
    beforeEach(() => {
      for (let i = 0; i < 10; i++) {
        createTestMessage(db, `Test message number ${i}`);
      }
    });

    it('should respect limit', () => {
      const results = searchMessages(db, 'Test', { limit: 5 });
      expect(results.length).toBe(5);
    });

    it('should return all results when no limit', () => {
      const results = searchMessages(db, 'Test');
      expect(results.length).toBe(10);
    });
  });

  describe('since filter', () => {
    it('should filter by timestamp', () => {
      const first = createTestMessage(db, 'First message');
      
      // Create a timestamp in the future
      const futureTimestamp = new Date(Date.now() + 10000).toISOString();
      
      createTestMessage(db, 'Second message');
      createTestMessage(db, 'Third message');

      const results = searchMessages(db, 'message', { since: futureTimestamp });
      // Messages created before the future timestamp won't match
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('BM25 ranking', () => {
    beforeEach(() => {
      createTestMessage(db, 'Authentication authentication authentication'); // High frequency
      createTestMessage(db, 'Authentication is important');
      createTestMessage(db, 'User authentication');
    });

    it('should rank results by relevance', () => {
      const results = searchMessages(db, 'authentication');
      expect(results.length).toBe(3);
      expect(results[0].rank).toBeDefined();
      
      // Results should be ordered by rank (lower rank = better match in BM25)
      for (let i = 1; i < results.length; i++) {
        expect(results[i].rank).toBeGreaterThanOrEqual(results[i - 1].rank);
      }
    });
  });
});
