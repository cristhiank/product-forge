/**
 * Unit tests for workers module
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { createTestDb } from '../fixtures/seed.js';
import {
  registerWorker,
  getWorker,
  listWorkers,
  updateWorker,
  removeWorker,
} from '../../src/core/workers.js';

describe('workers module', () => {
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

  describe('registerWorker', () => {
    it('should create worker with default channel', () => {
      const worker = registerWorker(db, {
        id: 'worker-1',
        agentType: 'Executor',
        agentName: 'exec-1',
      });

      expect(worker.id).toBe('worker-1');
      expect(worker.channel).toBe('#worker-worker-1');
      expect(worker.agentType).toBe('Executor');
      expect(worker.agentName).toBe('exec-1');
      expect(worker.status).toBe('active');
      expect(worker.registeredAt).toBeDefined();
      expect(worker.metadata).toEqual({});
    });

    it('should create worker with provided channel', () => {
      const worker = registerWorker(db, {
        id: 'worker-2',
        channel: '#custom-channel',
        agentType: 'Scout',
      });

      expect(worker.id).toBe('worker-2');
      expect(worker.channel).toBe('#custom-channel');
      expect(worker.agentType).toBe('Scout');
    });

    it('should create worker with metadata', () => {
      const worker = registerWorker(db, {
        id: 'worker-3',
        metadata: { task: 'auth-implementation', priority: 'high' },
      });

      expect(worker.metadata).toEqual({ task: 'auth-implementation', priority: 'high' });
    });

    it('should create worker with all optional fields', () => {
      const worker = registerWorker(db, {
        id: 'worker-4',
        channel: '#worker-4',
        agentType: 'Planner',
        agentName: 'planner-1',
        worktreePath: '/tmp/worktrees/worker-4',
        pid: 12345,
        metadata: { branch: 'feature/new' },
      });

      expect(worker.id).toBe('worker-4');
      expect(worker.channel).toBe('#worker-4');
      expect(worker.agentType).toBe('Planner');
      expect(worker.agentName).toBe('planner-1');
      expect(worker.worktreePath).toBe('/tmp/worktrees/worker-4');
      expect(worker.pid).toBe(12345);
      expect(worker.metadata).toEqual({ branch: 'feature/new' });
    });
  });

  describe('getWorker', () => {
    it('should return null for non-existent worker', () => {
      const worker = getWorker(db, 'non-existent');
      expect(worker).toBeNull();
    });

    it('should return registered worker', () => {
      registerWorker(db, {
        id: 'worker-1',
        agentType: 'Executor',
      });

      const worker = getWorker(db, 'worker-1');
      expect(worker).not.toBeNull();
      expect(worker!.id).toBe('worker-1');
      expect(worker!.agentType).toBe('Executor');
    });

    it('should return worker with all fields populated', () => {
      registerWorker(db, {
        id: 'worker-5',
        channel: '#test',
        agentType: 'Verifier',
        agentName: 'verify-1',
        worktreePath: '/tmp/test',
        pid: 99999,
        metadata: { key: 'value' },
      });

      const worker = getWorker(db, 'worker-5');
      expect(worker).not.toBeNull();
      expect(worker!.channel).toBe('#test');
      expect(worker!.agentType).toBe('Verifier');
      expect(worker!.agentName).toBe('verify-1');
      expect(worker!.worktreePath).toBe('/tmp/test');
      expect(worker!.pid).toBe(99999);
      expect(worker!.metadata).toEqual({ key: 'value' });
    });
  });

  describe('listWorkers', () => {
    beforeEach(() => {
      registerWorker(db, { id: 'worker-1', agentType: 'Scout' });
      registerWorker(db, { id: 'worker-2', agentType: 'Executor' });
      registerWorker(db, { id: 'worker-3', agentType: 'Planner' });
      
      // Update one to completed status
      updateWorker(db, 'worker-2', { status: 'completed', completedAt: '2024-01-15T10:00:00Z' });
    });

    it('should list all workers', () => {
      const workers = listWorkers(db);
      expect(workers.length).toBe(3);
      expect(workers.map(w => w.id)).toContain('worker-1');
      expect(workers.map(w => w.id)).toContain('worker-2');
      expect(workers.map(w => w.id)).toContain('worker-3');
    });

    it('should filter by status - active', () => {
      const workers = listWorkers(db, { status: 'active' });
      expect(workers.length).toBe(2);
      expect(workers.map(w => w.id)).toContain('worker-1');
      expect(workers.map(w => w.id)).toContain('worker-3');
      expect(workers.map(w => w.id)).not.toContain('worker-2');
    });

    it('should filter by status - completed', () => {
      const workers = listWorkers(db, { status: 'completed' });
      expect(workers.length).toBe(1);
      expect(workers[0].id).toBe('worker-2');
      expect(workers[0].status).toBe('completed');
    });

    it('should filter by status - failed', () => {
      updateWorker(db, 'worker-3', { status: 'failed', exitCode: 1 });
      
      const workers = listWorkers(db, { status: 'failed' });
      expect(workers.length).toBe(1);
      expect(workers[0].id).toBe('worker-3');
      expect(workers[0].status).toBe('failed');
    });

    it('should return workers in descending order by registration time', () => {
      const workers = listWorkers(db);
      // worker-3 should be first (most recent), worker-1 last
      expect(workers[0].id).toBe('worker-3');
      expect(workers[2].id).toBe('worker-1');
    });
  });

  describe('updateWorker', () => {
    beforeEach(() => {
      registerWorker(db, {
        id: 'worker-1',
        agentType: 'Executor',
        metadata: { initial: true },
      });
    });

    it('should update status field', () => {
      const updated = updateWorker(db, 'worker-1', { status: 'completed' });
      expect(updated).not.toBeNull();
      expect(updated!.status).toBe('completed');
    });

    it('should update exitCode field', () => {
      const updated = updateWorker(db, 'worker-1', { exitCode: 0 });
      expect(updated!.exitCode).toBe(0);
    });

    it('should update session fields', () => {
      const updated = updateWorker(db, 'worker-1', {
        sessionId: 'session-123',
        eventsPath: '/path/to/events.jsonl',
      });
      expect(updated!.sessionId).toBe('session-123');
      expect(updated!.eventsPath).toBe('/path/to/events.jsonl');
    });

    it('should update activity tracking fields', () => {
      const updated = updateWorker(db, 'worker-1', {
        lastEventAt: '2024-01-15T12:00:00Z',
        lastEventType: 'assistant.turn_end',
        eventsOffset: 1024,
      });
      expect(updated!.lastEventAt).toBe('2024-01-15T12:00:00Z');
      expect(updated!.lastEventType).toBe('assistant.turn_end');
      expect(updated!.eventsOffset).toBe(1024);
    });

    it('should update counter fields', () => {
      const updated = updateWorker(db, 'worker-1', {
        toolCalls: 42,
        turns: 10,
        errors: 2,
      });
      expect(updated!.toolCalls).toBe(42);
      expect(updated!.turns).toBe(10);
      expect(updated!.errors).toBe(2);
    });

    it('should update completedAt field', () => {
      const updated = updateWorker(db, 'worker-1', {
        status: 'completed',
        completedAt: '2024-01-15T15:30:00Z',
      });
      expect(updated!.status).toBe('completed');
      expect(updated!.completedAt).toBe('2024-01-15T15:30:00Z');
    });

    it('should update metadata field with JSON serialization', () => {
      const newMetadata = {
        initial: true,
        updated: 'yes',
        nested: { key: 'value' },
        count: 123,
      };
      const updated = updateWorker(db, 'worker-1', { metadata: newMetadata });
      expect(updated!.metadata).toEqual(newMetadata);
    });

    it('should update multiple fields at once', () => {
      const updated = updateWorker(db, 'worker-1', {
        status: 'failed',
        exitCode: 1,
        errors: 5,
        completedAt: '2024-01-15T16:00:00Z',
      });
      expect(updated!.status).toBe('failed');
      expect(updated!.exitCode).toBe(1);
      expect(updated!.errors).toBe(5);
      expect(updated!.completedAt).toBe('2024-01-15T16:00:00Z');
    });

    it('should return null for non-existent worker', () => {
      const updated = updateWorker(db, 'non-existent', { status: 'completed' });
      expect(updated).toBeNull();
    });

    it('should return worker unchanged if no updates provided', () => {
      const before = getWorker(db, 'worker-1');
      const updated = updateWorker(db, 'worker-1', {});
      expect(updated).toEqual(before);
    });
  });

  describe('removeWorker', () => {
    beforeEach(() => {
      registerWorker(db, { id: 'worker-1' });
      registerWorker(db, { id: 'worker-2' });
    });

    it('should remove worker and return true', () => {
      const removed = removeWorker(db, 'worker-1');
      expect(removed).toBe(true);
      
      const worker = getWorker(db, 'worker-1');
      expect(worker).toBeNull();
    });

    it('should return false for non-existent worker', () => {
      const removed = removeWorker(db, 'non-existent');
      expect(removed).toBe(false);
    });

    it('should not affect other workers', () => {
      removeWorker(db, 'worker-1');
      
      const worker2 = getWorker(db, 'worker-2');
      expect(worker2).not.toBeNull();
      expect(worker2!.id).toBe('worker-2');
    });

    it('should allow re-registering same ID after removal', () => {
      removeWorker(db, 'worker-1');
      
      const newWorker = registerWorker(db, {
        id: 'worker-1',
        agentType: 'NewType',
      });
      
      expect(newWorker.id).toBe('worker-1');
      expect(newWorker.agentType).toBe('NewType');
    });
  });
});
