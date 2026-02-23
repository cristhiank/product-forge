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
  overviewPage,
  timelinePage,
  statusPage,
  searchPage,
  threadView,
  workersPage,
  usagePage,
  toolsPage,
  incidentsPage,
  workerDetailPage,
  notFoundPage,
} from './renderer.js';
import { detectHealth } from '../core/reactor.js';
import { getTelemetryReader } from '../core/telemetry.js';

// ── SSE clients ──────────────────────────────────────────────

interface SseClient {
  res: http.ServerResponse;
  channel?: string; // undefined = all channels
}

const sseClients = new Map<http.ServerResponse, SseClient>();
const DEFAULT_WORKER_SYNC_INTERVAL_MS = 30_000;

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

function parseLimit(query: URLSearchParams, key: string, fallback: number, max: number): number {
  const raw = parseInt(query.get(key) || String(fallback), 10);
  if (!Number.isFinite(raw)) return fallback;
  return Math.min(Math.max(1, raw), max);
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
function startWorkerSyncPoller(hub: Hub, intervalMs: number): NodeJS.Timeout | null {
  if (intervalMs <= 0) return null;
  return setInterval(() => {
    try {
      const sync = hub.workerSyncAll();
      if (sync.length === 0) return;
      broadcastWorkerSync({
        type: 'worker_sync',
        timestamp: new Date().toISOString(),
        intervalMs,
        sync,
      });
    } catch (err) {
      console.error('Worker sync poller error:', err);
    }
  }, intervalMs);
}

// ── Server ───────────────────────────────────────────────────

export interface ServeOptions {
  port: number;
  hub: Hub;
  workerSyncIntervalMs?: number;
}

export async function startServer(opts: ServeOptions): Promise<void> {
  const {
    hub,
    port,
    workerSyncIntervalMs = DEFAULT_WORKER_SYNC_INTERVAL_MS,
  } = opts;

  // Start watching for new messages in background
  startMessageWatcher(hub);
  const workerSyncTimer = startWorkerSyncPoller(hub, workerSyncIntervalMs);

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

      if (pathname === '/api/ops/summary') {
        return sendJson(res, hub.opsSummary());
      }

      if (pathname === '/api/ops/tools') {
        return sendJson(res, { tools: hub.opsTools() });
      }

      if (pathname === '/api/ops/usage') {
        return sendJson(res, hub.opsUsage());
      }

      if (pathname === '/api/ops/actions') {
        const limit = parseLimit(query, 'limit', 100, 1000);
        return sendJson(res, hub.opsActions(limit));
      }

      const workerUsageMatch = pathname.match(/^\/api\/workers\/(.+)\/usage$/);
      if (workerUsageMatch) {
        const workerId = decodeURIComponent(workerUsageMatch[1]);
        const usage = hub.workerUsage(workerId);
        if (!usage) return sendJson(res, { error: 'Worker not found' }, 404);
        return sendJson(res, usage);
      }

      // ── JSON API for workers ──
      const workerApiMatch = pathname.match(/^\/api\/workers\/([^/]+)$/);
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
          const requestedAt = new Date().toISOString();
          const worker = hub.workerGet(workerId);
          if (!worker) {
            hub.recordOperatorAction({
              workerId,
              actionType: 'stop_worker',
              status: 'failed',
              requestedAt,
              completedAt: new Date().toISOString(),
              error: `Worker not found: ${workerId}`,
            });
            return sendJson(res, { error: `Worker not found: ${workerId}` }, 404);
          }
          if (worker.pid === null || worker.status !== 'active') {
            hub.recordOperatorAction({
              workerId,
              actionType: 'stop_worker',
              status: 'failed',
              requestedAt,
              completedAt: new Date().toISOString(),
              error: 'Stop action requires an active worker with a PID',
            });
            return sendJson(res, { error: 'Stop action requires an active worker with a PID' }, 409);
          }
          process.kill(worker.pid, 'SIGTERM');
          const syncResult = hub.workerSync(workerId);
          hub.recordOperatorAction({
            workerId,
            actionType: 'stop_worker',
            status: 'succeeded',
            requestedAt,
            completedAt: new Date().toISOString(),
            metadata: {
              redirect: redirectPath,
              syncStatus: syncResult.syncStatus,
              workerStatus: syncResult.status,
            },
          });
          return sendRedirect(res, redirectPath);
        }

        const syncMatch = pathname.match(/^\/workers\/(.+)\/sync$/);
        if (syncMatch) {
          const workerId = decodeURIComponent(syncMatch[1]);
          const requestedAt = new Date().toISOString();
          const worker = hub.workerGet(workerId);
          if (!worker) {
            hub.recordOperatorAction({
              workerId,
              actionType: 'retry_sync',
              status: 'failed',
              requestedAt,
              completedAt: new Date().toISOString(),
              error: `Worker not found: ${workerId}`,
            });
            return sendJson(res, { error: `Worker not found: ${workerId}` }, 404);
          }
          const syncResult = hub.workerSync(workerId);
          hub.recordOperatorAction({
            workerId,
            actionType: 'retry_sync',
            status: syncResult.ok ? 'succeeded' : 'failed',
            requestedAt,
            completedAt: new Date().toISOString(),
            error: syncResult.ok ? null : syncResult.error,
            metadata: {
              redirect: redirectPath,
              syncStatus: syncResult.syncStatus,
              workerStatus: syncResult.status,
              newEvents: syncResult.newEvents,
            },
          });
          return sendRedirect(res, redirectPath);
        }
      }

      // Refresh channel list for each request
      const currentChannels = hub.channelList(true) as ChannelInfo[];

      // ── Ops overview (root) ──
      if (pathname === '/') {
        const summary = hub.opsSummary();
        const usage = hub.opsUsage();
        const tools = hub.opsTools();
        const actions = hub.opsActions(100);
        const html = layout({
          title: 'Overview',
          channels: currentChannels,
          activePage: 'overview',
          body: overviewPage(summary, usage, tools, actions),
        });
        return sendHtml(res, html);
      }

      // ── Timeline page ──
      if (pathname === '/timeline') {
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

      // ── Usage page ──
      if (pathname === '/usage') {
        const html = layout({
          title: 'Usage',
          channels: currentChannels,
          activePage: 'usage',
          body: usagePage(hub.opsUsage()),
        });
        return sendHtml(res, html);
      }

      // ── Tools page ──
      if (pathname === '/tools') {
        const html = layout({
          title: 'Tools',
          channels: currentChannels,
          activePage: 'tools',
          body: toolsPage(hub.opsTools()),
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
        const actionHistory = hub.listOperatorActions({ workerId, limit: 50 });
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
            sync,
            actionHistory,
          ),
        });
        return sendHtml(res, html);
      }

      // ── Worker events API ──
      const apiEventsMatch = pathname.match(/^\/api\/workers\/(.+)\/events$/);
      if (apiEventsMatch) {
        const workerId = decodeURIComponent(apiEventsMatch[1]);
        const worker = hub.workerGet(workerId);
        
        if (!worker || !worker.eventsPath) {
          return sendJson(res, { error: 'Worker not found or no events path' }, 404);
        }
        
        // Resolve telemetry reader from worker telemetry source path.
        const reader = getTelemetryReader(worker.eventsPath);
        if (!reader) {
          return sendJson(res, { 
            error: `Unsupported telemetry source: ${worker.eventsPath}` 
          }, 400);
        }
        
        // Parse query params
        const rawLimit = parseInt(query.get('limit') || '500', 10);
        const limit = Math.min(Math.max(1, rawLimit), 500);
        const cursor = query.get('cursor') || null;
        const view = query.get('view') === 'conversation' ? 'conversation' : 'raw';
        
        // Read events with pagination
        const result = reader.readEvents(worker.eventsPath, cursor, limit);
        
        // If conversation view, transform events
        let response: Record<string, unknown> = {
          workerId,
          view,
          ...result,
        };
        
        if (view === 'conversation' && !result.error) {
          const conversationItems = reader.toConversation(result.events);
          response = {
            ...response,
            conversationItems,
          };
        }
        
        return sendJson(res, response);
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
          activePage: 'overview',
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
    if (workerSyncTimer) clearInterval(workerSyncTimer);
  });
}
