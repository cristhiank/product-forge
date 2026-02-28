/**
 * Agent Collaboration Board - CK Hybrid Search Integration
 *
 * Integrates with CK (seek) for hybrid search combining:
 * - BM25 lexical search
 * - Embedding-based semantic search
 * - RRF (Reciprocal Rank Fusion) for result merging
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Entity, EntityId, EntityType } from "../types/core.js";

// ============================================================
// TYPES
// ============================================================

export interface CKSearchOptions {
  mode: "lexical" | "semantic" | "hybrid";
  limit?: number;
  minScore?: number;
  rerank?: boolean;
}

export interface CKSearchResult {
  id: EntityId;
  entityType: EntityType;
  score: number;
  lexicalScore?: number;
  semanticScore?: number;
  highlights?: string[];
}

export interface CKIndexStats {
  documents: number;
  indexSize: number;
  lastUpdated: string;
}

// ============================================================
// CK SEARCH CLASS
// ============================================================

export class CKSearch {
  private indexPath: string;
  private documentsPath: string;
  private isAvailable: boolean = false;

  constructor(boardPath: string) {
    this.indexPath = join(boardPath, ".index", "ck");
    this.documentsPath = join(this.indexPath, "documents");
    mkdirSync(this.documentsPath, { recursive: true });

    // Check if CK is installed
    this.checkCKAvailability();
  }

  // ============================================================
  // AVAILABILITY
  // ============================================================

  private async checkCKAvailability(): Promise<void> {
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
  available(): boolean {
    return this.isAvailable;
  }

  // ============================================================
  // INDEXING
  // ============================================================

  /**
   * Index an entity for hybrid search
   */
  async index(entity: Entity, entityType: EntityType): Promise<void> {
    const id = this.getEntityId(entity);
    const content = this.extractSearchableContent(entity);

    // Write document to filesystem for CK to index
    const docPath = join(this.documentsPath, `${id}.json`);
    const doc = {
      id,
      type: entityType,
      content,
      metadata: this.extractMetadata(entity),
      indexed_at: new Date().toISOString(),
    };

    writeFileSync(docPath, JSON.stringify(doc, null, 2));

    // If CK is available, trigger incremental index
    if (this.isAvailable) {
      await this.runCK(["index", "--path", this.documentsPath, "--incremental"]);
    }
  }

  /**
   * Index multiple entities at once
   */
  async indexBatch(entities: Array<{ entity: Entity; type: EntityType }>): Promise<void> {
    // Write all documents first
    for (const { entity, type } of entities) {
      const id = this.getEntityId(entity);
      const content = this.extractSearchableContent(entity);

      const docPath = join(this.documentsPath, `${id}.json`);
      const doc = {
        id,
        type,
        content,
        metadata: this.extractMetadata(entity),
        indexed_at: new Date().toISOString(),
      };

      writeFileSync(docPath, JSON.stringify(doc, null, 2));
    }

    // Run full index rebuild
    if (this.isAvailable) {
      await this.runCK(["index", "--path", this.documentsPath]);
    }
  }

  /**
   * Remove entity from index
   */
  async remove(id: EntityId): Promise<void> {
    const docPath = join(this.documentsPath, `${id}.json`);
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
  async clear(): Promise<void> {
    const { readdirSync, unlinkSync } = await import("node:fs");
    const files = readdirSync(this.documentsPath);
    for (const file of files) {
      unlinkSync(join(this.documentsPath, file));
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
  async search(query: string, options: CKSearchOptions = { mode: "hybrid" }): Promise<CKSearchResult[]> {
    if (!this.isAvailable) {
      // Fallback to simple file-based search if CK not available
      return this.fallbackSearch(query, options);
    }

    const args = ["search", "--query", query, "--path", this.documentsPath];

    // Add mode-specific flags
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

    // Add limit
    if (options.limit) {
      args.push("--limit", options.limit.toString());
    }

    // Add reranking
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
  private fallbackSearch(query: string, options: CKSearchOptions): CKSearchResult[] {
    const results: CKSearchResult[] = [];
    const queryLower = query.toLowerCase();
    const limit = options.limit || 10;

    try {
      const files = readdirSync(this.documentsPath);

      for (const file of files) {
        if (!file.endsWith(".json")) continue;

        const docPath = join(this.documentsPath, file);
        const doc = JSON.parse(readFileSync(docPath, "utf-8"));

        const content = doc.content.toLowerCase();
        if (content.includes(queryLower)) {
          // Calculate simple TF-based score
          const occurrences = (content.match(new RegExp(queryLower, "g")) || []).length;
          const score = occurrences / Math.sqrt(content.length);

          results.push({
            id: doc.id as EntityId,
            entityType: doc.type as EntityType,
            score,
            highlights: this.extractHighlights(doc.content, query),
          });
        }
      }

      // Sort by score descending
      results.sort((a, b) => b.score - a.score);

      // Apply limit
      return results.slice(0, limit);
    } catch {
      return [];
    }
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private async runCK(args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      const ck = spawn("ck", args, {
        stdio: ["pipe", "pipe", "pipe"],
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

      // Timeout after 30 seconds
      setTimeout(() => {
        ck.kill();
        resolve({ exitCode: 1, stdout, stderr: "Timeout" });
      }, 30000);
    });
  }

  private getEntityId(entity: Entity): string {
    if ("id" in entity) return entity.id;
    throw new Error("Entity has no id");
  }

  private extractSearchableContent(entity: Entity): string {
    const parts: string[] = [];

    if ("content" in entity) parts.push(entity.content);
    if ("title" in entity) parts.push(entity.title);
    if ("description" in entity) parts.push(entity.description);
    if ("rationale" in entity) parts.push(entity.rationale);
    if ("action" in entity) parts.push(entity.action);
    if ("verification" in entity) parts.push(entity.verification);

    if ("evidence" in entity && Array.isArray(entity.evidence)) {
      for (const e of entity.evidence) {
        parts.push(e.reference);
        if (e.excerpt) parts.push(e.excerpt);
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

  private extractMetadata(entity: Entity): Record<string, unknown> {
    const metadata: Record<string, unknown> = {};

    if ("confidence" in entity) metadata.confidence = entity.confidence;
    if ("status" in entity) metadata.status = entity.status;
    if ("severity" in entity) metadata.severity = entity.severity;
    if ("source" in entity) metadata.source = entity.source;
    if ("proposed_by" in entity) metadata.proposed_by = entity.proposed_by;
    if ("raised_by" in entity) metadata.raised_by = entity.raised_by;
    if ("tags" in entity) metadata.tags = entity.tags;
    if ("files" in entity) metadata.files = entity.files;

    return metadata;
  }

  private parseSearchResults(stdout: string): CKSearchResult[] {
    try {
      const lines = stdout.trim().split("\n").filter(Boolean);
      const results: CKSearchResult[] = [];

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          results.push({
            id: parsed.id as EntityId,
            entityType: parsed.type as EntityType,
            score: parsed.score || 0,
            lexicalScore: parsed.lexical_score,
            semanticScore: parsed.semantic_score,
            highlights: parsed.highlights || [],
          });
        } catch {
          // Skip malformed lines
        }
      }

      return results;
    } catch {
      return [];
    }
  }

  private extractHighlights(content: string, query: string): string[] {
    const highlights: string[] = [];
    const queryLower = query.toLowerCase();
    const contentLower = content.toLowerCase();

    let index = contentLower.indexOf(queryLower);
    while (index !== -1 && highlights.length < 3) {
      const start = Math.max(0, index - 30);
      const end = Math.min(content.length, index + query.length + 30);
      let highlight = content.slice(start, end);

      if (start > 0) highlight = "..." + highlight;
      if (end < content.length) highlight = highlight + "...";

      highlights.push(highlight);
      index = contentLower.indexOf(queryLower, index + 1);
    }

    return highlights;
  }

  /**
   * Get index statistics
   */
  getStats(): CKIndexStats {
    try {
      const files = readdirSync(this.documentsPath).filter((f: string) => f.endsWith(".json"));

      let totalSize = 0;
      let latestUpdate = "";

      for (const file of files) {
        const stat = statSync(join(this.documentsPath, file));
        totalSize += stat.size;
        if (!latestUpdate || stat.mtime.toISOString() > latestUpdate) {
          latestUpdate = stat.mtime.toISOString();
        }
      }

      return {
        documents: files.length,
        indexSize: totalSize,
        lastUpdated: latestUpdate || new Date().toISOString(),
      };
    } catch {
      return {
        documents: 0,
        indexSize: 0,
        lastUpdated: new Date().toISOString(),
      };
    }
  }
}

// ============================================================
// SINGLETON EXPORT
// ============================================================

let _ckSearch: CKSearch | null = null;

export function getCKSearch(boardPath: string): CKSearch {
  if (!_ckSearch) {
    _ckSearch = new CKSearch(boardPath);
  }
  return _ckSearch;
}

export function resetCKSearch(): void {
  _ckSearch = null;
}
