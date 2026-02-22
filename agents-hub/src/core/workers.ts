import type { Database } from 'better-sqlite3';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
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

/** Discover the Copilot CLI session ID for a worker by scanning session-state directories */
export function discoverSession(workerId: string): { sessionId: string; eventsPath: string } | null {
  const sessionStateDir = join(homedir(), '.copilot', 'session-state');
  if (!existsSync(sessionStateDir)) return null;
  
  try {
    const entries = readdirSync(sessionStateDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const wsPath = join(sessionStateDir, entry.name, 'workspace.yaml');
      if (!existsSync(wsPath)) continue;
      try {
        const content = readFileSync(wsPath, 'utf-8');
        // Simple YAML parse for branch field
        const branchMatch = content.match(/^branch:\s*(.+)$/m);
        if (branchMatch) {
          const branch = branchMatch[1].trim();
          if (branch === `worker/${workerId}`) {
            const eventsPath = join(sessionStateDir, entry.name, 'events.jsonl');
            return { sessionId: entry.name, eventsPath };
          }
        }
      } catch { /* skip unreadable */ }
    }
  } catch { /* session-state dir not scannable */ }
  
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
