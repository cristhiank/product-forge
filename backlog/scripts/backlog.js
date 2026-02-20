#!/usr/bin/env node

// dist/skill-cli.js
import * as fs5 from "node:fs/promises";
import * as path5 from "node:path";

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
function stripParentheticals(value) {
  return value.replace(/\s*\([^)]*\)/g, "");
}
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
    const isDepOrRelated = key.toLowerCase() === "depends-on" || key.toLowerCase() === "depends on" || key.toLowerCase() === "related";
    const cleanValue = isDepOrRelated ? stripParentheticals(value) : value;
    const parsedList = cleanValue.replace(/^\[/, "").replace(/\]$/, "").split(",").map((t) => t.trim()).filter(Boolean);
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
var STATUS_MAP = {
  next: "Not Started",
  working: "In Progress",
  done: "Done",
  archive: "Archived"
};
function folderToStatus(folder) {
  return STATUS_MAP[folder];
}
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
      let updated = stampStatus(item.body, folderToStatus(req.to));
      updated = stampUpdated(updated);
      await store.writeBody(req.id, updated);
      return moved;
    },
    complete: async (req) => {
      const moved = await store.move(req.id, "done");
      const item = await store.getById(req.id);
      let updated = stampCompleted(item.body, req.completedDate);
      updated = stampStatus(updated, folderToStatus("done"));
      updated = stampUpdated(updated);
      await store.writeBody(req.id, updated);
      return { path: moved.path, project: moved.project };
    },
    archive: async (req) => {
      const moved = await store.move(req.id, "archive");
      const item = await store.getById(req.id);
      let updated = stampArchived(item.body);
      updated = stampStatus(updated, folderToStatus("archive"));
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
      const status_folder_mismatches = [];
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
        const expectedStatus = folderToStatus(item.folder);
        const actualStatus = parsed.metadata.Status;
        if (actualStatus && actualStatus !== expectedStatus) {
          status_folder_mismatches.push({
            ...itemInfo,
            status: actualStatus,
            expected_status: expectedStatus
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
      const health_score = issue_count === 0 ? "healthy" : issue_count < total_items * 0.1 ? "needs_attention" : "unhealthy";
      return {
        stale_in_next,
        stuck_in_working,
        old_in_done,
        status_folder_mismatches,
        total_items,
        health_score,
        ...opts?.fix ? { fixed: status_folder_mismatches.length } : {}
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
function stampStatus(body, status) {
  const lines = body.split(/\r?\n/);
  const out = [];
  let inserted = false;
  for (const line of lines) {
    if (/^\*\*Status:\*\*/.test(line)) {
      out.push(`**Status:** ${status}  `);
      inserted = true;
    } else {
      out.push(line);
    }
  }
  if (inserted)
    return out.join("\n");
  const createdIdx = out.findIndex((l) => /^\*\*Created:\*\*/.test(l));
  const insertAt = createdIdx >= 0 ? createdIdx + 1 : 2;
  out.splice(insertAt, 0, `**Status:** ${status}  `);
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

// dist/serve/server.js
import * as http from "node:http";
import * as fs4 from "node:fs";
import * as path4 from "node:path";

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

// dist/serve/styles.js
var CSS = (
  /* css */
  `
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
`
);

// dist/serve/renderer.js
function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function priorityBadge(priority) {
  if (!priority)
    return "";
  const cls = priority.toLowerCase();
  return `<span class="badge badge-${esc(cls)}">${esc(priority)}</span>`;
}
function folderBadge(folder) {
  return `<span class="folder-badge folder-${esc(folder)}">${esc(folder)}</span>`;
}
function tagPills(tags) {
  if (!tags?.length)
    return "";
  return tags.map((t) => `<span class="tag">${esc(t)}</span>`).join(" ");
}
function depIndicator(deps) {
  if (!deps?.length)
    return "";
  return `<span class="dep-count">\u{1F517} ${deps.length}</span>`;
}
function mdToHtml(md) {
  const lines = md.split(/\r?\n/);
  let bodyStart = 0;
  let foundHr = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      if (foundHr) {
        bodyStart = i + 1;
        break;
      }
      foundHr = true;
    }
  }
  const body = lines.slice(bodyStart).join("\n");
  let html = esc(body);
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) => `<pre><code>${code.trim()}</code></pre>`);
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/^- \[x\] (.+)$/gm, '<li style="list-style:none;">\u2611 $1</li>');
  html = html.replace(/^- \[ \] (.+)$/gm, '<li style="list-style:none;">\u2610 $1</li>');
  html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
  html = html.replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g, "<ul>$1</ul>");
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  html = html.replace(/\n{2,}/g, "</p><p>");
  html = `<p>${html}</p>`;
  html = html.replace(/<p>\s*<\/p>/g, "");
  return html;
}
function layout(opts) {
  const projectNav = opts.projects.map((p) => {
    const isActive = p === opts.currentProject;
    const count = opts.projectCounts?.[p] ?? "";
    return `<li><a href="/project/${esc(p)}" class="${isActive ? "active" : ""}">
        \u{1F4C1} ${esc(p)}
        ${count ? `<span class="count">${count}</span>` : ""}
      </a></li>`;
  }).join("\n");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(opts.title)} \u2014 Backlog</title>
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
          <li><a href="/" class="${opts.activePage === "board" && !opts.currentProject ? "active" : ""}">\u{1F4CB} Board</a></li>
          <li><a href="/stats" class="${opts.activePage === "stats" ? "active" : ""}">\u{1F4CA} Stats &amp; Hygiene</a></li>
          <li><a href="/search" class="${opts.activePage === "search" ? "active" : ""}">\u{1F50D} Search</a></li>
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
          <input class="search-input" type="text" name="q" placeholder="Search items\u2026">
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
function renderCard(item) {
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
function kanbanBoard(items, projectName) {
  const folders = ["next", "working", "done", "archive"];
  const byFolder = {
    next: [],
    working: [],
    done: [],
    archive: []
  };
  for (const item of items)
    byFolder[item.folder].push(item);
  const columns = folders.map((f) => {
    const colItems = byFolder[f];
    const cardsHtml = colItems.length ? colItems.map(renderCard).join("\n") : `<div class="kanban-empty">No items</div>`;
    return `<div class="kanban-column">
        <div class="kanban-column-header">
          <span class="dot ${f}"></span>
          ${f.charAt(0).toUpperCase() + f.slice(1)}
          <span class="kanban-column-count">${colItems.length}</span>
        </div>
        <div class="kanban-items">${cardsHtml}</div>
      </div>`;
  }).join("\n");
  return `
    <div class="page-header">
      <div>
        <div class="page-title">${projectName ? esc(projectName) : "All Projects"}</div>
        <div class="page-subtitle">${items.length} items</div>
      </div>
    </div>
    <div class="kanban">${columns}</div>`;
}
function itemDetail(item) {
  const metaEntries = Object.entries(item.metadata).filter(([k]) => !["Tags", "Depends-On", "Depends On", "Related"].includes(k)).map(([k, v]) => `<div class="detail-meta-item">
      <div class="detail-meta-label">${esc(k)}</div>
      <div class="detail-meta-value">${esc(v)}</div>
    </div>`).join("\n");
  const depsHtml = item.depends_on?.length ? `<div class="detail-deps">
        <div class="detail-deps-title">\u{1F517} Depends On</div>
        <ul class="detail-deps-list">
          ${item.depends_on.map((d) => `<li><a href="/item/${esc(encodeURIComponent(d))}">${esc(d)}</a></li>`).join("")}
        </ul>
      </div>` : "";
  const relatedHtml = item.related?.length ? `<div class="detail-deps">
        <div class="detail-deps-title">\u2194 Related</div>
        <ul class="detail-deps-list">
          ${item.related.map((r) => `<li><a href="/item/${esc(encodeURIComponent(r))}">${esc(r)}</a></li>`).join("")}
        </ul>
      </div>` : "";
  const projectLink = item.project ? `<a href="/project/${esc(item.project)}">${esc(item.project)}</a>` : `<a href="/">Board</a>`;
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
function statsPage(stats, hygiene) {
  let totalNext = 0, totalWorking = 0, totalDone = 0, totalArchive = 0;
  for (const counts of Object.values(stats)) {
    totalNext += counts.next ?? 0;
    totalWorking += counts.working ?? 0;
    totalDone += counts.done ?? 0;
    totalArchive += counts.archive ?? 0;
  }
  const total = totalNext + totalWorking + totalDone + totalArchive;
  const healthCls = `health-${hygiene.health_score.replace(/\s/g, "_")}`;
  const healthLabel = hygiene.health_score.replace(/_/g, " ");
  function alertGroup(title, icon, items) {
    if (!items.length)
      return "";
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
  const projectRows = Object.entries(stats).map(([name, counts]) => {
    const pTotal = (counts.next ?? 0) + (counts.working ?? 0) + (counts.done ?? 0) + (counts.archive ?? 0);
    return `<tr>
        <td><a href="/project/${esc(name)}">${esc(name)}</a></td>
        <td>${counts.next ?? 0}</td>
        <td>${counts.working ?? 0}</td>
        <td>${counts.done ?? 0}</td>
        <td>${counts.archive ?? 0}</td>
        <td><strong>${pTotal}</strong></td>
      </tr>`;
  }).join("");
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
      ${alertGroup("Stale in Next", "\u{1F550}", hygiene.stale_in_next)}
      ${alertGroup("Stuck in Working", "\u26A0\uFE0F", hygiene.stuck_in_working)}
      ${alertGroup("Old in Done", "\u{1F4E6}", hygiene.old_in_done)}
      ${!hygiene.stale_in_next.length && !hygiene.stuck_in_working.length && !hygiene.old_in_done.length ? `<div class="empty-state"><div class="empty-state-icon">\u2705</div><div class="empty-state-text">No hygiene issues. Backlog is healthy!</div></div>` : ""}
    </div>`;
}
function searchPage(results, query) {
  const resultsHtml = results.length ? `<ul class="search-results">
        ${results.map((r) => `<li class="search-result">
          <div>
            <div style="display:flex;align-items:center;gap:8px;">
              <a href="/item/${esc(encodeURIComponent(r.id))}" class="search-result-title">${esc(r.title)}</a>
              ${folderBadge(r.folder)}
              ${priorityBadge(r.priority)}
            </div>
            <div class="search-result-meta">
              <span class="search-result-id">${esc(r.id)}</span>
              ${r.project ? `\xB7 ${esc(r.project)}` : ""}
              ${tagPills(r.tags)}
            </div>
          </div>
        </li>`).join("")}
      </ul>` : query ? `<div class="empty-state"><div class="empty-state-icon">\u{1F50D}</div><div class="empty-state-text">No results for "${esc(query)}"</div></div>` : `<div class="empty-state"><div class="empty-state-icon">\u{1F50D}</div><div class="empty-state-text">Enter a search term above</div></div>`;
  return `
    <div class="page-header">
      <div>
        <div class="page-title">Search</div>
        ${query ? `<div class="page-subtitle">${results.length} result(s) for "${esc(query)}"</div>` : ""}
      </div>
    </div>
    <form action="/search" method="get" class="search-form" style="margin-bottom:20px;max-width:100%;">
      <input class="search-input" type="text" name="q" placeholder="Search items\u2026" value="${esc(query)}" autofocus>
      <button class="search-btn" type="submit">Search</button>
    </form>
    ${resultsHtml}`;
}
function notFoundPage() {
  return `<div class="empty-state">
    <div class="empty-state-icon">\u{1F937}</div>
    <div class="empty-state-text">Page not found</div>
    <p style="margin-top:8px;"><a href="/">\u2190 Back to board</a></p>
  </div>`;
}

// dist/serve/server.js
var sseClients = /* @__PURE__ */ new Set();
function broadcastReload() {
  for (const res of sseClients) {
    try {
      res.write("event: reload\ndata: {}\n\n");
    } catch {
      sseClients.delete(res);
    }
  }
}
function watchBacklogDirs(projects) {
  let debounce = null;
  const onChange = () => {
    if (debounce)
      clearTimeout(debounce);
    debounce = setTimeout(() => broadcastReload(), 300);
  };
  for (const p of projects) {
    try {
      fs4.watch(p.root, { recursive: true }, onChange);
    } catch {
    }
  }
}
function sendHtml(res, html, status = 200) {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}
function sendCss(res) {
  res.writeHead(200, {
    "Content-Type": "text/css; charset=utf-8",
    "Cache-Control": "public, max-age=60"
  });
  res.end(CSS);
}
function parseUrl(url) {
  const idx = url.indexOf("?");
  const pathname = idx >= 0 ? url.slice(0, idx) : url;
  const query = new URLSearchParams(idx >= 0 ? url.slice(idx + 1) : "");
  return { pathname, query };
}
async function startServer(opts) {
  let projects = await discoverProjects(opts.scanDir);
  if (projects.length === 0) {
    const backlogDir = path4.join(opts.scanDir, ".backlog");
    try {
      const stat3 = fs4.statSync(backlogDir);
      if (stat3.isDirectory()) {
        projects = [{ name: path4.basename(opts.scanDir), root: backlogDir }];
      }
    } catch {
    }
  }
  if (projects.length === 0) {
    console.error("No .backlog/ directories found under:", opts.scanDir);
    process.exit(1);
  }
  const store = new MultiRootBacklogStore(projects);
  const api = createBacklogAPI(store);
  const projectNames = api.projects();
  async function getProjectCounts() {
    const allStats = await api.globalStats();
    const counts = {};
    for (const [name, folders] of Object.entries(allStats)) {
      counts[name] = Object.values(folders).reduce((a, b) => a + b, 0);
    }
    return counts;
  }
  watchBacklogDirs(projects);
  const server = http.createServer(async (req, res) => {
    try {
      const { pathname, query } = parseUrl(req.url || "/");
      if (pathname === "/styles.css")
        return sendCss(res);
      if (pathname === "/events") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive"
        });
        res.write(":\n\n");
        sseClients.add(res);
        req.on("close", () => sseClients.delete(res));
        return;
      }
      const projectCounts = await getProjectCounts();
      if (pathname === "/") {
        const items = await api.list({ project: void 0 });
        const html = layout({
          title: "Board",
          projects: projectNames,
          activePage: "board",
          projectCounts,
          body: kanbanBoard(items)
        });
        return sendHtml(res, html);
      }
      const projectMatch = pathname.match(/^\/project\/(.+)$/);
      if (projectMatch) {
        const projectName = decodeURIComponent(projectMatch[1]);
        if (!projectNames.includes(projectName)) {
          return sendHtml(res, layout({ title: "Not Found", projects: projectNames, activePage: "board", projectCounts, body: notFoundPage() }), 404);
        }
        const items = await api.list({ project: projectName });
        const html = layout({
          title: projectName,
          projects: projectNames,
          currentProject: projectName,
          activePage: "board",
          projectCounts,
          body: kanbanBoard(items, projectName)
        });
        return sendHtml(res, html);
      }
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
            body: itemDetail(item)
          });
          return sendHtml(res, html);
        } catch {
          return sendHtml(res, layout({ title: "Not Found", projects: projectNames, activePage: "detail", projectCounts, body: notFoundPage() }), 404);
        }
      }
      if (pathname === "/stats") {
        const [statsData, hygieneData] = await Promise.all([
          api.globalStats(),
          api.hygiene()
        ]);
        const html = layout({
          title: "Stats & Hygiene",
          projects: projectNames,
          activePage: "stats",
          projectCounts,
          body: statsPage(statsData, hygieneData)
        });
        return sendHtml(res, html);
      }
      if (pathname === "/search") {
        const q = query.get("q") || "";
        const results = q ? await api.globalSearch({ text: q }) : [];
        const html = layout({
          title: q ? `Search: ${q}` : "Search",
          projects: projectNames,
          activePage: "search",
          projectCounts,
          body: searchPage(results, q)
        });
        return sendHtml(res, html);
      }
      sendHtml(res, layout({ title: "Not Found", projects: projectNames, activePage: "board", projectCounts, body: notFoundPage() }), 404);
    } catch (err) {
      console.error("Request error:", err);
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Server Error");
    }
  });
  server.listen(opts.port, () => {
    console.log(`
\u{1F680} Backlog dashboard running at http://localhost:${opts.port}`);
    console.log(`   Watching ${projects.length} project(s): ${projects.map((p) => p.name).join(", ")}`);
    console.log(`   Root: ${opts.scanDir}
`);
  });
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
  hygiene [--project X] [--stale-days 30] [--done-days 7] [--fix]
  stats [--project X]
  xref <id>
  history <id> [--limit N]
  update-body <id> [--message "edit note"]
  exec --code "..." [--timeout 5000]
  serve [--port 3000]               Start HTML dashboard

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
      const backlogDir = path5.join(scanDir, ".backlog");
      try {
        const stat3 = await fs5.stat(backlogDir);
        if (stat3.isDirectory()) {
          const projectName = path5.basename(scanDir);
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
        const fix = args.fix === true;
        result = await api.hygiene({ project, staleAfterDays, doneAfterDays, fix });
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
      case "serve": {
        const port = args.port ? parseInt(args.port, 10) : 3e3;
        await startServer({ port, scanDir });
        return;
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
