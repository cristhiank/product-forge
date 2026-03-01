import type { DiscoveryResult } from '../discovery.js';
import { ProductProvider } from '../providers/product.js';
import type {
  FeatureOverview,
  ProductDoc,
  ProductFeature,
  ProductHealth,
  ProductMeta,
} from '../providers/types.js';
import { layout, renderNav } from './layout.js';
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
  const nav = renderNav(discovery, { activeMode: 'product', activeSubItem: 'overview' });
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

  // Feature pipeline bar
  const pipelineSegments = FEATURE_STATUSES.map((status) => {
    const count = featureOverview[status].length;
    if (count === 0) return '';
    return `<div class="pipeline-segment pipeline-segment--${status}" style="flex: ${count};" title="${statusLabel(status)}: ${count}">${statusLabel(status)} ${count}</div>`;
  }).filter(Boolean).join('');

  const content = `
    ${pageHeader(meta.name, meta.description)}

    <div class="callout">
      <div class="callout-label">🧭 North Star</div>
      <div class="callout-text">${escapeHtml(meta.north_star)}</div>
    </div>

    <div class="home-stage-badge" style="margin-bottom: 24px;">
      Stage: ${escapeHtml(meta.stage)} · v${escapeHtml(meta.version)} · Created ${escapeHtml(meta.created)}
    </div>

    <div class="card-grid">
      ${metricCard({ label: 'Total docs', value: docs.length, icon: '📄', variant: 'info' })}
      ${metricCard({ label: 'Features', value: totalFeatures, icon: '🧩', variant: 'info' })}
      ${metricCard({ label: 'Draft docs', value: health.draft_count, icon: '📝', variant: 'warning' })}
      ${metricCard({ label: 'Active docs', value: health.active_count, icon: '✅', variant: 'success' })}
    </div>

    <h2 class="section-title">Feature Lifecycle</h2>
    ${pipelineSegments ? `<div class="pipeline">${pipelineSegments}</div>` : emptyState('No features tracked yet.')}

    <h2 class="section-title">Documents</h2>
    ${docs.length > 0 ? `<div class="card-grid">
      ${docs.map(doc => card({
        icon: docTypeIcon(doc.type),
        title: doc.title,
        meta: `${doc.type} · ${doc.status}`,
        link: { href: `/product/doc/${encodeURIComponent(doc.path)}`, text: 'Open →' },
      })).join('')}
    </div>` : emptyState('No documents found.')}

    ${alerts.length > 0 ? `
      <h2 class="section-title">Health Alerts</h2>
      <div class="card-grid">${alerts.map(msg => card({ icon: '⚠️', title: 'Alert', meta: msg })).join('')}</div>
    ` : ''}
  `;

  return layout(discovery, nav, content);
}

function docTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    vision: '🔭', brand: '🎨', strategy: '📐', feature: '🧩', experiment: '🧪',
  };
  return icons[type.toLowerCase()] ?? '📄';
}

export function renderProductDoc(discovery: DiscoveryResult, doc: ProductDoc): string {
  const nav = renderNav(discovery, { activeMode: 'product', activeSubItem: 'overview' });
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
  const nav = renderNav(discovery, { activeMode: 'product', activeSubItem: 'features' });
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
  const nav = renderNav(discovery, { activeMode: 'product' });
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
