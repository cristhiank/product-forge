import type { DiscoveryResult } from '../discovery.js';
import { escapeHtml } from './markdown.js';

export interface NavContext {
  activeMode: string;
  activeSubItem?: string;
}

export function renderHome(discovery: DiscoveryResult): string {
  const nav = renderNav(discovery, { activeMode: 'home' });
  const content = renderDashboard(discovery);
  return layout(discovery, nav, content);
}

export function layout(discovery: DiscoveryResult, nav: string, content: string): string {
  const systemCount = discovery.systems.length;
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
  <footer class="statusbar">
    <span><span class="statusbar-dot"></span></span>
    <span>${systemCount} system${systemCount !== 1 ? 's' : ''} active</span>
    <span>Updated just now</span>
  </footer>
  <script>
    const es = new EventSource('/events');
    es.addEventListener('product_change', () => location.reload());
    es.addEventListener('backlog_change', () => location.reload());
    es.addEventListener('worker_update', () => location.reload());
    es.onerror = () => setTimeout(() => location.reload(), 5000);
  </script>
</body>
</html>`;
}

export function renderNav(discovery: DiscoveryResult, ctx: NavContext): string {
  const { activeMode, activeSubItem } = ctx;

  const navItem = (href: string, icon: string, label: string, key: string, enabled: boolean) => {
    const isActive = key === activeMode;
    const cls = [
      'nav-item',
      isActive ? 'nav-item--active' : '',
      !enabled ? 'nav-item--disabled' : '',
    ].filter(Boolean).join(' ');

    if (!enabled) {
      return `<span class="${cls}" title="Not found"><span class="nav-icon">${icon}</span> ${label}</span>`;
    }
    return `<a href="${href}" class="${cls}"><span class="nav-icon">${icon}</span> ${label}</a>`;
  };

  const subItem = (href: string, label: string, key: string) => {
    const cls = activeSubItem === key ? 'nav-sub-item nav-sub-item--active' : 'nav-sub-item';
    return `<a href="${href}" class="${cls}">${label}</a>`;
  };

  let html = '<nav class="nav">';
  html += navItem('/', '🔥', 'Dashboard', 'home', true);
  html += '<div class="nav-divider"></div>';

  // Product section
  html += '<div class="nav-section-label">Product</div>';
  html += navItem('/product', '📋', 'Product', 'product', discovery.hasProduct);
  if (discovery.hasProduct) {
    html += subItem('/product', 'Overview', 'overview');
    html += subItem('/product/features', 'Features', 'features');
  }

  html += '<div class="nav-divider"></div>';

  // Backlog section
  html += '<div class="nav-section-label">Backlog</div>';
  html += navItem('/backlog', '📦', 'Backlog', 'backlog', discovery.hasBacklog);
  if (discovery.hasBacklog) {
    html += subItem('/backlog', 'Board', 'board');
    html += subItem('/backlog/stats', 'Stats', 'stats');
  }

  html += '<div class="nav-divider"></div>';

  // Agents section
  const hasAgents = discovery.hasAgents || discovery.hasWorkers;
  html += '<div class="nav-section-label">Agents</div>';
  html += navItem('/agents', '🤖', 'Agents', 'agents', hasAgents);
  if (hasAgents) {
    html += subItem('/agents', 'Workers', 'workers');
    html += subItem('/agents/messages', 'Messages', 'messages');
    html += subItem('/agents/costs', 'Costs', 'costs');
    html += subItem('/agents/incidents', 'Incidents', 'incidents');
  }

  html += '</nav>';
  return html;
}

function renderDashboard(discovery: DiscoveryResult): string {
  const repoName = discovery.repoRoot.split('/').pop() || 'Project';

  const statCards: string[] = [];
  const quickLinks: string[] = [];

  if (discovery.hasProduct) {
    statCards.push(`<a href="/product" class="stat-card">
      <div class="stat-card-value">📋</div>
      <div class="stat-card-label">Product Docs</div>
    </a>`);
    quickLinks.push(`<a href="/product" class="quick-link">
      <span class="quick-link-icon">📋</span>
      <div class="quick-link-body">
        <div class="quick-link-title">Product</div>
        <div class="quick-link-desc">Vision, features, brand &amp; strategy docs</div>
      </div>
    </a>`);
    quickLinks.push(`<a href="/product/features" class="quick-link">
      <span class="quick-link-icon">🧩</span>
      <div class="quick-link-body">
        <div class="quick-link-title">Features</div>
        <div class="quick-link-desc">Feature lifecycle board</div>
      </div>
    </a>`);
  }

  if (discovery.hasBacklog) {
    statCards.push(`<a href="/backlog" class="stat-card">
      <div class="stat-card-value">📦</div>
      <div class="stat-card-label">Backlog Board</div>
    </a>`);
    quickLinks.push(`<a href="/backlog" class="quick-link">
      <span class="quick-link-icon">📦</span>
      <div class="quick-link-body">
        <div class="quick-link-title">Backlog</div>
        <div class="quick-link-desc">Kanban board across all folders</div>
      </div>
    </a>`);
    quickLinks.push(`<a href="/backlog/stats" class="quick-link">
      <span class="quick-link-icon">📊</span>
      <div class="quick-link-body">
        <div class="quick-link-title">Backlog Stats</div>
        <div class="quick-link-desc">Distribution &amp; hygiene health</div>
      </div>
    </a>`);
  }

  if (discovery.hasAgents || discovery.hasWorkers) {
    statCards.push(`<a href="/agents" class="stat-card">
      <div class="stat-card-value">🤖</div>
      <div class="stat-card-label">Agents</div>
    </a>`);
    quickLinks.push(`<a href="/agents" class="quick-link">
      <span class="quick-link-icon">🤖</span>
      <div class="quick-link-body">
        <div class="quick-link-title">Agents</div>
        <div class="quick-link-desc">Workers, costs &amp; incidents</div>
      </div>
    </a>`);
  }

  return `
    <div class="dashboard">
      <div class="home-header">
        <h1>${escapeHtml(repoName)}</h1>
        <p>${discovery.systems.length} system${discovery.systems.length !== 1 ? 's' : ''} discovered at <code>${escapeHtml(discovery.repoRoot)}</code></p>
        <div class="home-stage-badge">
          <span class="statusbar-dot"></span>
          Active
        </div>
      </div>

      <div class="stat-grid">
        ${statCards.join('')}
      </div>

      <h2 class="section-title">Quick Links</h2>
      <div class="quick-links">
        ${quickLinks.join('')}
      </div>
    </div>
  `;
}
