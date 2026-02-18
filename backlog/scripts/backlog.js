#!/usr/bin/env node

// dist/skill-cli.js
import * as fs4 from "node:fs/promises";
import * as path4 from "node:path";

// dist/history/history.js
import * as fs from "node:fs/promises";
import * as path from "node:path";
function assertValidId(id) {
  if (!/^[A-Z]+-\d+(?:\.\d+)*$/.test(id)) {
    throw new Error(`Invalid backlog id: ${id}`);
  }
}
function isoCompactUtcNow() {
  const d = /* @__PURE__ */ new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + "T" + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + "Z";
}
function historyDir(root, id) {
  assertValidId(id);
  return path.resolve(path.resolve(root), ".history", id);
}
async function createHistorySnapshot(opts) {
  const dir = historyDir(opts.root, opts.id);
  await fs.mkdir(dir, { recursive: true });
  const existing = await listHistory({ root: opts.root, id: opts.id });
  const nextVersion = (existing.length ? Math.max(...existing.map((e) => e.version)) : 0) + 1;
  const ts = isoCompactUtcNow();
  const filename = `${ts}_v${nextVersion}.md`;
  const metaFilename = `${ts}_v${nextVersion}.json`;
  const snapshotPath = path.join(dir, filename);
  const metaPath = path.join(dir, metaFilename);
  const handle = await fs.open(snapshotPath, "wx");
  try {
    await handle.writeFile(opts.currentBody, "utf8");
  } finally {
    await handle.close();
  }
  await fs.writeFile(metaPath, JSON.stringify({
    id: opts.id,
    version: nextVersion,
    timestamp: ts,
    message: opts.message
  }, null, 2), "utf8");
  return {
    id: opts.id,
    version: nextVersion,
    timestamp: ts,
    path: path.posix.join(".history", opts.id, filename),
    message: opts.message
  };
}
async function listHistory(opts) {
  const dir = historyDir(opts.root, opts.id);
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const e of entries) {
    if (!e.isFile())
      continue;
    const m = e.name.match(/^(\d{8}T\d{6}Z)_v(\d+)\.json$/);
    if (!m)
      continue;
    const [_, ts, vRaw] = m;
    const v = Number(vRaw);
    const metaPath = path.join(dir, e.name);
    let message;
    try {
      const meta = JSON.parse(await fs.readFile(metaPath, "utf8"));
      message = meta.message;
    } catch {
      message = void 0;
    }
    out.push({
      id: opts.id,
      version: v,
      timestamp: ts,
      path: path.posix.join(".history", opts.id, `${ts}_v${v}.md`),
      message
    });
  }
  out.sort((a, b) => b.version - a.version);
  return out;
}

// dist/id-utils.js
function parseQualifiedId(id) {
  const slash = id.indexOf("/");
  if (slash < 0)
    return { localId: id };
  const project = id.substring(0, slash);
  const localId = id.substring(slash + 1);
  if (!project || !localId)
    throw new Error(`Invalid qualified id: ${id}`);
  return { project, localId };
}
function toQualifiedId(project, localId) {
  return project ? `${project}/${localId}` : localId;
}
function isValidLocalId(id) {
  return /^[A-Z]+-\d+(?:\.\d+)*$/.test(id);
}
function isValidProjectName(name) {
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(name);
}

// dist/markdown/parser.js
function parseBacklogMarkdown(markdown) {
  const lines = markdown.split(/\r?\n/);
  const titleLine = lines.find((l) => l.startsWith("# ")) || "# (untitled)";
  const title = titleLine.replace(/^#\s+/, "").trim();
  const metadata = {};
  const tags = [];
  const depends_on = [];
  const related = [];
  for (const line of lines) {
    const m = line.match(/^\*\*(.+?):\*\*\s*(.*)$/);
    if (!m)
      continue;
    const key = m[1].trim();
    const value = m[2].trim();
    metadata[key] = value;
    const parsedList = value.replace(/^\[/, "").replace(/\]$/, "").split(",").map((t) => t.trim()).filter(Boolean);
    if (key.toLowerCase() === "tags") {
      tags.push(...parsedList);
    } else if (key.toLowerCase() === "depends-on" || key.toLowerCase() === "depends on") {
      depends_on.push(...parsedList);
    } else if (key.toLowerCase() === "related") {
      related.push(...parsedList);
    }
  }
  return { title, metadata, tags, depends_on, related };
}

// dist/markdown/templates.js
function formatBacklogItemTemplate(opts) {
  const created = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const tags = opts.tags?.length ? `[${opts.tags.join(", ")}]` : "[]";
  const priority = opts.priority ? capitalize(opts.priority) : "Medium";
  const type = opts.kind === "epic" ? "Epic" : "Story";
  const parentLine = opts.parent ? `**Parent:** ${opts.parent}  ` : "**Parent:** N/A  ";
  const depsLine = opts.depends_on?.length ? `**Depends-On:** [${opts.depends_on.join(", ")}]  
` : "";
  const relatedLine = opts.related?.length ? `**Related:** [${opts.related.join(", ")}]  
` : "";
  const ac = opts.acceptance_criteria?.length ? opts.acceptance_criteria.map((x) => `- [ ] ${x}`).join("\n") : "- [ ]";
  return `# ${opts.id}: ${opts.title}

**Created:** ${created}  
**Updated:** ${created}  
**Type:** ${type}  
**Priority:** ${priority}  
**Status:** Not Started  
**Estimate:** TBD  
` + parentLine + `
` + depsLine + relatedLine + `**Tags:** ${tags}  

---

## Goal

${opts.description?.trim() || "(describe the goal)"}

## Acceptance Criteria

${ac}

`;
}
function capitalize(s) {
  return s.length ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s;
}

// dist/markdown/validate.js
function validateBacklogItem(item, allItems) {
  const issues = [];
  const warnings = [];
  const { localId } = parseQualifiedId(item.id);
  if (!isValidLocalId(localId)) {
    issues.push("id must match B-NNN(.N)* format (optionally prefixed with project/)");
  }
  if (!item.body.includes(`# ${localId}`) && !item.body.toLowerCase().includes(`# ${localId.toLowerCase()}`)) {
    issues.push("body should start with an H1 containing the item id");
  }
  const required = ["Created", "Type", "Priority", "Status"];
  for (const k of required) {
    if (!item.metadata[k])
      issues.push(`missing metadata field: ${k}`);
  }
  if (item.metadata.Type && !/(Epic|Story|Task)/i.test(item.metadata.Type)) {
    issues.push("Type should be Epic, Story, or Task");
  }
  if (!/##\s+Acceptance Criteria/i.test(item.body)) {
    issues.push("missing '## Acceptance Criteria' section");
  }
  if (allItems && item.depends_on && item.depends_on.length > 0) {
    const allIds = new Set(allItems.map((i) => i.id));
    const archivedIds = new Set(allItems.filter((i) => i.folder === "archive").map((i) => i.id));
    for (const depId of item.depends_on) {
      if (!allIds.has(depId)) {
        warnings.push(`depends_on target not found: ${depId}`);
      } else if (archivedIds.has(depId)) {
        warnings.push(`depends_on target is archived: ${depId}`);
      }
    }
  }
  return { ok: issues.length === 0, issues, warnings };
}

// dist/types.js
function isFolder(value) {
  return value === "next" || value === "working" || value === "done" || value === "archive";
}

// dist/backlog-api.js
function slugify(input) {
  return input.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/-+/g, "-").replace(/-/g, "_").slice(0, 80);
}
function createBacklogAPI(store) {
  const singleProject = store.isSingleProject();
  const defaultProject = store.getDefaultProject();
  function qualifyId(project, localId) {
    return singleProject ? localId : toQualifiedId(project, localId);
  }
  function resolveProject(project) {
    if (project)
      return project;
    if (defaultProject)
      return defaultProject;
    throw new Error(`Project is required in multi-project mode. Available: ${store.getProjects().join(", ")}`);
  }
  const api = {
    help: () => {
      const projects = store.getProjects();
      return {
        name: "backlog",
        description: singleProject ? "Repo backlog maintenance API (Kanban-lite)" : `Multi-project backlog API. Projects: ${projects.join(", ")}`,
        projects,
        singleProjectMode: singleProject,
        folders: ["next", "working", "done", "archive"],
        safety: {
          note: "User code runs in a restricted VM sandbox. Only the injected backlog API is available.",
          root_sandbox: "All filesystem operations are rooted under configured backlog roots; path traversal is rejected."
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
          xref: "backlog.xref({ id })"
        },
        best_practices: {
          ordered_refined: "Keep the backlog ordered and continuously refined (Scrum.org)",
          invest: "Prefer INVEST-ish items: Independent, Negotiable, Valuable, Estimable, Small, Testable (Agile Alliance)",
          prune: "Archive or close items the team will never do to avoid backlog rot (Atlassian)"
        },
        examples: [
          {
            title: "List next items",
            code: "return backlog.list({ folder: 'next', limit: 20 })"
          },
          ...singleProject ? [] : [
            {
              title: "List items for a specific project",
              code: "return backlog.list({ project: 'frontend', folder: 'next' })"
            },
            {
              title: "Global stats across all projects",
              code: "return backlog.globalStats()"
            },
            {
              title: "Find cross-references",
              code: "return backlog.xref({ id: 'frontend/B-001' })"
            }
          ]
        ]
      };
    },
    projects: () => {
      return store.getProjects();
    },
    list: async (opts) => {
      const folder = opts?.folder;
      if (folder && !isFolder(folder))
        throw new Error(`Invalid folder: ${String(folder)}`);
      const items = await store.list(opts?.project, folder);
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
          depends_on: parsed.depends_on.length ? parsed.depends_on : void 0,
          related: parsed.related.length ? parsed.related : void 0
        };
      });
      const offset = opts?.offset ?? 0;
      const limit = opts?.limit ?? mapped.length;
      return mapped.slice(offset, offset + limit);
    },
    get: async (req) => {
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
        depends_on: parsed.depends_on.length ? parsed.depends_on : void 0,
        related: parsed.related.length ? parsed.related : void 0
      };
    },
    search: async (req) => {
      const folder = req.folder;
      if (folder && !isFolder(folder))
        throw new Error(`Invalid folder: ${String(folder)}`);
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
          depends_on: parsed.depends_on.length ? parsed.depends_on : void 0,
          related: parsed.related.length ? parsed.related : void 0
        };
      });
      return mapped.slice(0, req.limit ?? mapped.length);
    },
    globalSearch: async (req) => {
      return api.search({ ...req, project: void 0 });
    },
    stats: async (opts) => {
      const baseCounts = await store.stats(opts?.project);
      const allItems = await store.list(opts?.project);
      const now = /* @__PURE__ */ new Date();
      const ageByFolder = {};
      const itemsByFolder = {
        next: [],
        working: [],
        done: [],
        archive: []
      };
      for (const item of allItems) {
        const parsed = parseBacklogMarkdown(item.body);
        const updatedDate = parsed.metadata.Updated;
        const createdDate = parsed.metadata.Created;
        const referenceDate = updatedDate || createdDate;
        if (referenceDate) {
          const itemDate = new Date(referenceDate);
          const ageDays = Math.max(0, Math.floor((now.getTime() - itemDate.getTime()) / (1e3 * 60 * 60 * 24)));
          itemsByFolder[item.folder].push({ age_days: ageDays });
        }
      }
      for (const folder of ["next", "working", "done", "archive"]) {
        const items = itemsByFolder[folder];
        if (items.length === 0) {
          ageByFolder[folder] = { oldest_days: 0, avg_days: 0, items_over_30d: 0 };
        } else {
          const ages = items.map((i) => i.age_days);
          const oldest = Math.max(...ages);
          const avg = Math.floor(ages.reduce((a, b) => a + b, 0) / ages.length);
          const over30 = ages.filter((a) => a > 30).length;
          ageByFolder[folder] = { oldest_days: oldest, avg_days: avg, items_over_30d: over30 };
        }
      }
      const result = {};
      for (const [projectName, counts] of Object.entries(baseCounts)) {
        result[projectName] = {
          ...counts,
          age: ageByFolder
        };
      }
      return result;
    },
    globalStats: async () => {
      return store.stats();
    },
    create: async (req) => {
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
        related: req.related
      });
      const created = await store.createFile(project, "next", filename, body);
      return {
        id: qualifyId(project, newId),
        path: created.path,
        project
      };
    },
    move: async (req) => {
      if (!isFolder(req.to))
        throw new Error(`Invalid folder: ${String(req.to)}`);
      const moved = await store.move(req.id, req.to);
      const item = await store.getById(req.id);
      const updated = stampUpdated(item.body);
      await store.writeBody(req.id, updated);
      return moved;
    },
    complete: async (req) => {
      const moved = await store.move(req.id, "done");
      const item = await store.getById(req.id);
      let updated = stampCompleted(item.body, req.completedDate);
      updated = stampUpdated(updated);
      await store.writeBody(req.id, updated);
      return { path: moved.path, project: moved.project };
    },
    archive: async (req) => {
      const moved = await store.move(req.id, "archive");
      const item = await store.getById(req.id);
      let updated = stampArchived(item.body);
      updated = stampUpdated(updated);
      await store.writeBody(req.id, updated);
      return { path: moved.path, project: moved.project };
    },
    validate: async (req) => {
      const item = await api.get({ id: req.id });
      const resolved = store.resolveId(req.id);
      const allItems = await api.list({ project: resolved.project });
      const allItemsFull = await Promise.all(allItems.map((summary) => api.get({ id: summary.id })));
      return validateBacklogItem(item, allItemsFull);
    },
    updateBody: async (req) => {
      const resolved = store.resolveId(req.id);
      const current = await store.getById(req.id);
      const historyEntry = await createHistorySnapshot({
        root: store.getRoot(resolved.project),
        id: resolved.localId,
        currentBody: current.body,
        message: req.message
      });
      const updated = stampUpdated(req.body);
      await store.writeBody(req.id, updated);
      return { id: qualifyId(resolved.project, resolved.localId), version: historyEntry.version, path: current.path };
    },
    getHistory: async (req) => {
      const resolved = store.resolveId(req.id);
      const entries = await listHistory({ root: store.getRoot(resolved.project), id: resolved.localId });
      return entries.slice(0, req.limit ?? entries.length);
    },
    xref: async (req) => {
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
          depends_on: parsed.depends_on.length ? parsed.depends_on : void 0,
          related: parsed.related.length ? parsed.related : void 0
        };
      });
    },
    hygiene: async (opts) => {
      const staleAfterDays = opts?.staleAfterDays ?? 30;
      const workingStaleAfterDays = 14;
      const doneAfterDays = opts?.doneAfterDays ?? 7;
      const now = /* @__PURE__ */ new Date();
      const allItems = await store.list(opts?.project);
      const stale_in_next = [];
      const stuck_in_working = [];
      const old_in_done = [];
      for (const item of allItems) {
        const parsed = parseBacklogMarkdown(item.body);
        const updatedDate = parsed.metadata.Updated;
        const createdDate = parsed.metadata.Created;
        const referenceDate = updatedDate || createdDate;
        if (!referenceDate)
          continue;
        const itemDate = new Date(referenceDate);
        const ageDays = Math.max(0, Math.floor((now.getTime() - itemDate.getTime()) / (1e3 * 60 * 60 * 24)));
        const itemInfo = {
          id: qualifyId(item.project, item.id),
          title: parsed.title,
          folder: item.folder,
          age_days: ageDays,
          project: item.project
        };
        if (item.folder === "next" && ageDays > staleAfterDays) {
          stale_in_next.push(itemInfo);
        } else if (item.folder === "working" && ageDays > workingStaleAfterDays) {
          stuck_in_working.push(itemInfo);
        } else if (item.folder === "done" && ageDays > doneAfterDays) {
          old_in_done.push(itemInfo);
        }
      }
      const total_items = allItems.length;
      const issue_count = stale_in_next.length + stuck_in_working.length + old_in_done.length;
      const health_score = issue_count === 0 ? "healthy" : issue_count < total_items * 0.1 ? "needs_attention" : "unhealthy";
      return {
        stale_in_next,
        stuck_in_working,
        old_in_done,
        total_items,
        health_score
      };
    }
  };
  return api;
}
async function allocateId(store, parent) {
  const all = await store.list();
  const ids = all.map((i) => i.id);
  if (parent) {
    if (!/^[A-Z]+-\d+(?:\.\d+)*$/.test(parent))
      throw new Error(`Invalid parent id: ${parent}`);
    const prefix = `${parent}.`;
    const children = ids.filter((id) => id.startsWith(prefix)).map((id) => Number(id.substring(prefix.length))).filter((n) => Number.isFinite(n) && n > 0);
    const next2 = (children.length ? Math.max(...children) : 0) + 1;
    return `${parent}.${next2}`;
  }
  const bases = ids.map((id) => id.match(/^[A-Z]+-(\d+)/)).map((m) => m ? Number(m[1]) : NaN).filter((n) => Number.isFinite(n));
  const next = (bases.length ? Math.max(...bases) : 0) + 1;
  return `B-${String(next).padStart(3, "0")}`;
}
function stampCompleted(body, completedDate) {
  const date = completedDate || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const lines = body.split(/\r?\n/);
  const out = [];
  let inserted = false;
  for (const line of lines) {
    if (/^\*\*Completed:\*\*/.test(line)) {
      out.push(`**Completed:** ${date}  `);
      inserted = true;
    } else {
      out.push(line);
    }
  }
  if (inserted)
    return out.join("\n");
  const createdIdx = out.findIndex((l) => /^\*\*Created:\*\*/.test(l));
  const insertAt = createdIdx >= 0 ? createdIdx + 1 : 2;
  out.splice(insertAt, 0, `**Completed:** ${date}  `);
  return out.join("\n");
}
function stampUpdated(body, updatedDate) {
  const date = updatedDate || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const lines = body.split(/\r?\n/);
  const out = [];
  let inserted = false;
  for (const line of lines) {
    if (/^\*\*Updated:\*\*/.test(line)) {
      out.push(`**Updated:** ${date}  `);
      inserted = true;
    } else {
      out.push(line);
    }
  }
  if (inserted)
    return out.join("\n");
  const createdIdx = out.findIndex((l) => /^\*\*Created:\*\*/.test(l));
  const insertAt = createdIdx >= 0 ? createdIdx + 1 : 2;
  out.splice(insertAt, 0, `**Updated:** ${date}  `);
  return out.join("\n");
}
function stampArchived(body, archivedDate) {
  const date = archivedDate || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const lines = body.split(/\r?\n/);
  const out = [];
  let inserted = false;
  for (const line of lines) {
    if (/^\*\*Archived:\*\*/.test(line)) {
      out.push(`**Archived:** ${date}  `);
      inserted = true;
    } else {
      out.push(line);
    }
  }
  if (inserted)
    return out.join("\n");
  const createdIdx = out.findIndex((l) => /^\*\*Created:\*\*/.test(l));
  const insertAt = createdIdx >= 0 ? createdIdx + 1 : 2;
  out.splice(insertAt, 0, `**Archived:** ${date}  `);
  return out.join("\n");
}

// dist/sandbox/index.js
import { runInNewContext } from "node:vm";
var BACKLOG_API_HELP = `
# Backlog API Reference

The backlog object provides access to all backlog operations.

## Read Operations

### Listing & Search
- backlog.help() - Show this help
- backlog.projects() - List discovered projects
- backlog.list({ project?, folder?, limit?, offset? }) - List items
  - folder: "next" | "working" | "done" | "archive"
- backlog.get({ id }) - Get full item details
- backlog.search({ text, project?, folder?, limit? }) - Search items
- backlog.globalSearch({ text, folder?, limit? }) - Search across all projects

### Statistics & Health
- backlog.stats({ project? }) - Get project statistics with age data
- backlog.globalStats() - Get stats across all projects
- backlog.hygiene({ project?, staleAfterDays?, doneAfterDays? }) - Check backlog health

### Cross-References & History
- backlog.xref({ id }) - Find items referencing this ID
- backlog.getHistory({ id, limit? }) - Get version history
- backlog.validate({ id }) - Validate item structure and references

## Write Operations

### Create & Manage
- backlog.create({ kind, title, project?, description?, tags?, priority?, parent?, depends_on?, related? })
  - kind: "task" | "epic"
  - priority: "low" | "medium" | "high"
- backlog.move({ id, to }) - Move item to folder
- backlog.complete({ id, completedDate? }) - Mark item done
- backlog.archive({ id }) - Archive item
- backlog.updateBody({ id, body, message? }) - Update item content

## Examples

// List high-priority items in next
const items = await backlog.list({ folder: 'next' });
return items.filter(i => i.priority === 'High');

// Check backlog health
const health = await backlog.hygiene({ staleAfterDays: 14 });
return { score: health.health_score, stale: health.stale_in_next.length };

// Find all items related to authentication
const results = await backlog.search({ text: 'auth' });
return results.map(r => ({ id: r.id, title: r.title, folder: r.folder }));

// Create a task with dependencies
const created = await backlog.create({
  kind: 'task',
  title: 'Add password reset',
  priority: 'high',
  tags: ['auth', 'security'],
  depends_on: ['B-001']
});
return created;

// Batch: find stale items and archive old done items
const hygiene = await backlog.hygiene({ doneAfterDays: 7 });
const archived = [];
for (const item of hygiene.old_in_done) {
  await backlog.archive({ id: item.id });
  archived.push(item.id);
}
return { archived, stale_count: hygiene.stale_in_next.length };
`;
function createSandboxAPI(api) {
  return {
    // All API methods forwarded directly
    help: () => BACKLOG_API_HELP,
    projects: () => api.projects(),
    list: (opts) => api.list(opts),
    get: (req) => api.get(req),
    search: (req) => api.search(req),
    globalSearch: (req) => api.globalSearch(req),
    stats: (opts) => api.stats(opts),
    globalStats: () => api.globalStats(),
    hygiene: (opts) => api.hygiene(opts),
    create: (req) => api.create(req),
    move: (req) => api.move(req),
    complete: (req) => api.complete(req),
    archive: (req) => api.archive(req),
    validate: (req) => api.validate(req),
    updateBody: (req) => api.updateBody(req),
    getHistory: (req) => api.getHistory(req),
    xref: (req) => api.xref(req)
  };
}
async function executeCode(api, request) {
  const startTime = Date.now();
  const timeout = request.timeout || 5e3;
  try {
    const backlogAPI = createSandboxAPI(api);
    const context = {
      backlog: backlogAPI,
      console: {
        log: () => {
        },
        warn: () => {
        },
        error: () => {
        }
      },
      JSON,
      Math,
      Date,
      Array,
      Object,
      String,
      Number,
      Boolean,
      Map,
      Set,
      Promise
      // No setTimeout, setInterval, fetch, require, etc.
    };
    const wrappedCode = `
      (async () => {
        ${request.code}
      })()
    `;
    const result = await runInNewContext(wrappedCode, context, {
      timeout,
      displayErrors: false
    });
    return {
      success: true,
      result,
      execution_time_ms: Date.now() - startTime
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    let cleanError = error;
    if (error.includes("Script execution timed out")) {
      cleanError = `Execution timed out after ${timeout}ms. Simplify your code or increase timeout.`;
    }
    return {
      success: false,
      error: cleanError,
      execution_time_ms: Date.now() - startTime
    };
  }
}

// dist/storage/fs-store.js
import * as fs2 from "node:fs/promises";
import * as path2 from "node:path";
var FOLDERS = ["next", "working", "done", "archive"];
function assertValidId2(id) {
  if (!/^[A-Z]+-\d+(?:\.\d+)*$/.test(id)) {
    throw new Error(`Invalid backlog id: ${id}`);
  }
}
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
var FileSystemBacklogStore = class {
  rootAbs;
  constructor(opts) {
    this.rootAbs = path2.resolve(opts.root);
  }
  getRoot() {
    return this.rootAbs;
  }
  resolveUnderRoot(...segments) {
    const candidate = path2.resolve(this.rootAbs, ...segments);
    const rootWithSep = this.rootAbs.endsWith(path2.sep) ? this.rootAbs : this.rootAbs + path2.sep;
    if (candidate !== this.rootAbs && !candidate.startsWith(rootWithSep)) {
      throw new Error("Path traversal detected");
    }
    return candidate;
  }
  async findPathById(id) {
    assertValidId2(id);
    const idRe = new RegExp(`^${escapeRegExp(id)}(?:_|$).*\\.md$`, "i");
    for (const folder of FOLDERS) {
      const dirAbs = this.resolveUnderRoot(folder);
      let entries;
      try {
        entries = await fs2.readdir(dirAbs, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const e of entries) {
        if (!e.isFile())
          continue;
        if (!idRe.test(e.name))
          continue;
        const absPath = this.resolveUnderRoot(folder, e.name);
        return { folder, absPath, relPath: path2.posix.join(folder, e.name) };
      }
    }
    throw new Error(`Backlog item not found: ${id}`);
  }
  async exists(id) {
    try {
      await this.findPathById(id);
      return true;
    } catch {
      return false;
    }
  }
  async list(folder) {
    const folders = folder ? [folder] : FOLDERS;
    const out = [];
    for (const f of folders) {
      const dirAbs = this.resolveUnderRoot(f);
      let entries;
      try {
        entries = await fs2.readdir(dirAbs, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const e of entries) {
        if (!e.isFile())
          continue;
        if (!e.name.toLowerCase().endsWith(".md"))
          continue;
        const idMatch = e.name.match(/^([A-Z]+-\d+(?:\.\d+)*)(?:_|$)/);
        if (!idMatch)
          continue;
        const id = idMatch[1];
        const absPath = this.resolveUnderRoot(f, e.name);
        const body = await fs2.readFile(absPath, "utf8");
        out.push({ id, folder: f, path: path2.posix.join(f, e.name), body });
      }
    }
    out.sort((a, b) => a.id === b.id ? a.path.localeCompare(b.path) : a.id.localeCompare(b.id));
    return out;
  }
  async getById(id) {
    const found = await this.findPathById(id);
    const body = await fs2.readFile(found.absPath, "utf8");
    return { id, folder: found.folder, path: found.relPath, body };
  }
  async search(text, folder) {
    const q = text.toLowerCase();
    const items = await this.list(folder);
    return items.filter((i) => i.body.toLowerCase().includes(q));
  }
  async stats() {
    const result = { next: 0, working: 0, done: 0, archive: 0 };
    for (const f of FOLDERS) {
      const items = await this.list(f);
      result[f] = items.length;
    }
    return result;
  }
  async createFile(folder, filename, body) {
    const abs = this.resolveUnderRoot(folder, filename);
    await fs2.mkdir(path2.dirname(abs), { recursive: true });
    const handle = await fs2.open(abs, "wx");
    try {
      await handle.writeFile(body, "utf8");
    } finally {
      await handle.close();
    }
    return { path: path2.posix.join(folder, filename) };
  }
  async move(id, to) {
    const found = await this.findPathById(id);
    const filename = path2.basename(found.absPath);
    const toAbs = this.resolveUnderRoot(to, filename);
    await fs2.mkdir(path2.dirname(toAbs), { recursive: true });
    await fs2.rename(found.absPath, toAbs);
    return { from: found.folder, to, path: path2.posix.join(to, filename) };
  }
  async writeBody(id, body) {
    const found = await this.findPathById(id);
    const abs = found.absPath;
    const tmp = abs + ".tmp";
    await fs2.writeFile(tmp, body, "utf8");
    await fs2.rename(tmp, abs);
    return { path: found.relPath };
  }
};

// dist/storage/multi-root-store.js
var MultiRootBacklogStore = class {
  stores;
  defaultProject;
  constructor(projects) {
    if (projects.length === 0)
      throw new Error("At least one project is required");
    this.stores = /* @__PURE__ */ new Map();
    for (const p of projects) {
      if (!isValidProjectName(p.name)) {
        throw new Error(`Invalid project name: ${p.name}`);
      }
      this.stores.set(p.name, new FileSystemBacklogStore({ root: p.root }));
    }
    if (projects.length === 1) {
      this.defaultProject = projects[0].name;
    }
  }
  getProjects() {
    return [...this.stores.keys()].sort();
  }
  isSingleProject() {
    return this.stores.size === 1;
  }
  getDefaultProject() {
    return this.defaultProject;
  }
  getStore(project) {
    const store = this.stores.get(project);
    if (!store)
      throw new Error(`Unknown project: ${project}. Available: ${this.getProjects().join(", ")}`);
    return store;
  }
  getRoot(project) {
    return this.getStore(project).getRoot();
  }
  /**
   * Resolve a potentially qualified ID to a project + local ID.
   * In single-project mode, bare IDs resolve to the default project.
   */
  resolveId(id) {
    const parsed = parseQualifiedId(id);
    const project = parsed.project ?? this.defaultProject;
    if (!project) {
      throw new Error(`Ambiguous id "${id}": multiple projects available. Use qualified id (e.g. project/B-001). Projects: ${this.getProjects().join(", ")}`);
    }
    if (!this.stores.has(project)) {
      throw new Error(`Unknown project: ${project}. Available: ${this.getProjects().join(", ")}`);
    }
    return { project, localId: parsed.localId };
  }
  async list(project, folder) {
    if (project) {
      const store = this.getStore(project);
      const items = await store.list(folder);
      return items.map((i) => ({ ...i, project }));
    }
    const all = [];
    for (const [name, store] of this.stores) {
      const items = await store.list(folder);
      all.push(...items.map((i) => ({ ...i, project: name })));
    }
    all.sort((a, b) => {
      const projCmp = a.project.localeCompare(b.project);
      return projCmp !== 0 ? projCmp : a.id.localeCompare(b.id);
    });
    return all;
  }
  async getById(id) {
    const { project, localId } = this.resolveId(id);
    const store = this.getStore(project);
    const item = await store.getById(localId);
    return { ...item, project };
  }
  async search(text, project, folder) {
    if (project) {
      const store = this.getStore(project);
      const items = await store.search(text, folder);
      return items.map((i) => ({ ...i, project }));
    }
    const all = [];
    for (const [name, store] of this.stores) {
      const items = await store.search(text, folder);
      all.push(...items.map((i) => ({ ...i, project: name })));
    }
    return all;
  }
  async stats(project) {
    if (project) {
      const store = this.getStore(project);
      return { [project]: await store.stats() };
    }
    const result = {};
    for (const [name, store] of this.stores) {
      result[name] = await store.stats();
    }
    return result;
  }
  async createFile(project, folder, filename, body) {
    const store = this.getStore(project);
    return store.createFile(folder, filename, body);
  }
  async move(id, to) {
    const { project, localId } = this.resolveId(id);
    const store = this.getStore(project);
    const result = await store.move(localId, to);
    return { ...result, project };
  }
  async writeBody(id, body) {
    const { project, localId } = this.resolveId(id);
    const store = this.getStore(project);
    const result = await store.writeBody(localId, body);
    return { ...result, project };
  }
  async exists(id) {
    const { project, localId } = this.resolveId(id);
    const store = this.getStore(project);
    return store.exists(localId);
  }
  /**
   * Find all items across all projects that reference the given qualified ID
   * in their Depends-On or Related metadata.
   */
  async findReferences(qualifiedId) {
    const all = await this.list();
    return all.filter((item) => {
      const lower = item.body.toLowerCase();
      const target = qualifiedId.toLowerCase();
      return lower.includes(target);
    });
  }
};

// dist/storage/project-discovery.js
import * as fs3 from "node:fs/promises";
import * as path3 from "node:path";
async function discoverProjects(scanDir, maxDepth = 2) {
  const absDir = path3.resolve(scanDir);
  const projects = [];
  async function scan(dir, depth, namePath) {
    if (depth > maxDepth)
      return;
    let entries;
    try {
      entries = await fs3.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory())
        continue;
      if (entry.name.startsWith("."))
        continue;
      const childDir = path3.join(dir, entry.name);
      const backlogDir = path3.join(childDir, ".backlog");
      try {
        const stat3 = await fs3.stat(backlogDir);
        if (stat3.isDirectory()) {
          const projectName = namePath.length > 0 ? [...namePath, entry.name].join("-") : entry.name;
          projects.push({ name: projectName, root: backlogDir });
          continue;
        }
      } catch {
      }
      await scan(childDir, depth + 1, [...namePath, entry.name]);
    }
  }
  await scan(absDir, 1, []);
  projects.sort((a, b) => a.name.localeCompare(b.name));
  return projects;
}

// dist/skill-cli.js
function parseArgs(argv) {
  const args = {};
  const positional = [];
  let command = "";
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const nextArg = argv[i + 1];
      if (nextArg && !nextArg.startsWith("--")) {
        args[key] = nextArg;
        i++;
      } else {
        args[key] = true;
      }
    } else if (!command) {
      command = arg;
    } else {
      positional.push(arg);
    }
  }
  return { command, args, positional };
}
function showHelp() {
  console.log(`
Backlog CLI - Kanban-lite backlog management

Usage: backlog <command> [options]

Commands:
  list [--project X] [--folder next|working|done|archive] [--limit N]
  get <id>
  search <text> [--project X] [--folder F] [--limit N]
  create --kind task|epic --title "..." [--project X] [--description "..."] [--priority low|medium|high] [--tags a,b] [--parent B-001] [--depends-on a/B-001,b/B-002] [--related ...]
  move <id> --to next|working|done|archive
  complete <id> [--date 2026-01-15]
  archive <id>
  validate <id>
  hygiene [--project X] [--stale-days 30] [--done-days 7]
  stats [--project X]
  xref <id>
  history <id> [--limit N]
  update-body <id> [--message "edit note"]
  exec --code "..." [--timeout 5000]

Options:
  --root <path>     Override scan directory (default: cwd)
  --help            Show this help

All output is JSON for easy parsing.
`);
}
async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}
async function main() {
  try {
    const { command, args, positional } = parseArgs(process.argv);
    if (args.help || command === "help" || !command) {
      showHelp();
      process.exit(0);
    }
    const scanDir = args.root || process.cwd();
    let projects = await discoverProjects(scanDir);
    if (projects.length === 0) {
      const backlogDir = path4.join(scanDir, ".backlog");
      try {
        const stat3 = await fs4.stat(backlogDir);
        if (stat3.isDirectory()) {
          const projectName = path4.basename(scanDir);
          projects = [{ name: projectName, root: backlogDir }];
        }
      } catch {
      }
    }
    if (projects.length === 0) {
      console.error(JSON.stringify({
        error: "No .backlog/ directories found",
        searched: scanDir,
        hint: "Create a .backlog/ directory or run from a workspace with project folders"
      }, null, 2));
      process.exit(1);
    }
    const store = new MultiRootBacklogStore(projects);
    const api = createBacklogAPI(store);
    let result;
    switch (command) {
      case "list": {
        const folder = args.folder;
        const project = args.project;
        const limit = args.limit ? parseInt(args.limit, 10) : void 0;
        result = await api.list({ project, folder, limit });
        break;
      }
      case "get": {
        const id = positional[0] || args.id;
        if (!id)
          throw new Error("Missing required argument: id");
        result = await api.get({ id });
        break;
      }
      case "search": {
        const text = positional[0] || args.text;
        if (!text)
          throw new Error("Missing required argument: text");
        const project = args.project;
        const folder = args.folder;
        const limit = args.limit ? parseInt(args.limit, 10) : void 0;
        result = await api.search({ text, project, folder, limit });
        break;
      }
      case "create": {
        const kind = args.kind;
        const title = args.title;
        if (!kind || !title)
          throw new Error("Missing required arguments: --kind and --title");
        const tags = args.tags ? args.tags.split(",") : void 0;
        const depends_on = args["depends-on"] ? args["depends-on"].split(",") : void 0;
        const related = args.related ? args.related.split(",") : void 0;
        result = await api.create({
          kind,
          title,
          project: args.project,
          description: args.description,
          tags,
          priority: args.priority,
          parent: args.parent,
          depends_on,
          related
        });
        break;
      }
      case "move": {
        const id = positional[0] || args.id;
        const to = args.to;
        if (!id || !to)
          throw new Error("Missing required arguments: id and --to");
        result = await api.move({ id, to });
        break;
      }
      case "complete": {
        const id = positional[0] || args.id;
        if (!id)
          throw new Error("Missing required argument: id");
        result = await api.complete({ id, completedDate: args.date });
        break;
      }
      case "archive": {
        const id = positional[0] || args.id;
        if (!id)
          throw new Error("Missing required argument: id");
        result = await api.archive({ id });
        break;
      }
      case "validate": {
        const id = positional[0] || args.id;
        if (!id)
          throw new Error("Missing required argument: id");
        result = await api.validate({ id });
        break;
      }
      case "hygiene": {
        const project = args.project;
        const staleAfterDays = args["stale-days"] ? parseInt(args["stale-days"], 10) : void 0;
        const doneAfterDays = args["done-days"] ? parseInt(args["done-days"], 10) : void 0;
        result = await api.hygiene({ project, staleAfterDays, doneAfterDays });
        break;
      }
      case "stats": {
        const project = args.project;
        result = await api.stats({ project });
        break;
      }
      case "xref": {
        const id = positional[0] || args.id;
        if (!id)
          throw new Error("Missing required argument: id");
        result = await api.xref({ id });
        break;
      }
      case "history": {
        const id = positional[0] || args.id;
        if (!id)
          throw new Error("Missing required argument: id");
        const limit = args.limit ? parseInt(args.limit, 10) : void 0;
        result = await api.getHistory({ id, limit });
        break;
      }
      case "update-body": {
        const id = positional[0] || args.id;
        if (!id)
          throw new Error("Missing required argument: id");
        const body = await readStdin();
        const message = args.message;
        result = await api.updateBody({ id, body, message });
        break;
      }
      case "exec": {
        const code = args.code;
        if (!code)
          throw new Error("Missing required argument: --code");
        const timeout = args.timeout ? parseInt(args.timeout, 10) : void 0;
        const execResult = await executeCode(api, { code, timeout });
        result = execResult;
        break;
      }
      default:
        throw new Error(`Unknown command: ${command}`);
    }
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (error) {
    const err = error;
    console.error(JSON.stringify({
      error: err.message,
      stack: err.stack
    }, null, 2));
    process.exit(1);
  }
}
main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
export {
  main
};
