import { createHistorySnapshot, listHistory } from "./history/history.js";
import { toQualifiedId } from "./id-utils.js";
import { parseBacklogMarkdown } from "./markdown/parser.js";
import { formatBacklogItemTemplate } from "./markdown/templates.js";
import { validateBacklogItem } from "./markdown/validate.js";
import type { MultiRootBacklogStore } from "./storage/multi-root-store.js";
import type { BacklogHistoryEntry, BacklogItem, BacklogItemSummary, BriefResult, Folder, HygieneResult } from "./types.js";
import { folderToStatus, isFolder } from "./types.js";

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .replace(/-/g, "_")
    .slice(0, 80);
}

export function createBacklogAPI(store: MultiRootBacklogStore) {
  const singleProject = store.isSingleProject();
  const defaultProject = store.getDefaultProject();

  function qualifyId(project: string, localId: string): string {
    return singleProject ? localId : toQualifiedId(project, localId);
  }

  function resolveProject(project?: string): string {
    if (project) return project;
    if (defaultProject) return defaultProject;
    throw new Error(
      `Project is required in multi-project mode. Available: ${store.getProjects().join(", ")}`
    );
  }

  const api = {
    help: () => {
      const projects = store.getProjects();
      return {
        name: "backlog",
        description: singleProject
          ? "Repo backlog maintenance API (Kanban-lite)"
          : `Multi-project backlog API. Projects: ${projects.join(", ")}`,
        projects,
        singleProjectMode: singleProject,
        folders: ["next", "working", "done", "archive"],
        safety: {
          note: "User code runs in a restricted VM sandbox. Only the injected backlog API is available.",
          root_sandbox: "All filesystem operations are rooted under configured backlog roots; path traversal is rejected.",
        },
        api: {
          help: "backlog.help()",
          projects: "backlog.projects()",
          list: "backlog.list({ project?, folder?, limit?, offset? })",
          get: "backlog.get({ id })",
          search: "backlog.search({ text, project?, folder?, limit? })",
          stats: "backlog.stats({ project? })",
          globalStats: "backlog.globalStats()",
          globalSearch: "backlog.globalSearch({ text, folder?, limit? })",
          hygiene: "backlog.hygiene({ project?, staleAfterDays?, doneAfterDays? })",
          create: "backlog.create({ kind, title, project?, description?, acceptance_criteria?, tags?, priority?, parent?, depends_on?, related? })",
          move: "backlog.move({ id, to })",
          complete: "backlog.complete({ id, completedDate? })",
          archive: "backlog.archive({ id })",
          validate: "backlog.validate({ id })",
          updateBody: "backlog.updateBody({ id, body, message? })",
          getHistory: "backlog.getHistory({ id, limit? })",
          xref: "backlog.xref({ id })",
        },
        best_practices: {
          ordered_refined: "Keep the backlog ordered and continuously refined (Scrum.org)",
          invest: "Prefer INVEST-ish items: Independent, Negotiable, Valuable, Estimable, Small, Testable (Agile Alliance)",
          prune: "Archive or close items the team will never do to avoid backlog rot (Atlassian)",
        },
        examples: [
          {
            title: "List next items",
            code: "return backlog.list({ folder: 'next', limit: 20 })",
          },
          ...(singleProject
            ? []
            : [
                {
                  title: "List items for a specific project",
                  code: "return backlog.list({ project: 'frontend', folder: 'next' })",
                },
                {
                  title: "Global stats across all projects",
                  code: "return backlog.globalStats()",
                },
                {
                  title: "Find cross-references",
                  code: "return backlog.xref({ id: 'frontend/B-001' })",
                },
              ]),
        ],
      };
    },

    projects: () => {
      return store.getProjects();
    },

    list: async (opts?: { project?: string; folder?: Folder; limit?: number; offset?: number; unblocked?: boolean }): Promise<BacklogItemSummary[]> => {
      const folder = opts?.folder;
      if (folder && !isFolder(folder)) throw new Error(`Invalid folder: ${String(folder)}`);

      const items = await store.list(opts?.project, folder);
      let mapped = items.map((i) => {
        const parsed = parseBacklogMarkdown(i.body);
        return {
          id: qualifyId(i.project, i.id),
          title: parsed.title,
          folder: i.folder,
          path: i.path,
          project: i.project,
          kind: parsed.metadata.Type,
          priority: parsed.metadata.Priority,
          status: parsed.metadata.Status,
          tags: parsed.tags,
          depends_on: parsed.depends_on.length ? parsed.depends_on : undefined,
          related: parsed.related.length ? parsed.related : undefined,
        } satisfies BacklogItemSummary;
      });

      // Filter to unblocked items (all deps in done/archive)
      if (opts?.unblocked) {
        const allItems = await store.list(opts?.project);
        const doneIds = new Set(
          allItems.filter(i => i.folder === "done" || i.folder === "archive")
            .map(i => qualifyId(i.project, i.id))
        );
        mapped = mapped.filter(item => {
          if (!item.depends_on || item.depends_on.length === 0) return true;
          return item.depends_on.every(dep => doneIds.has(dep));
        });
      }

      const offset = opts?.offset ?? 0;
      const limit = opts?.limit ?? mapped.length;
      return mapped.slice(offset, offset + limit);
    },

    get: async (req: { id: string }): Promise<BacklogItem> => {
      const resolved = store.resolveId(req.id);
      const item = await store.getById(req.id);
      const parsed = parseBacklogMarkdown(item.body);
      return {
        id: qualifyId(resolved.project, resolved.localId),
        title: parsed.title,
        folder: item.folder,
        path: item.path,
        project: resolved.project,
        body: item.body,
        metadata: parsed.metadata,
        kind: parsed.metadata.Type,
        priority: parsed.metadata.Priority,
        status: parsed.metadata.Status,
        tags: parsed.tags,
        depends_on: parsed.depends_on.length ? parsed.depends_on : undefined,
        related: parsed.related.length ? parsed.related : undefined,
      };
    },

    search: async (req: { text: string; project?: string; folder?: Folder; limit?: number }): Promise<BacklogItemSummary[]> => {
      const folder = req.folder;
      if (folder && !isFolder(folder)) throw new Error(`Invalid folder: ${String(folder)}`);

      const items = await store.search(req.text, req.project, folder);
      const mapped = items.map((i) => {
        const parsed = parseBacklogMarkdown(i.body);
        return {
          id: qualifyId(i.project, i.id),
          title: parsed.title,
          folder: i.folder,
          path: i.path,
          project: i.project,
          kind: parsed.metadata.Type,
          priority: parsed.metadata.Priority,
          status: parsed.metadata.Status,
          tags: parsed.tags,
          depends_on: parsed.depends_on.length ? parsed.depends_on : undefined,
          related: parsed.related.length ? parsed.related : undefined,
        };
      });
      return mapped.slice(0, req.limit ?? mapped.length);
    },

    globalSearch: async (req: { text: string; folder?: Folder; limit?: number }): Promise<BacklogItemSummary[]> => {
      return api.search({ ...req, project: undefined });
    },

    stats: async (opts?: { project?: string }) => {
      const baseCounts = await store.stats(opts?.project);
      const allItems = await store.list(opts?.project);
      
      const now = new Date();
      const ageByFolder: Record<string, { oldest_days: number; avg_days: number; items_over_30d: number }> = {};
      
      // Group items by folder
      const itemsByFolder: Record<Folder, Array<{ age_days: number }>> = {
        next: [],
        working: [],
        done: [],
        archive: [],
      };
      
      for (const item of allItems) {
        const parsed = parseBacklogMarkdown(item.body);
        const updatedDate = parsed.metadata.Updated;
        const createdDate = parsed.metadata.Created;
        const referenceDate = updatedDate || createdDate;
        
        if (referenceDate) {
          const itemDate = new Date(referenceDate);
          const ageDays = Math.max(0, Math.floor((now.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24)));
          itemsByFolder[item.folder].push({ age_days: ageDays });
        }
      }
      
      // Compute age stats per folder
      for (const folder of ["next", "working", "done", "archive"] as Folder[]) {
        const items = itemsByFolder[folder];
        if (items.length === 0) {
          ageByFolder[folder] = { oldest_days: 0, avg_days: 0, items_over_30d: 0 };
        } else {
          const ages = items.map(i => i.age_days);
          const oldest = Math.max(...ages);
          const avg = Math.floor(ages.reduce((a, b) => a + b, 0) / ages.length);
          const over30 = ages.filter(a => a > 30).length;
          ageByFolder[folder] = { oldest_days: oldest, avg_days: avg, items_over_30d: over30 };
        }
      }
      
      // Merge age into the base counts structure
      const result: any = {};
      for (const [projectName, counts] of Object.entries(baseCounts)) {
        result[projectName] = {
          ...counts,
          age: ageByFolder,
        };
      }
      
      return result;
    },

    globalStats: async () => {
      return store.stats();
    },

    create: async (req: {
      kind: "task" | "epic";
      title: string;
      project?: string;
      description?: string;
      acceptance_criteria?: string[];
      tags?: string[];
      priority?: "low" | "medium" | "high";
      parent?: string;
      depends_on?: string[];
      related?: string[];
    }): Promise<{ id: string; path: string; project: string }> => {
      const project = resolveProject(req.project);
      const projectStore = store.getStore(project);
      const newId = await allocateId(projectStore, req.parent);
      const filename = `${newId}_${slugify(req.title) || "item"}.md`;
      const body = formatBacklogItemTemplate({
        id: newId,
        kind: req.kind,
        title: req.title,
        description: req.description,
        acceptance_criteria: req.acceptance_criteria,
        tags: req.tags,
        priority: req.priority,
        parent: req.parent,
        depends_on: req.depends_on,
        related: req.related,
      });
      const created = await store.createFile(project, "next", filename, body);
      return {
        id: qualifyId(project, newId),
        path: created.path,
        project,
      };
    },

    move: async (req: { id: string; to: Folder }) => {
      if (!isFolder(req.to)) throw new Error(`Invalid folder: ${String(req.to)}`);
      const moved = await store.move(req.id, req.to);
      const item = await store.getById(req.id);
      let updated = stampStatus(item.body, folderToStatus(req.to));
      updated = stampUpdated(updated);
      await store.writeBody(req.id, updated);
      return moved;
    },

    complete: async (req: { id: string; completedDate?: string }) => {
      const moved = await store.move(req.id, "done");
      const item = await store.getById(req.id);
      let updated = stampCompleted(item.body, req.completedDate);
      updated = stampStatus(updated, folderToStatus("done"));
      updated = stampUpdated(updated);
      await store.writeBody(req.id, updated);
      return { path: moved.path, project: moved.project };
    },

    archive: async (req: { id: string }) => {
      const moved = await store.move(req.id, "archive");
      const item = await store.getById(req.id);
      let updated = stampArchived(item.body);
      updated = stampStatus(updated, folderToStatus("archive"));
      updated = stampUpdated(updated);
      await store.writeBody(req.id, updated);
      return { path: moved.path, project: moved.project };
    },

    validate: async (req: { id: string }) => {
      const item = await api.get({ id: req.id });
      const resolved = store.resolveId(req.id);
      const allItems = await api.list({ project: resolved.project });
      const allItemsFull = await Promise.all(
        allItems.map(summary => api.get({ id: summary.id }))
      );
      return validateBacklogItem(item, allItemsFull);
    },

    updateBody: async (req: { id: string; body: string; message?: string }) => {
      const resolved = store.resolveId(req.id);
      const current = await store.getById(req.id);
      const historyEntry = await createHistorySnapshot({
        root: store.getRoot(resolved.project),
        id: resolved.localId,
        currentBody: current.body,
        message: req.message,
      });

      const updated = stampUpdated(req.body);
      await store.writeBody(req.id, updated);
      return { id: qualifyId(resolved.project, resolved.localId), version: historyEntry.version, path: current.path };
    },

    getHistory: async (req: { id: string; limit?: number }): Promise<BacklogHistoryEntry[]> => {
      const resolved = store.resolveId(req.id);
      const entries = await listHistory({ root: store.getRoot(resolved.project), id: resolved.localId });
      return entries.slice(0, req.limit ?? entries.length);
    },

    xref: async (req: { id: string }): Promise<BacklogItemSummary[]> => {
      const refs = await store.findReferences(req.id);
      return refs.map((i) => {
        const parsed = parseBacklogMarkdown(i.body);
        return {
          id: qualifyId(i.project, i.id),
          title: parsed.title,
          folder: i.folder,
          path: i.path,
          project: i.project,
          kind: parsed.metadata.Type,
          priority: parsed.metadata.Priority,
          status: parsed.metadata.Status,
          tags: parsed.tags,
          depends_on: parsed.depends_on.length ? parsed.depends_on : undefined,
          related: parsed.related.length ? parsed.related : undefined,
        };
      });
    },

    brief: async (opts?: { project?: string }): Promise<BriefResult> => {
      const hygieneResult = await api.hygiene({ project: opts?.project });
      const working = await api.list({ project: opts?.project, folder: "working" });
      const next = await api.list({ project: opts?.project, folder: "next", limit: 10 });
      const statsResult = await api.stats({ project: opts?.project });

      // Items with status/folder mismatches (e.g., Status=Done but still in next/)
      const mismatchIds = new Set(hygieneResult.status_folder_mismatches.map(m => m.id));

      // Resolve dependency status for next items
      const allItems = await api.list({ project: opts?.project });
      const doneIds = new Set(allItems.filter(i => i.folder === "done" || i.folder === "archive").map(i => i.id));
      const unblocked = next.filter(item => {
        if (mismatchIds.has(item.id)) return false; // exclude mismatched items from recommendations
        if (!item.depends_on || item.depends_on.length === 0) return true;
        return item.depends_on.every(dep => doneIds.has(dep));
      });

      return {
        health: hygieneResult.health_score,
        issues: hygieneResult.stale_in_next.length + hygieneResult.stuck_in_working.length + hygieneResult.old_in_done.length + hygieneResult.status_folder_mismatches.length,
        mismatches: hygieneResult.status_folder_mismatches,
        wip: working.map(i => ({ id: i.id, title: i.title, priority: i.priority })),
        next_unblocked: unblocked.map(i => ({ id: i.id, title: i.title, priority: i.priority })),
        next_blocked: next.filter(i => !unblocked.includes(i) && !mismatchIds.has(i.id)).map(i => ({ id: i.id, title: i.title, priority: i.priority, blocked_by: i.depends_on })),
        stats: statsResult,
      };
    },

    pick: async (req: { id: string }): Promise<BacklogItem> => {
      await api.move({ id: req.id, to: "working" });
      return api.get({ id: req.id });
    },

    hygiene: async (opts?: { project?: string; staleAfterDays?: number; doneAfterDays?: number; fix?: boolean }): Promise<HygieneResult> => {
      const staleAfterDays = opts?.staleAfterDays ?? 30;
      const workingStaleAfterDays = 14;
      const doneAfterDays = opts?.doneAfterDays ?? 7;
      const now = new Date();

      const allItems = await store.list(opts?.project);
      
      const stale_in_next: HygieneResult["stale_in_next"] = [];
      const stuck_in_working: HygieneResult["stuck_in_working"] = [];
      const old_in_done: HygieneResult["old_in_done"] = [];
      const status_folder_mismatches: HygieneResult["status_folder_mismatches"] = [];
      
      for (const item of allItems) {
        const parsed = parseBacklogMarkdown(item.body);
        const updatedDate = parsed.metadata.Updated;
        const createdDate = parsed.metadata.Created;
        const referenceDate = updatedDate || createdDate;
        
        if (!referenceDate) continue;
        
        const itemDate = new Date(referenceDate);
        const ageDays = Math.max(0, Math.floor((now.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24)));
        
        const itemInfo = {
          id: qualifyId(item.project, item.id),
          title: parsed.title,
          folder: item.folder,
          age_days: ageDays,
          project: item.project,
        };
        
        if (item.folder === "next" && ageDays > staleAfterDays) {
          stale_in_next.push(itemInfo);
        } else if (item.folder === "working" && ageDays > workingStaleAfterDays) {
          stuck_in_working.push(itemInfo);
        } else if (item.folder === "done" && ageDays > doneAfterDays) {
          old_in_done.push(itemInfo);
        }

        // Detect status/folder mismatches
        const expectedStatus = folderToStatus(item.folder);
        const actualStatus = parsed.metadata.Status;
        if (actualStatus && actualStatus !== expectedStatus) {
          status_folder_mismatches.push({
            ...itemInfo,
            status: actualStatus,
            expected_status: expectedStatus,
          });

          if (opts?.fix) {
            let body = item.body;
            body = stampStatus(body, expectedStatus);
            body = stampUpdated(body);
            await store.writeBody(qualifyId(item.project, item.id), body);
          }
        }
      }
      
      const total_items = allItems.length;
      const issue_count = stale_in_next.length + stuck_in_working.length + old_in_done.length + status_folder_mismatches.length;
      const health_score: HygieneResult["health_score"] = 
        issue_count === 0 ? "healthy" :
        issue_count < total_items * 0.1 ? "needs_attention" : "unhealthy";
      
      return {
        stale_in_next,
        stuck_in_working,
        old_in_done,
        status_folder_mismatches,
        total_items,
        health_score,
        ...(opts?.fix ? { fixed: status_folder_mismatches.length } : {}),
      };
    },
  };

  return api;
}

async function allocateId(store: { list(folder?: Folder): Promise<Array<{ id: string }>> }, parent?: string): Promise<string> {
  const all = await store.list();
  const ids = all.map((i) => i.id);

  // Child story: B-040.1, B-040.2, ...
  if (parent) {
    if (!/^[A-Z]+-\d+(?:\.\d+)*$/.test(parent)) throw new Error(`Invalid parent id: ${parent}`);
    const prefix = `${parent}.`;
    const children = ids
      .filter((id) => id.startsWith(prefix))
      .map((id) => Number(id.substring(prefix.length)))
      .filter((n) => Number.isFinite(n) && n > 0);
    const next = (children.length ? Math.max(...children) : 0) + 1;
    return `${parent}.${next}`;
  }

  const bases = ids
    .map((id) => id.match(/^[A-Z]+-(\d+)/))
    .map((m) => (m ? Number(m[1]) : NaN))
    .filter((n) => Number.isFinite(n));
  const next = (bases.length ? Math.max(...bases) : 0) + 1;
  return `B-${String(next).padStart(3, "0")}`;
}

function stampCompleted(body: string, completedDate?: string): string {
  const date = completedDate || new Date().toISOString().slice(0, 10);
  const lines = body.split(/\r?\n/);
  const out: string[] = [];
  let inserted = false;

  for (const line of lines) {
    if (/^\*\*Completed:\*\*/.test(line)) {
      out.push(`**Completed:** ${date}  `);
      inserted = true;
    } else {
      out.push(line);
    }
  }

  if (inserted) return out.join("\n");

  // Insert after Created if present, else after title
  const createdIdx = out.findIndex((l) => /^\*\*Created:\*\*/.test(l));
  const insertAt = createdIdx >= 0 ? createdIdx + 1 : 2;
  out.splice(insertAt, 0, `**Completed:** ${date}  `);
  return out.join("\n");
}

function stampUpdated(body: string, updatedDate?: string): string {
  const date = updatedDate || new Date().toISOString().slice(0, 10);
  const lines = body.split(/\r?\n/);
  const out: string[] = [];
  let inserted = false;

  for (const line of lines) {
    if (/^\*\*Updated:\*\*/.test(line)) {
      out.push(`**Updated:** ${date}  `);
      inserted = true;
    } else {
      out.push(line);
    }
  }

  if (inserted) return out.join("\n");

  // Insert after Created if present, else after title
  const createdIdx = out.findIndex((l) => /^\*\*Created:\*\*/.test(l));
  const insertAt = createdIdx >= 0 ? createdIdx + 1 : 2;
  out.splice(insertAt, 0, `**Updated:** ${date}  `);
  return out.join("\n");
}

function stampArchived(body: string, archivedDate?: string): string {
  const date = archivedDate || new Date().toISOString().slice(0, 10);
  const lines = body.split(/\r?\n/);
  const out: string[] = [];
  let inserted = false;

  for (const line of lines) {
    if (/^\*\*Archived:\*\*/.test(line)) {
      out.push(`**Archived:** ${date}  `);
      inserted = true;
    } else {
      out.push(line);
    }
  }

  if (inserted) return out.join("\n");

  // Insert after Created if present, else after title
  const createdIdx = out.findIndex((l) => /^\*\*Created:\*\*/.test(l));
  const insertAt = createdIdx >= 0 ? createdIdx + 1 : 2;
  out.splice(insertAt, 0, `**Archived:** ${date}  `);
  return out.join("\n");
}

function stampStatus(body: string, status: string): string {
  const lines = body.split(/\r?\n/);
  const out: string[] = [];
  let inserted = false;

  for (const line of lines) {
    if (/^\*\*Status:\*\*/.test(line)) {
      out.push(`**Status:** ${status}  `);
      inserted = true;
    } else {
      out.push(line);
    }
  }

  if (inserted) return out.join("\n");

  // Insert after Created if present, else after title
  const createdIdx = out.findIndex((l) => /^\*\*Created:\*\*/.test(l));
  const insertAt = createdIdx >= 0 ? createdIdx + 1 : 2;
  out.splice(insertAt, 0, `**Status:** ${status}  `);
  return out.join("\n");
}
