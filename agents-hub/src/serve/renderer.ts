/**
 * Server-rendered HTML templates for the agents-hub dashboard.
 * Pure functions — each returns an HTML string.
 */

import type { Message, SearchResult, ChannelInfo, HubStatus } from '../core/types.js';

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

  div.innerHTML = '<div class="message-avatar">'+avatar+'</div><div class="message-content"><div class="message-header"><span class="message-author">'+escapeHtml(msg.author)+'</span><span class="message-type-badge badge-'+msg.type+'">'+msg.type+'</span><span class="message-timestamp">'+timestamp+'</span></div>'+(codeBlock?'':'<div class="message-body">'+escapeHtml(msg.content)+'</div>')+codeBlock+(tags?'<div class="message-tags">'+tags+'</div>':'')+(badges.length?'<div class="message-metadata">'+badges.join(' ')+'</div>':'')+ progress + threadIndicator + '</div>';

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
  activePage: 'timeline' | 'status' | 'search' | 'thread';
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
    const href = ch.name === '#main' ? '/' : `/channel/${encodeURIComponent(ch.name.slice(1))}`;
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
          <li><a href="/" class="${opts.activePage === 'timeline' ? 'active' : ''}">📡 Timeline</a></li>
          <li><a href="/status" class="${opts.activePage === 'status' ? 'active' : ''}">📊 Status</a></li>
          <li><a href="/search" class="${opts.activePage === 'search' ? 'active' : ''}">🔍 Search</a></li>
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
      let autoScroll = true;

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

// ── Status Page ──────────────────────────────────────────────

export function statusPage(status: HubStatus): string {
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

// ── 404 ──────────────────────────────────────────────────────

export function notFoundPage(): string {
  return `<div class="not-found">
    <div class="not-found-code">404</div>
    <div class="not-found-text">Page not found</div>
    <a href="/" class="not-found-link">← Back to timeline</a>
  </div>`;
}
