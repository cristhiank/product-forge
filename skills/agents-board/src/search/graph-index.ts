/**
 * Agent Collaboration Board - Graph Index
 *
 * Provides entity relationship traversal capabilities:
 * - supports/contradicts between facts
 * - based_on between decisions and facts
 * - depends_on between plan steps
 * - affects between decisions and steps
 * - references between alerts and entities
 */

import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { EntityId, Timestamp } from "../types/core.js";
import type { Edge, RelationType } from "../types/operations.js";

// ============================================================
// TYPES
// ============================================================

export interface GraphQuery {
  from?: EntityId;
  to?: EntityId;
  relation?: RelationType | RelationType[];
  direction?: "outgoing" | "incoming" | "both";
  depth?: number;
  limit?: number;
}

export interface GraphPath {
  nodes: EntityId[];
  edges: Edge[];
  totalWeight: number;
}

export interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  edgesByType: Record<RelationType, number>;
  avgDegree: number;
}

// ============================================================
// GRAPH INDEX CLASS
// ============================================================

export class GraphIndex {
  private db: Database.Database;

  constructor(boardPath: string) {
    const indexPath = join(boardPath, ".index");
    mkdirSync(indexPath, { recursive: true });

    const dbPath = join(indexPath, "graph.db");
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
      -- Nodes table (entity references)
      CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);

      -- Edges table (relationships)
      CREATE TABLE IF NOT EXISTS edges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_id TEXT NOT NULL,
        to_id TEXT NOT NULL,
        relation TEXT NOT NULL,
        weight REAL DEFAULT 1.0,
        created_at TEXT NOT NULL,
        metadata TEXT,
        UNIQUE(from_id, to_id, relation)
      );

      CREATE INDEX IF NOT EXISTS idx_edges_from ON edges(from_id);
      CREATE INDEX IF NOT EXISTS idx_edges_to ON edges(to_id);
      CREATE INDEX IF NOT EXISTS idx_edges_relation ON edges(relation);
      CREATE INDEX IF NOT EXISTS idx_edges_from_relation ON edges(from_id, relation);
      CREATE INDEX IF NOT EXISTS idx_edges_to_relation ON edges(to_id, relation);
    `);
  }

  // ============================================================
  // NODE OPERATIONS
  // ============================================================

  /**
   * Add or update a node
   */
  addNode(id: EntityId, type: string): void {
    this.db.prepare(`
      INSERT INTO nodes (id, type, created_at)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET type = excluded.type
    `).run(id, type, new Date().toISOString());
  }

  /**
   * Remove a node and all its edges
   */
  removeNode(id: EntityId): void {
    this.db.prepare("DELETE FROM edges WHERE from_id = ? OR to_id = ?").run(id, id);
    this.db.prepare("DELETE FROM nodes WHERE id = ?").run(id);
  }

  /**
   * Check if a node exists
   */
  hasNode(id: EntityId): boolean {
    const row = this.db.prepare("SELECT 1 FROM nodes WHERE id = ?").get(id);
    return row !== undefined;
  }

  // ============================================================
  // EDGE OPERATIONS
  // ============================================================

  /**
   * Add an edge between two entities
   */
  addEdge(from: EntityId, to: EntityId, relation: RelationType, weight: number = 1.0): void {
    // Ensure nodes exist
    if (!this.hasNode(from)) {
      this.addNode(from, this.inferTypeFromId(from));
    }
    if (!this.hasNode(to)) {
      this.addNode(to, this.inferTypeFromId(to));
    }

    this.db.prepare(`
      INSERT INTO edges (from_id, to_id, relation, weight, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(from_id, to_id, relation) DO UPDATE SET
        weight = excluded.weight,
        created_at = excluded.created_at
    `).run(from, to, relation, weight, new Date().toISOString());
  }

  /**
   * Remove an edge
   */
  removeEdge(from: EntityId, to: EntityId, relation: RelationType): void {
    this.db.prepare(
      "DELETE FROM edges WHERE from_id = ? AND to_id = ? AND relation = ?"
    ).run(from, to, relation);
  }

  /**
   * Remove all edges for an entity
   */
  removeEdgesFor(id: EntityId): void {
    this.db.prepare("DELETE FROM edges WHERE from_id = ? OR to_id = ?").run(id, id);
  }

  /**
   * Get edges from a node
   */
  getOutgoing(id: EntityId, relation?: RelationType | RelationType[]): Edge[] {
    let sql = "SELECT from_id, to_id, relation, created_at FROM edges WHERE from_id = ?";
    const params: unknown[] = [id];

    if (relation) {
      const relations = Array.isArray(relation) ? relation : [relation];
      const placeholders = relations.map(() => "?").join(",");
      sql += ` AND relation IN (${placeholders})`;
      params.push(...relations);
    }

    const rows = this.db.prepare(sql).all(...params) as Array<{
      from_id: string;
      to_id: string;
      relation: string;
      created_at: string;
    }>;

    return rows.map((r) => ({
      from: r.from_id as EntityId,
      to: r.to_id as EntityId,
      relation: r.relation as RelationType,
      created_at: r.created_at as Timestamp,
    }));
  }

  /**
   * Get edges to a node
   */
  getIncoming(id: EntityId, relation?: RelationType | RelationType[]): Edge[] {
    let sql = "SELECT from_id, to_id, relation, created_at FROM edges WHERE to_id = ?";
    const params: unknown[] = [id];

    if (relation) {
      const relations = Array.isArray(relation) ? relation : [relation];
      const placeholders = relations.map(() => "?").join(",");
      sql += ` AND relation IN (${placeholders})`;
      params.push(...relations);
    }

    const rows = this.db.prepare(sql).all(...params) as Array<{
      from_id: string;
      to_id: string;
      relation: string;
      created_at: string;
    }>;

    return rows.map((r) => ({
      from: r.from_id as EntityId,
      to: r.to_id as EntityId,
      relation: r.relation as RelationType,
      created_at: r.created_at as Timestamp,
    }));
  }

  // ============================================================
  // TRAVERSAL
  // ============================================================

  /**
   * Query the graph with filters
   */
  query(q: GraphQuery): Edge[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (q.from) {
      conditions.push("from_id = ?");
      params.push(q.from);
    }

    if (q.to) {
      conditions.push("to_id = ?");
      params.push(q.to);
    }

    if (q.relation) {
      const relations = Array.isArray(q.relation) ? q.relation : [q.relation];
      const placeholders = relations.map(() => "?").join(",");
      conditions.push(`relation IN (${placeholders})`);
      params.push(...relations);
    }

    let sql = "SELECT from_id, to_id, relation, created_at FROM edges";
    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }
    sql += " ORDER BY created_at DESC";

    if (q.limit) {
      sql += ` LIMIT ${q.limit}`;
    }

    const rows = this.db.prepare(sql).all(...params) as Array<{
      from_id: string;
      to_id: string;
      relation: string;
      created_at: string;
    }>;

    return rows.map((r) => ({
      from: r.from_id as EntityId,
      to: r.to_id as EntityId,
      relation: r.relation as RelationType,
      created_at: r.created_at as Timestamp,
    }));
  }

  /**
   * Find all connected entities from a starting point
   * Uses BFS traversal with depth limit
   */
  traverse(
    startId: EntityId,
    options: {
      direction?: "outgoing" | "incoming" | "both";
      relation?: RelationType | RelationType[];
      maxDepth?: number;
      limit?: number;
    } = {}
  ): { nodes: EntityId[]; edges: Edge[] } {
    const direction = options.direction || "both";
    const maxDepth = options.maxDepth || 3;
    const limit = options.limit || 100;

    const visited = new Set<string>();
    const resultNodes: EntityId[] = [];
    const resultEdges: Edge[] = [];

    const queue: Array<{ id: EntityId; depth: number }> = [{ id: startId, depth: 0 }];
    visited.add(startId);

    while (queue.length > 0 && resultNodes.length < limit) {
      const { id, depth } = queue.shift()!;

      if (depth > 0) {
        resultNodes.push(id);
      }

      if (depth >= maxDepth) continue;

      // Get connected edges
      let edges: Edge[] = [];

      if (direction === "outgoing" || direction === "both") {
        edges = edges.concat(this.getOutgoing(id, options.relation));
      }

      if (direction === "incoming" || direction === "both") {
        edges = edges.concat(this.getIncoming(id, options.relation));
      }

      for (const edge of edges) {
        resultEdges.push(edge);

        const neighborId = edge.from === id ? edge.to : edge.from;
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          queue.push({ id: neighborId, depth: depth + 1 });
        }
      }
    }

    return { nodes: resultNodes, edges: resultEdges };
  }

  /**
   * Find shortest path between two entities
   * Uses BFS
   */
  findPath(
    fromId: EntityId,
    toId: EntityId,
    options: {
      relation?: RelationType | RelationType[];
      maxDepth?: number;
    } = {}
  ): GraphPath | null {
    const maxDepth = options.maxDepth || 10;

    const visited = new Set<string>();
    const queue: Array<{
      id: EntityId;
      path: EntityId[];
      edges: Edge[];
    }> = [{ id: fromId, path: [fromId], edges: [] }];

    visited.add(fromId);

    while (queue.length > 0) {
      const { id, path, edges } = queue.shift()!;

      if (path.length > maxDepth) continue;

      // Get connected edges (both directions)
      const outgoing = this.getOutgoing(id, options.relation);
      const incoming = this.getIncoming(id, options.relation);
      const allEdges = [...outgoing, ...incoming];

      for (const edge of allEdges) {
        const neighborId = edge.from === id ? edge.to : edge.from;

        if (neighborId === toId) {
          // Found the target
          return {
            nodes: [...path, toId],
            edges: [...edges, edge],
            totalWeight: edges.length + 1,
          };
        }

        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          queue.push({
            id: neighborId,
            path: [...path, neighborId],
            edges: [...edges, edge],
          });
        }
      }
    }

    return null; // No path found
  }

  /**
   * Get entities that support/are supported by an entity
   */
  getSupporting(id: EntityId): EntityId[] {
    const edges = this.getIncoming(id, "supports");
    return edges.map((e) => e.from);
  }

  /**
   * Get entities that contradict an entity
   */
  getContradicting(id: EntityId): EntityId[] {
    const outgoing = this.getOutgoing(id, "contradicts");
    const incoming = this.getIncoming(id, "contradicts");
    return [...outgoing.map((e) => e.to), ...incoming.map((e) => e.from)];
  }

  /**
   * Get entities that an entity depends on
   */
  getDependencies(id: EntityId): EntityId[] {
    const edges = this.getOutgoing(id, "depends_on");
    return edges.map((e) => e.to);
  }

  /**
   * Get entities that depend on an entity
   */
  getDependents(id: EntityId): EntityId[] {
    const edges = this.getIncoming(id, "depends_on");
    return edges.map((e) => e.from);
  }

  // ============================================================
  // BULK OPERATIONS
  // ============================================================

  /**
   * Index entity relationships from board data
   */
  indexEntityRelationships(entity: {
    id: EntityId;
    supports?: EntityId[];
    contradicts?: EntityId[];
    based_on?: EntityId[];
    depends_on?: EntityId[];
    affects?: EntityId[];
    references?: EntityId[];
    supersedes?: EntityId[];
    blocking_step?: EntityId;
  }): void {
    const type = this.inferTypeFromId(entity.id);
    this.addNode(entity.id, type);

    if (entity.supports) {
      for (const targetId of entity.supports) {
        this.addEdge(entity.id, targetId, "supports");
      }
    }

    if (entity.contradicts) {
      for (const targetId of entity.contradicts) {
        this.addEdge(entity.id, targetId, "contradicts");
      }
    }

    if (entity.based_on) {
      for (const targetId of entity.based_on) {
        this.addEdge(entity.id, targetId, "based_on");
      }
    }

    if (entity.depends_on) {
      for (const targetId of entity.depends_on) {
        this.addEdge(entity.id, targetId, "depends_on");
      }
    }

    if (entity.affects) {
      for (const targetId of entity.affects) {
        this.addEdge(entity.id, targetId, "affects");
      }
    }

    if (entity.references) {
      for (const targetId of entity.references) {
        this.addEdge(entity.id, targetId, "references");
      }
    }

    if (entity.supersedes) {
      for (const targetId of entity.supersedes) {
        this.addEdge(entity.id, targetId, "supersedes");
      }
    }

    if (entity.blocking_step) {
      this.addEdge(entity.id, entity.blocking_step, "blocks");
    }
  }

  /**
   * Clear all graph data
   */
  clear(): void {
    this.db.exec("DELETE FROM edges; DELETE FROM nodes;");
  }

  // ============================================================
  // STATISTICS
  // ============================================================

  /**
   * Get graph statistics
   */
  getStats(): GraphStats {
    const totalNodes = (
      this.db.prepare("SELECT COUNT(*) as count FROM nodes").get() as { count: number }
    ).count;

    const totalEdges = (
      this.db.prepare("SELECT COUNT(*) as count FROM edges").get() as { count: number }
    ).count;

    const edgeTypeRows = this.db
      .prepare("SELECT relation, COUNT(*) as count FROM edges GROUP BY relation")
      .all() as Array<{ relation: string; count: number }>;

    const edgesByType = Object.fromEntries(
      edgeTypeRows.map((r) => [r.relation, r.count])
    ) as Record<RelationType, number>;

    const avgDegree = totalNodes > 0 ? (totalEdges * 2) / totalNodes : 0;

    return {
      totalNodes,
      totalEdges,
      edgesByType,
      avgDegree,
    };
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private inferTypeFromId(id: EntityId): string {
    if (id.startsWith("F-")) return "fact";
    if (id.startsWith("D-")) return "decision";
    if (id.startsWith("A-")) return "alert";
    if (id.startsWith("S-")) return "step";
    if (id.startsWith("C-")) return "constraint";
    return "unknown";
  }

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

let _graphIndex: GraphIndex | null = null;

export function getGraphIndex(boardPath: string): GraphIndex {
  if (!_graphIndex) {
    _graphIndex = new GraphIndex(boardPath);
  }
  return _graphIndex;
}

export function resetGraphIndex(): void {
  if (_graphIndex) {
    _graphIndex.close();
    _graphIndex = null;
  }
}
