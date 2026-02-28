import { describe, it, expect } from 'vitest';
import type { ChannelInfo, Message } from '../../src/core/types.js';
import {
  incidentsPage,
  layout,
  overviewPage,
  renderMessage,
  toolsPage,
  usagePage,
  workersPage,
  type WorkerWithHealth,
} from '../../src/serve/renderer.js';

function makeMessage(workerId: string | null): Message {
  return {
    id: 'm1',
    channel: '#worker-b031',
    type: 'status',
    author: 'orchestrator',
    content: 'Progress update',
    tags: [],
    threadId: null,
    metadata: {},
    workerId,
    createdAt: '2026-02-23T00:00:00.000Z',
    updatedAt: null,
  };
}

function makeWorker(overrides: Partial<WorkerWithHealth>): WorkerWithHealth {
  return {
    id: 'worker-default',
    sessionId: null,
    channel: '#worker-default',
    agentType: 'Executor',
    agentName: null,
    worktreePath: null,
    eventsPath: null,
    pid: 123,
    status: 'active',
    exitCode: null,
    lastEventAt: '2026-02-23T00:00:00.000Z',
    lastEventType: 'assistant.turn_end',
    eventsOffset: 0,
    toolCalls: 0,
    turns: 0,
    errors: 0,
    registeredAt: '2026-02-23T00:00:00.000Z',
    completedAt: null,
    metadata: {},
    health: 'healthy',
    ...overrides,
  };
}

function makeRequest(overrides: Partial<Message>): Message {
  return {
    id: 'req-default',
    channel: '#general',
    type: 'request',
    author: 'executor',
    content: 'Request details',
    tags: [],
    threadId: null,
    metadata: { severity: 'major', resolved: false },
    workerId: null,
    createdAt: '2026-02-23T00:00:00.000Z',
    updatedAt: null,
    ...overrides,
  };
}

describe('renderMessage', () => {
  it('renders worker attribution badge with worker link and deterministic hue', () => {
    const first = renderMessage(makeMessage('worker-b031'));
    const second = renderMessage(makeMessage('worker-b031'));

    expect(first).toContain('class="worker-attribution-badge"');
    expect(first).toContain('href="/worker/worker-b031"');
    expect(first).toContain('>worker-b031<');

    const hue1 = first.match(/--worker-hue:(\d+)/)?.[1];
    const hue2 = second.match(/--worker-hue:(\d+)/)?.[1];
    expect(hue1).toBeDefined();
    expect(hue2).toBe(hue1);
  });

  it('does not render worker attribution badge when workerId is absent', () => {
    const html = renderMessage(makeMessage(null));
    expect(html).not.toContain('worker-attribution-badge');
  });
});

describe('renderer incidents', () => {
  it('shows overview/usage/tools nav entries', () => {
    const channels: ChannelInfo[] = [{
      name: '#main',
      createdAt: '2026-02-23T00:00:00.000Z',
      createdBy: 'system',
      description: null,
      workerId: null,
      messageCount: 1,
      lastActivity: '2026-02-23T00:00:00.000Z',
    }];

    const html = layout({
      title: 'Overview',
      channels,
      activePage: 'overview',
      body: '<div>content</div>',
    });

    expect(html).toContain('href="/" class="active">🎛️ Overview');
    expect(html).toContain('href="/usage"');
    expect(html).toContain('href="/tools"');
    expect(html).toContain('href="/timeline"');
  });

  it('shows incidents nav entry as active', () => {
    const channels: ChannelInfo[] = [{
      name: '#main',
      createdAt: '2026-02-23T00:00:00.000Z',
      createdBy: 'system',
      description: null,
      workerId: null,
      messageCount: 1,
      lastActivity: '2026-02-23T00:00:00.000Z',
    }];

    const html = layout({
      title: 'Incidents',
      channels,
      activePage: 'incidents',
      body: '<div>content</div>',
    });

    expect(html).toContain('href="/incidents" class="active"');
  });

  it('renders newest-first incidents with quick actions', () => {
    const workers: WorkerWithHealth[] = [
      makeWorker({
        id: 'worker-old',
        health: 'stale',
        lastEventAt: '2026-02-23T00:01:00.000Z',
        errors: 1,
      }),
      makeWorker({
        id: 'worker-new',
        health: 'lost',
        status: 'failed',
        lastEventAt: '2026-02-23T00:05:00.000Z',
        errors: 3,
      }),
    ];

    const requests: Message[] = [
      makeRequest({
        id: 'req-old',
        content: 'Old request content',
        createdAt: '2026-02-23T00:02:00.000Z',
      }),
      makeRequest({
        id: 'req-new',
        content: 'Newest request content',
        createdAt: '2026-02-23T00:06:00.000Z',
      }),
    ];

    const html = incidentsPage(workers, requests);

    expect(html).toContain('/workers/worker-new/sync?redirect=%2Fincidents');
    expect(html).toContain('/workers/worker-new/stop?redirect=%2Fincidents');
    expect(html).toContain('/worker/worker-new');
    expect(html.indexOf('worker-new')).toBeLessThan(html.indexOf('worker-old'));
    expect(html.indexOf('Newest request content')).toBeLessThan(html.indexOf('Old request content'));
    expect(html).toContain('Error Clusters');
  });

  it('renders workers table with model and usage columns', () => {
    const html = workersPage([
      makeWorker({
        id: 'worker-cost',
        activeModel: 'claude-sonnet-4.5',
        estimatedCostUsd: 12.34,
        usage: {
          inputTokens: 4000,
          outputTokens: 1500,
          cachedInputTokens: 600,
          cachedOutputTokens: 0,
          compactionInputTokens: 0,
          compactionOutputTokens: 0,
          compactionCachedInputTokens: 0,
          compactionReclaimedTokens: 0,
          totalTokens: 6100,
        },
      }),
    ]);
    expect(html).toContain('Model');
    expect(html).toContain('Tokens (In/Out)');
    expect(html).toContain('Cost');
    expect(html).toContain('claude-sonnet-4.5');
    expect(html).toContain('$12.34');
  });

  it('renders overview/usage/tools pages', () => {
    const summary = {
      generatedAt: '2026-02-23T00:00:00.000Z',
      workers: { total: 1, active: 1, healthy: 1, stale: 0, lost: 0, failed: 0, completed: 0 },
      throughput: { turns: 10, toolCalls: 20, errors: 1, toolErrorRate: 0.05 },
      usage: {
        inputTokens: 1000,
        outputTokens: 500,
        cachedInputTokens: 100,
        cachedOutputTokens: 0,
        compactionInputTokens: 50,
        compactionOutputTokens: 10,
        compactionCachedInputTokens: 5,
        compactionReclaimedTokens: 200,
        totalTokens: 1600,
        estimatedCostUsd: 1.23,
        burnRateUsdPerHour: 0.45,
      },
      incidents: { workerIncidents: 0, unresolvedRequests: 0 },
      modelDistribution: [],
      providerDistribution: [],
    };
    const usage = {
      generatedAt: '2026-02-23T00:00:00.000Z',
      totals: summary.usage,
      byModel: [],
      byProvider: [],
      topWorkers: [],
    };
    const actions = {
      generatedAt: '2026-02-23T00:00:00.000Z',
      total: 0,
      successRate: 1,
      byType: [],
      actions: [],
    };
    const tools = [];

    expect(overviewPage(summary, usage, tools, actions)).toContain('Ops Overview');
    expect(usagePage(usage)).toContain('Usage & Cost');
    expect(toolsPage(tools)).toContain('Tool Reliability');
  });
});
