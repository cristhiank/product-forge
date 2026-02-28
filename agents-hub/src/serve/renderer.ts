/**
 * Server-rendered HTML templates for the agents-hub dashboard.
 * Pure functions — each returns an HTML string.
 */

import type {
  Message,
  SearchResult,
  ChannelInfo,
  HubStatus,
  Worker,
  WorkerSyncResult,
  OpsSummary,
  OpsToolSummary,
  OpsUsage,
  OpsActions,
  OperatorAction,
} from '../core/types.js';

// ── Helpers ──────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return Math.round(value).toLocaleString('en-US');
}

function formatTokens(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return formatNumber(value);
}

function formatUsd(value: number): string {
  const normalized = Number.isFinite(value) ? value : 0;
  return `$${normalized.toFixed(2)}`;
}

function shortModelName(model: string | null | undefined): string {
  if (!model) return 'unknown';
  if (model.length <= 28) return model;
  return `${model.slice(0, 25)}...`;
}

function authorEmoji(author: string): string {
  const lower = author.toLowerCase();
  if (lower.includes('scout')) return '🔍';
  if (lower.includes('creative')) return '💡';
  if (lower.includes('planner')) return '📋';
  if (lower.includes('verifier')) return '✅';
  if (lower.includes('executor')) return '⚙️';
  if (lower.includes('orchestrator')) return '🎯';
  if (lower.includes('super')) return '👑';
  if (lower.includes('memory')) return '🧠';
  if (lower.includes('system')) return '⚡';
  return '🤖';
}

function typeBadge(type: string): string {
  return `<span class="message-type-badge badge-${esc(type)}">${esc(type)}</span>`;
}

function workerHue(workerId: string): number {
  let hash = 0;
  for (let i = 0; i < workerId.length; i++) {
    hash = (hash * 31 + workerId.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}

function workerBadge(workerId: string | null): string {
  if (!workerId) return '';
  const hue = workerHue(workerId);
  const encodedWorkerId = encodeURIComponent(workerId);
  return `<a class="worker-attribution-badge" href="/worker/${esc(encodedWorkerId)}" style="--worker-hue:${hue}" title="View worker ${esc(workerId)}">${esc(workerId)}</a>`;
}

function tagPills(tags: string[]): string {
  if (!tags.length) return '';
  return tags.map((t) => {
    const cls = ['snippet', 'finding', 'trail', 'constraint', 'checkpoint'].includes(t) ? ` tag-${t}` : '';
    return `<span class="tag${cls}">${esc(t)}</span>`;
  }).join(' ');
}

function metadataBadges(metadata: Record<string, unknown>): string {
  const badges: string[] = [];

  // Confidence (for findings)
  if (metadata.confidence && typeof metadata.confidence === 'string' && ['high', 'medium', 'low'].includes(metadata.confidence)) {
    badges.push(`<span class="metadata-badge badge-confidence-${metadata.confidence}">${metadata.confidence} confidence</span>`);
  }

  // Decision status
  if (metadata.status && typeof metadata.status === 'string' && ['proposed', 'approved', 'rejected'].includes(metadata.status)) {
    badges.push(`<span class="metadata-badge badge-status-${metadata.status}">${metadata.status}</span>`);
  }

  // Request severity
  if (metadata.severity && typeof metadata.severity === 'string' && ['info', 'minor', 'major', 'blocker'].includes(metadata.severity)) {
    badges.push(`<span class="metadata-badge badge-severity-${metadata.severity}">${metadata.severity}</span>`);
  }

  // Resolved status (for requests)
  if (metadata.resolved !== undefined) {
    const status = metadata.resolved ? 'resolved' : 'unresolved';
    badges.push(`<span class="metadata-badge badge-${status}">${status}</span>`);
  }

  return badges.join(' ');
}

function progressBar(metadata: Record<string, unknown>): string {
  const step = typeof metadata.step === 'number' ? metadata.step : undefined;
  const totalSteps = typeof metadata.total_steps === 'number' ? metadata.total_steps
    : typeof metadata.totalSteps === 'number' ? metadata.totalSteps : undefined;
  if (step === undefined || totalSteps === undefined || totalSteps === 0) return '';
  const percent = Math.round((step / totalSteps) * 100);
  return `<div class="progress-container">
    <div class="progress-bar"><div class="progress-fill" style="width:${percent}%"></div></div>
    <div class="progress-text">Step ${step} of ${totalSteps} (${percent}%)</div>
  </div>`;
}

// ── Message Rendering ────────────────────────────────────────

/**
 * Render a single message as HTML
 * This structure is used both server-side (initial render) and client-side (SSE updates)
 */
export function renderMessage(msg: Message): string {
  const avatar = authorEmoji(msg.author);
  const timestamp = formatTimestamp(msg.createdAt);
  const worker = workerBadge(msg.workerId);
  const threadIndicator = msg.threadId ? `<div class="message-thread">💬 Reply in thread</div>` : '';
  const tags = tagPills(msg.tags);
  const badges = metadataBadges(msg.metadata);
  const progress = msg.type === 'status' ? progressBar(msg.metadata) : '';

  // Code snippet handling (for snippets)
  let codeBlock = '';
  if (msg.tags.includes('snippet') && msg.metadata.path) {
    const path = String(msg.metadata.path);
    const lines = msg.metadata.lines ? ` (L${JSON.stringify(msg.metadata.lines)})` : '';
    codeBlock = `<div class="message-code">
      <div class="message-code-header">
        <span class="message-code-path">${esc(path)}${lines}</span>
        <button class="message-code-toggle" onclick="this.parentElement.nextElementSibling.style.display=this.parentElement.nextElementSibling.style.display==='none'?'block':'none';this.textContent=this.textContent==='Show'?'Hide':'Show'">Hide</button>
      </div>
      <pre>${esc(msg.content)}</pre>
    </div>`;
  }

  return `<div class="message type-${esc(msg.type)}" data-id="${esc(msg.id)}">
    <div class="message-avatar">${avatar}</div>
    <div class="message-content">
      <div class="message-header">
        <span class="message-author">${esc(msg.author)}</span>
        ${worker}
        ${typeBadge(msg.type)}
        <span class="message-timestamp">${timestamp}</span>
      </div>
      ${codeBlock ? '' : `<div class="message-body">${esc(msg.content)}</div>`}
      ${codeBlock}
      ${tags ? `<div class="message-tags">${tags}</div>` : ''}
      ${badges ? `<div class="message-metadata">${badges}</div>` : ''}
      ${progress}
      ${threadIndicator}
    </div>
  </div>`;
}

/**
 * JavaScript function to create message elements client-side (for SSE)
 * Returns the function as a string to embed in HTML
 */
function clientRenderMessageFunction(): string {
  return `
function createMessageElement(msg) {
  const div = document.createElement('div');
  div.className = 'message type-' + msg.type;
  div.dataset.id = msg.id;

  const avatarEmojis = {
    scout: '🔍', creative: '💡', planner: '📋', verifier: '✅',
    executor: '⚙️', orchestrator: '🎯', super: '👑', memory: '🧠', system: '⚡'
  };
  let avatar = '🤖';
  for (const [key, emoji] of Object.entries(avatarEmojis)) {
    if (msg.author.toLowerCase().includes(key)) { avatar = emoji; break; }
  }

  const timestamp = formatTimestamp(msg.createdAt);

  function hashWorkerId(workerId) {
    let hash = 0;
    for (let i = 0; i < workerId.length; i++) {
      hash = (hash * 31 + workerId.charCodeAt(i)) >>> 0;
    }
    return hash % 360;
  }

  function renderWorkerBadge(workerId) {
    if (!workerId) return '';
    const id = String(workerId);
    const hue = hashWorkerId(id);
    const safeId = escapeHtml(id);
    return '<a class="worker-attribution-badge" href="/worker/' + encodeURIComponent(id) + '" style="--worker-hue:' + hue + '" title="View worker ' + safeId + '">' + safeId + '</a>';
  }

  const tags = msg.tags.map(t => {
    const cls = ['snippet','finding','trail','constraint','checkpoint'].includes(t) ? ' tag-'+t : '';
    return '<span class="tag' + cls + '">' + escapeHtml(t) + '</span>';
  }).join(' ');

  const badges = [];
  if (msg.metadata.confidence) badges.push('<span class="metadata-badge badge-confidence-'+msg.metadata.confidence+'">'+msg.metadata.confidence+' confidence</span>');
  if (msg.metadata.status && ['proposed','approved','rejected'].includes(msg.metadata.status)) badges.push('<span class="metadata-badge badge-status-'+msg.metadata.status+'">'+msg.metadata.status+'</span>');
  if (msg.metadata.severity) badges.push('<span class="metadata-badge badge-severity-'+msg.metadata.severity+'">'+msg.metadata.severity+'</span>');
  if (msg.metadata.resolved !== undefined) badges.push('<span class="metadata-badge badge-'+(msg.metadata.resolved?'resolved':'unresolved')+'">'+(msg.metadata.resolved?'resolved':'unresolved')+'</span>');

  let progress = '';
  const totalS = msg.metadata.total_steps || msg.metadata.totalSteps;
  if (msg.type === 'status' && msg.metadata.step && totalS) {
    const percent = Math.round((msg.metadata.step / totalS) * 100);
    progress = '<div class="progress-container"><div class="progress-bar"><div class="progress-fill" style="width:'+percent+'%"></div></div><div class="progress-text">Step '+msg.metadata.step+' of '+totalS+' ('+percent+'%)</div></div>';
  }

  const threadIndicator = msg.threadId ? '<div class="message-thread">💬 Reply in thread</div>' : '';

  let codeBlock = '';
  if (msg.tags.includes('snippet') && msg.metadata.path) {
    const lines = msg.metadata.lines ? ' (L'+JSON.stringify(msg.metadata.lines)+')' : '';
    codeBlock = '<div class="message-code"><div class="message-code-header"><span class="message-code-path">'+escapeHtml(msg.metadata.path)+lines+'</span><button class="message-code-toggle" onclick="this.parentElement.nextElementSibling.style.display=this.parentElement.nextElementSibling.style.display===\\'none\\'?\\'block\\':\\'none\\';this.textContent=this.textContent===\\'Show\\'?\\'Hide\\':\\'Show\\'">Hide</button></div><pre>'+escapeHtml(msg.content)+'</pre></div>';
  }

  div.innerHTML = '<div class="message-avatar">'+avatar+'</div><div class="message-content"><div class="message-header"><span class="message-author">'+escapeHtml(msg.author)+'</span>'+renderWorkerBadge(msg.workerId)+'<span class="message-type-badge badge-'+msg.type+'">'+msg.type+'</span><span class="message-timestamp">'+timestamp+'</span></div>'+(codeBlock?'':'<div class="message-body">'+escapeHtml(msg.content)+'</div>')+codeBlock+(tags?'<div class="message-tags">'+tags+'</div>':'')+(badges.length?'<div class="message-metadata">'+badges.join(' ')+'</div>':'')+ progress + threadIndicator + '</div>';

  return div;
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function formatTimestamp(iso) {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (seconds < 60) return 'just now';
  if (minutes < 60) return minutes + 'm ago';
  if (hours < 24) return hours + 'h ago';
  if (days < 7) return days + 'd ago';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
`;
}

// ── Layout Shell ─────────────────────────────────────────────

interface LayoutOpts {
  title: string;
  channels: ChannelInfo[];
  currentChannel?: string;
  activePage: 'overview' | 'timeline' | 'status' | 'search' | 'thread' | 'workers' | 'usage' | 'tools' | 'incidents';
  body: string;
}

export function layout(opts: LayoutOpts): string {
  // Sort channels: #main, #general, then #worker-* alphabetically
  const sorted = [...opts.channels].sort((a, b) => {
    if (a.name === '#main') return -1;
    if (b.name === '#main') return 1;
    if (a.name === '#general') return -1;
    if (b.name === '#general') return 1;
    return a.name.localeCompare(b.name);
  });

  const channelNav = sorted.map((ch) => {
    const isActive = ch.name === opts.currentChannel;
    const href = ch.name === '#main' ? '/timeline' : `/channel/${encodeURIComponent(ch.name.slice(1))}`;
    return `<li><a href="${href}" class="${isActive ? 'active' : ''}">
      ${esc(ch.name)}
      ${ch.messageCount > 0 ? `<span class="count">${ch.messageCount}</span>` : ''}
    </a></li>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(opts.title)} — Agents Hub</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body data-channel="${esc(opts.currentChannel || '')}">
  <div class="layout">
    <nav class="sidebar">
      <div class="sidebar-brand">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <circle cx="12" cy="12" r="6"/>
          <circle cx="12" cy="12" r="2"/>
        </svg>
        Agents Hub
      </div>

      <div class="sidebar-section">
        <div class="sidebar-section-title">Navigation</div>
        <ul class="sidebar-nav">
          <li><a href="/" class="${opts.activePage === 'overview' ? 'active' : ''}">🎛️ Overview</a></li>
          <li><a href="/timeline" class="${opts.activePage === 'timeline' ? 'active' : ''}">📡 Timeline</a></li>
          <li><a href="/status" class="${opts.activePage === 'status' ? 'active' : ''}">📊 Status</a></li>
          <li><a href="/search" class="${opts.activePage === 'search' ? 'active' : ''}">🔍 Search</a></li>
          <li><a href="/workers" class="${opts.activePage === 'workers' ? 'active' : ''}">🤖 Workers</a></li>
          <li><a href="/usage" class="${opts.activePage === 'usage' ? 'active' : ''}">💸 Usage</a></li>
          <li><a href="/tools" class="${opts.activePage === 'tools' ? 'active' : ''}">🧰 Tools</a></li>
          <li><a href="/incidents" class="${opts.activePage === 'incidents' ? 'active' : ''}">🚨 Incidents</a></li>
        </ul>
      </div>

      <div class="sidebar-section">
        <div class="sidebar-section-title">Channels</div>
        <ul class="sidebar-nav">
          ${channelNav}
        </ul>
      </div>
    </nav>

    <main class="main">
      ${opts.body}
    </main>
  </div>

  <script>
    ${clientRenderMessageFunction()}

    // SSE connection for real-time updates
    if (typeof EventSource !== 'undefined') {
      const channel = document.body.dataset.channel || '';
      const eventUrl = '/events' + (channel ? '?channel=' + encodeURIComponent(channel) : '');
      const es = new EventSource(eventUrl);

      const timeline = document.getElementById('timeline');
      const workersTableBody = document.getElementById('workers-table-body');
      const workersSubtitle = document.getElementById('workers-page-subtitle');
      let autoScroll = true;

      function workerEmoji(agentType) {
        if (!agentType) return '🤖';
        const lower = String(agentType).toLowerCase();
        if (lower.includes('scout')) return '🔍';
        if (lower.includes('creative')) return '💡';
        if (lower.includes('planner')) return '📋';
        if (lower.includes('verifier')) return '✅';
        if (lower.includes('executor')) return '⚙️';
        if (lower.includes('orchestrator')) return '🎯';
        if (lower.includes('super')) return '👑';
        if (lower.includes('memory')) return '🧠';
        return '🤖';
      }

      function workerStatusBadge(status) {
        return '<span class="worker-status-badge wstatus-' + escapeHtml(status) + '">' + escapeHtml(status) + '</span>';
      }

      function workerHealthBadge(health) {
        return '<span class="worker-health-badge health-' + escapeHtml(health) + '">' + escapeHtml(health) + '</span>';
      }

      function formatDurationSince(registeredAt) {
        const elapsed = Date.now() - new Date(registeredAt).getTime();
        const seconds = Math.floor(elapsed / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        if (hours > 0) return hours + 'h ' + (minutes % 60) + 'm';
        if (minutes > 0) return minutes + 'm';
        return seconds + 's';
      }

      function setWorkerSummaryValue(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = String(value);
      }

      function renderWorkers(workers) {
        if (!workersTableBody) return;
        if (!Array.isArray(workers) || workers.length === 0) {
          workersTableBody.innerHTML = '<tr><td colspan="12" class="worker-empty">No workers registered yet</td></tr>';
          if (workersSubtitle) workersSubtitle.textContent = '0 workers registered';
          setWorkerSummaryValue('workers-summary-total', 0);
          setWorkerSummaryValue('workers-summary-healthy', 0);
          setWorkerSummaryValue('workers-summary-stale', 0);
          setWorkerSummaryValue('workers-summary-lost', 0);
          setWorkerSummaryValue('workers-summary-failed', 0);
          setWorkerSummaryValue('workers-summary-completed', 0);
          return;
        }

        const healthy = workers.filter((w) => w.health === 'healthy').length;
        const stale = workers.filter((w) => w.health === 'stale').length;
        const lost = workers.filter((w) => w.health === 'lost').length;
        const failed = workers.filter((w) => w.status === 'failed').length;
        const completed = workers.filter((w) => w.status === 'completed').length;

        workersTableBody.innerHTML = workers.map((w) => {
          const id = escapeHtml(String(w.id || ''));
          const encodedId = encodeURIComponent(String(w.id || ''));
          const agentType = escapeHtml(String(w.agentType || 'unknown'));
          const channelLabel = escapeHtml(String(w.channel || ''));
          const modelRaw = String(w.activeModel || 'unknown');
          const modelLabel = escapeHtml(modelRaw.length > 28 ? modelRaw.slice(0, 25) + '...' : modelRaw);
          const status = String(w.status || 'active');
          const health = String(w.health || 'healthy');
          const errors = Number(w.errors || 0);
          const usage = w.usage && typeof w.usage === 'object' ? w.usage : {};
          const inputTokens = Number(usage.inputTokens || 0);
          const outputTokens = Number(usage.outputTokens || 0);
          const estimatedCostUsd = Number(w.estimatedCostUsd || 0);
          const lastActivity = w.lastEventAt ? formatTimestamp(w.lastEventAt) : 'never';
          const duration = formatDurationSince(w.registeredAt);
          const tokenLabel = (inputTokens >= 1000 ? (inputTokens / 1000).toFixed(1) + 'k' : String(Math.round(inputTokens))) +
            ' / ' +
            (outputTokens >= 1000 ? (outputTokens / 1000).toFixed(1) + 'k' : String(Math.round(outputTokens)));
          return '<tr class="worker-row" onclick="window.location=\\'/worker/' + encodedId + '\\'">' +
            '<td class="worker-id-cell"><a href="/worker/' + encodedId + '">' + id + '</a></td>' +
            '<td>' + workerEmoji(agentType) + ' ' + agentType + '</td>' +
            '<td>' + workerStatusBadge(status) + ' ' + workerHealthBadge(health) + '</td>' +
            '<td><code>' + channelLabel + '</code></td>' +
            '<td title="' + escapeHtml(modelRaw) + '">' + modelLabel + '</td>' +
            '<td class="worker-time">' + tokenLabel + '</td>' +
            '<td class="worker-time">$' + estimatedCostUsd.toFixed(2) + '</td>' +
            '<td class="worker-counter">' + Number(w.toolCalls || 0) + '</td>' +
            '<td class="worker-counter">' + Number(w.turns || 0) + '</td>' +
            '<td class="worker-counter' + (errors > 0 ? ' worker-counter-error' : '') + '">' + errors + '</td>' +
            '<td class="worker-time">' + lastActivity + '</td>' +
            '<td class="worker-time">' + duration + '</td>' +
          '</tr>';
        }).join('');

        if (workersSubtitle) workersSubtitle.textContent = workers.length + ' workers registered';
        setWorkerSummaryValue('workers-summary-total', workers.length);
        setWorkerSummaryValue('workers-summary-healthy', healthy);
        setWorkerSummaryValue('workers-summary-stale', stale);
        setWorkerSummaryValue('workers-summary-lost', lost);
        setWorkerSummaryValue('workers-summary-failed', failed);
        setWorkerSummaryValue('workers-summary-completed', completed);
      }

      function refreshWorkers() {
        if (!workersTableBody) return;
        fetch('/api/workers')
          .then((response) => {
            if (!response.ok) throw new Error('Failed to fetch workers');
            return response.json();
          })
          .then((payload) => {
            renderWorkers(payload.workers || []);
          })
          .catch((err) => {
            console.error('Failed to refresh workers UI:', err);
          });
      }

      if (timeline) {
        timeline.addEventListener('scroll', () => {
          autoScroll = timeline.scrollHeight - timeline.scrollTop - timeline.clientHeight < 50;
        });

        es.addEventListener('message', (e) => {
          try {
            const msg = JSON.parse(e.data);
            const el = createMessageElement(msg);
            timeline.appendChild(el);
            
            if (autoScroll) {
              timeline.scrollTo({ top: timeline.scrollHeight, behavior: 'smooth' });
            } else {
              // Show "new messages" indicator
              let indicator = document.querySelector('.new-message-indicator');
              if (!indicator) {
                indicator = document.createElement('div');
                indicator.className = 'new-message-indicator';
                indicator.innerHTML = '↓ New messages';
                indicator.onclick = () => {
                  timeline.scrollTo({ top: timeline.scrollHeight, behavior: 'smooth' });
                  indicator.classList.remove('visible');
                };
                document.body.appendChild(indicator);
              }
              indicator.classList.add('visible');
            }
          } catch (err) {
            console.error('Failed to parse SSE message:', err);
          }
        });
      }

      if (workersTableBody) {
        es.addEventListener('worker_sync', () => {
          refreshWorkers();
        });
      }

      if (timeline || workersTableBody) {
        es.onerror = () => {
          es.close();
          setTimeout(() => location.reload(), 5000);
        };
      }
    }
  </script>
</body>
</html>`;
}

// ── Timeline View ────────────────────────────────────────────

export function timelinePage(messages: Message[], channel?: string): string {
  const channelName = channel ? `#${channel}` : 'All Channels';
  const messagesHtml = messages.length
    ? messages.map(renderMessage).join('\n')
    : `<div class="empty-state"><div class="empty-state-icon">💬</div><div class="empty-state-text">No messages yet. Start posting to the hub!</div></div>`;

  return `
    <div class="page-header">
      <div>
        <div class="page-title">${esc(channelName)}</div>
        <div class="page-subtitle">${messages.length} messages</div>
      </div>
    </div>
    <div class="timeline-container">
      <div class="timeline" id="timeline">
        ${messagesHtml}
      </div>
    </div>`;
}

// ── Ops Overview / Usage / Tools ──────────────────────────────

export function overviewPage(
  summary: OpsSummary,
  usage: OpsUsage,
  tools: OpsToolSummary[],
  actions: OpsActions,
): string {
  const topModels = summary.modelDistribution.slice(0, 6);
  const topProviders = summary.providerDistribution.slice(0, 6);
  const topWorkers = usage.topWorkers.slice(0, 10);
  const hotTools = tools.slice(0, 10);
  const recentActions = actions.actions.slice(0, 10);

  const modelRows = topModels.length
    ? topModels.map((item) => `
        <tr>
          <td><code>${esc(shortModelName(item.model))}</code></td>
          <td>${esc(item.provider)}</td>
          <td class="worker-counter">${formatTokens(item.totalTokens)}</td>
          <td class="worker-time">${formatUsd(item.costUsd)}</td>
        </tr>
      `).join('\n')
    : `<tr><td colspan="4" class="worker-empty">No model usage recorded yet.</td></tr>`;

  const providerRows = topProviders.length
    ? topProviders.map((item) => `
        <tr>
          <td>${esc(item.provider)}</td>
          <td class="worker-counter">${formatTokens(item.totalTokens)}</td>
          <td class="worker-time">${formatUsd(item.costUsd)}</td>
          <td class="worker-counter">${formatNumber(item.requests)}</td>
        </tr>
      `).join('\n')
    : `<tr><td colspan="4" class="worker-empty">No provider usage recorded yet.</td></tr>`;

  const workerRows = topWorkers.length
    ? topWorkers.map((worker) => `
        <tr>
          <td><a href="/worker/${encodeURIComponent(worker.workerId)}"><code>${esc(worker.workerId)}</code></a></td>
          <td><code>${esc(worker.channel)}</code></td>
          <td>${esc(shortModelName(worker.activeModel))}</td>
          <td class="worker-counter">${formatTokens(worker.totalTokens)}</td>
          <td class="worker-time">${formatUsd(worker.estimatedCostUsd)}</td>
        </tr>
      `).join('\n')
    : `<tr><td colspan="5" class="worker-empty">No worker usage recorded yet.</td></tr>`;

  const toolRows = hotTools.length
    ? hotTools.map((tool) => `
        <tr>
          <td><code>${esc(tool.toolName)}</code></td>
          <td class="worker-counter">${formatNumber(tool.calls)}</td>
          <td class="worker-time">${formatDurationMs(tool.avgMs)}</td>
          <td class="worker-time">${formatDurationMs(tool.maxMs)}</td>
          <td class="worker-counter ${tool.errorCount > 0 ? 'worker-counter-error' : ''}">${formatNumber(tool.errorCount)}</td>
          <td class="worker-time">${(tool.errorRate * 100).toFixed(1)}%</td>
        </tr>
      `).join('\n')
    : `<tr><td colspan="6" class="worker-empty">No tool telemetry yet.</td></tr>`;

  const actionRows = recentActions.length
    ? recentActions.map((action) => `
        <tr>
          <td class="worker-time">${formatTimestamp(action.completedAt)}</td>
          <td><code>${esc(action.workerId)}</code></td>
          <td>${esc(action.actionType)}</td>
          <td>${statusBadge(action.status)}</td>
          <td>${action.error ? esc(action.error) : '<span class="worker-time">ok</span>'}</td>
        </tr>
      `).join('\n')
    : `<tr><td colspan="5" class="worker-empty">No operator actions yet.</td></tr>`;

  return `
    <div class="page-header">
      <div>
        <div class="page-title">Ops Overview</div>
        <div class="page-subtitle">Mission-control view for workers, incidents, tools, and token/cost telemetry</div>
      </div>
    </div>

    <div class="workers-summary">
      <div class="workers-summary-item summary-healthy">
        <span class="workers-summary-count">${summary.workers.active}</span>
        <span class="workers-summary-label">Active Workers</span>
      </div>
      <div class="workers-summary-item summary-stale">
        <span class="workers-summary-count">${summary.workers.stale + summary.workers.lost}</span>
        <span class="workers-summary-label">Stale + Lost</span>
      </div>
      <div class="workers-summary-item summary-failed">
        <span class="workers-summary-count">${summary.incidents.workerIncidents}</span>
        <span class="workers-summary-label">Worker Incidents</span>
      </div>
      <div class="workers-summary-item">
        <span class="workers-summary-count">${summary.incidents.unresolvedRequests}</span>
        <span class="workers-summary-label">Unresolved Requests</span>
      </div>
      <div class="workers-summary-item">
        <span class="workers-summary-count">${formatUsd(summary.usage.estimatedCostUsd)}</span>
        <span class="workers-summary-label">Estimated Cost</span>
      </div>
      <div class="workers-summary-item">
        <span class="workers-summary-count">${formatUsd(summary.usage.burnRateUsdPerHour)}/h</span>
        <span class="workers-summary-label">Burn Rate</span>
      </div>
      <div class="workers-summary-item">
        <span class="workers-summary-count">${formatTokens(summary.usage.totalTokens)}</span>
        <span class="workers-summary-label">Total Tokens</span>
      </div>
      <div class="workers-summary-item">
        <span class="workers-summary-count">${(summary.throughput.toolErrorRate * 100).toFixed(1)}%</span>
        <span class="workers-summary-label">Tool Error Rate</span>
      </div>
    </div>

    <div class="incidents-grid">
      <section class="incidents-section">
        <h2>Model Distribution</h2>
        <div class="workers-table-wrap">
          <table class="workers-table">
            <thead><tr><th>Model</th><th>Provider</th><th>Tokens</th><th>Cost</th></tr></thead>
            <tbody>${modelRows}</tbody>
          </table>
        </div>
      </section>

      <section class="incidents-section">
        <h2>Provider Distribution</h2>
        <div class="workers-table-wrap">
          <table class="workers-table">
            <thead><tr><th>Provider</th><th>Tokens</th><th>Cost</th><th>Requests</th></tr></thead>
            <tbody>${providerRows}</tbody>
          </table>
        </div>
      </section>

      <section class="incidents-section">
        <h2>Top Workers by Cost</h2>
        <div class="workers-table-wrap">
          <table class="workers-table">
            <thead><tr><th>Worker</th><th>Channel</th><th>Active Model</th><th>Tokens</th><th>Cost</th></tr></thead>
            <tbody>${workerRows}</tbody>
          </table>
        </div>
      </section>

      <section class="incidents-section">
        <h2>Tool Hotlist</h2>
        <div class="workers-table-wrap">
          <table class="workers-table">
            <thead><tr><th>Tool</th><th>Calls</th><th>Avg</th><th>Max</th><th>Errors</th><th>Error %</th></tr></thead>
            <tbody>${toolRows}</tbody>
          </table>
        </div>
      </section>

      <section class="incidents-section">
        <h2>Recent Operator Actions</h2>
        <div class="workers-table-wrap">
          <table class="workers-table incidents-table">
            <thead><tr><th>When</th><th>Worker</th><th>Action</th><th>Status</th><th>Detail</th></tr></thead>
            <tbody>${actionRows}</tbody>
          </table>
        </div>
      </section>
    </div>
  `;
}

export function usagePage(usage: OpsUsage): string {
  const modelRows = usage.byModel.length
    ? usage.byModel.map((item) => `
        <tr>
          <td><code>${esc(shortModelName(item.model))}</code></td>
          <td>${esc(item.provider)}</td>
          <td class="worker-counter">${formatTokens(item.inputTokens)}</td>
          <td class="worker-counter">${formatTokens(item.outputTokens)}</td>
          <td class="worker-counter">${formatTokens(item.cachedInputTokens)}</td>
          <td class="worker-counter">${formatTokens(item.totalTokens)}</td>
          <td class="worker-time">${formatUsd(item.costUsd)}</td>
        </tr>
      `).join('\n')
    : `<tr><td colspan="7" class="worker-empty">No model usage recorded yet.</td></tr>`;

  const providerRows = usage.byProvider.length
    ? usage.byProvider.map((item) => `
        <tr>
          <td>${esc(item.provider)}</td>
          <td class="worker-counter">${formatTokens(item.inputTokens)}</td>
          <td class="worker-counter">${formatTokens(item.outputTokens)}</td>
          <td class="worker-counter">${formatTokens(item.cachedInputTokens)}</td>
          <td class="worker-counter">${formatTokens(item.totalTokens)}</td>
          <td class="worker-time">${formatUsd(item.costUsd)}</td>
          <td class="worker-counter">${formatNumber(item.requests)}</td>
        </tr>
      `).join('\n')
    : `<tr><td colspan="7" class="worker-empty">No provider usage recorded yet.</td></tr>`;

  return `
    <div class="page-header">
      <div>
        <div class="page-title">Usage & Cost</div>
        <div class="page-subtitle">Token flow, estimated spend, and model/provider distribution</div>
      </div>
    </div>

    <div class="workers-summary">
      <div class="workers-summary-item"><span class="workers-summary-count">${formatTokens(usage.totals.inputTokens)}</span><span class="workers-summary-label">Input Tokens</span></div>
      <div class="workers-summary-item"><span class="workers-summary-count">${formatTokens(usage.totals.outputTokens)}</span><span class="workers-summary-label">Output Tokens</span></div>
      <div class="workers-summary-item"><span class="workers-summary-count">${formatTokens(usage.totals.cachedInputTokens)}</span><span class="workers-summary-label">Cached Input</span></div>
      <div class="workers-summary-item"><span class="workers-summary-count">${formatTokens(usage.totals.compactionReclaimedTokens)}</span><span class="workers-summary-label">Compaction Reclaimed</span></div>
      <div class="workers-summary-item"><span class="workers-summary-count">${formatUsd(usage.totals.estimatedCostUsd)}</span><span class="workers-summary-label">Estimated Cost</span></div>
      <div class="workers-summary-item"><span class="workers-summary-count">${formatUsd(usage.totals.burnRateUsdPerHour)}/h</span><span class="workers-summary-label">Burn Rate</span></div>
    </div>

    <div class="incidents-grid">
      <section class="incidents-section">
        <h2>By Model</h2>
        <div class="workers-table-wrap">
          <table class="workers-table">
            <thead><tr><th>Model</th><th>Provider</th><th>Input</th><th>Output</th><th>Cache In</th><th>Total</th><th>Cost</th></tr></thead>
            <tbody>${modelRows}</tbody>
          </table>
        </div>
      </section>
      <section class="incidents-section">
        <h2>By Provider</h2>
        <div class="workers-table-wrap">
          <table class="workers-table">
            <thead><tr><th>Provider</th><th>Input</th><th>Output</th><th>Cache In</th><th>Total</th><th>Cost</th><th>Requests</th></tr></thead>
            <tbody>${providerRows}</tbody>
          </table>
        </div>
      </section>
    </div>
  `;
}

export function toolsPage(tools: OpsToolSummary[]): string {
  const rows = tools.length
    ? tools.map((tool) => `
        <tr>
          <td><code>${esc(tool.toolName)}</code></td>
          <td class="worker-counter">${formatNumber(tool.calls)}</td>
          <td class="worker-time">${formatDurationMs(tool.avgMs)}</td>
          <td class="worker-time">${formatDurationMs(tool.maxMs)}</td>
          <td class="worker-counter">${formatNumber(tool.slowCount)}</td>
          <td class="worker-counter ${tool.errorCount > 0 ? 'worker-counter-error' : ''}">${formatNumber(tool.errorCount)}</td>
          <td class="worker-time">${(tool.errorRate * 100).toFixed(1)}%</td>
        </tr>
      `).join('\n')
    : `<tr><td colspan="7" class="worker-empty">No tool telemetry recorded yet.</td></tr>`;

  return `
    <div class="page-header">
      <div>
        <div class="page-title">Tool Reliability</div>
        <div class="page-subtitle">Fleet-wide tool latency and failure telemetry</div>
      </div>
    </div>
    <div class="workers-table-wrap">
      <table class="workers-table">
        <thead>
          <tr>
            <th>Tool</th>
            <th>Calls</th>
            <th>Avg</th>
            <th>Max</th>
            <th>Slow (&gt;5s)</th>
            <th>Errors</th>
            <th>Error %</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

// ── Status Page ──────────────────────────────────────────────

interface WorkerHealthSummary {
  active: number;
  stale: number;
  lost: number;
  failed: number;
}

export function statusPage(
  status: HubStatus,
  workerSummary: WorkerHealthSummary = { active: 0, stale: 0, lost: 0, failed: 0 }
): string {
  const summary = workerSummary;
  const channelStats = Object.entries(status.channels)
    .sort(([a], [b]) => {
      if (a === '#main') return -1;
      if (b === '#main') return 1;
      if (a === '#general') return -1;
      if (b === '#general') return 1;
      return a.localeCompare(b);
    })
    .map(([name, stats]) => `
      <div class="channel-stat">
        <div class="channel-stat-header">
          <span class="channel-stat-name">${esc(name)}</span>
          <span class="channel-stat-count">${stats.messages} messages</span>
        </div>
        ${stats.unresolvedRequests > 0 ? `<div style="color:var(--color-warning);font-size:13px;">⚠️ ${stats.unresolvedRequests} unresolved requests</div>` : ''}
      </div>
    `).join('\n');

  const recentActivity = status.recentActivity.slice(0, 10).map((act) => `
    <div style="padding:8px 0;border-bottom:1px solid var(--color-border);font-size:13px;">
      <span style="color:var(--color-text-muted);">${formatTimestamp(act.timestamp)}</span> · 
      <span style="color:var(--color-text-secondary);">${esc(act.channel)}</span> · 
      <span class="message-type-badge badge-${esc(act.type)}">${esc(act.type)}</span>
    </div>
  `).join('');

  return `
    <div class="page-header">
      <div>
        <div class="page-title">Hub Status</div>
        <div class="page-subtitle">Hub ID: ${esc(status.hubId)} · Mode: ${esc(status.mode)}</div>
      </div>
    </div>

    <div class="status-grid">
      <div class="stat-card">
        <div class="stat-card-label">Total Messages</div>
        <div class="stat-card-value">${status.totalMessages}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Channels</div>
        <div class="stat-card-value">${Object.keys(status.channels).length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Unresolved Requests</div>
        <div class="stat-card-value" style="color:${status.totalUnresolved > 0 ? 'var(--color-warning)' : 'var(--color-success)'}">${status.totalUnresolved}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Workers Active</div>
        <div class="stat-card-value" style="color:${summary.active > 0 ? 'var(--color-success)' : 'var(--color-text)'}">${summary.active}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Workers Stale</div>
        <div class="stat-card-value" style="color:${summary.stale > 0 ? 'var(--color-warning)' : 'var(--color-text)'}">${summary.stale}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Workers Lost</div>
        <div class="stat-card-value" style="color:${summary.lost > 0 ? 'var(--color-text-muted)' : 'var(--color-text)'}">${summary.lost}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Workers Failed</div>
        <div class="stat-card-value" style="color:${summary.failed > 0 ? 'var(--color-danger)' : 'var(--color-text)'}">${summary.failed}</div>
      </div>
    </div>

    <div class="channel-stats">
      <h2 style="font-size:16px;font-weight:600;margin-bottom:12px;color:var(--color-text);">Channel Statistics</h2>
      ${channelStats}
    </div>

    ${status.recentActivity.length > 0 ? `
    <div style="margin-top:24px;">
      <h2 style="font-size:16px;font-weight:600;margin-bottom:12px;color:var(--color-text);">Recent Activity</h2>
      <div style="background:var(--color-bg-elevated);border:1px solid var(--color-border);border-radius:var(--radius);padding:12px;">
        ${recentActivity}
      </div>
    </div>` : ''}
  `;
}

// ── Search Page ──────────────────────────────────────────────

export function searchPage(results: SearchResult[], query: string): string {
  const resultsHtml = results.length
    ? `<ul class="search-results">
        ${results.map((r) => `<li class="search-result" onclick="window.location='/thread/${esc(r.id)}'">
          <div class="search-result-header">
            <span class="search-result-channel">${esc(r.channel)}</span>
            <span class="message-author">${esc(r.author)}</span>
            ${typeBadge(r.type)}
            <span class="message-timestamp">${formatTimestamp(r.createdAt)}</span>
          </div>
          <div class="search-result-highlight">${r.highlightedContent || esc(r.content.slice(0, 200))}</div>
          ${r.tags.length ? `<div class="message-tags">${tagPills(r.tags)}</div>` : ''}
        </li>`).join('\n')}
      </ul>`
    : query
      ? `<div class="empty-state"><div class="empty-state-icon">🔍</div><div class="empty-state-text">No results for "${esc(query)}"</div></div>`
      : `<div class="empty-state"><div class="empty-state-icon">🔍</div><div class="empty-state-text">Enter a search term above</div></div>`;

  return `
    <div class="page-header">
      <div>
        <div class="page-title">Search</div>
        ${query ? `<div class="page-subtitle">${results.length} result(s) for "${esc(query)}"</div>` : ''}
      </div>
    </div>
    <form action="/search" method="get" class="search-form" style="margin-bottom:20px;max-width:100%;">
      <input class="search-input" type="text" name="q" placeholder="Search messages…" value="${esc(query)}" autofocus>
      <button class="search-btn" type="submit">Search</button>
    </form>
    ${resultsHtml}`;
}

// ── Thread View ──────────────────────────────────────────────

export function threadView(parent: Message, replies: Message[]): string {
  const parentHtml = renderMessage(parent);
  const repliesHtml = replies.map(renderMessage).join('\n');

  return `
    <div class="thread-container">
      <div class="page-header">
        <div>
          <div class="page-title">Thread</div>
          <div class="page-subtitle">${replies.length} replies</div>
        </div>
      </div>

      <div class="thread-parent">
        ${parentHtml}
      </div>

      ${replies.length > 0 ? `
      <div class="thread-replies">
        ${repliesHtml}
      </div>` : `<div class="empty-state"><div class="empty-state-icon">💬</div><div class="empty-state-text">No replies yet</div></div>`}
    </div>`;
}

// ── Workers Page ─────────────────────────────────────────────

export interface WorkerWithHealth extends Worker {
  health: 'healthy' | 'stale' | 'lost';
}

interface IncidentCluster {
  key: string;
  label: string;
  count: number;
  lastSeen: string;
  workerIds: string[];
  requestIds: string[];
}

function incidentTimestamp(iso: string | null | undefined): number {
  if (!iso) return 0;
  const ts = new Date(iso).getTime();
  return Number.isNaN(ts) ? 0 : ts;
}

function clusterSignature(content: string): string {
  const normalized = content
    .toLowerCase()
    .replace(/[0-9a-f]{8,}/g, '#')
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized.slice(0, 90);
}

function firstNonEmptyLine(content: string): string {
  const line = content.split('\n').map(s => s.trim()).find(Boolean) || '';
  return line.length > 140 ? `${line.slice(0, 137)}...` : line;
}

function buildIncidentClusters(workers: WorkerWithHealth[], unresolvedRequests: Message[]): IncidentCluster[] {
  const clusters = new Map<string, IncidentCluster>();

  for (const worker of workers) {
    const eventType = worker.lastEventType || 'unknown';
    const key = `worker:${worker.status}:${worker.health}:${eventType}`;
    const incidentAt = worker.lastEventAt ?? worker.completedAt ?? worker.registeredAt;
    const label = `Worker ${worker.status}/${worker.health} · ${eventType}`;
    const existing = clusters.get(key);
    if (existing) {
      existing.count += 1;
      if (incidentTimestamp(incidentAt) > incidentTimestamp(existing.lastSeen)) existing.lastSeen = incidentAt;
      if (!existing.workerIds.includes(worker.id)) existing.workerIds.push(worker.id);
    } else {
      clusters.set(key, {
        key,
        label,
        count: 1,
        lastSeen: incidentAt,
        workerIds: [worker.id],
        requestIds: [],
      });
    }
  }

  for (const req of unresolvedRequests) {
    const severity = typeof req.metadata.severity === 'string' ? req.metadata.severity : 'unknown';
    const signature = clusterSignature(req.content);
    const key = `request:${severity}:${signature}`;
    const preview = firstNonEmptyLine(req.content);
    const label = `Request ${severity} · ${preview || 'unspecified'}`;
    const existing = clusters.get(key);
    if (existing) {
      existing.count += 1;
      if (incidentTimestamp(req.createdAt) > incidentTimestamp(existing.lastSeen)) existing.lastSeen = req.createdAt;
      if (!existing.requestIds.includes(req.id)) existing.requestIds.push(req.id);
    } else {
      clusters.set(key, {
        key,
        label,
        count: 1,
        lastSeen: req.createdAt,
        workerIds: [],
        requestIds: [req.id],
      });
    }
  }

  return Array.from(clusters.values())
    .sort((a, b) => incidentTimestamp(b.lastSeen) - incidentTimestamp(a.lastSeen) || b.count - a.count || a.label.localeCompare(b.label));
}

function agentTypeEmoji(agentType: string | null): string {
  if (!agentType) return '🤖';
  const lower = agentType.toLowerCase();
  if (lower.includes('scout')) return '🔍';
  if (lower.includes('creative')) return '💡';
  if (lower.includes('planner')) return '📋';
  if (lower.includes('verifier')) return '✅';
  if (lower.includes('executor')) return '⚙️';
  if (lower.includes('orchestrator')) return '🎯';
  if (lower.includes('super')) return '👑';
  if (lower.includes('memory')) return '🧠';
  return '🤖';
}

function healthBadge(health: string): string {
  return `<span class="worker-health-badge health-${esc(health)}">${esc(health)}</span>`;
}

function statusBadge(status: string): string {
  return `<span class="worker-status-badge wstatus-${esc(status)}">${esc(status)}</span>`;
}

function formatDuration(startIso: string): string {
  const elapsed = Date.now() - new Date(startIso).getTime();
  const seconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

function formatDurationMs(durationMs: number): string {
  if (durationMs >= 1000) {
    const seconds = durationMs / 1000;
    return `${seconds >= 10 ? seconds.toFixed(0) : seconds.toFixed(1)}s`;
  }
  return `${Math.round(durationMs)}ms`;
}

function renderWorkerRow(w: WorkerWithHealth): string {
  const emoji = agentTypeEmoji(w.agentType);
  const duration = formatDuration(w.registeredAt);
  const lastActivity = w.lastEventAt ? formatTimestamp(w.lastEventAt) : 'never';
  const inputTokens = w.usage?.inputTokens ?? 0;
  const outputTokens = w.usage?.outputTokens ?? 0;
  const modelLabel = shortModelName(w.activeModel);
  return `<tr class="worker-row" onclick="window.location='/worker/${esc(w.id)}'">
    <td class="worker-id-cell"><a href="/worker/${esc(w.id)}">${esc(w.id)}</a></td>
    <td>${emoji} ${esc(w.agentType || 'unknown')}</td>
    <td>${statusBadge(w.status)} ${healthBadge(w.health)}</td>
    <td><code>${esc(w.channel)}</code></td>
    <td title="${esc(w.activeModel || 'unknown')}">${esc(modelLabel)}</td>
    <td class="worker-time">${formatTokens(inputTokens)} / ${formatTokens(outputTokens)}</td>
    <td class="worker-time">${formatUsd(w.estimatedCostUsd ?? 0)}</td>
    <td class="worker-counter">${w.toolCalls}</td>
    <td class="worker-counter">${w.turns}</td>
    <td class="worker-counter ${w.errors > 0 ? 'worker-counter-error' : ''}">${w.errors}</td>
    <td class="worker-time">${lastActivity}</td>
    <td class="worker-time">${duration}</td>
  </tr>`;
}

export function workersPage(workers: WorkerWithHealth[]): string {
  const total = workers.length;
  const healthy = workers.filter(w => w.health === 'healthy').length;
  const stale = workers.filter(w => w.health === 'stale').length;
  const lost = workers.filter(w => w.health === 'lost').length;
  const failed = workers.filter(w => w.status === 'failed').length;
  const completed = workers.filter(w => w.status === 'completed').length;

  const summaryBar = `
    <div class="workers-summary">
      <div class="workers-summary-item">
        <span class="workers-summary-count" id="workers-summary-total">${total}</span>
        <span class="workers-summary-label">Total</span>
      </div>
      <div class="workers-summary-item summary-healthy">
        <span class="workers-summary-count" id="workers-summary-healthy">${healthy}</span>
        <span class="workers-summary-label">Healthy</span>
      </div>
      <div class="workers-summary-item summary-stale">
        <span class="workers-summary-count" id="workers-summary-stale">${stale}</span>
        <span class="workers-summary-label">Stale</span>
      </div>
      <div class="workers-summary-item summary-lost">
        <span class="workers-summary-count" id="workers-summary-lost">${lost}</span>
        <span class="workers-summary-label">Lost</span>
      </div>
      <div class="workers-summary-item summary-failed">
        <span class="workers-summary-count" id="workers-summary-failed">${failed}</span>
        <span class="workers-summary-label">Failed</span>
      </div>
      <div class="workers-summary-item summary-completed">
        <span class="workers-summary-count" id="workers-summary-completed">${completed}</span>
        <span class="workers-summary-label">Completed</span>
      </div>
    </div>`;

  const tableRows = workers.length
    ? workers.map(renderWorkerRow).join('\n')
    : `<tr><td colspan="12" class="worker-empty">No workers registered yet</td></tr>`;

  const table = `
    <div class="workers-table-wrap">
      <table class="workers-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Agent Type</th>
            <th>Status</th>
            <th>Channel</th>
            <th>Model</th>
            <th>Tokens (In/Out)</th>
            <th>Cost</th>
            <th>Tool Calls</th>
            <th>Turns</th>
            <th>Errors</th>
            <th>Last Activity</th>
            <th>Duration</th>
          </tr>
        </thead>
        <tbody id="workers-table-body">
          ${tableRows}
        </tbody>
      </table>
    </div>`;

  return `
    <div class="page-header">
      <div>
        <div class="page-title">Workers</div>
        <div class="page-subtitle" id="workers-page-subtitle">${total} workers registered</div>
      </div>
    </div>
    ${summaryBar}
    ${table}`;
}

export function incidentsPage(workers: WorkerWithHealth[], unresolvedRequests: Message[]): string {
  const incidentWorkers = workers
    .filter(w => w.health !== 'healthy' || w.status === 'failed' || w.status === 'lost' || w.errors > 0)
    .sort((a, b) => {
      const aTs = incidentTimestamp(a.lastEventAt ?? a.completedAt ?? a.registeredAt);
      const bTs = incidentTimestamp(b.lastEventAt ?? b.completedAt ?? b.registeredAt);
      return bTs - aTs || b.errors - a.errors || a.id.localeCompare(b.id);
    });

  const unresolvedSorted = [...unresolvedRequests]
    .sort((a, b) => incidentTimestamp(b.createdAt) - incidentTimestamp(a.createdAt));
  const clusters = buildIncidentClusters(incidentWorkers, unresolvedSorted);

  const workerRows = incidentWorkers.length
    ? incidentWorkers.map((w) => {
      const encodedId = encodeURIComponent(w.id);
      const severity = w.status === 'failed' || w.health === 'lost' || w.errors > 0 ? 'major' : 'minor';
      const stopDisabled = !(w.pid && w.status === 'active');
      const stopTitle = stopDisabled ? 'Stop action only available for active workers with a PID' : 'Stop worker process';
      return `<tr>
        <td><a href="/worker/${encodedId}"><code>${esc(w.id)}</code></a></td>
        <td>${statusBadge(w.status)} ${healthBadge(w.health)}</td>
        <td><span class="metadata-badge badge-severity-${esc(severity)}">${esc(severity)}</span></td>
        <td class="worker-counter ${w.errors > 0 ? 'worker-counter-error' : ''}">${w.errors}</td>
        <td class="worker-time">${w.lastEventAt ? formatTimestamp(w.lastEventAt) : 'never'}</td>
        <td class="incident-actions">
          <a class="incident-action-link" href="/worker/${encodedId}">View detail</a>
          <form class="incident-action-form" action="/workers/${encodedId}/sync?redirect=%2Fincidents" method="post">
            <button type="submit" class="incident-action-btn">Retry sync</button>
          </form>
          <form class="incident-action-form" action="/workers/${encodedId}/stop?redirect=%2Fincidents" method="post">
            <button type="submit" class="incident-action-btn incident-action-btn-danger" ${stopDisabled ? `disabled title="${esc(stopTitle)}"` : `title="${esc(stopTitle)}"`}>Stop worker</button>
          </form>
        </td>
      </tr>`;
    }).join('\n')
    : `<tr><td colspan="6" class="worker-empty">No stale/lost/failed worker incidents right now.</td></tr>`;

  const requestRows = unresolvedSorted.length
    ? unresolvedSorted.map((req) => {
      const severity = typeof req.metadata.severity === 'string' ? req.metadata.severity : 'info';
      const preview = firstNonEmptyLine(req.content);
      return `<tr>
        <td class="worker-time">${formatTimestamp(req.createdAt)}</td>
        <td><code>${esc(req.channel)}</code></td>
        <td><span class="metadata-badge badge-severity-${esc(severity)}">${esc(severity)}</span></td>
        <td>${esc(preview || req.content)}</td>
        <td><a class="incident-action-link" href="/thread/${esc(req.id)}">View detail</a></td>
      </tr>`;
    }).join('\n')
    : `<tr><td colspan="5" class="worker-empty">No unresolved requests.</td></tr>`;

  const clusterItems = clusters.length
    ? `<ul class="incident-cluster-list">
        ${clusters.map((cluster) => `
          <li class="incident-cluster-item">
            <div class="incident-cluster-main">
              <span class="incident-cluster-count">${cluster.count}</span>
              <span class="incident-cluster-label">${esc(cluster.label)}</span>
            </div>
            <div class="incident-cluster-meta">
              <span>Last seen: ${formatTimestamp(cluster.lastSeen)}</span>
              ${cluster.workerIds.length > 0 ? `<span>Workers: ${cluster.workerIds.slice(0, 3).map(id => `<a href="/worker/${encodeURIComponent(id)}"><code>${esc(id)}</code></a>`).join(', ')}${cluster.workerIds.length > 3 ? ` +${cluster.workerIds.length - 3}` : ''}</span>` : ''}
              ${cluster.requestIds.length > 0 ? `<span>Requests: ${cluster.requestIds.slice(0, 2).map(id => `<a href="/thread/${esc(id)}"><code>${esc(id)}</code></a>`).join(', ')}${cluster.requestIds.length > 2 ? ` +${cluster.requestIds.length - 2}` : ''}</span>` : ''}
            </div>
          </li>
        `).join('\n')}
      </ul>`
    : `<div class="worker-detail-empty">No error clusters detected.</div>`;

  return `
    <div class="page-header">
      <div>
        <div class="page-title">Incidents</div>
        <div class="page-subtitle">Operational triage for worker failures, unresolved requests, and clustered errors</div>
      </div>
    </div>

    <div class="workers-summary">
      <div class="workers-summary-item summary-failed">
        <span class="workers-summary-count">${incidentWorkers.length}</span>
        <span class="workers-summary-label">Worker Incidents</span>
      </div>
      <div class="workers-summary-item summary-stale">
        <span class="workers-summary-count">${unresolvedSorted.length}</span>
        <span class="workers-summary-label">Unresolved Requests</span>
      </div>
      <div class="workers-summary-item">
        <span class="workers-summary-count">${clusters.length}</span>
        <span class="workers-summary-label">Error Clusters</span>
      </div>
    </div>

    <div class="incidents-grid">
      <section class="incidents-section">
        <h2>Stale/Lost/Failed Workers</h2>
        <div class="workers-table-wrap">
          <table class="workers-table incidents-table">
            <thead>
              <tr>
                <th>Worker</th>
                <th>Status</th>
                <th>Severity</th>
                <th>Errors</th>
                <th>Last Activity</th>
                <th>Quick Actions</th>
              </tr>
            </thead>
            <tbody>${workerRows}</tbody>
          </table>
        </div>
      </section>

      <section class="incidents-section">
        <h2>Unresolved Requests</h2>
        <div class="workers-table-wrap">
          <table class="workers-table incidents-table">
            <thead>
              <tr>
                <th>Newest</th>
                <th>Channel</th>
                <th>Severity</th>
                <th>Summary</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>${requestRows}</tbody>
          </table>
        </div>
      </section>

      <section class="incidents-section">
        <h2>Error Clusters</h2>
        ${clusterItems}
      </section>
    </div>
  `;
}

export function workerDetailPage(
  worker: WorkerWithHealth,
  relatedMessages: Message[],
  sync: WorkerSyncResult | null,
  actionHistory: OperatorAction[] = [],
): string {
  const emoji = agentTypeEmoji(worker.agentType);
  const significantEvents = sync?.significantEvents ?? [];
  const toolDurationStats = sync?.toolDurationStats ?? [];
  const slowTools = sync?.slowTools ?? [];
  const timelineHtml = significantEvents.length
    ? `<ul class="worker-detail-timeline">
        ${significantEvents.map((event) => `
          <li class="worker-detail-event">
            <div class="worker-detail-event-type">${esc(event.type)}</div>
            <div class="worker-detail-event-summary">${esc(event.summary)}</div>
            <div class="worker-detail-event-time">${formatTimestamp(event.timestamp)}</div>
          </li>
        `).join('\n')}
      </ul>`
    : `<div class="worker-detail-empty">No significant events from the latest sync.</div>`;
  const toolStatsHtml = toolDurationStats.length
    ? `<div class="workers-table-wrap">
        <table class="workers-table">
          <thead>
            <tr>
              <th>Tool</th>
              <th>Calls</th>
              <th>Avg</th>
              <th>Max</th>
              <th>Slow (&gt;5s)</th>
            </tr>
          </thead>
          <tbody>
            ${toolDurationStats.map((stat) => `
              <tr>
                <td><code>${esc(stat.toolName)}</code></td>
                <td class="worker-counter">${stat.count}</td>
                <td class="worker-time">${formatDurationMs(stat.avgMs)}</td>
                <td class="worker-time">${formatDurationMs(stat.maxMs)}</td>
                <td class="worker-counter ${stat.slowCount > 0 ? 'worker-counter-error' : ''}">${stat.slowCount}</td>
              </tr>
            `).join('\n')}
          </tbody>
        </table>
      </div>`
    : `<div class="worker-detail-empty">No completed start→complete tool pairs yet.</div>`;
  const slowToolsHtml = slowTools.length
    ? `<ul class="worker-detail-timeline">
        ${slowTools.map((entry) => `
          <li class="worker-detail-event">
            <div class="worker-detail-event-type">${esc(entry.toolName)}</div>
            <div class="worker-detail-event-summary">
              ${formatDurationMs(entry.durationMs)}${entry.success ? '' : ' (failed)'}${entry.toolCallId ? ` · ${esc(entry.toolCallId)}` : ''}
            </div>
            <div class="worker-detail-event-time">${formatTimestamp(entry.completedAt)}</div>
          </li>
        `).join('\n')}
      </ul>`
    : `<div class="worker-detail-empty">No slow tools detected (threshold: 5s).</div>`;

  const messagesHtml = relatedMessages.length
    ? relatedMessages.map(renderMessage).join('\n')
    : `<div class="worker-detail-empty">No related hub messages for this worker yet.</div>`;
  const usage = worker.usage ?? {
    inputTokens: 0,
    outputTokens: 0,
    cachedInputTokens: 0,
    cachedOutputTokens: 0,
    compactionInputTokens: 0,
    compactionOutputTokens: 0,
    compactionCachedInputTokens: 0,
    compactionReclaimedTokens: 0,
    totalTokens: 0,
  };
  const tokenTelemetryMissing = usage.totalTokens === 0 && worker.toolCalls > 0;
  const tokenTelemetryHint = tokenTelemetryMissing
    ? `<div class="worker-detail-empty">Token telemetry was not emitted by this session source; model/provider request activity is shown where available.</div>`
    : '';
  const modelDistribution = Object.values(worker.modelUsage ?? {})
    .sort((a, b) => b.totalTokens - a.totalTokens || b.costUsd - a.costUsd || a.model.localeCompare(b.model));
  const providerDistribution = Object.values(worker.providerUsage ?? {})
    .sort((a, b) => b.totalTokens - a.totalTokens || b.costUsd - a.costUsd || a.provider.localeCompare(b.provider));
  const modelUsageHtml = modelDistribution.length
    ? `<div class="workers-table-wrap">
        <table class="workers-table">
          <thead><tr><th>Model</th><th>Provider</th><th>Tokens</th><th>Cost</th><th>Requests</th></tr></thead>
          <tbody>
            ${modelDistribution.map((entry) => `
              <tr>
                <td><code title="${esc(entry.model)}">${esc(shortModelName(entry.model))}</code></td>
                <td>${esc(entry.provider)}</td>
                <td class="worker-counter">${formatTokens(entry.totalTokens)}</td>
                <td class="worker-time">${formatUsd(entry.costUsd)}</td>
                <td class="worker-counter">${formatNumber(entry.requests)}</td>
              </tr>
            `).join('\n')}
          </tbody>
        </table>
      </div>`
    : `<div class="worker-detail-empty">No model usage captured for this worker yet.</div>`;
  const providerUsageHtml = providerDistribution.length
    ? `<div class="workers-table-wrap">
        <table class="workers-table">
          <thead><tr><th>Provider</th><th>Tokens</th><th>Cost</th><th>Requests</th></tr></thead>
          <tbody>
            ${providerDistribution.map((entry) => `
              <tr>
                <td>${esc(entry.provider)}</td>
                <td class="worker-counter">${formatTokens(entry.totalTokens)}</td>
                <td class="worker-time">${formatUsd(entry.costUsd)}</td>
                <td class="worker-counter">${formatNumber(entry.requests)}</td>
              </tr>
            `).join('\n')}
          </tbody>
        </table>
      </div>`
    : `<div class="worker-detail-empty">No provider usage captured for this worker yet.</div>`;
  const actionRows = actionHistory.length
    ? actionHistory.map((action) => `
        <tr>
          <td class="worker-time">${formatTimestamp(action.completedAt)}</td>
          <td>${esc(action.actionType)}</td>
          <td>${statusBadge(action.status)}</td>
          <td>${action.error ? esc(action.error) : '<span class="worker-time">ok</span>'}</td>
        </tr>
      `).join('\n')
    : `<tr><td colspan="4" class="worker-empty">No operator actions for this worker yet.</td></tr>`;

  return `
    <div class="page-header">
      <div>
        <div class="page-title">${emoji} Worker ${esc(worker.id)}</div>
        <div class="page-subtitle">
          ${statusBadge(worker.status)} ${healthBadge(worker.health)} · <code>${esc(worker.channel)}</code>
        </div>
      </div>
      <a href="/workers" class="worker-detail-back-link">← Back to workers</a>
    </div>

    <div class="worker-detail-metrics">
      <div class="worker-detail-metric">
        <span class="worker-detail-metric-label">Tool Calls</span>
        <span class="worker-detail-metric-value">${worker.toolCalls}</span>
      </div>
      <div class="worker-detail-metric">
        <span class="worker-detail-metric-label">Turns</span>
        <span class="worker-detail-metric-value">${worker.turns}</span>
      </div>
      <div class="worker-detail-metric">
        <span class="worker-detail-metric-label">Errors</span>
        <span class="worker-detail-metric-value ${worker.errors > 0 ? 'worker-counter-error' : ''}">${worker.errors}</span>
      </div>
      <div class="worker-detail-metric">
        <span class="worker-detail-metric-label">Active Model</span>
        <span class="worker-detail-metric-value" title="${esc(worker.activeModel || 'unknown')}">${esc(shortModelName(worker.activeModel))}</span>
      </div>
      <div class="worker-detail-metric">
        <span class="worker-detail-metric-label">Provider</span>
        <span class="worker-detail-metric-value">${esc(worker.activeProvider || 'unknown')}</span>
      </div>
      <div class="worker-detail-metric">
        <span class="worker-detail-metric-label">Input Tokens</span>
        <span class="worker-detail-metric-value">${formatTokens(usage.inputTokens)}</span>
      </div>
      <div class="worker-detail-metric">
        <span class="worker-detail-metric-label">Output Tokens</span>
        <span class="worker-detail-metric-value">${formatTokens(usage.outputTokens)}</span>
      </div>
      <div class="worker-detail-metric">
        <span class="worker-detail-metric-label">Total Tokens</span>
        <span class="worker-detail-metric-value">${formatTokens(usage.totalTokens)}</span>
      </div>
      <div class="worker-detail-metric">
        <span class="worker-detail-metric-label">Est. Cost</span>
        <span class="worker-detail-metric-value">${formatUsd(worker.estimatedCostUsd ?? 0)}</span>
      </div>
      <div class="worker-detail-metric">
        <span class="worker-detail-metric-label">Model Switches</span>
        <span class="worker-detail-metric-value">${formatNumber(worker.modelSwitches ?? 0)}</span>
      </div>
      <div class="worker-detail-metric">
        <span class="worker-detail-metric-label">Compaction Reclaimed</span>
        <span class="worker-detail-metric-value">${formatTokens(usage.compactionReclaimedTokens)}</span>
      </div>
      <div class="worker-detail-metric">
        <span class="worker-detail-metric-label">Registered</span>
        <span class="worker-detail-metric-value worker-time">${formatTimestamp(worker.registeredAt)}</span>
      </div>
      <div class="worker-detail-metric">
        <span class="worker-detail-metric-label">Last Activity</span>
        <span class="worker-detail-metric-value worker-time">${worker.lastEventAt ? formatTimestamp(worker.lastEventAt) : 'never'}</span>
      </div>
      <div class="worker-detail-metric">
        <span class="worker-detail-metric-label">Last Event</span>
        <span class="worker-detail-metric-value worker-time">${esc(worker.lastEventType || 'none')}</span>
      </div>
      <div class="worker-detail-metric">
        <span class="worker-detail-metric-label">Slow Tools</span>
        <span class="worker-detail-metric-value ${slowTools.length > 0 ? 'worker-counter-error' : ''}">${slowTools.length}</span>
      </div>
    </div>

    <div class="worker-detail-grid">
      <section class="worker-detail-section">
        <h2>Timeline</h2>
        ${timelineHtml}
      </section>
      <section class="worker-detail-section">
        <h2>Tool Duration Stats</h2>
        ${toolStatsHtml}
      </section>
      <section class="worker-detail-section">
        <h2>Slow Tools (&gt;5s)</h2>
        ${slowToolsHtml}
      </section>
      <section class="worker-detail-section">
        <h2>Related Messages (${relatedMessages.length})</h2>
        <div class="worker-detail-messages">
          ${messagesHtml}
        </div>
      </section>
      <section class="worker-detail-section">
        <h2>Token Usage</h2>
        <ul class="worker-detail-timeline">
          <li class="worker-detail-event">
            <div class="worker-detail-event-type">Usage</div>
            <div class="worker-detail-event-summary">
              ${formatTokens(usage.inputTokens)} input · ${formatTokens(usage.outputTokens)} output · ${formatTokens(usage.cachedInputTokens)} cached input
            </div>
            <div class="worker-detail-event-time">${formatUsd(worker.estimatedCostUsd ?? 0)} estimated cost</div>
          </li>
          <li class="worker-detail-event">
            <div class="worker-detail-event-type">Compaction</div>
            <div class="worker-detail-event-summary">
              ${formatTokens(usage.compactionInputTokens)} in · ${formatTokens(usage.compactionOutputTokens)} out · ${formatTokens(usage.compactionCachedInputTokens)} cached
            </div>
            <div class="worker-detail-event-time">${formatTokens(usage.compactionReclaimedTokens)} reclaimed</div>
          </li>
        </ul>
        ${tokenTelemetryHint}
      </section>
      <section class="worker-detail-section">
        <h2>Model Usage</h2>
        ${modelUsageHtml}
      </section>
      <section class="worker-detail-section">
        <h2>Provider Usage</h2>
        ${providerUsageHtml}
      </section>
      <section class="worker-detail-section">
        <h2>Operator Actions (${actionHistory.length})</h2>
        <div class="workers-table-wrap">
          <table class="workers-table incidents-table">
            <thead><tr><th>When</th><th>Action</th><th>Status</th><th>Detail</th></tr></thead>
            <tbody>${actionRows}</tbody>
          </table>
        </div>
      </section>

      <section class="worker-detail-section worker-detail-full-width" style="grid-column: 1 / -1;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
            <h2 style="margin: 0;">Transcript</h2>
            <div style="display: flex; gap: 8px; align-items: center;">
              <div id="view-toggle-group" style="display: flex; gap: 4px; border: 1px solid #444; border-radius: 4px; background: #1a1a1a;">
                <button id="view-toggle-conversation" class="worker-detail-view-toggle" data-view="conversation" style="padding: 4px 12px; border: none; background: #2a2a2a; color: #fff; cursor: pointer; border-radius: 3px;">Conversation</button>
                <button id="view-toggle-raw" class="worker-detail-view-toggle active" data-view="raw" style="padding: 4px 12px; border: none; background: #444; color: #fff; cursor: pointer; border-radius: 3px;">Raw</button>
              </div>
              <button id="load-older-btn" class="worker-detail-refresh-btn" style="padding: 4px 12px; border: 1px solid #444; background: #2a2a2a; color: #fff; cursor: pointer; border-radius: 4px; display: none;">Load Older</button>
              <button id="refresh-events-btn" class="worker-detail-refresh-btn" style="padding: 4px 12px; border: 1px solid #444; background: #2a2a2a; color: #fff; cursor: pointer; border-radius: 4px;">Refresh</button>
            </div>
        </div>
        <div id="events-log-container" style="max-height: 600px; overflow-y: auto; border: 1px solid #333; background: #111; padding: 0; font-family: monospace; font-size: 12px; border-radius: 4px;">
          <div style="padding: 12px; color: #888;">Click Refresh to load events...</div>
        </div>
      </section>
    </div>

    <script>
    (function() {
      const workerId = ${JSON.stringify(worker.id)};
      const container = document.getElementById('events-log-container');
      const refreshBtn = document.getElementById('refresh-events-btn');
      const loadOlderBtn = document.getElementById('load-older-btn');
      const conversationToggle = document.getElementById('view-toggle-conversation');
      const rawToggle = document.getElementById('view-toggle-raw');
      
      let currentView = 'raw';
      let currentCursor = null;
      let currentEvents = [];
      let currentConversationItems = [];
      
      function escapeHtml(str) {
        if (!str) return '';
        return String(str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      }
      
      function updateToggleStyles() {
        const toggles = [conversationToggle, rawToggle];
        toggles.forEach(btn => {
          const isActive = btn.dataset.view === currentView;
          btn.style.background = isActive ? '#444' : '#2a2a2a';
          btn.classList.toggle('active', isActive);
        });
      }

      function renderRawEvents(events) {
        if (!events || !events.length) {
          return '<div style="padding: 12px; color: #888;">No events found.</div>';
        }
        
        // Render events (newest first in display)
        const eventsHtml = events.slice().reverse().map((evt) => {
          const isError = evt.type === 'session.error' || evt.type === 'tool.error' || (evt.data && evt.data.success === false);
            const isUser = evt.type === 'turn.user_message' || evt.type === 'user.message';
            const isAssistant = evt.type === 'turn.assistant_message' || evt.type === 'assistant.message';
          const isTool = evt.type.startsWith('tool.');
          
          let contentStyle = 'color: #aaa;';
          if (isError) contentStyle = 'color: #ff6b6b;';
          else if (isUser) contentStyle = 'color: #4cd964;';
          else if (isAssistant) contentStyle = 'color: #60a5fa;';
          else if (isTool) contentStyle = 'color: #fbbf24;';
          
          const json = JSON.stringify(evt.data, null, 2);
          
          return \`
            <div style="border-bottom: 1px solid #222; padding: 8px 12px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span style="font-weight: bold; \${contentStyle}">\${escapeHtml(evt.type)}</span>
                <span style="color: #666;">\${escapeHtml(evt.timestamp || '')}</span>
              </div>
              <div style="white-space: pre-wrap; word-break: break-all; color: #ccc;">\${escapeHtml(json)}</div>
            </div>
          \`;
        }).join('');
        
        return eventsHtml;
      }
      
      function renderConversation(items) {
        if (!items || !items.length) {
          return '<div style="padding: 12px; color: #888;">No conversation items found.</div>';
        }
        
        // Render conversation items (newest first in display)
        const itemsHtml = items.slice().reverse().map((item) => {
          let icon = '•';
          let color = '#aaa';
          
          if (item.type === 'user_message') {
            icon = '👤';
            color = '#4cd964';
          } else if (item.type === 'assistant_message') {
            icon = '🤖';
            color = '#60a5fa';
          } else if (item.type === 'tool_lifecycle') {
            icon = '🔧';
            color = '#fbbf24';
          } else if (item.type === 'session_event') {
            icon = '⚙️';
            color = '#a78bfa';
          } else if (item.type === 'error') {
            icon = '❌';
            color = '#ff6b6b';
          }
          
          return \`
            <div style="border-bottom: 1px solid #222; padding: 8px 12px;">
              <div style="display: flex; gap: 8px; margin-bottom: 4px;">
                <span style="font-size: 16px;">\${icon}</span>
                <div style="flex: 1;">
                  <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span style="font-weight: bold; color: \${color};">\${escapeHtml(item.type.replace(/_/g, ' '))}</span>
                    <span style="color: #666; font-size: 11px;">\${escapeHtml(item.timestamp || '')}</span>
                  </div>
                  <div style="color: #ccc; white-space: pre-wrap; word-break: break-word;">\${escapeHtml(item.content)}</div>
                </div>
              </div>
            </div>
          \`;
        }).join('');
        
        return itemsHtml;
      }

      async function loadEvents(append = false) {
        if (!append) {
          container.innerHTML = '<div style="padding: 12px; color: #888;">Loading events...</div>';
        }
        
        try {
          const url = \`/api/workers/\${encodeURIComponent(workerId)}/events?limit=100&view=\${currentView}\${currentCursor && append ? '&cursor=' + encodeURIComponent(currentCursor) : ''}\`;
          const res = await fetch(url);
          const data = await res.json();
          
          if (data.error) {
            container.innerHTML = \`<div style="padding: 12px; color: #ff6b6b;">Error: \${escapeHtml(data.error)}</div>\`;
            loadOlderBtn.style.display = 'none';
            return;
          }
          
          const pageEvents = data.events || [];
          const pageConversationItems = data.conversationItems || [];
          if (append) {
            currentEvents = [...pageEvents, ...currentEvents];
            currentConversationItems = [...pageConversationItems, ...currentConversationItems];
          } else {
            currentEvents = pageEvents;
            currentConversationItems = pageConversationItems;
          }
          
          currentCursor = data.cursor;
          loadOlderBtn.style.display = data.hasMore ? 'block' : 'none';
          
          let contentHtml = '';
          if (currentView === 'conversation') {
            contentHtml = renderConversation(currentConversationItems);
          } else {
            contentHtml = renderRawEvents(currentEvents);
          }
          
          container.innerHTML = \`
            <div style="padding: 8px 12px; background: #222; border-bottom: 1px solid #333; color: #888; position: sticky; top: 0;">
              Showing \${currentView === 'conversation' ? currentConversationItems.length : currentEvents.length} \${currentView === 'conversation' ? 'items' : 'events'}\${data.totalLines !== null ? ' (Total: ' + data.totalLines + ')' : ''}
            </div>
            \${contentHtml}
          \`;
        } catch (err) {
          container.innerHTML = \`<div style="padding: 12px; color: #ff6b6b;">Failed to load events: \${escapeHtml(err.message)}</div>\`;
          loadOlderBtn.style.display = 'none';
        }
      }
      
      refreshBtn.addEventListener('click', () => {
        currentCursor = null;
        currentEvents = [];
        currentConversationItems = [];
        loadEvents(false);
      });
      
      loadOlderBtn.addEventListener('click', () => {
        loadEvents(true);
      });
      
      conversationToggle.addEventListener('click', () => {
        currentView = 'conversation';
        currentCursor = null;
        currentEvents = [];
        currentConversationItems = [];
        updateToggleStyles();
        loadEvents(false);
      });
      
      rawToggle.addEventListener('click', () => {
        currentView = 'raw';
        currentCursor = null;
        currentEvents = [];
        currentConversationItems = [];
        updateToggleStyles();
        loadEvents(false);
      });
      
      // Auto-load on page view
      loadEvents(false);
    })();
    </script>
  `;
}

// ── 404 ──────────────────────────────────────────────────────

export function notFoundPage(): string {
  return `<div class="not-found">
    <div class="not-found-code">404</div>
    <div class="not-found-text">Page not found</div>
    <a href="/" class="not-found-link">← Back to overview</a>
  </div>`;
}
