/**
 * Agent Collaboration Board - Unified Search API
 *
 * Combines all search layers into a single interface:
 * - Direct Index: O(1) lookups by ID, type, file, tag
 * - CK Hybrid: BM25 + semantic search for text queries
 * - Graph Index: Relationship traversal
 * - Temporal Index: Time-based queries
 */

import { DirectIndex, type DirectIndexFilters } from "../index/direct-index.js";
import type {
    AgentRole,
    Alert,
    Confidence,
    Constraint,
    Decision,
    Entity,
    EntityId,
    EntityType,
    Fact,
    PlanStep,
    TaskPhase,
    Timestamp,
} from "../types/core.js";
import type { Edge, RelationType, SearchQuery, SearchResponse, SearchResult } from "../types/operations.js";
import { CKSearch, type CKSearchOptions } from "./ck-search.js";
import { GraphIndex, type GraphPath } from "./graph-index.js";
import { TemporalIndex, type TemporalEntry, type TemporalQuery } from "./temporal-index.js";

// ============================================================
// TYPES
// ============================================================

export interface UnifiedSearchQuery extends SearchQuery {
  // Text search options
  text?: string;
  mode?: "direct" | "lexical" | "semantic" | "hybrid";

  // Filters (from base SearchQuery)
  filters?: {
    types?: EntityType[];
    agents?: AgentRole[];
    confidence?: Confidence[];
    tags?: string[];
    files?: string[];
    timeRange?: {
      after?: Timestamp;
      before?: Timestamp;
    };
    phases?: TaskPhase[];
  };

  // Graph options
  graph?: {
    from?: EntityId;
    relation?: RelationType | RelationType[];
    direction?: "outgoing" | "incoming" | "both";
    depth?: number;
  };

  // Options
  options?: {
    limit?: number;
    offset?: number;
    minScore?: number;
    rerank?: boolean;
    includeRelated?: boolean;
    includeTimeline?: boolean;
  };
}

export interface UnifiedSearchResponse extends SearchResponse {
  // Extended response fields
  related?: {
    nodes: EntityId[];
    edges: Edge[];
  };
  timeline?: TemporalEntry[];
  searchLayers: ("direct" | "ck" | "graph" | "temporal")[];
}

export interface SearchLayerResult {
  layer: "direct" | "ck" | "graph" | "temporal";
  results: SearchResult[];
  queryTimeMs: number;
}

// ============================================================
// UNIFIED SEARCH CLASS
// ============================================================

export class UnifiedSearch {
  private directIndex: DirectIndex;
  private ckSearch: CKSearch;
  private graphIndex: GraphIndex;
  private temporalIndex: TemporalIndex;
  private entityResolver: (id: EntityId) => Entity | null;

  constructor(
    boardPath: string,
    entityResolver: (id: EntityId) => Entity | null
  ) {
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
  async search(query: UnifiedSearchQuery): Promise<UnifiedSearchResponse> {
    const startTime = Date.now();
    const layersUsed: ("direct" | "ck" | "graph" | "temporal")[] = [];
    const allResults: SearchResult[] = [];

    const mode = query.mode || (query.text ? "hybrid" : "direct");
    const limit = query.options?.limit || 10;

    // Layer 1: Direct Index (always used for filtering)
    if (this.shouldUseDirectIndex(query)) {
      const directFilters = this.buildDirectFilters(query);
      const directEntities = this.directIndex.query(directFilters);

      for (const entity of directEntities) {
        allResults.push({
          entity: entity as Fact | Decision | PlanStep | Constraint | Alert,
          entityType: this.getEntityType(entity),
          score: 1.0, // Base score from direct index
        });
      }

      layersUsed.push("direct");
    }

    // Layer 2: CK Hybrid Search (for text queries)
    if (query.text && (mode === "lexical" || mode === "semantic" || mode === "hybrid")) {
      const ckOptions: CKSearchOptions = {
        mode: mode, // Already lexical, semantic, or hybrid from condition above
        limit: limit * 2, // Get more for fusion
        rerank: query.options?.rerank,
      };

      const ckResults = await this.ckSearch.search(query.text, ckOptions);

      // Merge CK results with existing results
      for (const ckResult of ckResults) {
        const existingIndex = allResults.findIndex(
          (r) => this.getEntityId(r.entity) === ckResult.id
        );

        if (existingIndex >= 0) {
          // Boost score for entities found in both layers
          allResults[existingIndex].score += ckResult.score;
          allResults[existingIndex].highlights = ckResult.highlights;
        } else {
          // Resolve entity from ID
          const entity = this.entityResolver(ckResult.id);
          if (entity) {
            allResults.push({
              entity: entity as Fact | Decision | PlanStep | Constraint | Alert,
              entityType: ckResult.entityType,
              score: ckResult.score,
              highlights: ckResult.highlights,
            });
          }
        }
      }

      layersUsed.push("ck");
    }

    // Layer 3: Graph Index (for relationship queries)
    let related: { nodes: EntityId[]; edges: Edge[] } | undefined;
    if (query.graph?.from) {
      const traversalResult = this.graphIndex.traverse(query.graph.from, {
        direction: query.graph.direction,
        relation: query.graph.relation,
        maxDepth: query.graph.depth,
        limit: limit * 2,
      });

      // Add graph-related entities to results
      for (const nodeId of traversalResult.nodes) {
        const existingIndex = allResults.findIndex(
          (r) => this.getEntityId(r.entity) === nodeId
        );

        if (existingIndex >= 0) {
          // Boost score for connected entities
          allResults[existingIndex].score += 0.5;
        } else {
          const entity = this.entityResolver(nodeId);
          if (entity) {
            allResults.push({
              entity: entity as Fact | Decision | PlanStep | Constraint | Alert,
              entityType: this.getEntityType(entity),
              score: 0.5,
            });
          }
        }
      }

      if (query.options?.includeRelated) {
        related = traversalResult;
      }

      layersUsed.push("graph");
    }

    // Layer 4: Temporal Index (for time-based queries)
    let timeline: TemporalEntry[] | undefined;
    if (query.filters?.timeRange || query.filters?.phases) {
      const temporalQuery: TemporalQuery = {
        after: query.filters.timeRange?.after,
        before: query.filters.timeRange?.before,
        types: query.filters.types,
        phases: query.filters.phases,
        limit: limit * 2,
      };

      const temporalEntries = this.temporalIndex.query(temporalQuery);

      // Boost temporal matches
      for (const entry of temporalEntries) {
        const existingIndex = allResults.findIndex(
          (r) => this.getEntityId(r.entity) === entry.id
        );

        if (existingIndex >= 0) {
          // Recency boost
          const age = Date.now() - new Date(entry.timestamp).getTime();
          const recencyBoost = Math.max(0, 0.3 - age / (1000 * 60 * 60)); // Decay over 1 hour
          allResults[existingIndex].score += recencyBoost;
        }
      }

      if (query.options?.includeTimeline) {
        timeline = temporalEntries;
      }

      layersUsed.push("temporal");
    }

    // Sort by score descending
    allResults.sort((a, b) => b.score - a.score);

    // Apply min score filter
    let filtered = allResults;
    if (query.options?.minScore) {
      filtered = allResults.filter((r) => r.score >= query.options!.minScore!);
    }

    // Apply pagination
    const offset = query.options?.offset || 0;
    const paginated = filtered.slice(offset, offset + limit);

    return {
      results: paginated,
      total: filtered.length,
      query_time_ms: Date.now() - startTime,
      search_mode: mode === "direct" ? "direct" : mode,
      searchLayers: layersUsed,
      related,
      timeline,
    };
  }

  // ============================================================
  // SPECIALIZED SEARCHES
  // ============================================================

  /**
   * Find entities by ID (direct lookup)
   */
  findById(id: EntityId): Entity | null {
    return this.directIndex.get(id);
  }

  /**
   * Find entities by IDs
   */
  findByIds(ids: EntityId[]): Entity[] {
    return this.directIndex.getByIds(ids);
  }

  /**
   * Find entities by type
   */
  findByType(type: EntityType): Entity[] {
    return this.directIndex.getByType(type);
  }

  /**
   * Find entities by file
   */
  findByFile(path: string): Entity[] {
    return this.directIndex.getByFile(path);
  }

  /**
   * Find entities by tag
   */
  findByTag(tag: string): Entity[] {
    return this.directIndex.getByTag(tag);
  }

  /**
   * Find entities by agent
   */
  findByAgent(agent: AgentRole): Entity[] {
    return this.directIndex.getByAgent(agent);
  }

  /**
   * Find related entities via graph
   */
  findRelated(
    id: EntityId,
    options?: {
      relation?: RelationType | RelationType[];
      direction?: "outgoing" | "incoming" | "both";
      depth?: number;
    }
  ): { nodes: Entity[]; edges: Edge[] } {
    const result = this.graphIndex.traverse(id, options);
    const entities = result.nodes
      .map((nodeId) => this.entityResolver(nodeId))
      .filter((e): e is Entity => e !== null);

    return { nodes: entities, edges: result.edges };
  }

  /**
   * Find shortest path between entities
   */
  findPath(
    fromId: EntityId,
    toId: EntityId,
    relation?: RelationType | RelationType[]
  ): GraphPath | null {
    return this.graphIndex.findPath(fromId, toId, { relation });
  }

  /**
   * Find recent entities
   */
  findRecent(limit: number = 10, types?: EntityType[]): Entity[] {
    const entries = this.temporalIndex.getRecent(limit, types);
    return entries
      .map((e) => this.entityResolver(e.id))
      .filter((e): e is Entity => e !== null);
  }

  /**
   * Find entities in time range
   */
  findInTimeRange(after: Timestamp, before: Timestamp, types?: EntityType[]): Entity[] {
    const entries = this.temporalIndex.getInRange(after, before, types);
    return entries
      .map((e) => this.entityResolver(e.id))
      .filter((e): e is Entity => e !== null);
  }

  /**
   * Find entities from a specific phase
   */
  findByPhase(phase: TaskPhase, types?: EntityType[]): Entity[] {
    const entries = this.temporalIndex.getByPhase(phase, types);
    return entries
      .map((e) => this.entityResolver(e.id))
      .filter((e): e is Entity => e !== null);
  }

  /**
   * Text search with hybrid mode
   */
  async textSearch(
    query: string,
    options?: {
      mode?: "lexical" | "semantic" | "hybrid";
      limit?: number;
      types?: EntityType[];
    }
  ): Promise<SearchResult[]> {
    const response = await this.search({
      text: query,
      mode: options?.mode || "hybrid",
      filters: { types: options?.types },
      options: { limit: options?.limit || 10 },
    });
    return response.results;
  }

  // ============================================================
  // INDEXING
  // ============================================================

  /**
   * Index an entity across all layers
   */
  async indexEntity(entity: Entity, type: EntityType, phase: TaskPhase, agent?: AgentRole): Promise<void> {
    const id = this.getEntityId(entity);

    // Direct index
    this.directIndex.index(entity, type);

    // CK search index
    await this.ckSearch.index(entity, type);

    // Graph index (relationships)
    this.graphIndex.indexEntityRelationships({
      id,
      supports: "supports" in entity ? entity.supports : undefined,
      contradicts: "contradicts" in entity ? entity.contradicts : undefined,
      based_on: "based_on" in entity ? entity.based_on : undefined,
      depends_on: "depends_on" in entity ? entity.depends_on : undefined,
      affects: "affects" in entity ? entity.affects : undefined,
      references: "references" in entity ? entity.references : undefined,
      supersedes: "supersedes" in entity ? entity.supersedes : undefined,
      blocking_step: "blocking_step" in entity ? entity.blocking_step : undefined,
    });

    // Temporal index
    const timestamp = this.getTimestamp(entity);
    this.temporalIndex.recordEvent(id, type, timestamp, phase, agent);
  }

  /**
   * Remove an entity from all indexes
   */
  async removeEntity(id: EntityId): Promise<void> {
    this.directIndex.remove(id);
    await this.ckSearch.remove(id);
    this.graphIndex.removeNode(id);
    this.temporalIndex.removeEntity(id);
  }

  /**
   * Rebuild all indexes from entities
   */
  async rebuildIndexes(
    entities: Array<{ entity: Entity; type: EntityType; phase: TaskPhase; agent?: AgentRole }>
  ): Promise<void> {
    // Clear all indexes
    this.directIndex.clear();
    await this.ckSearch.clear();
    this.graphIndex.clear();
    this.temporalIndex.clear();

    // Re-index all entities
    for (const { entity, type, phase, agent } of entities) {
      await this.indexEntity(entity, type, phase, agent);
    }
  }

  /**
   * Record a phase transition
   */
  recordPhaseTransition(fromPhase: TaskPhase | null, toPhase: TaskPhase, triggeredBy?: string): void {
    this.temporalIndex.recordPhaseTransition(fromPhase, toPhase, new Date().toISOString(), triggeredBy);
  }

  // ============================================================
  // STATISTICS
  // ============================================================

  /**
   * Get combined statistics from all indexes
   */
  getStats(): {
    direct: { total_entities: number; by_type: Record<string, number> };
    ck: { documents: number; indexSize: number };
    graph: { totalNodes: number; totalEdges: number };
    temporal: { totalEvents: number; avgEventsPerHour: number };
  } {
    return {
      direct: this.directIndex.getStats(),
      ck: this.ckSearch.getStats(),
      graph: this.graphIndex.getStats(),
      temporal: this.temporalIndex.getStats(),
    };
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private shouldUseDirectIndex(query: UnifiedSearchQuery): boolean {
    // Use direct index if we have filters but no text query
    // or if mode is explicitly "direct"
    return (
      query.mode === "direct" ||
      !query.text ||
      !!(query.filters?.types || query.filters?.tags || query.filters?.files || query.filters?.agents)
    );
  }

  private buildDirectFilters(query: UnifiedSearchQuery): DirectIndexFilters {
    return {
      types: query.filters?.types,
      tags: query.filters?.tags,
      files: query.filters?.files,
      agents: query.filters?.agents,
      confidence: query.filters?.confidence,
      createdAfter: query.filters?.timeRange?.after,
      createdBefore: query.filters?.timeRange?.before,
      limit: (query.options?.limit || 10) * 2, // Get more for merging
    };
  }

  private getEntityId(entity: Entity): EntityId {
    if ("id" in entity) return entity.id;
    throw new Error("Entity has no id");
  }

  private getEntityType(entity: Entity): EntityType {
    const id = this.getEntityId(entity);
    if (id.startsWith("F-")) return "fact";
    if (id.startsWith("D-")) return "decision";
    if (id.startsWith("A-")) return "alert";
    if (id.startsWith("S-")) return "step";
    if (id.startsWith("C-")) return "constraint";
    return "fact";
  }

  private getTimestamp(entity: Entity): Timestamp {
    if ("discovered_at" in entity) return entity.discovered_at;
    if ("proposed_at" in entity) return entity.proposed_at;
    if ("raised_at" in entity) return entity.raised_at;
    if ("added_at" in entity) return entity.added_at;
    return new Date().toISOString();
  }

  // ============================================================
  // CLEANUP
  // ============================================================

  /**
   * Close all database connections
   */
  close(): void {
    this.directIndex.close();
    this.graphIndex.close();
    this.temporalIndex.close();
  }
}

// ============================================================
// SINGLETON EXPORT
// ============================================================

let _unifiedSearch: UnifiedSearch | null = null;

export function getUnifiedSearch(
  boardPath: string,
  entityResolver: (id: EntityId) => Entity | null
): UnifiedSearch {
  if (!_unifiedSearch) {
    _unifiedSearch = new UnifiedSearch(boardPath, entityResolver);
  }
  return _unifiedSearch;
}

export function resetUnifiedSearch(): void {
  if (_unifiedSearch) {
    _unifiedSearch.close();
    _unifiedSearch = null;
  }
}
