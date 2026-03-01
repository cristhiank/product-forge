import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { DiscoveryResult } from './discovery.js';
import { AgentsProvider } from './providers/agents.js';
import { ProductProvider } from './providers/product.js';
import { BacklogProvider } from './providers/backlog.js';
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
  if (discovery.hasBacklog) {
    const backlogApi = new BacklogProvider(discovery.repoRoot);

    app.get('/api/backlog/items', async (_req, reply) => {
      try {
        return await backlogApi.listItems();
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });

    app.get<{ Params: { id: string } }>('/api/backlog/item/:id', async (req, reply) => {
      try {
        return await backlogApi.getItem(req.params.id);
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });

    app.get('/api/backlog/stats', async (_req, reply) => {
      try {
        const [stats, hygiene] = await Promise.all([
          backlogApi.getStats(),
          backlogApi.getHygiene(),
        ]);
        return { stats, hygiene };
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });

    app.get<{ Querystring: { q?: string } }>('/api/backlog/search', async (req, reply) => {
      try {
        const query = (req.query.q ?? '').trim();
        const results = query ? await backlogApi.searchItems(query) : [];
        return results;
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });

    app.post<{ Body: { kind?: string; title?: string; priority?: string; description?: string } }>('/api/backlog/items', async (req, reply) => {
      try {
        const { kind, title, priority, description } = req.body ?? {};
        if (!kind || !title) {
          reply.code(400);
          return { error: 'kind and title are required' };
        }
        const item = backlogApi.createItem({ kind, title, priority, description });
        return item;
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });

    app.post<{ Params: { id: string }; Body: { to?: string } }>('/api/backlog/item/:id/move', async (req, reply) => {
      try {
        const destination = req.body?.to;
        if (destination !== 'next' && destination !== 'working' && destination !== 'done' && destination !== 'archive') {
          reply.code(400);
          return { error: 'Invalid destination folder. Must be one of: next, working, done, archive' };
        }
        await backlogApi.moveItem(req.params.id, destination);
        const item = await backlogApi.getItem(req.params.id);
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
