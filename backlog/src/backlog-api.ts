import { createHistorySnapshot, listHistory } from "./history/history.js";
import { parseBacklogMarkdown } from "./markdown/parser.js";
import { formatBacklogItemTemplate } from "./markdown/templates.js";
import { validateBacklogItem } from "./markdown/validate.js";
import type { BacklogStore } from "./storage/backlog-store.js";
import type { BacklogHistoryEntry, BacklogItem, BacklogItemSummary, Folder } from "./types.js";
import { isFolder } from "./types.js";

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

function ensureSerializable(value: unknown): unknown {
  // No-op for now; vm result must be JSON-serializable anyway.
  return value;
}

export function createBacklogAPI(store: BacklogStore) {
  const api = {
    help: () => {
      return {
        name: "backlog",
        description: "Repo backlog maintenance API for app/.backlog (Kanban-lite)",
        root: store.getRoot(),
        folders: ["next", "working", "done", "archive"],
        safety: {
          note: "User code runs in a restricted VM sandbox. Only the injected backlog API is available.",
          root_sandbox: "All filesystem operations are rooted under the configured backlog root; path traversal is rejected.",
        },
        api: {
          help: "backlog.help()",
          list: "backlog.list({ folder?, limit?, offset? })",
          get: "backlog.get({ id })",
          search: "backlog.search({ text, folder?, limit? })",
          stats: "backlog.stats()",
          create: "backlog.create({ kind, title, description?, acceptance_criteria?, tags?, priority?, parent? })",
          move: "backlog.move({ id, to })",
          complete: "backlog.complete({ id, completedDate? })",
          archive: "backlog.archive({ id })",
          validate: "backlog.validate({ id })",
          updateBody: "backlog.updateBody({ id, body, message? })",
          getHistory: "backlog.getHistory({ id, limit? })",
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
          {
            title: "Search for duplicates",
            code: "return backlog.search({ text: 'mcp', folder: 'next', limit: 50 })",
          },
          {
            title: "Update body with history",
            code: "return backlog.updateBody({ id: 'B-046.1', body: '# B-046.1: ...\\n', message: 'Refine acceptance criteria' })",
          },
        ],
      };
    },

    list: async (opts?: { folder?: Folder; limit?: number; offset?: number }): Promise<BacklogItemSummary[]> => {
      const folder = opts?.folder;
      if (folder && !isFolder(folder)) throw new Error(`Invalid folder: ${String(folder)}`);
      const items = await store.list(folder);
      const mapped = items.map((i) => {
        const parsed = parseBacklogMarkdown(i.body);
        return {
          id: i.id,
          title: parsed.title,
          folder: i.folder,
          path: i.path,
          kind: parsed.metadata.Type,
          priority: parsed.metadata.Priority,
          status: parsed.metadata.Status,
          tags: parsed.tags,
        } satisfies BacklogItemSummary;
      });

      const offset = opts?.offset ?? 0;
      const limit = opts?.limit ?? mapped.length;
      return mapped.slice(offset, offset + limit);
    },

    get: async (req: { id: string }): Promise<BacklogItem> => {
      const item = await store.getById(req.id);
      const parsed = parseBacklogMarkdown(item.body);
      return {
        id: item.id,
        title: parsed.title,
        folder: item.folder,
        path: item.path,
        body: item.body,
        metadata: parsed.metadata,
        kind: parsed.metadata.Type,
        priority: parsed.metadata.Priority,
        status: parsed.metadata.Status,
        tags: parsed.tags,
      };
    },

    search: async (req: { text: string; folder?: Folder; limit?: number }): Promise<BacklogItemSummary[]> => {
      const folder = req.folder;
      if (folder && !isFolder(folder)) throw new Error(`Invalid folder: ${String(folder)}`);
      const items = await store.search(req.text, folder);
      const mapped = items.map((i) => {
        const parsed = parseBacklogMarkdown(i.body);
        return {
          id: i.id,
          title: parsed.title,
          folder: i.folder,
          path: i.path,
          kind: parsed.metadata.Type,
          priority: parsed.metadata.Priority,
          status: parsed.metadata.Status,
          tags: parsed.tags,
        };
      });
      return mapped.slice(0, req.limit ?? mapped.length);
    },

    stats: async () => {
      return store.stats();
    },

    create: async (req: {
      kind: "task" | "epic";
      title: string;
      description?: string;
      acceptance_criteria?: string[];
      tags?: string[];
      priority?: "low" | "medium" | "high";
      parent?: string;
    }): Promise<{ id: string; path: string }> => {
      const newId = await allocateId(store, req.parent);
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
      });
      const created = await store.createFile("next", filename, body);
      return ensureSerializable({ id: newId, path: created.path }) as { id: string; path: string };
    },

    move: async (req: { id: string; to: Folder }) => {
      if (!isFolder(req.to)) throw new Error(`Invalid folder: ${String(req.to)}`);
      return store.move(req.id, req.to);
    },

    complete: async (req: { id: string; completedDate?: string }) => {
      const moved = await store.move(req.id, "done");
      const item = await store.getById(req.id);
      const updated = stampCompleted(item.body, req.completedDate);
      await store.writeBody(req.id, updated);
      return { path: moved.path };
    },

    archive: async (req: { id: string }) => {
      const moved = await store.move(req.id, "archive");
      return { path: moved.path };
    },

    validate: async (req: { id: string }) => {
      const item = await api.get({ id: req.id });
      return validateBacklogItem(item);
    },

    updateBody: async (req: { id: string; body: string; message?: string }) => {
      // Ensure item exists & load current
      const current = await store.getById(req.id);
      // snapshot current -> history
      const historyEntry = await createHistorySnapshot({
        root: store.getRoot(),
        id: req.id,
        currentBody: current.body,
        message: req.message,
      });

      await store.writeBody(req.id, req.body);
      return { id: req.id, version: historyEntry.version, path: current.path };
    },

    getHistory: async (req: { id: string; limit?: number }): Promise<BacklogHistoryEntry[]> => {
      const entries = await listHistory({ root: store.getRoot(), id: req.id });
      return entries.slice(0, req.limit ?? entries.length);
    },
  };

  return api;
}

async function allocateId(store: BacklogStore, parent?: string): Promise<string> {
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
