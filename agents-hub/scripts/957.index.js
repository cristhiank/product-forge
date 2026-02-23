export const id = 957;
export const ids = [957];
export const modules = {

/***/ 957:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {


// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  startServer: () => (/* binding */ startServer)
});

// EXTERNAL MODULE: external "node:http"
var external_node_http_ = __webpack_require__(67);
;// CONCATENATED MODULE: ./src/serve/styles.ts
/** Dark theme CSS for agents-hub dashboard (dev-tool aesthetic) */
const CSS = /* css */ `
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
.wstatus-succeeded { background: rgba(63, 185, 80, 0.15); color: var(--color-success); border-color: #238636; }
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

;// CONCATENATED MODULE: ./src/serve/renderer.ts
/**
 * Server-rendered HTML templates for the agents-hub dashboard.
 * Pure functions — each returns an HTML string.
 */
// ── Helpers ──────────────────────────────────────────────────
function esc(s) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
function formatTimestamp(iso) {
    const d = new Date(iso);
    const now = Date.now();
    const diff = now - d.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (seconds < 60)
        return 'just now';
    if (minutes < 60)
        return `${minutes}m ago`;
    if (hours < 24)
        return `${hours}h ago`;
    if (days < 7)
        return `${days}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function formatNumber(value) {
    if (!Number.isFinite(value))
        return '0';
    return Math.round(value).toLocaleString('en-US');
}
function formatTokens(value) {
    if (!Number.isFinite(value) || value <= 0)
        return '0';
    if (value >= 1_000_000)
        return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000)
        return `${(value / 1_000).toFixed(1)}k`;
    return formatNumber(value);
}
function formatUsd(value) {
    const normalized = Number.isFinite(value) ? value : 0;
    return `$${normalized.toFixed(2)}`;
}
function shortModelName(model) {
    if (!model)
        return 'unknown';
    if (model.length <= 28)
        return model;
    return `${model.slice(0, 25)}...`;
}
function authorEmoji(author) {
    const lower = author.toLowerCase();
    if (lower.includes('scout'))
        return '🔍';
    if (lower.includes('creative'))
        return '💡';
    if (lower.includes('planner'))
        return '📋';
    if (lower.includes('verifier'))
        return '✅';
    if (lower.includes('executor'))
        return '⚙️';
    if (lower.includes('orchestrator'))
        return '🎯';
    if (lower.includes('super'))
        return '👑';
    if (lower.includes('memory'))
        return '🧠';
    if (lower.includes('system'))
        return '⚡';
    return '🤖';
}
function typeBadge(type) {
    return `<span class="message-type-badge badge-${esc(type)}">${esc(type)}</span>`;
}
function workerHue(workerId) {
    let hash = 0;
    for (let i = 0; i < workerId.length; i++) {
        hash = (hash * 31 + workerId.charCodeAt(i)) >>> 0;
    }
    return hash % 360;
}
function workerBadge(workerId) {
    if (!workerId)
        return '';
    const hue = workerHue(workerId);
    const encodedWorkerId = encodeURIComponent(workerId);
    return `<a class="worker-attribution-badge" href="/worker/${esc(encodedWorkerId)}" style="--worker-hue:${hue}" title="View worker ${esc(workerId)}">${esc(workerId)}</a>`;
}
function tagPills(tags) {
    if (!tags.length)
        return '';
    return tags.map((t) => {
        const cls = ['snippet', 'finding', 'trail', 'constraint', 'checkpoint'].includes(t) ? ` tag-${t}` : '';
        return `<span class="tag${cls}">${esc(t)}</span>`;
    }).join(' ');
}
function metadataBadges(metadata) {
    const badges = [];
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
function progressBar(metadata) {
    const step = typeof metadata.step === 'number' ? metadata.step : undefined;
    const totalSteps = typeof metadata.total_steps === 'number' ? metadata.total_steps
        : typeof metadata.totalSteps === 'number' ? metadata.totalSteps : undefined;
    if (step === undefined || totalSteps === undefined || totalSteps === 0)
        return '';
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
function renderMessage(msg) {
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
function clientRenderMessageFunction() {
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
function layout(opts) {
    // Sort channels: #main, #general, then #worker-* alphabetically
    const sorted = [...opts.channels].sort((a, b) => {
        if (a.name === '#main')
            return -1;
        if (b.name === '#main')
            return 1;
        if (a.name === '#general')
            return -1;
        if (b.name === '#general')
            return 1;
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
function timelinePage(messages, channel) {
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
function overviewPage(summary, usage, tools, actions) {
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
function usagePage(usage) {
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
function toolsPage(tools) {
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
function statusPage(status, workerSummary = { active: 0, stale: 0, lost: 0, failed: 0 }) {
    const summary = workerSummary;
    const channelStats = Object.entries(status.channels)
        .sort(([a], [b]) => {
        if (a === '#main')
            return -1;
        if (b === '#main')
            return 1;
        if (a === '#general')
            return -1;
        if (b === '#general')
            return 1;
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
function searchPage(results, query) {
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
function threadView(parent, replies) {
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
function incidentTimestamp(iso) {
    if (!iso)
        return 0;
    const ts = new Date(iso).getTime();
    return Number.isNaN(ts) ? 0 : ts;
}
function clusterSignature(content) {
    const normalized = content
        .toLowerCase()
        .replace(/[0-9a-f]{8,}/g, '#')
        .replace(/\d+/g, '#')
        .replace(/\s+/g, ' ')
        .trim();
    return normalized.slice(0, 90);
}
function firstNonEmptyLine(content) {
    const line = content.split('\n').map(s => s.trim()).find(Boolean) || '';
    return line.length > 140 ? `${line.slice(0, 137)}...` : line;
}
function buildIncidentClusters(workers, unresolvedRequests) {
    const clusters = new Map();
    for (const worker of workers) {
        const eventType = worker.lastEventType || 'unknown';
        const key = `worker:${worker.status}:${worker.health}:${eventType}`;
        const incidentAt = worker.lastEventAt ?? worker.completedAt ?? worker.registeredAt;
        const label = `Worker ${worker.status}/${worker.health} · ${eventType}`;
        const existing = clusters.get(key);
        if (existing) {
            existing.count += 1;
            if (incidentTimestamp(incidentAt) > incidentTimestamp(existing.lastSeen))
                existing.lastSeen = incidentAt;
            if (!existing.workerIds.includes(worker.id))
                existing.workerIds.push(worker.id);
        }
        else {
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
            if (incidentTimestamp(req.createdAt) > incidentTimestamp(existing.lastSeen))
                existing.lastSeen = req.createdAt;
            if (!existing.requestIds.includes(req.id))
                existing.requestIds.push(req.id);
        }
        else {
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
function agentTypeEmoji(agentType) {
    if (!agentType)
        return '🤖';
    const lower = agentType.toLowerCase();
    if (lower.includes('scout'))
        return '🔍';
    if (lower.includes('creative'))
        return '💡';
    if (lower.includes('planner'))
        return '📋';
    if (lower.includes('verifier'))
        return '✅';
    if (lower.includes('executor'))
        return '⚙️';
    if (lower.includes('orchestrator'))
        return '🎯';
    if (lower.includes('super'))
        return '👑';
    if (lower.includes('memory'))
        return '🧠';
    return '🤖';
}
function healthBadge(health) {
    return `<span class="worker-health-badge health-${esc(health)}">${esc(health)}</span>`;
}
function statusBadge(status) {
    return `<span class="worker-status-badge wstatus-${esc(status)}">${esc(status)}</span>`;
}
function formatDuration(startIso) {
    const elapsed = Date.now() - new Date(startIso).getTime();
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0)
        return `${hours}h ${minutes % 60}m`;
    if (minutes > 0)
        return `${minutes}m`;
    return `${seconds}s`;
}
function formatDurationMs(durationMs) {
    if (durationMs >= 1000) {
        const seconds = durationMs / 1000;
        return `${seconds >= 10 ? seconds.toFixed(0) : seconds.toFixed(1)}s`;
    }
    return `${Math.round(durationMs)}ms`;
}
function renderWorkerRow(w) {
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
function workersPage(workers) {
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
function incidentsPage(workers, unresolvedRequests) {
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
function workerDetailPage(worker, relatedMessages, sync, actionHistory = []) {
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
function notFoundPage() {
    return `<div class="not-found">
    <div class="not-found-code">404</div>
    <div class="not-found-text">Page not found</div>
    <a href="/" class="not-found-link">← Back to overview</a>
  </div>`;
}

// EXTERNAL MODULE: ./src/core/reactor.ts
var reactor = __webpack_require__(553);
// EXTERNAL MODULE: external "node:fs"
var external_node_fs_ = __webpack_require__(24);
;// CONCATENATED MODULE: ./src/core/telemetry.ts
/**
 * Telemetry abstraction for different agent types.
 * Currently supports: copilot (Copilot CLI events.jsonl format)
 */

/**
 * Copilot CLI telemetry reader
 */
class CopilotTelemetryReader {
    readEvents(eventsPath, cursor, limit) {
        if (!(0,external_node_fs_.existsSync)(eventsPath)) {
            return {
                events: [],
                cursor: null,
                hasMore: false,
                count: 0,
                totalLines: null,
                error: 'Events file not found',
            };
        }
        const fileSize = (0,external_node_fs_.statSync)(eventsPath).size;
        const end = parseCursor(cursor, fileSize);
        if (end <= 0) {
            return {
                events: [],
                cursor: null,
                hasMore: false,
                count: 0,
                totalLines: null,
                error: null,
            };
        }
        const boundedLimit = Math.max(1, Math.min(limit, 500));
        const { selectedLines, nextCursor } = readPageLines(eventsPath, end, boundedLimit, fileSize);
        const events = [];
        for (const line of selectedLines) {
            try {
                const parsed = JSON.parse(line);
                events.push({
                    type: parsed.type ?? '',
                    data: parsed.data ?? {},
                    id: parsed.id ?? '',
                    timestamp: parsed.timestamp ?? '',
                    parentId: parsed.parentId ?? null,
                });
            }
            catch {
                // Skip malformed lines.
            }
        }
        return {
            events,
            cursor: nextCursor,
            hasMore: nextCursor !== null,
            count: events.length,
            totalLines: null,
            error: null,
        };
    }
    toConversation(events) {
        const items = [];
        for (const event of events) {
            const timestamp = event.timestamp;
            switch (event.type) {
                case 'user.message':
                case 'turn.user_message':
                    items.push({
                        type: 'user_message',
                        timestamp,
                        content: toContent(event.data.message, event.data.content),
                        data: event.data,
                    });
                    break;
                case 'assistant.message':
                case 'turn.assistant_message':
                    items.push({
                        type: 'assistant_message',
                        timestamp,
                        content: toContent(event.data.message, event.data.content),
                        data: event.data,
                    });
                    break;
                case 'tool.execution_start':
                case 'tool.execution_complete':
                case 'tool.error':
                    items.push({
                        type: 'tool_lifecycle',
                        timestamp,
                        content: `${event.type}: ${toContent(event.data.toolName, event.data.tool_name, event.data.tool, 'unknown')}`,
                        data: event.data,
                    });
                    break;
                case 'session.error':
                    items.push({
                        type: 'error',
                        timestamp,
                        content: String(event.data.message ?? event.data.error ?? 'Unknown error'),
                        data: event.data,
                    });
                    break;
                default:
                    items.push({
                        type: 'unknown',
                        timestamp,
                        content: event.type,
                        data: event.data,
                    });
            }
        }
        return items;
    }
}
/**
 * Get telemetry reader using the telemetry source path, not role/agent labels.
 */
function getTelemetryReader(eventsPath) {
    if (!eventsPath)
        return null;
    if (isCopilotSessionEventsPath(eventsPath))
        return new CopilotTelemetryReader();
    return null;
}
function isCopilotSessionEventsPath(eventsPath) {
    const normalizedPath = eventsPath.replace(/\\/g, '/');
    return normalizedPath.includes('/.copilot/session-state/') && normalizedPath.endsWith('/events.jsonl');
}
function parseCursor(cursor, fileSize) {
    if (!cursor)
        return fileSize;
    const match = cursor.match(/^byte:(\d+)$/);
    if (!match)
        return fileSize;
    const parsed = parseInt(match[1], 10);
    if (Number.isNaN(parsed))
        return fileSize;
    return Math.max(0, Math.min(parsed, fileSize));
}
function readPageLines(eventsPath, end, limit, fileSize) {
    const fd = (0,external_node_fs_.openSync)(eventsPath, 'r');
    const chunkSize = 64 * 1024;
    let start = end;
    let text = '';
    try {
        while (start > 0) {
            const readLen = Math.min(chunkSize, start);
            start -= readLen;
            const chunk = Buffer.alloc(readLen);
            (0,external_node_fs_.readSync)(fd, chunk, 0, readLen, start);
            text = chunk.toString('utf-8') + text;
            const parts = text.split('\n');
            const completeLines = (start > 0 ? parts.slice(1) : parts).filter(line => line.trim().length > 0);
            if (completeLines.length >= limit + 1 || start === 0)
                break;
        }
    }
    finally {
        (0,external_node_fs_.closeSync)(fd);
    }
    let parts = text.split('\n');
    if (start > 0) {
        parts = parts.slice(1);
    }
    if (end === fileSize && !text.endsWith('\n') && parts.length > 0) {
        parts.pop();
    }
    if (parts.length > 0 && parts[parts.length - 1] === '') {
        parts.pop();
    }
    const selectedLinesReversed = [];
    let bytesFromEnd = 0;
    for (let i = parts.length - 1; i >= 0; i -= 1) {
        const line = parts[i];
        bytesFromEnd += Buffer.byteLength(`${line}\n`, 'utf-8');
        if (!line.trim())
            continue;
        selectedLinesReversed.push(line);
        if (selectedLinesReversed.length >= limit)
            break;
    }
    const selectedLines = selectedLinesReversed.reverse();
    const selectedStart = Math.max(0, end - bytesFromEnd);
    return {
        selectedLines,
        nextCursor: selectedStart > 0 ? `byte:${selectedStart}` : null,
    };
}
function toContent(...values) {
    for (const value of values) {
        if (typeof value === 'string' && value.trim().length > 0)
            return value;
    }
    return '';
}

;// CONCATENATED MODULE: ./src/serve/server.ts
/**
 * Lightweight HTTP server for the agents-hub dashboard.
 * Uses node:http (zero deps), SSE for real-time message streaming.
 */





const sseClients = new Map();
const DEFAULT_WORKER_SYNC_INTERVAL_MS = 30_000;
/**
 * Broadcast a new message to connected SSE clients (filtered by channel)
 */
function broadcastMessage(msg) {
    const msgObj = msg;
    const data = JSON.stringify(msg);
    for (const [res, client] of Array.from(sseClients)) {
        if (client.channel && msgObj.channel && msgObj.channel !== client.channel)
            continue;
        try {
            res.write(`event: message\ndata: ${data}\n\n`);
        }
        catch {
            sseClients.delete(res);
        }
    }
}
/**
 * Broadcast worker sync updates to all SSE clients
 */
function broadcastWorkerSync(sync) {
    const data = JSON.stringify(sync);
    for (const [res] of Array.from(sseClients)) {
        try {
            res.write(`event: worker_sync\ndata: ${data}\n\n`);
        }
        catch {
            sseClients.delete(res);
        }
    }
}
// ── Route helpers ────────────────────────────────────────────
function sendHtml(res, html, status = 200) {
    res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
}
function sendJson(res, data, status = 200) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
}
function sendRedirect(res, location, status = 303) {
    res.writeHead(status, { Location: location });
    res.end();
}
function sendCss(res) {
    res.writeHead(200, {
        'Content-Type': 'text/css; charset=utf-8',
        'Cache-Control': 'public, max-age=60',
    });
    res.end(CSS);
}
function parseUrl(url) {
    const idx = url.indexOf('?');
    const pathname = idx >= 0 ? url.slice(0, idx) : url;
    const query = new URLSearchParams(idx >= 0 ? url.slice(idx + 1) : '');
    return { pathname, query };
}
function workerIncidentTimestamp(worker) {
    const iso = worker.lastEventAt ?? worker.completedAt ?? worker.registeredAt;
    return new Date(iso).getTime();
}
function sortNewestFirst(items) {
    return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
function sanitizeRedirectPath(path) {
    if (!path || !path.startsWith('/'))
        return '/incidents';
    return path;
}
function parseLimit(query, key, fallback, max) {
    const raw = parseInt(query.get(key) || String(fallback), 10);
    if (!Number.isFinite(raw))
        return fallback;
    return Math.min(Math.max(1, raw), max);
}
// ── Background watcher ───────────────────────────────────────
/**
 * Start background task to watch for new messages and broadcast via SSE
 */
function startMessageWatcher(hub) {
    (async () => {
        try {
            // Watch all channels, no timeout (watch forever)
            for await (const msg of hub.watch({ timeout: 0 })) {
                broadcastMessage(msg);
            }
        }
        catch (err) {
            console.error('Message watcher error:', err);
            // Restart watcher after brief delay
            setTimeout(() => startMessageWatcher(hub), 5000);
        }
    })();
}
/**
 * Start periodic worker sync and broadcast updates via SSE
 */
function startWorkerSyncPoller(hub, intervalMs) {
    if (intervalMs <= 0)
        return null;
    return setInterval(() => {
        try {
            const sync = hub.workerSyncAll();
            if (sync.length === 0)
                return;
            broadcastWorkerSync({
                type: 'worker_sync',
                timestamp: new Date().toISOString(),
                intervalMs,
                sync,
            });
        }
        catch (err) {
            console.error('Worker sync poller error:', err);
        }
    }, intervalMs);
}
async function startServer(opts) {
    const { hub, port, workerSyncIntervalMs = DEFAULT_WORKER_SYNC_INTERVAL_MS, } = opts;
    // Start watching for new messages in background
    startMessageWatcher(hub);
    const workerSyncTimer = startWorkerSyncPoller(hub, workerSyncIntervalMs);
    const server = external_node_http_.createServer(async (req, res) => {
        try {
            const { pathname, query } = parseUrl(req.url || '/');
            // ── Static ──
            if (pathname === '/styles.css')
                return sendCss(res);
            // ── SSE endpoint ──
            if (pathname === '/events') {
                res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    Connection: 'keep-alive',
                });
                res.write(':\n\n'); // comment to keep connection open
                const channelParam = query.get('channel');
                const sseChannel = channelParam ? `#${channelParam}` : undefined;
                sseClients.set(res, { res, channel: sseChannel });
                req.on('close', () => sseClients.delete(res));
                return;
            }
            // ── JSON API for initial messages ──
            if (pathname === '/api/messages') {
                const channel = query.get('channel') || undefined;
                const limit = parseInt(query.get('limit') || '50', 10);
                const offset = parseInt(query.get('offset') || '0', 10);
                const result = hub.read({
                    channel: channel ? `#${channel}` : undefined,
                    limit,
                    offset,
                });
                return sendJson(res, result);
            }
            if (pathname === '/api/ops/summary') {
                return sendJson(res, hub.opsSummary());
            }
            if (pathname === '/api/ops/tools') {
                return sendJson(res, { tools: hub.opsTools() });
            }
            if (pathname === '/api/ops/usage') {
                return sendJson(res, hub.opsUsage());
            }
            if (pathname === '/api/ops/actions') {
                const limit = parseLimit(query, 'limit', 100, 1000);
                return sendJson(res, hub.opsActions(limit));
            }
            const workerUsageMatch = pathname.match(/^\/api\/workers\/(.+)\/usage$/);
            if (workerUsageMatch) {
                const workerId = decodeURIComponent(workerUsageMatch[1]);
                const usage = hub.workerUsage(workerId);
                if (!usage)
                    return sendJson(res, { error: 'Worker not found' }, 404);
                return sendJson(res, usage);
            }
            // ── JSON API for workers ──
            const workerApiMatch = pathname.match(/^\/api\/workers\/([^/]+)$/);
            if (workerApiMatch) {
                const workerId = decodeURIComponent(workerApiMatch[1]);
                const sync = hub.workerSync(workerId);
                const worker = hub.workerGet(workerId);
                if (!worker)
                    return sendJson(res, { error: 'Worker not found' }, 404);
                const messages = hub.read({ workerId, limit: 100 }).messages;
                return sendJson(res, {
                    worker: {
                        ...worker,
                        health: (0,reactor/* detectHealth */._2)(worker.lastEventAt),
                    },
                    sync,
                    messages,
                });
            }
            if (pathname === '/api/workers') {
                const workers = hub.workerList().map(w => ({
                    ...w,
                    health: (0,reactor/* detectHealth */._2)(w.lastEventAt),
                }));
                return sendJson(res, { workers });
            }
            if (pathname === '/api/incidents') {
                const workers = hub.workerList()
                    .map(w => ({ ...w, health: (0,reactor/* detectHealth */._2)(w.lastEventAt) }))
                    .filter(w => w.health !== 'healthy' || w.status === 'failed' || w.status === 'lost' || w.errors > 0)
                    .sort((a, b) => workerIncidentTimestamp(b) - workerIncidentTimestamp(a) || b.errors - a.errors || a.id.localeCompare(b.id));
                const unresolvedRequests = sortNewestFirst(hub.read({ type: 'request', unresolved: true, limit: 200 }).messages);
                return sendJson(res, { workers, unresolvedRequests });
            }
            if (req.method === 'POST') {
                const redirectPath = sanitizeRedirectPath(query.get('redirect'));
                const stopMatch = pathname.match(/^\/workers\/(.+)\/stop$/);
                if (stopMatch) {
                    const workerId = decodeURIComponent(stopMatch[1]);
                    const requestedAt = new Date().toISOString();
                    const worker = hub.workerGet(workerId);
                    if (!worker) {
                        hub.recordOperatorAction({
                            workerId,
                            actionType: 'stop_worker',
                            status: 'failed',
                            requestedAt,
                            completedAt: new Date().toISOString(),
                            error: `Worker not found: ${workerId}`,
                        });
                        return sendJson(res, { error: `Worker not found: ${workerId}` }, 404);
                    }
                    if (worker.pid === null || worker.status !== 'active') {
                        hub.recordOperatorAction({
                            workerId,
                            actionType: 'stop_worker',
                            status: 'failed',
                            requestedAt,
                            completedAt: new Date().toISOString(),
                            error: 'Stop action requires an active worker with a PID',
                        });
                        return sendJson(res, { error: 'Stop action requires an active worker with a PID' }, 409);
                    }
                    process.kill(worker.pid, 'SIGTERM');
                    const syncResult = hub.workerSync(workerId);
                    hub.recordOperatorAction({
                        workerId,
                        actionType: 'stop_worker',
                        status: 'succeeded',
                        requestedAt,
                        completedAt: new Date().toISOString(),
                        metadata: {
                            redirect: redirectPath,
                            syncStatus: syncResult.syncStatus,
                            workerStatus: syncResult.status,
                        },
                    });
                    return sendRedirect(res, redirectPath);
                }
                const syncMatch = pathname.match(/^\/workers\/(.+)\/sync$/);
                if (syncMatch) {
                    const workerId = decodeURIComponent(syncMatch[1]);
                    const requestedAt = new Date().toISOString();
                    const worker = hub.workerGet(workerId);
                    if (!worker) {
                        hub.recordOperatorAction({
                            workerId,
                            actionType: 'retry_sync',
                            status: 'failed',
                            requestedAt,
                            completedAt: new Date().toISOString(),
                            error: `Worker not found: ${workerId}`,
                        });
                        return sendJson(res, { error: `Worker not found: ${workerId}` }, 404);
                    }
                    const syncResult = hub.workerSync(workerId);
                    hub.recordOperatorAction({
                        workerId,
                        actionType: 'retry_sync',
                        status: syncResult.ok ? 'succeeded' : 'failed',
                        requestedAt,
                        completedAt: new Date().toISOString(),
                        error: syncResult.ok ? null : syncResult.error,
                        metadata: {
                            redirect: redirectPath,
                            syncStatus: syncResult.syncStatus,
                            workerStatus: syncResult.status,
                            newEvents: syncResult.newEvents,
                        },
                    });
                    return sendRedirect(res, redirectPath);
                }
            }
            // Refresh channel list for each request
            const currentChannels = hub.channelList(true);
            // ── Ops overview (root) ──
            if (pathname === '/') {
                const summary = hub.opsSummary();
                const usage = hub.opsUsage();
                const tools = hub.opsTools();
                const actions = hub.opsActions(100);
                const html = layout({
                    title: 'Overview',
                    channels: currentChannels,
                    activePage: 'overview',
                    body: overviewPage(summary, usage, tools, actions),
                });
                return sendHtml(res, html);
            }
            // ── Timeline page ──
            if (pathname === '/timeline') {
                const messages = hub.read({ limit: 100 }).messages;
                const html = layout({
                    title: 'Timeline',
                    channels: currentChannels,
                    activePage: 'timeline',
                    body: timelinePage(messages),
                });
                return sendHtml(res, html);
            }
            // ── Timeline per channel ──
            const channelMatch = pathname.match(/^\/channel\/(.+)$/);
            if (channelMatch) {
                const channelName = decodeURIComponent(channelMatch[1]);
                const fullChannelName = `#${channelName}`;
                const messages = hub.read({ channel: fullChannelName, limit: 100 }).messages;
                const html = layout({
                    title: fullChannelName,
                    channels: currentChannels,
                    currentChannel: fullChannelName,
                    activePage: 'timeline',
                    body: timelinePage(messages, channelName),
                });
                return sendHtml(res, html);
            }
            // ── Status page ──
            if (pathname === '/status') {
                const status = hub.status();
                const workers = hub.workerList();
                const workerSummary = { active: 0, stale: 0, lost: 0, failed: 0 };
                for (const worker of workers) {
                    const health = (0,reactor/* detectHealth */._2)(worker.lastEventAt);
                    if (worker.status === 'active')
                        workerSummary.active += 1;
                    if (health === 'stale')
                        workerSummary.stale += 1;
                    if (health === 'lost')
                        workerSummary.lost += 1;
                    if (worker.status === 'failed')
                        workerSummary.failed += 1;
                }
                const html = layout({
                    title: 'Status',
                    channels: currentChannels,
                    activePage: 'status',
                    body: statusPage(status, workerSummary),
                });
                return sendHtml(res, html);
            }
            // ── Search ──
            if (pathname === '/search') {
                const q = query.get('q') || '';
                const results = q ? hub.search(q, { limit: 50 }) : [];
                const html = layout({
                    title: q ? `Search: ${q}` : 'Search',
                    channels: currentChannels,
                    activePage: 'search',
                    body: searchPage(results, q),
                });
                return sendHtml(res, html);
            }
            // ── Usage page ──
            if (pathname === '/usage') {
                const html = layout({
                    title: 'Usage',
                    channels: currentChannels,
                    activePage: 'usage',
                    body: usagePage(hub.opsUsage()),
                });
                return sendHtml(res, html);
            }
            // ── Tools page ──
            if (pathname === '/tools') {
                const html = layout({
                    title: 'Tools',
                    channels: currentChannels,
                    activePage: 'tools',
                    body: toolsPage(hub.opsTools()),
                });
                return sendHtml(res, html);
            }
            // ── Workers page ──
            if (pathname === '/workers') {
                const workers = hub.workerList().map(w => ({
                    ...w,
                    health: (0,reactor/* detectHealth */._2)(w.lastEventAt),
                }));
                const html = layout({
                    title: 'Workers',
                    channels: currentChannels,
                    activePage: 'workers',
                    body: workersPage(workers),
                });
                return sendHtml(res, html);
            }
            // ── Incidents page ──
            if (pathname === '/incidents') {
                const workers = hub.workerList()
                    .map(w => ({ ...w, health: (0,reactor/* detectHealth */._2)(w.lastEventAt) }))
                    .sort((a, b) => workerIncidentTimestamp(b) - workerIncidentTimestamp(a) || b.errors - a.errors || a.id.localeCompare(b.id));
                const unresolvedRequests = sortNewestFirst(hub.read({ type: 'request', unresolved: true, limit: 200 }).messages);
                const html = layout({
                    title: 'Incidents',
                    channels: currentChannels,
                    activePage: 'incidents',
                    body: incidentsPage(workers, unresolvedRequests),
                });
                return sendHtml(res, html);
            }
            // ── Worker detail page ──
            const workerMatch = pathname.match(/^\/worker\/(.+)$/);
            if (workerMatch) {
                const workerId = decodeURIComponent(workerMatch[1]);
                const sync = hub.workerSync(workerId);
                const worker = hub.workerGet(workerId);
                if (!worker) {
                    return sendHtml(res, layout({
                        title: 'Not Found',
                        channels: currentChannels,
                        activePage: 'workers',
                        body: notFoundPage(),
                    }), 404);
                }
                const messages = hub.read({ workerId, limit: 100 }).messages;
                const actionHistory = hub.listOperatorActions({ workerId, limit: 50 });
                const html = layout({
                    title: `Worker ${workerId}`,
                    channels: currentChannels,
                    activePage: 'workers',
                    body: workerDetailPage({
                        ...worker,
                        health: (0,reactor/* detectHealth */._2)(worker.lastEventAt),
                    }, messages, sync, actionHistory),
                });
                return sendHtml(res, html);
            }
            // ── Worker events API ──
            const apiEventsMatch = pathname.match(/^\/api\/workers\/(.+)\/events$/);
            if (apiEventsMatch) {
                const workerId = decodeURIComponent(apiEventsMatch[1]);
                const worker = hub.workerGet(workerId);
                if (!worker || !worker.eventsPath) {
                    return sendJson(res, { error: 'Worker not found or no events path' }, 404);
                }
                // Resolve telemetry reader from worker telemetry source path.
                const reader = getTelemetryReader(worker.eventsPath);
                if (!reader) {
                    return sendJson(res, {
                        error: `Unsupported telemetry source: ${worker.eventsPath}`
                    }, 400);
                }
                // Parse query params
                const rawLimit = parseInt(query.get('limit') || '500', 10);
                const limit = Math.min(Math.max(1, rawLimit), 500);
                const cursor = query.get('cursor') || null;
                const view = query.get('view') === 'conversation' ? 'conversation' : 'raw';
                // Read events with pagination
                const result = reader.readEvents(worker.eventsPath, cursor, limit);
                // If conversation view, transform events
                let response = {
                    workerId,
                    view,
                    ...result,
                };
                if (view === 'conversation' && !result.error) {
                    const conversationItems = reader.toConversation(result.events);
                    response = {
                        ...response,
                        conversationItems,
                    };
                }
                return sendJson(res, response);
            }
            // ── Thread view ──
            const threadMatch = pathname.match(/^\/thread\/(.+)$/);
            if (threadMatch) {
                const messageId = decodeURIComponent(threadMatch[1]);
                try {
                    const thread = hub.readThread(messageId);
                    if (thread.length === 0) {
                        return sendHtml(res, layout({
                            title: 'Not Found',
                            channels: currentChannels,
                            activePage: 'thread',
                            body: notFoundPage(),
                        }), 404);
                    }
                    const parent = thread[0];
                    const replies = thread.slice(1);
                    const html = layout({
                        title: 'Thread',
                        channels: currentChannels,
                        activePage: 'thread',
                        body: threadView(parent, replies),
                    });
                    return sendHtml(res, html);
                }
                catch {
                    return sendHtml(res, layout({
                        title: 'Not Found',
                        channels: currentChannels,
                        activePage: 'thread',
                        body: notFoundPage(),
                    }), 404);
                }
            }
            // ── 404 ──
            sendHtml(res, layout({
                title: 'Not Found',
                channels: currentChannels,
                activePage: 'overview',
                body: notFoundPage(),
            }), 404);
        }
        catch (err) {
            console.error('Request error:', err);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error');
        }
    });
    server.listen(port, () => {
        const status = hub.status();
        console.log(`\n🚀 Agents Hub dashboard running at http://localhost:${port}`);
        console.log(`   Hub ID: ${status.hubId}`);
        console.log(`   Mode: ${status.mode}`);
        console.log(`   Channels: ${Object.keys(status.channels).join(', ')}`);
        console.log(`   Total messages: ${status.totalMessages}\n`);
    });
    server.on('close', () => {
        if (workerSyncTimer)
            clearInterval(workerSyncTimer);
    });
}


/***/ })

};
