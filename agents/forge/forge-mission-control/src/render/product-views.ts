import type { DiscoveryResult } from '../discovery.js';
import { ProductProvider } from '../providers/product.js';
import type {
  FeatureOverview,
  ProductDoc,
  ProductFeature,
  ProductHealth,
  ProductMeta,
} from '../providers/types.js';
import { layout } from './layout.js';
import {
  breadcrumbs,
  card,
  dataTable,
  emptyState,
  metricCard,
  pageHeader,
  statusBadge,
} from './components.js';
import { escapeHtml, mdToHtml } from './markdown.js';

const FEATURE_STATUSES = [
  'discovery',
  'defined',
  'validated',
  'planned',
  'building',
  'shipped',
  'measuring',
] as const;

type FeatureStatus = (typeof FEATURE_STATUSES)[number];

export function renderProductOverview(
  discovery: DiscoveryResult,
  meta: ProductMeta,
  health: ProductHealth,
  featureOverview: FeatureOverview,
  docs: ProductDoc[],
): string {
  const nav = renderNavFor(discovery, 'product');
  const lifecycleRows = FEATURE_STATUSES.map((status) => ({
    status: statusLabel(status),
    count: String(featureOverview[status].length),
  }));
  const totalFeatures = lifecycleRows.reduce((sum, row) => sum + Number(row.count), 0);
  const alerts: string[] = [];

  if (health.stale_docs.length > 0) {
    alerts.push(`${health.stale_docs.length} stale docs need review`);
  }
  if (health.orphaned_features.length > 0) {
    alerts.push(`${health.orphaned_features.length} orphaned features found`);
  }

  const content = `
    ${pageHeader(meta.name, meta.description)}
    <div class="card-grid">
      ${card({
        icon: '🧭',
        title: 'North Star',
        meta: meta.north_star,
        body: `Stage: ${meta.stage} · Version: ${meta.version}`,
      })}
      ${card({
        icon: '🚦',
        title: 'Stage',
        meta: meta.stage,
        body: `Created ${meta.created}`,
      })}
      ${card({
        icon: '🏷️',
        title: 'Version',
        meta: meta.version,
        body: 'Product metadata',
      })}
      ${card({
        icon: '📈',
        title: 'Status',
        meta: `${health.active_count} active · ${health.draft_count} draft`,
        body: alerts.length > 0 ? alerts.join(' | ') : 'No active health alerts',
      })}
    </div>

    <div class="card-grid">
      ${metricCard({ label: 'Total docs', value: docs.length, icon: '📄', variant: 'info' })}
      ${metricCard({ label: 'Features', value: totalFeatures, icon: '🧩', variant: 'info' })}
      ${metricCard({ label: 'Draft docs', value: health.draft_count, icon: '📝', variant: 'warning' })}
      ${metricCard({ label: 'Active docs', value: health.active_count, icon: '✅', variant: 'success' })}
      ${metricCard({ label: 'Stale docs', value: health.stale_docs.length, icon: '⏰', variant: health.stale_docs.length > 0 ? 'warning' : 'success' })}
    </div>

    <section>
      <h2 class="page-title">Feature lifecycle summary</h2>
      ${dataTable({
        headers: [
          { label: 'Status', key: 'status' },
          { label: 'Count', key: 'count', align: 'right' },
        ],
        rows: lifecycleRows,
        emptyMessage: 'No feature lifecycle data found.',
      })}
    </section>

    <section>
      <h2 class="page-title">Health alerts</h2>
      ${
        alerts.length > 0
          ? `<div class="card-grid">${alerts
              .map((message) => card({ icon: '⚠️', title: 'Alert', meta: message }))
              .join('')}</div>`
          : emptyState('No health alerts 🎉', 'Everything looks healthy right now.')
      }
    </section>
  `;

  return layout(discovery, nav, content);
}

export function renderProductDoc(discovery: DiscoveryResult, doc: ProductDoc): string {
  const nav = renderNavFor(discovery, 'product');
  const frontmatterRows: Record<string, string>[] = [
    { key: 'Version', value: doc.version },
    { key: 'Status', value: doc.status },
    { key: 'Tags', value: doc.tags.length > 0 ? doc.tags.join(', ') : '—' },
    { key: 'Created', value: doc.created || '—' },
    { key: 'Updated', value: doc.updated || '—' },
    { key: 'Path', value: doc.path },
  ];

  const content = `
    ${breadcrumbs([
      { label: 'Product', href: '/product' },
      { label: doc.type, href: '/product' },
      { label: doc.title },
    ])}
    ${pageHeader(doc.title, `${doc.type} document`)}
    <div class="card-grid">
      ${card({
        icon: '🧾',
        title: 'Frontmatter',
        meta: `${doc.version} · ${doc.status}`,
        body: `Tags: ${doc.tags.length > 0 ? doc.tags.join(', ') : 'none'}`,
      })}
    </div>
    ${dataTable({
      headers: [
        { label: 'Field', key: 'key' },
        { label: 'Value', key: 'value' },
      ],
      rows: frontmatterRows,
      emptyMessage: 'No metadata.',
    })}
    ${mdToHtml(doc.content)}
  `;

  return layout(discovery, nav, content);
}

export function renderProductFeatures(
  discovery: DiscoveryResult,
  featureOverview: FeatureOverview,
  features: ProductFeature[],
): string {
  const nav = renderNavFor(discovery, 'product');
  const byStatus = new Map<FeatureStatus, ProductFeature[]>();

  for (const status of FEATURE_STATUSES) {
    byStatus.set(
      status,
      features.filter((feature) => normalizeStatus(feature.featureStatus) === status),
    );
  }

  const columns = FEATURE_STATUSES.map((status) => {
    const items = byStatus.get(status) ?? [];
    const count = featureOverview[status].length || items.length;
    const cards = items.length
      ? items
          .map(
            (feature) => `<div class="card">
              <div class="card-body">
                <h3 class="card-title">${escapeHtml(feature.title)}</h3>
                <p class="card-meta">${statusBadge(statusLabel(status), variantForStatus(status))}</p>
                <p class="card-meta">Epic: ${
                  feature.epicId
                    ? `<a href="/backlog">${escapeHtml(feature.epicId)}</a>`
                    : '—'
                }</p>
              </div>
            </div>`,
          )
          .join('')
      : emptyState('No features');

    return `<section style="min-width: 260px;">
      <h2 class="page-title">${statusLabel(status)} (${count})</h2>
      ${cards}
    </section>`;
  }).join('');

  const content = `
    ${pageHeader('Feature lifecycle board', 'Discovery → Measuring')}
    <div style="display: grid; grid-template-columns: repeat(7, minmax(260px, 1fr)); gap: 12px; overflow-x: auto;">
      ${columns}
    </div>
  `;

  return layout(discovery, nav, content);
}

export function renderProductSearch(
  discovery: DiscoveryResult,
  query: string,
  results: ProductDoc[],
): string {
  const nav = renderNavFor(discovery, 'product');
  const content = `
    ${pageHeader('Product search', query ? `Results for "${query}"` : 'Enter a query with ?q=')}
    ${
      query
        ? results.length > 0
          ? `<div class="card-grid">
              ${results
                .map((doc) =>
                  card({
                    icon: '📄',
                    title: doc.title,
                    meta: `${doc.type} · ${doc.status}`,
                    body: doc.path,
                    link: { href: `/product/doc/${encodeURIComponent(doc.path)}`, text: 'Open →' },
                  }))
                .join('')}
            </div>`
          : emptyState('No results found.', 'Try a broader query.')
        : emptyState('No search query provided.', 'Use /product/search?q=keyword')
    }
  `;

  return layout(discovery, nav, content);
}

function normalizeStatus(status: string): FeatureStatus {
  const normalized = status.trim().toLowerCase();
  return FEATURE_STATUSES.includes(normalized as FeatureStatus)
    ? (normalized as FeatureStatus)
    : 'defined';
}

function statusLabel(status: FeatureStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function variantForStatus(status: FeatureStatus): 'success' | 'warning' | 'danger' | 'info' | 'muted' {
  switch (status) {
    case 'measuring':
    case 'shipped':
      return 'success';
    case 'building':
    case 'planned':
      return 'warning';
    case 'validated':
      return 'info';
    case 'defined':
    case 'discovery':
      return 'muted';
    default:
      return 'muted';
  }
}

function renderNavFor(discovery: DiscoveryResult, active: string): string {
  const items: { href: string; icon: string; label: string; key: string; enabled: boolean }[] = [
    { href: '/', icon: '🔥', label: 'Dashboard', key: 'home', enabled: true },
    { href: '/product', icon: '📋', label: 'Product', key: 'product', enabled: discovery.hasProduct },
    { href: '/backlog', icon: '📦', label: 'Backlog', key: 'backlog', enabled: discovery.hasBacklog },
    { href: '/agents', icon: '🤖', label: 'Agents', key: 'agents', enabled: discovery.hasAgents || discovery.hasWorkers },
  ];

  return `<nav class="nav">
    ${items
      .map((item) => {
        const cls = [
          'nav-item',
          item.key === active ? 'nav-item--active' : '',
          !item.enabled ? 'nav-item--disabled' : '',
        ]
          .filter(Boolean)
          .join(' ');

        if (!item.enabled) {
          return `<span class="${cls}" title="Not found"><span class="nav-icon">${item.icon}</span> ${item.label}</span>`;
        }
        return `<a href="${item.href}" class="${cls}"><span class="nav-icon">${item.icon}</span> ${item.label}</a>`;
      })
      .join('\n    ')}
  </nav>`;
}
