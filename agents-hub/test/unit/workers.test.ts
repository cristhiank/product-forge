/**
 * Unit tests for workers module
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { mkdtempSync, mkdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTestDb } from '../fixtures/seed.js';
import {
  discoverSession,
  registerWorker,
  getWorker,
  listWorkers,
  updateWorker,
  removeWorker,
  deregisterWorker,
  pruneWorkers,
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

  describe('discoverSession', () => {
    it('should handle quoted/indented branch values and prefer newest workspace mtime', () => {
      const sessionStateDir = mkdtempSync(join(tmpdir(), 'hub-session-state-'));
      try {
        const olderSession = join(sessionStateDir, 'session-older');
        const newerSession = join(sessionStateDir, 'session-newer');
        mkdirSync(olderSession, { recursive: true });
        mkdirSync(newerSession, { recursive: true });

        const olderWorkspace = join(olderSession, 'workspace.yaml');
        const newerWorkspace = join(newerSession, 'workspace.yaml');
        writeFileSync(olderWorkspace, '  branch: "worker/B-032"\n');
        writeFileSync(newerWorkspace, "    branch: 'refs/heads/worker/b032'\n");
        writeFileSync(join(olderSession, 'events.jsonl'), '');
        writeFileSync(join(newerSession, 'events.jsonl'), '');

        utimesSync(olderWorkspace, new Date('2026-01-15T10:00:00Z'), new Date('2026-01-15T10:00:00Z'));
        utimesSync(newerWorkspace, new Date('2026-01-15T11:00:00Z'), new Date('2026-01-15T11:00:00Z'));

        const discovered = discoverSession('B032', sessionStateDir);
        expect(discovered).not.toBeNull();
        expect(discovered!.sessionId).toBe('session-newer');
      } finally {
        rmSync(sessionStateDir, { recursive: true, force: true });
      }
    });

    it('should fallback to session.start branch from events.jsonl when workspace parse is unavailable', () => {
      const sessionStateDir = mkdtempSync(join(tmpdir(), 'hub-session-state-'));
      try {
        const olderSession = join(sessionStateDir, 'session-events-old');
        const newerSession = join(sessionStateDir, 'session-events-new');
        mkdirSync(olderSession, { recursive: true });
        mkdirSync(newerSession, { recursive: true });

        writeFileSync(join(olderSession, 'workspace.yaml'), 'cwd: /tmp\n');
        writeFileSync(join(newerSession, 'workspace.yaml'), 'cwd: /tmp\n');

        const oldEvent = JSON.stringify({
          type: 'session.start',
          data: { context: { branch: 'worker/B032' } },
        });
        const newEvent = JSON.stringify({
          type: 'session.start',
          data: { context: { branch: 'refs/heads/worker/b-032' } },
        });

        const olderEvents = join(olderSession, 'events.jsonl');
        const newerEvents = join(newerSession, 'events.jsonl');
        writeFileSync(olderEvents, `${oldEvent}\n`);
        writeFileSync(newerEvents, `${newEvent}\n`);

        utimesSync(olderEvents, new Date('2026-01-15T10:00:00Z'), new Date('2026-01-15T10:00:00Z'));
        utimesSync(newerEvents, new Date('2026-01-15T12:00:00Z'), new Date('2026-01-15T12:00:00Z'));

        const discovered = discoverSession('b032', sessionStateDir);
        expect(discovered).not.toBeNull();
        expect(discovered!.sessionId).toBe('session-events-new');
      } finally {
        rmSync(sessionStateDir, { recursive: true, force: true });
      }
    });
  });

  describe('deregisterWorker', () => {
    it('should mark active worker as completed', () => {
      registerWorker(db, { id: 'worker-1', agentType: 'Executor' });

      const result = deregisterWorker(db, 'worker-1');
      expect(result).toBe(true);

      const worker = getWorker(db, 'worker-1');
      expect(worker).not.toBeNull();
      expect(worker!.status).toBe('completed');
      expect(worker!.completedAt).toBeDefined();
      expect(worker!.completedAt).not.toBeNull();
    });

    it('should return false for non-existent worker', () => {
      const result = deregisterWorker(db, 'non-existent');
      expect(result).toBe(false);
    });

    it('should return false for already completed worker', () => {
      registerWorker(db, { id: 'worker-1', agentType: 'Executor' });
      updateWorker(db, 'worker-1', { status: 'completed', completedAt: '2024-01-15T10:00:00Z' });

      const result = deregisterWorker(db, 'worker-1');
      expect(result).toBe(false);
    });

    it('should return false for failed worker', () => {
      registerWorker(db, { id: 'worker-1', agentType: 'Executor' });
      updateWorker(db, 'worker-1', { status: 'failed' });

      const result = deregisterWorker(db, 'worker-1');
      expect(result).toBe(false);
    });

    it('should not affect other workers', () => {
      registerWorker(db, { id: 'worker-1', agentType: 'Executor' });
      registerWorker(db, { id: 'worker-2', agentType: 'Scout' });

      deregisterWorker(db, 'worker-1');

      const worker2 = getWorker(db, 'worker-2');
      expect(worker2!.status).toBe('active');
    });

    it('should preserve worker data (not delete)', () => {
      registerWorker(db, {
        id: 'worker-1',
        agentType: 'Executor',
        agentName: 'exec-1',
        metadata: { task: 'auth' },
      });

      deregisterWorker(db, 'worker-1');

      const worker = getWorker(db, 'worker-1');
      expect(worker).not.toBeNull();
      expect(worker!.agentType).toBe('Executor');
      expect(worker!.agentName).toBe('exec-1');
      expect(worker!.metadata).toEqual({ task: 'auth' });
    });
  });

  describe('pruneWorkers', () => {
    it('should prune workers with dead PIDs', () => {
      // Use a PID that is certainly not running (very high number)
      registerWorker(db, { id: 'worker-1', agentType: 'Executor', pid: 99999999 });

      const result = pruneWorkers(db);
      expect(result.pruned).toContain('worker-1');

      const worker = getWorker(db, 'worker-1');
      expect(worker!.status).toBe('completed');
      expect(worker!.completedAt).not.toBeNull();
    });

    it('should not prune workers without PIDs', () => {
      registerWorker(db, { id: 'worker-1', agentType: 'Executor' });

      const result = pruneWorkers(db);
      expect(result.pruned).toEqual([]);

      const worker = getWorker(db, 'worker-1');
      expect(worker!.status).toBe('active');
    });

    it('should not prune already completed workers', () => {
      registerWorker(db, { id: 'worker-1', agentType: 'Executor', pid: 99999999 });
      updateWorker(db, 'worker-1', { status: 'completed', completedAt: '2024-01-15T10:00:00Z' });

      const result = pruneWorkers(db);
      expect(result.pruned).toEqual([]);
    });

    it('should not prune workers with alive PIDs', () => {
      // Use the current process PID (definitely alive)
      registerWorker(db, { id: 'worker-1', agentType: 'Executor', pid: process.pid });

      const result = pruneWorkers(db);
      expect(result.pruned).toEqual([]);

      const worker = getWorker(db, 'worker-1');
      expect(worker!.status).toBe('active');
    });

    it('should return all pruned worker IDs', () => {
      registerWorker(db, { id: 'worker-1', agentType: 'Executor', pid: 99999999 });
      registerWorker(db, { id: 'worker-2', agentType: 'Scout', pid: 99999998 });
      registerWorker(db, { id: 'worker-3', agentType: 'Planner', pid: process.pid }); // alive

      const result = pruneWorkers(db);
      expect(result.pruned).toHaveLength(2);
      expect(result.pruned).toContain('worker-1');
      expect(result.pruned).toContain('worker-2');

      const worker3 = getWorker(db, 'worker-3');
      expect(worker3!.status).toBe('active');
    });
  });
});
