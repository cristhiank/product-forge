export function getStyles(): string {
  return `
/* === Forge Mission Control — Dark Control Room Theme === */

:root {
  --bg: #0d1117;
  --surface: #161b22;
  --border: #30363d;
  --text: #e6edf3;
  --text-muted: #8b949e;
  --accent: #58a6ff;
  --success: #3fb950;
  --warning: #d29922;
  --danger: #f85149;
  --info: #bc8cff;
  --radius: 8px;
  --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  --font-mono: "SF Mono", "Fira Code", "Cascadia Code", monospace;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font);
  font-size: 14px;
  line-height: 1.5;
}

/* --- Top Bar --- */
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 100;
}

.topbar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.topbar-icon { font-size: 20px; }
.topbar-title { font-size: 16px; font-weight: 600; }

.topbar-repo {
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--text-muted);
  background: var(--bg);
  padding: 4px 10px;
  border-radius: var(--radius);
}

/* --- Layout --- */
.app {
  display: flex;
  min-height: calc(100vh - 49px);
}

.sidebar {
  width: 200px;
  background: var(--surface);
  border-right: 1px solid var(--border);
  padding: 16px 0;
  flex-shrink: 0;
}

.content {
  flex: 1;
  padding: 24px 32px;
  overflow-y: auto;
}

/* --- Navigation --- */
.nav { display: flex; flex-direction: column; gap: 2px; }

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 20px;
  color: var(--text-muted);
  text-decoration: none;
  font-size: 14px;
  transition: background 0.15s, color 0.15s;
  cursor: pointer;
}

.nav-item:hover { background: rgba(88, 166, 255, 0.08); color: var(--text); }
.nav-item--active { color: var(--accent); background: rgba(88, 166, 255, 0.12); border-left: 3px solid var(--accent); }
.nav-item--disabled { opacity: 0.4; cursor: not-allowed; }
.nav-item--disabled:hover { background: none; color: var(--text-muted); }

.nav-icon { font-size: 16px; width: 24px; text-align: center; }

/* --- Page --- */
.page-title { font-size: 20px; font-weight: 600; margin-bottom: 4px; }
.page-subtitle { color: var(--text-muted); margin-bottom: 24px; }
.page-subtitle code {
  font-family: var(--font-mono);
  font-size: 12px;
  background: var(--surface);
  padding: 2px 6px;
  border-radius: 4px;
}

/* --- Cards --- */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px;
  display: flex;
  align-items: flex-start;
  gap: 16px;
  transition: border-color 0.15s;
}

.card:hover { border-color: var(--accent); }

.card-icon { font-size: 28px; flex-shrink: 0; }

.card-body { flex: 1; min-width: 0; }
.card-title { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
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
}

.card-link:hover { text-decoration: underline; }

/* --- Badges --- */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.badge--success { background: rgba(63, 185, 80, 0.15); color: var(--success); }
.badge--warning { background: rgba(210, 153, 34, 0.15); color: var(--warning); }
.badge--danger  { background: rgba(248, 81, 73, 0.15); color: var(--danger); }
.badge--info    { background: rgba(188, 140, 255, 0.15); color: var(--info); }
.badge--muted   { background: rgba(139, 148, 158, 0.15); color: var(--text-muted); }

/* --- Tables --- */
.table {
  width: 100%;
  border-collapse: collapse;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.table th,
.table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
}

.table th {
  text-align: left;
  font-weight: 600;
  color: var(--text);
  background: rgba(88, 166, 255, 0.08);
}

.table tbody tr:nth-child(even) { background: rgba(255, 255, 255, 0.02); }
.table tbody tr:hover { background: rgba(88, 166, 255, 0.08); }
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
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 16px;
}

.metric-card-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.metric-card-label { color: var(--text-muted); font-size: 12px; }
.metric-card-value { font-size: 24px; font-weight: 700; line-height: 1.2; }
.metric-card--success { border-color: rgba(63, 185, 80, 0.45); }
.metric-card--warning { border-color: rgba(210, 153, 34, 0.45); }
.metric-card--danger { border-color: rgba(248, 81, 73, 0.45); }
.metric-card--info { border-color: rgba(188, 140, 255, 0.45); }

/* --- Empty State --- */
.empty-state {
  text-align: center;
  padding: 32px 20px;
  color: var(--text-muted);
  border: 1px dashed var(--border);
  border-radius: var(--radius);
  background: rgba(255, 255, 255, 0.01);
}

.empty-state-message { margin-bottom: 6px; color: var(--text); }
.empty-state-suggestion { font-size: 13px; }

/* --- Priority --- */
.priority-high { background: rgba(248, 81, 73, 0.2); color: var(--danger); }
.priority-medium { background: rgba(210, 153, 34, 0.2); color: var(--warning); }
.priority-low { background: rgba(63, 185, 80, 0.2); color: var(--success); }

/* --- Markdown --- */
.markdown-body { color: var(--text); line-height: 1.6; }
.markdown-body > * + * { margin-top: 12px; }
.markdown-body h1,
.markdown-body h2,
.markdown-body h3,
.markdown-body h4,
.markdown-body h5,
.markdown-body h6 {
  line-height: 1.25;
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
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px;
  overflow: auto;
}

.markdown-body pre code {
  display: block;
  border: none;
  padding: 0;
  background: transparent;
}

.markdown-body blockquote {
  border-left: 3px solid var(--border);
  padding-left: 12px;
  color: var(--text-muted);
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
`;
}
