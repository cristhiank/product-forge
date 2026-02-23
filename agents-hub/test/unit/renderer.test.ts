import { describe, it, expect } from 'vitest';
import type { Message } from '../../src/core/types.js';
import { renderMessage } from '../../src/serve/renderer.js';

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
