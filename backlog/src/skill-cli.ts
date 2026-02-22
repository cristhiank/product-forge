#!/usr/bin/env node
/**
 * Backlog Skill CLI - Command-line interface for backlog management
 *
 * Dual-mode CLI for backlog operations:
 * 1. Command mode: Direct operations via flags
 * 2. Exec mode: JavaScript composition via sandbox
 *
 * Auto-discovers .backlog/ directories from current working directory.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { parseArgs as nodeParseArgs } from "node:util";
import { createBacklogAPI } from "./backlog-api.js";
import { executeCode } from "./sandbox/index.js";
import { startServer } from "./serve/server.js";
import { MultiRootBacklogStore } from "./storage/multi-root-store.js";
import { discoverProjects } from "./storage/project-discovery.js";
import type { Folder } from "./types.js";

interface CLIOptions {
  command: string;
  args: Record<string, string | boolean | undefined>;
  positional: string[];
}

function parseArgs(argv: string[]): CLIOptions {
  const { values, positionals } = nodeParseArgs({
    args: argv.slice(2),
    allowPositionals: true,
    strict: false,
    options: {
      help: { type: "boolean" },
      root: { type: "string" },
      format: { type: "string" },
      project: { type: "string" },
      folder: { type: "string" },
      limit: { type: "string" },
      unblocked: { type: "boolean" },
      id: { type: "string" },
      text: { type: "string" },
      kind: { type: "string" },
      title: { type: "string" },
      description: { type: "string" },
      priority: { type: "string" },
      tags: { type: "string" },
      parent: { type: "string" },
      "depends-on": { type: "string" },
      related: { type: "string" },
      to: { type: "string" },
      date: { type: "string" },
      "stale-days": { type: "string" },
      "done-days": { type: "string" },
      fix: { type: "boolean" },
      code: { type: "string" },
      timeout: { type: "string" },
      port: { type: "string" },
      message: { type: "string" },
    },
  });

  const command = positionals[0] ?? "";
  const positional = positionals.slice(1);

  return { command, args: values, positional };
}

function showHelp() {
  console.log(`
Backlog CLI - Kanban-lite backlog management

Usage: backlog <command> [options]

Commands:
  brief [--project X]                 One-call briefing: health, WIP, next items, stats
  list [--project X] [--folder next|working|done|archive] [--limit N] [--unblocked]
  get <id>
  search <text> [--project X] [--folder F] [--limit N]
  create --kind task|epic --title "..." [--project X] [--description "..."] [--priority low|medium|high] [--tags a,b] [--parent B-001] [--depends-on a/B-001,b/B-002] [--related ...]
  pick <id>                           Move to working + return full item
  move <id>[,id2,...] --to next|working|done|archive
  complete <id>[,id2,...] [--date 2026-01-15]
  archive <id>[,id2,...]
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
  --format <type>   Output format: json (default) | board-context | summary
  --help            Show this help

All output is JSON for easy parsing (unless --format summary).
`);
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function formatSummary(result: unknown, command: string): string {
  if (command === "brief" && result && typeof result === "object") {
    const b = result as any;
    const lines: string[] = [];
    lines.push(`Health: ${b.health} (${b.issues} issues)`);
    lines.push("");
    if (b.wip.length) {
      lines.push(`WIP (${b.wip.length}):`);
      for (const i of b.wip) lines.push(`  ${i.id} [${i.priority || "-"}] ${i.title}`);
    } else {
      lines.push("WIP: none");
    }
    lines.push("");
    if (b.next_unblocked.length) {
      lines.push(`Ready to pick (${b.next_unblocked.length}):`);
      for (const i of b.next_unblocked) lines.push(`  ${i.id} [${i.priority || "-"}] ${i.title}`);
    }
    if (b.next_blocked.length) {
      lines.push(`Blocked (${b.next_blocked.length}):`);
      for (const i of b.next_blocked) lines.push(`  ${i.id} [${i.priority || "-"}] ${i.title} (blocked by: ${(i.blocked_by || []).join(", ")})`);
    }
    return lines.join("\n");
  }

  if (Array.isArray(result)) {
    if (result.length === 0) return "(empty)";
    return result.map((item: any) =>
      `${item.id || "-"} [${item.priority || item.folder || "-"}] ${item.title || JSON.stringify(item)}`
    ).join("\n");
  }

  if (result && typeof result === "object" && "id" in (result as any)) {
    const item = result as any;
    const lines = [`${item.id}: ${item.title}`, `Folder: ${item.folder} | Priority: ${item.priority || "-"} | Status: ${item.status || "-"}`];
    if (item.tags?.length) lines.push(`Tags: ${item.tags.join(", ")}`);
    if (item.depends_on?.length) lines.push(`Depends on: ${item.depends_on.join(", ")}`);
    return lines.join("\n");
  }

  return JSON.stringify(result, null, 2);
}

function formatBoardContext(result: unknown): string {
  // For list command: output as compact fact-ready format
  // id | title | folder | priority | tags
  if (Array.isArray(result)) {
    const items = result.map((item: any) => ({
      id: item.id,
      title: item.title,
      folder: item.folder,
      priority: item.priority || 'none',
      status: item.status || item.folder,
      tags: item.tags || [],
      depends_on: item.depends_on || []
    }));
    return JSON.stringify({ type: 'backlog_context', items, count: items.length }, null, 2);
  }
  // For single item: output as board-ready snippet
  if (result && typeof result === 'object' && 'id' in result) {
    const item = result as any;
    return JSON.stringify({
      type: 'backlog_item',
      id: item.id,
      title: item.title,
      folder: item.folder,
      priority: item.priority,
      status: item.status,
      body: item.body,
      metadata: item.metadata,
      tags: item.tags || [],
      depends_on: item.depends_on || []
    }, null, 2);
  }
  // Fallback: regular JSON
  return JSON.stringify(result, null, 2);
}

export async function main() {
  try {
    const { command, args, positional } = parseArgs(process.argv);

    if (args.help || command === "help" || !command) {
      showHelp();
      process.exit(0);
    }

    // Discover projects
    const scanDir = (args.root as string) || process.cwd();
    let projects = await discoverProjects(scanDir);

    // If no projects found, check if scanDir itself has a .backlog/ folder
    if (projects.length === 0) {
      const backlogDir = path.join(scanDir, ".backlog");
      try {
        const stat = await fs.stat(backlogDir);
        if (stat.isDirectory()) {
          const projectName = path.basename(scanDir);
          projects = [{ name: projectName, root: backlogDir }];
        }
      } catch {
        // No .backlog found
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

    // Create store
    const store = new MultiRootBacklogStore(projects);
    const api = createBacklogAPI(store);

    // Execute command
    let result: unknown;

    switch (command) {
      case "brief": {
        const project = args.project as string | undefined;
        result = await api.brief({ project });
        break;
      }

      case "list": {
        const folder = args.folder as Folder | undefined;
        const project = args.project as string | undefined;
        const limit = args.limit ? parseInt(args.limit as string, 10) : undefined;
        const unblocked = args.unblocked === true;
        result = await api.list({ project, folder, limit, unblocked });
        break;
      }

      case "get": {
        const id = positional[0] || (args.id as string);
        if (!id) throw new Error("Missing required argument: id");
        result = await api.get({ id });
        break;
      }

      case "search": {
        const text = positional[0] || (args.text as string);
        if (!text) throw new Error("Missing required argument: text");
        const project = args.project as string | undefined;
        const folder = args.folder as Folder | undefined;
        const limit = args.limit ? parseInt(args.limit as string, 10) : undefined;
        result = await api.search({ text, project, folder, limit });
        break;
      }

      case "create": {
        const kind = args.kind as "task" | "epic";
        const title = args.title as string;
        if (!kind || !title) throw new Error("Missing required arguments: --kind and --title");

        const tags = args.tags ? (args.tags as string).split(",") : undefined;
        const depends_on = args["depends-on"] ? (args["depends-on"] as string).split(",") : undefined;
        const related = args.related ? (args.related as string).split(",") : undefined;

        result = await api.create({
          kind,
          title,
          project: args.project as string | undefined,
          description: args.description as string | undefined,
          tags,
          priority: args.priority as "low" | "medium" | "high" | undefined,
          parent: args.parent as string | undefined,
          depends_on,
          related,
        });
        break;
      }

      case "pick": {
        const id = positional[0] || (args.id as string);
        if (!id) throw new Error("Missing required argument: id");
        result = await api.pick({ id });
        break;
      }

      case "move": {
        const rawId = positional[0] || (args.id as string);
        const to = args.to as Folder;
        if (!rawId || !to) throw new Error("Missing required arguments: id and --to");
        const ids = rawId.split(",").map(s => s.trim()).filter(Boolean);
        if (ids.length === 1) {
          result = await api.move({ id: ids[0], to });
        } else {
          const results = [];
          for (const id of ids) results.push(await api.move({ id, to }));
          result = results;
        }
        break;
      }

      case "complete": {
        const rawId = positional[0] || (args.id as string);
        if (!rawId) throw new Error("Missing required argument: id");
        const ids = rawId.split(",").map(s => s.trim()).filter(Boolean);
        if (ids.length === 1) {
          result = await api.complete({ id: ids[0], completedDate: args.date as string | undefined });
        } else {
          const results = [];
          for (const id of ids) results.push(await api.complete({ id, completedDate: args.date as string | undefined }));
          result = results;
        }
        break;
      }

      case "archive": {
        const rawId = positional[0] || (args.id as string);
        if (!rawId) throw new Error("Missing required argument: id");
        const ids = rawId.split(",").map(s => s.trim()).filter(Boolean);
        if (ids.length === 1) {
          result = await api.archive({ id: ids[0] });
        } else {
          const results = [];
          for (const id of ids) results.push(await api.archive({ id }));
          result = results;
        }
        break;
      }

      case "validate": {
        const id = positional[0] || (args.id as string);
        if (!id) throw new Error("Missing required argument: id");
        result = await api.validate({ id });
        break;
      }

      case "hygiene": {
        const project = args.project as string | undefined;
        const staleAfterDays = args["stale-days"] ? parseInt(args["stale-days"] as string, 10) : undefined;
        const doneAfterDays = args["done-days"] ? parseInt(args["done-days"] as string, 10) : undefined;
        const fix = args.fix === true;
        result = await api.hygiene({ project, staleAfterDays, doneAfterDays, fix });
        break;
      }

      case "stats": {
        const project = args.project as string | undefined;
        result = await api.stats({ project });
        break;
      }

      case "xref": {
        const id = positional[0] || (args.id as string);
        if (!id) throw new Error("Missing required argument: id");
        result = await api.xref({ id });
        break;
      }

      case "history": {
        const id = positional[0] || (args.id as string);
        if (!id) throw new Error("Missing required argument: id");
        const limit = args.limit ? parseInt(args.limit as string, 10) : undefined;
        result = await api.getHistory({ id, limit });
        break;
      }

      case "update-body": {
        const id = positional[0] || (args.id as string);
        if (!id) throw new Error("Missing required argument: id");
        const body = await readStdin();
        const message = args.message as string | undefined;
        result = await api.updateBody({ id, body, message });
        break;
      }

      case "exec": {
        const code = args.code as string;
        if (!code) throw new Error("Missing required argument: --code");
        const timeout = args.timeout ? parseInt(args.timeout as string, 10) : undefined;
        const execResult = await executeCode(api, { code, timeout });
        result = execResult;
        break;
      }

      case "serve": {
        const port = args.port ? parseInt(args.port as string, 10) : 3000;
        await startServer({ port, scanDir });
        return; // server keeps running
      }

      default:
        throw new Error(`Unknown command: ${command}`);
    }

    // Output result based on format
    const format = (args.format as string) || 'json';
    if (format === 'summary') {
      console.log(formatSummary(result, command));
    } else if (format === 'board-context') {
      console.log(formatBoardContext(result));
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
    process.exit(0);
  } catch (error) {
    const err = error as Error;
    console.error(JSON.stringify({
      error: err.message,
      stack: err.stack,
    }, null, 2));
    process.exit(1);
  }
}

// Run main - entry point detection
main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});


