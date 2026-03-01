import type { DiscoveryResult } from '../discovery.js';
import type { BacklogHygiene, BacklogItem, BacklogStats } from '../providers/backlog.js';
import {
  breadcrumbs,
  dataTable,
  emptyState,
  kindBadge,
  metricCard,
  pageHeader,
  priorityBadge,
  statusBadge,
} from './components.js';
import { escapeHtml, mdToHtml } from './markdown.js';

function normalizePriority(priority: unknown): 'high' | 'medium' | 'low' {
  const str = String(priority ?? '').trim().toLowerCase();
  if (str === 'high') return 'high';
  if (str === 'low') return 'low';
  return 'medium';
}

function stripIdPrefix(id: string, title: string): string {
  const prefix = `${id}: `;
  if (title.startsWith(prefix)) return title.slice(prefix.length);
  const prefixAlt = `${id} - `;
  if (title.startsWith(prefixAlt)) return title.slice(prefixAlt.length);
  return title;
}

const BACKLOG_FOLDERS = ['next', 'working', 'done', 'archive'] as const;
type BacklogFolder = typeof BACKLOG_FOLDERS[number];

const FOLDER_LABELS: Record<BacklogFolder, string> = {
  next: 'Next',
  working: 'Working',
  done: 'Done',
  archive: 'Archive',
};

function folderBadge(folder: string): string {
  const normalized = folder.trim().toLowerCase();
  const variant = normalized === 'done'
    ? 'success'
    : normalized === 'working'
      ? 'warning'
      : normalized === 'archive'
        ? 'muted'
        : 'info';
  return statusBadge(FOLDER_LABELS[normalized as BacklogFolder] ?? folder, variant);
}

function renderTagPills(tags: string[]): string {
  if (tags.length === 0) {
    return '<span class="tag-pill tag-pill--muted">No tags</span>';
  }
  return tags.map(tag => `<span class="tag-pill">${escapeHtml(tag)}</span>`).join('');
}

function parseDate(value?: string): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return escapeHtml(value);
  }
  return escapeHtml(date.toLocaleString());
}

function inferDependencyStatus(item: BacklogItem, dependencyId: string): 'done' | 'working' | 'unknown' {
  const folderMap = item.metadata?.dependency_folders;
  if (!folderMap) {
    return 'unknown';
  }

  const folder = folderMap.split(',').find(entry => entry.startsWith(`${dependencyId}:`))?.split(':')[1];
  if (!folder) {
    return 'unknown';
  }

  if (folder === 'done' || folder === 'archive') {
    return 'done';
  }
  if (folder === 'working' || folder === 'next') {
    return 'working';
  }
  return 'unknown';
}

export function renderBacklogBoard(_discovery: DiscoveryResult, items: BacklogItem[]): string {
  const grouped = new Map<BacklogFolder, BacklogItem[]>(
    BACKLOG_FOLDERS.map(folder => [folder, []]),
  );

  for (const item of items) {
    const folder = item.folder.toLowerCase() as BacklogFolder;
    if (grouped.has(folder)) {
      grouped.get(folder)?.push(item);
    }
  }

  const columns = BACKLOG_FOLDERS.map((folder) => {
    const columnItems = grouped.get(folder) ?? [];
    const cards = columnItems.length === 0
      ? '<div class="empty-state">No items</div>'
      : columnItems.map((item) => {
        const dependencyCount = (item.depends_on ?? []).length;
        return `<article class="kanban-card">
          <a href="/backlog/item/${encodeURIComponent(item.id)}">
            <div class="kanban-card-title">${escapeHtml(item.id)} · ${escapeHtml(stripIdPrefix(item.id, item.title))}</div>
            <div class="kanban-card-meta">
              ${kindBadge(item.kind)}
              ${dependencyCount > 0 ? `<span>${dependencyCount} dep${dependencyCount === 1 ? '' : 's'}</span>` : ''}
            </div>
          </a>
        </article>`;
      }).join('');

    return `<section class="kanban-column kanban-column--${folder}">
      <div class="kanban-column-header">
        <span>${FOLDER_LABELS[folder]}</span>
        <span class="kanban-count">${columnItems.length}</span>
      </div>
      <div class="kanban-cards">
      ${cards}
      </div>
    </section>`;
  }).join('');

  return `<div class="dashboard">
    ${pageHeader('📦 Backlog Board', 'Kanban view across Next, Working, Done, and Archive')}
    <div class="kanban">${columns}</div>
  </div>`;
}

export function renderBacklogItem(_discovery: DiscoveryResult, item: BacklogItem): string {
  const dependsOn = item.depends_on ?? [];
  const relatedItems = item.related ?? [];
  const tags = item.tags ?? [];

  const metadataRows = [
    { key: 'Folder', value: folderBadge(item.folder) },
    { key: 'Created', value: parseDate(item.metadata?.created_at) },
    { key: 'Updated', value: parseDate(item.metadata?.updated_at) },
  ];

  const dependencies = dependsOn.length === 0
    ? emptyState('No dependencies', 'This item is currently unblocked.')
    : `<ul class="link-list">
      ${dependsOn.map((dependencyId) => {
        const status = inferDependencyStatus(item, dependencyId);
        const indicator = status === 'done'
          ? statusBadge('done', 'success')
          : status === 'working'
            ? statusBadge('pending', 'warning')
            : statusBadge('unknown', 'muted');
        return `<li>
          <a href="/backlog/item/${encodeURIComponent(dependencyId)}">${escapeHtml(dependencyId)}</a>
          ${indicator}
        </li>`;
      }).join('')}
    </ul>`;

  const related = relatedItems.length === 0
    ? emptyState('No related items')
    : `<ul class="link-list">
      ${relatedItems.map((relatedId) => `<li><a href="/backlog/item/${encodeURIComponent(relatedId)}">${escapeHtml(relatedId)}</a></li>`).join('')}
    </ul>`;

  const body = item.body?.trim() ? mdToHtml(item.body) : emptyState('No description provided yet.');

  return `<div class="dashboard backlog-detail">
    ${breadcrumbs([
      { label: 'Backlog', href: '/backlog' },
      { label: item.folder, href: '/backlog' },
      { label: item.id },
    ])}

    <header class="page-header">
      <h1 class="page-title">${escapeHtml(stripIdPrefix(item.id, item.title))}</h1>
      <p class="page-subtitle">${escapeHtml(item.id)}</p>
      <div class="backlog-header-meta">
        ${kindBadge(item.kind)}
        ${priorityBadge(normalizePriority(item.priority))}
        ${folderBadge(item.folder)}
      </div>
    </header>

    <section class="card">
      <div class="card-body">
        <h3 class="card-title">Metadata</h3>
        <div class="backlog-meta-grid">
          ${metadataRows.map((row) => `<div><strong>${row.key}:</strong> ${row.value}</div>`).join('')}
          <div><strong>Tags:</strong> <span class="backlog-tags">${renderTagPills(tags)}</span></div>
        </div>
      </div>
    </section>

    <section class="card">
      <div class="card-body">
        <h3 class="card-title">Dependencies</h3>
        ${dependencies}
      </div>
    </section>

    <section class="card">
      <div class="card-body">
        <h3 class="card-title">Related items</h3>
        ${related}
      </div>
    </section>

    <section class="card">
      <div class="card-body">
        <h3 class="card-title">Description</h3>
        ${body}
      </div>
    </section>
  </div>`;
}

export function renderBacklogStats(
  _discovery: DiscoveryResult,
  stats: BacklogStats,
  hygiene: BacklogHygiene,
): string {
  const projects = Object.entries(stats);
  const totals = projects.reduce(
    (acc, [, counts]) => ({
      next: acc.next + counts.next,
      working: acc.working + counts.working,
      done: acc.done + counts.done,
      archive: acc.archive + counts.archive,
    }),
    { next: 0, working: 0, done: 0, archive: 0 },
  );

  const metrics = [
    metricCard({ label: 'Next', value: totals.next, icon: '🧭', variant: 'info' }),
    metricCard({ label: 'Working', value: totals.working, icon: '⚙️', variant: 'warning' }),
    metricCard({ label: 'Done', value: totals.done, icon: '✅', variant: 'success' }),
    metricCard({ label: 'Archive', value: totals.archive, icon: '🗄️' }),
  ].join('');

  const breakdownRows = projects.map(([project, counts]) => ({
    project,
    next: String(counts.next),
    working: String(counts.working),
    done: String(counts.done),
    archive: String(counts.archive),
  }));

  const stale = hygiene.stale ?? [];
  const oldDone = hygiene.old_done ?? [];
  const warnings = hygiene.warnings ?? [];

  const alerts: string[] = [];
  if (stale.length > 0) {
    alerts.push(`${stale.length} stale item${stale.length === 1 ? '' : 's'} need attention.`);
  }
  if (oldDone.length > 0) {
    alerts.push(`${oldDone.length} old done item${oldDone.length === 1 ? '' : 's'} can be archived.`);
  }
  alerts.push(...warnings);

  const alertsHtml = alerts.length === 0
    ? statusBadge('No hygiene alerts', 'success')
    : `<ul class="alerts-list">${alerts.map(alert => `<li>${escapeHtml(alert)}</li>`).join('')}</ul>`;

  return `<div class="dashboard">
    ${pageHeader('📊 Backlog Stats', 'Folder distribution and hygiene health')}
    <div class="card-grid">${metrics}</div>

    <section class="card">
      <div class="card-body">
        <h3 class="card-title">Hygiene alerts</h3>
        ${alertsHtml}
      </div>
    </section>

    ${projects.length > 1 ? `
      <section class="card">
        <div class="card-body">
          <h3 class="card-title">Per-project breakdown</h3>
          ${dataTable({
            headers: [
              { label: 'Project', key: 'project' },
              { label: 'Next', key: 'next', align: 'right' },
              { label: 'Working', key: 'working', align: 'right' },
              { label: 'Done', key: 'done', align: 'right' },
              { label: 'Archive', key: 'archive', align: 'right' },
            ],
            rows: breakdownRows,
          })}
        </div>
      </section>
    ` : ''}
  </div>`;
}

export function renderBacklogSearch(
  _discovery: DiscoveryResult,
  query: string,
  results: BacklogItem[],
): string {
  const trimmed = query.trim();
  const resultList = results.length === 0
    ? emptyState(
      trimmed ? `No items found for "${trimmed}"` : 'Enter a search query',
      'Try searching by item ID, title, kind, or tags.',
    )
    : `<div class="card-grid">
      ${results.map(item => `<article class="card">
        <div class="card-body">
          <h3 class="card-title"><a href="/backlog/item/${encodeURIComponent(item.id)}">${escapeHtml(stripIdPrefix(item.id, item.title))}</a></h3>
          <p class="card-meta">${escapeHtml(item.id)}</p>
          <div class="kanban-card-meta">
            ${kindBadge(item.kind)}
            ${priorityBadge(normalizePriority(item.priority))}
            ${folderBadge(item.folder)}
          </div>
          <div class="kanban-card-tags">${renderTagPills(item.tags ?? [])}</div>
        </div>
      </article>`).join('')}
    </div>`;

  return `<div class="dashboard">
    ${pageHeader('🔎 Backlog Search', 'Search backlog items by keyword')}
    <form method="GET" action="/backlog/search" class="search-form">
      <input type="search" name="q" value="${escapeHtml(trimmed)}" placeholder="Search backlog..." class="search-input">
      <button type="submit" class="search-button">Search</button>
    </form>
    ${resultList}
  </div>`;
}
