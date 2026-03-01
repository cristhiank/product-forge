import type { DiscoveryResult } from '../discovery.js';
import type { AgentWorker, HubMessage } from '../providers/agents.js';
import { breadcrumbs, dataTable, emptyState, metricCard, pageHeader, statusBadge } from './components.js';
import { escapeHtml } from './markdown.js';

function asIsoTime(value?: string): string {
  if (!value) {
    return '—';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

function asInt(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function asCurrency(value: unknown): string {
  const num = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return `$${num.toFixed(4)}`;
}

function workerStatusVariant(status: string): 'success' | 'warning' | 'danger' | 'info' | 'muted' {
  const normalized = status.toLowerCase();
  if (normalized === 'completed' || normalized === 'success' || normalized === 'done' || normalized === 'succeeded') {
    return 'success';
  }
  if (normalized === 'failed' || normalized === 'error' || normalized === 'crashed') {
    return 'danger';
  }
  if (normalized === 'lost') {
    return 'warning';
  }
  if (normalized === 'active' || normalized === 'running' || normalized === 'working' || normalized === 'in_progress') {
    return 'info';
  }
  return 'muted';
}

function isActiveStatus(status: string): boolean {
  const normalized = status.toLowerCase();
  return ['active', 'running', 'working', 'in_progress', 'queued'].includes(normalized);
}

function isCompletedStatus(status: string): boolean {
  const normalized = status.toLowerCase();
  return ['completed', 'success', 'done', 'succeeded'].includes(normalized);
}

function isFailedStatus(status: string): boolean {
  const normalized = status.toLowerCase();
  return ['failed', 'error', 'crashed'].includes(normalized);
}

function isLostStatus(status: string): boolean {
  return status.toLowerCase() === 'lost';
}

function isUnresolvedRequest(message: HubMessage): boolean {
  const type = (message.type ?? '').toLowerCase();
  if (type !== 'request') {
    return false;
  }

  const tags = (message.tags ?? []).map(tag => tag.toLowerCase());
  if (tags.includes('resolved') || tags.includes('closed') || tags.includes('done')) {
    return false;
  }

  const metadata = message.metadata;
  if (metadata && typeof metadata === 'object' && 'resolved' in metadata) {
    return metadata.resolved !== true;
  }

  return true;
}

function renderMetrics(workers: AgentWorker[]): string {
  const activeCount = workers.filter(worker => isActiveStatus(worker.status)).length;
  const completedCount = workers.filter(worker => isCompletedStatus(worker.status)).length;
  const failedCount = workers.filter(worker => isFailedStatus(worker.status)).length;
  const lostCount = workers.filter(worker => isLostStatus(worker.status)).length;
  const totalCost = workers.reduce((sum, worker) => sum + asInt(worker.costUsd), 0);

  return `<section class="card-grid">
    ${metricCard({ label: 'Active', value: activeCount, icon: '🟢', variant: 'info' })}
    ${metricCard({ label: 'Completed', value: completedCount, icon: '✅', variant: 'success' })}
    ${metricCard({ label: 'Failed', value: failedCount, icon: '❌', variant: 'danger' })}
    ${metricCard({ label: 'Lost', value: lostCount, icon: '⚠️', variant: 'warning' })}
    ${metricCard({ label: 'Total Cost', value: asCurrency(totalCost), icon: '💵', variant: 'warning' })}
  </section>`;
}

function renderWorkersTable(workers: AgentWorker[]): string {
  const sorted = [...workers].sort((a, b) => {
    const left = a.lastEventAt ? Date.parse(a.lastEventAt) : 0;
    const right = b.lastEventAt ? Date.parse(b.lastEventAt) : 0;
    return right - left;
  });

  const rows = sorted.map(worker => {
    const shortId = worker.id.slice(0, 8);
    const href = `/agents/worker/${encodeURIComponent(worker.id)}`;
    return {
      id: `<a href="${escapeHtml(href)}">${escapeHtml(shortId)}</a>`,
      status: statusBadge(worker.status || 'unknown', workerStatusVariant(worker.status || 'unknown')),
      agent: worker.agent ?? '—',
      model: worker.model ?? '—',
      turns: String(asInt(worker.turns)),
      errors: String(asInt(worker.errors)),
      cost: asCurrency(worker.costUsd),
      lastEvent: asIsoTime(worker.lastEventAt),
    };
  });

  return dataTable({
    headers: [
      { label: 'ID', key: 'id' },
      { label: 'Status', key: 'status' },
      { label: 'Agent', key: 'agent' },
      { label: 'Model', key: 'model' },
      { label: 'Turns', key: 'turns', align: 'right' },
      { label: 'Errors', key: 'errors', align: 'right' },
      { label: 'Cost', key: 'cost', align: 'right' },
      { label: 'Last Event', key: 'lastEvent' },
    ],
    rows,
    emptyMessage: 'No workers discovered yet.',
    rawHtmlKeys: ['id', 'status'],
  });
}

export function renderAgentsOverview(discovery: DiscoveryResult, workers: AgentWorker[], hasHub: boolean): string {
  const subtitle = hasHub
    ? `Workers dashboard for ${workers.length} worker${workers.length === 1 ? '' : 's'}`
    : 'Hub database not found — showing file-based workers only.';

  return `<div class="dashboard">
    ${pageHeader('Agents Workers Dashboard', subtitle)}
    ${renderMetrics(workers)}
    <section style="margin-top: 20px;">
      <h2 class="page-title" style="font-size: 16px;">Workers</h2>
      ${renderWorkersTable(workers)}
    </section>
    <section style="margin-top: 16px;">
      <a class="btn" href="/agents/messages">View Messages</a>
      <a class="btn" href="/agents/costs">View Costs</a>
      <a class="btn" href="/agents/incidents">View Incidents</a>
    </section>
    <p class="page-subtitle" style="margin-top: 12px;">Repository: <code>${escapeHtml(discovery.repoRoot)}</code></p>
  </div>`;
}

export function renderAgentWorkerDetail(discovery: DiscoveryResult, worker: AgentWorker, log: string): string {
  const workerId = escapeHtml(worker.id);

  const metadataTable = dataTable({
    headers: [
      { label: 'Status', key: 'status' },
      { label: 'Agent', key: 'agent' },
      { label: 'Model', key: 'model' },
      { label: 'Branch', key: 'branch' },
      { label: 'PID', key: 'pid' },
      { label: 'Registered', key: 'registered' },
      { label: 'Completed', key: 'completed' },
    ],
    rows: [
      {
        status: statusBadge(worker.status || 'unknown', workerStatusVariant(worker.status || 'unknown')),
        agent: worker.agent ?? '—',
        model: worker.model ?? '—',
        branch: worker.branch ?? '—',
        pid: worker.pid ? String(worker.pid) : '—',
        registered: asIsoTime(worker.registeredAt),
        completed: asIsoTime(worker.completedAt),
      },
    ],
    rawHtmlKeys: ['status'],
  });

  const costCards = `<section class="card-grid" style="margin-top: 16px;">
    ${metricCard({ label: 'Total Cost', value: asCurrency(worker.costUsd), icon: '💵', variant: 'warning' })}
    ${metricCard({ label: 'Turns', value: asInt(worker.turns), icon: '🔁', variant: 'info' })}
    ${metricCard({ label: 'Errors', value: asInt(worker.errors), icon: '⚠️', variant: asInt(worker.errors) > 0 ? 'danger' : 'success' })}
  </section>`;

  const commitsSection = worker.commits && worker.commits.length > 0
    ? `<section style="margin-top: 20px;">
        <h2 class="page-title" style="font-size: 16px;">Commits</h2>
        <ul>${worker.commits.map(commit => `<li><code>${escapeHtml(commit)}</code></li>`).join('')}</ul>
      </section>`
    : '';

  const filesSection = worker.filesChanged && worker.filesChanged.length > 0
    ? `<section style="margin-top: 20px;">
        <h2 class="page-title" style="font-size: 16px;">Files Changed</h2>
        <ul>${worker.filesChanged.map(file => `<li><code>${escapeHtml(file)}</code></li>`).join('')}</ul>
      </section>`
    : '';

  return `<div class="dashboard">
    ${breadcrumbs([
      { label: 'Agents', href: '/agents' },
      { label: 'Workers', href: '/agents' },
      { label: worker.id },
    ])}
    ${pageHeader(`Worker ${worker.id}`, `Detail view for worker ${worker.id}`)}

    <div class="action-bar">
      <form method="POST" action="/agents/worker/${encodeURIComponent(worker.id)}/sync">
        <button class="btn" type="submit">Sync</button>
      </form>
      <form method="POST" action="/agents/worker/${encodeURIComponent(worker.id)}/stop">
        <button class="btn btn--danger" type="submit">Stop</button>
      </form>
    </div>

    <section>
      <h2 class="page-title" style="font-size: 16px;">Metadata</h2>
      ${metadataTable}
    </section>

    ${costCards}
    ${commitsSection}
    ${filesSection}

    <section style="margin-top: 20px;">
      <h2 class="page-title" style="font-size: 16px;">Output Log (last 100 lines)</h2>
      <pre class="log-output">${escapeHtml(log || '(no output available)')}</pre>
    </section>

    <p class="page-subtitle" style="margin-top: 12px;">Worker ID: <code>${workerId}</code> · Repo: <code>${escapeHtml(discovery.repoRoot)}</code></p>
  </div>`;
}

export function renderAgentsMessages(discovery: DiscoveryResult, messages: HubMessage[]): string {
  const sorted = [...messages].sort((a, b) => {
    const left = a.createdAt ? Date.parse(a.createdAt) : 0;
    const right = b.createdAt ? Date.parse(b.createdAt) : 0;
    return left - right;
  });

  const messageCards = sorted.map((message) => {
    const type = (message.type ?? 'note').toLowerCase();
    const badgeVariant = type === 'decision'
      ? 'info'
      : type === 'request'
        ? 'warning'
        : type === 'status'
          ? 'success'
          : 'muted';

    const unresolved = isUnresolvedRequest(message);
    const extraClass = unresolved ? ' style="border-color: var(--warning); background: rgba(210, 153, 34, 0.08);"' : '';
    const thread = message.threadId ? `<span>🧵 Thread ${escapeHtml(message.threadId)}</span>` : '';
    const author = escapeHtml(message.author ?? 'unknown');
    const content = escapeHtml(message.content ?? '').replace(/\n/g, '<br>');

    return `<article class="message-card"${extraClass}>
      <div class="message-header">
        ${statusBadge(type, badgeVariant)}
        <span>${author}</span>
        <span>•</span>
        <time>${escapeHtml(asIsoTime(message.createdAt))}</time>
        ${thread}
        ${unresolved ? '<span class="badge badge--warning">Unresolved</span>' : ''}
      </div>
      <div class="message-content">${content || '<em>(empty message)</em>'}</div>
    </article>`;
  }).join('');

  return `<div class="dashboard">
    ${pageHeader('Hub Message Timeline', `Messages for ${escapeHtml(discovery.repoRoot)}`)}
    ${sorted.length > 0 ? messageCards : emptyState('No messages found.', 'Try syncing workers or posting hub activity.')}
  </div>`;
}

export function renderAgentsCosts(discovery: DiscoveryResult, workers: AgentWorker[]): string {
  const sorted = [...workers].sort((a, b) => asInt(b.costUsd) - asInt(a.costUsd));
  const totalCost = sorted.reduce((sum, worker) => sum + asInt(worker.costUsd), 0);

  const rows = sorted.map(worker => ({
    id: `<a href="/agents/worker/${encodeURIComponent(worker.id)}">${escapeHtml(worker.id.slice(0, 8))}</a>`,
    agent: worker.agent ?? '—',
    model: worker.model ?? '—',
    cost: asCurrency(worker.costUsd),
    turns: String(asInt(worker.turns)),
    errors: String(asInt(worker.errors)),
  }));

  const byModel = new Map<string, { workers: number; cost: number; turns: number }>();
  for (const worker of workers) {
    const model = worker.model ?? 'unknown';
    const current = byModel.get(model) ?? { workers: 0, cost: 0, turns: 0 };
    current.workers += 1;
    current.cost += asInt(worker.costUsd);
    current.turns += asInt(worker.turns);
    byModel.set(model, current);
  }

  const modelRows = [...byModel.entries()]
    .sort((a, b) => b[1].cost - a[1].cost)
    .map(([model, entry]) => ({
      model,
      workers: String(entry.workers),
      turns: String(entry.turns),
      cost: asCurrency(entry.cost),
    }));

  return `<div class="dashboard">
    ${pageHeader('Agents Cost Dashboard', `Cost overview for ${escapeHtml(discovery.repoRoot)}`)}
    <section class="card-grid">
      ${metricCard({ label: 'Total Cost', value: asCurrency(totalCost), icon: '💸', variant: 'warning' })}
      ${metricCard({ label: 'Workers With Cost', value: sorted.filter(worker => asInt(worker.costUsd) > 0).length, icon: '🤖', variant: 'info' })}
    </section>
    <section style="margin-top: 16px;">
      <h2 class="page-title" style="font-size: 16px;">Per Worker</h2>
      ${dataTable({
        headers: [
          { label: 'Worker', key: 'id' },
          { label: 'Agent', key: 'agent' },
          { label: 'Model', key: 'model' },
          { label: 'Turns', key: 'turns', align: 'right' },
          { label: 'Errors', key: 'errors', align: 'right' },
          { label: 'Cost', key: 'cost', align: 'right' },
        ],
        rows,
        rawHtmlKeys: ['id'],
        emptyMessage: 'No worker cost data available.',
      })}
    </section>
    <section style="margin-top: 20px;">
      <h2 class="page-title" style="font-size: 16px;">Per Model</h2>
      ${dataTable({
        headers: [
          { label: 'Model', key: 'model' },
          { label: 'Workers', key: 'workers', align: 'right' },
          { label: 'Turns', key: 'turns', align: 'right' },
          { label: 'Cost', key: 'cost', align: 'right' },
        ],
        rows: modelRows,
        emptyMessage: 'No model breakdown available.',
      })}
    </section>
  </div>`;
}

export function renderAgentsIncidents(discovery: DiscoveryResult, workers: AgentWorker[], messages: HubMessage[]): string {
  const failedWorkers = workers.filter(worker => isFailedStatus(worker.status));
  const lostWorkers = workers.filter(worker => isLostStatus(worker.status));
  const unresolvedRequests = messages.filter(message => isUnresolvedRequest(message));

  const failedSection = dataTable({
    headers: [
      { label: 'Worker', key: 'id' },
      { label: 'Status', key: 'status' },
      { label: 'Errors', key: 'errors', align: 'right' },
      { label: 'Last Event', key: 'lastEvent' },
    ],
    rows: failedWorkers.map(worker => ({
      id: `<a href="/agents/worker/${encodeURIComponent(worker.id)}">${escapeHtml(worker.id.slice(0, 8))}</a>`,
      status: statusBadge(worker.status, workerStatusVariant(worker.status)),
      errors: String(asInt(worker.errors)),
      lastEvent: asIsoTime(worker.lastEventAt),
    })),
    rawHtmlKeys: ['id', 'status'],
    emptyMessage: 'No failed workers detected.',
  });

  const lostSection = dataTable({
    headers: [
      { label: 'Worker', key: 'id' },
      { label: 'Agent', key: 'agent' },
      { label: 'Model', key: 'model' },
      { label: 'Last Event', key: 'lastEvent' },
    ],
    rows: lostWorkers.map(worker => ({
      id: `<a href="/agents/worker/${encodeURIComponent(worker.id)}">${escapeHtml(worker.id.slice(0, 8))}</a>`,
      agent: worker.agent ?? '—',
      model: worker.model ?? '—',
      lastEvent: asIsoTime(worker.lastEventAt),
    })),
    rawHtmlKeys: ['id'],
    emptyMessage: 'No lost workers detected.',
  });

  const unresolvedSection = unresolvedRequests.length > 0
    ? unresolvedRequests
      .map(message => `<article class="message-card" style="border-color: var(--warning); background: rgba(210, 153, 34, 0.08);">
          <div class="message-header">
            ${statusBadge('request', 'warning')}
            <span>${escapeHtml(message.author ?? 'unknown')}</span>
            <span>•</span>
            <time>${escapeHtml(asIsoTime(message.createdAt))}</time>
            ${message.threadId ? `<span>🧵 ${escapeHtml(message.threadId)}</span>` : ''}
          </div>
          <div class="message-content">${escapeHtml(message.content ?? '').replace(/\n/g, '<br>') || '<em>(empty request)</em>'}</div>
        </article>`)
      .join('')
    : emptyState('No unresolved requests.', 'All hub requests appear resolved.');

  return `<div class="dashboard">
    ${pageHeader('Agents Incidents', `Incident signals for ${escapeHtml(discovery.repoRoot)}`)}
    <section class="card-grid">
      ${metricCard({ label: 'Failed Workers', value: failedWorkers.length, icon: '❌', variant: 'danger' })}
      ${metricCard({ label: 'Lost Workers', value: lostWorkers.length, icon: '⚠️', variant: 'warning' })}
      ${metricCard({ label: 'Unresolved Requests', value: unresolvedRequests.length, icon: '📨', variant: 'warning' })}
    </section>
    <section style="margin-top: 20px;">
      <h2 class="page-title" style="font-size: 16px;">Failed Workers</h2>
      ${failedSection}
    </section>
    <section style="margin-top: 20px;">
      <h2 class="page-title" style="font-size: 16px;">Lost Workers</h2>
      ${lostSection}
    </section>
    <section style="margin-top: 20px;">
      <h2 class="page-title" style="font-size: 16px;">Unresolved Requests</h2>
      ${unresolvedSection}
    </section>
  </div>`;
}
