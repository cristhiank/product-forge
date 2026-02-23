/** Dark theme CSS for agents-hub dashboard (dev-tool aesthetic) */
export const CSS = /* css */ `
:root {
  --color-bg: #0d1117;
  --color-bg-subtle: #161b22;
  --color-bg-inset: #21262d;
  --color-bg-elevated: #1c2128;
  --color-border: #30363d;
  --color-border-subtle: #21262d;
  --color-text: #e6edf3;
  --color-text-secondary: #8b949e;
  --color-text-muted: #6e7681;
  --color-link: #58a6ff;
  --color-accent: #58a6ff;
  --color-success: #3fb950;
  --color-warning: #d29922;
  --color-danger: #f85149;
  
  /* Message type colors */
  --color-note: #58a6ff;
  --color-note-bg: rgba(56, 139, 253, 0.1);
  --color-decision: #bc8cff;
  --color-decision-bg: rgba(188, 140, 255, 0.1);
  --color-request: #ff7b72;
  --color-request-bg: rgba(248, 81, 73, 0.1);
  --color-status: #56d364;
  --color-status-bg: rgba(86, 211, 100, 0.1);
  
  /* Badge colors */
  --color-info: #58a6ff;
  --color-info-bg: rgba(56, 139, 253, 0.15);
  --color-minor: #d29922;
  --color-minor-bg: rgba(210, 153, 34, 0.15);
  --color-major: #ff7b72;
  --color-major-bg: rgba(248, 81, 73, 0.15);
  --color-blocker: #f85149;
  --color-blocker-bg: rgba(248, 81, 73, 0.25);
  
  --radius: 6px;
  --shadow-sm: 0 1px 0 rgba(0,0,0,.3);
  --shadow-md: 0 4px 8px rgba(0,0,0,.4);
  --font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: var(--color-text);
  background: var(--color-bg);
}

a { color: var(--color-link); text-decoration: none; }
a:hover { text-decoration: underline; }

/* Layout */
.layout {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 260px;
  background: var(--color-bg-subtle);
  border-right: 1px solid var(--color-border);
  padding: 16px;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
}

.sidebar-brand {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--color-border-subtle);
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text);
}

.sidebar-brand svg { flex-shrink: 0; }

.sidebar-section { margin-bottom: 16px; }
.sidebar-section-title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-secondary);
  margin-bottom: 8px;
}

.sidebar-nav { list-style: none; }
.sidebar-nav li a {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: var(--radius);
  color: var(--color-text);
  font-size: 14px;
}
.sidebar-nav li a:hover { background: var(--color-bg-inset); text-decoration: none; }
.sidebar-nav li a.active { background: var(--color-bg-elevated); font-weight: 600; border: 1px solid var(--color-border); }
.sidebar-nav li a .count {
  margin-left: auto;
  font-size: 12px;
  color: var(--color-text-muted);
  background: var(--color-bg-inset);
  padding: 0 6px;
  border-radius: 10px;
  min-width: 20px;
  text-align: center;
}

.main {
  flex: 1;
  padding: 24px;
  min-width: 0;
}

/* Page header */
.page-header {
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.page-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text);
}
.page-subtitle {
  font-size: 14px;
  color: var(--color-text-secondary);
}

/* Search bar */
.search-form {
  display: flex;
  gap: 8px;
  max-width: 480px;
}
.search-input {
  flex: 1;
  padding: 5px 12px;
  font-size: 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-bg-inset);
  color: var(--color-text);
  outline: none;
}
.search-input:focus { border-color: var(--color-accent); box-shadow: 0 0 0 3px rgba(88,166,255,.15); }
.search-btn {
  padding: 5px 16px;
  font-size: 14px;
  font-weight: 500;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-bg-subtle);
  color: var(--color-text);
  cursor: pointer;
}
.search-btn:hover { background: var(--color-bg-inset); }

/* Timeline container */
.timeline-container {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 140px);
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  overflow: hidden;
}

.timeline {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  scroll-behavior: smooth;
}

/* Message card */
.message {
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  transition: box-shadow 0.15s;
}
.message:hover { box-shadow: var(--shadow-md); }

/* Message type variations */
.message.type-note { border-left: 3px solid var(--color-note); background: var(--color-note-bg); }
.message.type-decision { border-left: 3px solid var(--color-decision); background: var(--color-decision-bg); }
.message.type-request { border-left: 3px solid var(--color-request); background: var(--color-request-bg); }
.message.type-status { border-left: 3px solid var(--color-status); background: var(--color-status-bg); }

.message-avatar {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--color-bg-inset);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.message-content {
  flex: 1;
  min-width: 0;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  flex-wrap: wrap;
}

.message-author {
  font-weight: 600;
  color: var(--color-text);
  font-size: 14px;
}

.worker-attribution-badge {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  padding: 1px 8px;
  border-radius: 999px;
  border: 1px solid hsl(var(--worker-hue) 60% 55% / 0.35);
  background: hsl(var(--worker-hue) 70% 50% / 0.12);
  color: hsl(var(--worker-hue) 75% 72%);
  text-decoration: none;
  line-height: 1.4;
}
.worker-attribution-badge:hover {
  background: hsl(var(--worker-hue) 70% 50% / 0.2);
  color: hsl(var(--worker-hue) 80% 78%);
  text-decoration: none;
}

.message-type-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
.badge-note { background: var(--color-info-bg); color: var(--color-info); }
.badge-decision { background: var(--color-decision-bg); color: var(--color-decision); }
.badge-request { background: var(--color-request-bg); color: var(--color-request); }
.badge-status { background: var(--color-status-bg); color: var(--color-status); }

.message-timestamp {
  font-size: 12px;
  color: var(--color-text-muted);
  font-family: var(--font-mono);
}

.message-body {
  color: var(--color-text);
  font-size: 14px;
  line-height: 1.5;
  word-break: break-word;
}

.message-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
}

.tag {
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--color-bg-inset);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border-subtle);
}

.tag.tag-snippet { background: rgba(139, 92, 246, 0.15); color: #a78bfa; border-color: #7c3aed; }
.tag.tag-finding { background: rgba(34, 211, 238, 0.15); color: #22d3ee; border-color: #0891b2; }
.tag.tag-trail { background: rgba(250, 204, 21, 0.15); color: #fbbf24; border-color: #ca8a04; }
.tag.tag-constraint { background: rgba(251, 146, 60, 0.15); color: #fb923c; border-color: #ea580c; }
.tag.tag-checkpoint { background: rgba(34, 197, 94, 0.15); color: #22c55e; border-color: #16a34a; }

/* Metadata badges */
.message-metadata {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.metadata-badge {
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 10px;
  border: 1px solid;
}

.badge-confidence-high { background: rgba(34, 197, 94, 0.15); color: #22c55e; border-color: #16a34a; }
.badge-confidence-medium { background: rgba(250, 204, 21, 0.15); color: #fbbf24; border-color: #ca8a04; }
.badge-confidence-low { background: rgba(251, 146, 60, 0.15); color: #fb923c; border-color: #ea580c; }

.badge-status-proposed { background: rgba(250, 204, 21, 0.15); color: #fbbf24; border-color: #ca8a04; }
.badge-status-approved { background: rgba(34, 197, 94, 0.15); color: #22c55e; border-color: #16a34a; }
.badge-status-rejected { background: rgba(248, 81, 73, 0.15); color: #f85149; border-color: #da3633; }

.badge-severity-info { background: var(--color-info-bg); color: var(--color-info); border-color: #1f6feb; }
.badge-severity-minor { background: var(--color-minor-bg); color: var(--color-minor); border-color: #9e6a03; }
.badge-severity-major { background: var(--color-major-bg); color: var(--color-major); border-color: #da3633; }
.badge-severity-blocker { background: var(--color-blocker-bg); color: var(--color-blocker); border-color: #da3633; font-weight: 600; }

.badge-resolved { background: rgba(34, 197, 94, 0.15); color: #22c55e; border-color: #16a34a; }
.badge-unresolved { background: rgba(248, 81, 73, 0.15); color: #f85149; border-color: #da3633; }

/* Thread indicator */
.message-thread {
  margin-top: 8px;
  padding: 8px 12px;
  background: var(--color-bg-inset);
  border-left: 2px solid var(--color-border);
  border-radius: 4px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

/* Code blocks in messages */
.message-code {
  margin-top: 8px;
  background: var(--color-bg-inset);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 12px 16px;
  overflow-x: auto;
  font-family: var(--font-mono);
  font-size: 13px;
}

.message-code-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border-subtle);
}

.message-code-path {
  font-size: 12px;
  color: var(--color-text-secondary);
  font-family: var(--font-mono);
}

.message-code-toggle {
  font-size: 11px;
  color: var(--color-link);
  cursor: pointer;
  background: none;
  border: none;
  padding: 2px 6px;
}
.message-code-toggle:hover { text-decoration: underline; }

.message-code pre {
  margin: 0;
  color: var(--color-text);
  white-space: pre;
  overflow-x: auto;
}

/* Progress bar */
.progress-container {
  margin-top: 8px;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: var(--color-bg-inset);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-status), var(--color-success));
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 4px;
}

/* New message indicator */
.new-message-indicator {
  position: fixed;
  bottom: 80px;
  right: 40px;
  background: var(--color-accent);
  color: #000;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  box-shadow: var(--shadow-md);
  cursor: pointer;
  display: none;
  align-items: center;
  gap: 6px;
  z-index: 100;
}
.new-message-indicator.visible { display: flex; }
.new-message-indicator:hover { background: #79c0ff; }

/* Status page */
.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 16px;
}
.stat-card-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
.stat-card-value {
  font-size: 28px;
  font-weight: 600;
  margin-top: 4px;
  color: var(--color-text);
}

.channel-stats {
  margin-top: 24px;
}

.channel-stat {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 16px;
  margin-bottom: 12px;
}

.channel-stat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.channel-stat-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
}

.channel-stat-count {
  font-size: 14px;
  color: var(--color-text-secondary);
}

/* Search results */
.search-results { list-style: none; }
.search-result {
  padding: 12px 16px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  margin-bottom: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.search-result:hover { box-shadow: var(--shadow-md); cursor: pointer; }

.search-result-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.search-result-channel {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-accent);
  font-family: var(--font-mono);
}

.search-result-highlight {
  color: var(--color-text);
  font-size: 14px;
  line-height: 1.6;
}
.search-result-highlight mark {
  background: rgba(210, 153, 34, 0.3);
  color: #fbbf24;
  padding: 1px 2px;
  border-radius: 2px;
}

/* Thread view */
.thread-container {
  max-width: 900px;
}

.thread-parent {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 2px solid var(--color-border);
}

.thread-replies {
  padding-left: 24px;
  border-left: 2px solid var(--color-border);
}

.thread-replies .message {
  margin-bottom: 12px;
}

/* Empty state */
.empty-state {
  text-align: center;
  padding: 48px 24px;
  color: var(--color-text-muted);
}
.empty-state-icon { font-size: 40px; margin-bottom: 12px; opacity: 0.5; }
.empty-state-text { font-size: 16px; }

/* Loading spinner */
.loading {
  text-align: center;
  padding: 24px;
  color: var(--color-text-secondary);
}

/* 404 */
.not-found {
  text-align: center;
  padding: 80px 24px;
}
.not-found-code {
  font-size: 72px;
  font-weight: 700;
  color: var(--color-text-muted);
  margin-bottom: 16px;
}
.not-found-text {
  font-size: 20px;
  color: var(--color-text-secondary);
}
.not-found-link {
  margin-top: 24px;
  display: inline-block;
  padding: 8px 16px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  color: var(--color-link);
}
.not-found-link:hover { background: var(--color-bg-inset); text-decoration: none; }

/* Responsive */
@media (max-width: 768px) {
  .layout { flex-direction: column; }
  .sidebar { width: 100%; height: auto; position: static; border-right: none; border-bottom: 1px solid var(--color-border); }
  .timeline-container { height: calc(100vh - 200px); }
  .new-message-indicator { bottom: 20px; right: 20px; }
  .workers-table-wrap { overflow-x: auto; }
}

/* Workers page */
.workers-summary {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.workers-summary-item {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 16px 24px;
  text-align: center;
  min-width: 100px;
  flex: 1;
}

.workers-summary-count {
  display: block;
  font-size: 28px;
  font-weight: 600;
  color: var(--color-text);
}

.workers-summary-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: var(--color-text-secondary);
  margin-top: 2px;
}

.summary-healthy .workers-summary-count { color: var(--color-success); }
.summary-stale .workers-summary-count { color: var(--color-warning); }
.summary-lost .workers-summary-count { color: var(--color-text-muted); }
.summary-failed .workers-summary-count { color: var(--color-danger); }
.summary-completed .workers-summary-count { color: var(--color-accent); }

.workers-table-wrap {
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  overflow: hidden;
}

.workers-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.workers-table thead th {
  background: var(--color-bg-inset);
  padding: 10px 14px;
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: var(--color-text-secondary);
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}

.workers-table tbody tr {
  border-bottom: 1px solid var(--color-border-subtle);
  cursor: pointer;
  transition: background 0.1s;
}

.workers-table tbody tr:hover { background: var(--color-bg-elevated); }
.workers-table tbody tr:last-child { border-bottom: none; }

.workers-table td {
  padding: 10px 14px;
  color: var(--color-text);
  white-space: nowrap;
}

.worker-id-cell a {
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--color-link);
}

.worker-counter {
  font-family: var(--font-mono);
  font-size: 13px;
  text-align: center;
}

.worker-counter-error { color: var(--color-danger); font-weight: 600; }

.worker-time {
  font-size: 12px;
  color: var(--color-text-muted);
  font-family: var(--font-mono);
}

.worker-empty {
  text-align: center;
  padding: 48px 24px !important;
  color: var(--color-text-muted);
  font-size: 16px;
}

.worker-health-badge, .worker-status-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  border: 1px solid;
}

.health-healthy { background: rgba(63, 185, 80, 0.15); color: var(--color-success); border-color: #238636; }
.health-stale { background: rgba(210, 153, 34, 0.15); color: var(--color-warning); border-color: #9e6a03; }
.health-lost { background: rgba(110, 118, 129, 0.15); color: var(--color-text-muted); border-color: #484f58; }

.wstatus-active { background: rgba(63, 185, 80, 0.15); color: var(--color-success); border-color: #238636; }
.wstatus-completed { background: rgba(88, 166, 255, 0.15); color: var(--color-accent); border-color: #1f6feb; }
.wstatus-failed { background: rgba(248, 81, 73, 0.15); color: var(--color-danger); border-color: #da3633; }
.wstatus-lost { background: rgba(110, 118, 129, 0.15); color: var(--color-text-muted); border-color: #484f58; }

/* Worker detail page */
.worker-detail-back-link {
  align-self: flex-start;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-bg-elevated);
  color: var(--color-link);
  font-size: 13px;
  font-weight: 600;
}

.worker-detail-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.worker-detail-metric {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 12px;
}

.worker-detail-metric-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: var(--color-text-muted);
  margin-bottom: 6px;
}

.worker-detail-metric-value {
  font-family: var(--font-mono);
  font-size: 16px;
  color: var(--color-text);
}

.worker-detail-grid {
  display: grid;
  gap: 16px;
}

.worker-detail-section {
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 16px;
}

.worker-detail-section h2 {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
}

.worker-detail-timeline {
  list-style: none;
  margin: 0;
  padding: 0;
}

.worker-detail-event {
  border-left: 2px solid var(--color-border);
  padding: 6px 0 6px 12px;
  margin-left: 4px;
}

.worker-detail-event + .worker-detail-event {
  margin-top: 8px;
}

.worker-detail-event-type {
  font-size: 11px;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.worker-detail-event-summary {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-top: 2px;
}

.worker-detail-event-time {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-top: 2px;
  font-family: var(--font-mono);
}

.worker-detail-messages .message {
  margin-bottom: 8px;
}

.worker-detail-empty {
  color: var(--color-text-muted);
  font-size: 13px;
  padding: 8px 0;
}

/* Incidents page */
.incidents-grid {
  display: grid;
  gap: 16px;
}

.incidents-section {
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 16px;
}

.incidents-section h2 {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
}

.incidents-table td {
  vertical-align: middle;
  max-width: 420px;
  white-space: normal;
}

.incident-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.incident-action-form {
  margin: 0;
}

.incident-action-link,
.incident-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  padding: 5px 10px;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-elevated);
  color: var(--color-link);
  text-decoration: none;
  cursor: pointer;
}

.incident-action-btn:hover,
.incident-action-link:hover {
  background: var(--color-bg-inset);
  text-decoration: none;
}

.incident-action-btn-danger {
  color: var(--color-danger);
  border-color: #da3633;
}

.incident-action-btn:disabled {
  cursor: not-allowed;
  color: var(--color-text-muted);
  border-color: var(--color-border-subtle);
  background: var(--color-bg-subtle);
}

.incident-cluster-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.incident-cluster-item {
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 10px 12px;
  background: var(--color-bg-elevated);
}

.incident-cluster-main {
  display: flex;
  gap: 10px;
  align-items: baseline;
}

.incident-cluster-count {
  font-family: var(--font-mono);
  font-weight: 700;
  color: var(--color-danger);
}

.incident-cluster-label {
  color: var(--color-text-secondary);
  font-size: 13px;
}

.incident-cluster-meta {
  margin-top: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 12px;
  color: var(--color-text-muted);
}

/* Scrollbar styling for dark theme */
.timeline::-webkit-scrollbar,
.sidebar::-webkit-scrollbar {
  width: 12px;
}
.timeline::-webkit-scrollbar-track,
.sidebar::-webkit-scrollbar-track {
  background: var(--color-bg);
}
.timeline::-webkit-scrollbar-thumb,
.sidebar::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 6px;
}
.timeline::-webkit-scrollbar-thumb:hover,
.sidebar::-webkit-scrollbar-thumb:hover {
  background: var(--color-text-muted);
}
`;
