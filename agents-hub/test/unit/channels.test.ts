/**
 * Unit tests for channels module
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { createTestDb } from '../fixtures/seed.js';
import { createChannel, listChannels, ensureChannel } from '../../src/core/channels.js';
import { postMessage } from '../../src/core/messages.js';

describe('channels module', () => {
  let db: Database.Database;
  let cleanup: () => void;

  beforeEach(() => {
    const testDb = createTestDb(false);
    db = testDb.db;
    cleanup = testDb.cleanup;
  });

  afterEach(() => {
    cleanup();
  });

  describe('createChannel', () => {
    it('should create a channel with valid name', () => {
      const channel = createChannel(db, '#general', {
        createdBy: 'alice',
        description: 'General discussion',
        workerId: 'worker-1',
      });

      expect(channel.name).toBe('#general');
      expect(channel.createdBy).toBe('alice');
      expect(channel.description).toBe('General discussion');
      expect(channel.workerId).toBe('worker-1');
      expect(channel.createdAt).toBeDefined();
    });

    it('should create a channel with minimal options', () => {
      const channel = createChannel(db, '#dev', {
        createdBy: 'bob',
      });

      expect(channel.name).toBe('#dev');
      expect(channel.createdBy).toBe('bob');
      expect(channel.description).toBeNull();
      expect(channel.workerId).toBeNull();
    });

    it('should reject channel name without # prefix', () => {
      expect(() => {
        createChannel(db, 'invalid', { createdBy: 'alice' });
      }).toThrow('Invalid channel name');
    });

    it('should reject channel name with uppercase letters', () => {
      expect(() => {
        createChannel(db, '#Invalid', { createdBy: 'alice' });
      }).toThrow('Invalid channel name');
    });

    it('should reject channel name with spaces', () => {
      expect(() => {
        createChannel(db, '#invalid name', { createdBy: 'alice' });
      }).toThrow('Invalid channel name');
    });

    it('should reject channel name with special characters', () => {
      expect(() => {
        createChannel(db, '#invalid!@#', { createdBy: 'alice' });
      }).toThrow('Invalid channel name');
    });

    it('should accept channel name with hyphens', () => {
      const channel = createChannel(db, '#my-channel', { createdBy: 'alice' });
      expect(channel.name).toBe('#my-channel');
    });

    it('should accept channel name with numbers', () => {
      const channel = createChannel(db, '#channel-123', { createdBy: 'alice' });
      expect(channel.name).toBe('#channel-123');
    });

    it('should reject duplicate channel names', () => {
      createChannel(db, '#general', { createdBy: 'alice' });
      expect(() => {
        createChannel(db, '#general', { createdBy: 'bob' });
      }).toThrow();
    });
  });

  describe('listChannels', () => {
    beforeEach(() => {
      createChannel(db, '#general', { createdBy: 'alice' });
      createChannel(db, '#dev', { createdBy: 'bob' });
      createChannel(db, '#alerts', { createdBy: 'charlie' });
    });

    it('should list all channels without stats', () => {
      const channels = listChannels(db, false);
      expect(channels.length).toBe(3);
      expect(channels[0]).toHaveProperty('name');
      expect(channels[0]).toHaveProperty('createdBy');
      expect(channels[0]).toHaveProperty('createdAt');
      expect(channels[0]).not.toHaveProperty('messageCount');
    });

    it('should list channels with stats', () => {
      // Add some messages
      postMessage(db, {
        channel: '#general',
        type: 'note',
        author: 'alice',
        content: 'Message 1',
      });
      postMessage(db, {
        channel: '#general',
        type: 'note',
        author: 'bob',
        content: 'Message 2',
      });
      postMessage(db, {
        channel: '#dev',
        type: 'note',
        author: 'charlie',
        content: 'Message 3',
      });

      const channels = listChannels(db, true);
      expect(channels.length).toBe(3);

      const generalChannel = channels.find((c) => c.name === '#general')!;
      expect(generalChannel).toHaveProperty('messageCount');
      expect(generalChannel.messageCount).toBe(2);

      const devChannel = channels.find((c) => c.name === '#dev')!;
      expect(devChannel.messageCount).toBe(1);

      const alertsChannel = channels.find((c) => c.name === '#alerts')!;
      expect(alertsChannel.messageCount).toBe(0);
    });
  });

  describe('ensureChannel', () => {
    it('should create channel if it does not exist', () => {
      const channel = ensureChannel(db, '#new-channel', 'alice');
      expect(channel.name).toBe('#new-channel');
      expect(channel.createdBy).toBe('alice');
    });

    it('should return existing channel if it already exists', () => {
      const first = createChannel(db, '#existing', { createdBy: 'alice' });
      const second = ensureChannel(db, '#existing', 'bob');

      expect(second.name).toBe('#existing');
      expect(second.createdBy).toBe('alice'); // Original creator
      expect(second.createdAt).toBe(first.createdAt);
    });

    it('should be idempotent', () => {
      const first = ensureChannel(db, '#idempotent', 'alice');
      const second = ensureChannel(db, '#idempotent', 'alice');
      const third = ensureChannel(db, '#idempotent', 'bob');

      expect(first.name).toBe('#idempotent');
      expect(second.name).toBe('#idempotent');
      expect(third.name).toBe('#idempotent');
      expect(first.createdAt).toBe(second.createdAt);
      expect(first.createdAt).toBe(third.createdAt);
    });
  });
});
