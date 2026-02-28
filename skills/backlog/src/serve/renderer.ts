/**
 * Server-rendered HTML templates for the backlog dashboard.
 * Pure functions — each returns an HTML string.
 */

import type { BacklogItem, BacklogItemSummary, Folder } from "../types.js";

// ── Helpers ──────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function priorityBadge(priority?: string): string {
  if (!priority) return "";
  const cls = priority.toLowerCase();
  return `<span class="badge badge-${esc(cls)}">${esc(priority)}</span>`;
}

function folderBadge(folder: string): string {
  return `<span class="folder-badge folder-${esc(folder)}">${esc(folder)}</span>`;
}

function tagPills(tags?: string[]): string {
  if (!tags?.length) return "";
  return tags.map((t) => `<span class="tag">${esc(t)}</span>`).join(" ");
}

function depIndicator(deps?: string[]): string {
  if (!deps?.length) return "";
  return `<span class="dep-count">🔗 ${deps.length}</span>`;
}

/** Minimal markdown→HTML (no deps, handles the basics). */
function mdToHtml(md: string): string {
  // Remove the metadata block (lines starting with ** until ---)
  const lines = md.split(/\r?\n/);
  let bodyStart = 0;
  let foundHr = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      if (foundHr) { bodyStart = i + 1; break; }
      foundHr = true;
    }
  }
  const body = lines.slice(bodyStart).join("\n");

  let html = esc(body);
  // Code blocks (fenced)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) => `<pre><code>${code.trim()}</code></pre>`);
  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  // Headings
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  // Bold / italic
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  // Unordered list items
  html = html.replace(/^- \[x\] (.+)$/gm, '<li style="list-style:none;">☑ $1</li>');
  html = html.replace(/^- \[ \] (.+)$/gm, '<li style="list-style:none;">☐ $1</li>');
  html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
  // Wrap consecutive <li> in <ul>
  html = html.replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g, "<ul>$1</ul>");
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  // Paragraphs (double newline)
  html = html.replace(/\n{2,}/g, "</p><p>");
  html = `<p>${html}</p>`;
  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, "");
  return html;
}

// ── Layout Shell ─────────────────────────────────────────────

interface LayoutOpts {
  title: string;
  projects: string[];
  currentProject?: string;
  activePage: "board" | "stats" | "search" | "detail";
  projectCounts?: Record<string, number>;
  body: string;
}

export function layout(opts: LayoutOpts): string {
  const projectNav = opts.projects
    .map((p) => {
      const isActive = p === opts.currentProject;
      const count = opts.projectCounts?.[p] ?? "";
      return `<li><a href="/project/${esc(p)}" class="${isActive ? "active" : ""}">
        📁 ${esc(p)}
        ${count ? `<span class="count">${count}</span>` : ""}
      </a></li>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(opts.title)} — Backlog</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <div class="layout">
    <nav class="sidebar">
      <div class="sidebar-brand">
        <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
          <path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354Z"/>
        </svg>
        Backlog
      </div>

      <div class="sidebar-section">
        <div class="sidebar-section-title">Navigation</div>
        <ul class="sidebar-nav">
          <li><a href="/" class="${opts.activePage === "board" && !opts.currentProject ? "active" : ""}">📋 Board</a></li>
          <li><a href="/stats" class="${opts.activePage === "stats" ? "active" : ""}">📊 Stats &amp; Hygiene</a></li>
          <li><a href="/search" class="${opts.activePage === "search" ? "active" : ""}">🔍 Search</a></li>
        </ul>
      </div>

      ${opts.projects.length > 1 ? `
      <div class="sidebar-section">
        <div class="sidebar-section-title">Projects</div>
        <ul class="sidebar-nav">
          ${projectNav}
        </ul>
      </div>` : ""}

      <div class="sidebar-section" style="margin-top: auto;">
        <form action="/search" method="get" class="search-form" style="max-width:100%;">
          <input class="search-input" type="text" name="q" placeholder="Search items…">
        </form>
      </div>
    </nav>

    <main class="main">
      ${opts.body}
    </main>
  </div>

  <script>
    // SSE live-reload
    if (typeof EventSource !== 'undefined') {
      const es = new EventSource('/events');
      es.addEventListener('reload', () => location.reload());
      es.onerror = () => { es.close(); setTimeout(() => location.reload(), 3000); };
    }
  </script>
</body>
</html>`;
}

// ── Kanban Board ─────────────────────────────────────────────

function renderCard(item: BacklogItemSummary): string {
  const href = `/item/${esc(encodeURIComponent(item.id))}`;
  return `<a href="${href}" class="card">
    <div class="card-id">${esc(item.id)}</div>
    <div class="card-title">${esc(item.title)}</div>
    <div class="card-meta">
      ${priorityBadge(item.priority)}
      ${tagPills(item.tags)}
      ${depIndicator(item.depends_on)}
    </div>
  </a>`;
}

export function kanbanBoard(
  items: BacklogItemSummary[],
  projectName?: string
): string {
  const folders: Folder[] = ["next", "working", "done", "archive"];
  const byFolder: Record<Folder, BacklogItemSummary[]> = {
    next: [], working: [], done: [], archive: [],
  };
  for (const item of items) byFolder[item.folder].push(item);

  const columns = folders
    .map((f) => {
      const colItems = byFolder[f];
      const cardsHtml = colItems.length
        ? colItems.map(renderCard).join("\n")
        : `<div class="kanban-empty">No items</div>`;
      return `<div class="kanban-column">
        <div class="kanban-column-header">
          <span class="dot ${f}"></span>
          ${f.charAt(0).toUpperCase() + f.slice(1)}
          <span class="kanban-column-count">${colItems.length}</span>
        </div>
        <div class="kanban-items">${cardsHtml}</div>
      </div>`;
    })
    .join("\n");

  return `
    <div class="page-header">
      <div>
        <div class="page-title">${projectName ? esc(projectName) : "All Projects"}</div>
        <div class="page-subtitle">${items.length} items</div>
      </div>
    </div>
    <div class="kanban">${columns}</div>`;
}

// ── Item Detail ──────────────────────────────────────────────

export function itemDetail(item: BacklogItem): string {
  const metaEntries = Object.entries(item.metadata)
    .filter(([k]) => !["Tags", "Depends-On", "Depends On", "Related"].includes(k))
    .map(
      ([k, v]) => `<div class="detail-meta-item">
      <div class="detail-meta-label">${esc(k)}</div>
      <div class="detail-meta-value">${esc(v)}</div>
    </div>`
    )
    .join("\n");

  const depsHtml = item.depends_on?.length
    ? `<div class="detail-deps">
        <div class="detail-deps-title">🔗 Depends On</div>
        <ul class="detail-deps-list">
          ${item.depends_on.map((d) => `<li><a href="/item/${esc(encodeURIComponent(d))}">${esc(d)}</a></li>`).join("")}
        </ul>
      </div>`
    : "";

  const relatedHtml = item.related?.length
    ? `<div class="detail-deps">
        <div class="detail-deps-title">↔ Related</div>
        <ul class="detail-deps-list">
          ${item.related.map((r) => `<li><a href="/item/${esc(encodeURIComponent(r))}">${esc(r)}</a></li>`).join("")}
        </ul>
      </div>`
    : "";

  const projectLink = item.project
    ? `<a href="/project/${esc(item.project)}">${esc(item.project)}</a>`
    : `<a href="/">Board</a>`;

  return `
    <div class="detail-container">
      <div class="breadcrumb">
        ${projectLink}
        <span>/</span>
        ${folderBadge(item.folder)}
      </div>
      <div class="detail-header">
        <div class="detail-id">${esc(item.id)}</div>
        <div class="detail-title">${esc(item.title)}</div>
        <div class="card-meta" style="margin-top:8px;">
          ${priorityBadge(item.priority)}
          ${tagPills(item.tags)}
        </div>
      </div>
      <div class="detail-meta">${metaEntries}</div>
      <div class="detail-body">${mdToHtml(item.body)}</div>
      ${depsHtml}
      ${relatedHtml}
    </div>`;
}

// ── Stats & Hygiene ──────────────────────────────────────────

interface HygieneData {
  stale_in_next: Array<{ id: string; title: string; age_days: number }>;
  stuck_in_working: Array<{ id: string; title: string; age_days: number }>;
  old_in_done: Array<{ id: string; title: string; age_days: number }>;
  total_items: number;
  health_score: string;
}

export function statsPage(
  stats: Record<string, Record<string, number>>,
  hygiene: HygieneData
): string {
  // Aggregate stats across projects
  let totalNext = 0, totalWorking = 0, totalDone = 0, totalArchive = 0;
  for (const counts of Object.values(stats)) {
    totalNext += (counts.next ?? 0);
    totalWorking += (counts.working ?? 0);
    totalDone += (counts.done ?? 0);
    totalArchive += (counts.archive ?? 0);
  }
  const total = totalNext + totalWorking + totalDone + totalArchive;

  const healthCls = `health-${hygiene.health_score.replace(/\s/g, "_")}`;
  const healthLabel = hygiene.health_score.replace(/_/g, " ");

  function alertGroup(title: string, icon: string, items: Array<{ id: string; title: string; age_days: number }>): string {
    if (!items.length) return "";
    return `<div class="alert-group">
      <div class="alert-group-header">
        <span class="alert-icon">${icon}</span>
        ${esc(title)} (${items.length})
      </div>
      <div class="alert-group-items">
        ${items.map((i) => `<div class="alert-item">
          <span class="alert-item-age">${i.age_days}d</span>
          <a href="/item/${esc(encodeURIComponent(i.id))}">${esc(i.id)}</a>
          <span>${esc(i.title)}</span>
        </div>`).join("")}
      </div>
    </div>`;
  }

  // Per-project breakdown
  const projectRows = Object.entries(stats)
    .map(([name, counts]) => {
      const pTotal = (counts.next ?? 0) + (counts.working ?? 0) + (counts.done ?? 0) + (counts.archive ?? 0);
      return `<tr>
        <td><a href="/project/${esc(name)}">${esc(name)}</a></td>
        <td>${counts.next ?? 0}</td>
        <td>${counts.working ?? 0}</td>
        <td>${counts.done ?? 0}</td>
        <td>${counts.archive ?? 0}</td>
        <td><strong>${pTotal}</strong></td>
      </tr>`;
    })
    .join("");

  const hasProjectTable = Object.keys(stats).length > 1;

  return `
    <div class="page-header">
      <div>
        <div class="page-title">Stats &amp; Hygiene</div>
        <div class="page-subtitle">${total} items across ${Object.keys(stats).length} project(s)</div>
      </div>
      <span class="health-badge ${healthCls}">${esc(healthLabel)}</span>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-card-label">Next</div>
        <div class="stat-card-value" style="color:var(--color-next)">${totalNext}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Working</div>
        <div class="stat-card-value" style="color:var(--color-working)">${totalWorking}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Done</div>
        <div class="stat-card-value" style="color:var(--color-done)">${totalDone}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Archived</div>
        <div class="stat-card-value" style="color:var(--color-archive)">${totalArchive}</div>
      </div>
    </div>

    ${hasProjectTable ? `
    <div style="background:var(--color-bg);border:1px solid var(--color-border);border-radius:var(--radius);overflow:hidden;margin-bottom:24px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead style="background:var(--color-bg-subtle);">
          <tr>
            <th style="text-align:left;padding:10px 16px;border-bottom:1px solid var(--color-border);">Project</th>
            <th style="text-align:center;padding:10px 12px;border-bottom:1px solid var(--color-border);">Next</th>
            <th style="text-align:center;padding:10px 12px;border-bottom:1px solid var(--color-border);">Working</th>
            <th style="text-align:center;padding:10px 12px;border-bottom:1px solid var(--color-border);">Done</th>
            <th style="text-align:center;padding:10px 12px;border-bottom:1px solid var(--color-border);">Archive</th>
            <th style="text-align:center;padding:10px 12px;border-bottom:1px solid var(--color-border);">Total</th>
          </tr>
        </thead>
        <tbody>
          ${projectRows}
        </tbody>
      </table>
    </div>` : ""}

    <div class="alerts-section">
      <div class="alerts-title">Hygiene Alerts</div>
      ${alertGroup("Stale in Next", "🕐", hygiene.stale_in_next)}
      ${alertGroup("Stuck in Working", "⚠️", hygiene.stuck_in_working)}
      ${alertGroup("Old in Done", "📦", hygiene.old_in_done)}
      ${!hygiene.stale_in_next.length && !hygiene.stuck_in_working.length && !hygiene.old_in_done.length
        ? `<div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-text">No hygiene issues. Backlog is healthy!</div></div>`
        : ""}
    </div>`;
}

// ── Search Results ───────────────────────────────────────────

export function searchPage(results: BacklogItemSummary[], query: string): string {
  const resultsHtml = results.length
    ? `<ul class="search-results">
        ${results.map((r) => `<li class="search-result">
          <div>
            <div style="display:flex;align-items:center;gap:8px;">
              <a href="/item/${esc(encodeURIComponent(r.id))}" class="search-result-title">${esc(r.title)}</a>
              ${folderBadge(r.folder)}
              ${priorityBadge(r.priority)}
            </div>
            <div class="search-result-meta">
              <span class="search-result-id">${esc(r.id)}</span>
              ${r.project ? `· ${esc(r.project)}` : ""}
              ${tagPills(r.tags)}
            </div>
          </div>
        </li>`).join("")}
      </ul>`
    : query
      ? `<div class="empty-state"><div class="empty-state-icon">🔍</div><div class="empty-state-text">No results for "${esc(query)}"</div></div>`
      : `<div class="empty-state"><div class="empty-state-icon">🔍</div><div class="empty-state-text">Enter a search term above</div></div>`;

  return `
    <div class="page-header">
      <div>
        <div class="page-title">Search</div>
        ${query ? `<div class="page-subtitle">${results.length} result(s) for "${esc(query)}"</div>` : ""}
      </div>
    </div>
    <form action="/search" method="get" class="search-form" style="margin-bottom:20px;max-width:100%;">
      <input class="search-input" type="text" name="q" placeholder="Search items…" value="${esc(query)}" autofocus>
      <button class="search-btn" type="submit">Search</button>
    </form>
    ${resultsHtml}`;
}

// ── 404 ──────────────────────────────────────────────────────

export function notFoundPage(): string {
  return `<div class="empty-state">
    <div class="empty-state-icon">🤷</div>
    <div class="empty-state-text">Page not found</div>
    <p style="margin-top:8px;"><a href="/">← Back to board</a></p>
  </div>`;
}
