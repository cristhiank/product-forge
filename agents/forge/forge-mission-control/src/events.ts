import { watch } from 'chokidar';
import type { FastifyInstance } from 'fastify';
import { join } from 'node:path';
import type { DiscoveryResult } from './discovery.js';

type EventSender = (event: string, data: unknown) => void;

export function registerEvents(app: FastifyInstance, discovery: DiscoveryResult): void {
  const clients = new Set<EventSender>();

  app.get('/events', async (req, reply) => {
    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    reply.raw.on('error', () => { /* swallow stream errors */ });

    const send: EventSender = (event, data) => {
      try {
        if (!reply.raw.destroyed) {
          reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        }
      } catch {
        clients.delete(send);
      }
    };

    clients.add(send);
    send('connected', { systems: discovery.systems.map(s => s.type) });

    req.raw.on('close', () => {
      clients.delete(send);
    });

    req.raw.on('error', () => {
      clients.delete(send);
    });
  });

  const broadcast = (event: string, data: unknown) => {
    for (const send of clients) {
      try {
        send(event, data);
      } catch {
        clients.delete(send);
      }
    }
  };

  const watchDirectory = (directory: string, eventName: string, depth: number) => {
    const watcher = watch(directory, { ignoreInitial: true, depth });
    watcher.on('all', (eventType, filePath) => {
      broadcast(eventName, {
        type: eventType,
        path: filePath.replace(`${discovery.repoRoot}/`, ''),
      });
    });
  };

  if (discovery.hasProduct) {
    watchDirectory(join(discovery.repoRoot, '.product'), 'product_change', 3);
  }

  if (discovery.hasBacklog) {
    watchDirectory(join(discovery.repoRoot, '.backlog'), 'backlog_change', 3);
  }

  if (discovery.hasWorkers) {
    watchDirectory(join(discovery.repoRoot, '.copilot-workers'), 'worker_update', 2);
  }
}
