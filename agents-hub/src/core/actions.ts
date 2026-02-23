import type { Database } from 'better-sqlite3';
import { generateId } from '../utils/ids.js';
import { now } from '../utils/time.js';
import type { OperatorAction } from './types.js';

export interface RecordOperatorActionOptions {
  id?: string;
  workerId: string;
  actionType: OperatorAction['actionType'];
  status: OperatorAction['status'];
  requestedAt?: string;
  completedAt?: string;
  error?: string | null;
  metadata?: Record<string, unknown>;
}

interface ListOperatorActionsOptions {
  workerId?: string;
  actionType?: OperatorAction['actionType'];
  status?: OperatorAction['status'];
  limit?: number;
}

function rowToOperatorAction(row: Record<string, unknown>): OperatorAction {
  let metadata: Record<string, unknown> = {};
  try {
    metadata = JSON.parse(String(row.metadata ?? '{}')) as Record<string, unknown>;
  } catch {
    metadata = {};
  }
  return {
    id: String(row.id),
    workerId: String(row.worker_id),
    actionType: String(row.action_type) as OperatorAction['actionType'],
    status: String(row.status) as OperatorAction['status'],
    requestedAt: String(row.requested_at),
    completedAt: String(row.completed_at),
    error: row.error === null ? null : String(row.error),
    metadata,
  };
}

export function recordOperatorAction(db: Database, opts: RecordOperatorActionOptions): OperatorAction {
  const id = opts.id ?? generateId();
  const requestedAt = opts.requestedAt ?? now();
  const completedAt = opts.completedAt ?? requestedAt;
  db.prepare(`
    INSERT INTO operator_actions (
      id, worker_id, action_type, status, requested_at, completed_at, error, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    opts.workerId,
    opts.actionType,
    opts.status,
    requestedAt,
    completedAt,
    opts.error ?? null,
    JSON.stringify(opts.metadata ?? {}),
  );
  const row = db.prepare('SELECT * FROM operator_actions WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) {
    throw new Error(`Failed to read operator action after insert: ${id}`);
  }
  return rowToOperatorAction(row);
}

export function listOperatorActions(db: Database, opts: ListOperatorActionsOptions = {}): OperatorAction[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.workerId) {
    where.push('worker_id = ?');
    params.push(opts.workerId);
  }
  if (opts.actionType) {
    where.push('action_type = ?');
    params.push(opts.actionType);
  }
  if (opts.status) {
    where.push('status = ?');
    params.push(opts.status);
  }
  const limit = Math.max(1, Math.min(opts.limit ?? 100, 1000));
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db
    .prepare(`SELECT * FROM operator_actions ${whereClause} ORDER BY completed_at DESC LIMIT ?`)
    .all(...params, limit) as Record<string, unknown>[];
  return rows.map(rowToOperatorAction);
}

export function summarizeOperatorActions(db: Database, opts: { workerId?: string } = {}): {
  total: number;
  succeeded: number;
  failed: number;
  byType: Array<{ actionType: OperatorAction['actionType']; total: number; succeeded: number; failed: number }>;
} {
  const whereClause = opts.workerId ? 'WHERE worker_id = ?' : '';
  const rows = db.prepare(`
    SELECT
      action_type AS actionType,
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END) AS succeeded,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
    FROM operator_actions
    ${whereClause}
    GROUP BY action_type
    ORDER BY total DESC, action_type ASC
  `).all(...(opts.workerId ? [opts.workerId] : [])) as Array<{
    actionType: OperatorAction['actionType'];
    total: number;
    succeeded: number;
    failed: number;
  }>;

  const totals = rows.reduce(
    (acc, row) => {
      acc.total += row.total;
      acc.succeeded += row.succeeded;
      acc.failed += row.failed;
      return acc;
    },
    { total: 0, succeeded: 0, failed: 0 },
  );

  return {
    total: totals.total,
    succeeded: totals.succeeded,
    failed: totals.failed,
    byType: rows.map((row) => ({
      actionType: row.actionType,
      total: row.total,
      succeeded: row.succeeded,
      failed: row.failed,
    })),
  };
}
