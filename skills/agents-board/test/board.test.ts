/**
 * Agent Collaboration Board - Unit Tests
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Board } from "../src/board.js";

describe("Board", () => {
  let tempDir: string;
  let board: Board;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "board-test-"));
    const taskPath = join(tempDir, ".dev_partner", "tasks", "test-task");
    board = new Board(taskPath);
  });

  afterEach(() => {
    board.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("Lifecycle", () => {
    it("should create a new board", () => {
      const result = board.create({
        goal: "Implement feature X",
        context: "Test context",
        constraints: ["No breaking changes", "Must preserve existing behavior"],
      });

      expect(result.task_id).toMatch(/^\d{8}-\d{6}-\d{3}$/);
      expect(result.board_path).toContain(join(".dev_partner", "tasks"));
      expect(board.exists()).toBe(true);
    });

    it("should not allow creating duplicate boards", () => {
      board.create({ goal: "Test" });
      expect(() => board.create({ goal: "Test 2" })).toThrow("Board already exists");
    });

    it("should read board state", () => {
      board.create({ goal: "Test goal" });
      const state = board.getBoard();

      expect(state.meta.schema_version).toBe("2.0");
      expect(state.mission.goal).toBe("Test goal");
      expect(state.status.phase).toBe("setup");
      expect(state.facts).toEqual([]);
      expect(state.decisions).toEqual([]);
      expect(state.alerts).toEqual([]);
    });
  });

  describe("Facts", () => {
    beforeEach(() => {
      board.create({ goal: "Test" });
    });

    it("should add a fact", () => {
      const fact = board.addFact("scout", {
        content: "The API uses REST endpoints",
        confidence: "high",
        evidence: [
          { type: "file", reference: "src/api/routes.ts", excerpt: "app.get('/api/users')" },
        ],
        tags: ["api", "architecture"],
      });

      expect(fact.id).toBe("F-1");
      expect(fact.content).toBe("The API uses REST endpoints");
      expect(fact.confidence).toBe("high");
      expect(fact.source).toBe("scout");
      expect(fact.tags).toEqual(["api", "architecture"]);
    });

    it("should verify a fact", () => {
      const fact = board.addFact("scout", {
        content: "Test fact",
        confidence: "medium",
        evidence: [{ type: "file", reference: "test.ts" }],
      });

      const verified = board.verifyFact("verifier", {
        id: fact.id,
        confidence: "high",
      });

      expect(verified.verified_by).toBe("verifier");
      expect(verified.verified_at).toBeDefined();
      expect(verified.confidence).toBe("high");
    });

    it("should filter facts", () => {
      board.addFact("scout", {
        content: "High confidence fact",
        confidence: "high",
        evidence: [{ type: "file", reference: "a.ts" }],
        tags: ["important"],
      });
      board.addFact("scout", {
        content: "Low confidence fact",
        confidence: "low",
        evidence: [{ type: "file", reference: "b.ts" }],
      });

      const highConfidence = board.getFacts({ confidence: ["high"] });
      expect(highConfidence).toHaveLength(1);
      expect(highConfidence[0].content).toBe("High confidence fact");

      const tagged = board.getFacts({ tags: ["important"] });
      expect(tagged).toHaveLength(1);
    });

    it("should allow any agent to add facts (agent-agnostic)", () => {
      const fact = board.addFact("orchestrator", {
        content: "Any agent can add facts",
        confidence: "high",
        evidence: [],
      });
      expect(fact.id).toBeDefined();
      expect(fact.content).toBe("Any agent can add facts");
    });

    it("should allow any agent to verify facts (agent-agnostic)", () => {
      const fact = board.addFact("scout", {
        content: "Test",
        confidence: "low",
        evidence: [],
      });

      const result = board.verifyFact("scout", { id: fact.id });
      expect(result.id).toBe(fact.id);
    });
  });

  describe("Decisions", () => {
    beforeEach(() => {
      board.create({ goal: "Test" });
    });

    it("should propose a decision", () => {
      const decision = board.proposeDecision("creative", {
        title: "Use TypeScript",
        description: "Use TypeScript for type safety",
        rationale: "Better developer experience and fewer runtime errors",
        alternatives: [
          {
            name: "JavaScript",
            description: "Plain JavaScript",
            pros: ["Simpler setup"],
            cons: ["No type safety"],
          },
        ],
        tags: ["language"],
      });

      expect(decision.id).toBe("D-1");
      expect(decision.status).toBe("proposed");
      expect(decision.proposed_by).toBe("creative");
    });

    it("should approve a decision", () => {
      const proposed = board.proposeDecision("creative", {
        title: "Test decision",
        description: "Test",
        rationale: "Test",
      });

      const approved = board.approveDecision("orchestrator", {
        id: proposed.id,
      });

      expect(approved.status).toBe("approved");
      expect(approved.approved_by).toBe("orchestrator");
      expect(approved.approved_at).toBeDefined();
    });

    it("should reject a decision", () => {
      const proposed = board.proposeDecision("creative", {
        title: "Bad idea",
        description: "Test",
        rationale: "Test",
      });

      const rejected = board.rejectDecision("orchestrator", {
        id: proposed.id,
        reason: "Does not align with requirements",
      });

      expect(rejected.status).toBe("rejected");
      expect(rejected.alternatives).toContainEqual(
        expect.objectContaining({
          rejected_reason: "Does not align with requirements",
        })
      );
    });

    it("should not approve already approved decision", () => {
      const proposed = board.proposeDecision("creative", {
        title: "Test",
        description: "Test",
        rationale: "Test",
      });

      board.approveDecision("orchestrator", { id: proposed.id });

      expect(() =>
        board.approveDecision("orchestrator", { id: proposed.id })
      ).toThrow("not in 'proposed' status");
    });
  });

  describe("Plan", () => {
    beforeEach(() => {
      board.create({ goal: "Test" });
    });

    it("should set a plan", () => {
      const plan = board.setPlan("orchestrator", {
        goal: "Implement feature",
        approach: "Step by step",
        steps: [
          { action: "Create types", files: ["types.ts"], verification: "TypeScript compiles" },
          {
            action: "Implement logic",
            files: ["logic.ts"],
            depends_on: [1],
            verification: "Tests pass",
          },
          {
            action: "Add tests",
            files: ["logic.test.ts"],
            depends_on: [2],
            verification: "Coverage > 80%",
          },
        ],
      });

      expect(plan.steps).toHaveLength(3);
      expect(plan.steps[0].id).toBe("S-1");
      expect(plan.steps[1].depends_on).toEqual(["S-1"]);
      expect(plan.current_step).toBe(0);
    });

    it("should advance steps", () => {
      board.setPlan("orchestrator", {
        goal: "Test",
        approach: "Test",
        steps: [
          { action: "Step 1", files: ["a.ts"], verification: "OK" },
          { action: "Step 2", files: ["b.ts"], verification: "OK" },
        ],
      });

      const step = board.advanceStep("executor");
      expect(step?.number).toBe(2);
      expect(step?.status).toBe("in_progress");
    });

    it("should complete steps", () => {
      board.setPlan("orchestrator", {
        goal: "Test",
        approach: "Test",
        steps: [{ action: "Step 1", files: ["a.ts"], verification: "OK" }],
      });

      board.advanceStep("executor");

      const completed = board.completeStep("executor", {
        result: {
          files_changed: ["a.ts"],
          files_created: [],
          verification_passed: true,
        },
      });

      expect(completed.status).toBe("complete");
      expect(completed.result?.verification_passed).toBe(true);
    });

    it("should fail steps and block execution", () => {
      board.setPlan("orchestrator", {
        goal: "Test",
        approach: "Test",
        steps: [{ action: "Failing step", files: ["x.ts"], verification: "OK" }],
      });

      board.advanceStep("executor");
      board.failStep("executor", { reason: "Build error" });

      const status = board.getStatus();
      expect(status.phase).toBe("blocked");
      expect(status.progress.execution).toBe("blocked");
    });
  });

  describe("Alerts", () => {
    beforeEach(() => {
      board.create({ goal: "Test" });
    });

    it("should raise an alert", () => {
      const alert = board.raiseAlert("scout", {
        severity: "major",
        title: "Security issue found",
        description: "SQL injection vulnerability in user input",
        tags: ["security"],
      });

      expect(alert.id).toBe("A-1");
      expect(alert.severity).toBe("major");
      expect(alert.resolved).toBe(false);
      expect(alert.raised_by).toBe("scout");
    });

    it("should resolve an alert", () => {
      const alert = board.raiseAlert("scout", {
        severity: "minor",
        title: "Test alert",
        description: "Test",
      });

      const resolved = board.resolveAlert("verifier", {
        id: alert.id,
        resolution: "Fixed by sanitizing input",
      });

      expect(resolved.resolved).toBe(true);
      expect(resolved.resolved_by).toBe("verifier");
      expect(resolved.resolution).toBe("Fixed by sanitizing input");
    });

    it("should block on blocker alerts", () => {
      board.raiseAlert("verifier", {
        severity: "blocker",
        title: "Critical issue",
        description: "Must fix before proceeding",
      });

      const status = board.getStatus();
      expect(status.phase).toBe("blocked");
    });

    it("should unblock when blocker is resolved", () => {
      board.setPlan("orchestrator", {
        goal: "Test",
        approach: "Test",
        steps: [{ action: "Step", files: [], verification: "OK" }],
      });
      board.updateStatus("orchestrator", { phase: "execution" });

      const alert = board.raiseAlert("verifier", {
        severity: "blocker",
        title: "Blocker",
        description: "Blocking",
      });

      expect(board.getStatus().phase).toBe("blocked");

      board.resolveAlert("verifier", {
        id: alert.id,
        resolution: "Fixed",
      });

      expect(board.getStatus().phase).toBe("execution");
    });
  });

  describe("Constraints", () => {
    beforeEach(() => {
      board.create({ goal: "Test" });
    });

    it("should add constraints", () => {
      const constraint = board.addConstraint("scout", {
        description: "Must not modify shared module",
        source: "discovered",
      });

      expect(constraint.id).toBe("C-1");
      expect(constraint.added_by).toBe("scout");

      const mission = board.getMission();
      expect(mission.constraints).toContainEqual(expect.objectContaining({ id: "C-1" }));
    });
  });

  describe("Search", () => {
    beforeEach(() => {
      board.create({ goal: "Test" });
      board.addFact("scout", {
        content: "API uses REST endpoints",
        confidence: "high",
        evidence: [{ type: "file", reference: "routes.ts" }],
        tags: ["api"],
      });
      board.addFact("scout", {
        content: "Database uses PostgreSQL",
        confidence: "medium",
        evidence: [{ type: "file", reference: "db.ts" }],
        tags: ["database"],
      });
    });

    it("should search by text", () => {
      const results = board.search({ text: "REST" });
      expect(results.results).toHaveLength(1);
      expect(results.results[0].entity).toMatchObject({ content: "API uses REST endpoints" });
    });

    it("should search by tags", () => {
      const results = board.search({ filters: { tags: ["database"] } });
      expect(results.results).toHaveLength(1);
    });

    it("should search by type", () => {
      const results = board.search({ filters: { types: ["fact"] } });
      expect(results.results).toHaveLength(2);
    });
  });

  describe("View Compilation", () => {
    beforeEach(() => {
      board.create({
        goal: "Implement authentication",
        constraints: ["Must use JWT", "No cookies"],
      });

      // Add some facts
      for (let i = 0; i < 10; i++) {
        board.addFact("scout", {
          content: `Fact ${i}`,
          confidence: i < 3 ? "high" : "medium",
          evidence: [{ type: "file", reference: `file${i}.ts` }],
        });
      }

      // Add a decision
      const decision = board.proposeDecision("creative", {
        title: "Use bcrypt",
        description: "Use bcrypt for password hashing",
        rationale: "Industry standard",
      });
      board.approveDecision("orchestrator", { id: decision.id });

      // Set plan
      board.setPlan("orchestrator", {
        goal: "Auth",
        approach: "Step by step",
        steps: [
          { action: "Add types", files: ["auth.ts"], verification: "Compiles" },
          { action: "Implement", files: ["auth.ts"], verification: "Tests pass" },
        ],
      });
    });

    it("should compile minimal view", () => {
      const view = board.compileView({
        agent: "executor",
        budget: { max_tokens: 500 },
      });

      expect(view.mission.goal).toBe("Implement authentication");
      expect(view.token_estimate).toBeLessThan(500);
      expect(view.current_step).toBeDefined();
    });

    it("should include current step for executor", () => {
      board.advanceStep("executor");

      const view = board.compileView({ agent: "executor" });
      expect(view.current_step?.number).toBe(2);
      expect(view.current_step?.action).toBe("Implement");
    });

    it("should prioritize high confidence facts", () => {
      const view = board.compileView({
        agent: "verifier",
        budget: { max_facts: 5 },
      });

      // High confidence facts should come first
      const highConfidence = view.facts.filter((f) => f.confidence === "high");
      expect(highConfidence.length).toBeGreaterThan(0);
    });

    it("should include unresolved alerts", () => {
      board.raiseAlert("verifier", {
        severity: "major",
        title: "Test alert",
        description: "Test",
      });

      const view = board.compileView({ agent: "orchestrator" });
      expect(view.alerts).toHaveLength(1);
    });
  });

  describe("Audit Log", () => {
    beforeEach(() => {
      board.create({ goal: "Test" });
    });

    it("should log all operations", () => {
      board.addFact("scout", {
        content: "Test fact",
        confidence: "high",
        evidence: [],
      });

      const audit = board.getAuditLog();
      expect(audit.length).toBeGreaterThan(1);

      const factEntry = audit.find((e) => e.action === "fact.add");
      expect(factEntry).toBeDefined();
      expect(factEntry?.agent).toBe("scout");
      expect(factEntry?.target.type).toBe("fact");
    });
  });

  describe("Snippets", () => {
    beforeEach(() => {
      board.create({ goal: "Test" });
    });

    it("should add snippets", () => {
      const snippet = board.addSnippet("scout", {
        path: "src/auth.ts",
        lines: [1, 50],
        content: "export class Auth { /* ... */ }",
        purpose: "Auth implementation for token validation",
        tags: ["auth", "security"],
      });

      expect(snippet.id).toBe("X-1");
      expect(snippet.path).toBe("src/auth.ts");
      expect(snippet.lines).toEqual([1, 50]);
      expect(snippet.content).toBe("export class Auth { /* ... */ }");
      expect(snippet.purpose).toBe("Auth implementation for token validation");
      expect(snippet.added_by).toBe("scout");
      expect(snippet.tags).toEqual(["auth", "security"]);
    });

    it("should retrieve snippets with filter", () => {
      board.addSnippet("scout", {
        content: "Auth content",
        purpose: "Auth module",
        path: "src/auth.ts",
        tags: ["auth"],
      });

      board.addSnippet("scout", {
        content: "Database content",
        purpose: "Database module",
        path: "src/db.ts",
        tags: ["database"],
      });

      const authSnippets = board.getSnippets({ tags: ["auth"], evict_stale: false });
      expect(authSnippets).toHaveLength(1);
      expect(authSnippets[0].path).toBe("src/auth.ts");

      const dbSnippets = board.getSnippets({ path: "db", evict_stale: false });
      expect(dbSnippets).toHaveLength(1);
      expect(dbSnippets[0].path).toBe("src/db.ts");
    });

    it("should update snippets", () => {
      const snippet = board.addSnippet("scout", {
        content: "Original content",
        purpose: "Test",
        tags: [],
      });

      const updated = board.updateSnippet("executor", {
        id: snippet.id,
        content: "Updated content",
        purpose: "Updated purpose",
      });

      expect(updated.content).toBe("Updated content");
      expect(updated.purpose).toBe("Updated purpose");
    });

    it("should verify snippets and reset staleness", () => {
      const snippet = board.addSnippet("scout", {
        content: "Test content",
        purpose: "Test",
        tags: [],
      });

      const verified = board.verifySnippet("verifier", {
        id: snippet.id,
      });

      expect(verified.verified_at).toBeDefined();
    });

    it("should verify snippets with content update", () => {
      const snippet = board.addSnippet("scout", {
        content: "Old content",
        purpose: "Test",
        tags: [],
      });

      const verified = board.verifySnippet("executor", {
        id: snippet.id,
        content: "New verified content",
      });

      expect(verified.verified_at).toBeDefined();
      expect(verified.content).toBe("New verified content");
    });

    it("should get formatted snippets with staleness header", () => {
      board.addSnippet("scout", {
        path: "src/test.ts",
        content: "Test content",
        purpose: "Test purpose",
        tags: ["test"],
      });

      const formatted = board.getSnippetsFormatted({ tags: ["test"], evict_stale: false });
      expect(formatted).toHaveLength(1);
      expect(formatted[0].staleness).toBe("fresh");
      expect(formatted[0].formatted).toContain("Source: src/test.ts");
      expect(formatted[0].formatted).toContain("Purpose: Test purpose");
      expect(formatted[0].formatted).toContain("Test content");
    });

    it("should allow all agents to add snippets", () => {
      const agents = ["orchestrator", "scout", "creative", "verifier", "executor"] as const;

      agents.forEach((agent) => {
        const snippet = board.addSnippet(agent, {
          content: `Content from ${agent}`,
          purpose: `Added by ${agent}`,
          tags: [agent],
        });
        expect(snippet.added_by).toBe(agent);
      });

      const allSnippets = board.getSnippets({ evict_stale: false });
      expect(allSnippets).toHaveLength(5);
    });

    it("should link snippets to facts", () => {
      const fact = board.addFact("scout", {
        content: "Auth uses JWT",
        confidence: "high",
        evidence: [],
        tags: ["auth"],
      });

      const snippet = board.addSnippet("scout", {
        content: "JWT implementation code",
        purpose: "JWT auth implementation",
        linked_to: [fact.id],
        tags: ["auth"],
      });

      expect(snippet.linked_to).toContain(fact.id);
    });

    it("should evict stale snippets manually", () => {
      // Add a snippet and manually make it stale by backdating added_at
      const snippet = board.addSnippet("scout", {
        content: "Stale content",
        purpose: "Will become stale",
        tags: ["test"],
      });

      // Manually update the snippet to be stale (>120min old)
      const storage = (board as any).storage;
      const snippets = storage.getSnippets();
      const staleTime = new Date(Date.now() - 130 * 60 * 1000).toISOString(); // 130 minutes ago
      snippets[0].added_at = staleTime;
      storage.rewriteJsonl("snippets.jsonl", snippets);

      // Verify it's now stale (disable auto-evict to check count)
      const beforeEvict = board.getSnippets({ evict_stale: false });
      expect(beforeEvict).toHaveLength(1);

      // Evict stale snippets manually
      const evictedCount = board.evictStaleSnippets();
      expect(evictedCount).toBe(1);

      // Verify it was deleted
      const afterEvict = board.getSnippets({ evict_stale: false });
      expect(afterEvict).toHaveLength(0);
    });

    it("should auto-evict stale snippets in background by default", async () => {
      // Add two snippets
      board.addSnippet("scout", {
        content: "Fresh content",
        purpose: "Fresh snippet",
        tags: ["fresh"],
      });

      board.addSnippet("scout", {
        content: "Will be stale",
        purpose: "Stale snippet",
        tags: ["stale"],
      });

      // Manually make the second snippet stale
      const storage = (board as any).storage;
      const snippets = storage.getSnippets();
      const staleTime = new Date(Date.now() - 130 * 60 * 1000).toISOString();
      snippets[1].added_at = staleTime;
      storage.rewriteJsonl("snippets.jsonl", snippets);

      // Query without evict_stale: false triggers background eviction
      const result = board.getSnippets(); // evict_stale defaults to true

      // Query returns immediately with both snippets (eviction is in background)
      expect(result).toHaveLength(2);

      // Wait for background eviction to complete
      await new Promise((r) => setImmediate(r));

      // Verify the stale one was deleted in background
      const afterEvict = board.getSnippets({ evict_stale: false });
      expect(afterEvict).toHaveLength(1);
      expect(afterEvict[0].tags).toContain("fresh");
    });

    it("should skip eviction when evict_stale is false", () => {
      // Add a snippet and make it stale
      board.addSnippet("scout", {
        content: "Stale content",
        purpose: "Will stay",
        tags: ["stale"],
      });

      const storage = (board as any).storage;
      const snippets = storage.getSnippets();
      const staleTime = new Date(Date.now() - 130 * 60 * 1000).toISOString();
      snippets[0].added_at = staleTime;
      storage.rewriteJsonl("snippets.jsonl", snippets);

      // Query with evict_stale: false - should not trigger eviction
      const result = board.getSnippets({ evict_stale: false });
      expect(result).toHaveLength(1);

      // Snippet should still exist
      const stillThere = board.getSnippets({ evict_stale: false });
      expect(stillThere).toHaveLength(1);
    });

    it("should not evict non-stale snippets", () => {
      // Add fresh and warn-level snippets
      board.addSnippet("scout", {
        content: "Fresh content",
        purpose: "Fresh snippet",
        tags: ["fresh"],
      });

      // Make one snippet in the "warn" zone (45 minutes old)
      const storage = (board as any).storage;
      const snippets = storage.getSnippets();
      const warnTime = new Date(Date.now() - 45 * 60 * 1000).toISOString();
      snippets[0].added_at = warnTime;
      storage.rewriteJsonl("snippets.jsonl", snippets);

      // Evict should not remove warn-level snippets
      const evictedCount = board.evictStaleSnippets();
      expect(evictedCount).toBe(0);

      const remaining = board.getSnippets({ evict_stale: false });
      expect(remaining).toHaveLength(1);
    });

    it("should respect verified_at for staleness calculation", () => {
      // Add a snippet that was added long ago but recently verified
      board.addSnippet("scout", {
        content: "Verified content",
        purpose: "Recently verified",
        tags: ["verified"],
      });

      // Make added_at stale but verified_at recent
      const storage = (board as any).storage;
      const snippets = storage.getSnippets();
      const staleTime = new Date(Date.now() - 130 * 60 * 1000).toISOString();
      const freshTime = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      snippets[0].added_at = staleTime;
      snippets[0].verified_at = freshTime;
      storage.rewriteJsonl("snippets.jsonl", snippets);

      // Should not be evicted because verified_at is recent
      const evictedCount = board.evictStaleSnippets();
      expect(evictedCount).toBe(0);

      const remaining = board.getSnippets({ evict_stale: false });
      expect(remaining).toHaveLength(1);
    });
  });
});
