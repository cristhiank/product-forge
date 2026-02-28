/**
 * Lightweight HTTP server for the backlog dashboard.
 * Uses node:http (zero deps), fs.watch for live-reload via SSE.
 */

import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import { createBacklogAPI } from "../backlog-api.js";
import { MultiRootBacklogStore } from "../storage/multi-root-store.js";
import { discoverProjects, type ProjectEntry } from "../storage/project-discovery.js";
import { CSS } from "./styles.js";
import {
  layout,
  kanbanBoard,
  itemDetail,
  statsPage,
  searchPage,
  notFoundPage,
} from "./renderer.js";

// ── SSE clients ──────────────────────────────────────────────

const sseClients = new Set<http.ServerResponse>();

function broadcastReload(): void {
  for (const res of sseClients) {
    try {
      res.write("event: reload\ndata: {}\n\n");
    } catch {
      sseClients.delete(res);
    }
  }
}

// ── File watcher ─────────────────────────────────────────────

function watchBacklogDirs(projects: ProjectEntry[]): void {
  let debounce: ReturnType<typeof setTimeout> | null = null;
  const onChange = () => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => broadcastReload(), 300);
  };

  for (const p of projects) {
    try {
      fs.watch(p.root, { recursive: true }, onChange);
    } catch {
      // Non-fatal: recursive watch not supported everywhere
    }
  }
}

// ── Route helpers ────────────────────────────────────────────

function sendHtml(res: http.ServerResponse, html: string, status = 200): void {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

function sendCss(res: http.ServerResponse): void {
  res.writeHead(200, {
    "Content-Type": "text/css; charset=utf-8",
    "Cache-Control": "public, max-age=60",
  });
  res.end(CSS);
}

function parseUrl(url: string): { pathname: string; query: URLSearchParams } {
  const idx = url.indexOf("?");
  const pathname = idx >= 0 ? url.slice(0, idx) : url;
  const query = new URLSearchParams(idx >= 0 ? url.slice(idx + 1) : "");
  return { pathname, query };
}

// ── Server ───────────────────────────────────────────────────

export interface ServeOptions {
  port: number;
  scanDir: string;
}

export async function startServer(opts: ServeOptions): Promise<void> {
  let projects = await discoverProjects(opts.scanDir);

  // Fallback: check if scanDir itself has a .backlog/
  if (projects.length === 0) {
    const backlogDir = path.join(opts.scanDir, ".backlog");
    try {
      const stat = fs.statSync(backlogDir);
      if (stat.isDirectory()) {
        projects = [{ name: path.basename(opts.scanDir), root: backlogDir }];
      }
    } catch {
      // ignore
    }
  }

  if (projects.length === 0) {
    console.error("No .backlog/ directories found under:", opts.scanDir);
    process.exit(1);
  }

  const store = new MultiRootBacklogStore(projects);
  const api = createBacklogAPI(store);
  const projectNames = api.projects();

  // Compute per-project total counts for sidebar
  async function getProjectCounts(): Promise<Record<string, number>> {
    const allStats = await api.globalStats();
    const counts: Record<string, number> = {};
    for (const [name, folders] of Object.entries(allStats)) {
      counts[name] = Object.values(folders).reduce((a, b) => a + b, 0);
    }
    return counts;
  }

  // Start watching
  watchBacklogDirs(projects);

  const server = http.createServer(async (req, res) => {
    try {
      const { pathname, query } = parseUrl(req.url || "/");

      // ── Static ──
      if (pathname === "/styles.css") return sendCss(res);

      // ── SSE ──
      if (pathname === "/events") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        res.write(":\n\n"); // comment to keep connection open
        sseClients.add(res);
        req.on("close", () => sseClients.delete(res));
        return;
      }

      const projectCounts = await getProjectCounts();

      // ── Board (root) ──
      if (pathname === "/") {
        const items = await api.list({ project: undefined });
        const html = layout({
          title: "Board",
          projects: projectNames,
          activePage: "board",
          projectCounts,
          body: kanbanBoard(items),
        });
        return sendHtml(res, html);
      }

      // ── Board per project ──
      const projectMatch = pathname.match(/^\/project\/(.+)$/);
      if (projectMatch) {
        const projectName = decodeURIComponent(projectMatch[1]);
        if (!projectNames.includes(projectName)) {
          return sendHtml(
            res,
            layout({ title: "Not Found", projects: projectNames, activePage: "board", projectCounts, body: notFoundPage() }),
            404
          );
        }
        const items = await api.list({ project: projectName });
        const html = layout({
          title: projectName,
          projects: projectNames,
          currentProject: projectName,
          activePage: "board",
          projectCounts,
          body: kanbanBoard(items, projectName),
        });
        return sendHtml(res, html);
      }

      // ── Item detail ──
      const itemMatch = pathname.match(/^\/item\/(.+)$/);
      if (itemMatch) {
        const itemId = decodeURIComponent(itemMatch[1]);
        try {
          const item = await api.get({ id: itemId });
          const html = layout({
            title: item.title,
            projects: projectNames,
            currentProject: item.project,
            activePage: "detail",
            projectCounts,
            body: itemDetail(item),
          });
          return sendHtml(res, html);
        } catch {
          return sendHtml(
            res,
            layout({ title: "Not Found", projects: projectNames, activePage: "detail", projectCounts, body: notFoundPage() }),
            404
          );
        }
      }

      // ── Stats ──
      if (pathname === "/stats") {
        const [statsData, hygieneData] = await Promise.all([
          api.globalStats(),
          api.hygiene(),
        ]);
        const html = layout({
          title: "Stats & Hygiene",
          projects: projectNames,
          activePage: "stats",
          projectCounts,
          body: statsPage(statsData as Record<string, Record<string, number>>, hygieneData),
        });
        return sendHtml(res, html);
      }

      // ── Search ──
      if (pathname === "/search") {
        const q = query.get("q") || "";
        const results = q ? await api.globalSearch({ text: q }) : [];
        const html = layout({
          title: q ? `Search: ${q}` : "Search",
          projects: projectNames,
          activePage: "search",
          projectCounts,
          body: searchPage(results, q),
        });
        return sendHtml(res, html);
      }

      // ── 404 ──
      sendHtml(
        res,
        layout({ title: "Not Found", projects: projectNames, activePage: "board", projectCounts, body: notFoundPage() }),
        404
      );
    } catch (err) {
      console.error("Request error:", err);
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Server Error");
    }
  });

  server.listen(opts.port, () => {
    console.log(`\n🚀 Backlog dashboard running at http://localhost:${opts.port}`);
    console.log(`   Watching ${projects.length} project(s): ${projects.map((p) => p.name).join(", ")}`);
    console.log(`   Root: ${opts.scanDir}\n`);
  });
}
