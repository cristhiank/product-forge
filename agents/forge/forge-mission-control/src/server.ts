import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { DiscoveryResult } from './discovery.js';
import { renderHome, layout, renderNav } from './render/layout.js';
import { getStyles } from './render/styles.js';
import { AgentsProvider } from './providers/agents.js';
import {
  renderAgentWorkerDetail,
  renderAgentsCosts,
  renderAgentsIncidents,
  renderAgentsMessages,
  renderAgentsOverview,
} from './render/agents-views.js';
import { escapeHtml } from './render/markdown.js';
import { ProductProvider } from './providers/product.js';
import {
  renderProductDoc,
  renderProductFeatures,
  renderProductOverview,
  renderProductSearch,
} from './render/product-views.js';
import { BacklogProvider } from './providers/backlog.js';
import {
  renderBacklogBoard,
  renderBacklogItem,
  renderBacklogSearch,
  renderBacklogStats,
} from './render/backlog-views.js';
import { registerEvents } from './events.js';
import { pageHeader, emptyState } from './render/components.js';

interface ServerOptions {
  port: number;
  verbose: boolean;
}

function renderErrorPage(discovery: DiscoveryResult, title: string, message: string): string {
  const nav = renderNav(discovery, { activeMode: '' });
  const content = `
    ${pageHeader('⚠️ ' + title)}
    ${emptyState(message, 'Try navigating back or refreshing the page.')}
  `;
  return layout(discovery, nav, content);
}

export async function createServer(discovery: DiscoveryResult, opts: ServerOptions) {
  const app = Fastify({
    logger: opts.verbose ? { level: 'info' } : false,
  });
  const agentsProvider = new AgentsProvider(discovery.repoRoot);

  // --- Home ---
  app.get('/', async (_req, reply) => {
    reply.type('text/html').send(renderHome(discovery));
  });

  // --- Product Mode ---
  if (discovery.hasProduct) {
    const productProvider = new ProductProvider(discovery.repoRoot);

    app.get('/product', async (_req, reply) => {
      try {
        const meta = await productProvider.getMeta();
        const health = await productProvider.getHealth();
        const featureOverview = await productProvider.getFeatureOverview();
        const docs = await productProvider.listDocs();
        reply.type('text/html').send(
          renderProductOverview(discovery, meta, health, featureOverview, docs),
        );
      } catch (err) {
        reply.code(500).type('text/html').send(
          renderErrorPage(discovery, 'Product Error', String(err instanceof Error ? err.message : err)),
        );
      }
    });

    app.get<{ Params: { '*': string } }>('/product/doc/*', async (req, reply) => {
      try {
        const rawParam = req.params['*'] ?? '';
        const docPath = decodeURIComponent(rawParam).replace(/^\/+/, '');
        if (!docPath) {
          reply.code(400).type('text/html').send(
            renderErrorPage(discovery, 'Missing document path', 'No document path specified.'),
          );
          return;
        }
        const doc = await productProvider.readDoc(docPath);
        reply.type('text/html').send(renderProductDoc(discovery, doc));
      } catch (err) {
        reply.code(500).type('text/html').send(
          renderErrorPage(discovery, 'Document Error', String(err instanceof Error ? err.message : err)),
        );
      }
    });

    app.get('/product/features', async (_req, reply) => {
      try {
        const featureOverview = await productProvider.getFeatureOverview();
        const features = await productProvider.listFeatures();
        reply.type('text/html').send(renderProductFeatures(discovery, featureOverview, features));
      } catch (err) {
        reply.code(500).type('text/html').send(
          renderErrorPage(discovery, 'Features Error', String(err instanceof Error ? err.message : err)),
        );
      }
    });

    app.get<{ Querystring: { q?: string } }>('/product/search', async (req, reply) => {
      const query = (req.query.q ?? '').trim();
      const results = query ? await productProvider.searchDocs(query) : [];
      reply.type('text/html').send(renderProductSearch(discovery, query, results));
    });
  }

  // --- Backlog Mode ---
  if (discovery.hasBacklog) {
    const provider = new BacklogProvider(discovery.repoRoot);

    app.get('/backlog', async (_req, reply) => {
      try {
        const items = await provider.listItems();
        const content = renderBacklogBoard(discovery, items);
        reply.type('text/html').send(layout(discovery, renderNav(discovery, { activeMode: 'backlog', activeSubItem: 'board' }), content));
      } catch (err) {
        reply.code(500).type('text/html').send(
          renderErrorPage(discovery, 'Backlog Error', String(err instanceof Error ? err.message : err)),
        );
      }
    });

    app.get<{ Params: { id: string } }>('/backlog/item/:id', async (req, reply) => {
      try {
        const item = await provider.getItem(req.params.id);
        const content = renderBacklogItem(discovery, item);
        reply.type('text/html').send(layout(discovery, renderNav(discovery, { activeMode: 'backlog', activeSubItem: 'board' }), content));
      } catch (err) {
        reply.code(500).type('text/html').send(
          renderErrorPage(discovery, 'Backlog Item Error', String(err instanceof Error ? err.message : err)),
        );
      }
    });

    app.get('/backlog/stats', async (_req, reply) => {
      try {
        const stats = await provider.getStats();
        const hygiene = await provider.getHygiene();
        const content = renderBacklogStats(discovery, stats, hygiene);
        reply.type('text/html').send(layout(discovery, renderNav(discovery, { activeMode: 'backlog', activeSubItem: 'stats' }), content));
      } catch (err) {
        reply.code(500).type('text/html').send(
          renderErrorPage(discovery, 'Backlog Stats Error', String(err instanceof Error ? err.message : err)),
        );
      }
    });

    app.get<{ Querystring: { q?: string } }>('/backlog/search', async (req, reply) => {
      const query = req.query.q?.trim() ?? '';
      const results = query ? await provider.searchItems(query) : [];
      const content = renderBacklogSearch(discovery, query, results);
      reply.type('text/html').send(layout(discovery, renderNav(discovery, { activeMode: 'backlog', activeSubItem: 'board' }), content));
    });

    app.post<{ Params: { id: string }; Body: { to?: string } }>('/backlog/item/:id/move', async (req, reply) => {
      const destination = req.body?.to;
      if (destination !== 'next' && destination !== 'working' && destination !== 'done' && destination !== 'archive') {
        reply.code(400).send({ error: 'Invalid destination folder.' });
        return;
      }

      await provider.moveItem(req.params.id, destination);
      reply.redirect('/backlog');
    });
  }

  // --- Agents Mode ---
  if (discovery.hasAgents || discovery.hasWorkers) {
    app.get('/agents', async (_req, reply) => {
      const workers = await agentsProvider.listAllWorkers();
      const content = renderAgentsOverview(discovery, workers, agentsProvider.hasHub);
      reply.type('text/html').send(layout(discovery, renderNav(discovery, { activeMode: 'agents', activeSubItem: 'workers' }), content));
    });

    app.get<{ Params: { id: string } }>('/agents/worker/:id', async (req, reply) => {
      const { id } = req.params;
      const fromList = (await agentsProvider.listAllWorkers()).find(worker => worker.id === id) ?? null;
      const fromHub = (await agentsProvider.getHubWorker(id)) ?? null;
      const worker = fromList
        ? { ...fromList, ...fromHub, id: fromList.id }
        : fromHub;

      if (!worker) {
        const content = `<div class="dashboard"><h1 class="page-title">Worker not found</h1><p class="page-subtitle">Worker <code>${escapeHtml(id)}</code> could not be found.</p></div>`;
        reply.code(404).type('text/html').send(layout(discovery, renderNav(discovery, { activeMode: 'agents', activeSubItem: 'workers' }), content));
        return;
      }

      const log = agentsProvider.getWorkerLog(id, 100);
      const content = renderAgentWorkerDetail(discovery, worker, log);
      reply.type('text/html').send(layout(discovery, renderNav(discovery, { activeMode: 'agents', activeSubItem: 'workers' }), content));
    });

    app.get('/agents/messages', async (_req, reply) => {
      const messages = await agentsProvider.listMessages({ limit: 500 });
      const content = renderAgentsMessages(discovery, messages);
      reply.type('text/html').send(layout(discovery, renderNav(discovery, { activeMode: 'agents', activeSubItem: 'messages' }), content));
    });

    app.get('/agents/costs', async (_req, reply) => {
      const workers = await agentsProvider.listAllWorkers();
      const content = renderAgentsCosts(discovery, workers);
      reply.type('text/html').send(layout(discovery, renderNav(discovery, { activeMode: 'agents', activeSubItem: 'costs' }), content));
    });

    app.get('/agents/incidents', async (_req, reply) => {
      const workers = await agentsProvider.listAllWorkers();
      const messages = await agentsProvider.listMessages({ limit: 500 });
      const content = renderAgentsIncidents(discovery, workers, messages);
      reply.type('text/html').send(layout(discovery, renderNav(discovery, { activeMode: 'agents', activeSubItem: 'incidents' }), content));
    });

    app.post<{ Params: { id: string } }>('/agents/worker/:id/sync', async (req, reply) => {
      const { id } = req.params;
      await agentsProvider.syncWorker(id);
      reply.redirect(`/agents/worker/${encodeURIComponent(id)}`);
    });

    app.post<{ Params: { id: string } }>('/agents/worker/:id/stop', async (req, reply) => {
      const { id } = req.params;
      // Placeholder until agents-hub supports a stop operation.
      reply.redirect(`/agents/worker/${encodeURIComponent(id)}`);
    });
  }

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

  // --- Static CSS ---
  app.get('/styles.css', async (_req, reply) => {
    reply.type('text/css').send(getStyles());
  });

  // --- Health check ---
  app.get('/api/health', async () => {
    return {
      status: 'ok',
      systems: discovery.systems.map(s => ({ name: s.name, type: s.type })),
    };
  });

  registerEvents(app, discovery);

  // --- SPA static serving (production) ---
  const clientDir = join(import.meta.dirname, '../client/dist');
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
