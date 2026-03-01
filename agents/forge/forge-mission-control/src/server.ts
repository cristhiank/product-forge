import Fastify from 'fastify';
import type { DiscoveryResult } from './discovery.js';
import { renderHome, layout } from './render/layout.js';
import { getStyles } from './render/styles.js';

interface ServerOptions {
  port: number;
  verbose: boolean;
}

export async function createServer(discovery: DiscoveryResult, opts: ServerOptions) {
  const app = Fastify({
    logger: opts.verbose ? { level: 'info' } : false,
  });

  // --- Home ---
  app.get('/', async (_req, reply) => {
    reply.type('text/html').send(renderHome(discovery));
  });

  // --- Product Mode ---
  if (discovery.hasProduct) {
    app.get('/product', async (_req, reply) => {
      const content = `<div class="dashboard"><h1 class="page-title">📋 Product</h1><p class="page-subtitle">Product mode — coming soon</p></div>`;
      reply.type('text/html').send(layout(discovery, renderNavFor(discovery, 'product'), content));
    });
  }

  // --- Backlog Mode ---
  if (discovery.hasBacklog) {
    app.get('/backlog', async (_req, reply) => {
      const content = `<div class="dashboard"><h1 class="page-title">📦 Backlog</h1><p class="page-subtitle">Backlog mode — coming soon</p></div>`;
      reply.type('text/html').send(layout(discovery, renderNavFor(discovery, 'backlog'), content));
    });
  }

  // --- Agents Mode ---
  if (discovery.hasAgents || discovery.hasWorkers) {
    app.get('/agents', async (_req, reply) => {
      const content = `<div class="dashboard"><h1 class="page-title">🤖 Agents</h1><p class="page-subtitle">Agents mode — coming soon</p></div>`;
      reply.type('text/html').send(layout(discovery, renderNavFor(discovery, 'agents'), content));
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
