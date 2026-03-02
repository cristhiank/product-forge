import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { DiscoveryResult } from './discovery.js';
import { AgentsProvider } from './providers/agents.js';
import { ProductProvider } from './providers/product.js';
import { BacklogProvider } from './providers/backlog.js';
import { SessionsProvider } from './providers/sessions.js';
import { registerEvents } from './events.js';

interface ServerOptions {
  port: number;
  verbose: boolean;
}

export async function createServer(discovery: DiscoveryResult, opts: ServerOptions) {
  const app = Fastify({
    logger: opts.verbose ? { level: 'info' } : false,
  });
  const agentsProvider = new AgentsProvider(discovery.repoRoot);

  // ===== JSON API Routes =====

  // --- Discovery API ---
  app.get('/api/discovery', async () => {
    return discovery;
  });

  // --- Product API ---
  if (discovery.hasProduct) {
    const productApi = new ProductProvider(discovery.repoRoot);

    app.get('/api/product', async (_req, reply) => {
      try {
        const [meta, health, featureOverview, docs] = await Promise.all([
          productApi.getMeta(),
          productApi.getHealth(),
          productApi.getFeatureOverview(),
          productApi.listDocs(),
        ]);
        return { meta, health, featureOverview, docs };
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });

    app.get('/api/product/features', async (_req, reply) => {
      try {
        const [featureOverview, features] = await Promise.all([
          productApi.getFeatureOverview(),
          productApi.listFeatures(),
        ]);
        return { featureOverview, features };
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });

    app.get<{ Params: { '*': string } }>('/api/product/doc/*', async (req, reply) => {
      try {
        const rawParam = req.params['*'] ?? '';
        const docPath = decodeURIComponent(rawParam).replace(/^\/+/, '');
        if (!docPath) {
          reply.code(400);
          return { error: 'Missing document path' };
        }
        const doc = await productApi.readDoc(docPath);
        return { doc };
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });

    app.get<{ Querystring: { q?: string } }>('/api/product/search', async (req, reply) => {
      try {
        const query = (req.query.q ?? '').trim();
        const results = query ? await productApi.searchDocs(query) : [];
        return { results };
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });
  }

  // --- Backlog API ---
  if (discovery.backlogs.length > 0) {
    // Build a provider per discovered backlog (keyed by relativePath)
    const backlogProviders = new Map<string, BacklogProvider>();
    for (const bl of discovery.backlogs) {
      const parentDir = bl.relativePath ? join(discovery.repoRoot, bl.relativePath) : discovery.repoRoot;
      backlogProviders.set(bl.relativePath, new BacklogProvider(parentDir));
    }
    const defaultKey = discovery.backlogs[0].relativePath;

    function resolveBacklog(backlogParam?: string): BacklogProvider {
      const key = (backlogParam === undefined || backlogParam === null) ? defaultKey : backlogParam;
      const provider = backlogProviders.get(key);
      if (!provider) throw new Error(`Backlog not found: ${backlogParam}`);
      return provider;
    }

    function countBacklogItems(backlogPath: string): number {
      let count = 0;
      for (const folder of ['next', 'working', 'done', 'archive']) {
        try {
          const files = readdirSync(join(backlogPath, folder));
          count += files.filter(f => f.endsWith('.md')).length;
        } catch { /* folder may not exist */ }
      }
      return count;
    }

    // List all discovered backlogs
    app.get('/api/backlogs', async () => {
      return discovery.backlogs.map(bl => ({
        id: bl.relativePath,
        name: bl.name,
        path: bl.path,
        relativePath: bl.relativePath,
        itemCount: countBacklogItems(bl.path),
      }));
    });

    app.get<{ Querystring: { backlog?: string } }>('/api/backlog/items', async (req, reply) => {
      try {
        return await resolveBacklog(req.query.backlog).listItems();
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });

    app.get<{ Params: { id: string }; Querystring: { backlog?: string } }>('/api/backlog/item/:id', async (req, reply) => {
      try {
        return await resolveBacklog(req.query.backlog).getItem(req.params.id);
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });

    app.get<{ Querystring: { backlog?: string } }>('/api/backlog/stats', async (req, reply) => {
      try {
        const api = resolveBacklog(req.query.backlog);
        const [stats, hygiene] = await Promise.all([
          api.getStats(),
          api.getHygiene(),
        ]);
        return { stats, hygiene };
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });

    app.get<{ Querystring: { q?: string; backlog?: string } }>('/api/backlog/search', async (req, reply) => {
      try {
        const query = (req.query.q ?? '').trim();
        const results = query ? await resolveBacklog(req.query.backlog).searchItems(query) : [];
        return results;
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });

    app.post<{ Body: { kind?: string; title?: string; priority?: string; description?: string }; Querystring: { backlog?: string } }>('/api/backlog/items', async (req, reply) => {
      try {
        const { kind, title, priority, description } = req.body ?? {};
        if (!kind || !title) {
          reply.code(400);
          return { error: 'kind and title are required' };
        }
        const item = resolveBacklog(req.query.backlog).createItem({ kind, title, priority, description });
        return item;
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });

    app.post<{ Params: { id: string }; Body: { to?: string }; Querystring: { backlog?: string } }>('/api/backlog/item/:id/move', async (req, reply) => {
      try {
        const destination = req.body?.to;
        if (destination !== 'next' && destination !== 'working' && destination !== 'done' && destination !== 'archive') {
          reply.code(400);
          return { error: 'Invalid destination folder. Must be one of: next, working, done, archive' };
        }
        const api = resolveBacklog(req.query.backlog);
        await api.moveItem(req.params.id, destination);
        const item = await api.getItem(req.params.id);
        return item;
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });
  }

  // --- Agents API ---
  if (discovery.hasAgents || discovery.hasWorkers) {
    const agentsApi = agentsProvider;

    app.get('/api/agents/workers', async (_req, reply) => {
      try {
        return await agentsApi.listAllWorkers();
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });

    app.get<{ Params: { id: string } }>('/api/agents/worker/:id', async (req, reply) => {
      try {
        const { id } = req.params;
        const fromList = (await agentsApi.listAllWorkers()).find(w => w.id === id) ?? null;
        const fromHub = (await agentsApi.getHubWorker(id)) ?? null;
        const worker = fromList
          ? { ...fromList, ...fromHub, id: fromList.id }
          : fromHub;

        if (!worker) {
          reply.code(404);
          return { error: `Worker ${id} not found` };
        }

        const log = agentsApi.getWorkerLog(id, 100);
        return { worker, log };
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });

    app.get('/api/agents/messages', async (_req, reply) => {
      try {
        return await agentsApi.listMessages({ limit: 500 });
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });

    app.get('/api/agents/costs', async (_req, reply) => {
      try {
        return await agentsApi.listAllWorkers();
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });

    app.get('/api/agents/incidents', async (_req, reply) => {
      try {
        const [workers, messages] = await Promise.all([
          agentsApi.listAllWorkers(),
          agentsApi.listMessages({ limit: 500 }),
        ]);
        return { workers, messages };
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });

    app.post<{ Params: { id: string } }>('/api/agents/worker/:id/sync', async (req, reply) => {
      try {
        await agentsApi.syncWorker(req.params.id);
        return { ok: true };
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });
  }

  // --- Health check ---
  app.get('/api/health', async () => {
    return {
      status: 'ok',
      systems: discovery.systems.map(s => ({ name: s.name, type: s.type })),
    };
  });

  app.get('/health', async () => {
    return { status: 'ok', uptime: process.uptime() };
  });

  // --- Sessions API ---
  if (discovery.hasSessions) {
    const sessionsApi = new SessionsProvider(discovery.sessionsPath);

    app.get('/api/sessions', async (_req, reply) => {
      try {
        return await sessionsApi.listSessions();
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });

    app.get<{ Params: { id: string } }>('/api/sessions/:id', async (req, reply) => {
      try {
        const session = await sessionsApi.getSession(req.params.id);
        if (!session) {
          reply.code(404);
          return { error: `Session ${req.params.id} not found` };
        }
        return session;
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });

    app.get<{ Params: { id: string } }>('/api/sessions/:id/timeline', async (req, reply) => {
      try {
        return await sessionsApi.getTimeline(req.params.id);
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });

    app.get<{ Params: { id: string }; Querystring: { type?: string } }>('/api/sessions/:id/events', async (req, reply) => {
      try {
        return await sessionsApi.getEvents(req.params.id, req.query.type);
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });
  }

  registerEvents(app, discovery);

  // --- SPA static serving (production) ---
  const prodClientDir = join(import.meta.dirname, 'client');
  const devClientDir = join(import.meta.dirname, '../client/dist');
  const clientDir = existsSync(prodClientDir) ? prodClientDir : devClientDir;
  if (existsSync(clientDir)) {
    await app.register(fastifyStatic, { root: clientDir, serve: false });
    app.setNotFoundHandler(async (req, reply) => {
      // Try to serve the static file; fall back to index.html for SPA routing
      const filePath = req.url.split('?')[0].replace(/^\/+/, '');
      const fullPath = join(clientDir, filePath);
      if (filePath && existsSync(fullPath) && !statSync(fullPath).isDirectory()) {
        return reply.sendFile(filePath);
      }
      return reply.sendFile('index.html');
    });
  }

  return app;
}
