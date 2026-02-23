import { describe, it, expect } from 'vitest';
import type { ChannelInfo, Message } from '../../src/core/types.js';
import { incidentsPage, layout, type WorkerWithHealth } from '../../src/serve/renderer.js';

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

describe('renderer incidents', () => {
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
});
