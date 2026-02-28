/**
 * Agent Collaboration Board - Temporal Index
 *
 * Provides time-based query capabilities:
 * - Range queries (entities between timestamps)
 * - Recency queries (last N entities)
 * - Timeline queries (activity over time periods)
 * - Phase-based queries (entities by workflow phase)
 */

import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { EntityId, EntityType, TaskPhase, Timestamp } from "../types/core.js";

// ============================================================
// TYPES
// ============================================================

export interface TemporalQuery {
  after?: Timestamp;
  before?: Timestamp;
  types?: EntityType[];
  phases?: TaskPhase[];
  limit?: number;
  offset?: number;
  orderBy?: "asc" | "desc";
}

export interface TemporalEntry {
  id: EntityId;
  type: EntityType;
  timestamp: Timestamp;
  phase: TaskPhase;
  agent?: string;
  action?: string;
}

export interface TimelineEntry {
  timestamp: Timestamp;
  count: number;
  types: Record<EntityType, number>;
}

export interface PhaseTimeline {
  phase: TaskPhase;
  startedAt: Timestamp;
  endedAt?: Timestamp;
  duration?: number; // milliseconds
  entityCount: number;
}

export interface TemporalStats {
  totalEvents: number;
  oldestEvent: Timestamp | null;
  newestEvent: Timestamp | null;
  eventsByType: Record<EntityType, number>;
  eventsByPhase: Record<TaskPhase, number>;
  avgEventsPerHour: number;
}

// ============================================================
// TEMPORAL INDEX CLASS
// ============================================================

export class TemporalIndex {
  private db: Database.Database;

  constructor(boardPath: string) {
    const indexPath = join(boardPath, ".index");
    mkdirSync(indexPath, { recursive: true });

    const dbPath = join(indexPath, "temporal.db");
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = NORMAL");

    this.initSchema();
  }

  // ============================================================
  // SCHEMA
  // ============================================================

  private initSchema(): void {
    this.db.exec(`
      -- Main temporal events table
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        phase TEXT NOT NULL,
        agent TEXT,
        action TEXT,
        UNIQUE(entity_id, timestamp, action)
      );

      CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
      CREATE INDEX IF NOT EXISTS idx_events_type ON events(entity_type);
      CREATE INDEX IF NOT EXISTS idx_events_phase ON events(phase);
      CREATE INDEX IF NOT EXISTS idx_events_entity ON events(entity_id);
      CREATE INDEX IF NOT EXISTS idx_events_type_timestamp ON events(entity_type, timestamp);
      CREATE INDEX IF NOT EXISTS idx_events_phase_timestamp ON events(phase, timestamp);

      -- Phase transitions table
      CREATE TABLE IF NOT EXISTS phase_transitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_phase TEXT,
        to_phase TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        triggered_by TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_transitions_timestamp ON phase_transitions(timestamp);
    `);
  }

  // ============================================================
  // INDEXING
  // ============================================================

  /**
   * Record an entity event
   */
  recordEvent(
    entityId: EntityId,
    entityType: EntityType,
    timestamp: Timestamp,
    phase: TaskPhase,
    agent?: string,
    action?: string
  ): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO events (entity_id, entity_type, timestamp, phase, agent, action)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(entityId, entityType, timestamp, phase, agent || null, action || null);
  }

  /**
   * Record a phase transition
   */
  recordPhaseTransition(
    fromPhase: TaskPhase | null,
    toPhase: TaskPhase,
    timestamp: Timestamp,
    triggeredBy?: string
  ): void {
    this.db.prepare(`
      INSERT INTO phase_transitions (from_phase, to_phase, timestamp, triggered_by)
      VALUES (?, ?, ?, ?)
    `).run(fromPhase, toPhase, timestamp, triggeredBy || null);
  }

  /**
   * Remove events for an entity
   */
  removeEntity(entityId: EntityId): void {
    this.db.prepare("DELETE FROM events WHERE entity_id = ?").run(entityId);
  }

  /**
   * Clear all temporal data
   */
  clear(): void {
    this.db.exec("DELETE FROM events; DELETE FROM phase_transitions;");
  }

  // ============================================================
  // QUERIES
  // ============================================================

  /**
   * Query events with temporal filters
   */
  query(q: TemporalQuery): TemporalEntry[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (q.after) {
      conditions.push("timestamp > ?");
      params.push(q.after);
    }

    if (q.before) {
      conditions.push("timestamp < ?");
      params.push(q.before);
    }

    if (q.types && q.types.length > 0) {
      const placeholders = q.types.map(() => "?").join(",");
      conditions.push(`entity_type IN (${placeholders})`);
      params.push(...q.types);
    }

    if (q.phases && q.phases.length > 0) {
      const placeholders = q.phases.map(() => "?").join(",");
      conditions.push(`phase IN (${placeholders})`);
      params.push(...q.phases);
    }

    let sql = `
      SELECT entity_id, entity_type, timestamp, phase, agent, action
      FROM events
    `;

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += ` ORDER BY timestamp ${q.orderBy === "asc" ? "ASC" : "DESC"}`;

    if (q.limit) {
      sql += ` LIMIT ${q.limit}`;
    }

    if (q.offset) {
      sql += ` OFFSET ${q.offset}`;
    }

    const rows = this.db.prepare(sql).all(...params) as Array<{
      entity_id: string;
      entity_type: string;
      timestamp: string;
      phase: string;
      agent: string | null;
      action: string | null;
    }>;

    return rows.map((r) => ({
      id: r.entity_id as EntityId,
      type: r.entity_type as EntityType,
      timestamp: r.timestamp as Timestamp,
      phase: r.phase as TaskPhase,
      agent: r.agent || undefined,
      action: r.action || undefined,
    }));
  }

  /**
   * Get most recent entities
   */
  getRecent(limit: number = 10, types?: EntityType[]): TemporalEntry[] {
    return this.query({ limit, types, orderBy: "desc" });
  }

  /**
   * Get entities in a time range
   */
  getInRange(after: Timestamp, before: Timestamp, types?: EntityType[]): TemporalEntry[] {
    return this.query({ after, before, types, orderBy: "asc" });
  }

  /**
   * Get entities from a specific phase
   */
  getByPhase(phase: TaskPhase, types?: EntityType[]): TemporalEntry[] {
    return this.query({ phases: [phase], types, orderBy: "desc" });
  }

  /**
   * Get unique entity IDs from temporal events
   */
  getEntityIds(q: TemporalQuery): EntityId[] {
    const entries = this.query(q);
    const seen = new Set<string>();
    const ids: EntityId[] = [];

    for (const entry of entries) {
      if (!seen.has(entry.id)) {
        seen.add(entry.id);
        ids.push(entry.id);
      }
    }

    return ids;
  }

  // ============================================================
  // TIMELINE
  // ============================================================

  /**
   * Get activity timeline grouped by hour
   */
  getHourlyTimeline(after?: Timestamp, before?: Timestamp): TimelineEntry[] {
    let sql = `
      SELECT
        strftime('%Y-%m-%dT%H:00:00Z', timestamp) as hour,
        COUNT(*) as count,
        entity_type
      FROM events
    `;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (after) {
      conditions.push("timestamp > ?");
      params.push(after);
    }

    if (before) {
      conditions.push("timestamp < ?");
      params.push(before);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " GROUP BY hour, entity_type ORDER BY hour ASC";

    const rows = this.db.prepare(sql).all(...params) as Array<{
      hour: string;
      count: number;
      entity_type: string;
    }>;

    // Group by hour
    const timeline = new Map<string, TimelineEntry>();

    for (const row of rows) {
      if (!timeline.has(row.hour)) {
        timeline.set(row.hour, {
          timestamp: row.hour as Timestamp,
          count: 0,
          types: {} as Record<EntityType, number>,
        });
      }

      const entry = timeline.get(row.hour)!;
      entry.count += row.count;
      entry.types[row.entity_type as EntityType] = row.count;
    }

    return Array.from(timeline.values());
  }

  /**
   * Get phase timeline showing duration of each phase
   */
  getPhaseTimeline(): PhaseTimeline[] {
    const rows = this.db.prepare(`
      SELECT from_phase, to_phase, timestamp, triggered_by
      FROM phase_transitions
      ORDER BY timestamp ASC
    `).all() as Array<{
      from_phase: string | null;
      to_phase: string;
      timestamp: string;
      triggered_by: string | null;
    }>;

    const timeline: PhaseTimeline[] = [];
    let currentPhase: PhaseTimeline | null = null;

    for (const row of rows) {
      // End previous phase
      if (currentPhase) {
        currentPhase.endedAt = row.timestamp as Timestamp;
        currentPhase.duration =
          new Date(row.timestamp).getTime() - new Date(currentPhase.startedAt).getTime();

        // Count entities in this phase
        const count = this.db.prepare(`
          SELECT COUNT(DISTINCT entity_id) as count
          FROM events
          WHERE phase = ? AND timestamp >= ? AND timestamp < ?
        `).get(currentPhase.phase, currentPhase.startedAt, row.timestamp) as { count: number };

        currentPhase.entityCount = count.count;
        timeline.push(currentPhase);
      }

      // Start new phase
      currentPhase = {
        phase: row.to_phase as TaskPhase,
        startedAt: row.timestamp as Timestamp,
        entityCount: 0,
      };
    }

    // Add current (ongoing) phase
    if (currentPhase) {
      const count = this.db.prepare(`
        SELECT COUNT(DISTINCT entity_id) as count
        FROM events
        WHERE phase = ? AND timestamp >= ?
      `).get(currentPhase.phase, currentPhase.startedAt) as { count: number };

      currentPhase.entityCount = count.count;
      timeline.push(currentPhase);
    }

    return timeline;
  }

  // ============================================================
  // STATISTICS
  // ============================================================

  /**
   * Get temporal statistics
   */
  getStats(): TemporalStats {
    const totalRow = this.db.prepare("SELECT COUNT(*) as count FROM events").get() as {
      count: number;
    };

    const boundsRow = this.db.prepare(`
      SELECT MIN(timestamp) as oldest, MAX(timestamp) as newest
      FROM events
    `).get() as { oldest: string | null; newest: string | null };

    const typeRows = this.db.prepare(`
      SELECT entity_type, COUNT(*) as count
      FROM events
      GROUP BY entity_type
    `).all() as Array<{ entity_type: string; count: number }>;

    const phaseRows = this.db.prepare(`
      SELECT phase, COUNT(*) as count
      FROM events
      GROUP BY phase
    `).all() as Array<{ phase: string; count: number }>;

    // Calculate average events per hour
    let avgEventsPerHour = 0;
    if (boundsRow.oldest && boundsRow.newest && totalRow.count > 0) {
      const hours =
        (new Date(boundsRow.newest).getTime() - new Date(boundsRow.oldest).getTime()) /
        (1000 * 60 * 60);
      avgEventsPerHour = hours > 0 ? totalRow.count / hours : totalRow.count;
    }

    return {
      totalEvents: totalRow.count,
      oldestEvent: boundsRow.oldest as Timestamp | null,
      newestEvent: boundsRow.newest as Timestamp | null,
      eventsByType: Object.fromEntries(
        typeRows.map((r) => [r.entity_type, r.count])
      ) as Record<EntityType, number>,
      eventsByPhase: Object.fromEntries(
        phaseRows.map((r) => [r.phase, r.count])
      ) as Record<TaskPhase, number>,
      avgEventsPerHour,
    };
  }

  /**
   * Get event count for a specific entity
   */
  getEntityEventCount(entityId: EntityId): number {
    const row = this.db.prepare(
      "SELECT COUNT(*) as count FROM events WHERE entity_id = ?"
    ).get(entityId) as { count: number };
    return row.count;
  }

  /**
   * Get last event for an entity
   */
  getLastEvent(entityId: EntityId): TemporalEntry | null {
    const row = this.db.prepare(`
      SELECT entity_id, entity_type, timestamp, phase, agent, action
      FROM events
      WHERE entity_id = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `).get(entityId) as {
      entity_id: string;
      entity_type: string;
      timestamp: string;
      phase: string;
      agent: string | null;
      action: string | null;
    } | undefined;

    if (!row) return null;

    return {
      id: row.entity_id as EntityId,
      type: row.entity_type as EntityType,
      timestamp: row.timestamp as Timestamp,
      phase: row.phase as TaskPhase,
      agent: row.agent || undefined,
      action: row.action || undefined,
    };
  }

  // ============================================================
  // CLEANUP
  // ============================================================

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}

// ============================================================
// SINGLETON EXPORT
// ============================================================

let _temporalIndex: TemporalIndex | null = null;

export function getTemporalIndex(boardPath: string): TemporalIndex {
  if (!_temporalIndex) {
    _temporalIndex = new TemporalIndex(boardPath);
  }
  return _temporalIndex;
}

export function resetTemporalIndex(): void {
  if (_temporalIndex) {
    _temporalIndex.close();
    _temporalIndex = null;
  }
}
