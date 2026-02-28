/** GitHub-issues-inspired minimal CSS for the backlog dashboard. */
export const CSS = /* css */ `
:root {
  --color-bg: #ffffff;
  --color-bg-subtle: #f6f8fa;
  --color-bg-inset: #eff2f5;
  --color-border: #d1d9e0;
  --color-border-subtle: #e1e4e8;
  --color-text: #1f2328;
  --color-text-secondary: #656d76;
  --color-text-muted: #8b949e;
  --color-link: #0969da;
  --color-accent: #0969da;
  --color-success: #1a7f37;
  --color-warning: #9a6700;
  --color-danger: #d1242f;
  --color-next: #0969da;
  --color-working: #9a6700;
  --color-done: #1a7f37;
  --color-archive: #656d76;
  --radius: 6px;
  --shadow-sm: 0 1px 0 rgba(27,31,36,.04);
  --shadow-md: 0 3px 6px rgba(140,149,159,.15);
  --font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: var(--color-text);
  background: var(--color-bg-subtle);
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
  background: var(--color-bg);
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
.sidebar-nav li a:hover { background: var(--color-bg-subtle); text-decoration: none; }
.sidebar-nav li a.active { background: var(--color-bg-inset); font-weight: 600; }
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
  background: var(--color-bg);
  color: var(--color-text);
  outline: none;
}
.search-input:focus { border-color: var(--color-accent); box-shadow: 0 0 0 3px rgba(9,105,218,.15); }
.search-btn {
  padding: 5px 16px;
  font-size: 14px;
  font-weight: 500;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-bg);
  color: var(--color-text);
  cursor: pointer;
}
.search-btn:hover { background: var(--color-bg-subtle); }

/* Kanban board */
.kanban {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  align-items: start;
}

.kanban-column {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  overflow: hidden;
}

.kanban-column-header {
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid var(--color-border-subtle);
  background: var(--color-bg-subtle);
}

.kanban-column-header .dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.kanban-column-header .dot.next { background: var(--color-next); }
.kanban-column-header .dot.working { background: var(--color-working); }
.kanban-column-header .dot.done { background: var(--color-done); }
.kanban-column-header .dot.archive { background: var(--color-archive); }

.kanban-column-count {
  margin-left: auto;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-muted);
  background: var(--color-bg-inset);
  padding: 0 6px;
  border-radius: 10px;
}

.kanban-items {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 70vh;
  overflow-y: auto;
}

.kanban-empty {
  padding: 20px 12px;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 13px;
}

/* Cards */
.card {
  display: block;
  padding: 10px 12px;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius);
  background: var(--color-bg);
  box-shadow: var(--shadow-sm);
  color: var(--color-text);
  transition: box-shadow 0.15s;
}
.card:hover { box-shadow: var(--shadow-md); text-decoration: none; }

.card-id {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-text-muted);
}

.card-title {
  font-size: 13px;
  font-weight: 500;
  margin-top: 2px;
  line-height: 1.4;
}

.card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
  align-items: center;
}

/* Priority badges */
.badge {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 500;
  padding: 1px 6px;
  border-radius: 10px;
  white-space: nowrap;
}
.badge-high, .badge-critical {
  background: #ffebe9;
  color: var(--color-danger);
  border: 1px solid #ffcecb;
}
.badge-medium {
  background: #fff8c5;
  color: var(--color-warning);
  border: 1px solid #f5e0a0;
}
.badge-low {
  background: #dafbe1;
  color: var(--color-success);
  border: 1px solid #aef2b9;
}

/* Tags */
.tag {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 500;
  padding: 1px 6px;
  border-radius: 10px;
  background: var(--color-bg-inset);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border-subtle);
}

/* Dependency indicator */
.dep-count {
  font-size: 11px;
  color: var(--color-text-muted);
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

/* Item detail */
.detail-container {
  max-width: 860px;
}

.detail-header {
  margin-bottom: 16px;
}
.detail-id {
  font-family: var(--font-mono);
  font-size: 14px;
  color: var(--color-text-muted);
}
.detail-title {
  font-size: 24px;
  font-weight: 600;
  margin-top: 4px;
}

.detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 16px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  margin-bottom: 16px;
}

.detail-meta-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.detail-meta-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
.detail-meta-value {
  font-size: 14px;
}

.detail-body {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 20px 24px;
}
.detail-body h1 { font-size: 20px; margin: 16px 0 8px; border-bottom: 1px solid var(--color-border-subtle); padding-bottom: 6px; }
.detail-body h2 { font-size: 17px; margin: 14px 0 6px; }
.detail-body h3 { font-size: 15px; margin: 12px 0 4px; }
.detail-body p { margin: 8px 0; }
.detail-body ul, .detail-body ol { margin: 8px 0; padding-left: 24px; }
.detail-body li { margin: 2px 0; }
.detail-body code {
  font-family: var(--font-mono);
  font-size: 13px;
  background: var(--color-bg-inset);
  padding: 2px 5px;
  border-radius: 3px;
}
.detail-body pre {
  background: var(--color-bg-inset);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius);
  padding: 12px 16px;
  overflow-x: auto;
  margin: 8px 0;
}
.detail-body pre code { background: none; padding: 0; }
.detail-body a { color: var(--color-link); }

.detail-deps {
  margin-top: 16px;
  padding: 16px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}
.detail-deps-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
}
.detail-deps-list {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/* Stats */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: var(--color-bg);
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
}

/* Hygiene alerts */
.alerts-section { margin-top: 24px; }
.alerts-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
}

.alert-group {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  margin-bottom: 12px;
  overflow: hidden;
}
.alert-group-header {
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--color-bg-subtle);
  border-bottom: 1px solid var(--color-border-subtle);
}
.alert-group-header .alert-icon { font-size: 14px; }
.alert-group-items { padding: 8px 16px; }
.alert-item {
  padding: 6px 0;
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid var(--color-border-subtle);
  font-size: 13px;
}
.alert-item:last-child { border-bottom: none; }
.alert-item-age {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-text-muted);
  min-width: 50px;
}

/* Search results */
.search-results { list-style: none; }
.search-result {
  padding: 12px 16px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  margin-bottom: 8px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.search-result:hover { box-shadow: var(--shadow-md); }
.search-result-id {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-text-muted);
  min-width: 60px;
}
.search-result-title {
  font-weight: 500;
}
.search-result-meta {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 2px;
}

/* Health score */
.health-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 10px;
}
.health-healthy { background: #dafbe1; color: var(--color-success); }
.health-needs_attention { background: #fff8c5; color: var(--color-warning); }
.health-unhealthy { background: #ffebe9; color: var(--color-danger); }

/* Breadcrumb */
.breadcrumb {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-bottom: 8px;
}
.breadcrumb a { color: var(--color-link); }
.breadcrumb span { margin: 0 4px; }

/* Folder badge in search */
.folder-badge {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 500;
  padding: 1px 6px;
  border-radius: 10px;
  border: 1px solid;
}
.folder-next { background: #ddf4ff; color: var(--color-next); border-color: #b6e3ff; }
.folder-working { background: #fff8c5; color: var(--color-working); border-color: #f5e0a0; }
.folder-done { background: #dafbe1; color: var(--color-done); border-color: #aef2b9; }
.folder-archive { background: var(--color-bg-inset); color: var(--color-archive); border-color: var(--color-border-subtle); }

/* Empty state */
.empty-state {
  text-align: center;
  padding: 48px 24px;
  color: var(--color-text-muted);
}
.empty-state-icon { font-size: 40px; margin-bottom: 12px; }
.empty-state-text { font-size: 16px; }

/* Responsive */
@media (max-width: 1200px) {
  .kanban { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 768px) {
  .layout { flex-direction: column; }
  .sidebar { width: 100%; height: auto; position: static; border-right: none; border-bottom: 1px solid var(--color-border); }
  .kanban { grid-template-columns: 1fr; }
}
`;
