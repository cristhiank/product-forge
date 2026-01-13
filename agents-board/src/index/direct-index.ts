/**
 * Agent Collaboration Board - Direct Index
 *
 * SQLite-backed index for O(1) entity lookups.
 * Provides fast access by ID, type, file, tag, agent, and step.
 */

import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type {
    AgentRole,
    Confidence,
    Entity,
    EntityId,
    EntityType,
    Timestamp,
} from "../types/index.js";

// ============================================================
// TYPES
// ============================================================

export interface DirectIndexFilters {
  types?: EntityType[];
  files?: string[];
  tags?: string[];
  agents?: AgentRole[];
  steps?: number[];
  confidence?: Confidence[];
  createdAfter?: Timestamp;
  createdBefore?: Timestamp;
  limit?: number;
  offset?: number;
}

export interface IndexStats {
  total_entities: number;
  by_type: Record<EntityType, number>;
  by_agent: Record<string, number>;
  files_indexed: number;
  tags_indexed: number;
}

// ============================================================
// DIRECT INDEX CLASS
// ============================================================

export class DirectIndex {
  private db: Database.Database;

  constructor(boardPath: string) {
    const indexPath = join(boardPath, ".index");
    mkdirSync(indexPath, { recursive: true });

    const dbPath = join(indexPath, "direct.db");
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
      -- Primary entity table
      CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
      CREATE INDEX IF NOT EXISTS idx_entities_created ON entities(created_at);

      -- File references (many-to-many)
      CREATE TABLE IF NOT EXISTS entity_files (
        entity_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        PRIMARY KEY (entity_id, file_path),
        FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_entity_files_path ON entity_files(file_path);

      -- Tags (many-to-many)
      CREATE TABLE IF NOT EXISTS entity_tags (
        entity_id TEXT NOT NULL,
        tag TEXT NOT NULL,
        PRIMARY KEY (entity_id, tag),
        FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_entity_tags_tag ON entity_tags(tag);

      -- Agent source
      CREATE TABLE IF NOT EXISTS entity_agents (
        entity_id TEXT PRIMARY KEY,
        agent TEXT NOT NULL,
        FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_entity_agents_agent ON entity_agents(agent);

      -- Confidence (for facts)
      CREATE TABLE IF NOT EXISTS entity_confidence (
        entity_id TEXT PRIMARY KEY,
        confidence TEXT NOT NULL,
        FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_entity_confidence ON entity_confidence(confidence);

      -- Step associations
      CREATE TABLE IF NOT EXISTS entity_steps (
        entity_id TEXT NOT NULL,
        step_number INTEGER NOT NULL,
        PRIMARY KEY (entity_id, step_number),
        FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_entity_steps_step ON entity_steps(step_number);
    `);
  }

  // ============================================================
  // INDEX OPERATIONS
  // ============================================================

  /**
   * Index a single entity
   */
  index(entity: Entity, entityType: EntityType): void {
    const id = this.getEntityId(entity);
    const createdAt = this.getCreatedAt(entity);
    const data = JSON.stringify(entity);

    // Upsert entity
    this.db.prepare(`
      INSERT INTO entities (id, type, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        data = excluded.data,
        updated_at = excluded.updated_at
    `).run(id, entityType, data, createdAt, new Date().toISOString());

    // Index files
    const files = this.extractFiles(entity);
    this.db.prepare("DELETE FROM entity_files WHERE entity_id = ?").run(id);
    const insertFile = this.db.prepare(
      "INSERT OR IGNORE INTO entity_files (entity_id, file_path) VALUES (?, ?)"
    );
    for (const file of files) {
      insertFile.run(id, file);
    }

    // Index tags
    const tags = this.extractTags(entity);
    this.db.prepare("DELETE FROM entity_tags WHERE entity_id = ?").run(id);
    const insertTag = this.db.prepare(
      "INSERT OR IGNORE INTO entity_tags (entity_id, tag) VALUES (?, ?)"
    );
    for (const tag of tags) {
      insertTag.run(id, tag);
    }

    // Index agent
    const agent = this.extractAgent(entity);
    if (agent) {
      this.db.prepare(`
        INSERT INTO entity_agents (entity_id, agent)
        VALUES (?, ?)
        ON CONFLICT(entity_id) DO UPDATE SET agent = excluded.agent
      `).run(id, agent);
    }

    // Index confidence (for facts)
    if ("confidence" in entity) {
      this.db.prepare(`
        INSERT INTO entity_confidence (entity_id, confidence)
        VALUES (?, ?)
        ON CONFLICT(entity_id) DO UPDATE SET confidence = excluded.confidence
      `).run(id, entity.confidence);
    }
  }

  /**
   * Index multiple entities
   */
  indexAll(entities: Array<{ entity: Entity; type: EntityType }>): void {
    const transaction = this.db.transaction(() => {
      for (const { entity, type } of entities) {
        this.index(entity, type);
      }
    });
    transaction();
  }

  /**
   * Remove an entity from the index
   */
  remove(id: EntityId): void {
    this.db.prepare("DELETE FROM entities WHERE id = ?").run(id);
    // Foreign key cascades handle related tables
  }

  /**
   * Clear all indexes
   */
  clear(): void {
    this.db.exec(`
      DELETE FROM entity_steps;
      DELETE FROM entity_confidence;
      DELETE FROM entity_agents;
      DELETE FROM entity_tags;
      DELETE FROM entity_files;
      DELETE FROM entities;
    `);
  }

  // ============================================================
  // LOOKUP OPERATIONS
  // ============================================================

  /**
   * Get entity by ID
   */
  get(id: EntityId): Entity | null {
    const row = this.db.prepare("SELECT data FROM entities WHERE id = ?").get(id) as
      | { data: string }
      | undefined;
    return row ? (JSON.parse(row.data) as Entity) : null;
  }

  /**
   * Get multiple entities by IDs
   */
  getByIds(ids: EntityId[]): Entity[] {
    if (ids.length === 0) return [];

    const placeholders = ids.map(() => "?").join(",");
    const rows = this.db
      .prepare(`SELECT data FROM entities WHERE id IN (${placeholders})`)
      .all(...ids) as Array<{ data: string }>;

    return rows.map((r) => JSON.parse(r.data) as Entity);
  }

  /**
   * Get entities by type
   */
  getByType(type: EntityType): Entity[] {
    const rows = this.db
      .prepare("SELECT data FROM entities WHERE type = ? ORDER BY created_at DESC")
      .all(type) as Array<{ data: string }>;

    return rows.map((r) => JSON.parse(r.data) as Entity);
  }

  /**
   * Count entities by type
   */
  countByType(type: EntityType): number {
    const row = this.db
      .prepare("SELECT COUNT(*) as count FROM entities WHERE type = ?")
      .get(type) as { count: number };
    return row.count;
  }

  /**
   * Get entities by file path (supports glob-like patterns with %)
   */
  getByFile(path: string): Entity[] {
    // Convert glob patterns to SQL LIKE patterns
    const pattern = path.includes("*") ? path.replace(/\*/g, "%") : path;
    const uselike = pattern.includes("%");

    const sql = uselike
      ? `SELECT DISTINCT e.data FROM entities e
         JOIN entity_files ef ON e.id = ef.entity_id
         WHERE ef.file_path LIKE ?
         ORDER BY e.created_at DESC`
      : `SELECT DISTINCT e.data FROM entities e
         JOIN entity_files ef ON e.id = ef.entity_id
         WHERE ef.file_path = ?
         ORDER BY e.created_at DESC`;

    const rows = this.db.prepare(sql).all(pattern) as Array<{ data: string }>;
    return rows.map((r) => JSON.parse(r.data) as Entity);
  }

  /**
   * Get entities by tag
   */
  getByTag(tag: string): Entity[] {
    const rows = this.db
      .prepare(
        `SELECT DISTINCT e.data FROM entities e
         JOIN entity_tags et ON e.id = et.entity_id
         WHERE et.tag = ?
         ORDER BY e.created_at DESC`
      )
      .all(tag) as Array<{ data: string }>;

    return rows.map((r) => JSON.parse(r.data) as Entity);
  }

  /**
   * Get entities by agent
   */
  getByAgent(agent: AgentRole): Entity[] {
    const rows = this.db
      .prepare(
        `SELECT e.data FROM entities e
         JOIN entity_agents ea ON e.id = ea.entity_id
         WHERE ea.agent = ?
         ORDER BY e.created_at DESC`
      )
      .all(agent) as Array<{ data: string }>;

    return rows.map((r) => JSON.parse(r.data) as Entity);
  }

  /**
   * Get entities by step number
   */
  getByStep(step: number): Entity[] {
    const rows = this.db
      .prepare(
        `SELECT DISTINCT e.data FROM entities e
         JOIN entity_steps es ON e.id = es.entity_id
         WHERE es.step_number = ?
         ORDER BY e.created_at DESC`
      )
      .all(step) as Array<{ data: string }>;

    return rows.map((r) => JSON.parse(r.data) as Entity);
  }

  /**
   * Get entities by confidence level
   */
  getByConfidence(confidence: Confidence): Entity[] {
    const rows = this.db
      .prepare(
        `SELECT e.data FROM entities e
         JOIN entity_confidence ec ON e.id = ec.entity_id
         WHERE ec.confidence = ?
         ORDER BY e.created_at DESC`
      )
      .all(confidence) as Array<{ data: string }>;

    return rows.map((r) => JSON.parse(r.data) as Entity);
  }

  // ============================================================
  // FILTERED QUERY
  // ============================================================

  /**
   * Query with multiple filters
   */
  query(filters: DirectIndexFilters): Entity[] {
    const { sql, params } = this.buildQuery(filters);
    const rows = this.db.prepare(sql).all(...params) as Array<{ data: string }>;
    return rows.map((r) => JSON.parse(r.data) as Entity);
  }

  private buildQuery(filters: DirectIndexFilters): { sql: string; params: unknown[] } {
    const joins: string[] = [];
    const conditions: string[] = [];
    const params: unknown[] = [];

    // Type filter
    if (filters.types && filters.types.length > 0) {
      const placeholders = filters.types.map(() => "?").join(",");
      conditions.push(`e.type IN (${placeholders})`);
      params.push(...filters.types);
    }

    // File filter
    if (filters.files && filters.files.length > 0) {
      joins.push("JOIN entity_files ef ON e.id = ef.entity_id");
      const fileConditions = filters.files.map((f) => {
        if (f.includes("*")) {
          params.push(f.replace(/\*/g, "%"));
          return "ef.file_path LIKE ?";
        } else {
          params.push(f);
          return "ef.file_path = ?";
        }
      });
      conditions.push(`(${fileConditions.join(" OR ")})`);
    }

    // Tag filter (AND logic - all tags must match)
    if (filters.tags && filters.tags.length > 0) {
      for (let i = 0; i < filters.tags.length; i++) {
        const alias = `et${i}`;
        joins.push(`JOIN entity_tags ${alias} ON e.id = ${alias}.entity_id`);
        conditions.push(`${alias}.tag = ?`);
        params.push(filters.tags[i]);
      }
    }

    // Agent filter
    if (filters.agents && filters.agents.length > 0) {
      joins.push("JOIN entity_agents ea ON e.id = ea.entity_id");
      const placeholders = filters.agents.map(() => "?").join(",");
      conditions.push(`ea.agent IN (${placeholders})`);
      params.push(...filters.agents);
    }

    // Confidence filter
    if (filters.confidence && filters.confidence.length > 0) {
      joins.push("LEFT JOIN entity_confidence ec ON e.id = ec.entity_id");
      const placeholders = filters.confidence.map(() => "?").join(",");
      conditions.push(`ec.confidence IN (${placeholders})`);
      params.push(...filters.confidence);
    }

    // Step filter
    if (filters.steps && filters.steps.length > 0) {
      joins.push("JOIN entity_steps es ON e.id = es.entity_id");
      const placeholders = filters.steps.map(() => "?").join(",");
      conditions.push(`es.step_number IN (${placeholders})`);
      params.push(...filters.steps);
    }

    // Time range filter
    if (filters.createdAfter) {
      conditions.push("e.created_at > ?");
      params.push(filters.createdAfter);
    }

    if (filters.createdBefore) {
      conditions.push("e.created_at < ?");
      params.push(filters.createdBefore);
    }

    // Build SQL
    let sql = "SELECT DISTINCT e.data FROM entities e";

    if (joins.length > 0) {
      sql += " " + joins.join(" ");
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY e.created_at DESC";

    if (filters.limit) {
      sql += ` LIMIT ${filters.limit}`;
    }

    if (filters.offset) {
      sql += ` OFFSET ${filters.offset}`;
    }

    return { sql, params };
  }

  // ============================================================
  // STATS
  // ============================================================

  /**
   * Get index statistics
   */
  getStats(): IndexStats {
    const totalRow = this.db.prepare("SELECT COUNT(*) as count FROM entities").get() as {
      count: number;
    };

    const typeRows = this.db
      .prepare("SELECT type, COUNT(*) as count FROM entities GROUP BY type")
      .all() as Array<{ type: EntityType; count: number }>;

    const agentRows = this.db
      .prepare("SELECT agent, COUNT(*) as count FROM entity_agents GROUP BY agent")
      .all() as Array<{ agent: string; count: number }>;

    const filesRow = this.db
      .prepare("SELECT COUNT(DISTINCT file_path) as count FROM entity_files")
      .get() as { count: number };

    const tagsRow = this.db
      .prepare("SELECT COUNT(DISTINCT tag) as count FROM entity_tags")
      .get() as { count: number };

    return {
      total_entities: totalRow.count,
      by_type: Object.fromEntries(typeRows.map((r) => [r.type, r.count])) as Record<
        EntityType,
        number
      >,
      by_agent: Object.fromEntries(agentRows.map((r) => [r.agent, r.count])) as Record<
        string,
        number
      >,
      files_indexed: filesRow.count,
      tags_indexed: tagsRow.count,
    };
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private getEntityId(entity: Entity): string {
    if ("id" in entity) return entity.id;
    throw new Error("Entity has no id");
  }

  private getCreatedAt(entity: Entity): string {
    if ("discovered_at" in entity) return entity.discovered_at;
    if ("proposed_at" in entity) return entity.proposed_at;
    if ("raised_at" in entity) return entity.raised_at;
    if ("added_at" in entity) return entity.added_at;
    return new Date().toISOString();
  }

  private extractFiles(entity: Entity): string[] {
    const files: string[] = [];

    // From evidence
    if ("evidence" in entity && Array.isArray(entity.evidence)) {
      for (const e of entity.evidence) {
        if (e.reference) {
          // Extract file path from reference like "src/auth.ts:10-20"
          const file = e.reference.split(":")[0];
          if (file && !file.startsWith("http")) {
            files.push(file);
          }
        }
      }
    }

    // From files array (PlanStep)
    if ("files" in entity && Array.isArray(entity.files)) {
      files.push(...entity.files);
    }

    return [...new Set(files)];
  }

  private extractTags(entity: Entity): string[] {
    if ("tags" in entity && Array.isArray(entity.tags)) {
      return entity.tags;
    }
    return [];
  }

  private extractAgent(entity: Entity): AgentRole | null {
    if ("source" in entity) return entity.source as AgentRole;
    if ("proposed_by" in entity) return entity.proposed_by as AgentRole;
    if ("raised_by" in entity) return entity.raised_by as AgentRole;
    if ("added_by" in entity) return entity.added_by as AgentRole;
    return null;
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }
}

// ============================================================
// SINGLETON EXPORT
// ============================================================

let _index: DirectIndex | null = null;

export function getDirectIndex(boardPath: string): DirectIndex {
  if (!_index) {
    _index = new DirectIndex(boardPath);
  }
  return _index;
}

export function resetDirectIndex(): void {
  if (_index) {
    _index.close();
    _index = null;
  }
}
