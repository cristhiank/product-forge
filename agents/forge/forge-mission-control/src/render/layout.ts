import type { DiscoveryResult } from '../discovery.js';
import { escapeHtml } from './markdown.js';

export function renderHome(discovery: DiscoveryResult): string {
  const nav = renderNav(discovery, 'home');
  const content = renderDashboard(discovery);
  return layout(discovery, nav, content);
}

export function layout(discovery: DiscoveryResult, nav: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Forge Mission Control</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <header class="topbar">
    <div class="topbar-brand">
      <span class="topbar-icon">🔥</span>
      <span class="topbar-title">Forge Mission Control</span>
    </div>
    <div class="topbar-meta">
      <span class="topbar-repo">${escapeHtml(discovery.repoRoot.split('/').pop() || '')}</span>
    </div>
  </header>
  <div class="app">
    <aside class="sidebar">
      ${nav}
    </aside>
    <main class="content">
      ${content}
    </main>
  </div>
</body>
</html>`;
}

function renderNav(discovery: DiscoveryResult, active: string): string {
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

function renderDashboard(discovery: DiscoveryResult): string {
  const systemCards = discovery.systems.map(sys => `
    <div class="card">
      <div class="card-icon">${sys.icon}</div>
      <div class="card-body">
        <h3 class="card-title">${escapeHtml(sys.name)}</h3>
        <p class="card-meta">${escapeHtml(sys.path)}</p>
      </div>
      <a href="/${sys.type === 'workers' ? 'agents' : sys.type}" class="card-link">Open →</a>
    </div>
  `).join('');

  return `
    <div class="dashboard">
      <h1 class="page-title">Project Overview</h1>
      <p class="page-subtitle">${discovery.systems.length} system${discovery.systems.length !== 1 ? 's' : ''} discovered at <code>${escapeHtml(discovery.repoRoot)}</code></p>

      <div class="card-grid">
        ${systemCards}
      </div>
    </div>
  `;
}
