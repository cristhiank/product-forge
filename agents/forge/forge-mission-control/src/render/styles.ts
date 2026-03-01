export function getStyles(): string {
  return `
/* === Forge Mission Control — Polished Dark Theme === */

:root {
  --bg: #0a0e14;
  --bg-raised: #0d1117;
  --surface: #151b23;
  --surface-hover: #1c2430;
  --border: #262e3a;
  --border-subtle: #1e2632;
  --text: #e6edf3;
  --text-secondary: #b0b8c4;
  --text-muted: #6e7a88;
  --accent: #58a6ff;
  --accent-subtle: rgba(88, 166, 255, 0.12);
  --success: #3fb950;
  --warning: #d29922;
  --danger: #f85149;
  --info: #58a6ff;
  --purple: #bc8cff;
  --radius: 12px;
  --radius-sm: 8px;
  --radius-xs: 6px;
  --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  --font-mono: "SF Mono", "Fira Code", "Cascadia Code", monospace;
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.3);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.35);
  --shadow-lg: 0 8px 24px rgba(0,0,0,0.4);
  --transition: 0.2s ease;
  --sidebar-width: 240px;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font);
  font-size: 14px;
  line-height: 1.6;
}

/* --- Top Bar --- */
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 24px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 100;
  backdrop-filter: blur(8px);
}

.topbar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.topbar-icon { font-size: 18px; }
.topbar-title { font-size: 15px; font-weight: 600; letter-spacing: -0.01em; }

.topbar-repo {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-muted);
  background: var(--bg);
  padding: 4px 10px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--border-subtle);
}

/* --- Layout --- */
.app {
  display: flex;
  min-height: calc(100vh - 45px - 32px);
}

.sidebar {
  width: var(--sidebar-width);
  background: var(--surface);
  border-right: 1px solid var(--border);
  padding: 12px 0;
  flex-shrink: 0;
  overflow-y: auto;
}

.content {
  flex: 1;
  padding: 32px 40px;
  overflow-y: auto;
  max-width: 1400px;
}

/* --- Navigation --- */
.nav { display: flex; flex-direction: column; gap: 1px; }

.nav-section-label {
  padding: 16px 20px 6px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}

.nav-divider {
  height: 1px;
  background: var(--border-subtle);
  margin: 8px 16px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 20px;
  color: var(--text-muted);
  text-decoration: none;
  font-size: 13px;
  transition: background var(--transition), color var(--transition);
  cursor: pointer;
  border-left: 3px solid transparent;
}

.nav-item:hover { background: var(--accent-subtle); color: var(--text); }
.nav-item--active {
  color: var(--accent);
  background: var(--accent-subtle);
  border-left-color: var(--accent);
  font-weight: 500;
}
.nav-item--disabled { opacity: 0.35; cursor: not-allowed; }
.nav-item--disabled:hover { background: none; color: var(--text-muted); }

.nav-sub-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 20px 6px 48px;
  color: var(--text-muted);
  text-decoration: none;
  font-size: 12px;
  transition: background var(--transition), color var(--transition);
}

.nav-sub-item:hover { background: rgba(88, 166, 255, 0.06); color: var(--text-secondary); }
.nav-sub-item--active { color: var(--accent); background: rgba(88, 166, 255, 0.08); }

.nav-icon { font-size: 15px; width: 22px; text-align: center; flex-shrink: 0; }

/* --- Status Bar --- */
.statusbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 6px 24px;
  background: var(--surface);
  border-top: 1px solid var(--border);
  font-size: 11px;
  color: var(--text-muted);
  z-index: 100;
  height: 32px;
}

.statusbar-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--success);
  display: inline-block;
}

/* --- Page --- */
.page-title {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 4px;
  letter-spacing: -0.02em;
  line-height: 1.3;
}

.page-subtitle {
  color: var(--text-muted);
  margin-bottom: 24px;
  font-size: 14px;
}

.page-subtitle code {
  font-family: var(--font-mono);
  font-size: 12px;
  background: var(--surface);
  padding: 2px 6px;
  border-radius: 4px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.02em;
  margin-bottom: 12px;
  margin-top: 32px;
  color: var(--text);
}

/* --- Cards --- */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.card {
  background: linear-gradient(135deg, var(--surface) 0%, rgba(21,27,35,0.8) 100%);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  display: flex;
  align-items: flex-start;
  gap: 14px;
  transition: border-color var(--transition), box-shadow var(--transition), transform var(--transition);
  box-shadow: var(--shadow-sm);
}

.card:hover {
  border-color: var(--accent);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.card-icon { font-size: 24px; flex-shrink: 0; margin-top: 2px; }

.card-body { flex: 1; min-width: 0; }
.card-title { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
.card-copy { font-size: 13px; color: var(--text-secondary); margin-top: 4px; }
.card-meta {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
  word-break: break-all;
}

.card-link {
  color: var(--accent);
  text-decoration: none;
  font-size: 13px;
  white-space: nowrap;
  align-self: center;
  transition: opacity var(--transition);
}

.card-link:hover { text-decoration: underline; opacity: 0.85; }

/* --- Stat Cards (Home) --- */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
  margin-bottom: 24px;
}

.stat-card {
  background: linear-gradient(135deg, var(--surface) 0%, rgba(21,27,35,0.85) 100%);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  text-decoration: none;
  display: block;
  transition: border-color var(--transition), box-shadow var(--transition), transform var(--transition);
  box-shadow: var(--shadow-sm);
}

.stat-card:hover {
  border-color: var(--accent);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.stat-card-value {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.stat-card-label {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}

/* --- Badges --- */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 10px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 500;
}

.badge--success { background: rgba(63, 185, 80, 0.15); color: var(--success); }
.badge--warning { background: rgba(210, 153, 34, 0.15); color: var(--warning); }
.badge--danger  { background: rgba(248, 81, 73, 0.15); color: var(--danger); }
.badge--info    { background: rgba(88, 166, 255, 0.15); color: var(--info); }
.badge--muted   { background: rgba(139, 148, 158, 0.12); color: var(--text-muted); }
.badge--purple  { background: rgba(188, 140, 255, 0.15); color: var(--purple); }

/* --- Tables --- */
.table {
  width: 100%;
  border-collapse: collapse;
  background: var(--surface);
  border-radius: var(--radius);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.table th,
.table td {
  padding: 10px 14px;
  text-align: left;
}

.table th {
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
  background: transparent;
}

.table td {
  border-bottom: 1px solid var(--border-subtle);
  font-size: 13px;
}

.table tbody tr:hover { background: rgba(88, 166, 255, 0.04); }
.table tbody tr:last-child td { border-bottom: none; }

/* --- Breadcrumbs --- */
.breadcrumbs { margin-bottom: 16px; }
.breadcrumbs ol {
  display: flex;
  align-items: center;
  gap: 8px;
  list-style: none;
  color: var(--text-muted);
  font-size: 12px;
}

.breadcrumbs a {
  color: var(--accent);
  text-decoration: none;
}

.breadcrumbs a:hover { text-decoration: underline; }
.breadcrumbs-sep { color: var(--text-muted); }

/* --- Metric Card --- */
.metric-card {
  background: linear-gradient(135deg, var(--surface) 0%, rgba(21,27,35,0.85) 100%);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 16px;
  box-shadow: var(--shadow-sm);
  transition: border-color var(--transition), box-shadow var(--transition);
}

.metric-card:hover {
  box-shadow: var(--shadow-md);
}

.metric-card-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.metric-card-label { color: var(--text-muted); font-size: 12px; }
.metric-card-value { font-size: 24px; font-weight: 700; line-height: 1.2; }
.metric-card--success { border-color: rgba(63, 185, 80, 0.4); }
.metric-card--warning { border-color: rgba(210, 153, 34, 0.4); }
.metric-card--danger { border-color: rgba(248, 81, 73, 0.4); }
.metric-card--info { border-color: rgba(88, 166, 255, 0.4); }

/* --- Empty State --- */
.empty-state {
  text-align: center;
  padding: 32px 20px;
  color: var(--text-muted);
  border: 1px dashed var(--border);
  border-radius: var(--radius);
  background: rgba(255, 255, 255, 0.01);
}

.empty-state-message { margin-bottom: 6px; color: var(--text-secondary); }
.empty-state-suggestion { font-size: 13px; }

/* --- Priority --- */
.priority-high { background: rgba(248, 81, 73, 0.18); color: var(--danger); }
.priority-medium { background: rgba(210, 153, 34, 0.18); color: var(--warning); }
.priority-low { background: rgba(63, 185, 80, 0.18); color: var(--success); }

/* --- Feature Pipeline --- */
.pipeline {
  display: flex;
  gap: 2px;
  height: 28px;
  border-radius: var(--radius-xs);
  overflow: hidden;
  margin-bottom: 24px;
}

.pipeline-segment {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 600;
  color: #fff;
  min-width: 32px;
  padding: 0 8px;
  white-space: nowrap;
}

.pipeline-segment--discovery { background: var(--text-muted); }
.pipeline-segment--defined { background: #6e7a88; }
.pipeline-segment--validated { background: var(--info); }
.pipeline-segment--planned { background: var(--purple); }
.pipeline-segment--building { background: var(--warning); }
.pipeline-segment--shipped { background: var(--success); }
.pipeline-segment--measuring { background: #2ea043; }

/* --- Markdown --- */
.markdown-body { color: var(--text); line-height: 1.7; }
.markdown-body > * + * { margin-top: 14px; }
.markdown-body h1,
.markdown-body h2,
.markdown-body h3,
.markdown-body h4,
.markdown-body h5,
.markdown-body h6 {
  line-height: 1.3;
  letter-spacing: -0.02em;
}

.markdown-body p { color: var(--text); }
.markdown-body a { color: var(--accent); text-decoration: none; }
.markdown-body a:hover { text-decoration: underline; }
.markdown-body code {
  font-family: var(--font-mono);
  font-size: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 1px 5px;
}

.markdown-body pre {
  background: var(--bg-raised);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 14px;
  overflow: auto;
}

.markdown-body pre code {
  display: block;
  border: none;
  padding: 0;
  background: transparent;
}

.markdown-body blockquote {
  border-left: 3px solid var(--accent);
  padding-left: 14px;
  color: var(--text-secondary);
}

.markdown-body ul,
.markdown-body ol { padding-left: 22px; }

.markdown-body hr {
  border: none;
  border-top: 1px solid var(--border);
}

.markdown-body table {
  width: 100%;
  border-collapse: collapse;
  border: 1px solid var(--border);
}

.markdown-body th,
.markdown-body td {
  border: 1px solid var(--border);
  padding: 8px 10px;
}

/* --- Callout / North Star --- */
.callout {
  background: linear-gradient(135deg, rgba(88, 166, 255, 0.08), rgba(188, 140, 255, 0.06));
  border: 1px solid rgba(88, 166, 255, 0.2);
  border-radius: var(--radius);
  padding: 20px 24px;
  margin-bottom: 16px;
}

.callout-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--accent);
  margin-bottom: 6px;
}

.callout-text {
  font-size: 16px;
  font-weight: 500;
  color: var(--text);
  line-height: 1.5;
  font-style: italic;
}

/* --- Backlog: Kanban --- */
.kanban {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.kanban-column {
  background: var(--bg-raised);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0;
  min-height: 200px;
}

.kanban-column--next { border-top: 2px solid var(--info); }
.kanban-column--working { border-top: 2px solid var(--warning); }
.kanban-column--done { border-top: 2px solid var(--success); }
.kanban-column--archive { border-top: 2px solid var(--text-muted); }

.kanban-column-header {
  font-size: 13px;
  font-weight: 600;
  padding: 12px 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: sticky;
  top: 0;
  background: var(--bg-raised);
  border-bottom: 1px solid var(--border-subtle);
  border-radius: var(--radius) var(--radius) 0 0;
  z-index: 1;
}

.kanban-count {
  background: var(--accent-subtle);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 500;
  padding: 1px 8px;
  border-radius: 10px;
}

.kanban-cards {
  padding: 8px;
}

.kanban-card {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  margin-bottom: 6px;
  transition: border-color var(--transition), box-shadow var(--transition);
}

.kanban-card:hover {
  border-color: var(--accent);
  box-shadow: var(--shadow-sm);
}

.kanban-card a { color: var(--text); text-decoration: none; }
.kanban-card-title { font-size: 13px; font-weight: 500; margin-bottom: 4px; line-height: 1.4; }
.kanban-card-meta {
  font-size: 11px;
  color: var(--text-muted);
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
}

/* --- Backlog Detail --- */
.kanban-card-tags,
.backlog-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.tag-pill {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--border);
  font-size: 11px;
  color: var(--text-muted);
}

.tag-pill--muted { opacity: 0.8; }
.backlog-header-meta { display: flex; gap: 8px; flex-wrap: wrap; }
.backlog-meta-grid { display: grid; gap: 8px; }

.link-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.link-list li { display: flex; align-items: center; gap: 8px; }
.link-list a { color: var(--accent); text-decoration: none; }
.link-list a:hover { text-decoration: underline; }

.alerts-list {
  margin-left: 18px;
  color: var(--text-muted);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* --- Search --- */
.search-form {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.search-input {
  flex: 1;
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  padding: 8px 12px;
  font-size: 13px;
  transition: border-color var(--transition);
}

.search-input:focus {
  outline: none;
  border-color: var(--accent);
}

.search-button {
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: var(--radius-xs);
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity var(--transition);
}

.search-button:hover { opacity: 0.85; }

.log-output {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 16px;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 500px;
  overflow-y: auto;
  color: var(--text-muted);
}

.action-bar { display: flex; gap: 8px; margin: 16px 0; }

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: 13px;
  cursor: pointer;
  text-decoration: none;
  transition: border-color var(--transition), background var(--transition);
}

.btn:hover { border-color: var(--accent); background: var(--surface-hover); }
.btn--danger { border-color: var(--danger); color: var(--danger); }
.btn--danger:hover { background: rgba(248, 81, 73, 0.1); }

.message-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  margin-bottom: 10px;
  transition: border-color var(--transition);
}

.message-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--text-muted);
}

.message-content { font-size: 14px; line-height: 1.5; }

.cost-highlight { font-size: 24px; font-weight: 700; color: var(--warning); }

/* --- Home dashboard --- */
.home-header {
  margin-bottom: 32px;
}

.home-header h1 {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.03em;
  margin-bottom: 6px;
}

.home-header p {
  color: var(--text-secondary);
  font-size: 15px;
  line-height: 1.5;
}

.home-stage-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 4px 12px;
  border-radius: var(--radius-sm);
  background: linear-gradient(135deg, rgba(88, 166, 255, 0.12), rgba(188, 140, 255, 0.1));
  color: var(--accent);
  font-size: 12px;
  font-weight: 500;
}

.quick-links {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
  margin-top: 24px;
}

.quick-link {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  background: linear-gradient(135deg, var(--surface) 0%, rgba(21,27,35,0.85) 100%);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  text-decoration: none;
  color: var(--text);
  transition: border-color var(--transition), box-shadow var(--transition), transform var(--transition);
  box-shadow: var(--shadow-sm);
}

.quick-link:hover {
  border-color: var(--accent);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.quick-link-icon { font-size: 24px; }
.quick-link-body { flex: 1; }
.quick-link-title { font-size: 14px; font-weight: 600; }
.quick-link-desc { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
`;
}
