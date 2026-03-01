import { escapeHtml } from './markdown.js';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'muted';

export function statusBadge(label: string, variant: BadgeVariant): string {
  return `<span class="badge badge--${variant}">${escapeHtml(label)}</span>`;
}

export function card(opts: {
  icon: string;
  title: string;
  meta?: string;
  link?: { href: string; text: string };
  body?: string;
}): string {
  const safeIcon = escapeHtml(opts.icon);
  const safeTitle = escapeHtml(opts.title);
  const meta = opts.meta ? `<p class="card-meta">${escapeHtml(opts.meta)}</p>` : '';
  const body = opts.body ? `<div class="card-copy">${escapeHtml(opts.body)}</div>` : '';
  const link = opts.link
    ? `<a href="${escapeHtml(opts.link.href)}" class="card-link">${escapeHtml(opts.link.text)}</a>`
    : '';

  return `<div class="card">
    <div class="card-icon">${safeIcon}</div>
    <div class="card-body">
      <h3 class="card-title">${safeTitle}</h3>
      ${meta}
      ${body}
    </div>
    ${link}
  </div>`;
}

export function dataTable(opts: {
  headers: { label: string; key: string; align?: 'left' | 'right' }[];
  rows: Record<string, string>[];
  emptyMessage?: string;
}): string {
  if (opts.rows.length === 0) {
    return `<div class="empty-state">${escapeHtml(opts.emptyMessage ?? 'No data available.')}</div>`;
  }

  const headerHtml = opts.headers
    .map((header) => {
      const align = header.align === 'right' ? ' style="text-align: right;"' : '';
      return `<th${align}>${escapeHtml(header.label)}</th>`;
    })
    .join('');

  const rowsHtml = opts.rows
    .map((row) => {
      const cells = opts.headers
        .map((header) => {
          const value = row[header.key] ?? '';
          const align = header.align === 'right' ? ' style="text-align: right;"' : '';
          return `<td${align}>${escapeHtml(value)}</td>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  return `<table class="table">
    <thead>
      <tr>${headerHtml}</tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>`;
}

export function breadcrumbs(segments: { label: string; href?: string }[]): string {
  const items = segments
    .map((segment, index) => {
      const current = index === segments.length - 1;
      const label = escapeHtml(segment.label);
      const content = segment.href && !current
        ? `<a href="${escapeHtml(segment.href)}">${label}</a>`
        : `<span>${label}</span>`;
      const separator = current ? '' : '<span class="breadcrumbs-sep">›</span>';
      return `<li>${content}${separator}</li>`;
    })
    .join('');

  return `<nav class="breadcrumbs" aria-label="Breadcrumb"><ol>${items}</ol></nav>`;
}

export function pageHeader(title: string, subtitle?: string): string {
  const subtitleHtml = subtitle ? `<p class="page-subtitle">${escapeHtml(subtitle)}</p>` : '';
  return `<header class="page-header">
    <h1 class="page-title">${escapeHtml(title)}</h1>
    ${subtitleHtml}
  </header>`;
}

export function metricCard(opts: {
  label: string;
  value: string | number;
  icon?: string;
  variant?: 'success' | 'warning' | 'danger' | 'info';
}): string {
  const variant = opts.variant ? ` metric-card--${opts.variant}` : '';
  const icon = opts.icon ? `<span class="metric-card-icon">${escapeHtml(opts.icon)}</span>` : '';
  return `<div class="metric-card${variant}">
    <div class="metric-card-top">
      ${icon}
      <span class="metric-card-label">${escapeHtml(opts.label)}</span>
    </div>
    <div class="metric-card-value">${escapeHtml(String(opts.value))}</div>
  </div>`;
}

export function emptyState(message: string, suggestion?: string): string {
  const suggestionHtml = suggestion
    ? `<p class="empty-state-suggestion">${escapeHtml(suggestion)}</p>`
    : '';
  return `<div class="empty-state">
    <p class="empty-state-message">${escapeHtml(message)}</p>
    ${suggestionHtml}
  </div>`;
}

export function priorityBadge(priority: 'high' | 'medium' | 'low'): string {
  const labels: Record<'high' | 'medium' | 'low', string> = {
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  };
  return `<span class="badge priority-${priority}">${labels[priority]}</span>`;
}

export function kindBadge(kind: string): string {
  const normalized = kind.trim().toLowerCase();
  const variantByKind: Record<string, BadgeVariant> = {
    epic: 'info',
    task: 'muted',
    bug: 'danger',
    feature: 'success',
    chore: 'warning',
  };
  const variant = variantByKind[normalized] ?? 'muted';
  return `<span class="badge badge--${variant}">${escapeHtml(kind)}</span>`;
}
