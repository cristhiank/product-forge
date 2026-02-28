/**
 * Agent Collaboration Board - Search Tests
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CKSearch } from "../src/search/ck-search.js";
import { GraphIndex } from "../src/search/graph-index.js";
import { TemporalIndex } from "../src/search/temporal-index.js";
import type { DecisionId, FactId, StepId } from "../src/types/core.js";

describe("GraphIndex", () => {
  let tempDir: string;
  let graphIndex: GraphIndex;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "graph-test-"));
    graphIndex = new GraphIndex(tempDir);
  });

  afterEach(() => {
    graphIndex.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("Node Operations", () => {
    it("should add and check nodes", () => {
      graphIndex.addNode("F-1" as FactId, "fact");
      expect(graphIndex.hasNode("F-1" as FactId)).toBe(true);
      expect(graphIndex.hasNode("F-2" as FactId)).toBe(false);
    });

    it("should remove nodes and their edges", () => {
      graphIndex.addNode("F-1" as FactId, "fact");
      graphIndex.addNode("F-2" as FactId, "fact");
      graphIndex.addEdge("F-1" as FactId, "F-2" as FactId, "supports");

      graphIndex.removeNode("F-1" as FactId);

      expect(graphIndex.hasNode("F-1" as FactId)).toBe(false);
      expect(graphIndex.getOutgoing("F-1" as FactId)).toHaveLength(0);
    });
  });

  describe("Edge Operations", () => {
    it("should add edges between entities", () => {
      graphIndex.addEdge("F-1" as FactId, "D-1" as DecisionId, "supports");

      const outgoing = graphIndex.getOutgoing("F-1" as FactId);
      expect(outgoing).toHaveLength(1);
      expect(outgoing[0].to).toBe("D-1");
      expect(outgoing[0].relation).toBe("supports");
    });

    it("should get incoming edges", () => {
      graphIndex.addEdge("F-1" as FactId, "D-1" as DecisionId, "supports");
      graphIndex.addEdge("F-2" as FactId, "D-1" as DecisionId, "supports");

      const incoming = graphIndex.getIncoming("D-1" as DecisionId);
      expect(incoming).toHaveLength(2);
    });

    it("should filter edges by relation type", () => {
      graphIndex.addEdge("F-1" as FactId, "D-1" as DecisionId, "supports");
      graphIndex.addEdge("F-1" as FactId, "F-2" as FactId, "contradicts");

      const supports = graphIndex.getOutgoing("F-1" as FactId, "supports");
      expect(supports).toHaveLength(1);

      const contradicts = graphIndex.getOutgoing("F-1" as FactId, "contradicts");
      expect(contradicts).toHaveLength(1);
    });

    it("should remove specific edges", () => {
      graphIndex.addEdge("F-1" as FactId, "D-1" as DecisionId, "supports");
      graphIndex.addEdge("F-1" as FactId, "D-1" as DecisionId, "based_on");

      graphIndex.removeEdge("F-1" as FactId, "D-1" as DecisionId, "supports");

      const outgoing = graphIndex.getOutgoing("F-1" as FactId);
      expect(outgoing).toHaveLength(1);
      expect(outgoing[0].relation).toBe("based_on");
    });
  });

  describe("Traversal", () => {
    beforeEach(() => {
      // Create a simple graph:
      // F-1 -> D-1 -> S-1
      //    \-> F-2
      graphIndex.addEdge("F-1" as FactId, "D-1" as DecisionId, "supports");
      graphIndex.addEdge("F-1" as FactId, "F-2" as FactId, "contradicts");
      graphIndex.addEdge("D-1" as DecisionId, "S-1" as StepId, "affects");
    });

    it("should traverse outgoing edges", () => {
      const result = graphIndex.traverse("F-1" as FactId, {
        direction: "outgoing",
        maxDepth: 2,
      });

      expect(result.nodes).toContain("D-1");
      expect(result.nodes).toContain("F-2");
      expect(result.nodes).toContain("S-1");
    });

    it("should respect depth limits", () => {
      const result = graphIndex.traverse("F-1" as FactId, {
        direction: "outgoing",
        maxDepth: 1,
      });

      expect(result.nodes).toContain("D-1");
      expect(result.nodes).toContain("F-2");
      expect(result.nodes).not.toContain("S-1"); // Depth 2
    });

    it("should traverse by relation type", () => {
      const result = graphIndex.traverse("F-1" as FactId, {
        direction: "outgoing",
        relation: "supports",
        maxDepth: 2,
      });

      expect(result.nodes).toContain("D-1");
      expect(result.nodes).not.toContain("F-2"); // contradicts relation
    });

    it("should find shortest path", () => {
      const path = graphIndex.findPath("F-1" as FactId, "S-1" as StepId);

      expect(path).not.toBeNull();
      expect(path!.nodes).toEqual(["F-1", "D-1", "S-1"]);
      expect(path!.edges).toHaveLength(2);
    });

    it("should return null when no path exists", () => {
      graphIndex.addNode("F-99" as FactId, "fact"); // Isolated node

      const path = graphIndex.findPath("F-1" as FactId, "F-99" as FactId);
      expect(path).toBeNull();
    });
  });

  describe("Helper Methods", () => {
    it("should get supporting entities", () => {
      graphIndex.addEdge("F-1" as FactId, "D-1" as DecisionId, "supports");
      graphIndex.addEdge("F-2" as FactId, "D-1" as DecisionId, "supports");

      const supporting = graphIndex.getSupporting("D-1" as DecisionId);
      expect(supporting).toContain("F-1");
      expect(supporting).toContain("F-2");
    });

    it("should get contradicting entities", () => {
      graphIndex.addEdge("F-1" as FactId, "F-2" as FactId, "contradicts");

      const contradicting = graphIndex.getContradicting("F-1" as FactId);
      expect(contradicting).toContain("F-2");
    });

    it("should get dependencies", () => {
      graphIndex.addEdge("S-2" as StepId, "S-1" as StepId, "depends_on");
      graphIndex.addEdge("S-3" as StepId, "S-1" as StepId, "depends_on");

      const deps = graphIndex.getDependencies("S-2" as StepId);
      expect(deps).toContain("S-1");

      const dependents = graphIndex.getDependents("S-1" as StepId);
      expect(dependents).toContain("S-2");
      expect(dependents).toContain("S-3");
    });
  });

  describe("Statistics", () => {
    it("should return correct stats", () => {
      graphIndex.addEdge("F-1" as FactId, "D-1" as DecisionId, "supports");
      graphIndex.addEdge("F-2" as FactId, "D-1" as DecisionId, "supports");
      graphIndex.addEdge("D-1" as DecisionId, "S-1" as StepId, "affects");

      const stats = graphIndex.getStats();
      expect(stats.totalNodes).toBe(4);
      expect(stats.totalEdges).toBe(3);
      expect(stats.edgesByType.supports).toBe(2);
      expect(stats.edgesByType.affects).toBe(1);
    });
  });
});

describe("TemporalIndex", () => {
  let tempDir: string;
  let temporalIndex: TemporalIndex;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "temporal-test-"));
    temporalIndex = new TemporalIndex(tempDir);
  });

  afterEach(() => {
    temporalIndex.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("Event Recording", () => {
    it("should record events", () => {
      const now = new Date().toISOString();
      temporalIndex.recordEvent("F-1" as FactId, "fact", now, "exploration", "scout", "fact.add");

      const events = temporalIndex.query({});
      expect(events).toHaveLength(1);
      expect(events[0].id).toBe("F-1");
      expect(events[0].type).toBe("fact");
      expect(events[0].phase).toBe("exploration");
    });

    it("should record phase transitions", () => {
      const now = new Date().toISOString();
      temporalIndex.recordPhaseTransition(null, "setup", now);
      temporalIndex.recordPhaseTransition("setup", "exploration", now);

      const timeline = temporalIndex.getPhaseTimeline();
      expect(timeline).toHaveLength(2);
      expect(timeline[0].phase).toBe("setup");
      expect(timeline[1].phase).toBe("exploration");
    });
  });

  describe("Queries", () => {
    beforeEach(() => {
      const base = Date.now();

      // Add events at different times
      temporalIndex.recordEvent(
        "F-1" as FactId,
        "fact",
        new Date(base - 3600000).toISOString(), // 1 hour ago
        "exploration",
        "scout"
      );
      temporalIndex.recordEvent(
        "F-2" as FactId,
        "fact",
        new Date(base - 1800000).toISOString(), // 30 min ago
        "exploration",
        "scout"
      );
      temporalIndex.recordEvent(
        "D-1" as DecisionId,
        "decision",
        new Date(base - 900000).toISOString(), // 15 min ago
        "ideation",
        "creative"
      );
      temporalIndex.recordEvent(
        "S-1" as StepId,
        "step",
        new Date(base).toISOString(), // now
        "execution",
        "executor"
      );
    });

    it("should query by time range", () => {
      const thirtyMinAgo = new Date(Date.now() - 1800000).toISOString();
      const events = temporalIndex.query({ after: thirtyMinAgo });

      expect(events.length).toBeGreaterThanOrEqual(2);
    });

    it("should query by type", () => {
      const facts = temporalIndex.query({ types: ["fact"] });
      expect(facts).toHaveLength(2);
      expect(facts.every((e) => e.type === "fact")).toBe(true);
    });

    it("should query by phase", () => {
      const exploration = temporalIndex.query({ phases: ["exploration"] });
      expect(exploration).toHaveLength(2);
      expect(exploration.every((e) => e.phase === "exploration")).toBe(true);
    });

    it("should get recent events", () => {
      const recent = temporalIndex.getRecent(2);
      expect(recent).toHaveLength(2);
      // Most recent first
      expect(recent[0].id).toBe("S-1");
    });

    it("should get events by phase", () => {
      const ideation = temporalIndex.getByPhase("ideation");
      expect(ideation).toHaveLength(1);
      expect(ideation[0].id).toBe("D-1");
    });
  });

  describe("Timeline", () => {
    it("should generate hourly timeline", () => {
      const now = Date.now();

      // Add events in current hour
      temporalIndex.recordEvent("F-1" as FactId, "fact", new Date(now).toISOString(), "exploration");
      temporalIndex.recordEvent("F-2" as FactId, "fact", new Date(now).toISOString(), "exploration");
      temporalIndex.recordEvent("D-1" as DecisionId, "decision", new Date(now).toISOString(), "ideation");

      const timeline = temporalIndex.getHourlyTimeline();
      expect(timeline.length).toBeGreaterThan(0);

      const lastHour = timeline[timeline.length - 1];
      expect(lastHour.count).toBe(3);
      expect(lastHour.types.fact).toBe(2);
      expect(lastHour.types.decision).toBe(1);
    });
  });

  describe("Statistics", () => {
    it("should return correct stats", () => {
      temporalIndex.recordEvent("F-1" as FactId, "fact", new Date().toISOString(), "exploration");
      temporalIndex.recordEvent("F-2" as FactId, "fact", new Date().toISOString(), "exploration");
      temporalIndex.recordEvent("D-1" as DecisionId, "decision", new Date().toISOString(), "ideation");

      const stats = temporalIndex.getStats();
      expect(stats.totalEvents).toBe(3);
      expect(stats.eventsByType.fact).toBe(2);
      expect(stats.eventsByType.decision).toBe(1);
      expect(stats.eventsByPhase.exploration).toBe(2);
      expect(stats.eventsByPhase.ideation).toBe(1);
    });
  });
});

describe("CKSearch", () => {
  let tempDir: string;
  let ckSearch: CKSearch;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "ck-test-"));
    ckSearch = new CKSearch(tempDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("Indexing", () => {
    it("should index entities", async () => {
      await ckSearch.index(
        {
          id: "F-1" as FactId,
          content: "The API uses REST endpoints for communication",
          confidence: "high" as const,
          evidence: [{ type: "file" as const, reference: "routes.ts" }],
          source: "scout" as const,
          discovered_at: new Date().toISOString(),
          tags: ["api"],
        },
        "fact"
      );

      const stats = ckSearch.getStats();
      expect(stats.documents).toBe(1);
    });

    it("should index batch of entities", async () => {
      await ckSearch.indexBatch([
        {
          entity: {
            id: "F-1" as FactId,
            content: "REST API",
            confidence: "high" as const,
            evidence: [],
            source: "scout" as const,
            discovered_at: new Date().toISOString(),
            tags: [],
          },
          type: "fact",
        },
        {
          entity: {
            id: "F-2" as FactId,
            content: "GraphQL support",
            confidence: "medium" as const,
            evidence: [],
            source: "scout" as const,
            discovered_at: new Date().toISOString(),
            tags: [],
          },
          type: "fact",
        },
      ]);

      const stats = ckSearch.getStats();
      expect(stats.documents).toBe(2);
    });
  });

  describe("Fallback Search", () => {
    beforeEach(async () => {
      // Index some test entities
      await ckSearch.index(
        {
          id: "F-1" as FactId,
          content: "The authentication system uses JWT tokens",
          confidence: "high" as const,
          evidence: [{ type: "file" as const, reference: "auth.ts" }],
          source: "scout" as const,
          discovered_at: new Date().toISOString(),
          tags: ["auth", "security"],
        },
        "fact"
      );
      await ckSearch.index(
        {
          id: "F-2" as FactId,
          content: "Database uses PostgreSQL with connection pooling",
          confidence: "high" as const,
          evidence: [{ type: "file" as const, reference: "db.ts" }],
          source: "scout" as const,
          discovered_at: new Date().toISOString(),
          tags: ["database"],
        },
        "fact"
      );
    });

    it("should search by text", async () => {
      const results = await ckSearch.search("JWT tokens", { mode: "hybrid" });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe("F-1");
    });

    it("should return empty for no match", async () => {
      const results = await ckSearch.search("nonexistent query xyz", { mode: "hybrid" });
      expect(results).toHaveLength(0);
    });

    it("should include highlights", async () => {
      const results = await ckSearch.search("authentication", { mode: "hybrid" });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].highlights).toBeDefined();
      expect(results[0].highlights!.length).toBeGreaterThan(0);
    });

    it("should respect limit", async () => {
      const results = await ckSearch.search("the", { mode: "hybrid", limit: 1 });
      expect(results.length).toBeLessThanOrEqual(1);
    });
  });

  describe("Clear", () => {
    it("should clear all documents", async () => {
      await ckSearch.index(
        {
          id: "F-1" as FactId,
          content: "Test",
          confidence: "high" as const,
          evidence: [],
          source: "scout" as const,
          discovered_at: new Date().toISOString(),
          tags: [],
        },
        "fact"
      );

      await ckSearch.clear();

      const stats = ckSearch.getStats();
      expect(stats.documents).toBe(0);
    });
  });
});
