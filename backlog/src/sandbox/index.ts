/**
 * Backlog Skill - Sandboxed Code Execution
 *
 * Provides a safe execution environment for backlog operations.
 * Uses Node.js vm module with restricted context.
 */

import { runInNewContext, type Context } from "node:vm";

// ============================================================
// TYPES
// ============================================================

/** The backlog API object type (return type of createBacklogAPI) */
type BacklogAPI = {
  [key: string]: (...args: any[]) => any;
};

export interface ExecuteRequest {
  code: string;
  timeout?: number; // Default 5000ms
}

export interface ExecuteResponse {
  success: boolean;
  result?: unknown;
  error?: string;
  execution_time_ms: number;
}

// ============================================================
// BACKLOG API HELP
// ============================================================

export const BACKLOG_API_HELP = `
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

// ============================================================
// SANDBOX IMPLEMENTATION
// ============================================================

/**
 * Create a sandboxed backlog API for code execution
 */
export function createSandboxAPI(api: BacklogAPI) {
  return {
    // All API methods forwarded directly
    help: () => BACKLOG_API_HELP,
    projects: () => api.projects(),
    list: (opts?: any) => api.list(opts),
    get: (req: any) => api.get(req),
    search: (req: any) => api.search(req),
    globalSearch: (req: any) => api.globalSearch(req),
    stats: (opts?: any) => api.stats(opts),
    globalStats: () => api.globalStats(),
    hygiene: (opts?: any) => api.hygiene(opts),
    create: (req: any) => api.create(req),
    move: (req: any) => api.move(req),
    complete: (req: any) => api.complete(req),
    archive: (req: any) => api.archive(req),
    validate: (req: any) => api.validate(req),
    updateBody: (req: any) => api.updateBody(req),
    getHistory: (req: any) => api.getHistory(req),
    xref: (req: any) => api.xref(req),
  };
}

/**
 * Execute code in a sandboxed environment with backlog API access
 */
export async function executeCode(
  api: BacklogAPI,
  request: ExecuteRequest
): Promise<ExecuteResponse> {
  const startTime = Date.now();
  const timeout = request.timeout || 5000;

  try {
    const backlogAPI = createSandboxAPI(api);

    // Create sandbox context with limited globals
    const context: Context = {
      backlog: backlogAPI,
      console: {
        log: () => {},
        warn: () => {},
        error: () => {},
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
      Promise,
      // No setTimeout, setInterval, fetch, require, etc.
    };

    // Wrap code to capture return value — supports both sync and async
    const wrappedCode = `
      (async () => {
        ${request.code}
      })()
    `;

    // Execute in sandbox with timeout
    const result = await runInNewContext(wrappedCode, context, {
      timeout,
      displayErrors: false,
    });

    return {
      success: true,
      result,
      execution_time_ms: Date.now() - startTime,
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
      execution_time_ms: Date.now() - startTime,
    };
  }
}
