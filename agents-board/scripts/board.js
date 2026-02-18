#!/usr/bin/env node

// dist/manager/board-manager.js
import { existsSync as existsSync4, mkdirSync as mkdirSync6, readdirSync as readdirSync2, renameSync } from "node:fs";
import { join as join7 } from "node:path";

// dist/board.js
import { appendFileSync as appendFileSync2, existsSync as existsSync3, readFileSync as readFileSync3 } from "node:fs";
import { join as join6 } from "node:path";

// dist/index/direct-index.js
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
var DirectIndex = class {
  db;
  constructor(boardPath) {
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
  initSchema() {
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

      -- FTS5 full-text search index
      CREATE VIRTUAL TABLE IF NOT EXISTS entity_fts USING fts5(
        id UNINDEXED,
        type UNINDEXED,
        content,
        tags,
        tokenize='porter unicode61'
      );
    `);
  }
  // ============================================================
  // INDEX OPERATIONS
  // ============================================================
  /**
   * Index a single entity
   */
  index(entity, entityType) {
    const id = this.getEntityId(entity);
    const createdAt = this.getCreatedAt(entity);
    const data = JSON.stringify(entity);
    this.db.prepare(`
      INSERT INTO entities (id, type, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        data = excluded.data,
        updated_at = excluded.updated_at
    `).run(id, entityType, data, createdAt, (/* @__PURE__ */ new Date()).toISOString());
    const files = this.extractFiles(entity);
    this.db.prepare("DELETE FROM entity_files WHERE entity_id = ?").run(id);
    const insertFile = this.db.prepare("INSERT OR IGNORE INTO entity_files (entity_id, file_path) VALUES (?, ?)");
    for (const file of files) {
      insertFile.run(id, file);
    }
    const tags = this.extractTags(entity);
    this.db.prepare("DELETE FROM entity_tags WHERE entity_id = ?").run(id);
    const insertTag = this.db.prepare("INSERT OR IGNORE INTO entity_tags (entity_id, tag) VALUES (?, ?)");
    for (const tag of tags) {
      insertTag.run(id, tag);
    }
    const agent = this.extractAgent(entity);
    if (agent) {
      this.db.prepare(`
        INSERT INTO entity_agents (entity_id, agent)
        VALUES (?, ?)
        ON CONFLICT(entity_id) DO UPDATE SET agent = excluded.agent
      `).run(id, agent);
    }
    if ("confidence" in entity) {
      this.db.prepare(`
        INSERT INTO entity_confidence (entity_id, confidence)
        VALUES (?, ?)
        ON CONFLICT(entity_id) DO UPDATE SET confidence = excluded.confidence
      `).run(id, entity.confidence);
    }
    const textContent = this.extractTextContent(entity);
    if (textContent) {
      this.db.prepare("DELETE FROM entity_fts WHERE id = ?").run(id);
      this.db.prepare("INSERT INTO entity_fts (id, type, content, tags) VALUES (?, ?, ?, ?)").run(id, entityType, textContent, tags.join(" "));
    }
  }
  /**
   * Index multiple entities
   */
  indexAll(entities) {
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
  remove(id) {
    this.db.prepare("DELETE FROM entities WHERE id = ?").run(id);
  }
  /**
   * Clear all indexes
   */
  clear() {
    this.db.exec(`
      DELETE FROM entity_steps;
      DELETE FROM entity_confidence;
      DELETE FROM entity_agents;
      DELETE FROM entity_tags;
      DELETE FROM entity_files;
      DELETE FROM entity_fts;
      DELETE FROM entities;
    `);
  }
  // ============================================================
  // LOOKUP OPERATIONS
  // ============================================================
  /**
   * Get entity by ID
   */
  get(id) {
    const row = this.db.prepare("SELECT data FROM entities WHERE id = ?").get(id);
    return row ? JSON.parse(row.data) : null;
  }
  /**
   * Get multiple entities by IDs
   */
  getByIds(ids) {
    if (ids.length === 0)
      return [];
    const placeholders = ids.map(() => "?").join(",");
    const rows = this.db.prepare(`SELECT data FROM entities WHERE id IN (${placeholders})`).all(...ids);
    return rows.map((r) => JSON.parse(r.data));
  }
  /**
   * Get entities by type
   */
  getByType(type) {
    const rows = this.db.prepare("SELECT data FROM entities WHERE type = ? ORDER BY created_at DESC").all(type);
    return rows.map((r) => JSON.parse(r.data));
  }
  /**
   * Count entities by type
   */
  countByType(type) {
    const row = this.db.prepare("SELECT COUNT(*) as count FROM entities WHERE type = ?").get(type);
    return row.count;
  }
  /**
   * Get entities by file path (supports glob-like patterns with %)
   */
  getByFile(path) {
    const pattern = path.includes("*") ? path.replace(/\*/g, "%") : path;
    const uselike = pattern.includes("%");
    const sql = uselike ? `SELECT DISTINCT e.data FROM entities e
         JOIN entity_files ef ON e.id = ef.entity_id
         WHERE ef.file_path LIKE ?
         ORDER BY e.created_at DESC` : `SELECT DISTINCT e.data FROM entities e
         JOIN entity_files ef ON e.id = ef.entity_id
         WHERE ef.file_path = ?
         ORDER BY e.created_at DESC`;
    const rows = this.db.prepare(sql).all(pattern);
    return rows.map((r) => JSON.parse(r.data));
  }
  /**
   * Get entities by tag
   */
  getByTag(tag) {
    const rows = this.db.prepare(`SELECT DISTINCT e.data FROM entities e
         JOIN entity_tags et ON e.id = et.entity_id
         WHERE et.tag = ?
         ORDER BY e.created_at DESC`).all(tag);
    return rows.map((r) => JSON.parse(r.data));
  }
  /**
   * Get entities by agent
   */
  getByAgent(agent) {
    const rows = this.db.prepare(`SELECT e.data FROM entities e
         JOIN entity_agents ea ON e.id = ea.entity_id
         WHERE ea.agent = ?
         ORDER BY e.created_at DESC`).all(agent);
    return rows.map((r) => JSON.parse(r.data));
  }
  /**
   * Get entities by step number
   */
  getByStep(step) {
    const rows = this.db.prepare(`SELECT DISTINCT e.data FROM entities e
         JOIN entity_steps es ON e.id = es.entity_id
         WHERE es.step_number = ?
         ORDER BY e.created_at DESC`).all(step);
    return rows.map((r) => JSON.parse(r.data));
  }
  /**
   * Get entities by confidence level
   */
  getByConfidence(confidence) {
    const rows = this.db.prepare(`SELECT e.data FROM entities e
         JOIN entity_confidence ec ON e.id = ec.entity_id
         WHERE ec.confidence = ?
         ORDER BY e.created_at DESC`).all(confidence);
    return rows.map((r) => JSON.parse(r.data));
  }
  // ============================================================
  // FILTERED QUERY
  // ============================================================
  /**
   * Query with multiple filters
   */
  query(filters) {
    const { sql, params } = this.buildQuery(filters);
    const rows = this.db.prepare(sql).all(...params);
    return rows.map((r) => JSON.parse(r.data));
  }
  buildQuery(filters) {
    const joins = [];
    const conditions = [];
    const params = [];
    if (filters.types && filters.types.length > 0) {
      const placeholders = filters.types.map(() => "?").join(",");
      conditions.push(`e.type IN (${placeholders})`);
      params.push(...filters.types);
    }
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
    if (filters.tags && filters.tags.length > 0) {
      for (let i = 0; i < filters.tags.length; i++) {
        const alias = `et${i}`;
        joins.push(`JOIN entity_tags ${alias} ON e.id = ${alias}.entity_id`);
        conditions.push(`${alias}.tag = ?`);
        params.push(filters.tags[i]);
      }
    }
    if (filters.agents && filters.agents.length > 0) {
      joins.push("JOIN entity_agents ea ON e.id = ea.entity_id");
      const placeholders = filters.agents.map(() => "?").join(",");
      conditions.push(`ea.agent IN (${placeholders})`);
      params.push(...filters.agents);
    }
    if (filters.confidence && filters.confidence.length > 0) {
      joins.push("LEFT JOIN entity_confidence ec ON e.id = ec.entity_id");
      const placeholders = filters.confidence.map(() => "?").join(",");
      conditions.push(`ec.confidence IN (${placeholders})`);
      params.push(...filters.confidence);
    }
    if (filters.steps && filters.steps.length > 0) {
      joins.push("JOIN entity_steps es ON e.id = es.entity_id");
      const placeholders = filters.steps.map(() => "?").join(",");
      conditions.push(`es.step_number IN (${placeholders})`);
      params.push(...filters.steps);
    }
    if (filters.createdAfter) {
      conditions.push("e.created_at > ?");
      params.push(filters.createdAfter);
    }
    if (filters.createdBefore) {
      conditions.push("e.created_at < ?");
      params.push(filters.createdBefore);
    }
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
  getStats() {
    const totalRow = this.db.prepare("SELECT COUNT(*) as count FROM entities").get();
    const typeRows = this.db.prepare("SELECT type, COUNT(*) as count FROM entities GROUP BY type").all();
    const agentRows = this.db.prepare("SELECT agent, COUNT(*) as count FROM entity_agents GROUP BY agent").all();
    const filesRow = this.db.prepare("SELECT COUNT(DISTINCT file_path) as count FROM entity_files").get();
    const tagsRow = this.db.prepare("SELECT COUNT(DISTINCT tag) as count FROM entity_tags").get();
    return {
      total_entities: totalRow.count,
      by_type: Object.fromEntries(typeRows.map((r) => [r.type, r.count])),
      by_agent: Object.fromEntries(agentRows.map((r) => [r.agent, r.count])),
      files_indexed: filesRow.count,
      tags_indexed: tagsRow.count
    };
  }
  // ============================================================
  // HELPERS
  // ============================================================
  getEntityId(entity) {
    if ("id" in entity)
      return entity.id;
    throw new Error("Entity has no id");
  }
  getCreatedAt(entity) {
    if ("discovered_at" in entity)
      return entity.discovered_at;
    if ("proposed_at" in entity)
      return entity.proposed_at;
    if ("raised_at" in entity)
      return entity.raised_at;
    if ("added_at" in entity)
      return entity.added_at;
    return (/* @__PURE__ */ new Date()).toISOString();
  }
  extractFiles(entity) {
    const files = [];
    if ("evidence" in entity && Array.isArray(entity.evidence)) {
      for (const e of entity.evidence) {
        if (e.reference) {
          const file = e.reference.split(":")[0];
          if (file && !file.startsWith("http")) {
            files.push(file);
          }
        }
      }
    }
    if ("files" in entity && Array.isArray(entity.files)) {
      files.push(...entity.files);
    }
    return [...new Set(files)];
  }
  extractTags(entity) {
    if ("tags" in entity && Array.isArray(entity.tags)) {
      return entity.tags;
    }
    return [];
  }
  extractAgent(entity) {
    if ("source" in entity)
      return entity.source;
    if ("proposed_by" in entity)
      return entity.proposed_by;
    if ("raised_by" in entity)
      return entity.raised_by;
    if ("added_by" in entity)
      return entity.added_by;
    return null;
  }
  /**
   * Extract searchable text content from an entity
   */
  extractTextContent(entity) {
    const parts = [];
    if ("content" in entity && typeof entity.content === "string") {
      parts.push(entity.content);
    }
    if ("title" in entity && typeof entity.title === "string") {
      parts.push(entity.title);
    }
    if ("description" in entity && typeof entity.description === "string") {
      parts.push(entity.description);
    }
    if ("action" in entity && typeof entity.action === "string") {
      parts.push(entity.action);
    }
    if ("rationale" in entity && typeof entity.rationale === "string") {
      parts.push(entity.rationale);
    }
    if ("purpose" in entity && typeof entity.purpose === "string") {
      parts.push(entity.purpose);
    }
    if ("summary" in entity && typeof entity.summary === "string") {
      parts.push(entity.summary);
    }
    return parts.join(" ");
  }
  // ============================================================
  // FULL-TEXT SEARCH
  // ============================================================
  /**
   * Search entities using FTS5 full-text search (BM25 ranking)
   */
  ftsSearch(query, options) {
    const limit = options?.limit ?? 20;
    const sanitized = query.replace(/['"]/g, "").split(/\s+/).filter(Boolean).map((term) => `"${term}"*`).join(" OR ");
    if (!sanitized)
      return [];
    let sql = `
      SELECT f.id, f.type, e.data, -f.rank as score
      FROM entity_fts f
      JOIN entities e ON e.id = f.id
      WHERE entity_fts MATCH ?
    `;
    const params = [sanitized];
    if (options?.types && options.types.length > 0) {
      const placeholders = options.types.map(() => "?").join(",");
      sql += ` AND f.type IN (${placeholders})`;
      params.push(...options.types);
    }
    sql += ` ORDER BY score DESC LIMIT ?`;
    params.push(limit);
    try {
      const rows = this.db.prepare(sql).all(...params);
      return rows.map((r) => ({
        entity: JSON.parse(r.data),
        entityType: r.type,
        score: r.score
      }));
    } catch {
      return [];
    }
  }
  /**
   * Close the database connection
   */
  close() {
    this.db.close();
  }
};

// dist/search/graph-index.js
import Database2 from "better-sqlite3";
import { mkdirSync as mkdirSync2 } from "node:fs";
import { join as join2 } from "node:path";
var GraphIndex = class {
  db;
  constructor(boardPath) {
    const indexPath = join2(boardPath, ".index");
    mkdirSync2(indexPath, { recursive: true });
    const dbPath = join2(indexPath, "graph.db");
    this.db = new Database2(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = NORMAL");
    this.initSchema();
  }
  // ============================================================
  // SCHEMA
  // ============================================================
  initSchema() {
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
  addNode(id, type) {
    this.db.prepare(`
      INSERT INTO nodes (id, type, created_at)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET type = excluded.type
    `).run(id, type, (/* @__PURE__ */ new Date()).toISOString());
  }
  /**
   * Remove a node and all its edges
   */
  removeNode(id) {
    this.db.prepare("DELETE FROM edges WHERE from_id = ? OR to_id = ?").run(id, id);
    this.db.prepare("DELETE FROM nodes WHERE id = ?").run(id);
  }
  /**
   * Check if a node exists
   */
  hasNode(id) {
    const row = this.db.prepare("SELECT 1 FROM nodes WHERE id = ?").get(id);
    return row !== void 0;
  }
  // ============================================================
  // EDGE OPERATIONS
  // ============================================================
  /**
   * Add an edge between two entities
   */
  addEdge(from, to, relation, weight = 1) {
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
    `).run(from, to, relation, weight, (/* @__PURE__ */ new Date()).toISOString());
  }
  /**
   * Remove an edge
   */
  removeEdge(from, to, relation) {
    this.db.prepare("DELETE FROM edges WHERE from_id = ? AND to_id = ? AND relation = ?").run(from, to, relation);
  }
  /**
   * Remove all edges for an entity
   */
  removeEdgesFor(id) {
    this.db.prepare("DELETE FROM edges WHERE from_id = ? OR to_id = ?").run(id, id);
  }
  /**
   * Get edges from a node
   */
  getOutgoing(id, relation) {
    let sql = "SELECT from_id, to_id, relation, created_at FROM edges WHERE from_id = ?";
    const params = [id];
    if (relation) {
      const relations = Array.isArray(relation) ? relation : [relation];
      const placeholders = relations.map(() => "?").join(",");
      sql += ` AND relation IN (${placeholders})`;
      params.push(...relations);
    }
    const rows = this.db.prepare(sql).all(...params);
    return rows.map((r) => ({
      from: r.from_id,
      to: r.to_id,
      relation: r.relation,
      created_at: r.created_at
    }));
  }
  /**
   * Get edges to a node
   */
  getIncoming(id, relation) {
    let sql = "SELECT from_id, to_id, relation, created_at FROM edges WHERE to_id = ?";
    const params = [id];
    if (relation) {
      const relations = Array.isArray(relation) ? relation : [relation];
      const placeholders = relations.map(() => "?").join(",");
      sql += ` AND relation IN (${placeholders})`;
      params.push(...relations);
    }
    const rows = this.db.prepare(sql).all(...params);
    return rows.map((r) => ({
      from: r.from_id,
      to: r.to_id,
      relation: r.relation,
      created_at: r.created_at
    }));
  }
  // ============================================================
  // TRAVERSAL
  // ============================================================
  /**
   * Query the graph with filters
   */
  query(q) {
    const conditions = [];
    const params = [];
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
    const rows = this.db.prepare(sql).all(...params);
    return rows.map((r) => ({
      from: r.from_id,
      to: r.to_id,
      relation: r.relation,
      created_at: r.created_at
    }));
  }
  /**
   * Find all connected entities from a starting point
   * Uses BFS traversal with depth limit
   */
  traverse(startId, options = {}) {
    const direction = options.direction || "both";
    const maxDepth = options.maxDepth || 3;
    const limit = options.limit || 100;
    const visited = /* @__PURE__ */ new Set();
    const resultNodes = [];
    const resultEdges = [];
    const queue = [{ id: startId, depth: 0 }];
    visited.add(startId);
    while (queue.length > 0 && resultNodes.length < limit) {
      const { id, depth } = queue.shift();
      if (depth > 0) {
        resultNodes.push(id);
      }
      if (depth >= maxDepth)
        continue;
      let edges = [];
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
  findPath(fromId, toId, options = {}) {
    const maxDepth = options.maxDepth || 10;
    const visited = /* @__PURE__ */ new Set();
    const queue = [{ id: fromId, path: [fromId], edges: [] }];
    visited.add(fromId);
    while (queue.length > 0) {
      const { id, path, edges } = queue.shift();
      if (path.length > maxDepth)
        continue;
      const outgoing = this.getOutgoing(id, options.relation);
      const incoming = this.getIncoming(id, options.relation);
      const allEdges = [...outgoing, ...incoming];
      for (const edge of allEdges) {
        const neighborId = edge.from === id ? edge.to : edge.from;
        if (neighborId === toId) {
          return {
            nodes: [...path, toId],
            edges: [...edges, edge],
            totalWeight: edges.length + 1
          };
        }
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          queue.push({
            id: neighborId,
            path: [...path, neighborId],
            edges: [...edges, edge]
          });
        }
      }
    }
    return null;
  }
  /**
   * Get entities that support/are supported by an entity
   */
  getSupporting(id) {
    const edges = this.getIncoming(id, "supports");
    return edges.map((e) => e.from);
  }
  /**
   * Get entities that contradict an entity
   */
  getContradicting(id) {
    const outgoing = this.getOutgoing(id, "contradicts");
    const incoming = this.getIncoming(id, "contradicts");
    return [...outgoing.map((e) => e.to), ...incoming.map((e) => e.from)];
  }
  /**
   * Get entities that an entity depends on
   */
  getDependencies(id) {
    const edges = this.getOutgoing(id, "depends_on");
    return edges.map((e) => e.to);
  }
  /**
   * Get entities that depend on an entity
   */
  getDependents(id) {
    const edges = this.getIncoming(id, "depends_on");
    return edges.map((e) => e.from);
  }
  // ============================================================
  // BULK OPERATIONS
  // ============================================================
  /**
   * Index entity relationships from board data
   */
  indexEntityRelationships(entity) {
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
  clear() {
    this.db.exec("DELETE FROM edges; DELETE FROM nodes;");
  }
  // ============================================================
  // STATISTICS
  // ============================================================
  /**
   * Get graph statistics
   */
  getStats() {
    const totalNodes = this.db.prepare("SELECT COUNT(*) as count FROM nodes").get().count;
    const totalEdges = this.db.prepare("SELECT COUNT(*) as count FROM edges").get().count;
    const edgeTypeRows = this.db.prepare("SELECT relation, COUNT(*) as count FROM edges GROUP BY relation").all();
    const edgesByType = Object.fromEntries(edgeTypeRows.map((r) => [r.relation, r.count]));
    const avgDegree = totalNodes > 0 ? totalEdges * 2 / totalNodes : 0;
    return {
      totalNodes,
      totalEdges,
      edgesByType,
      avgDegree
    };
  }
  // ============================================================
  // HELPERS
  // ============================================================
  inferTypeFromId(id) {
    if (id.startsWith("F-"))
      return "fact";
    if (id.startsWith("D-"))
      return "decision";
    if (id.startsWith("A-"))
      return "alert";
    if (id.startsWith("S-"))
      return "step";
    if (id.startsWith("C-"))
      return "constraint";
    return "unknown";
  }
  /**
   * Close database connection
   */
  close() {
    this.db.close();
  }
};

// dist/search/ck-search.js
import { spawn } from "node:child_process";
import { existsSync, mkdirSync as mkdirSync3, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join as join3 } from "node:path";
var CKSearch = class {
  indexPath;
  documentsPath;
  isAvailable = false;
  constructor(boardPath) {
    this.indexPath = join3(boardPath, ".index", "ck");
    this.documentsPath = join3(this.indexPath, "documents");
    mkdirSync3(this.documentsPath, { recursive: true });
    this.checkCKAvailability();
  }
  // ============================================================
  // AVAILABILITY
  // ============================================================
  async checkCKAvailability() {
    try {
      const result = await this.runCK(["--version"]);
      this.isAvailable = result.exitCode === 0;
    } catch {
      this.isAvailable = false;
    }
  }
  /**
   * Check if CK is available on the system
   */
  available() {
    return this.isAvailable;
  }
  // ============================================================
  // INDEXING
  // ============================================================
  /**
   * Index an entity for hybrid search
   */
  async index(entity, entityType) {
    const id = this.getEntityId(entity);
    const content = this.extractSearchableContent(entity);
    const docPath = join3(this.documentsPath, `${id}.json`);
    const doc = {
      id,
      type: entityType,
      content,
      metadata: this.extractMetadata(entity),
      indexed_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    writeFileSync(docPath, JSON.stringify(doc, null, 2));
    if (this.isAvailable) {
      await this.runCK(["index", "--path", this.documentsPath, "--incremental"]);
    }
  }
  /**
   * Index multiple entities at once
   */
  async indexBatch(entities) {
    for (const { entity, type } of entities) {
      const id = this.getEntityId(entity);
      const content = this.extractSearchableContent(entity);
      const docPath = join3(this.documentsPath, `${id}.json`);
      const doc = {
        id,
        type,
        content,
        metadata: this.extractMetadata(entity),
        indexed_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      writeFileSync(docPath, JSON.stringify(doc, null, 2));
    }
    if (this.isAvailable) {
      await this.runCK(["index", "--path", this.documentsPath]);
    }
  }
  /**
   * Remove entity from index
   */
  async remove(id) {
    const docPath = join3(this.documentsPath, `${id}.json`);
    if (existsSync(docPath)) {
      const { unlinkSync } = await import("node:fs");
      unlinkSync(docPath);
      if (this.isAvailable) {
        await this.runCK(["index", "--path", this.documentsPath]);
      }
    }
  }
  /**
   * Clear all indexed documents
   */
  async clear() {
    const { readdirSync: readdirSync3, unlinkSync } = await import("node:fs");
    const files = readdirSync3(this.documentsPath);
    for (const file of files) {
      unlinkSync(join3(this.documentsPath, file));
    }
    if (this.isAvailable) {
      await this.runCK(["index", "--path", this.documentsPath, "--clear"]);
    }
  }
  // ============================================================
  // SEARCH
  // ============================================================
  /**
   * Perform hybrid search
   */
  async search(query, options = { mode: "hybrid" }) {
    if (!this.isAvailable) {
      return this.fallbackSearch(query, options);
    }
    const args = ["search", "--query", query, "--path", this.documentsPath];
    switch (options.mode) {
      case "lexical":
        args.push("--mode", "bm25");
        break;
      case "semantic":
        args.push("--mode", "embedding");
        break;
      case "hybrid":
      default:
        args.push("--mode", "hybrid");
        break;
    }
    if (options.limit) {
      args.push("--limit", options.limit.toString());
    }
    if (options.rerank) {
      args.push("--rerank");
    }
    const result = await this.runCK(args);
    if (result.exitCode !== 0) {
      console.error("CK search failed:", result.stderr);
      return this.fallbackSearch(query, options);
    }
    return this.parseSearchResults(result.stdout);
  }
  /**
   * Fallback search when CK is not available
   * Uses simple substring matching on indexed documents
   */
  fallbackSearch(query, options) {
    const results = [];
    const queryLower = query.toLowerCase();
    const limit = options.limit || 10;
    try {
      const files = readdirSync(this.documentsPath);
      for (const file of files) {
        if (!file.endsWith(".json"))
          continue;
        const docPath = join3(this.documentsPath, file);
        const doc = JSON.parse(readFileSync(docPath, "utf-8"));
        const content = doc.content.toLowerCase();
        if (content.includes(queryLower)) {
          const occurrences = (content.match(new RegExp(queryLower, "g")) || []).length;
          const score = occurrences / Math.sqrt(content.length);
          results.push({
            id: doc.id,
            entityType: doc.type,
            score,
            highlights: this.extractHighlights(doc.content, query)
          });
        }
      }
      results.sort((a, b) => b.score - a.score);
      return results.slice(0, limit);
    } catch {
      return [];
    }
  }
  // ============================================================
  // HELPERS
  // ============================================================
  async runCK(args) {
    return new Promise((resolve) => {
      const ck = spawn("ck", args, {
        stdio: ["pipe", "pipe", "pipe"]
      });
      let stdout = "";
      let stderr = "";
      ck.stdout?.on("data", (data) => {
        stdout += data.toString();
      });
      ck.stderr?.on("data", (data) => {
        stderr += data.toString();
      });
      ck.on("error", () => {
        resolve({ exitCode: 1, stdout: "", stderr: "CK not found" });
      });
      ck.on("close", (code) => {
        resolve({ exitCode: code || 0, stdout, stderr });
      });
      setTimeout(() => {
        ck.kill();
        resolve({ exitCode: 1, stdout, stderr: "Timeout" });
      }, 3e4);
    });
  }
  getEntityId(entity) {
    if ("id" in entity)
      return entity.id;
    throw new Error("Entity has no id");
  }
  extractSearchableContent(entity) {
    const parts = [];
    if ("content" in entity)
      parts.push(entity.content);
    if ("title" in entity)
      parts.push(entity.title);
    if ("description" in entity)
      parts.push(entity.description);
    if ("rationale" in entity)
      parts.push(entity.rationale);
    if ("action" in entity)
      parts.push(entity.action);
    if ("verification" in entity)
      parts.push(entity.verification);
    if ("evidence" in entity && Array.isArray(entity.evidence)) {
      for (const e of entity.evidence) {
        parts.push(e.reference);
        if (e.excerpt)
          parts.push(e.excerpt);
      }
    }
    if ("alternatives" in entity && Array.isArray(entity.alternatives)) {
      for (const alt of entity.alternatives) {
        parts.push(alt.name);
        parts.push(alt.description);
      }
    }
    if ("tags" in entity && Array.isArray(entity.tags)) {
      parts.push(...entity.tags);
    }
    if ("files" in entity && Array.isArray(entity.files)) {
      parts.push(...entity.files);
    }
    return parts.join("\n");
  }
  extractMetadata(entity) {
    const metadata = {};
    if ("confidence" in entity)
      metadata.confidence = entity.confidence;
    if ("status" in entity)
      metadata.status = entity.status;
    if ("severity" in entity)
      metadata.severity = entity.severity;
    if ("source" in entity)
      metadata.source = entity.source;
    if ("proposed_by" in entity)
      metadata.proposed_by = entity.proposed_by;
    if ("raised_by" in entity)
      metadata.raised_by = entity.raised_by;
    if ("tags" in entity)
      metadata.tags = entity.tags;
    if ("files" in entity)
      metadata.files = entity.files;
    return metadata;
  }
  parseSearchResults(stdout) {
    try {
      const lines = stdout.trim().split("\n").filter(Boolean);
      const results = [];
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          results.push({
            id: parsed.id,
            entityType: parsed.type,
            score: parsed.score || 0,
            lexicalScore: parsed.lexical_score,
            semanticScore: parsed.semantic_score,
            highlights: parsed.highlights || []
          });
        } catch {
        }
      }
      return results;
    } catch {
      return [];
    }
  }
  extractHighlights(content, query) {
    const highlights = [];
    const queryLower = query.toLowerCase();
    const contentLower = content.toLowerCase();
    let index = contentLower.indexOf(queryLower);
    while (index !== -1 && highlights.length < 3) {
      const start = Math.max(0, index - 30);
      const end = Math.min(content.length, index + query.length + 30);
      let highlight = content.slice(start, end);
      if (start > 0)
        highlight = "..." + highlight;
      if (end < content.length)
        highlight = highlight + "...";
      highlights.push(highlight);
      index = contentLower.indexOf(queryLower, index + 1);
    }
    return highlights;
  }
  /**
   * Get index statistics
   */
  getStats() {
    try {
      const files = readdirSync(this.documentsPath).filter((f) => f.endsWith(".json"));
      let totalSize = 0;
      let latestUpdate = "";
      for (const file of files) {
        const stat = statSync(join3(this.documentsPath, file));
        totalSize += stat.size;
        if (!latestUpdate || stat.mtime.toISOString() > latestUpdate) {
          latestUpdate = stat.mtime.toISOString();
        }
      }
      return {
        documents: files.length,
        indexSize: totalSize,
        lastUpdated: latestUpdate || (/* @__PURE__ */ new Date()).toISOString()
      };
    } catch {
      return {
        documents: 0,
        indexSize: 0,
        lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
  }
};

// dist/search/temporal-index.js
import Database3 from "better-sqlite3";
import { mkdirSync as mkdirSync4 } from "node:fs";
import { join as join4 } from "node:path";
var TemporalIndex = class {
  db;
  constructor(boardPath) {
    const indexPath = join4(boardPath, ".index");
    mkdirSync4(indexPath, { recursive: true });
    const dbPath = join4(indexPath, "temporal.db");
    this.db = new Database3(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = NORMAL");
    this.initSchema();
  }
  // ============================================================
  // SCHEMA
  // ============================================================
  initSchema() {
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
  recordEvent(entityId, entityType, timestamp, phase, agent, action) {
    this.db.prepare(`
      INSERT OR REPLACE INTO events (entity_id, entity_type, timestamp, phase, agent, action)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(entityId, entityType, timestamp, phase, agent || null, action || null);
  }
  /**
   * Record a phase transition
   */
  recordPhaseTransition(fromPhase, toPhase, timestamp, triggeredBy) {
    this.db.prepare(`
      INSERT INTO phase_transitions (from_phase, to_phase, timestamp, triggered_by)
      VALUES (?, ?, ?, ?)
    `).run(fromPhase, toPhase, timestamp, triggeredBy || null);
  }
  /**
   * Remove events for an entity
   */
  removeEntity(entityId) {
    this.db.prepare("DELETE FROM events WHERE entity_id = ?").run(entityId);
  }
  /**
   * Clear all temporal data
   */
  clear() {
    this.db.exec("DELETE FROM events; DELETE FROM phase_transitions;");
  }
  // ============================================================
  // QUERIES
  // ============================================================
  /**
   * Query events with temporal filters
   */
  query(q) {
    const conditions = [];
    const params = [];
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
    const rows = this.db.prepare(sql).all(...params);
    return rows.map((r) => ({
      id: r.entity_id,
      type: r.entity_type,
      timestamp: r.timestamp,
      phase: r.phase,
      agent: r.agent || void 0,
      action: r.action || void 0
    }));
  }
  /**
   * Get most recent entities
   */
  getRecent(limit = 10, types) {
    return this.query({ limit, types, orderBy: "desc" });
  }
  /**
   * Get entities in a time range
   */
  getInRange(after, before, types) {
    return this.query({ after, before, types, orderBy: "asc" });
  }
  /**
   * Get entities from a specific phase
   */
  getByPhase(phase, types) {
    return this.query({ phases: [phase], types, orderBy: "desc" });
  }
  /**
   * Get unique entity IDs from temporal events
   */
  getEntityIds(q) {
    const entries = this.query(q);
    const seen = /* @__PURE__ */ new Set();
    const ids = [];
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
  getHourlyTimeline(after, before) {
    let sql = `
      SELECT
        strftime('%Y-%m-%dT%H:00:00Z', timestamp) as hour,
        COUNT(*) as count,
        entity_type
      FROM events
    `;
    const conditions = [];
    const params = [];
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
    const rows = this.db.prepare(sql).all(...params);
    const timeline = /* @__PURE__ */ new Map();
    for (const row of rows) {
      if (!timeline.has(row.hour)) {
        timeline.set(row.hour, {
          timestamp: row.hour,
          count: 0,
          types: {}
        });
      }
      const entry = timeline.get(row.hour);
      entry.count += row.count;
      entry.types[row.entity_type] = row.count;
    }
    return Array.from(timeline.values());
  }
  /**
   * Get phase timeline showing duration of each phase
   */
  getPhaseTimeline() {
    const rows = this.db.prepare(`
      SELECT from_phase, to_phase, timestamp, triggered_by
      FROM phase_transitions
      ORDER BY timestamp ASC
    `).all();
    const timeline = [];
    let currentPhase = null;
    for (const row of rows) {
      if (currentPhase) {
        currentPhase.endedAt = row.timestamp;
        currentPhase.duration = new Date(row.timestamp).getTime() - new Date(currentPhase.startedAt).getTime();
        const count = this.db.prepare(`
          SELECT COUNT(DISTINCT entity_id) as count
          FROM events
          WHERE phase = ? AND timestamp >= ? AND timestamp < ?
        `).get(currentPhase.phase, currentPhase.startedAt, row.timestamp);
        currentPhase.entityCount = count.count;
        timeline.push(currentPhase);
      }
      currentPhase = {
        phase: row.to_phase,
        startedAt: row.timestamp,
        entityCount: 0
      };
    }
    if (currentPhase) {
      const count = this.db.prepare(`
        SELECT COUNT(DISTINCT entity_id) as count
        FROM events
        WHERE phase = ? AND timestamp >= ?
      `).get(currentPhase.phase, currentPhase.startedAt);
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
  getStats() {
    const totalRow = this.db.prepare("SELECT COUNT(*) as count FROM events").get();
    const boundsRow = this.db.prepare(`
      SELECT MIN(timestamp) as oldest, MAX(timestamp) as newest
      FROM events
    `).get();
    const typeRows = this.db.prepare(`
      SELECT entity_type, COUNT(*) as count
      FROM events
      GROUP BY entity_type
    `).all();
    const phaseRows = this.db.prepare(`
      SELECT phase, COUNT(*) as count
      FROM events
      GROUP BY phase
    `).all();
    let avgEventsPerHour = 0;
    if (boundsRow.oldest && boundsRow.newest && totalRow.count > 0) {
      const hours = (new Date(boundsRow.newest).getTime() - new Date(boundsRow.oldest).getTime()) / (1e3 * 60 * 60);
      avgEventsPerHour = hours > 0 ? totalRow.count / hours : totalRow.count;
    }
    return {
      totalEvents: totalRow.count,
      oldestEvent: boundsRow.oldest,
      newestEvent: boundsRow.newest,
      eventsByType: Object.fromEntries(typeRows.map((r) => [r.entity_type, r.count])),
      eventsByPhase: Object.fromEntries(phaseRows.map((r) => [r.phase, r.count])),
      avgEventsPerHour
    };
  }
  /**
   * Get event count for a specific entity
   */
  getEntityEventCount(entityId) {
    const row = this.db.prepare("SELECT COUNT(*) as count FROM events WHERE entity_id = ?").get(entityId);
    return row.count;
  }
  /**
   * Get last event for an entity
   */
  getLastEvent(entityId) {
    const row = this.db.prepare(`
      SELECT entity_id, entity_type, timestamp, phase, agent, action
      FROM events
      WHERE entity_id = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `).get(entityId);
    if (!row)
      return null;
    return {
      id: row.entity_id,
      type: row.entity_type,
      timestamp: row.timestamp,
      phase: row.phase,
      agent: row.agent || void 0,
      action: row.action || void 0
    };
  }
  // ============================================================
  // CLEANUP
  // ============================================================
  /**
   * Close database connection
   */
  close() {
    this.db.close();
  }
};

// dist/search/unified-search.js
var UnifiedSearch = class {
  directIndex;
  ckSearch;
  graphIndex;
  temporalIndex;
  entityResolver;
  constructor(boardPath, entityResolver) {
    this.directIndex = new DirectIndex(boardPath);
    this.ckSearch = new CKSearch(boardPath);
    this.graphIndex = new GraphIndex(boardPath);
    this.temporalIndex = new TemporalIndex(boardPath);
    this.entityResolver = entityResolver;
  }
  // ============================================================
  // UNIFIED SEARCH
  // ============================================================
  /**
   * Perform a unified search across all layers
   */
  async search(query) {
    const startTime = Date.now();
    const layersUsed = [];
    const allResults = [];
    const mode = query.mode || (query.text ? "hybrid" : "direct");
    const limit = query.options?.limit || 10;
    if (this.shouldUseDirectIndex(query)) {
      const directFilters = this.buildDirectFilters(query);
      const directEntities = this.directIndex.query(directFilters);
      for (const entity of directEntities) {
        allResults.push({
          entity,
          entityType: this.getEntityType(entity),
          score: 1
          // Base score from direct index
        });
      }
      layersUsed.push("direct");
    }
    if (query.text && (mode === "lexical" || mode === "semantic" || mode === "hybrid")) {
      const ckOptions = {
        mode,
        // Already lexical, semantic, or hybrid from condition above
        limit: limit * 2,
        // Get more for fusion
        rerank: query.options?.rerank
      };
      const ckResults = await this.ckSearch.search(query.text, ckOptions);
      for (const ckResult of ckResults) {
        const existingIndex = allResults.findIndex((r) => this.getEntityId(r.entity) === ckResult.id);
        if (existingIndex >= 0) {
          allResults[existingIndex].score += ckResult.score;
          allResults[existingIndex].highlights = ckResult.highlights;
        } else {
          const entity = this.entityResolver(ckResult.id);
          if (entity) {
            allResults.push({
              entity,
              entityType: ckResult.entityType,
              score: ckResult.score,
              highlights: ckResult.highlights
            });
          }
        }
      }
      layersUsed.push("ck");
    }
    let related;
    if (query.graph?.from) {
      const traversalResult = this.graphIndex.traverse(query.graph.from, {
        direction: query.graph.direction,
        relation: query.graph.relation,
        maxDepth: query.graph.depth,
        limit: limit * 2
      });
      for (const nodeId of traversalResult.nodes) {
        const existingIndex = allResults.findIndex((r) => this.getEntityId(r.entity) === nodeId);
        if (existingIndex >= 0) {
          allResults[existingIndex].score += 0.5;
        } else {
          const entity = this.entityResolver(nodeId);
          if (entity) {
            allResults.push({
              entity,
              entityType: this.getEntityType(entity),
              score: 0.5
            });
          }
        }
      }
      if (query.options?.includeRelated) {
        related = traversalResult;
      }
      layersUsed.push("graph");
    }
    let timeline;
    if (query.filters?.timeRange || query.filters?.phases) {
      const temporalQuery = {
        after: query.filters.timeRange?.after,
        before: query.filters.timeRange?.before,
        types: query.filters.types,
        phases: query.filters.phases,
        limit: limit * 2
      };
      const temporalEntries = this.temporalIndex.query(temporalQuery);
      for (const entry of temporalEntries) {
        const existingIndex = allResults.findIndex((r) => this.getEntityId(r.entity) === entry.id);
        if (existingIndex >= 0) {
          const age = Date.now() - new Date(entry.timestamp).getTime();
          const recencyBoost = Math.max(0, 0.3 - age / (1e3 * 60 * 60));
          allResults[existingIndex].score += recencyBoost;
        }
      }
      if (query.options?.includeTimeline) {
        timeline = temporalEntries;
      }
      layersUsed.push("temporal");
    }
    allResults.sort((a, b) => b.score - a.score);
    let filtered = allResults;
    if (query.options?.minScore) {
      filtered = allResults.filter((r) => r.score >= query.options.minScore);
    }
    const offset = query.options?.offset || 0;
    const paginated = filtered.slice(offset, offset + limit);
    return {
      results: paginated,
      total: filtered.length,
      query_time_ms: Date.now() - startTime,
      search_mode: mode === "direct" ? "direct" : mode,
      searchLayers: layersUsed,
      related,
      timeline
    };
  }
  // ============================================================
  // SPECIALIZED SEARCHES
  // ============================================================
  /**
   * Find entities by ID (direct lookup)
   */
  findById(id) {
    return this.directIndex.get(id);
  }
  /**
   * Find entities by IDs
   */
  findByIds(ids) {
    return this.directIndex.getByIds(ids);
  }
  /**
   * Find entities by type
   */
  findByType(type) {
    return this.directIndex.getByType(type);
  }
  /**
   * Find entities by file
   */
  findByFile(path) {
    return this.directIndex.getByFile(path);
  }
  /**
   * Find entities by tag
   */
  findByTag(tag) {
    return this.directIndex.getByTag(tag);
  }
  /**
   * Find entities by agent
   */
  findByAgent(agent) {
    return this.directIndex.getByAgent(agent);
  }
  /**
   * Find related entities via graph
   */
  findRelated(id, options) {
    const result = this.graphIndex.traverse(id, options);
    const entities = result.nodes.map((nodeId) => this.entityResolver(nodeId)).filter((e) => e !== null);
    return { nodes: entities, edges: result.edges };
  }
  /**
   * Find shortest path between entities
   */
  findPath(fromId, toId, relation) {
    return this.graphIndex.findPath(fromId, toId, { relation });
  }
  /**
   * Find recent entities
   */
  findRecent(limit = 10, types) {
    const entries = this.temporalIndex.getRecent(limit, types);
    return entries.map((e) => this.entityResolver(e.id)).filter((e) => e !== null);
  }
  /**
   * Find entities in time range
   */
  findInTimeRange(after, before, types) {
    const entries = this.temporalIndex.getInRange(after, before, types);
    return entries.map((e) => this.entityResolver(e.id)).filter((e) => e !== null);
  }
  /**
   * Find entities from a specific phase
   */
  findByPhase(phase, types) {
    const entries = this.temporalIndex.getByPhase(phase, types);
    return entries.map((e) => this.entityResolver(e.id)).filter((e) => e !== null);
  }
  /**
   * Text search with hybrid mode
   */
  async textSearch(query, options) {
    const response = await this.search({
      text: query,
      mode: options?.mode || "hybrid",
      filters: { types: options?.types },
      options: { limit: options?.limit || 10 }
    });
    return response.results;
  }
  // ============================================================
  // INDEXING
  // ============================================================
  /**
   * Index an entity across all layers
   */
  async indexEntity(entity, type, phase, agent) {
    const id = this.getEntityId(entity);
    this.directIndex.index(entity, type);
    await this.ckSearch.index(entity, type);
    this.graphIndex.indexEntityRelationships({
      id,
      supports: "supports" in entity ? entity.supports : void 0,
      contradicts: "contradicts" in entity ? entity.contradicts : void 0,
      based_on: "based_on" in entity ? entity.based_on : void 0,
      depends_on: "depends_on" in entity ? entity.depends_on : void 0,
      affects: "affects" in entity ? entity.affects : void 0,
      references: "references" in entity ? entity.references : void 0,
      supersedes: "supersedes" in entity ? entity.supersedes : void 0,
      blocking_step: "blocking_step" in entity ? entity.blocking_step : void 0
    });
    const timestamp = this.getTimestamp(entity);
    this.temporalIndex.recordEvent(id, type, timestamp, phase, agent);
  }
  /**
   * Remove an entity from all indexes
   */
  async removeEntity(id) {
    this.directIndex.remove(id);
    await this.ckSearch.remove(id);
    this.graphIndex.removeNode(id);
    this.temporalIndex.removeEntity(id);
  }
  /**
   * Rebuild all indexes from entities
   */
  async rebuildIndexes(entities) {
    this.directIndex.clear();
    await this.ckSearch.clear();
    this.graphIndex.clear();
    this.temporalIndex.clear();
    for (const { entity, type, phase, agent } of entities) {
      await this.indexEntity(entity, type, phase, agent);
    }
  }
  /**
   * Record a phase transition
   */
  recordPhaseTransition(fromPhase, toPhase, triggeredBy) {
    this.temporalIndex.recordPhaseTransition(fromPhase, toPhase, (/* @__PURE__ */ new Date()).toISOString(), triggeredBy);
  }
  // ============================================================
  // STATISTICS
  // ============================================================
  /**
   * Get combined statistics from all indexes
   */
  getStats() {
    return {
      direct: this.directIndex.getStats(),
      ck: this.ckSearch.getStats(),
      graph: this.graphIndex.getStats(),
      temporal: this.temporalIndex.getStats()
    };
  }
  // ============================================================
  // HELPERS
  // ============================================================
  shouldUseDirectIndex(query) {
    return query.mode === "direct" || !query.text || !!(query.filters?.types || query.filters?.tags || query.filters?.files || query.filters?.agents);
  }
  buildDirectFilters(query) {
    return {
      types: query.filters?.types,
      tags: query.filters?.tags,
      files: query.filters?.files,
      agents: query.filters?.agents,
      confidence: query.filters?.confidence,
      createdAfter: query.filters?.timeRange?.after,
      createdBefore: query.filters?.timeRange?.before,
      limit: (query.options?.limit || 10) * 2
      // Get more for merging
    };
  }
  getEntityId(entity) {
    if ("id" in entity)
      return entity.id;
    throw new Error("Entity has no id");
  }
  getEntityType(entity) {
    const id = this.getEntityId(entity);
    if (id.startsWith("F-"))
      return "fact";
    if (id.startsWith("D-"))
      return "decision";
    if (id.startsWith("A-"))
      return "alert";
    if (id.startsWith("S-"))
      return "step";
    if (id.startsWith("C-"))
      return "constraint";
    return "fact";
  }
  getTimestamp(entity) {
    if ("discovered_at" in entity)
      return entity.discovered_at;
    if ("proposed_at" in entity)
      return entity.proposed_at;
    if ("raised_at" in entity)
      return entity.raised_at;
    if ("added_at" in entity)
      return entity.added_at;
    return (/* @__PURE__ */ new Date()).toISOString();
  }
  // ============================================================
  // CLEANUP
  // ============================================================
  /**
   * Close all database connections
   */
  close() {
    this.directIndex.close();
    this.graphIndex.close();
    this.temporalIndex.close();
  }
};

// dist/storage/board-storage.js
import { appendFileSync, existsSync as existsSync2, mkdirSync as mkdirSync5, readFileSync as readFileSync2, writeFileSync as writeFileSync2 } from "node:fs";
import { dirname, join as join5 } from "node:path";

// dist/types/core.js
var SNIPPET_STALENESS = {
  /** Minutes after which snippet shows "may be stale" warning */
  WARN_AFTER_MINUTES: 30,
  /** Minutes after which snippet shows "likely stale, verify before use" */
  STALE_AFTER_MINUTES: 120
};
function getSnippetStaleness(snippet) {
  const referenceTime = snippet.verified_at || snippet.added_at;
  const ageMinutes = (Date.now() - new Date(referenceTime).getTime()) / (1e3 * 60);
  if (ageMinutes >= SNIPPET_STALENESS.STALE_AFTER_MINUTES)
    return "stale";
  if (ageMinutes >= SNIPPET_STALENESS.WARN_AFTER_MINUTES)
    return "warn";
  return "fresh";
}
function formatSnippetWithStaleness(snippet) {
  const staleness = getSnippetStaleness(snippet);
  const ageMinutes = Math.round((Date.now() - new Date(snippet.verified_at || snippet.added_at).getTime()) / (1e3 * 60));
  let header = "";
  if (staleness === "warn") {
    header = `\u26A0\uFE0F SNIPPET MAY BE STALE (${ageMinutes}min old) - verify if critical
`;
  } else if (staleness === "stale") {
    header = `\u{1F534} SNIPPET LIKELY STALE (${ageMinutes}min old) - re-read file before using
`;
  }
  const sourceInfo = snippet.path ? `Source: ${snippet.path}${snippet.lines ? `#L${snippet.lines[0]}-${snippet.lines[1]}` : ""}
` : "";
  return `${header}${sourceInfo}Purpose: ${snippet.purpose}
---
${snippet.content}`;
}
function generateTaskId() {
  const now2 = /* @__PURE__ */ new Date();
  const pad = (n, len = 2) => n.toString().padStart(len, "0");
  return `${now2.getFullYear()}${pad(now2.getMonth() + 1)}${pad(now2.getDate())}-${pad(now2.getHours())}${pad(now2.getMinutes())}${pad(now2.getSeconds())}-${pad(now2.getMilliseconds(), 3)}`;
}
function now() {
  return (/* @__PURE__ */ new Date()).toISOString();
}

// dist/types/operations.js
var PERMISSIONS = {
  set_mission: ["orchestrator"],
  add_constraint: ["orchestrator", "scout"],
  add_fact: ["scout", "verifier", "executor"],
  update_fact: ["scout", "verifier", "executor"],
  verify_fact: ["verifier"],
  propose_decision: ["creative"],
  approve_decision: ["orchestrator"],
  reject_decision: ["orchestrator"],
  set_plan: ["orchestrator"],
  advance_step: ["executor"],
  complete_step: ["executor"],
  fail_step: ["executor"],
  decompose_step: ["executor"],
  update_status: ["orchestrator", "verifier", "executor"],
  raise_alert: ["orchestrator", "scout", "creative", "verifier", "executor"],
  resolve_alert: ["orchestrator", "verifier", "executor"],
  append_trail: ["orchestrator", "scout", "creative", "verifier", "executor"],
  add_snippet: ["orchestrator", "scout", "creative", "verifier", "executor"],
  update_snippet: ["orchestrator", "scout", "creative", "verifier", "executor"],
  verify_snippet: ["orchestrator", "scout", "creative", "verifier", "executor"]
};
function canPerform(agent, operation) {
  return PERMISSIONS[operation]?.includes(agent) ?? false;
}

// dist/storage/board-storage.js
var SCHEMA_VERSION = "2.0";
var BoardStorage = class {
  boardPath;
  auditPath;
  /**
   * @param boardPath Absolute (or project-relative) path to a specific task board directory.
   *        Expected layout: <project>/.dev_partner/tasks/<task_id>/
   *
  * This storage layer does not support the older single-board layout
  * (a single shared board directory under .dev_partner).
   */
  constructor(boardPath) {
    this.boardPath = boardPath;
    this.auditPath = join5(dirname(dirname(boardPath)), "audit");
  }
  // ============================================================
  // INITIALIZATION
  // ============================================================
  /**
   * Check if a board exists
   */
  exists() {
    return existsSync2(join5(this.boardPath, "meta.json"));
  }
  /**
   * Create a new board
   * @param taskId Optional task ID (generated if not provided)
   */
  create(goal, context, constraints, taskId) {
    if (this.exists()) {
      throw new Error("Board already exists. Archive or delete existing board first.");
    }
    const task_id = taskId || generateTaskId();
    mkdirSync5(this.boardPath, { recursive: true });
    mkdirSync5(join5(this.boardPath, ".index"), { recursive: true });
    mkdirSync5(this.auditPath, { recursive: true });
    const meta = {
      schema_version: SCHEMA_VERSION,
      task_id,
      created_at: now(),
      updated_at: now(),
      phase: "setup",
      classification: "standard",
      sequences: { fact: 0, decision: 0, alert: 0, step: 0, constraint: 0, snippet: 0 }
    };
    this.writeMeta(meta);
    const mission = {
      goal,
      constraints: (constraints || []).map((c, i) => ({
        id: `C-${i + 1}`,
        description: c,
        source: "user",
        added_by: "orchestrator",
        added_at: now()
      })),
      definition_of_done: [],
      context: context || "",
      routing: {
        task_type: "feature",
        risk_level: "medium",
        scope: "module"
      }
    };
    if (constraints && constraints.length > 0) {
      meta.sequences.constraint = constraints.length;
      this.writeMeta(meta);
    }
    this.writeMission(mission);
    const status = {
      phase: "setup",
      current_step: 0,
      total_steps: 0,
      progress: {
        exploration: "pending",
        ideation: "pending",
        planning: "pending",
        plan_verification: "pending",
        execution: "pending",
        result_verification: "pending"
      },
      verification: {
        plan_passes: 0,
        result_passes: 0
      },
      last_action: {
        agent: "orchestrator",
        action: "board.create",
        at: now()
      },
      updated_at: now()
    };
    this.writeStatus(status);
    writeFileSync2(join5(this.boardPath, "facts.jsonl"), "");
    writeFileSync2(join5(this.boardPath, "decisions.jsonl"), "");
    writeFileSync2(join5(this.boardPath, "alerts.jsonl"), "");
    writeFileSync2(join5(this.boardPath, "snippets.jsonl"), "");
    writeFileSync2(join5(this.auditPath, `${task_id}.jsonl`), "");
    this.appendAudit({
      id: crypto.randomUUID(),
      timestamp: now(),
      agent: "orchestrator",
      action: "board.create",
      target: { type: "mission" },
      change: { operation: "create", after: mission }
    });
    return { task_id, board_path: this.boardPath };
  }
  // ============================================================
  // READ OPERATIONS
  // ============================================================
  /**
   * Read the complete board state
   */
  getBoard() {
    return {
      meta: this.getMeta(),
      mission: this.getMission(),
      facts: this.getFacts(),
      decisions: this.getDecisions(),
      plan: this.getPlan(),
      status: this.getStatus(),
      alerts: this.getAlerts(),
      snippets: this.getSnippets()
    };
  }
  /**
   * Read board metadata
   */
  getMeta() {
    return this.readJson("meta.json");
  }
  /**
   * Read mission
   */
  getMission() {
    return this.readJson("mission.json");
  }
  /**
   * Read all facts
   */
  getFacts() {
    return this.readJsonl("facts.jsonl");
  }
  /**
   * Read a single fact by ID
   */
  getFact(id) {
    const facts = this.getFacts();
    return facts.find((f) => f.id === id) || null;
  }
  /**
   * Read all decisions
   */
  getDecisions() {
    return this.readJsonl("decisions.jsonl");
  }
  /**
   * Read a single decision by ID
   */
  getDecision(id) {
    const decisions = this.getDecisions();
    return decisions.find((d) => d.id === id) || null;
  }
  /**
   * Read the plan (may not exist)
   */
  getPlan() {
    const path = join5(this.boardPath, "plan.json");
    if (!existsSync2(path))
      return null;
    return this.readJson("plan.json");
  }
  /**
   * Read status
   */
  getStatus() {
    return this.readJson("status.json");
  }
  /**
   * Read all alerts
   */
  getAlerts() {
    return this.readJsonl("alerts.jsonl");
  }
  /**
   * Read a single alert by ID
   */
  getAlert(id) {
    const alerts = this.getAlerts();
    return alerts.find((a) => a.id === id) || null;
  }
  /**
   * Read all snippets
   */
  getSnippets() {
    const path = join5(this.boardPath, "snippets.jsonl");
    if (!existsSync2(path))
      return [];
    return this.readJsonl("snippets.jsonl");
  }
  /**
   * Read a single snippet by ID
   */
  getSnippet(id) {
    const snippets = this.getSnippets();
    return snippets.find((s) => s.id === id) || null;
  }
  // ============================================================
  // WRITE OPERATIONS
  // ============================================================
  /**
   * Write board metadata
   */
  writeMeta(meta) {
    meta.updated_at = now();
    this.writeJson("meta.json", meta);
  }
  /**
   * Write mission
   */
  writeMission(mission) {
    this.writeJson("mission.json", mission);
    this.updateMeta({ updated_at: now() });
  }
  /**
   * Add a constraint to the mission
   */
  addConstraint(constraint) {
    const meta = this.getMeta();
    const id = `C-${++meta.sequences.constraint}`;
    const fullConstraint = { ...constraint, id };
    const mission = this.getMission();
    mission.constraints.push(fullConstraint);
    this.writeMission(mission);
    this.writeMeta(meta);
    return fullConstraint;
  }
  /**
   * Append a fact
   */
  appendFact(fact) {
    const meta = this.getMeta();
    const id = `F-${++meta.sequences.fact}`;
    const fullFact = { ...fact, id };
    this.appendJsonl("facts.jsonl", fullFact);
    this.writeMeta(meta);
    return fullFact;
  }
  /**
   * Update a fact (rewrite the entire JSONL file)
   */
  updateFact(id, updates) {
    const facts = this.getFacts();
    const index = facts.findIndex((f) => f.id === id);
    if (index === -1) {
      throw new Error(`Fact ${id} not found`);
    }
    const updated = { ...facts[index], ...updates };
    facts[index] = updated;
    this.rewriteJsonl("facts.jsonl", facts);
    this.updateMeta({ updated_at: now() });
    return updated;
  }
  /**
   * Append a decision
   */
  appendDecision(decision) {
    const meta = this.getMeta();
    const id = `D-${++meta.sequences.decision}`;
    const fullDecision = { ...decision, id };
    this.appendJsonl("decisions.jsonl", fullDecision);
    this.writeMeta(meta);
    return fullDecision;
  }
  /**
   * Update a decision
   */
  updateDecision(id, updates) {
    const decisions = this.getDecisions();
    const index = decisions.findIndex((d) => d.id === id);
    if (index === -1) {
      throw new Error(`Decision ${id} not found`);
    }
    const updated = { ...decisions[index], ...updates };
    decisions[index] = updated;
    this.rewriteJsonl("decisions.jsonl", decisions);
    this.updateMeta({ updated_at: now() });
    return updated;
  }
  /**
   * Write plan
   */
  writePlan(plan) {
    const meta = this.getMeta();
    for (const step of plan.steps) {
      if (!step.id) {
        step.id = `S-${++meta.sequences.step}`;
      }
    }
    this.writeJson("plan.json", plan);
    this.writeMeta(meta);
    const status = this.getStatus();
    status.total_steps = plan.steps.length;
    this.writeStatus(status);
  }
  /**
   * Write status
   */
  writeStatus(status) {
    status.updated_at = now();
    this.writeJson("status.json", status);
  }
  /**
   * Update status partially
   */
  updateStatus(updates) {
    const status = this.getStatus();
    const updated = { ...status, ...updates, updated_at: now() };
    this.writeStatus(updated);
    return updated;
  }
  /**
   * Append an alert
   */
  appendAlert(alert) {
    const meta = this.getMeta();
    const id = `A-${++meta.sequences.alert}`;
    const fullAlert = { ...alert, id };
    this.appendJsonl("alerts.jsonl", fullAlert);
    this.writeMeta(meta);
    return fullAlert;
  }
  /**
   * Update an alert
   */
  updateAlert(id, updates) {
    const alerts = this.getAlerts();
    const index = alerts.findIndex((a) => a.id === id);
    if (index === -1) {
      throw new Error(`Alert ${id} not found`);
    }
    const updated = { ...alerts[index], ...updates };
    alerts[index] = updated;
    this.rewriteJsonl("alerts.jsonl", alerts);
    this.updateMeta({ updated_at: now() });
    return updated;
  }
  /**
   * Append a snippet
   */
  appendSnippet(snippet) {
    const meta = this.getMeta();
    const id = `X-${++meta.sequences.snippet}`;
    const fullSnippet = { ...snippet, id };
    this.appendJsonl("snippets.jsonl", fullSnippet);
    this.writeMeta(meta);
    return fullSnippet;
  }
  /**
   * Update a snippet
   */
  updateSnippet(id, updates) {
    const snippets = this.getSnippets();
    const index = snippets.findIndex((s) => s.id === id);
    if (index === -1) {
      throw new Error(`Snippet ${id} not found`);
    }
    const updated = { ...snippets[index], ...updates };
    snippets[index] = updated;
    this.rewriteJsonl("snippets.jsonl", snippets);
    this.updateMeta({ updated_at: now() });
    return updated;
  }
  /**
   * Delete a snippet by ID
   */
  deleteSnippet(id) {
    const snippets = this.getSnippets();
    const index = snippets.findIndex((s) => s.id === id);
    if (index === -1) {
      return false;
    }
    snippets.splice(index, 1);
    this.rewriteJsonl("snippets.jsonl", snippets);
    this.updateMeta({ updated_at: now() });
    return true;
  }
  /**
   * Delete multiple snippets by IDs
   * @returns Number of snippets deleted
   */
  deleteSnippets(ids) {
    const snippets = this.getSnippets();
    const idSet = new Set(ids);
    const filtered = snippets.filter((s) => !idSet.has(s.id));
    const deletedCount = snippets.length - filtered.length;
    if (deletedCount > 0) {
      this.rewriteJsonl("snippets.jsonl", filtered);
      this.updateMeta({ updated_at: now() });
    }
    return deletedCount;
  }
  /**
   * Update phase
   */
  setPhase(phase) {
    const meta = this.getMeta();
    meta.phase = phase;
    this.writeMeta(meta);
    const status = this.getStatus();
    status.phase = phase;
    this.writeStatus(status);
  }
  // ============================================================
  // AUDIT LOG
  // ============================================================
  /**
   * Append to audit log
   */
  appendAudit(entry) {
    const meta = this.getMeta();
    const auditFile = join5(this.auditPath, `${meta.task_id}.jsonl`);
    appendFileSync(auditFile, JSON.stringify(entry) + "\n");
  }
  /**
   * Read audit log
   */
  getAuditLog() {
    const meta = this.getMeta();
    const auditFile = join5(this.auditPath, `${meta.task_id}.jsonl`);
    if (!existsSync2(auditFile))
      return [];
    return this.readJsonlFile(auditFile);
  }
  // ============================================================
  // HELPERS
  // ============================================================
  readJson(filename) {
    const path = join5(this.boardPath, filename);
    const content = readFileSync2(path, "utf-8");
    return JSON.parse(content);
  }
  writeJson(filename, data) {
    const path = join5(this.boardPath, filename);
    mkdirSync5(dirname(path), { recursive: true });
    writeFileSync2(path, JSON.stringify(data, null, 2));
  }
  readJsonl(filename) {
    const path = join5(this.boardPath, filename);
    return this.readJsonlFile(path);
  }
  readJsonlFile(path) {
    if (!existsSync2(path))
      return [];
    const content = readFileSync2(path, "utf-8").trim();
    if (!content)
      return [];
    return content.split("\n").map((line) => JSON.parse(line));
  }
  appendJsonl(filename, data) {
    const path = join5(this.boardPath, filename);
    appendFileSync(path, JSON.stringify(data) + "\n");
  }
  rewriteJsonl(filename, data) {
    const path = join5(this.boardPath, filename);
    const content = data.map((d) => JSON.stringify(d)).join("\n") + (data.length > 0 ? "\n" : "");
    writeFileSync2(path, content);
  }
  updateMeta(updates) {
    const meta = this.getMeta();
    const updated = { ...meta, ...updates };
    this.writeMeta(updated);
  }
  /**
   * Get the board path
   */
  getBoardPath() {
    return this.boardPath;
  }
};

// dist/board.js
var Board = class {
  storage;
  index;
  graphIndex;
  temporalIndex;
  unifiedSearch;
  trailsPath;
  trailSequence = 0;
  /**
   * Create a Board instance.
   * @param boardPath - Path to a specific task board directory
   *                  (expected: <project>/.dev_partner/tasks/<task_id>/)
   */
  constructor(boardPath) {
    this.storage = new BoardStorage(boardPath);
    const resolvedBoardPath = this.storage.getBoardPath();
    this.index = new DirectIndex(resolvedBoardPath);
    this.graphIndex = new GraphIndex(resolvedBoardPath);
    this.temporalIndex = new TemporalIndex(resolvedBoardPath);
    this.unifiedSearch = new UnifiedSearch(resolvedBoardPath, (id) => this.getEntity(id));
    this.trailsPath = join6(resolvedBoardPath, "trails.jsonl");
    if (existsSync3(this.trailsPath)) {
      const lines = readFileSync3(this.trailsPath, "utf-8").trim().split("\n").filter(Boolean);
      this.trailSequence = lines.length;
    }
  }
  // ============================================================
  // LIFECYCLE
  // ============================================================
  /**
   * Check if a board exists
   */
  exists() {
    return this.storage.exists();
  }
  /**
   * Create a new board
   */
  create(request) {
    const result = this.storage.create(request.goal, request.context, request.constraints, request.taskId);
    const mission = this.storage.getMission();
    for (const constraint of mission.constraints) {
      this.index.index(constraint, "constraint");
    }
    return result;
  }
  /**
   * Rebuild all indexes from storage
   */
  rebuildIndexes() {
    this.index.clear();
    for (const fact of this.storage.getFacts()) {
      this.index.index(fact, "fact");
    }
    for (const decision of this.storage.getDecisions()) {
      this.index.index(decision, "decision");
    }
    for (const alert of this.storage.getAlerts()) {
      this.index.index(alert, "alert");
    }
    for (const constraint of this.storage.getMission().constraints) {
      this.index.index(constraint, "constraint");
    }
    const plan = this.storage.getPlan();
    if (plan) {
      for (const step of plan.steps) {
        this.index.index(step, "step");
      }
    }
  }
  // ============================================================
  // READ OPERATIONS
  // ============================================================
  /**
   * Get complete board state
   */
  getBoard() {
    return this.storage.getBoard();
  }
  /**
   * Get task ID
   */
  getTaskId() {
    return this.storage.getMeta().task_id;
  }
  /**
   * Get mission
   */
  getMission() {
    return this.storage.getMission();
  }
  /**
   * Get facts with optional filter
   */
  getFacts(filter) {
    let facts = this.storage.getFacts();
    if (filter) {
      if (filter.confidence) {
        facts = facts.filter((f) => filter.confidence.includes(f.confidence));
      }
      if (filter.tags && filter.tags.length > 0) {
        facts = facts.filter((f) => filter.tags.every((t) => f.tags.includes(t)));
      }
      if (filter.source) {
        facts = facts.filter((f) => filter.source.includes(f.source));
      }
      if (filter.verified !== void 0) {
        facts = facts.filter((f) => filter.verified ? f.verified_at !== void 0 : f.verified_at === void 0);
      }
    }
    return facts;
  }
  /**
   * Get single fact by ID
   */
  getFact(id) {
    return this.storage.getFact(id);
  }
  /**
   * Get decisions with optional filter
   */
  getDecisions(filter) {
    let decisions = this.storage.getDecisions();
    if (filter) {
      if (filter.status) {
        decisions = decisions.filter((d) => filter.status.includes(d.status));
      }
      if (filter.tags && filter.tags.length > 0) {
        decisions = decisions.filter((d) => filter.tags.every((t) => d.tags.includes(t)));
      }
    }
    return decisions;
  }
  /**
   * Get single decision by ID
   */
  getDecision(id) {
    return this.storage.getDecision(id);
  }
  /**
   * Get plan
   */
  getPlan() {
    return this.storage.getPlan();
  }
  /**
   * Get status
   */
  getStatus() {
    return this.storage.getStatus();
  }
  /**
   * Get alerts with optional filter
   */
  getAlerts(filter) {
    let alerts = this.storage.getAlerts();
    if (filter) {
      if (filter.severity) {
        alerts = alerts.filter((a) => filter.severity.includes(a.severity));
      }
      if (filter.resolved !== void 0) {
        alerts = alerts.filter((a) => a.resolved === filter.resolved);
      }
      if (filter.tags && filter.tags.length > 0) {
        alerts = alerts.filter((a) => filter.tags.every((t) => a.tags.includes(t)));
      }
    }
    return alerts;
  }
  /**
   * Get single alert by ID
   */
  getAlert(id) {
    return this.storage.getAlert(id);
  }
  /**
   * Get entity by ID (any type)
   */
  getEntity(id) {
    return this.index.get(id);
  }
  /**
   * Get snippets with optional filter
   * @param filter - Optional filter options
   * @param filter.tags - Filter by tags (all must match)
   * @param filter.path - Filter by source path (substring match)
   * @param filter.staleness - Filter by staleness: "fresh" | "warn" | "stale" | "all"
   * @param filter.include_staleness_header - Include staleness header in formatted output
   * @param filter.evict_stale - Auto-evict stale snippets in background (default: true)
   */
  getSnippets(filter) {
    const shouldEvict = filter?.evict_stale !== false;
    if (shouldEvict) {
      setImmediate(() => this.evictStaleSnippets());
    }
    let snippets = this.storage.getSnippets();
    if (filter) {
      if (filter.tags && filter.tags.length > 0) {
        snippets = snippets.filter((s) => filter.tags.every((t) => s.tags.includes(t)));
      }
      if (filter.path) {
        snippets = snippets.filter((s) => s.path?.includes(filter.path));
      }
      if (filter.staleness && filter.staleness !== "all") {
        snippets = snippets.filter((s) => getSnippetStaleness(s) === filter.staleness);
      }
    }
    return snippets;
  }
  /**
   * Evict (delete) all stale snippets (>120min old)
   * @returns Number of snippets evicted
   */
  evictStaleSnippets() {
    const snippets = this.storage.getSnippets();
    const staleIds = snippets.filter((s) => getSnippetStaleness(s) === "stale").map((s) => s.id);
    if (staleIds.length === 0) {
      return 0;
    }
    const deletedCount = this.storage.deleteSnippets(staleIds);
    this.audit("orchestrator", "snippet.evict", { type: "snippet" }, {
      operation: "delete",
      after: { evicted_count: deletedCount, evicted_ids: staleIds }
    });
    return deletedCount;
  }
  /**
   * Get single snippet by ID
   */
  getSnippet(id) {
    return this.storage.getSnippet(id);
  }
  /**
   * Get snippet with staleness-aware formatting
   * Returns the snippet content with staleness header if applicable
   */
  getSnippetFormatted(id) {
    const snippet = this.storage.getSnippet(id);
    if (!snippet)
      return null;
    return formatSnippetWithStaleness(snippet);
  }
  /**
   * Get all snippets formatted with staleness headers
   */
  getSnippetsFormatted(filter) {
    const snippets = this.getSnippets(filter);
    return snippets.map((s) => ({
      id: s.id,
      formatted: formatSnippetWithStaleness(s),
      staleness: getSnippetStaleness(s)
    }));
  }
  // ============================================================
  // WRITE OPERATIONS
  // ============================================================
  /**
   * Check if agent can perform operation
   */
  canPerform(agent, operation) {
    return canPerform(agent, operation);
  }
  /**
   * Assert agent can perform operation
   */
  assertPermission(agent, operation) {
    if (!this.canPerform(agent, operation)) {
      throw new Error(`Agent '${agent}' is not permitted to perform '${operation}'. Allowed agents: ${PERMISSIONS[operation].join(", ")}`);
    }
  }
  /**
   * Set mission (orchestrator only)
   */
  setMission(agent, request) {
    this.assertPermission(agent, "set_mission");
    const currentMission = this.storage.getMission();
    const mission = {
      goal: request.goal,
      constraints: currentMission.constraints,
      definition_of_done: request.definition_of_done || currentMission.definition_of_done,
      context: request.context || currentMission.context,
      routing: {
        ...currentMission.routing,
        ...request.routing
      }
    };
    this.storage.writeMission(mission);
    this.audit(agent, "mission.set", { type: "mission" }, { operation: "update", after: mission });
    return mission;
  }
  /**
   * Add constraint
   */
  addConstraint(agent, request) {
    this.assertPermission(agent, "add_constraint");
    const constraint = this.storage.addConstraint({
      description: request.description,
      source: request.source || "discovered",
      added_by: agent,
      added_at: now()
    });
    this.index.index(constraint, "constraint");
    this.audit(agent, "constraint.add", { type: "mission", id: constraint.id }, {
      operation: "create",
      after: constraint
    });
    return constraint;
  }
  /**
   * Add fact
   */
  addFact(agent, request) {
    this.assertPermission(agent, "add_fact");
    const fact = this.storage.appendFact({
      content: request.content,
      confidence: request.confidence,
      evidence: request.evidence,
      source: agent,
      discovered_at: now(),
      supports: request.supports,
      contradicts: request.contradicts,
      tags: request.tags || []
    });
    this.index.index(fact, "fact");
    this.indexInGraphAndTemporal(fact, "fact", agent);
    this.audit(agent, "fact.add", { type: "fact", id: fact.id }, {
      operation: "create",
      after: fact
    });
    return fact;
  }
  /**
   * Update fact
   */
  updateFact(agent, request) {
    this.assertPermission(agent, "update_fact");
    const before = this.storage.getFact(request.id);
    if (!before)
      throw new Error(`Fact ${request.id} not found`);
    const fact = this.storage.updateFact(request.id, {
      content: request.content,
      confidence: request.confidence,
      evidence: request.evidence,
      tags: request.tags,
      supports: request.supports,
      contradicts: request.contradicts
    });
    this.index.index(fact, "fact");
    this.audit(agent, "fact.update", { type: "fact", id: fact.id }, {
      operation: "update",
      before,
      after: fact
    });
    return fact;
  }
  /**
   * Verify fact
   */
  verifyFact(agent, request) {
    this.assertPermission(agent, "verify_fact");
    const before = this.storage.getFact(request.id);
    if (!before)
      throw new Error(`Fact ${request.id} not found`);
    const updates = {
      verified_at: now(),
      verified_by: agent
    };
    if (request.confidence) {
      updates.confidence = request.confidence;
    }
    const fact = this.storage.updateFact(request.id, updates);
    this.index.index(fact, "fact");
    this.audit(agent, "fact.verify", { type: "fact", id: fact.id }, {
      operation: "update",
      before,
      after: fact
    });
    return fact;
  }
  /**
   * Propose decision
   */
  proposeDecision(agent, request) {
    this.assertPermission(agent, "propose_decision");
    const decision = this.storage.appendDecision({
      title: request.title,
      description: request.description,
      rationale: request.rationale,
      status: "proposed",
      alternatives: request.alternatives || [],
      proposed_by: agent,
      proposed_at: now(),
      based_on: request.based_on || [],
      affects: [],
      tags: request.tags || []
    });
    this.index.index(decision, "decision");
    this.indexInGraphAndTemporal(decision, "decision", agent);
    this.audit(agent, "decision.propose", { type: "decision", id: decision.id }, {
      operation: "create",
      after: decision
    });
    return decision;
  }
  /**
   * Approve decision
   */
  approveDecision(agent, request) {
    this.assertPermission(agent, "approve_decision");
    const before = this.storage.getDecision(request.id);
    if (!before)
      throw new Error(`Decision ${request.id} not found`);
    if (before.status !== "proposed") {
      throw new Error(`Decision ${request.id} is not in 'proposed' status`);
    }
    const decision = this.storage.updateDecision(request.id, {
      status: "approved",
      approved_by: agent,
      approved_at: now(),
      affects: request.affects
    });
    this.index.index(decision, "decision");
    this.audit(agent, "decision.approve", { type: "decision", id: decision.id }, {
      operation: "update",
      before,
      after: decision
    });
    return decision;
  }
  /**
   * Reject decision
   */
  rejectDecision(agent, request) {
    this.assertPermission(agent, "reject_decision");
    const before = this.storage.getDecision(request.id);
    if (!before)
      throw new Error(`Decision ${request.id} not found`);
    const alternatives = [...before.alternatives];
    alternatives.push({
      name: before.title,
      description: before.description,
      pros: [],
      cons: [],
      rejected_reason: request.reason
    });
    const decision = this.storage.updateDecision(request.id, {
      status: "rejected",
      alternatives
    });
    this.index.index(decision, "decision");
    this.audit(agent, "decision.reject", { type: "decision", id: decision.id }, {
      operation: "update",
      before,
      after: decision
    });
    return decision;
  }
  /**
   * Set plan
   */
  setPlan(agent, request) {
    this.assertPermission(agent, "set_plan");
    const plan = {
      goal: request.goal,
      approach: request.approach,
      steps: request.steps.map((s, i) => ({
        id: `S-${i + 1}`,
        number: i + 1,
        action: s.action,
        files: s.files,
        depends_on: (s.depends_on || []).map((n) => `S-${n}`),
        verification: s.verification,
        status: "pending"
      })),
      current_step: 0,
      created_at: now(),
      updated_at: now()
    };
    this.storage.writePlan(plan);
    for (const step of plan.steps) {
      this.index.index(step, "step");
    }
    this.audit(agent, "plan.set", { type: "plan" }, { operation: "create", after: plan });
    const status = this.storage.getStatus();
    status.progress.planning = "complete";
    status.total_steps = plan.steps.length;
    this.storage.writeStatus(status);
    return plan;
  }
  /**
   * Advance to next step
   */
  advanceStep(agent) {
    this.assertPermission(agent, "advance_step");
    const plan = this.storage.getPlan();
    if (!plan)
      throw new Error("No plan exists");
    if (plan.current_step >= plan.steps.length - 1) {
      return null;
    }
    plan.current_step++;
    plan.steps[plan.current_step].status = "in_progress";
    plan.updated_at = now();
    this.storage.writePlan(plan);
    this.index.index(plan.steps[plan.current_step], "step");
    const status = this.storage.getStatus();
    status.current_step = plan.current_step;
    status.progress.execution = "in_progress";
    this.storage.writeStatus(status);
    this.audit(agent, "plan.advance", { type: "plan" }, {
      operation: "update",
      after: { current_step: plan.current_step }
    });
    return plan.steps[plan.current_step];
  }
  /**
   * Complete current step
   */
  completeStep(agent, request) {
    this.assertPermission(agent, "complete_step");
    const plan = this.storage.getPlan();
    if (!plan)
      throw new Error("No plan exists");
    const step = plan.steps[plan.current_step];
    step.status = "complete";
    step.completed_at = now();
    step.result = request.result;
    plan.updated_at = now();
    this.storage.writePlan(plan);
    this.index.index(step, "step");
    this.audit(agent, "step.complete", { type: "plan", id: step.id }, {
      operation: "update",
      after: step
    });
    const allComplete = plan.steps.every((s) => s.status === "complete" || s.status === "skipped");
    if (allComplete) {
      const status = this.storage.getStatus();
      status.progress.execution = "complete";
      this.storage.writeStatus(status);
    }
    return step;
  }
  /**
   * Fail current step
   */
  failStep(agent, request) {
    this.assertPermission(agent, "fail_step");
    const plan = this.storage.getPlan();
    if (!plan)
      throw new Error("No plan exists");
    const step = plan.steps[plan.current_step];
    step.status = "failed";
    step.result = {
      files_changed: [],
      files_created: [],
      verification_passed: false,
      notes: request.reason
    };
    plan.updated_at = now();
    this.storage.writePlan(plan);
    this.index.index(step, "step");
    this.audit(agent, "step.fail", { type: "plan", id: step.id }, {
      operation: "update",
      after: step
    });
    const status = this.storage.getStatus();
    status.progress.execution = "blocked";
    status.phase = "blocked";
    this.storage.writeStatus(status);
    this.storage.setPhase("blocked");
    return step;
  }
  /**
   * Decompose a step into subtasks
   */
  decomposeStep(agent, stepId, subtasks) {
    this.assertPermission(agent, "decompose_step");
    const plan = this.storage.getPlan();
    if (!plan)
      throw new Error("No plan exists");
    const stepIndex = plan.steps.findIndex((s) => s.id === stepId);
    if (stepIndex === -1)
      throw new Error(`Step ${stepId} not found`);
    const step = plan.steps[stepIndex];
    step.subtasks = subtasks.map((action, i) => ({
      id: `${stepId}.${i + 1}`,
      action,
      status: "pending"
    }));
    plan.updated_at = now();
    this.storage.writePlan(plan);
    this.index.index(step, "step");
    this.audit(agent, "step.complete", { type: "plan", id: step.id }, {
      operation: "update",
      after: { subtasks: step.subtasks }
    });
    return step;
  }
  /**
   * Complete a subtask within a step
   */
  completeSubtask(agent, stepId, subtaskIndex) {
    this.assertPermission(agent, "complete_step");
    const plan = this.storage.getPlan();
    if (!plan)
      throw new Error("No plan exists");
    const stepIndex = plan.steps.findIndex((s) => s.id === stepId);
    if (stepIndex === -1)
      throw new Error(`Step ${stepId} not found`);
    const step = plan.steps[stepIndex];
    if (!step.subtasks || subtaskIndex >= step.subtasks.length) {
      throw new Error(`Subtask ${subtaskIndex} not found in step ${stepId}`);
    }
    step.subtasks[subtaskIndex].status = "complete";
    step.subtasks[subtaskIndex].completed_at = now();
    const allSubtasksComplete = step.subtasks.every((st) => st.status === "complete");
    if (allSubtasksComplete) {
      step.status = "complete";
      step.completed_at = now();
    }
    plan.updated_at = now();
    this.storage.writePlan(plan);
    this.index.index(step, "step");
    return step;
  }
  /**
   * Update status
   */
  updateStatus(agent, request) {
    this.assertPermission(agent, "update_status");
    const before = this.storage.getStatus();
    const status = this.storage.updateStatus({
      phase: request.phase,
      verification: request.verification ? {
        ...before.verification,
        ...request.verification,
        plan_passes: request.verification.plan_verdict ? before.verification.plan_passes + 1 : before.verification.plan_passes,
        result_passes: request.verification.result_verdict ? before.verification.result_passes + 1 : before.verification.result_passes
      } : before.verification,
      last_action: {
        agent,
        action: "update_status",
        at: now()
      }
    });
    if (request.classification) {
      const meta = this.storage.getMeta();
      meta.classification = request.classification;
      this.storage.writeMeta(meta);
    }
    if (request.phase) {
      this.storage.setPhase(request.phase);
    }
    this.audit(agent, "status.update", { type: "status" }, {
      operation: "update",
      before,
      after: status
    });
    return status;
  }
  /**
   * Raise alert
   */
  raiseAlert(agent, request) {
    this.assertPermission(agent, "raise_alert");
    const alert = this.storage.appendAlert({
      severity: request.severity,
      title: request.title,
      description: request.description,
      raised_by: agent,
      raised_at: now(),
      resolved: false,
      references: request.references || [],
      blocking_step: request.blocking_step,
      tags: request.tags || []
    });
    this.index.index(alert, "alert");
    this.indexInGraphAndTemporal(alert, "alert", agent);
    this.audit(agent, "alert.raise", { type: "alert", id: alert.id }, {
      operation: "create",
      after: alert
    });
    if (request.severity === "blocker") {
      this.storage.setPhase("blocked");
    }
    return alert;
  }
  /**
   * Resolve alert
   */
  resolveAlert(agent, request) {
    this.assertPermission(agent, "resolve_alert");
    const before = this.storage.getAlert(request.id);
    if (!before)
      throw new Error(`Alert ${request.id} not found`);
    const alert = this.storage.updateAlert(request.id, {
      resolved: true,
      resolved_by: agent,
      resolved_at: now(),
      resolution: request.resolution
    });
    this.index.index(alert, "alert");
    this.audit(agent, "alert.resolve", { type: "alert", id: alert.id }, {
      operation: "update",
      before,
      after: alert
    });
    if (before.severity === "blocker") {
      const unresolvedBlockers = this.getAlerts({ severity: ["blocker"], resolved: false });
      if (unresolvedBlockers.length === 0) {
        const status = this.storage.getStatus();
        if (status.phase === "blocked") {
          this.storage.setPhase("execution");
        }
      }
    }
    return alert;
  }
  /**
   * Add snippet (all agents can add)
   */
  addSnippet(agent, request) {
    this.assertPermission(agent, "add_snippet");
    const snippet = this.storage.appendSnippet({
      path: request.path,
      lines: request.lines,
      content: request.content,
      purpose: request.purpose,
      added_by: agent,
      added_at: now(),
      linked_to: request.linked_to,
      tags: request.tags || []
    });
    this.index.index(snippet, "snippet");
    this.indexInGraphAndTemporal(snippet, "snippet", agent);
    this.audit(agent, "snippet.add", { type: "snippet", id: snippet.id }, {
      operation: "create",
      after: snippet
    });
    return snippet;
  }
  /**
   * Update snippet (all agents can update)
   */
  updateSnippet(agent, request) {
    this.assertPermission(agent, "update_snippet");
    const before = this.storage.getSnippet(request.id);
    if (!before)
      throw new Error(`Snippet ${request.id} not found`);
    const snippet = this.storage.updateSnippet(request.id, {
      content: request.content,
      purpose: request.purpose,
      linked_to: request.linked_to,
      tags: request.tags
    });
    this.index.index(snippet, "snippet");
    this.audit(agent, "snippet.update", { type: "snippet", id: snippet.id }, {
      operation: "update",
      before,
      after: snippet
    });
    return snippet;
  }
  /**
   * Verify snippet - marks as recently verified (resets staleness timer)
   * Optionally updates content if the file has changed
   */
  verifySnippet(agent, request) {
    this.assertPermission(agent, "verify_snippet");
    const before = this.storage.getSnippet(request.id);
    if (!before)
      throw new Error(`Snippet ${request.id} not found`);
    const updates = {
      verified_at: now()
    };
    if (request.content) {
      updates.content = request.content;
    }
    const snippet = this.storage.updateSnippet(request.id, updates);
    this.index.index(snippet, "snippet");
    this.audit(agent, "snippet.verify", { type: "snippet", id: snippet.id }, {
      operation: "update",
      before,
      after: snippet
    });
    return snippet;
  }
  // ============================================================
  // SEARCH (Direct Index)
  // ============================================================
  /**
   * Search using direct index
   */
  search(query) {
    const startTime = Date.now();
    const limit = query.options?.limit || 10;
    const filters = {
      types: query.filters?.types,
      agents: query.filters?.agents,
      confidence: query.filters?.confidence,
      tags: query.filters?.tags,
      files: query.filters?.files,
      createdAfter: query.filters?.timeRange?.after,
      createdBefore: query.filters?.timeRange?.before,
      limit,
      offset: query.options?.offset
    };
    let results;
    if (query.text) {
      const ftsResults = this.index.ftsSearch(query.text, {
        types: query.filters?.types,
        limit: limit * 2
        // over-fetch to allow post-filtering
      });
      if (ftsResults.length > 0) {
        results = ftsResults.map((r) => ({
          entity: r.entity,
          entityType: r.entityType,
          score: r.score
        }));
      } else {
        const allEntities = this.index.query(filters);
        const textLower = query.text.toLowerCase();
        results = allEntities.filter((entity) => {
          const content = this.getSearchableContent(entity);
          return content.toLowerCase().includes(textLower);
        }).map((entity) => ({
          entity,
          entityType: this.getEntityTypeFromEntity(entity),
          score: 1,
          highlights: []
        }));
      }
    } else {
      results = this.index.query(filters).map((entity) => ({
        entity,
        entityType: this.getEntityTypeFromEntity(entity),
        score: 1
      }));
    }
    return {
      results: results.slice(0, limit),
      total: results.length,
      query_time_ms: Date.now() - startTime,
      search_mode: query.text ? "fts" : "direct"
    };
  }
  getSearchableContent(entity) {
    const parts = [];
    if ("content" in entity)
      parts.push(entity.content);
    if ("title" in entity)
      parts.push(entity.title);
    if ("description" in entity)
      parts.push(entity.description);
    if ("rationale" in entity)
      parts.push(entity.rationale);
    if ("action" in entity)
      parts.push(entity.action);
    if ("evidence" in entity) {
      for (const e of entity.evidence) {
        parts.push(e.reference);
        if (e.excerpt)
          parts.push(e.excerpt);
      }
    }
    if ("files" in entity)
      parts.push(...entity.files);
    if ("tags" in entity)
      parts.push(...entity.tags);
    return parts.join(" ");
  }
  getEntityTypeFromEntity(entity) {
    if ("id" in entity) {
      const id = entity.id;
      if (id.startsWith("F-"))
        return "fact";
      if (id.startsWith("D-"))
        return "decision";
      if (id.startsWith("A-"))
        return "alert";
      if (id.startsWith("S-"))
        return "step";
      if (id.startsWith("C-"))
        return "constraint";
    }
    return "fact";
  }
  // ============================================================
  // VIEW COMPILATION
  // ============================================================
  /**
   * Compile minimal view for agent
   */
  compileView(request) {
    const agent = request.agent;
    const budget = request.budget || {};
    const include = request.include || {
      mission: true,
      facts: true,
      decisions: true,
      plan: agent === "executor" || agent === "verifier",
      alerts: true
    };
    const maxTokens = budget.max_tokens || 1e3;
    const maxFacts = budget.max_facts || 20;
    const maxDecisions = budget.max_decisions || 5;
    let tokensUsed = 0;
    const mission = this.getMission();
    const status = this.getStatus();
    const plan = this.getPlan();
    const missionView = {
      goal: mission.goal,
      constraints: mission.constraints.map((c) => c.description),
      current_step: status.current_step,
      total_steps: status.total_steps
    };
    tokensUsed += this.estimateTokens(missionView);
    let currentStepView = void 0;
    if (include.plan && plan && plan.current_step < plan.steps.length) {
      const step = plan.steps[plan.current_step];
      currentStepView = {
        number: step.number,
        action: step.action,
        files: step.files,
        depends_on: step.depends_on.map((id) => {
          const dep = plan.steps.find((s) => s.id === id);
          return dep ? dep.action : id;
        }),
        verification: step.verification
      };
      tokensUsed += this.estimateTokens(currentStepView);
    }
    const factsView = [];
    if (include.facts) {
      const remainingBudget = maxTokens - tokensUsed - 100;
      const facts = this.selectRelevantFacts(agent, request.focus, remainingBudget, maxFacts);
      for (const fact of facts) {
        factsView.push({
          id: fact.id,
          content: fact.content,
          confidence: fact.confidence,
          evidence: this.collapseEvidence(fact)
        });
      }
      tokensUsed += this.estimateTokens(factsView);
    }
    const decisionsView = [];
    if (include.decisions) {
      const decisions = this.getDecisions({ status: ["approved"] });
      for (const d of decisions.slice(0, maxDecisions)) {
        decisionsView.push({
          id: d.id,
          title: d.title,
          description: d.description
        });
      }
      tokensUsed += this.estimateTokens(decisionsView);
    }
    const alertsView = [];
    if (include.alerts) {
      const alerts = this.getAlerts({ resolved: false });
      for (const a of alerts) {
        alertsView.push({
          id: a.id,
          severity: a.severity,
          title: a.title,
          blocking_step: a.blocking_step ? plan?.steps.findIndex((s) => s.id === a.blocking_step) : void 0
        });
      }
      tokensUsed += this.estimateTokens(alertsView);
    }
    const view = {
      mission: missionView,
      facts: factsView,
      decisions: decisionsView,
      alerts: alertsView,
      current_step: currentStepView,
      compiled_at: now(),
      token_estimate: tokensUsed,
      entities_included: factsView.length + decisionsView.length + alertsView.length,
      entities_available: this.countTotalEntities()
    };
    this.audit("orchestrator", "view.compile", { type: "status" }, {
      operation: "create",
      after: { agent, tokens: tokensUsed, entities: view.entities_included }
    });
    return view;
  }
  selectRelevantFacts(agent, focus, tokenBudget, maxFacts) {
    const allFacts = this.getFacts();
    const plan = this.getPlan();
    const scored = allFacts.map((fact) => ({
      fact,
      score: this.scoreFact(fact, agent, focus, plan)
    }));
    scored.sort((a, b) => b.score - a.score);
    const selected = [];
    let tokens = 0;
    for (const { fact } of scored) {
      if (selected.length >= maxFacts)
        break;
      const factTokens = this.estimateTokens({
        id: fact.id,
        content: fact.content,
        confidence: fact.confidence,
        evidence: this.collapseEvidence(fact)
      });
      if (tokens + factTokens > tokenBudget)
        continue;
      selected.push(fact);
      tokens += factTokens;
    }
    return selected;
  }
  scoreFact(fact, agent, focus, plan) {
    let score = 0;
    score += fact.confidence === "high" ? 1 : fact.confidence === "medium" ? 0.6 : 0.3;
    if (focus?.step && plan) {
      const step = plan.steps[focus.step];
      if (step) {
        for (const file of step.files) {
          if (fact.evidence.some((e) => e.reference.includes(file))) {
            score += 0.5;
          }
        }
      }
    }
    if (fact.supports?.length) {
      const approvedDecisions = this.getDecisions({ status: ["approved"] });
      if (fact.supports.some((id) => approvedDecisions.some((d) => d.id === id))) {
        score += 0.3;
      }
    }
    const age = Date.now() - new Date(fact.discovered_at).getTime();
    const ageMinutes = age / 6e4;
    score += Math.max(0, 0.2 - ageMinutes * 0.01);
    if (agent === "verifier" && !fact.verified_at) {
      score += 0.2;
    }
    if (focus?.entities?.includes(fact.id)) {
      score += 1;
    }
    return score;
  }
  collapseEvidence(fact) {
    if (fact.evidence.length === 0)
      return "(no evidence)";
    if (fact.evidence.length === 1)
      return fact.evidence[0].reference;
    return `${fact.evidence[0].reference} (+${fact.evidence.length - 1} more)`;
  }
  estimateTokens(data) {
    return Math.ceil(JSON.stringify(data).length / 4);
  }
  countTotalEntities() {
    return this.storage.getFacts().length + this.storage.getDecisions().length + this.storage.getAlerts().length + this.storage.getMission().constraints.length + (this.storage.getPlan()?.steps.length || 0);
  }
  // ============================================================
  // AUDIT
  // ============================================================
  audit(agent, action, target, change) {
    this.storage.appendAudit({
      id: crypto.randomUUID(),
      timestamp: now(),
      agent,
      action,
      target,
      change,
      context: {
        phase: this.storage.getMeta().phase,
        step: this.storage.getStatus().current_step
      }
    });
  }
  /**
   * Get audit log
   */
  getAuditLog() {
    return this.storage.getAuditLog();
  }
  // ============================================================
  // CLEANUP
  // ============================================================
  /**
   * Close database connections
   */
  close() {
    this.index.close();
    this.graphIndex.close();
    this.temporalIndex.close();
    this.unifiedSearch.close();
  }
  // ============================================================
  // ADVANCED SEARCH
  // ============================================================
  /**
   * Unified search across all indexes
   */
  async advancedSearch(query) {
    return this.unifiedSearch.search(query);
  }
  /**
   * Text search with hybrid mode (BM25 + semantic)
   */
  async textSearch(text, options) {
    return this.unifiedSearch.textSearch(text, options);
  }
  /**
   * Find entities related to a given entity via graph traversal
   */
  findRelated(id, options) {
    return this.unifiedSearch.findRelated(id, options);
  }
  /**
   * Find shortest path between two entities
   */
  findPath(fromId, toId, relation) {
    return this.unifiedSearch.findPath(fromId, toId, relation);
  }
  /**
   * Find recent entities
   */
  findRecent(limit = 10, types) {
    return this.unifiedSearch.findRecent(limit, types);
  }
  /**
   * Find entities in time range
   */
  findInTimeRange(after, before, types) {
    return this.unifiedSearch.findInTimeRange(after, before, types);
  }
  /**
   * Find entities by workflow phase
   */
  findByPhase(phase, types) {
    return this.unifiedSearch.findByPhase(phase, types);
  }
  /**
   * Get activity timeline
   */
  getTimeline(after, before) {
    const entries = this.temporalIndex.getHourlyTimeline(after, before);
    return entries.map((e) => ({
      id: "",
      // Timeline entries don't have single IDs
      type: "fact",
      timestamp: e.timestamp,
      phase: "execution"
    }));
  }
  /**
   * Get phase timeline showing duration of each phase
   */
  getPhaseTimeline() {
    return this.temporalIndex.getPhaseTimeline();
  }
  /**
   * Get entities that support a given entity
   */
  getSupporting(id) {
    const supporterIds = this.graphIndex.getSupporting(id);
    return supporterIds.map((sid) => this.getEntity(sid)).filter((e) => e !== null);
  }
  /**
   * Get entities that contradict a given entity
   */
  getContradicting(id) {
    const contradictorIds = this.graphIndex.getContradicting(id);
    return contradictorIds.map((cid) => this.getEntity(cid)).filter((e) => e !== null);
  }
  /**
   * Get dependencies for a step
   */
  getDependencies(stepId) {
    const depIds = this.graphIndex.getDependencies(stepId);
    return depIds.map((did) => this.getEntity(did)).filter((e) => e !== null);
  }
  /**
   * Get dependents of a step
   */
  getDependents(stepId) {
    const depIds = this.graphIndex.getDependents(stepId);
    return depIds.map((did) => this.getEntity(did)).filter((e) => e !== null);
  }
  /**
   * Get search statistics
   */
  getSearchStats() {
    return this.unifiedSearch.getStats();
  }
  // ============================================================
  // ENHANCED VIEW COMPILATION
  // ============================================================
  /**
   * Compile an enhanced view using search-powered relevance
   */
  async compileEnhancedView(request) {
    const baseView = this.compileView(request);
    if (request.focus?.entities && request.focus.entities.length > 0) {
      const relatedFactIds = /* @__PURE__ */ new Set();
      let supportingCount = 0;
      let contradictingCount = 0;
      for (const entityId of request.focus.entities) {
        const supporting = this.graphIndex.getSupporting(entityId);
        supporting.forEach((id) => {
          if (id.startsWith("F-")) {
            relatedFactIds.add(id);
            supportingCount++;
          }
        });
        const contradicting = this.graphIndex.getContradicting(entityId);
        contradicting.forEach((id) => {
          if (id.startsWith("F-")) {
            relatedFactIds.add(id);
            contradictingCount++;
          }
        });
      }
      return {
        ...baseView,
        related_facts: Array.from(relatedFactIds),
        context_from_graph: {
          supporting: supportingCount,
          contradicting: contradictingCount
        }
      };
    }
    return baseView;
  }
  // ============================================================
  // TRAILS (Memory Candidates)
  // ============================================================
  /**
   * Append a trail entry (memory candidate for MemoryMiner)
   */
  appendTrail(agent, request) {
    if (!this.exists()) {
      throw new Error("No board exists");
    }
    this.assertPermission(agent, "append_trail");
    this.trailSequence++;
    const taskId = this.storage.getMeta().task_id;
    const trailId = `T-${taskId}-${this.trailSequence}`;
    const entry = {
      ts: now(),
      schema_version: "1.1",
      id: trailId,
      task_id: taskId,
      marker: request.marker,
      summary: request.summary,
      agent,
      details: request.details,
      evidence: request.evidence || []
    };
    appendFileSync2(this.trailsPath, JSON.stringify(entry) + "\n");
    return entry;
  }
  /**
   * Get all trail entries
   */
  getTrails(filter) {
    if (!existsSync3(this.trailsPath)) {
      return [];
    }
    const lines = readFileSync3(this.trailsPath, "utf-8").trim().split("\n").filter(Boolean);
    let entries = lines.map((line) => JSON.parse(line));
    if (filter?.markers && filter.markers.length > 0) {
      entries = entries.filter((e) => filter.markers.includes(e.marker));
    }
    if (filter?.after) {
      entries = entries.filter((e) => e.ts >= filter.after);
    }
    if (filter?.before) {
      entries = entries.filter((e) => e.ts <= filter.before);
    }
    if (filter?.limit && filter.limit > 0) {
      entries = entries.slice(-filter.limit);
    }
    return entries;
  }
  /**
   * Get recent trail entries
   */
  getRecentTrails(limit = 10) {
    return this.getTrails({ limit });
  }
  /**
   * Get trail count
   */
  getTrailCount() {
    if (!existsSync3(this.trailsPath)) {
      return 0;
    }
    const lines = readFileSync3(this.trailsPath, "utf-8").trim().split("\n").filter(Boolean);
    return lines.length;
  }
  // ============================================================
  // PRIVATE HELPERS FOR INDEXING
  // ============================================================
  /**
   * Index entity in graph (relationships) and temporal indexes
   */
  indexInGraphAndTemporal(entity, type, agent) {
    const id = this.getEntityId(entity);
    const phase = this.storage.getMeta().phase;
    this.graphIndex.indexEntityRelationships({
      id,
      supports: "supports" in entity ? entity.supports : void 0,
      contradicts: "contradicts" in entity ? entity.contradicts : void 0,
      based_on: "based_on" in entity ? entity.based_on : void 0,
      depends_on: "depends_on" in entity ? entity.depends_on : void 0,
      affects: "affects" in entity ? entity.affects : void 0,
      references: "references" in entity ? entity.references : void 0,
      supersedes: "supersedes" in entity ? entity.supersedes : void 0,
      blocking_step: "blocking_step" in entity ? entity.blocking_step : void 0
    });
    const timestamp = this.getEntityTimestamp(entity);
    this.temporalIndex.recordEvent(id, type, timestamp, phase, agent);
  }
  getEntityId(entity) {
    if ("id" in entity)
      return entity.id;
    throw new Error("Entity has no id");
  }
  getEntityTimestamp(entity) {
    if ("discovered_at" in entity)
      return entity.discovered_at;
    if ("proposed_at" in entity)
      return entity.proposed_at;
    if ("raised_at" in entity)
      return entity.raised_at;
    if ("added_at" in entity)
      return entity.added_at;
    return (/* @__PURE__ */ new Date()).toISOString();
  }
};

// dist/manager/board-manager.js
var DEFAULT_BASE_PATH = ".dev_partner";
var BoardManager = class {
  basePath;
  tasksPath;
  boards = /* @__PURE__ */ new Map();
  constructor(projectPath = process.cwd()) {
    this.basePath = join7(projectPath, DEFAULT_BASE_PATH);
    this.tasksPath = join7(this.basePath, "tasks");
    mkdirSync6(this.tasksPath, { recursive: true });
  }
  // ============================================================
  // TASK LIFECYCLE
  // ============================================================
  /**
   * Create a new task
   */
  createTask(options) {
    const taskId = generateTaskId();
    const taskPath = join7(this.tasksPath, taskId);
    const board = new Board(taskPath);
    board.create({ ...options, taskId });
    this.boards.set(taskId, board);
    return {
      task_id: taskId,
      summary: this.getTaskSummary(taskId)
    };
  }
  /**
   * List all tasks
   */
  listTasks() {
    if (!existsSync4(this.tasksPath)) {
      return [];
    }
    const taskDirs = readdirSync2(this.tasksPath, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    const summaries = [];
    for (const taskId of taskDirs) {
      try {
        summaries.push(this.getTaskSummary(taskId));
      } catch {
      }
    }
    summaries.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return summaries;
  }
  /**
   * Get summary for a specific task
   */
  getTaskSummary(taskId) {
    const board = this.getBoard(taskId);
    const boardState = board.getBoard();
    const meta = boardState.meta;
    const mission = boardState.mission;
    const status = boardState.status;
    return {
      task_id: taskId,
      goal: mission.goal,
      phase: meta.phase,
      created_at: meta.created_at,
      updated_at: meta.updated_at,
      current_step: status.current_step,
      total_steps: status.total_steps
    };
  }
  /**
   * Archive a completed task
   */
  archiveTask(taskId) {
    const board = this.getBoard(taskId);
    const status = board.getStatus();
    if (status.phase !== "complete" && status.phase !== "cancelled") {
      throw new Error(`Cannot archive task in phase "${status.phase}". Must be complete or cancelled.`);
    }
    const archivePath = join7(this.basePath, "archive");
    mkdirSync6(archivePath, { recursive: true });
    const oldPath = join7(this.tasksPath, taskId);
    const newPath = join7(archivePath, taskId);
    renameSync(oldPath, newPath);
    this.boards.delete(taskId);
  }
  // ============================================================
  // BOARD ACCESS
  // ============================================================
  /**
   * Get board for a specific task
   */
  getBoard(taskId) {
    if (!taskId) {
      throw new Error("task_id is required. Use task_list to see available tasks.");
    }
    if (this.boards.has(taskId)) {
      return this.boards.get(taskId);
    }
    const taskPath = join7(this.tasksPath, taskId);
    if (!existsSync4(taskPath)) {
      throw new Error(`Task ${taskId} does not exist. Use task_list to see available tasks.`);
    }
    const board = new Board(taskPath);
    this.boards.set(taskId, board);
    return board;
  }
  /**
   * Check if a specific task exists
   */
  taskExists(taskId) {
    const taskPath = join7(this.tasksPath, taskId);
    return existsSync4(join7(taskPath, "meta.json"));
  }
  // ============================================================
  // CLEANUP
  // ============================================================
  /**
   * Close all board connections
   */
  close() {
    for (const board of this.boards.values()) {
      board.close();
    }
    this.boards.clear();
  }
  /**
   * Get base paths for external use
   */
  getBasePath() {
    return this.basePath;
  }
  getTasksPath() {
    return this.tasksPath;
  }
};
var _manager = null;
function getBoardManager(projectPath) {
  if (!_manager || projectPath) {
    if (_manager) {
      _manager.close();
    }
    _manager = new BoardManager(projectPath);
  }
  return _manager;
}

// dist/sandbox/index.js
import { runInNewContext } from "node:vm";
var BOARD_API_HELP = `
# Board API Reference

The board object provides access to all board operations.

## Quick Access
- board.help() - Show this help
- board.view() - Get quick board status (phase, goal, progress, alerts)
- board.view("minimal", agent) - Get agent-specific view
- board.view("enhanced", agent, { focus_step?, focus_entities? }) - Get graph-powered view

## Read Operations

### Mission & Status
- board.getMission() - Get task goal, constraints, context
- board.getStatus() - Get current phase, step progress, verification state
- board.getPlan() - Get execution plan with steps

### Facts
- board.getFacts(filter?) - List facts
  - filter: { confidence?: ["high"|"medium"|"low"], tags?: string[], verified?: boolean }
- board.getFact(id) - Get single fact by ID (F-N format)

### Decisions
- board.getDecisions(filter?) - List decisions
  - filter: { status?: ["proposed"|"approved"|"rejected"|"superseded"], tags?: string[] }
- board.getDecision(id) - Get single decision by ID (D-N format)

### Alerts
- board.getAlerts(filter?) - List alerts
  - filter: { severity?: ["blocker"|"major"|"minor"|"info"], resolved?: boolean }
- board.getAlert(id) - Get single alert by ID (A-N format)

### Search
- board.search({ text?, types?, tags?, limit? }) - Basic search
- board.advancedSearch({ text?, mode?, types?, confidence?, time_after?, time_before?, limit? }) - Advanced hybrid search
- board.textSearch(text, { mode?, limit?, types? }) - Full-text search (BM25 + semantic)

### Graph
- board.findRelated(id, { relation?, direction?, depth? }) - Find related entities
- board.findPath(fromId, toId, relation?) - Find path between entities
- board.getSupporting(id) - Get entities that support this one
- board.getContradicting(id) - Get entities that contradict this one
- board.getDependencies(stepId) - Get step dependencies

### Temporal
- board.findRecent(limit?, types?) - Find recent entities
- board.findInTimeRange(after, before, types?) - Find by time range
- board.findByPhase(phase, types?) - Find by workflow phase
- board.getPhaseTimeline() - Get phase durations

### Trails
- board.getTrails(filter?) - List memory candidate trails
- board.getRecentTrails(limit?) - Get recent trails
- board.getTrailCount() - Get total trail count

### Snippets (Context Buffer)
- board.getSnippets(filter?) - Get cached context snippets
  - filter: { tags?: string[], path?: string, staleness?: "fresh"|"warn"|"stale"|"all", evict_stale?: boolean }
  - evict_stale: defaults to true, auto-deletes stale snippets (>120min) in background
  - Set evict_stale: false to disable auto-eviction
- board.getSnippet(id) - Get single snippet by ID (X-N format)
- board.getSnippetFormatted(id) - Get snippet with staleness header
- board.getSnippetsFormatted(filter?) - Get all snippets with staleness headers

## Write Operations (require agent parameter)

### Facts
- board.addFact({ content, confidence, evidence, tags? }) - Add new fact
  - evidence: [{ type: "file"|"symbol"|"test"|"docs"|"web"|"user", reference: string, excerpt?: string }]
- board.verifyFact({ id, confidence? }) - Verify a fact (verifier only)

### Decisions
- board.proposeDecision({ title, description, rationale, alternatives?, based_on?, tags? }) - Propose decision (creative only)
- board.approveDecision({ id, affects? }) - Approve decision (orchestrator only)
- board.rejectDecision({ id, reason }) - Reject decision (orchestrator only)

### Plan & Steps
- board.setPlan({ goal, approach, steps }) - Set execution plan (orchestrator only)
  - steps: [{ action, files, depends_on?, verification }]
- board.advanceStep() - Move to next step (executor only)
- board.completeStep({ files_changed, files_created, verification_passed, notes? }) - Complete step (executor only)
- board.failStep({ reason }) - Mark step failed (executor only)
- board.decomposeStep(stepId, subtasks) - Break step into subtasks (executor only)
- board.completeSubtask(stepId, subtaskIndex) - Complete a subtask (executor only)

### Alerts
- board.raiseAlert({ severity, title, description, blocking_step?, tags? }) - Raise alert (any agent)
- board.resolveAlert({ id, resolution }) - Resolve alert (orchestrator/verifier/executor)

### Config
- board.addConstraint({ description, source? }) - Add constraint (orchestrator/scout)
- board.updateStatus({ phase?, classification? }) - Update board status (orchestrator/verifier/executor)

### Trails
- board.appendTrail({ marker, summary, details, evidence? }) - Log memory candidate
  - markers: "[BUG_FIX]", "[PREFERENCE]", "[DECISION]", "[PATTERN]", "[SURPRISE]", "[GATE]"

### Snippets (any agent can write)
- board.addSnippet({ content, purpose, path?, lines?, linked_to?, tags? }) - Cache context for reuse
  - Staleness: Snippets >30min show warning, >120min marked stale
- board.updateSnippet({ id, content?, purpose?, linked_to?, tags? }) - Update snippet
- board.verifySnippet({ id, content? }) - Reset staleness timer, optionally update content
- board.evictStaleSnippets() - Delete all stale snippets (>120min), returns count deleted

## Examples

// Get high-confidence facts about authentication
const authFacts = board.getFacts({ confidence: ["high"] })
  .filter(f => f.content.toLowerCase().includes("auth"));
return authFacts;

// Find facts supporting a decision
const decision = board.getDecision("D-1");
const supportingFacts = decision?.based_on?.map(id => board.getFact(id)).filter(Boolean);
return { decision, supportingFacts };

// Complex query: unresolved alerts blocking current step
const status = board.getStatus();
const plan = board.getPlan();
const currentStepId = plan?.steps[status.current_step]?.id;
const blockingAlerts = board.getAlerts({ resolved: false })
  .filter(a => a.blocking_step === currentStepId);
return { currentStep: currentStepId, blockingAlerts };

// Add fact with evidence
board.addFact({
  content: "API uses JWT for authentication",
  confidence: "high",
  evidence: [{ type: "file", reference: "src/auth/jwt.ts", excerpt: "export const verifyToken = ..." }],
  tags: ["auth", "security"]
});

// Cache code context as snippet for other agents
board.addSnippet({
  path: "src/auth/jwt.ts",
  lines: [1, 50],
  content: "// Full JWT implementation code here...",
  purpose: "JWT auth implementation - needed for token validation changes",
  linked_to: ["F-1"],  // Links to fact about JWT
  tags: ["auth", "jwt"]
});

// Retrieve cached snippets (avoids re-reading files)
const authSnippets = board.getSnippetsFormatted({ tags: ["auth"] });
// Returns: [{ id: "X-1", formatted: "Source: src/auth/jwt.ts\\n...", staleness: "fresh" }]

// Verify snippet is still current (resets staleness timer)
board.verifySnippet({ id: "X-1" });
`;
function createBoardAPI(board, agent) {
  return {
    // Quick access helpers
    view: (mode, viewAgent, options) => {
      const effectiveMode = mode || "status";
      const effectiveAgent = viewAgent || agent;
      if (effectiveMode === "status") {
        const status = board.getStatus();
        const mission = board.getMission();
        const alerts = board.getAlerts({ resolved: false });
        return {
          task_id: board.getTaskId(),
          phase: status.phase,
          current_step: status.current_step,
          total_steps: status.total_steps,
          goal: mission.goal,
          unresolved_alerts: alerts.length,
          progress: status.progress,
          verification: status.verification
        };
      } else if (effectiveMode === "minimal") {
        return board.compileView({
          agent: effectiveAgent,
          focus: options?.focus_step ? { step: options.focus_step } : void 0,
          budget: { max_tokens: options?.max_tokens || 1e3 }
        });
      } else if (effectiveMode === "enhanced") {
        return board.compileEnhancedView({
          agent: effectiveAgent,
          focus: {
            step: options?.focus_step,
            entities: options?.focus_entities
          },
          budget: { max_tokens: options?.max_tokens || 1e3 }
        });
      }
      return { error: `Unknown view mode: ${effectiveMode}` };
    },
    // Read operations (no agent required)
    getMission: () => board.getMission(),
    getStatus: () => board.getStatus(),
    getPlan: () => board.getPlan(),
    getFacts: (filter) => board.getFacts(filter),
    getFact: (id) => board.getFact(id),
    getDecisions: (filter) => board.getDecisions(filter),
    getDecision: (id) => board.getDecision(id),
    getAlerts: (filter) => board.getAlerts(filter),
    getAlert: (id) => board.getAlert(id),
    getEntity: (id) => board.getEntity(id),
    // Search
    search: (query) => board.search(query),
    advancedSearch: async (query) => board.advancedSearch(query),
    textSearch: async (text, options) => board.textSearch(text, options),
    // Graph
    findRelated: (id, options) => board.findRelated(id, options),
    findPath: (fromId, toId, relation) => board.findPath(fromId, toId, relation),
    getSupporting: (id) => board.getSupporting(id),
    getContradicting: (id) => board.getContradicting(id),
    getDependencies: (stepId) => board.getDependencies(stepId),
    // Temporal
    findRecent: (limit, types) => board.findRecent(limit, types),
    findInTimeRange: (after, before, types) => board.findInTimeRange(after, before, types),
    findByPhase: (phase, types) => board.findByPhase(phase, types),
    getPhaseTimeline: () => board.getPhaseTimeline(),
    // Trails (read)
    getTrails: (filter) => board.getTrails(filter),
    getRecentTrails: (limit) => board.getRecentTrails(limit),
    getTrailCount: () => board.getTrailCount(),
    // Snippets (read)
    getSnippets: (filter) => board.getSnippets(filter),
    getSnippet: (id) => board.getSnippet(id),
    getSnippetFormatted: (id) => board.getSnippetFormatted(id),
    getSnippetsFormatted: (filter) => board.getSnippetsFormatted(filter),
    // Write operations (agent is bound from context)
    addFact: (request) => board.addFact(agent, request),
    verifyFact: (request) => board.verifyFact(agent, request),
    proposeDecision: (request) => board.proposeDecision(agent, request),
    approveDecision: (request) => board.approveDecision(agent, request),
    rejectDecision: (request) => board.rejectDecision(agent, request),
    setPlan: (request) => board.setPlan(agent, request),
    advanceStep: () => board.advanceStep(agent),
    completeStep: (request) => board.completeStep(agent, request),
    failStep: (request) => board.failStep(agent, request),
    decomposeStep: (stepId, subtasks) => board.decomposeStep(agent, stepId, subtasks),
    completeSubtask: (stepId, subtaskIndex) => board.completeSubtask(agent, stepId, subtaskIndex),
    raiseAlert: (request) => board.raiseAlert(agent, request),
    resolveAlert: (request) => board.resolveAlert(agent, request),
    addConstraint: (request) => board.addConstraint(agent, request),
    updateStatus: (request) => board.updateStatus(agent, request),
    appendTrail: (request) => board.appendTrail(agent, request),
    // Snippets (write)
    addSnippet: (request) => board.addSnippet(agent, request),
    updateSnippet: (request) => board.updateSnippet(agent, request),
    verifySnippet: (request) => board.verifySnippet(agent, request),
    evictStaleSnippets: () => board.evictStaleSnippets(),
    // Help
    help: () => BOARD_API_HELP
  };
}
async function executeCode(board, request) {
  const startTime = Date.now();
  const timeout = request.timeout || 5e3;
  try {
    const boardAPI = createBoardAPI(board, request.agent);
    const context = {
      board: boardAPI,
      console: {
        log: () => {
        },
        // Silenced
        warn: () => {
        },
        error: () => {
        }
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
      Promise
      // No setTimeout, setInterval, fetch, require, etc.
    };
    const wrappedCode = `
      (async () => {
        ${request.code}
      })()
    `;
    const result = await runInNewContext(wrappedCode, context, {
      timeout,
      displayErrors: false
    });
    return {
      success: true,
      result,
      execution_time_ms: Date.now() - startTime
    };
  } catch (err) {
    const error2 = err instanceof Error ? err.message : String(err);
    let cleanError = error2;
    if (error2.includes("Script execution timed out")) {
      cleanError = `Execution timed out after ${timeout}ms. Simplify your code or increase timeout.`;
    }
    return {
      success: false,
      error: cleanError,
      execution_time_ms: Date.now() - startTime
    };
  }
}

// dist/skill-cli.js
function parseArgs(argv) {
  const flags = /* @__PURE__ */ new Map();
  const positional = [];
  let command = "";
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const flagName = arg.slice(2);
      if (flagName.includes("=")) {
        const [key, ...valueParts] = flagName.split("=");
        flags.set(key, valueParts.join("="));
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
        flags.set(flagName, argv[i + 1]);
        i++;
      } else {
        flags.set(flagName, "true");
      }
    } else if (!command) {
      command = arg;
    } else {
      positional.push(arg);
    }
  }
  return { command, flags, positional };
}
function getFlag(flags, key) {
  return flags.get(key);
}
function requireFlag(flags, key) {
  const value = flags.get(key);
  if (!value) {
    throw new Error(`Missing required flag: --${key}`);
  }
  return value;
}
function parseArrayFlag(flags, key) {
  const value = flags.get(key);
  if (!value)
    return [];
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}
function success(data) {
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}
function error(message) {
  console.error(JSON.stringify({ error: message }, null, 2));
  process.exit(1);
}
var HELP_TEXT = `
Agent Collaboration Board CLI

USAGE:
  node dist/skill-cli.js <command> [--flags]

MODES:
  1. Command mode: Direct operations via flags
  2. Exec mode: JavaScript composition via sandbox

TASK LIFECYCLE:
  create-task        Create new task
    --goal           Task goal (required)
    --context        Additional context
    --constraints    Comma-separated constraints
    --path           Project path (default: cwd)

  list-tasks         List all tasks
    --path           Project path (default: cwd)

  archive-task       Archive a task
    --task-id        Task ID (required)
    --path           Project path (default: cwd)

FACTS:
  add-fact           Add a new fact
    --task-id        Task ID (required)
    --agent          Agent role (required)
    --content        Fact content (required)
    --confidence     high|medium|low (required)
    --evidence       JSON array of evidence (required)
    --tags           Comma-separated tags
    --path           Project path (default: cwd)

  get-facts          Get facts with optional filters
    --task-id        Task ID (required)
    --confidence     Comma-separated confidence levels
    --tags           Comma-separated tags
    --verified       true|false
    --path           Project path (default: cwd)

SNIPPETS:
  add-snippet        Add a context snippet
    --task-id        Task ID (required)
    --agent          Agent role (required)
    --content        Snippet content (required)
    --purpose        Purpose description (required)
    --path-file      File path
    --lines          JSON array [start, end]
    --tags           Comma-separated tags
    --linked-to      Comma-separated entity IDs
    --path           Project path (default: cwd)

  get-snippets       Get snippets with optional filters
    --task-id        Task ID (required)
    --tags           Comma-separated tags
    --path-file      File path filter
    --staleness      fresh|warn|stale|all
    --path           Project path (default: cwd)

PLAN:
  set-plan           Set execution plan
    --task-id        Task ID (required)
    --agent          Agent role (required)
    --goal           Plan goal (required)
    --approach       Plan approach (required)
    --steps          JSON array of steps (required)
    --path           Project path (default: cwd)

  get-plan           Get execution plan
    --task-id        Task ID (required)
    --path           Project path (default: cwd)

  advance-step       Move to next step
    --task-id        Task ID (required)
    --agent          Agent role (required)
    --path           Project path (default: cwd)

  complete-step      Complete current step
    --task-id        Task ID (required)
    --agent          Agent role (required)
    --files-changed  Comma-separated files
    --files-created  Comma-separated files
    --verification   true|false (required)
    --notes          Optional notes
    --path           Project path (default: cwd)

  fail-step          Mark step as failed
    --task-id        Task ID (required)
    --agent          Agent role (required)
    --reason         Failure reason (required)
    --path           Project path (default: cwd)

DECISIONS:
  propose-decision   Propose a decision
    --task-id        Task ID (required)
    --agent          Agent role (required)
    --title          Decision title (required)
    --description    Decision description (required)
    --rationale      Decision rationale (required)
    --alternatives   JSON array of alternatives
    --based-on       Comma-separated fact IDs
    --tags           Comma-separated tags
    --path           Project path (default: cwd)

  approve-decision   Approve a decision
    --task-id        Task ID (required)
    --agent          Agent role (required)
    --id             Decision ID (required)
    --affects        Comma-separated step IDs
    --path           Project path (default: cwd)

ALERTS:
  raise-alert        Raise an alert
    --task-id        Task ID (required)
    --agent          Agent role (required)
    --severity       blocker|major|minor|info (required)
    --title          Alert title (required)
    --description    Alert description (required)
    --blocking-step  Step ID
    --tags           Comma-separated tags
    --path           Project path (default: cwd)

  resolve-alert      Resolve an alert
    --task-id        Task ID (required)
    --agent          Agent role (required)
    --id             Alert ID (required)
    --resolution     Resolution description (required)
    --path           Project path (default: cwd)

  get-alerts         Get alerts with optional filters
    --task-id        Task ID (required)
    --severity       Comma-separated severity levels
    --resolved       true|false
    --path           Project path (default: cwd)

TRAILS:
  append-trail       Append a trail entry
    --task-id        Task ID (required)
    --agent          Agent role (required)
    --marker         Trail marker (required)
    --summary        Trail summary (required)
    --details        JSON details object (required)
    --evidence       Comma-separated references
    --path           Project path (default: cwd)

  get-trails         Get trails with optional filters
    --task-id        Task ID (required)
    --marker         Trail marker filter
    --agent          Agent filter
    --limit          Max results
    --path           Project path (default: cwd)

STATUS:
  view               Get board status view
    --task-id        Task ID (required)
    --mode           status|minimal|enhanced (default: status)
    --agent          Agent role (for minimal/enhanced)
    --path           Project path (default: cwd)

  update-status      Update board status
    --task-id        Task ID (required)
    --agent          Agent role (required)
    --phase          Task phase
    --classification simple|standard|complex
    --path           Project path (default: cwd)

SEARCH:
  search             Search the board
    --task-id        Task ID (required)
    --text           Search text
    --types          Comma-separated entity types
    --tags           Comma-separated tags
    --limit          Max results
    --path           Project path (default: cwd)

CODE EXECUTION:
  exec               Execute JavaScript code
    --task-id        Task ID (required)
    --agent          Agent role (required)
    --code           JavaScript code (required)
    --timeout        Timeout in ms (default: 5000)
    --path           Project path (default: cwd)

HELP:
  help               Show this help message

EXAMPLES:
  # Create a task
  node dist/skill-cli.js create-task --goal "Implement auth" --context "Add JWT"

  # Add a fact
  node dist/skill-cli.js add-fact --task-id 20240101-120000-000 --agent scout \\
    --content "Uses Express" --confidence high \\
    --evidence '[{"type":"file","reference":"package.json"}]'

  # Execute code
  node dist/skill-cli.js exec --task-id 20240101-120000-000 --agent orchestrator \\
    --code 'return board.getFacts({ confidence: ["high"] })'

  # Get status view
  node dist/skill-cli.js view --task-id 20240101-120000-000
`;
async function handleCreateTask(flags) {
  const goal = requireFlag(flags, "goal");
  const context = getFlag(flags, "context");
  const constraintsStr = getFlag(flags, "constraints");
  const projectPath = getFlag(flags, "path") || process.cwd();
  const constraints = constraintsStr ? constraintsStr.split(",").map((s) => s.trim()).filter(Boolean) : void 0;
  const manager = getBoardManager(projectPath);
  const result = manager.createTask({ goal, context, constraints });
  success(result);
}
async function handleListTasks(flags) {
  const projectPath = getFlag(flags, "path") || process.cwd();
  const manager = getBoardManager(projectPath);
  const tasks = manager.listTasks();
  success({ tasks });
}
async function handleArchiveTask(flags) {
  const taskId = requireFlag(flags, "task-id");
  const projectPath = getFlag(flags, "path") || process.cwd();
  const manager = getBoardManager(projectPath);
  manager.archiveTask(taskId);
  success({ archived: taskId });
}
async function handleAddFact(flags) {
  const taskId = requireFlag(flags, "task-id");
  const agent = requireFlag(flags, "agent");
  const content = requireFlag(flags, "content");
  const confidence = requireFlag(flags, "confidence");
  const evidenceJson = requireFlag(flags, "evidence");
  const projectPath = getFlag(flags, "path") || process.cwd();
  const evidence = JSON.parse(evidenceJson);
  const tags = parseArrayFlag(flags, "tags");
  const manager = getBoardManager(projectPath);
  const board = manager.getBoard(taskId);
  const fact = board.addFact(agent, {
    content,
    confidence,
    evidence,
    tags
  });
  success({ fact });
}
async function handleGetFacts(flags) {
  const taskId = requireFlag(flags, "task-id");
  const projectPath = getFlag(flags, "path") || process.cwd();
  const manager = getBoardManager(projectPath);
  const board = manager.getBoard(taskId);
  const confidenceFilter = parseArrayFlag(flags, "confidence");
  const tagsFilter = parseArrayFlag(flags, "tags");
  const verifiedStr = getFlag(flags, "verified");
  const verified = verifiedStr ? verifiedStr === "true" : void 0;
  const facts = board.getFacts({
    confidence: confidenceFilter.length > 0 ? confidenceFilter : void 0,
    tags: tagsFilter.length > 0 ? tagsFilter : void 0,
    verified
  });
  success({ facts });
}
async function handleAddSnippet(flags) {
  const taskId = requireFlag(flags, "task-id");
  const agent = requireFlag(flags, "agent");
  const content = requireFlag(flags, "content");
  const purpose = requireFlag(flags, "purpose");
  const projectPath = getFlag(flags, "path") || process.cwd();
  const pathFile = getFlag(flags, "path-file");
  const linesJson = getFlag(flags, "lines");
  const lines = linesJson ? JSON.parse(linesJson) : void 0;
  const tags = parseArrayFlag(flags, "tags");
  const linkedTo = parseArrayFlag(flags, "linked-to");
  const manager = getBoardManager(projectPath);
  const board = manager.getBoard(taskId);
  const snippet = board.addSnippet(agent, {
    content,
    purpose,
    path: pathFile,
    lines,
    tags,
    linked_to: linkedTo.length > 0 ? linkedTo : void 0
  });
  success({ snippet });
}
async function handleGetSnippets(flags) {
  const taskId = requireFlag(flags, "task-id");
  const projectPath = getFlag(flags, "path") || process.cwd();
  const manager = getBoardManager(projectPath);
  const board = manager.getBoard(taskId);
  const tags = parseArrayFlag(flags, "tags");
  const pathFile = getFlag(flags, "path-file");
  const staleness = getFlag(flags, "staleness");
  const snippets = board.getSnippets({
    tags: tags.length > 0 ? tags : void 0,
    path: pathFile,
    staleness
  });
  success({ snippets });
}
async function handleSetPlan(flags) {
  const taskId = requireFlag(flags, "task-id");
  const agent = requireFlag(flags, "agent");
  const goal = requireFlag(flags, "goal");
  const approach = requireFlag(flags, "approach");
  const stepsJson = requireFlag(flags, "steps");
  const projectPath = getFlag(flags, "path") || process.cwd();
  const steps = JSON.parse(stepsJson);
  const manager = getBoardManager(projectPath);
  const board = manager.getBoard(taskId);
  const plan = board.setPlan(agent, { goal, approach, steps });
  success({ plan });
}
async function handleGetPlan(flags) {
  const taskId = requireFlag(flags, "task-id");
  const projectPath = getFlag(flags, "path") || process.cwd();
  const manager = getBoardManager(projectPath);
  const board = manager.getBoard(taskId);
  const plan = board.getPlan();
  success({ plan });
}
async function handleAdvanceStep(flags) {
  const taskId = requireFlag(flags, "task-id");
  const agent = requireFlag(flags, "agent");
  const projectPath = getFlag(flags, "path") || process.cwd();
  const manager = getBoardManager(projectPath);
  const board = manager.getBoard(taskId);
  const result = board.advanceStep(agent);
  success({ result });
}
async function handleCompleteStep(flags) {
  const taskId = requireFlag(flags, "task-id");
  const agent = requireFlag(flags, "agent");
  const verificationStr = requireFlag(flags, "verification");
  const projectPath = getFlag(flags, "path") || process.cwd();
  const filesChanged = parseArrayFlag(flags, "files-changed");
  const filesCreated = parseArrayFlag(flags, "files-created");
  const notes = getFlag(flags, "notes");
  const verificationPassed = verificationStr === "true";
  const manager = getBoardManager(projectPath);
  const board = manager.getBoard(taskId);
  const result = board.completeStep(agent, {
    result: {
      files_changed: filesChanged,
      files_created: filesCreated,
      verification_passed: verificationPassed,
      notes
    }
  });
  success({ result });
}
async function handleFailStep(flags) {
  const taskId = requireFlag(flags, "task-id");
  const agent = requireFlag(flags, "agent");
  const reason = requireFlag(flags, "reason");
  const projectPath = getFlag(flags, "path") || process.cwd();
  const manager = getBoardManager(projectPath);
  const board = manager.getBoard(taskId);
  const result = board.failStep(agent, { reason });
  success({ result });
}
async function handleProposeDecision(flags) {
  const taskId = requireFlag(flags, "task-id");
  const agent = requireFlag(flags, "agent");
  const title = requireFlag(flags, "title");
  const description = requireFlag(flags, "description");
  const rationale = requireFlag(flags, "rationale");
  const projectPath = getFlag(flags, "path") || process.cwd();
  const alternativesJson = getFlag(flags, "alternatives");
  const alternatives = alternativesJson ? JSON.parse(alternativesJson) : void 0;
  const basedOn = parseArrayFlag(flags, "based-on");
  const tags = parseArrayFlag(flags, "tags");
  const manager = getBoardManager(projectPath);
  const board = manager.getBoard(taskId);
  const decision = board.proposeDecision(agent, {
    title,
    description,
    rationale,
    alternatives,
    based_on: basedOn.length > 0 ? basedOn : void 0,
    tags
  });
  success({ decision });
}
async function handleApproveDecision(flags) {
  const taskId = requireFlag(flags, "task-id");
  const agent = requireFlag(flags, "agent");
  const id = requireFlag(flags, "id");
  const projectPath = getFlag(flags, "path") || process.cwd();
  const affects = parseArrayFlag(flags, "affects");
  const manager = getBoardManager(projectPath);
  const board = manager.getBoard(taskId);
  const decision = board.approveDecision(agent, {
    id,
    affects: affects.length > 0 ? affects : void 0
  });
  success({ decision });
}
async function handleRaiseAlert(flags) {
  const taskId = requireFlag(flags, "task-id");
  const agent = requireFlag(flags, "agent");
  const severity = requireFlag(flags, "severity");
  const title = requireFlag(flags, "title");
  const description = requireFlag(flags, "description");
  const projectPath = getFlag(flags, "path") || process.cwd();
  const blockingStep = getFlag(flags, "blocking-step");
  const tags = parseArrayFlag(flags, "tags");
  const manager = getBoardManager(projectPath);
  const board = manager.getBoard(taskId);
  const alert = board.raiseAlert(agent, {
    severity,
    title,
    description,
    blocking_step: blockingStep,
    tags
  });
  success({ alert });
}
async function handleResolveAlert(flags) {
  const taskId = requireFlag(flags, "task-id");
  const agent = requireFlag(flags, "agent");
  const id = requireFlag(flags, "id");
  const resolution = requireFlag(flags, "resolution");
  const projectPath = getFlag(flags, "path") || process.cwd();
  const manager = getBoardManager(projectPath);
  const board = manager.getBoard(taskId);
  const alert = board.resolveAlert(agent, { id, resolution });
  success({ alert });
}
async function handleGetAlerts(flags) {
  const taskId = requireFlag(flags, "task-id");
  const projectPath = getFlag(flags, "path") || process.cwd();
  const manager = getBoardManager(projectPath);
  const board = manager.getBoard(taskId);
  const severityFilter = parseArrayFlag(flags, "severity");
  const resolvedStr = getFlag(flags, "resolved");
  const resolved = resolvedStr ? resolvedStr === "true" : void 0;
  const alerts = board.getAlerts({
    severity: severityFilter.length > 0 ? severityFilter : void 0,
    resolved
  });
  success({ alerts });
}
async function handleAppendTrail(flags) {
  const taskId = requireFlag(flags, "task-id");
  const agent = requireFlag(flags, "agent");
  const marker = requireFlag(flags, "marker");
  const summary = requireFlag(flags, "summary");
  const details = getFlag(flags, "details");
  const projectPath = getFlag(flags, "path") || process.cwd();
  const evidence = parseArrayFlag(flags, "evidence");
  const manager = getBoardManager(projectPath);
  const board = manager.getBoard(taskId);
  const trail = board.appendTrail(agent, {
    marker,
    summary,
    details: details ? { text: details } : {},
    evidence
  });
  success({ trail });
}
async function handleGetTrails(flags) {
  const taskId = requireFlag(flags, "task-id");
  const projectPath = getFlag(flags, "path") || process.cwd();
  const manager = getBoardManager(projectPath);
  const board = manager.getBoard(taskId);
  const marker = getFlag(flags, "marker");
  const limitStr = getFlag(flags, "limit");
  const limit = limitStr ? parseInt(limitStr, 10) : void 0;
  const trails = board.getTrails({
    markers: marker ? [marker] : void 0,
    limit
  });
  success({ trails });
}
async function handleView(flags) {
  const taskId = requireFlag(flags, "task-id");
  const projectPath = getFlag(flags, "path") || process.cwd();
  const mode = getFlag(flags, "mode") || "status";
  const agent = getFlag(flags, "agent");
  const manager = getBoardManager(projectPath);
  const board = manager.getBoard(taskId);
  if (mode === "status") {
    const status = board.getStatus();
    const mission = board.getMission();
    const alerts = board.getAlerts({ resolved: false });
    success({
      task_id: taskId,
      phase: status.phase,
      current_step: status.current_step,
      total_steps: status.total_steps,
      goal: mission.goal,
      unresolved_alerts: alerts.length,
      progress: status.progress,
      verification: status.verification
    });
  } else if (mode === "minimal" && agent) {
    const view = board.compileView({
      agent,
      budget: { max_tokens: 1e3 }
    });
    success({ view });
  } else if (mode === "enhanced" && agent) {
    const view = board.compileEnhancedView({
      agent,
      focus: {},
      budget: { max_tokens: 1e3 }
    });
    success({ view });
  } else {
    error(`Invalid mode or missing agent for mode: ${mode}`);
  }
}
async function handleUpdateStatus(flags) {
  const taskId = requireFlag(flags, "task-id");
  const agent = requireFlag(flags, "agent");
  const projectPath = getFlag(flags, "path") || process.cwd();
  const phase = getFlag(flags, "phase");
  const classification = getFlag(flags, "classification");
  const manager = getBoardManager(projectPath);
  const board = manager.getBoard(taskId);
  const status = board.updateStatus(agent, {
    phase,
    classification
  });
  success({ status });
}
async function handleSearch(flags, positional) {
  const taskId = requireFlag(flags, "task-id");
  const projectPath = getFlag(flags, "path") || process.cwd();
  const text = getFlag(flags, "text") || positional.join(" ") || void 0;
  const types = parseArrayFlag(flags, "types");
  const tags = parseArrayFlag(flags, "tags");
  const limitStr = getFlag(flags, "limit");
  const limit = limitStr ? parseInt(limitStr, 10) : void 0;
  const manager = getBoardManager(projectPath);
  const board = manager.getBoard(taskId);
  const results = board.search({
    text,
    filters: {
      types: types.length > 0 ? types : void 0,
      tags: tags.length > 0 ? tags : void 0
    },
    options: {
      limit
    }
  });
  success({ results });
}
async function handleExec(flags) {
  const taskId = requireFlag(flags, "task-id");
  const agent = requireFlag(flags, "agent");
  const code = requireFlag(flags, "code");
  const projectPath = getFlag(flags, "path") || process.cwd();
  const timeoutStr = getFlag(flags, "timeout");
  const timeout = timeoutStr ? parseInt(timeoutStr, 10) : 5e3;
  const manager = getBoardManager(projectPath);
  const board = manager.getBoard(taskId);
  const result = await executeCode(board, { code, agent, timeout });
  success(result);
}
async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === "help" || args[0] === "--help" || args[0] === "-h") {
    console.log(HELP_TEXT);
    process.exit(0);
  }
  const parsed = parseArgs(args);
  try {
    switch (parsed.command) {
      // Task lifecycle
      case "create-task":
        await handleCreateTask(parsed.flags);
        break;
      case "list-tasks":
        await handleListTasks(parsed.flags);
        break;
      case "archive-task":
        await handleArchiveTask(parsed.flags);
        break;
      // Facts
      case "add-fact":
        await handleAddFact(parsed.flags);
        break;
      case "get-facts":
        await handleGetFacts(parsed.flags);
        break;
      // Snippets
      case "add-snippet":
        await handleAddSnippet(parsed.flags);
        break;
      case "get-snippets":
        await handleGetSnippets(parsed.flags);
        break;
      // Plan
      case "set-plan":
        await handleSetPlan(parsed.flags);
        break;
      case "get-plan":
        await handleGetPlan(parsed.flags);
        break;
      case "advance-step":
        await handleAdvanceStep(parsed.flags);
        break;
      case "complete-step":
        await handleCompleteStep(parsed.flags);
        break;
      case "fail-step":
        await handleFailStep(parsed.flags);
        break;
      // Decisions
      case "propose-decision":
        await handleProposeDecision(parsed.flags);
        break;
      case "approve-decision":
        await handleApproveDecision(parsed.flags);
        break;
      // Alerts
      case "raise-alert":
        await handleRaiseAlert(parsed.flags);
        break;
      case "resolve-alert":
        await handleResolveAlert(parsed.flags);
        break;
      case "get-alerts":
        await handleGetAlerts(parsed.flags);
        break;
      // Trails
      case "append-trail":
        await handleAppendTrail(parsed.flags);
        break;
      case "get-trails":
        await handleGetTrails(parsed.flags);
        break;
      // Status
      case "view":
        await handleView(parsed.flags);
        break;
      case "update-status":
        await handleUpdateStatus(parsed.flags);
        break;
      // Search
      case "search":
        await handleSearch(parsed.flags, parsed.positional);
        break;
      // Code execution
      case "exec":
        await handleExec(parsed.flags);
        break;
      default:
        error(`Unknown command: ${parsed.command}

Run 'help' to see available commands.`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    error(message);
  }
}
main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
export {
  main,
  parseArgs
};
