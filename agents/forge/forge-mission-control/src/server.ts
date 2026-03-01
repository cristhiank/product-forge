import Fastify from 'fastify';
import type { DiscoveryResult } from './discovery.js';
import { renderHome, layout } from './render/layout.js';
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

interface ServerOptions {
  port: number;
  verbose: boolean;
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
      const meta = productProvider.getMeta();
      const health = productProvider.getHealth();
      const featureOverview = productProvider.getFeatureOverview();
      const docs = productProvider.listDocs();
      reply.type('text/html').send(
        renderProductOverview(discovery, meta, health, featureOverview, docs),
      );
    });

    app.get<{ Params: { '*': string } }>('/product/doc/*', async (req, reply) => {
      const docPath = decodeURIComponent(req.params['*'] ?? '');
      const doc = productProvider.readDoc(docPath);
      reply.type('text/html').send(renderProductDoc(discovery, doc));
    });

    app.get('/product/features', async (_req, reply) => {
      const featureOverview = productProvider.getFeatureOverview();
      const features = productProvider.listFeatures();
      reply.type('text/html').send(renderProductFeatures(discovery, featureOverview, features));
    });

    app.get<{ Querystring: { q?: string } }>('/product/search', async (req, reply) => {
      const query = (req.query.q ?? '').trim();
      const results = query ? productProvider.searchDocs(query) : [];
      reply.type('text/html').send(renderProductSearch(discovery, query, results));
    });
  }

  // --- Backlog Mode ---
  if (discovery.hasBacklog) {
    const provider = new BacklogProvider(discovery.repoRoot);

    app.get('/backlog', async (_req, reply) => {
      const items = provider.listItems();
      const content = renderBacklogBoard(discovery, items);
      reply.type('text/html').send(layout(discovery, renderNavFor(discovery, 'backlog'), content));
    });

    app.get<{ Params: { id: string } }>('/backlog/item/:id', async (req, reply) => {
      const item = provider.getItem(req.params.id);
      const content = renderBacklogItem(discovery, item);
      reply.type('text/html').send(layout(discovery, renderNavFor(discovery, 'backlog'), content));
    });

    app.get('/backlog/stats', async (_req, reply) => {
      const stats = provider.getStats();
      const hygiene = provider.getHygiene();
      const content = renderBacklogStats(discovery, stats, hygiene);
      reply.type('text/html').send(layout(discovery, renderNavFor(discovery, 'backlog'), content));
    });

    app.get<{ Querystring: { q?: string } }>('/backlog/search', async (req, reply) => {
      const query = req.query.q?.trim() ?? '';
      const results = query ? provider.searchItems(query) : [];
      const content = renderBacklogSearch(discovery, query, results);
      reply.type('text/html').send(layout(discovery, renderNavFor(discovery, 'backlog'), content));
    });

    app.post<{ Params: { id: string }; Body: { to?: string } }>('/backlog/item/:id/move', async (req, reply) => {
      const destination = req.body?.to;
      if (destination !== 'next' && destination !== 'working' && destination !== 'done' && destination !== 'archive') {
        reply.code(400).send({ error: 'Invalid destination folder.' });
        return;
      }

      provider.moveItem(req.params.id, destination);
      reply.redirect('/backlog');
    });
  }

  // --- Agents Mode ---
  if (discovery.hasAgents || discovery.hasWorkers) {
    app.get('/agents', async (_req, reply) => {
      const workers = agentsProvider.listAllWorkers();
      const content = renderAgentsOverview(discovery, workers, agentsProvider.hasHub);
      reply.type('text/html').send(layout(discovery, renderNavFor(discovery, 'agents'), content));
    });

    app.get<{ Params: { id: string } }>('/agents/worker/:id', async (req, reply) => {
      const { id } = req.params;
      const fromList = agentsProvider.listAllWorkers().find(worker => worker.id === id) ?? null;
      const fromHub = agentsProvider.getHubWorker(id) ?? null;
      const worker = fromList
        ? { ...fromList, ...fromHub, id: fromList.id }
        : fromHub;

      if (!worker) {
        const content = `<div class="dashboard"><h1 class="page-title">Worker not found</h1><p class="page-subtitle">Worker <code>${escapeHtml(id)}</code> could not be found.</p></div>`;
        reply.code(404).type('text/html').send(layout(discovery, renderNavFor(discovery, 'agents'), content));
        return;
      }

      const log = agentsProvider.getWorkerLog(id, 100);
      const content = renderAgentWorkerDetail(discovery, worker, log);
      reply.type('text/html').send(layout(discovery, renderNavFor(discovery, 'agents'), content));
    });

    app.get('/agents/messages', async (_req, reply) => {
      const messages = agentsProvider.listMessages({ limit: 500 });
      const content = renderAgentsMessages(discovery, messages);
      reply.type('text/html').send(layout(discovery, renderNavFor(discovery, 'agents'), content));
    });

    app.get('/agents/costs', async (_req, reply) => {
      const workers = agentsProvider.listAllWorkers();
      const content = renderAgentsCosts(discovery, workers);
      reply.type('text/html').send(layout(discovery, renderNavFor(discovery, 'agents'), content));
    });

    app.get('/agents/incidents', async (_req, reply) => {
      const workers = agentsProvider.listAllWorkers();
      const messages = agentsProvider.listMessages({ limit: 500 });
      const content = renderAgentsIncidents(discovery, workers, messages);
      reply.type('text/html').send(layout(discovery, renderNavFor(discovery, 'agents'), content));
    });

    app.post<{ Params: { id: string } }>('/agents/worker/:id/sync', async (req, reply) => {
      const { id } = req.params;
      agentsProvider.syncWorker(id);
      reply.redirect(`/agents/worker/${encodeURIComponent(id)}`);
    });

    app.post<{ Params: { id: string } }>('/agents/worker/:id/stop', async (req, reply) => {
      const { id } = req.params;
      // Placeholder until agents-hub supports a stop operation.
      reply.redirect(`/agents/worker/${encodeURIComponent(id)}`);
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

  return app;
}

function renderNavFor(discovery: DiscoveryResult, active: string): string {
  const items: { href: string; icon: string; label: string; key: string; enabled: boolean }[] = [
    { href: '/', icon: '🔥', label: 'Dashboard', key: 'home', enabled: true },
    { href: '/product', icon: '📋', label: 'Product', key: 'product', enabled: discovery.hasProduct },
    { href: '/backlog', icon: '📦', label: 'Backlog', key: 'backlog', enabled: discovery.hasBacklog },
    { href: '/agents', icon: '🤖', label: 'Agents', key: 'agents', enabled: discovery.hasAgents || discovery.hasWorkers },
  ];

  return `<nav class="nav">
    ${items.map(item => {
      const cls = [
        'nav-item',
        item.key === active ? 'nav-item--active' : '',
        !item.enabled ? 'nav-item--disabled' : '',
      ].filter(Boolean).join(' ');

      if (!item.enabled) {
        return `<span class="${cls}" title="Not found"><span class="nav-icon">${item.icon}</span> ${item.label}</span>`;
      }
      return `<a href="${item.href}" class="${cls}"><span class="nav-icon">${item.icon}</span> ${item.label}</a>`;
    }).join('\n    ')}
  </nav>`;
}
