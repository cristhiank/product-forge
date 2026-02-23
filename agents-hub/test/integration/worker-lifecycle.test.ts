/**
 * Integration tests for the worker register → discover → sync lifecycle.
 *
 * Covers:
 *  - Happy-path register → sync → verify counters
 *  - All event types processed correctly through Hub.workerSync
 *  - Partial NDJSON lines (B-022 fix)
 *  - File truncation resets offset (B-022 fix)
 *  - session.error does NOT mark terminal (B-023 fix)
 *  - abort DOES mark terminal
 *  - workerSyncAll across multiple workers
 *  - Incremental sync (multiple rounds of appending events)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtempSync, rmSync, writeFileSync, appendFileSync } from 'node:fs';

// Mock discoverSession so we control eventsPath resolution
vi.mock('../../src/core/workers.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/core/workers.js')>();
  return {
    ...original,
    discoverSession: vi.fn(),
  };
});

import { Hub } from '../../src/hub.js';
import { discoverSession } from '../../src/core/workers.js';

const mockDiscoverSession = vi.mocked(discoverSession);

// ── Helpers ──────────────────────────────────────────────────────────

/** Build an NDJSON event line */
function evt(type: string, data: Record<string, unknown> = {}, ts?: string): string {
  return JSON.stringify({
    type,
    data,
    id: `e-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: ts ?? new Date().toISOString(),
    parentId: null,
  });
}

/** Write a complete events.jsonl from event lines */
function writeEvents(path: string, lines: string[]): void {
  writeFileSync(path, lines.map(l => l + '\n').join(''));
}

/** Append complete event lines to an existing file */
function appendEvents(path: string, lines: string[]): void {
  appendFileSync(path, lines.map(l => l + '\n').join(''));
}

// ── Test Suite ───────────────────────────────────────────────────────

describe('worker lifecycle integration', () => {
  let tempDir: string;
  let dbPath: string;
  let hub: Hub;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'hub-lifecycle-'));
    dbPath = join(tempDir, 'hub.db');
    hub = Hub.init(dbPath, 'multi');
    mockDiscoverSession.mockReset();
  });

  afterEach(() => {
    hub.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  // ── 1. Happy-path register → sync → verify ───────────────────────

  describe('happy path: register → sync → verify', () => {
    it('should register a worker, sync events, and update counters', () => {
      const eventsPath = join(tempDir, 'events.jsonl');
      writeEvents(eventsPath, [
        evt('session.start', { selectedModel: 'claude-sonnet-4' }, '2026-01-15T10:00:00Z'),
        evt('tool.execution_complete', { toolName: 'view', success: true }, '2026-01-15T10:01:00Z'),
        evt('tool.execution_complete', { toolName: 'grep', success: true }, '2026-01-15T10:02:00Z'),
        evt('assistant.turn_end', {}, '2026-01-15T10:03:00Z'),
        evt('tool.execution_complete', { toolName: 'edit', success: true }, '2026-01-15T10:04:00Z'),
        evt('assistant.turn_end', {}, '2026-01-15T10:05:00Z'),
      ]);

      mockDiscoverSession.mockReturnValue({ sessionId: 'session-happy', eventsPath });

      // Register
      const worker = hub.workerRegister({ id: 'happy-worker', agentType: 'Executor', agentName: 'API worker' });
      expect(worker.id).toBe('happy-worker');
      expect(worker.status).toBe('active');

      // Sync
      const result = hub.workerSync('happy-worker');
      expect(result.ok).toBe(true);
      expect(result.syncStatus).toBe('ok');
      expect(result.workerId).toBe('happy-worker');
      expect(result.newEvents).toBe(6);
      expect(result.toolCalls).toBe(3);
      expect(result.turns).toBe(2);
      expect(result.errors).toBe(0);
      expect(result.status).toBe('active');

      // Verify persisted state
      const updated = hub.workerGet('happy-worker');
      expect(updated!.toolCalls).toBe(3);
      expect(updated!.turns).toBe(2);
      expect(updated!.errors).toBe(0);
      expect(updated!.status).toBe('active');
      expect(updated!.lastEventType).toBe('assistant.turn_end');
    });

    it('should accumulate counters across multiple syncs', () => {
      const eventsPath = join(tempDir, 'events-accum.jsonl');
      writeEvents(eventsPath, [
        evt('session.start', { selectedModel: 'claude' }, '2026-01-15T10:00:00Z'),
        evt('assistant.turn_end', {}, '2026-01-15T10:01:00Z'),
      ]);

      mockDiscoverSession.mockReturnValue({ sessionId: 'session-accum', eventsPath });
      hub.workerRegister({ id: 'accum-worker', agentType: 'Executor' });

      // First sync
      const r1 = hub.workerSync('accum-worker');
      expect(r1!.newEvents).toBe(2);
      expect(r1!.turns).toBe(1);

      // Append more events
      appendEvents(eventsPath, [
        evt('tool.execution_complete', { toolName: 'bash', success: true }, '2026-01-15T10:02:00Z'),
        evt('tool.execution_complete', { toolName: 'edit', success: true }, '2026-01-15T10:03:00Z'),
        evt('assistant.turn_end', {}, '2026-01-15T10:04:00Z'),
      ]);

      // Second sync — only new events
      const r2 = hub.workerSync('accum-worker');
      expect(r2!.newEvents).toBe(3);
      expect(r2!.toolCalls).toBe(2);
      expect(r2!.turns).toBe(1);

      // Counters are cumulative in the worker record
      const w = hub.workerGet('accum-worker');
      expect(w!.toolCalls).toBe(2); // 0 from first sync + 2 from second
      expect(w!.turns).toBe(2);     // 1 + 1
    });

    it('should return empty sync result when no new events', () => {
      const eventsPath = join(tempDir, 'events-empty.jsonl');
      writeEvents(eventsPath, [
        evt('session.start', {}, '2026-01-15T10:00:00Z'),
      ]);

      mockDiscoverSession.mockReturnValue({ sessionId: 'session-empty', eventsPath });
      hub.workerRegister({ id: 'empty-worker', agentType: 'Scout' });

      hub.workerSync('empty-worker');

      // Sync again with no new events
      const r2 = hub.workerSync('empty-worker');
      expect(r2).not.toBeNull();
      expect(r2!.newEvents).toBe(0);
      expect(r2!.toolCalls).toBe(0);
      expect(r2!.turns).toBe(0);
    });
  });

  // ── 2. All event types ────────────────────────────────────────────

  describe('all event types processing', () => {
    it('should process session.start, tool calls, turns, skills, subagents correctly', () => {
      const eventsPath = join(tempDir, 'events-all-types.jsonl');
      writeEvents(eventsPath, [
        evt('session.start', { selectedModel: 'claude-sonnet-4' }, '2026-01-15T10:00:00Z'),
        evt('skill.invoked', { name: 'agents-hub' }, '2026-01-15T10:00:30Z'),
        evt('skill.invoked', { name: 'backlog' }, '2026-01-15T10:00:31Z'),
        evt('tool.execution_complete', { toolName: 'bash', success: true }, '2026-01-15T10:01:00Z'),
        evt('tool.execution_complete', { toolName: 'view', success: true }, '2026-01-15T10:02:00Z'),
        evt('assistant.turn_end', {}, '2026-01-15T10:03:00Z'),
        evt('subagent.started', { agentName: 'Scout' }, '2026-01-15T10:04:00Z'),
        evt('subagent.completed', { agentName: 'Scout' }, '2026-01-15T10:05:00Z'),
        evt('tool.execution_complete', { toolName: 'edit', success: true }, '2026-01-15T10:06:00Z'),
        evt('tool.execution_complete', { toolName: 'bash', success: false }, '2026-01-15T10:07:00Z'),
        evt('assistant.turn_end', {}, '2026-01-15T10:08:00Z'),
      ]);

      mockDiscoverSession.mockReturnValue({ sessionId: 'session-all', eventsPath });
      hub.workerRegister({ id: 'all-types-worker', agentType: 'Orchestrator' });

      const result = hub.workerSync('all-types-worker');
      expect(result).not.toBeNull();
      expect(result!.newEvents).toBe(11);
      expect(result!.toolCalls).toBe(4);
      expect(result!.turns).toBe(2);
      expect(result!.errors).toBe(1); // one failed tool
      expect(result!.status).toBe('active');

      // Check significant events include session start, skills, subagents, tool error
      const types = result!.significantEvents.map(e => e.type);
      expect(types).toContain('start');
      expect(types).toContain('skill');
      expect(types).toContain('subagent');
      expect(types).toContain('tool_error');

      const w = hub.workerGet('all-types-worker');
      expect(w!.lastEventAt).toBe('2026-01-15T10:08:00Z');
      expect(w!.lastEventType).toBe('assistant.turn_end');
    });
  });

  // ── 3. Partial NDJSON lines (B-022 fix) ───────────────────────────

  describe('partial NDJSON handling (B-022)', () => {
    it('should not consume partial trailing line; complete it on next sync', () => {
      const eventsPath = join(tempDir, 'events-partial.jsonl');
      const completeLine = evt('session.start', { selectedModel: 'claude' }, '2026-01-15T10:00:00Z');
      const partialLine = '{"type":"assistant.turn_end","data":{},"id":"e-partial","timest';

      // Write one complete line + one partial (no trailing newline)
      writeFileSync(eventsPath, completeLine + '\n' + partialLine);

      mockDiscoverSession.mockReturnValue({ sessionId: 'session-partial', eventsPath });
      hub.workerRegister({ id: 'partial-worker', agentType: 'Executor' });

      // First sync: should only get the complete line
      const r1 = hub.workerSync('partial-worker');
      expect(r1!.newEvents).toBe(1);

      const w1 = hub.workerGet('partial-worker');
      expect(w1!.turns).toBe(0); // turn_end was partial, not counted

      // Now complete the partial line
      const fullLine = evt('assistant.turn_end', {}, '2026-01-15T10:01:00Z');
      writeFileSync(eventsPath, completeLine + '\n' + fullLine + '\n');

      // Second sync: should pick up the now-complete line
      const r2 = hub.workerSync('partial-worker');
      expect(r2!.newEvents).toBe(1);
      expect(r2!.turns).toBe(1);

      const w2 = hub.workerGet('partial-worker');
      expect(w2!.turns).toBe(1);
    });

    it('should handle file with only partial data (no complete lines)', () => {
      const eventsPath = join(tempDir, 'events-all-partial.jsonl');
      writeFileSync(eventsPath, '{"type":"session.start","data":{}');

      mockDiscoverSession.mockReturnValue({ sessionId: 'session-all-partial', eventsPath });
      hub.workerRegister({ id: 'all-partial-worker', agentType: 'Executor' });

      const r = hub.workerSync('all-partial-worker');
      expect(r!.newEvents).toBe(0);

      const w = hub.workerGet('all-partial-worker');
      expect(w!.eventsOffset).toBe(0); // offset should not advance
    });
  });

  // ── 4. File truncation (B-022 fix) ────────────────────────────────

  describe('file truncation reset (B-022)', () => {
    it('should reset offset and re-read when file is truncated', () => {
      const eventsPath = join(tempDir, 'events-truncate.jsonl');
      writeEvents(eventsPath, [
        evt('session.start', {}, '2026-01-15T10:00:00Z'),
        evt('tool.execution_complete', { toolName: 'view', success: true }, '2026-01-15T10:01:00Z'),
        evt('assistant.turn_end', {}, '2026-01-15T10:02:00Z'),
        evt('tool.execution_complete', { toolName: 'edit', success: true }, '2026-01-15T10:03:00Z'),
        evt('assistant.turn_end', {}, '2026-01-15T10:04:00Z'),
      ]);

      mockDiscoverSession.mockReturnValue({ sessionId: 'session-trunc', eventsPath });
      hub.workerRegister({ id: 'trunc-worker', agentType: 'Executor' });

      // First sync: consume all 5 events
      const r1 = hub.workerSync('trunc-worker');
      expect(r1!.newEvents).toBe(5);
      expect(r1!.toolCalls).toBe(2);
      expect(r1!.turns).toBe(2);

      const w1 = hub.workerGet('trunc-worker');
      const oldOffset = w1!.eventsOffset;
      expect(oldOffset).toBeGreaterThan(0);

      // Truncate and write a smaller file (simulating log rotation)
      writeEvents(eventsPath, [
        evt('session.start', { selectedModel: 'new-session' }, '2026-01-15T11:00:00Z'),
        evt('assistant.turn_end', {}, '2026-01-15T11:01:00Z'),
      ]);

      // Second sync: file is smaller than old offset → should reset and re-read
      const r2 = hub.workerSync('trunc-worker');
      expect(r2!.newEvents).toBe(2);
      expect(r2!.turns).toBe(1);

      // Counters accumulate even across truncation
      const w2 = hub.workerGet('trunc-worker');
      expect(w2!.turns).toBe(3);     // 2 from first + 1 from second
      expect(w2!.toolCalls).toBe(2);  // 2 from first + 0 from second
    });
  });

  // ── 5. session.error does NOT mark terminal (B-023 fix) ───────────

  describe('session.error recovery (B-023)', () => {
    it('should increment errors but keep worker active after session.error', () => {
      const eventsPath = join(tempDir, 'events-error.jsonl');
      writeEvents(eventsPath, [
        evt('session.start', { selectedModel: 'claude' }, '2026-01-15T10:00:00Z'),
        evt('tool.execution_complete', { toolName: 'bash', success: true }, '2026-01-15T10:01:00Z'),
        evt('session.error', { message: 'Transient network error' }, '2026-01-15T10:02:00Z'),
        evt('tool.execution_complete', { toolName: 'view', success: true }, '2026-01-15T10:03:00Z'),
        evt('assistant.turn_end', {}, '2026-01-15T10:04:00Z'),
      ]);

      mockDiscoverSession.mockReturnValue({ sessionId: 'session-err', eventsPath });
      hub.workerRegister({ id: 'error-worker', agentType: 'Executor' });

      const result = hub.workerSync('error-worker');
      expect(result!.status).toBe('active');       // NOT failed
      expect(result!.errors).toBe(1);
      expect(result!.toolCalls).toBe(2);
      expect(result!.turns).toBe(1);

      const w = hub.workerGet('error-worker');
      expect(w!.status).toBe('active');
      expect(w!.errors).toBe(1);
      expect(w!.completedAt).toBeNull(); // not completed
    });

    it('should stay active through multiple session.error events', () => {
      const eventsPath = join(tempDir, 'events-multi-error.jsonl');
      writeEvents(eventsPath, [
        evt('session.start', {}, '2026-01-15T10:00:00Z'),
        evt('session.error', { message: 'Error 1' }, '2026-01-15T10:01:00Z'),
        evt('session.error', { message: 'Error 2' }, '2026-01-15T10:02:00Z'),
        evt('session.error', { message: 'Error 3' }, '2026-01-15T10:03:00Z'),
        evt('tool.execution_complete', { toolName: 'bash', success: true }, '2026-01-15T10:04:00Z'),
        evt('assistant.turn_end', {}, '2026-01-15T10:05:00Z'),
      ]);

      mockDiscoverSession.mockReturnValue({ sessionId: 'session-multi-err', eventsPath });
      hub.workerRegister({ id: 'multi-error-worker', agentType: 'Executor' });

      const result = hub.workerSync('multi-error-worker');
      expect(result!.status).toBe('active');
      expect(result!.errors).toBe(3);
      expect(result!.toolCalls).toBe(1);
      expect(result!.turns).toBe(1);

      const w = hub.workerGet('multi-error-worker');
      expect(w!.status).toBe('active');
      expect(w!.errors).toBe(3);
    });

    it('should accumulate errors across syncs without going terminal', () => {
      const eventsPath = join(tempDir, 'events-accum-err.jsonl');
      writeEvents(eventsPath, [
        evt('session.start', {}, '2026-01-15T10:00:00Z'),
        evt('session.error', { message: 'Error batch 1' }, '2026-01-15T10:01:00Z'),
      ]);

      mockDiscoverSession.mockReturnValue({ sessionId: 'session-accum-err', eventsPath });
      hub.workerRegister({ id: 'accum-err-worker', agentType: 'Executor' });

      hub.workerSync('accum-err-worker');
      let w = hub.workerGet('accum-err-worker');
      expect(w!.errors).toBe(1);
      expect(w!.status).toBe('active');

      // Append more errors + normal work
      appendEvents(eventsPath, [
        evt('session.error', { message: 'Error batch 2' }, '2026-01-15T10:02:00Z'),
        evt('tool.execution_complete', { toolName: 'bash', success: true }, '2026-01-15T10:03:00Z'),
      ]);

      hub.workerSync('accum-err-worker');
      w = hub.workerGet('accum-err-worker');
      expect(w!.errors).toBe(2); // 1 + 1
      expect(w!.toolCalls).toBe(1);
      expect(w!.status).toBe('active');
    });
  });

  // ── 6. Abort marks terminal ───────────────────────────────────────

  describe('abort marks terminal', () => {
    it('should set status to failed with exit code 130 on abort', () => {
      const eventsPath = join(tempDir, 'events-abort.jsonl');
      writeEvents(eventsPath, [
        evt('session.start', { selectedModel: 'claude' }, '2026-01-15T10:00:00Z'),
        evt('tool.execution_complete', { toolName: 'bash', success: true }, '2026-01-15T10:01:00Z'),
        evt('assistant.turn_end', {}, '2026-01-15T10:02:00Z'),
        evt('abort', { reason: 'User interrupted' }, '2026-01-15T10:03:00Z'),
      ]);

      mockDiscoverSession.mockReturnValue({ sessionId: 'session-abort', eventsPath });
      hub.workerRegister({ id: 'abort-worker', agentType: 'Executor' });

      const result = hub.workerSync('abort-worker');
      expect(result!.status).toBe('failed');
      expect(result!.errors).toBe(0);
      expect(result!.toolCalls).toBe(1);
      expect(result!.turns).toBe(1);

      const w = hub.workerGet('abort-worker');
      expect(w!.status).toBe('failed');
      expect(w!.exitCode).toBe(130);
      expect(w!.completedAt).toBe('2026-01-15T10:03:00Z');
    });

    it('should mark terminal even if session.error preceded abort', () => {
      const eventsPath = join(tempDir, 'events-error-abort.jsonl');
      writeEvents(eventsPath, [
        evt('session.start', {}, '2026-01-15T10:00:00Z'),
        evt('session.error', { message: 'Something went wrong' }, '2026-01-15T10:01:00Z'),
        evt('abort', { reason: 'System abort' }, '2026-01-15T10:02:00Z'),
      ]);

      mockDiscoverSession.mockReturnValue({ sessionId: 'session-err-abort', eventsPath });
      hub.workerRegister({ id: 'err-abort-worker', agentType: 'Executor' });

      const result = hub.workerSync('err-abort-worker');
      expect(result!.status).toBe('failed');
      expect(result!.errors).toBe(1); // session.error increments, abort doesn't

      const w = hub.workerGet('err-abort-worker');
      expect(w!.status).toBe('failed');
      expect(w!.exitCode).toBe(130);
      expect(w!.errors).toBe(1);
    });
  });

  // ── 7. workerSyncAll ──────────────────────────────────────────────

  describe('workerSyncAll', () => {
    it('should sync all active workers and skip non-existent paths gracefully', () => {
      const eventsPath1 = join(tempDir, 'events-w1.jsonl');
      const eventsPath2 = join(tempDir, 'events-w2.jsonl');
      writeEvents(eventsPath1, [
        evt('session.start', {}, '2026-01-15T10:00:00Z'),
        evt('assistant.turn_end', {}, '2026-01-15T10:01:00Z'),
      ]);
      writeEvents(eventsPath2, [
        evt('session.start', {}, '2026-01-15T10:00:00Z'),
        evt('tool.execution_complete', { toolName: 'bash', success: true }, '2026-01-15T10:01:00Z'),
        evt('tool.execution_complete', { toolName: 'view', success: true }, '2026-01-15T10:02:00Z'),
        evt('assistant.turn_end', {}, '2026-01-15T10:03:00Z'),
      ]);

      // Use argument-based mock since workerSyncAll processes workers in DESC order
      mockDiscoverSession.mockImplementation((workerId: string) => {
        if (workerId === 'sync-all-w1') return { sessionId: 'session-w1', eventsPath: eventsPath1 };
        if (workerId === 'sync-all-w2') return { sessionId: 'session-w2', eventsPath: eventsPath2 };
        return null;
      });

      hub.workerRegister({ id: 'sync-all-w1', agentType: 'Executor' });
      hub.workerRegister({ id: 'sync-all-w2', agentType: 'Scout' });

      const results = hub.workerSyncAll();
      expect(results.length).toBe(2);

      const r1 = results.find(r => r.workerId === 'sync-all-w1');
      const r2 = results.find(r => r.workerId === 'sync-all-w2');
      expect(r1!.newEvents).toBe(2);
      expect(r1!.turns).toBe(1);
      expect(r2!.newEvents).toBe(4);
      expect(r2!.toolCalls).toBe(2);
    });

    it('should not include completed/failed workers in syncAll', () => {
      const eventsPath = join(tempDir, 'events-completed.jsonl');
      writeEvents(eventsPath, [
        evt('session.start', {}, '2026-01-15T10:00:00Z'),
        evt('abort', { reason: 'done' }, '2026-01-15T10:01:00Z'),
      ]);

      mockDiscoverSession.mockReturnValue({ sessionId: 'session-done', eventsPath });
      hub.workerRegister({ id: 'done-worker', agentType: 'Executor' });

      // First sync marks it failed (abort)
      hub.workerSync('done-worker');
      const w = hub.workerGet('done-worker');
      expect(w!.status).toBe('failed');

      // Register another active worker
      const eventsPath2 = join(tempDir, 'events-active.jsonl');
      writeEvents(eventsPath2, [
        evt('session.start', {}, '2026-01-15T10:00:00Z'),
      ]);
      mockDiscoverSession.mockReturnValue({ sessionId: 'session-active', eventsPath: eventsPath2 });
      hub.workerRegister({ id: 'active-worker', agentType: 'Scout' });

      // syncAll should only sync the active worker
      const results = hub.workerSyncAll();
      expect(results.length).toBe(1);
      expect(results[0].workerId).toBe('active-worker');
    });
  });

  // ── 8. Worker listing and filtering ───────────────────────────────

  describe('worker listing', () => {
    it('should filter workers by status', () => {
      const eventsPathActive = join(tempDir, 'events-list-active.jsonl');
      const eventsPathFailed = join(tempDir, 'events-list-failed.jsonl');
      writeEvents(eventsPathActive, [
        evt('session.start', {}, '2026-01-15T10:00:00Z'),
      ]);
      writeEvents(eventsPathFailed, [
        evt('session.start', {}, '2026-01-15T10:00:00Z'),
        evt('abort', { reason: 'cancelled' }, '2026-01-15T10:01:00Z'),
      ]);

      // Use argument-based mock for correct worker→path mapping
      mockDiscoverSession.mockImplementation((workerId: string) => {
        if (workerId === 'list-active') return { sessionId: 's-active', eventsPath: eventsPathActive };
        if (workerId === 'list-failed') return { sessionId: 's-failed', eventsPath: eventsPathFailed };
        return null;
      });

      hub.workerRegister({ id: 'list-active', agentType: 'Executor' });
      hub.workerRegister({ id: 'list-failed', agentType: 'Scout' });

      // Sync the failed one to mark it terminal
      hub.workerSync('list-failed');

      const active = hub.workerList({ status: 'active' });
      const failed = hub.workerList({ status: 'failed' });
      const all = hub.workerList();

      expect(active.length).toBe(1);
      expect(active[0].id).toBe('list-active');
      expect(failed.length).toBe(1);
      expect(failed[0].id).toBe('list-failed');
      expect(all.length).toBe(2);
    });
  });

  // ── 9. Nonexistent worker ─────────────────────────────────────────

  describe('edge cases', () => {
    it('should return no_worker when syncing a nonexistent worker', () => {
      const result = hub.workerSync('ghost-worker');
      expect(result.ok).toBe(false);
      expect(result.syncStatus).toBe('no_worker');
    });

    it('should handle worker removal', () => {
      mockDiscoverSession.mockReturnValue(null);
      hub.workerRegister({ id: 'removable-worker', agentType: 'Executor' });

      expect(hub.workerGet('removable-worker')).not.toBeNull();
      const removed = hub.workerRemove('removable-worker');
      expect(removed).toBe(true);
      expect(hub.workerGet('removable-worker')).toBeNull();
    });

    it('should handle empty events file', () => {
      const eventsPath = join(tempDir, 'events-empty-file.jsonl');
      writeFileSync(eventsPath, '');

      mockDiscoverSession.mockReturnValue({ sessionId: 'session-empty-file', eventsPath });
      hub.workerRegister({ id: 'empty-file-worker', agentType: 'Executor' });

      const result = hub.workerSync('empty-file-worker');
      expect(result.ok).toBe(true);
      expect(result.syncStatus).toBe('ok');
      expect(result.newEvents).toBe(0);
    });

    it('should handle events with missing fields gracefully', () => {
      const eventsPath = join(tempDir, 'events-sparse.jsonl');
      // Events with minimal/missing fields — should still parse
      writeEvents(eventsPath, [
        JSON.stringify({ type: 'assistant.turn_end' }),
        JSON.stringify({ type: 'tool.execution_complete' }),
        JSON.stringify({}), // no type at all
      ]);

      mockDiscoverSession.mockReturnValue({ sessionId: 'session-sparse', eventsPath });
      hub.workerRegister({ id: 'sparse-worker', agentType: 'Executor' });

      const result = hub.workerSync('sparse-worker');
      expect(result.ok).toBe(true);
      expect(result.syncStatus).toBe('ok');
      expect(result.newEvents).toBe(3);
      expect(result.turns).toBe(1);
      expect(result.toolCalls).toBe(1);
    });

    it('should return events_missing when events file path no longer exists', () => {
      const missingEventsPath = join(tempDir, 'events-missing.jsonl');
      mockDiscoverSession.mockReturnValue({ sessionId: 'session-missing', eventsPath: missingEventsPath });
      hub.workerRegister({ id: 'missing-events-worker', agentType: 'Executor' });

      const result = hub.workerSync('missing-events-worker');
      expect(result.ok).toBe(false);
      expect(result.syncStatus).toBe('events_missing');
    });

    it('should return parse_error when events file has malformed JSON lines', () => {
      const eventsPath = join(tempDir, 'events-parse-error.jsonl');
      writeFileSync(eventsPath, '{not-json}\n');

      mockDiscoverSession.mockReturnValue({ sessionId: 'session-parse', eventsPath });
      hub.workerRegister({ id: 'parse-error-worker', agentType: 'Executor' });

      const result = hub.workerSync('parse-error-worker');
      expect(result.ok).toBe(false);
      expect(result.syncStatus).toBe('parse_error');
    });
  });
});
