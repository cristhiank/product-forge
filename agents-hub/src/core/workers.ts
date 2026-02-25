import type { Database } from 'better-sqlite3';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { now } from '../utils/time.js';
import type {
  Worker,
  WorkerStatus,
  RegisterWorkerOptions,
  TokenUsageTotals,
  ModelUsageSummary,
  ProviderUsageSummary,
} from './types.js';

const EMPTY_USAGE_TOTALS: TokenUsageTotals = {
  inputTokens: 0,
  outputTokens: 0,
  cachedInputTokens: 0,
  cachedOutputTokens: 0,
  compactionInputTokens: 0,
  compactionOutputTokens: 0,
  compactionCachedInputTokens: 0,
  compactionReclaimedTokens: 0,
  totalTokens: 0,
};

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function parseUsageTotals(raw: unknown): TokenUsageTotals {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_USAGE_TOTALS };
  const usage = raw as Record<string, unknown>;
  return {
    inputTokens: asNumber(usage.inputTokens),
    outputTokens: asNumber(usage.outputTokens),
    cachedInputTokens: asNumber(usage.cachedInputTokens),
    cachedOutputTokens: asNumber(usage.cachedOutputTokens),
    compactionInputTokens: asNumber(usage.compactionInputTokens),
    compactionOutputTokens: asNumber(usage.compactionOutputTokens),
    compactionCachedInputTokens: asNumber(usage.compactionCachedInputTokens),
    compactionReclaimedTokens: asNumber(usage.compactionReclaimedTokens),
    totalTokens: asNumber(usage.totalTokens),
  };
}

function parseModelUsage(raw: unknown): Record<string, ModelUsageSummary> {
  if (!raw || typeof raw !== 'object') return {};
  const source = raw as Record<string, unknown>;
  const parsed: Record<string, ModelUsageSummary> = {};
  for (const [key, value] of Object.entries(source)) {
    if (!value || typeof value !== 'object') continue;
    const item = value as Record<string, unknown>;
    parsed[key] = {
      model: typeof item.model === 'string' ? item.model : key,
      provider: typeof item.provider === 'string' ? item.provider : 'unknown',
      inputTokens: asNumber(item.inputTokens),
      outputTokens: asNumber(item.outputTokens),
      cachedInputTokens: asNumber(item.cachedInputTokens),
      cachedOutputTokens: asNumber(item.cachedOutputTokens),
      totalTokens: asNumber(item.totalTokens),
      costUsd: asNumber(item.costUsd),
      requests: asNumber(item.requests),
      lastUsedAt: typeof item.lastUsedAt === 'string' ? item.lastUsedAt : null,
    };
  }
  return parsed;
}

function parseProviderUsage(raw: unknown): Record<string, ProviderUsageSummary> {
  if (!raw || typeof raw !== 'object') return {};
  const source = raw as Record<string, unknown>;
  const parsed: Record<string, ProviderUsageSummary> = {};
  for (const [key, value] of Object.entries(source)) {
    if (!value || typeof value !== 'object') continue;
    const item = value as Record<string, unknown>;
    parsed[key] = {
      provider: typeof item.provider === 'string' ? item.provider : key,
      inputTokens: asNumber(item.inputTokens),
      outputTokens: asNumber(item.outputTokens),
      cachedInputTokens: asNumber(item.cachedInputTokens),
      cachedOutputTokens: asNumber(item.cachedOutputTokens),
      totalTokens: asNumber(item.totalTokens),
      costUsd: asNumber(item.costUsd),
      requests: asNumber(item.requests),
      lastUsedAt: typeof item.lastUsedAt === 'string' ? item.lastUsedAt : null,
    };
  }
  return parsed;
}

function parseOpsTelemetryMetadata(metadata: Record<string, unknown>): {
  activeModel: string | null;
  activeProvider: string | null;
  modelSwitches: number;
  estimatedCostUsd: number;
  usage: TokenUsageTotals;
  modelUsage: Record<string, ModelUsageSummary>;
  providerUsage: Record<string, ProviderUsageSummary>;
} {
  const raw = metadata.opsTelemetry;
  if (!raw || typeof raw !== 'object') {
    return {
      activeModel: null,
      activeProvider: null,
      modelSwitches: 0,
      estimatedCostUsd: 0,
      usage: { ...EMPTY_USAGE_TOTALS },
      modelUsage: {},
      providerUsage: {},
    };
  }
  const item = raw as Record<string, unknown>;
  return {
    activeModel: typeof item.activeModel === 'string' ? item.activeModel : null,
    activeProvider: typeof item.activeProvider === 'string' ? item.activeProvider : null,
    modelSwitches: asNumber(item.modelSwitches),
    estimatedCostUsd: asNumber(item.estimatedCostUsd),
    usage: parseUsageTotals(item.usageTotals),
    modelUsage: parseModelUsage(item.models),
    providerUsage: parseProviderUsage(item.providers),
  };
}

/** Convert a DB row to a Worker object */
function rowToWorker(row: Record<string, unknown>): Worker {
  let metadata: Record<string, unknown> = {};
  try {
    metadata = JSON.parse((row.metadata as string) || '{}') as Record<string, unknown>;
  } catch {
    metadata = {};
  }
  const ops = parseOpsTelemetryMetadata(metadata);

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
    activeModel: ops.activeModel,
    activeProvider: ops.activeProvider,
    modelSwitches: ops.modelSwitches,
    estimatedCostUsd: ops.estimatedCostUsd,
    usage: ops.usage,
    modelUsage: ops.modelUsage,
    providerUsage: ops.providerUsage,
    registeredAt: row.registered_at as string,
    completedAt: (row.completed_at as string) ?? null,
    metadata,
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

/** Deregister a worker by marking it as completed (preserves telemetry history) */
export function deregisterWorker(db: Database, id: string): boolean {
  const completedAt = now();
  const result = db.prepare(
    `UPDATE workers SET status = 'completed', completed_at = ? WHERE id = ? AND status = 'active'`
  ).run(completedAt, id);
  return result.changes > 0;
}

/** Check if a PID is alive */
function isPidAlive(pid: number): boolean {
  if (!Number.isFinite(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Prune stale workers: mark active workers with dead PIDs as completed */
export function pruneWorkers(db: Database): { pruned: string[] } {
  const completedAt = now();
  const rows = db.prepare(
    `SELECT id, pid FROM workers WHERE status = 'active' AND pid IS NOT NULL`
  ).all() as Array<{ id: string; pid: number }>;

  const pruned: string[] = [];
  const stmt = db.prepare(
    `UPDATE workers SET status = 'completed', completed_at = ? WHERE id = ?`
  );

  for (const row of rows) {
    if (!isPidAlive(row.pid)) {
      stmt.run(completedAt, row.id);
      pruned.push(row.id);
    }
  }

  return { pruned };
}
