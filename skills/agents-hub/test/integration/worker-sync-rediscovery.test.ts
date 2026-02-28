/**
 * Tests for workerSync lazy re-discovery of session paths.
 * Verifies that workerSync retries discoverSession when eventsPath is null.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';

// vi.mock factory must not reference external variables
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

describe('workerSync lazy re-discovery', () => {
  let tempDir: string;
  let dbPath: string;
  let hub: Hub;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'hub-rediscovery-'));
    dbPath = join(tempDir, 'hub.db');
    hub = Hub.init(dbPath, 'single');
    mockDiscoverSession.mockReset();
  });

  afterEach(() => {
    hub.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should return no_worker when worker not found', () => {
    const result = hub.workerSync('nonexistent');
    expect(result.ok).toBe(false);
    expect(result.syncStatus).toBe('no_worker');
  });

  it('should return no_events_path when eventsPath missing and re-discovery fails', () => {
    // discoverSession returns null during sync retry
    mockDiscoverSession.mockReturnValue(null);

    hub.workerRegister({ id: 'early-worker', agentType: 'Executor' });
    const worker = hub.workerGet('early-worker');
    expect(worker!.eventsPath).toBeNull();

    const result = hub.workerSync('early-worker');
    expect(result.ok).toBe(false);
    expect(result.syncStatus).toBe('no_events_path');
    // discoverSession called once during sync retry (registerWorker uses internal reference)
    expect(mockDiscoverSession).toHaveBeenCalledTimes(1);
    expect(mockDiscoverSession).toHaveBeenCalledWith('early-worker');
  });

  it('should re-discover session and sync after late session creation', () => {
    // Create events.jsonl with a valid event
    const eventsPath = join(tempDir, 'events.jsonl');
    const event = { type: 'assistant.turn_end', timestamp: '2026-01-15T12:00:00Z' };
    writeFileSync(eventsPath, JSON.stringify(event) + '\n');

    // Registration: uses internal discoverSession (returns null - no real session)
    // Sync retry: uses mocked discoverSession → found
    mockDiscoverSession.mockReturnValue({ sessionId: 'late-session-abc', eventsPath });

    hub.workerRegister({ id: 'late-worker', agentType: 'Executor' });
    const worker = hub.workerGet('late-worker');
    expect(worker!.eventsPath).toBeNull();
    expect(worker!.sessionId).toBeNull();

    // Sync should retry discovery, find session, and process events
    const result = hub.workerSync('late-worker');
    expect(result.ok).toBe(true);
    expect(result.syncStatus).toBe('ok');
    expect(result.workerId).toBe('late-worker');
    expect(result.newEvents).toBe(1);

    // Worker record should be updated with discovered session info
    const updated = hub.workerGet('late-worker');
    expect(updated!.sessionId).toBe('late-session-abc');
    expect(updated!.eventsPath).toBe(eventsPath);
    expect(updated!.turns).toBe(1);
  });

  it('should sync normally on subsequent calls after re-discovery', () => {
    const eventsPath = join(tempDir, 'events.jsonl');
    const event1 = { type: 'assistant.turn_end', timestamp: '2026-01-15T12:00:00Z' };
    writeFileSync(eventsPath, JSON.stringify(event1) + '\n');

    // Sync retry: session found
    mockDiscoverSession.mockReturnValue({ sessionId: 'session-xyz', eventsPath });

    hub.workerRegister({ id: 'worker-resync', agentType: 'Executor' });

    // First sync: triggers re-discovery
    const result1 = hub.workerSync('worker-resync');
    expect(result1.ok).toBe(true);
    expect(result1.newEvents).toBe(1);

    // Append more events
    const event2 = { type: 'tool.execution_complete', timestamp: '2026-01-15T12:01:00Z', tool_name: 'bash' };
    writeFileSync(eventsPath, JSON.stringify(event1) + '\n' + JSON.stringify(event2) + '\n');

    // Second sync: eventsPath is now set, no re-discovery needed
    const result2 = hub.workerSync('worker-resync');
    expect(result2.ok).toBe(true);
    expect(result2.newEvents).toBe(1); // only the new event
    // discoverSession called only once (first sync), not on second sync
    expect(mockDiscoverSession).toHaveBeenCalledTimes(1);
  });
});
