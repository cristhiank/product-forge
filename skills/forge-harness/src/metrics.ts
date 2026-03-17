import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import type {
  MetricEntry,
  MetricLogOpts,
  MetricQueryOpts,
  MetricSummary,
  ModeAggregate,
} from "./types.js";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  session_id TEXT,
  mode TEXT NOT NULL,
  metric TEXT NOT NULL,
  value TEXT NOT NULL,
  tier TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_metrics_run ON metrics(run_id);
CREATE INDEX IF NOT EXISTS idx_metrics_mode ON metrics(mode);
CREATE INDEX IF NOT EXISTS idx_metrics_metric ON metrics(metric);
CREATE INDEX IF NOT EXISTS idx_metrics_created ON metrics(created_at);
`;

export class MetricsStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(SCHEMA);
  }

  log(opts: MetricLogOpts): MetricEntry {
    const stmt = this.db.prepare(`
      INSERT INTO metrics (run_id, session_id, mode, metric, value, tier)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
      opts.runId,
      opts.sessionId ?? null,
      opts.mode ?? "unknown",
      opts.metric,
      opts.value,
      opts.tier ?? null,
    );
    return this.db
      .prepare("SELECT * FROM metrics WHERE id = ?")
      .get(info.lastInsertRowid) as MetricEntry;
  }

  query(opts?: MetricQueryOpts): MetricEntry[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (opts?.runId) {
      conditions.push("run_id = ?");
      params.push(opts.runId);
    }
    if (opts?.mode) {
      conditions.push("mode = ?");
      params.push(opts.mode);
    }
    if (opts?.metric) {
      conditions.push("metric = ?");
      params.push(opts.metric);
    }
    if (opts?.since) {
      const date = this.parseSince(opts.since);
      conditions.push("created_at >= ?");
      params.push(date);
    }

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = opts?.limit ? `LIMIT ${opts.limit}` : "";

    return this.db
      .prepare(`SELECT * FROM metrics ${where} ORDER BY created_at DESC ${limit}`)
      .all(...params) as MetricEntry[];
  }

  summary(opts?: { runId?: string }): MetricSummary {
    const entries = opts?.runId
      ? this.query({ runId: opts.runId })
      : this.query();

    const runIds = new Set(entries.map((e) => e.run_id));
    const verifyEntries = entries.filter((e) => e.metric === "verify_result");
    const passCount = verifyEntries.filter((e) => e.value === "pass").length;
    const retryEntries = entries.filter((e) => e.metric === "retry_count");
    const avgRetries =
      retryEntries.length > 0
        ? retryEntries.reduce((sum, e) => sum + Number(e.value), 0) /
          retryEntries.length
        : 0;
    const driftEntries = entries.filter(
      (e) => e.metric === "scope_drift" && e.value === "true",
    );
    const correctionEntries = entries.filter(
      (e) => e.metric === "correction_count",
    );

    const byMetric: Record<string, number> = {};
    for (const e of entries) {
      byMetric[e.metric] = (byMetric[e.metric] ?? 0) + 1;
    }

    return {
      totalRuns: runIds.size,
      totalEntries: entries.length,
      passRate:
        verifyEntries.length > 0 ? passCount / verifyEntries.length : 0,
      avgRetries,
      scopeDriftRate:
        runIds.size > 0 ? driftEntries.length / runIds.size : 0,
      correctionRate:
        runIds.size > 0 ? correctionEntries.length / runIds.size : 0,
      byMetric,
    };
  }

  aggregateByMode(): Record<string, ModeAggregate> {
    const entries = this.query();
    const byMode: Record<string, MetricEntry[]> = {};

    for (const e of entries) {
      if (!byMode[e.mode]) byMode[e.mode] = [];
      byMode[e.mode].push(e);
    }

    const result: Record<string, ModeAggregate> = {};
    for (const [mode, modeEntries] of Object.entries(byMode)) {
      const runIds = new Set(modeEntries.map((e) => e.run_id));
      const verifies = modeEntries.filter(
        (e) => e.metric === "verify_result",
      );
      const passes = verifies.filter((e) => e.value === "pass").length;
      const retries = modeEntries.filter((e) => e.metric === "retry_count");
      const corrections = modeEntries.filter(
        (e) => e.metric === "correction_count",
      );

      result[mode] = {
        runs: runIds.size,
        passRate: verifies.length > 0 ? passes / verifies.length : 0,
        avgRetries:
          retries.length > 0
            ? retries.reduce((s, e) => s + Number(e.value), 0) /
              retries.length
            : 0,
        avgCorrections:
          corrections.length > 0
            ? corrections.reduce((s, e) => s + Number(e.value), 0) /
              corrections.length
            : 0,
      };
    }

    return result;
  }

  close(): void {
    this.db.close();
  }

  private parseSince(since: string): string {
    const match = since.match(/^(\d+)([dhm])$/);
    if (!match) return since;

    const [, numStr, unit] = match;
    const num = parseInt(numStr, 10);
    const now = new Date();

    switch (unit) {
      case "d":
        now.setDate(now.getDate() - num);
        break;
      case "h":
        now.setHours(now.getHours() - num);
        break;
      case "m":
        now.setMinutes(now.getMinutes() - num);
        break;
    }

    return now.toISOString().replace("T", " ").substring(0, 19);
  }
}
