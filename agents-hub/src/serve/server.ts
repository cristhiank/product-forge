/**
 * Lightweight HTTP server for the agents-hub dashboard.
 * Uses node:http (zero deps), SSE for real-time message streaming.
 */

import * as http from 'node:http';
import type { Hub } from '../hub.js';
import type { ChannelInfo } from '../core/types.js';
import { CSS } from './styles.js';
import {
  layout,
  timelinePage,
  statusPage,
  searchPage,
  threadView,
  workersPage,
  incidentsPage,
  workerDetailPage,
  notFoundPage,
} from './renderer.js';
import { detectHealth } from '../core/reactor.js';

// ── SSE clients ──────────────────────────────────────────────

interface SseClient {
  res: http.ServerResponse;
  channel?: string; // undefined = all channels
}

const sseClients = new Map<http.ServerResponse, SseClient>();
const WORKER_SYNC_INTERVAL_MS = 30_000;

/**
 * Broadcast a new message to connected SSE clients (filtered by channel)
 */
function broadcastMessage(msg: unknown): void {
  const msgObj = msg as Record<string, unknown>;
  const data = JSON.stringify(msg);
  for (const [res, client] of Array.from(sseClients)) {
    if (client.channel && msgObj.channel && msgObj.channel !== client.channel) continue;
    try {
      res.write(`event: message\ndata: ${data}\n\n`);
    } catch {
      sseClients.delete(res);
    }
  }
}

/**
 * Broadcast worker sync updates to all SSE clients
 */
function broadcastWorkerSync(sync: unknown): void {
  const data = JSON.stringify(sync);
  for (const [res] of Array.from(sseClients)) {
    try {
      res.write(`event: worker_sync\ndata: ${data}\n\n`);
    } catch {
      sseClients.delete(res);
    }
  }
}

// ── Route helpers ────────────────────────────────────────────

function sendHtml(res: http.ServerResponse, html: string, status = 200): void {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function sendJson(res: http.ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function sendRedirect(res: http.ServerResponse, location: string, status = 303): void {
  res.writeHead(status, { Location: location });
  res.end();
}

function sendCss(res: http.ServerResponse): void {
  res.writeHead(200, {
    'Content-Type': 'text/css; charset=utf-8',
    'Cache-Control': 'public, max-age=60',
  });
  res.end(CSS);
}

function parseUrl(url: string): { pathname: string; query: URLSearchParams } {
  const idx = url.indexOf('?');
  const pathname = idx >= 0 ? url.slice(0, idx) : url;
  const query = new URLSearchParams(idx >= 0 ? url.slice(idx + 1) : '');
  return { pathname, query };
}

function workerIncidentTimestamp(worker: { lastEventAt: string | null; completedAt: string | null; registeredAt: string }): number {
  const iso = worker.lastEventAt ?? worker.completedAt ?? worker.registeredAt;
  return new Date(iso).getTime();
}

function sortNewestFirst<T extends { createdAt: string }>(items: T[]): T[] {
  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function sanitizeRedirectPath(path: string | null): string {
  if (!path || !path.startsWith('/')) return '/incidents';
  return path;
}

// ── Background watcher ───────────────────────────────────────

/**
 * Start background task to watch for new messages and broadcast via SSE
 */
function startMessageWatcher(hub: Hub): void {
  (async () => {
    try {
      // Watch all channels, no timeout (watch forever)
      for await (const msg of hub.watch({ timeout: 0 })) {
        broadcastMessage(msg);
      }
    } catch (err) {
      console.error('Message watcher error:', err);
      // Restart watcher after brief delay
      setTimeout(() => startMessageWatcher(hub), 5000);
    }
  })();
}

/**
 * Start periodic worker sync and broadcast updates via SSE
 */
function startWorkerSyncPoller(hub: Hub): NodeJS.Timeout {
  return setInterval(() => {
    try {
      const sync = hub.workerSyncAll();
      if (sync.length === 0) return;
      broadcastWorkerSync({
        type: 'worker_sync',
        timestamp: new Date().toISOString(),
        sync,
      });
    } catch (err) {
      console.error('Worker sync poller error:', err);
    }
  }, WORKER_SYNC_INTERVAL_MS);
}

// ── Server ───────────────────────────────────────────────────

export interface ServeOptions {
  port: number;
  hub: Hub;
}

export async function startServer(opts: ServeOptions): Promise<void> {
  const { hub, port } = opts;

  // Start watching for new messages in background
  startMessageWatcher(hub);
  const workerSyncTimer = startWorkerSyncPoller(hub);

  const server = http.createServer(async (req, res) => {
    try {
      const { pathname, query } = parseUrl(req.url || '/');

      // ── Static ──
      if (pathname === '/styles.css') return sendCss(res);

      // ── SSE endpoint ──
      if (pathname === '/events') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });
        res.write(':\n\n'); // comment to keep connection open
        const channelParam = query.get('channel');
        const sseChannel = channelParam ? `#${channelParam}` : undefined;
        sseClients.set(res, { res, channel: sseChannel });
        req.on('close', () => sseClients.delete(res));
        return;
      }

      // ── JSON API for initial messages ──
      if (pathname === '/api/messages') {
        const channel = query.get('channel') || undefined;
        const limit = parseInt(query.get('limit') || '50', 10);
        const offset = parseInt(query.get('offset') || '0', 10);

        const result = hub.read({
          channel: channel ? `#${channel}` : undefined,
          limit,
          offset,
        });

        return sendJson(res, result);
      }

      // ── JSON API for workers ──
      const workerApiMatch = pathname.match(/^\/api\/workers\/(.+)$/);
      if (workerApiMatch) {
        const workerId = decodeURIComponent(workerApiMatch[1]);
        const sync = hub.workerSync(workerId);
        const worker = hub.workerGet(workerId);
        if (!worker) return sendJson(res, { error: 'Worker not found' }, 404);

        const messages = hub.read({ workerId, limit: 100 }).messages;
        return sendJson(res, {
          worker: {
            ...worker,
            health: detectHealth(worker.lastEventAt),
          },
          sync,
          messages,
        });
      }

      if (pathname === '/api/workers') {
        const workers = hub.workerList().map(w => ({
          ...w,
          health: detectHealth(w.lastEventAt),
        }));
        return sendJson(res, { workers });
      }

      if (pathname === '/api/incidents') {
        const workers = hub.workerList()
          .map(w => ({ ...w, health: detectHealth(w.lastEventAt) }))
          .filter(w => w.health !== 'healthy' || w.status === 'failed' || w.status === 'lost' || w.errors > 0)
          .sort((a, b) => workerIncidentTimestamp(b) - workerIncidentTimestamp(a) || b.errors - a.errors || a.id.localeCompare(b.id));
        const unresolvedRequests = sortNewestFirst(hub.read({ type: 'request', unresolved: true, limit: 200 }).messages);
        return sendJson(res, { workers, unresolvedRequests });
      }

      if (req.method === 'POST') {
        const redirectPath = sanitizeRedirectPath(query.get('redirect'));
        const stopMatch = pathname.match(/^\/workers\/(.+)\/stop$/);
        if (stopMatch) {
          const workerId = decodeURIComponent(stopMatch[1]);
          const worker = hub.workerGet(workerId);
          if (!worker) return sendJson(res, { error: `Worker not found: ${workerId}` }, 404);
          if (worker.pid === null || worker.status !== 'active') {
            return sendJson(res, { error: 'Stop action requires an active worker with a PID' }, 409);
          }
          process.kill(worker.pid, 'SIGTERM');
          hub.workerSync(workerId);
          return sendRedirect(res, redirectPath);
        }

        const syncMatch = pathname.match(/^\/workers\/(.+)\/sync$/);
        if (syncMatch) {
          const workerId = decodeURIComponent(syncMatch[1]);
          const worker = hub.workerGet(workerId);
          if (!worker) return sendJson(res, { error: `Worker not found: ${workerId}` }, 404);
          hub.workerSync(workerId);
          return sendRedirect(res, redirectPath);
        }
      }

      // Refresh channel list for each request
      const currentChannels = hub.channelList(true) as ChannelInfo[];

      // ── Timeline (root) ──
      if (pathname === '/') {
        const messages = hub.read({ limit: 100 }).messages;
        const html = layout({
          title: 'Timeline',
          channels: currentChannels,
          activePage: 'timeline',
          body: timelinePage(messages),
        });
        return sendHtml(res, html);
      }

      // ── Timeline per channel ──
      const channelMatch = pathname.match(/^\/channel\/(.+)$/);
      if (channelMatch) {
        const channelName = decodeURIComponent(channelMatch[1]);
        const fullChannelName = `#${channelName}`;

        const messages = hub.read({ channel: fullChannelName, limit: 100 }).messages;
        const html = layout({
          title: fullChannelName,
          channels: currentChannels,
          currentChannel: fullChannelName,
          activePage: 'timeline',
          body: timelinePage(messages, channelName),
        });
        return sendHtml(res, html);
      }

      // ── Status page ──
      if (pathname === '/status') {
        const status = hub.status();
        const workers = hub.workerList();
        const workerSummary = { active: 0, stale: 0, lost: 0, failed: 0 };
        for (const worker of workers) {
          const health = detectHealth(worker.lastEventAt);
          if (worker.status === 'active') workerSummary.active += 1;
          if (health === 'stale') workerSummary.stale += 1;
          if (health === 'lost') workerSummary.lost += 1;
          if (worker.status === 'failed') workerSummary.failed += 1;
        }
        const html = layout({
          title: 'Status',
          channels: currentChannels,
          activePage: 'status',
          body: statusPage(status, workerSummary),
        });
        return sendHtml(res, html);
      }

      // ── Search ──
      if (pathname === '/search') {
        const q = query.get('q') || '';
        const results = q ? hub.search(q, { limit: 50 }) : [];
        const html = layout({
          title: q ? `Search: ${q}` : 'Search',
          channels: currentChannels,
          activePage: 'search',
          body: searchPage(results, q),
        });
        return sendHtml(res, html);
      }

      // ── Workers page ──
      if (pathname === '/workers') {
        const workers = hub.workerList().map(w => ({
          ...w,
          health: detectHealth(w.lastEventAt),
        }));
        const html = layout({
          title: 'Workers',
          channels: currentChannels,
          activePage: 'workers',
          body: workersPage(workers),
        });
        return sendHtml(res, html);
      }

      // ── Incidents page ──
      if (pathname === '/incidents') {
        const workers = hub.workerList()
          .map(w => ({ ...w, health: detectHealth(w.lastEventAt) }))
          .sort((a, b) => workerIncidentTimestamp(b) - workerIncidentTimestamp(a) || b.errors - a.errors || a.id.localeCompare(b.id));
        const unresolvedRequests = sortNewestFirst(hub.read({ type: 'request', unresolved: true, limit: 200 }).messages);
        const html = layout({
          title: 'Incidents',
          channels: currentChannels,
          activePage: 'incidents',
          body: incidentsPage(workers, unresolvedRequests),
        });
        return sendHtml(res, html);
      }

      // ── Worker detail page ──
      const workerMatch = pathname.match(/^\/worker\/(.+)$/);
      if (workerMatch) {
        const workerId = decodeURIComponent(workerMatch[1]);
        const sync = hub.workerSync(workerId);
        const worker = hub.workerGet(workerId);
        if (!worker) {
          return sendHtml(
            res,
            layout({
              title: 'Not Found',
              channels: currentChannels,
              activePage: 'workers',
              body: notFoundPage(),
            }),
            404
          );
        }

        const messages = hub.read({ workerId, limit: 100 }).messages;
        const html = layout({
          title: `Worker ${workerId}`,
          channels: currentChannels,
          activePage: 'workers',
          body: workerDetailPage(
            {
              ...worker,
              health: detectHealth(worker.lastEventAt),
            },
            messages,
            sync
          ),
        });
        return sendHtml(res, html);
      }

      // ── Thread view ──
      const threadMatch = pathname.match(/^\/thread\/(.+)$/);
      if (threadMatch) {
        const messageId = decodeURIComponent(threadMatch[1]);
        try {
          const thread = hub.readThread(messageId);
          if (thread.length === 0) {
            return sendHtml(
              res,
              layout({
                title: 'Not Found',
                channels: currentChannels,
                activePage: 'thread',
                body: notFoundPage(),
              }),
              404
            );
          }
          const parent = thread[0];
          const replies = thread.slice(1);
          const html = layout({
            title: 'Thread',
            channels: currentChannels,
            activePage: 'thread',
            body: threadView(parent, replies),
          });
          return sendHtml(res, html);
        } catch {
          return sendHtml(
            res,
            layout({
              title: 'Not Found',
              channels: currentChannels,
              activePage: 'thread',
              body: notFoundPage(),
            }),
            404
          );
        }
      }

      // ── 404 ──
      sendHtml(
        res,
        layout({
          title: 'Not Found',
          channels: currentChannels,
          activePage: 'timeline',
          body: notFoundPage(),
        }),
        404
      );
    } catch (err) {
      console.error('Request error:', err);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    }
  });

  server.listen(port, () => {
    const status = hub.status();
    console.log(`\n🚀 Agents Hub dashboard running at http://localhost:${port}`);
    console.log(`   Hub ID: ${status.hubId}`);
    console.log(`   Mode: ${status.mode}`);
    console.log(`   Channels: ${Object.keys(status.channels).join(', ')}`);
    console.log(`   Total messages: ${status.totalMessages}\n`);
  });

  server.on('close', () => {
    clearInterval(workerSyncTimer);
  });
}
