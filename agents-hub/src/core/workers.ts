import type { Database } from 'better-sqlite3';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { now } from '../utils/time.js';
import type { Worker, WorkerStatus, RegisterWorkerOptions } from './types.js';

/** Convert a DB row to a Worker object */
function rowToWorker(row: Record<string, unknown>): Worker {
  return {
    id: row.id as string,
    sessionId: (row.session_id as string) ?? null,
    channel: row.channel as string,
    agentType: (row.agent_type as string) ?? null,
    agentName: (row.agent_name as string) ?? null,
    worktreePath: (row.worktree_path as string) ?? null,
    eventsPath: (row.events_path as string) ?? null,
    pid: (row.pid as number) ?? null,
    status: row.status as WorkerStatus,
    exitCode: (row.exit_code as number) ?? null,
    lastEventAt: (row.last_event_at as string) ?? null,
    lastEventType: (row.last_event_type as string) ?? null,
    eventsOffset: (row.events_offset as number) ?? 0,
    toolCalls: (row.tool_calls as number) ?? 0,
    turns: (row.turns as number) ?? 0,
    errors: (row.errors as number) ?? 0,
    registeredAt: row.registered_at as string,
    completedAt: (row.completed_at as string) ?? null,
    metadata: JSON.parse((row.metadata as string) || '{}'),
  };
}

function normalizeBranchValue(value: string): string {
  let branch = value.trim();
  if (
    (branch.startsWith('"') && branch.endsWith('"')) ||
    (branch.startsWith("'") && branch.endsWith("'"))
  ) {
    branch = branch.slice(1, -1).trim();
  }
  branch = branch.replace(/^refs\/heads\//i, '').replace(/^origin\//i, '');
  return branch;
}

function normalizeWorkerToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function branchMatchesWorker(branchValue: string, workerId: string): boolean {
  const workerToken = normalizeWorkerToken(workerId);
  if (!workerToken) return false;

  const normalizedBranch = normalizeBranchValue(branchValue).toLowerCase();
  const workerPattern = normalizedBranch.match(/^worker[-_/](.+)$/i);
  if (!workerPattern) return false;

  return normalizeWorkerToken(workerPattern[1]) === workerToken;
}

function parseBranchFromWorkspaceYaml(content: string): string | null {
  const match = content.match(/^\s*branch\s*:\s*(.+)\s*$/m);
  return match ? normalizeBranchValue(match[1]) : null;
}

function parseBranchFromSessionStart(eventsPath: string): string | null {
  try {
    const content = readFileSync(eventsPath, 'utf-8');
    for (const line of content.split('\n')) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line) as { type?: string; data?: Record<string, unknown> };
        if (event.type !== 'session.start' || !event.data) continue;

        const context = event.data.context as Record<string, unknown> | undefined;
        if (typeof context?.branch === 'string') return normalizeBranchValue(context.branch);
        if (typeof event.data.branch === 'string') return normalizeBranchValue(event.data.branch);
      } catch {
        // Skip malformed lines and keep scanning.
      }
    }
  } catch {
    // Skip unreadable events files.
  }
  return null;
}

/** Discover the Copilot CLI session ID for a worker by scanning session-state directories */
export function discoverSession(
  workerId: string,
  sessionStateDir = join(homedir(), '.copilot', 'session-state'),
): { sessionId: string; eventsPath: string } | null {
  if (!existsSync(sessionStateDir)) return null;
  
  try {
    const entries = readdirSync(sessionStateDir, { withFileTypes: true });
    const workspaceCandidates: Array<{ sessionId: string; eventsPath: string; mtimeMs: number }> = [];
    const fallbackEntries: Array<{ sessionId: string; eventsPath: string; mtimeMs: number }> = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const wsPath = join(sessionStateDir, entry.name, 'workspace.yaml');
      const eventsPath = join(sessionStateDir, entry.name, 'events.jsonl');

      if (existsSync(eventsPath)) {
        try {
          fallbackEntries.push({
            sessionId: entry.name,
            eventsPath,
            mtimeMs: statSync(eventsPath).mtimeMs,
          });
        } catch {
          // Skip files we cannot stat.
        }
      }

      if (!existsSync(wsPath)) continue;
      try {
        const branch = parseBranchFromWorkspaceYaml(readFileSync(wsPath, 'utf-8'));
        if (branch && branchMatchesWorker(branch, workerId)) {
          workspaceCandidates.push({
            sessionId: entry.name,
            eventsPath,
            mtimeMs: statSync(wsPath).mtimeMs,
          });
        }
      } catch {
        // Skip unreadable/unstattable workspace files.
      }
    }

    if (workspaceCandidates.length > 0) {
      workspaceCandidates.sort((a, b) => b.mtimeMs - a.mtimeMs || b.sessionId.localeCompare(a.sessionId));
      return {
        sessionId: workspaceCandidates[0].sessionId,
        eventsPath: workspaceCandidates[0].eventsPath,
      };
    }

    fallbackEntries.sort((a, b) => b.mtimeMs - a.mtimeMs || b.sessionId.localeCompare(a.sessionId));
    for (const entry of fallbackEntries) {
      const branch = parseBranchFromSessionStart(entry.eventsPath);
      if (branch && branchMatchesWorker(branch, workerId)) {
        return { sessionId: entry.sessionId, eventsPath: entry.eventsPath };
      }
    }
  } catch {
    // session-state dir not scannable
  }
  
  return null;
}

/** Register a new worker */
export function registerWorker(db: Database, opts: RegisterWorkerOptions): Worker {
  const channel = opts.channel ?? `#worker-${opts.id}`;
  const registeredAt = now();
  
  // Try to discover session
  const session = discoverSession(opts.id);
  
  const stmt = db.prepare(`
    INSERT INTO workers (id, session_id, channel, agent_type, agent_name, worktree_path, events_path, pid, status, registered_at, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
  `);
  
  stmt.run(
    opts.id,
    session?.sessionId ?? null,
    channel,
    opts.agentType ?? null,
    opts.agentName ?? null,
    opts.worktreePath ?? null,
    session?.eventsPath ?? null,
    opts.pid ?? null,
    registeredAt,
    JSON.stringify(opts.metadata ?? {}),
  );
  
  return getWorker(db, opts.id)!;
}

/** Get a worker by ID */
export function getWorker(db: Database, id: string): Worker | null {
  const row = db.prepare('SELECT * FROM workers WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? rowToWorker(row) : null;
}

/** List workers with optional filters */
export function listWorkers(db: Database, opts?: { status?: WorkerStatus }): Worker[] {
  let sql = 'SELECT * FROM workers';
  const params: unknown[] = [];
  
  if (opts?.status) {
    sql += ' WHERE status = ?';
    params.push(opts.status);
  }
  
  sql += ' ORDER BY registered_at DESC';
  
  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
  return rows.map(rowToWorker);
}

/** Update worker fields */
export function updateWorker(db: Database, id: string, updates: Partial<{
  sessionId: string;
  eventsPath: string;
  status: WorkerStatus;
  exitCode: number;
  lastEventAt: string;
  lastEventType: string;
  eventsOffset: number;
  toolCalls: number;
  turns: number;
  errors: number;
  completedAt: string;
  metadata: Record<string, unknown>;
}>): Worker | null {
  const sets: string[] = [];
  const params: unknown[] = [];
  
  // Map camelCase to snake_case
  const fieldMap: Record<string, string> = {
    sessionId: 'session_id',
    eventsPath: 'events_path',
    status: 'status',
    exitCode: 'exit_code',
    lastEventAt: 'last_event_at',
    lastEventType: 'last_event_type',
    eventsOffset: 'events_offset',
    toolCalls: 'tool_calls',
    turns: 'turns',
    errors: 'errors',
    completedAt: 'completed_at',
    metadata: 'metadata',
  };
  
  for (const [key, value] of Object.entries(updates)) {
    const col = fieldMap[key];
    if (!col) continue;
    sets.push(`${col} = ?`);
    params.push(key === 'metadata' ? JSON.stringify(value) : value);
  }
  
  if (sets.length === 0) return getWorker(db, id);
  
  params.push(id);
  db.prepare(`UPDATE workers SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  
  return getWorker(db, id);
}

/** Remove a worker by ID */
export function removeWorker(db: Database, id: string): boolean {
  const result = db.prepare('DELETE FROM workers WHERE id = ?').run(id);
  return result.changes > 0;
}
