/**
 * Agent Collaboration Board - Sandboxed Code Execution
 *
 * Provides a safe execution environment for board operations.
 * Uses Node.js vm module with restricted context.
 */

import { runInNewContext, type Context } from "node:vm";
import type { Board } from "../board.js";
import type { AgentRole, EntityId, FactId, SnippetId, StepId, TaskPhase } from "../types/core.js";

// ============================================================
// TYPES
// ============================================================

export interface ExecuteRequest {
  code: string;
  agent: AgentRole;
  timeout?: number; // Default 5000ms
}

export interface ExecuteResponse {
  success: boolean;
  result?: unknown;
  error?: string;
  execution_time_ms: number;
}

// ============================================================
// BOARD API HELP
// ============================================================

export const BOARD_API_HELP = `
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

// ============================================================
// SANDBOX IMPLEMENTATION
// ============================================================

/**
 * Create a sandboxed board API for code execution
 */
export function createBoardAPI(board: Board, agent: AgentRole) {
  return {
    // Quick access helpers
    view: (mode?: "status" | "minimal" | "enhanced", viewAgent?: AgentRole, options?: { focus_step?: number; focus_entities?: EntityId[]; max_tokens?: number }) => {
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
          verification: status.verification,
        };
      } else if (effectiveMode === "minimal") {
        return board.compileView({
          agent: effectiveAgent,
          focus: options?.focus_step ? { step: options.focus_step } : undefined,
          budget: { max_tokens: options?.max_tokens || 1000 },
        });
      } else if (effectiveMode === "enhanced") {
        return board.compileEnhancedView({
          agent: effectiveAgent,
          focus: {
            step: options?.focus_step,
            entities: options?.focus_entities,
          },
          budget: { max_tokens: options?.max_tokens || 1000 },
        });
      }
      return { error: `Unknown view mode: ${effectiveMode}` };
    },

    // Read operations (no agent required)
    getMission: () => board.getMission(),
    getStatus: () => board.getStatus(),
    getPlan: () => board.getPlan(),

    getFacts: (filter?: Parameters<typeof board.getFacts>[0]) => board.getFacts(filter),
    getFact: (id: FactId) => board.getFact(id),

    getDecisions: (filter?: Parameters<typeof board.getDecisions>[0]) => board.getDecisions(filter),
    getDecision: (id: string) => board.getDecision(id as any),

    getAlerts: (filter?: Parameters<typeof board.getAlerts>[0]) => board.getAlerts(filter),
    getAlert: (id: string) => board.getAlert(id as any),

    getEntity: (id: EntityId) => board.getEntity(id),

    // Search
    search: (query: Parameters<typeof board.search>[0]) => board.search(query),
    advancedSearch: async (query: Parameters<typeof board.advancedSearch>[0]) => board.advancedSearch(query),
    textSearch: async (text: string, options?: Parameters<typeof board.textSearch>[1]) => board.textSearch(text, options),

    // Graph
    findRelated: (id: EntityId, options?: Parameters<typeof board.findRelated>[1]) => board.findRelated(id, options),
    findPath: (fromId: EntityId, toId: EntityId, relation?: Parameters<typeof board.findPath>[2]) => board.findPath(fromId, toId, relation),
    getSupporting: (id: EntityId) => board.getSupporting(id),
    getContradicting: (id: EntityId) => board.getContradicting(id),
    getDependencies: (stepId: StepId) => board.getDependencies(stepId),

    // Temporal
    findRecent: (limit?: number, types?: Parameters<typeof board.findRecent>[1]) => board.findRecent(limit, types),
    findInTimeRange: (after: string, before: string, types?: Parameters<typeof board.findInTimeRange>[2]) => board.findInTimeRange(after, before, types),
    findByPhase: (phase: TaskPhase, types?: Parameters<typeof board.findByPhase>[1]) => board.findByPhase(phase, types),
    getPhaseTimeline: () => board.getPhaseTimeline(),

    // Trails (read)
    getTrails: (filter?: Parameters<typeof board.getTrails>[0]) => board.getTrails(filter),
    getRecentTrails: (limit?: number) => board.getRecentTrails(limit),
    getTrailCount: () => board.getTrailCount(),

    // Snippets (read)
    getSnippets: (filter?: Parameters<typeof board.getSnippets>[0]) => board.getSnippets(filter),
    getSnippet: (id: SnippetId) => board.getSnippet(id),
    getSnippetFormatted: (id: SnippetId) => board.getSnippetFormatted(id),
    getSnippetsFormatted: (filter?: Parameters<typeof board.getSnippetsFormatted>[0]) => board.getSnippetsFormatted(filter),

    // Write operations (agent is bound from context)
    addFact: (request: Omit<Parameters<typeof board.addFact>[1], never>) =>
      board.addFact(agent, request),

    verifyFact: (request: Parameters<typeof board.verifyFact>[1]) =>
      board.verifyFact(agent, request),

    proposeDecision: (request: Parameters<typeof board.proposeDecision>[1]) =>
      board.proposeDecision(agent, request),

    approveDecision: (request: Parameters<typeof board.approveDecision>[1]) =>
      board.approveDecision(agent, request),

    rejectDecision: (request: Parameters<typeof board.rejectDecision>[1]) =>
      board.rejectDecision(agent, request),

    setPlan: (request: Parameters<typeof board.setPlan>[1]) =>
      board.setPlan(agent, request),

    advanceStep: () => board.advanceStep(agent),

    completeStep: (request: Parameters<typeof board.completeStep>[1]) =>
      board.completeStep(agent, request),

    failStep: (request: Parameters<typeof board.failStep>[1]) =>
      board.failStep(agent, request),

    decomposeStep: (stepId: StepId, subtasks: string[]) =>
      board.decomposeStep(agent, stepId, subtasks),

    completeSubtask: (stepId: StepId, subtaskIndex: number) =>
      board.completeSubtask(agent, stepId, subtaskIndex),

    raiseAlert: (request: Parameters<typeof board.raiseAlert>[1]) =>
      board.raiseAlert(agent, request),

    resolveAlert: (request: Parameters<typeof board.resolveAlert>[1]) =>
      board.resolveAlert(agent, request),

    addConstraint: (request: Parameters<typeof board.addConstraint>[1]) =>
      board.addConstraint(agent, request),

    updateStatus: (request: Parameters<typeof board.updateStatus>[1]) =>
      board.updateStatus(agent, request),

    appendTrail: (request: Parameters<typeof board.appendTrail>[1]) =>
      board.appendTrail(agent, request),

    // Snippets (write)
    addSnippet: (request: Parameters<typeof board.addSnippet>[1]) =>
      board.addSnippet(agent, request),

    updateSnippet: (request: Parameters<typeof board.updateSnippet>[1]) =>
      board.updateSnippet(agent, request),

    verifySnippet: (request: Parameters<typeof board.verifySnippet>[1]) =>
      board.verifySnippet(agent, request),

    evictStaleSnippets: () => board.evictStaleSnippets(),

    // Help
    help: () => BOARD_API_HELP,
  };
}

/**
 * Execute code in a sandboxed environment with board API access
 */
export async function executeCode(
  board: Board,
  request: ExecuteRequest
): Promise<ExecuteResponse> {
  const startTime = Date.now();
  const timeout = request.timeout || 5000;

  try {
    // Create board API bound to the requesting agent
    const boardAPI = createBoardAPI(board, request.agent);

    // Create sandbox context with limited globals
    const context: Context = {
      board: boardAPI,
      console: {
        log: () => {}, // Silenced
        warn: () => {},
        error: () => {},
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
      Promise,
      // No setTimeout, setInterval, fetch, require, etc.
    };

    // Wrap code to capture return value
    // Support both sync and async code
    const wrappedCode = `
      (async () => {
        ${request.code}
      })()
    `;

    // Execute in sandbox with timeout
    const result = await runInNewContext(wrappedCode, context, {
      timeout,
      displayErrors: false,
    });

    return {
      success: true,
      result,
      execution_time_ms: Date.now() - startTime,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);

    // Clean up error messages
    let cleanError = error;
    if (error.includes("Script execution timed out")) {
      cleanError = `Execution timed out after ${timeout}ms. Simplify your code or increase timeout.`;
    }

    return {
      success: false,
      error: cleanError,
      execution_time_ms: Date.now() - startTime,
    };
  }
}
