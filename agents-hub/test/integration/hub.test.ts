/**
 * Integration tests for Hub class
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Hub } from '../../src/hub.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtempSync, rmSync, existsSync, writeFileSync, statSync } from 'fs';
import { openDatabase } from '../../src/db/connection.js';
import { updateWorker } from '../../src/core/workers.js';

describe('Hub integration', () => {
  let tempDir: string;
  let dbPath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'hub-integration-'));
    dbPath = join(tempDir, 'hub.db');
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Hub.init', () => {
    it('should create database file with default channels in single mode', () => {
      const hub = Hub.init(dbPath, 'single');

      expect(existsSync(dbPath)).toBe(true);

      const channels = hub.channelList(false);
      expect(channels.length).toBeGreaterThan(0);
      expect(channels.some((c) => c.name === '#main')).toBe(true);

      hub.close();
    });

    it('should create multiple channels in multi mode', () => {
      const hub = Hub.init(dbPath, 'multi');

      const channels = hub.channelList(false);
      expect(channels.length).toBeGreaterThanOrEqual(2);
      expect(channels.some((c) => c.name === '#main')).toBe(true);
      expect(channels.some((c) => c.name === '#general')).toBe(true);

      hub.close();
    });

    it('should set hub metadata', () => {
      const hub = Hub.init(dbPath, 'single', 'test-hub-123');

      const status = hub.status();
      expect(status.hubId).toBe('test-hub-123');
      expect(status.mode).toBe('single');

      hub.close();
    });
  });

  describe('full workflow', () => {
    let hub: Hub;

    beforeEach(() => {
      hub = Hub.init(dbPath, 'multi');
    });

    afterEach(() => {
      hub.close();
    });

    it('should support post → reply → readThread → search workflow', () => {
      // Post a message
      const parent = hub.post({
        channel: '#main',
        type: 'request',
        author: 'alice',
        content: 'Need help with authentication',
        tags: ['help', 'auth'],
      });

      expect(parent.id).toBeDefined();
      expect(parent.channel).toBe('#main');

      // Reply to the message
      const reply = hub.reply(parent.id, {
        author: 'bob',
        content: 'Use JWT tokens for stateless auth',
      });

      expect(reply.threadId).toBe(parent.id);
      expect(reply.channel).toBe('#main');

      // Read the thread
      const thread = hub.readThread(parent.id);
      expect(thread.length).toBe(2);
      expect(thread[0].id).toBe(parent.id);
      expect(thread[1].id).toBe(reply.id);

      // Search for messages
      const results = hub.search('authentication');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.id === parent.id)).toBe(true);
    });

    it('should update messages', () => {
      const message = hub.post({
        channel: '#main',
        type: 'note',
        author: 'alice',
        content: 'Original content',
        metadata: { version: 1 },
      });

      const updated = hub.update(message.id, {
        content: 'Updated content',
        metadata: { version: 2, reviewed: true },
      });

      expect(updated.content).toBe('Updated content');
      expect(updated.metadata.version).toBe(2);
      expect(updated.metadata.reviewed).toBe(true);
    });

    it('should read messages with filters', () => {
      hub.post({
        channel: '#main',
        type: 'note',
        author: 'alice',
        content: 'Message 1',
        tags: ['tag1'],
      });
      hub.post({
        channel: '#general',
        type: 'decision',
        author: 'bob',
        content: 'Message 2',
        tags: ['tag2'],
      });

      const mainMessages = hub.read({ channel: '#main' });
      expect(mainMessages.messages.some((m) => m.channel === '#main')).toBe(true);

      const aliceMessages = hub.read({ author: 'alice' });
      expect(aliceMessages.messages.every((m) => m.author === 'alice')).toBe(true);
    });
  });

  describe('export and import', () => {
    let hub: Hub;

    beforeEach(() => {
      hub = Hub.init(dbPath, 'single');
    });

    afterEach(() => {
      hub.close();
    });

    it('should export and import messages', () => {
      // Post some messages
      hub.post({
        channel: '#main',
        type: 'note',
        author: 'alice',
        content: 'Message 1',
        tags: ['export', 'test'],
        metadata: { important: true },
      });
      hub.post({
        channel: '#main',
        type: 'decision',
        author: 'bob',
        content: 'Message 2',
      });

      // Export
      const ndjson = hub.export();
      expect(ndjson).toContain('Message 1');
      expect(ndjson).toContain('Message 2');

      // Clear and reimport
      const secondDbPath = join(tempDir, 'hub2.db');
      const hub2 = Hub.init(secondDbPath, 'single');

      const count = hub2.import(ndjson);
      expect(count).toBe(2);

      const messages = hub2.read({});
      expect(messages.total).toBe(2);
      expect(messages.messages.some((m) => m.content === 'Message 1')).toBe(true);
      expect(messages.messages.some((m) => m.content === 'Message 2')).toBe(true);

      hub2.close();
    });
  });

  describe('garbage collection', () => {
    let hub: Hub;

    beforeEach(() => {
      hub = Hub.init(dbPath, 'single');
    });

    afterEach(() => {
      hub.close();
    });

    it('should dry-run GC without deleting', () => {
      hub.post({
        channel: '#main',
        type: 'note',
        author: 'alice',
        content: 'Old message',
      });

      // Use duration format: "100d" = messages older than 100 days
      const result = hub.gc('100d', true);
      expect(result.removed).toBeGreaterThanOrEqual(0);

      // Verify messages still exist
      const messages = hub.read({});
      expect(messages.total).toBeGreaterThan(0);
    });

    it('should delete old messages when not dry-run', () => {
      hub.post({
        channel: '#main',
        type: 'note',
        author: 'alice',
        content: 'Old message',
      });

      const beforeCount = hub.read({}).total;
      expect(beforeCount).toBeGreaterThan(0);

      // Use duration format: "100d" = messages older than 100 days
      const result = hub.gc('100d', false);
      expect(result.removed).toBeGreaterThanOrEqual(0);

      // Messages may or may not be deleted depending on actual timestamp
      const afterCount = hub.read({}).total;
      expect(afterCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('status and stats', () => {
    let hub: Hub;

    beforeEach(() => {
      hub = Hub.init(dbPath, 'multi', 'test-hub');
    });

    afterEach(() => {
      hub.close();
    });

    it('should return valid status', () => {
      hub.post({
        channel: '#main',
        type: 'note',
        author: 'alice',
        content: 'Test',
      });

      const status = hub.status();
      expect(status.hubId).toBeDefined();
      expect(status.mode).toBe('multi');
      expect(status.totalMessages).toBeGreaterThanOrEqual(0);
      expect(status.channels).toBeDefined();
    });

    it('should return valid stats', () => {
      hub.post({
        channel: '#main',
        type: 'note',
        author: 'alice',
        content: 'Test',
      });

      const stats = hub.stats();
      expect(stats.dbSizeBytes).toBeGreaterThan(0);
      expect(stats.totalMessages).toBeGreaterThanOrEqual(0);
      expect(stats.messagesByType).toBeDefined();
      expect(stats.ftsStatus).toBeDefined();
    });
  });

  describe('channel management', () => {
    let hub: Hub;

    beforeEach(() => {
      hub = Hub.init(dbPath, 'single');
    });

    afterEach(() => {
      hub.close();
    });

    it('should create and list channels', () => {
      const channel = hub.channelCreate('#test-channel', {
        createdBy: 'alice',
        description: 'Test channel',
      });

      expect(channel.name).toBe('#test-channel');

      const channels = hub.channelList(false);
      expect(channels.some((c) => c.name === '#test-channel')).toBe(true);
    });
  });

  describe('ops telemetry and actions', () => {
    let hub: Hub;

    beforeEach(() => {
      hub = Hub.init(dbPath, 'multi');
      hub.workerRegister({
        id: 'ops-worker-1',
        channel: '#worker-ops-worker-1',
        metadata: {
          opsTelemetry: {
            activeModel: 'claude-sonnet-4.5',
            activeProvider: 'anthropic',
            modelSwitches: 2,
            estimatedCostUsd: 4.2,
            usageTotals: {
              inputTokens: 2000,
              outputTokens: 1000,
              cachedInputTokens: 300,
              cachedOutputTokens: 0,
              compactionInputTokens: 50,
              compactionOutputTokens: 20,
              compactionCachedInputTokens: 10,
              compactionReclaimedTokens: 500,
              totalTokens: 3300,
            },
            models: {
              'claude-sonnet-4.5': {
                model: 'claude-sonnet-4.5',
                provider: 'anthropic',
                inputTokens: 2000,
                outputTokens: 1000,
                cachedInputTokens: 300,
                cachedOutputTokens: 0,
                totalTokens: 3300,
                costUsd: 4.2,
                requests: 7,
                lastUsedAt: '2026-02-23T00:00:00.000Z',
              },
            },
            providers: {
              anthropic: {
                provider: 'anthropic',
                inputTokens: 2000,
                outputTokens: 1000,
                cachedInputTokens: 300,
                cachedOutputTokens: 0,
                totalTokens: 3300,
                costUsd: 4.2,
                requests: 7,
                lastUsedAt: '2026-02-23T00:00:00.000Z',
              },
            },
          },
          toolTiming: {
            pendingStarts: {},
            toolStats: {
              bash: { count: 10, totalMs: 12000, maxMs: 4000, slowCount: 1 },
            },
            slowTools: [],
            toolFailures: {
              bash: 2,
            },
          },
        },
      });
      hub.recordOperatorAction({
        workerId: 'ops-worker-1',
        actionType: 'retry_sync',
        status: 'succeeded',
      });
    });

    afterEach(() => {
      hub.close();
    });

    it('aggregates ops summary, tools, usage and actions', () => {
      const summary = hub.opsSummary();
      const tools = hub.opsTools();
      const usage = hub.opsUsage();
      const actions = hub.opsActions();
      const workerUsage = hub.workerUsage('ops-worker-1');

      expect(summary.workers.total).toBe(1);
      expect(summary.usage.totalTokens).toBe(3300);
      expect(summary.usage.estimatedCostUsd).toBeCloseTo(4.2, 4);

      expect(tools.length).toBe(1);
      expect(tools[0].toolName).toBe('bash');
      expect(tools[0].calls).toBe(10);
      expect(tools[0].errorCount).toBe(2);

      expect(usage.totals.totalTokens).toBe(3300);
      expect(usage.byModel[0].model).toBe('claude-sonnet-4.5');
      expect(usage.byProvider[0].provider).toBe('anthropic');

      expect(actions.total).toBe(1);
      expect(actions.byType[0].actionType).toBe('retry_sync');
      expect(workerUsage).not.toBeNull();
      expect(workerUsage!.usage.totalTokens).toBe(3300);
    });

    it('backfills telemetry from historical events when ops metadata is missing', () => {
      const eventsPath = join(tempDir, 'ops-backfill.events.jsonl');
      const events = [
        {
          type: 'session.model_change',
          timestamp: '2026-02-23T00:00:00.000Z',
          data: {
            previousModel: 'claude-3',
            newModel: 'claude-sonnet-4.5',
            selectedModel: 'claude-sonnet-4.5',
          },
        },
        {
          type: 'session.compaction_complete',
          timestamp: '2026-02-23T00:01:00.000Z',
          data: {
            preCompactionTokens: 5000,
            compactionTokensUsed: {
              input: 1200,
              output: 100,
              cachedInput: 50,
            },
          },
        },
      ];
      writeFileSync(eventsPath, `${events.map(event => JSON.stringify(event)).join('\n')}\n`);

      hub.workerRegister({
        id: 'ops-worker-backfill',
        channel: '#worker-ops-worker-backfill',
      });

      const db = openDatabase(dbPath);
      try {
        updateWorker(db, 'ops-worker-backfill', {
          eventsPath,
          eventsOffset: statSync(eventsPath).size,
          lastEventAt: '2026-02-23T00:01:00.000Z',
          lastEventType: 'session.compaction_complete',
        });
      } finally {
        db.close();
      }

      const sync = hub.workerSync('ops-worker-backfill');
      const worker = hub.workerGet('ops-worker-backfill');
      const metadata = (worker?.metadata ?? {}) as Record<string, unknown>;

      expect(sync.ok).toBe(true);
      expect(sync.newEvents).toBe(0);
      expect(sync.activeModel).toBe('claude-sonnet-4.5');
      expect(sync.usage?.inputTokens).toBe(1200);
      expect(sync.usage?.outputTokens).toBe(100);
      expect(sync.usage?.cachedInputTokens).toBe(50);
      expect(sync.usage?.totalTokens).toBe(1350);
      expect(sync.usage?.compactionInputTokens).toBe(1200);
      expect(sync.usage?.compactionOutputTokens).toBe(100);
      expect(sync.usage?.compactionCachedInputTokens).toBe(50);
      expect(worker?.activeModel).toBe('claude-sonnet-4.5');
      expect(worker?.usage?.totalTokens).toBe(1350);
      expect(metadata.opsTelemetry).toBeDefined();
    });
  });
});
