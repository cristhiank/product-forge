/**
 * Agent Collaboration Board - Main Board Class
 *
 * High-level interface that combines storage, indexing, and operations.
 * Integrated with UnifiedSearch for advanced search capabilities.
 */

import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DirectIndex } from "./index/direct-index.js";
import type { DirectIndexFilters } from "./index/index.js";
import { GraphIndex } from "./search/graph-index.js";
import type { GraphPath, TemporalEntry } from "./search/index.js";
import { UnifiedSearch, type UnifiedSearchQuery, type UnifiedSearchResponse } from "./search/index.js";
import { TemporalIndex } from "./search/temporal-index.js";
import { BoardStorage } from "./storage/board-storage.js";
import type {
    AgentRole,
    Alert,
    AlertId,
    AuditAction,
    Board as BoardState,
    Constraint,
    Decision,
    DecisionId,
    Entity,
    EntityId,
    EntityType,
    Fact,
    FactId,
    Mission,
    Plan,
    PlanStep,
    Snippet,
    SnippetId,
    Status,
    StepId,
    TaskId,
    TaskPhase,
    TrailDetails,
    TrailEntry,
    TrailId,
    TrailMarker,
} from "./types/core.js";
import { formatSnippetWithStaleness, getSnippetStaleness, now } from "./types/core.js";
import type {
    AddConstraintRequest,
    AddFactRequest,
    AddSnippetRequest,
    AlertFilter,
    AppendTrailRequest,
    ApproveDecisionRequest,
    CompactAlert,
    CompactDecision,
    CompactFact,
    CompiledView,
    CompleteStepRequest,
    CreateBoardRequest,
    CreateBoardResponse,
    DecisionFilter,
    Edge,
    FactFilter,
    FailStepRequest,
    ProposeDecisionRequest,
    RaiseAlertRequest,
    RejectDecisionRequest,
    RelationType,
    ResolveAlertRequest,
    SearchQuery,
    SearchResponse,
    SearchResult,
    SetMissionRequest,
    SetPlanRequest,
    SnippetFilter,
    TrailFilter,
    UpdateFactRequest,
    UpdateSnippetRequest,
    UpdateStatusRequest,
    VerifyFactRequest,
    VerifySnippetRequest,
    ViewRequest,
    WriteOperation,
} from "./types/operations.js";
import { canPerform, PERMISSIONS } from "./types/operations.js";

// ============================================================
// BOARD CLASS
// ============================================================

export class Board {
  private storage: BoardStorage;
  private index: DirectIndex;
  private graphIndex: GraphIndex;
  private temporalIndex: TemporalIndex;
  private unifiedSearch: UnifiedSearch;
  private trailsPath: string;
  private trailSequence: number = 0;

  /**
   * Create a Board instance.
   * @param boardPath - Path to a specific task board directory
   *                  (expected: <project>/.dev_partner/tasks/<task_id>/)
   */
  constructor(boardPath: string) {
    this.storage = new BoardStorage(boardPath);
    const resolvedBoardPath = this.storage.getBoardPath();
    this.index = new DirectIndex(resolvedBoardPath);
    this.graphIndex = new GraphIndex(resolvedBoardPath);
    this.temporalIndex = new TemporalIndex(resolvedBoardPath);
    this.unifiedSearch = new UnifiedSearch(resolvedBoardPath, (id) => this.getEntity(id));
    this.trailsPath = join(resolvedBoardPath, "trails.jsonl");

    // Load existing trail sequence if trails file exists
    if (existsSync(this.trailsPath)) {
      const lines = readFileSync(this.trailsPath, "utf-8").trim().split("\n").filter(Boolean);
      this.trailSequence = lines.length;
    }
  }

  // ============================================================
  // LIFECYCLE
  // ============================================================

  /**
   * Check if a board exists
   */
  exists(): boolean {
    return this.storage.exists();
  }

  /**
   * Create a new board
   */
  create(request: CreateBoardRequest): CreateBoardResponse {
    const result = this.storage.create(
      request.goal,
      request.context,
      request.constraints,
      request.taskId as TaskId | undefined
    );

    // Index initial constraints
    const mission = this.storage.getMission();
    for (const constraint of mission.constraints) {
      this.index.index(constraint, "constraint");
    }

    return result;
  }

  /**
   * Rebuild all indexes from storage
   */
  rebuildIndexes(): void {
    this.index.clear();

    // Index facts
    for (const fact of this.storage.getFacts()) {
      this.index.index(fact, "fact");
    }

    // Index decisions
    for (const decision of this.storage.getDecisions()) {
      this.index.index(decision, "decision");
    }

    // Index alerts
    for (const alert of this.storage.getAlerts()) {
      this.index.index(alert, "alert");
    }

    // Index constraints
    for (const constraint of this.storage.getMission().constraints) {
      this.index.index(constraint, "constraint");
    }

    // Index plan steps
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
  getBoard(): BoardState {
    return this.storage.getBoard();
  }

  /**
   * Get task ID
   */
  getTaskId(): TaskId {
    return this.storage.getMeta().task_id;
  }

  /**
   * Get mission
   */
  getMission(): Mission {
    return this.storage.getMission();
  }

  /**
   * Get facts with optional filter
   */
  getFacts(filter?: FactFilter): Fact[] {
    let facts = this.storage.getFacts();

    if (filter) {
      if (filter.confidence) {
        facts = facts.filter((f) => filter.confidence!.includes(f.confidence));
      }
      if (filter.tags && filter.tags.length > 0) {
        facts = facts.filter((f) => filter.tags!.every((t) => f.tags.includes(t)));
      }
      if (filter.source) {
        facts = facts.filter((f) => filter.source!.includes(f.source));
      }
      if (filter.verified !== undefined) {
        facts = facts.filter((f) =>
          filter.verified ? f.verified_at !== undefined : f.verified_at === undefined
        );
      }
    }

    return facts;
  }

  /**
   * Get single fact by ID
   */
  getFact(id: FactId): Fact | null {
    return this.storage.getFact(id);
  }

  /**
   * Get decisions with optional filter
   */
  getDecisions(filter?: DecisionFilter): Decision[] {
    let decisions = this.storage.getDecisions();

    if (filter) {
      if (filter.status) {
        decisions = decisions.filter((d) => filter.status!.includes(d.status));
      }
      if (filter.tags && filter.tags.length > 0) {
        decisions = decisions.filter((d) => filter.tags!.every((t) => d.tags.includes(t)));
      }
    }

    return decisions;
  }

  /**
   * Get single decision by ID
   */
  getDecision(id: DecisionId): Decision | null {
    return this.storage.getDecision(id);
  }

  /**
   * Get plan
   */
  getPlan(): Plan | null {
    return this.storage.getPlan();
  }

  /**
   * Get status
   */
  getStatus(): Status {
    return this.storage.getStatus();
  }

  /**
   * Get alerts with optional filter
   */
  getAlerts(filter?: AlertFilter): Alert[] {
    let alerts = this.storage.getAlerts();

    if (filter) {
      if (filter.severity) {
        alerts = alerts.filter((a) => filter.severity!.includes(a.severity));
      }
      if (filter.resolved !== undefined) {
        alerts = alerts.filter((a) => a.resolved === filter.resolved);
      }
      if (filter.tags && filter.tags.length > 0) {
        alerts = alerts.filter((a) => filter.tags!.every((t) => a.tags.includes(t)));
      }
    }

    return alerts;
  }

  /**
   * Get single alert by ID
   */
  getAlert(id: AlertId): Alert | null {
    return this.storage.getAlert(id);
  }

  /**
   * Get entity by ID (any type)
   */
  getEntity(id: EntityId): Entity | null {
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
  getSnippets(filter?: SnippetFilter): Snippet[] {
    // Auto-evict stale snippets in background (default: true)
    const shouldEvict = filter?.evict_stale !== false;
    if (shouldEvict) {
      // Run eviction in background so query returns immediately
      setImmediate(() => this.evictStaleSnippets());
    }

    let snippets = this.storage.getSnippets();

    if (filter) {
      if (filter.tags && filter.tags.length > 0) {
        snippets = snippets.filter((s) => filter.tags!.every((t) => s.tags.includes(t)));
      }
      if (filter.path) {
        snippets = snippets.filter((s) => s.path?.includes(filter.path!));
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
  evictStaleSnippets(): number {
    const snippets = this.storage.getSnippets();
    const staleIds = snippets
      .filter((s) => getSnippetStaleness(s) === "stale")
      .map((s) => s.id);

    if (staleIds.length === 0) {
      return 0;
    }

    const deletedCount = this.storage.deleteSnippets(staleIds);

    // Audit the eviction
    this.audit("orchestrator", "snippet.evict", { type: "snippet" as const }, {
      operation: "delete",
      after: { evicted_count: deletedCount, evicted_ids: staleIds },
    });

    return deletedCount;
  }

  /**
   * Get single snippet by ID
   */
  getSnippet(id: SnippetId): Snippet | null {
    return this.storage.getSnippet(id);
  }

  /**
   * Get snippet with staleness-aware formatting
   * Returns the snippet content with staleness header if applicable
   */
  getSnippetFormatted(id: SnippetId): string | null {
    const snippet = this.storage.getSnippet(id);
    if (!snippet) return null;
    return formatSnippetWithStaleness(snippet);
  }

  /**
   * Get all snippets formatted with staleness headers
   */
  getSnippetsFormatted(filter?: SnippetFilter): Array<{ id: SnippetId; formatted: string; staleness: "fresh" | "warn" | "stale" }> {
    const snippets = this.getSnippets(filter);
    return snippets.map((s) => ({
      id: s.id,
      formatted: formatSnippetWithStaleness(s),
      staleness: getSnippetStaleness(s),
    }));
  }

  // ============================================================
  // WRITE OPERATIONS
  // ============================================================

  /**
   * Check if agent can perform operation
   */
  canPerform(agent: AgentRole, operation: WriteOperation): boolean {
    return canPerform(agent, operation);
  }

  /**
   * Assert agent can perform operation
   */
  private assertPermission(agent: AgentRole, operation: WriteOperation): void {
    if (!this.canPerform(agent, operation)) {
      throw new Error(
        `Agent '${agent}' is not permitted to perform '${operation}'. ` +
          `Allowed agents: ${PERMISSIONS[operation].join(", ")}`
      );
    }
  }

  /**
   * Set mission (orchestrator only)
   */
  setMission(agent: AgentRole, request: SetMissionRequest): Mission {
    this.assertPermission(agent, "set_mission");

    const currentMission = this.storage.getMission();
    const mission: Mission = {
      goal: request.goal,
      constraints: currentMission.constraints,
      definition_of_done: request.definition_of_done || currentMission.definition_of_done,
      context: request.context || currentMission.context,
      routing: {
        ...currentMission.routing,
        ...request.routing,
      },
    };

    this.storage.writeMission(mission);
    this.audit(agent, "mission.set", { type: "mission" }, { operation: "update", after: mission });

    return mission;
  }

  /**
   * Add constraint
   */
  addConstraint(agent: AgentRole, request: AddConstraintRequest): Constraint {
    this.assertPermission(agent, "add_constraint");

    const constraint = this.storage.addConstraint({
      description: request.description,
      source: request.source || "discovered",
      added_by: agent,
      added_at: now(),
    });

    this.index.index(constraint, "constraint");
    this.audit(agent, "constraint.add", { type: "mission", id: constraint.id }, {
      operation: "create",
      after: constraint,
    });

    return constraint;
  }

  /**
   * Add fact
   */
  addFact(agent: AgentRole, request: AddFactRequest): Fact {
    this.assertPermission(agent, "add_fact");

    const fact = this.storage.appendFact({
      content: request.content,
      confidence: request.confidence,
      evidence: request.evidence,
      source: agent,
      discovered_at: now(),
      supports: request.supports,
      contradicts: request.contradicts,
      tags: request.tags || [],
    });

    this.index.index(fact, "fact");
    this.indexInGraphAndTemporal(fact, "fact", agent);
    this.audit(agent, "fact.add", { type: "fact", id: fact.id }, {
      operation: "create",
      after: fact,
    });

    return fact;
  }

  /**
   * Update fact
   */
  updateFact(agent: AgentRole, request: UpdateFactRequest): Fact {
    this.assertPermission(agent, "update_fact");

    const before = this.storage.getFact(request.id);
    if (!before) throw new Error(`Fact ${request.id} not found`);

    const fact = this.storage.updateFact(request.id, {
      content: request.content,
      confidence: request.confidence,
      evidence: request.evidence,
      tags: request.tags,
      supports: request.supports,
      contradicts: request.contradicts,
    });

    this.index.index(fact, "fact");
    this.audit(agent, "fact.update", { type: "fact", id: fact.id }, {
      operation: "update",
      before,
      after: fact,
    });

    return fact;
  }

  /**
   * Verify fact
   */
  verifyFact(agent: AgentRole, request: VerifyFactRequest): Fact {
    this.assertPermission(agent, "verify_fact");

    const before = this.storage.getFact(request.id);
    if (!before) throw new Error(`Fact ${request.id} not found`);

    const updates: Partial<Fact> = {
      verified_at: now(),
      verified_by: agent,
    };

    if (request.confidence) {
      updates.confidence = request.confidence;
    }

    const fact = this.storage.updateFact(request.id, updates);

    this.index.index(fact, "fact");
    this.audit(agent, "fact.verify", { type: "fact", id: fact.id }, {
      operation: "update",
      before,
      after: fact,
    });

    return fact;
  }

  /**
   * Propose decision
   */
  proposeDecision(agent: AgentRole, request: ProposeDecisionRequest): Decision {
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
      tags: request.tags || [],
    });

    this.index.index(decision, "decision");
    this.indexInGraphAndTemporal(decision, "decision", agent);
    this.audit(agent, "decision.propose", { type: "decision", id: decision.id }, {
      operation: "create",
      after: decision,
    });

    return decision;
  }

  /**
   * Approve decision
   */
  approveDecision(agent: AgentRole, request: ApproveDecisionRequest): Decision {
    this.assertPermission(agent, "approve_decision");

    const before = this.storage.getDecision(request.id as DecisionId);
    if (!before) throw new Error(`Decision ${request.id} not found`);

    if (before.status !== "proposed") {
      throw new Error(`Decision ${request.id} is not in 'proposed' status`);
    }

    const decision = this.storage.updateDecision(request.id as DecisionId, {
      status: "approved",
      approved_by: agent,
      approved_at: now(),
      affects: request.affects,
    });

    this.index.index(decision, "decision");
    this.audit(agent, "decision.approve", { type: "decision", id: decision.id }, {
      operation: "update",
      before,
      after: decision,
    });

    return decision;
  }

  /**
   * Reject decision
   */
  rejectDecision(agent: AgentRole, request: RejectDecisionRequest): Decision {
    this.assertPermission(agent, "reject_decision");

    const before = this.storage.getDecision(request.id as DecisionId);
    if (!before) throw new Error(`Decision ${request.id} not found`);

    // Add rejection reason to alternatives
    const alternatives = [...before.alternatives];
    alternatives.push({
      name: before.title,
      description: before.description,
      pros: [],
      cons: [],
      rejected_reason: request.reason,
    });

    const decision = this.storage.updateDecision(request.id as DecisionId, {
      status: "rejected",
      alternatives,
    });

    this.index.index(decision, "decision");
    this.audit(agent, "decision.reject", { type: "decision", id: decision.id }, {
      operation: "update",
      before,
      after: decision,
    });

    return decision;
  }

  /**
   * Set plan
   */
  setPlan(agent: AgentRole, request: SetPlanRequest): Plan {
    this.assertPermission(agent, "set_plan");

    const plan: Plan = {
      goal: request.goal,
      approach: request.approach,
      steps: request.steps.map((s, i) => ({
        id: `S-${i + 1}` as StepId,
        number: i + 1,
        action: s.action,
        files: s.files,
        depends_on: (s.depends_on || []).map((n) => `S-${n}` as StepId),
        verification: s.verification,
        status: "pending" as const,
      })),
      current_step: 0,
      created_at: now(),
      updated_at: now(),
    };

    this.storage.writePlan(plan);

    // Index all steps
    for (const step of plan.steps) {
      this.index.index(step, "step");
    }

    this.audit(agent, "plan.set", { type: "plan" }, { operation: "create", after: plan });

    // Update status
    const status = this.storage.getStatus();
    status.progress.planning = "complete";
    status.total_steps = plan.steps.length;
    this.storage.writeStatus(status);

    return plan;
  }

  /**
   * Advance to next step
   */
  advanceStep(agent: AgentRole): PlanStep | null {
    this.assertPermission(agent, "advance_step");

    const plan = this.storage.getPlan();
    if (!plan) throw new Error("No plan exists");

    if (plan.current_step >= plan.steps.length - 1) {
      return null; // No more steps
    }

    plan.current_step++;
    plan.steps[plan.current_step].status = "in_progress";
    plan.updated_at = now();

    this.storage.writePlan(plan);
    this.index.index(plan.steps[plan.current_step], "step");

    // Update status
    const status = this.storage.getStatus();
    status.current_step = plan.current_step;
    status.progress.execution = "in_progress";
    this.storage.writeStatus(status);

    this.audit(agent, "plan.advance", { type: "plan" }, {
      operation: "update",
      after: { current_step: plan.current_step },
    });

    return plan.steps[plan.current_step];
  }

  /**
   * Complete current step
   */
  completeStep(agent: AgentRole, request: CompleteStepRequest): PlanStep {
    this.assertPermission(agent, "complete_step");

    const plan = this.storage.getPlan();
    if (!plan) throw new Error("No plan exists");

    const step = plan.steps[plan.current_step];
    step.status = "complete";
    step.completed_at = now();
    step.result = request.result;
    plan.updated_at = now();

    this.storage.writePlan(plan);
    this.index.index(step, "step");

    this.audit(agent, "step.complete", { type: "plan", id: step.id }, {
      operation: "update",
      after: step,
    });

    // Check if all steps complete
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
  failStep(agent: AgentRole, request: FailStepRequest): PlanStep {
    this.assertPermission(agent, "fail_step");

    const plan = this.storage.getPlan();
    if (!plan) throw new Error("No plan exists");

    const step = plan.steps[plan.current_step];
    step.status = "failed";
    step.result = {
      files_changed: [],
      files_created: [],
      verification_passed: false,
      notes: request.reason,
    };
    plan.updated_at = now();

    this.storage.writePlan(plan);
    this.index.index(step, "step");

    this.audit(agent, "step.fail", { type: "plan", id: step.id }, {
      operation: "update",
      after: step,
    });

    // Update status to blocked
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
  decomposeStep(agent: AgentRole, stepId: StepId, subtasks: string[]): PlanStep {
    this.assertPermission(agent, "decompose_step");

    const plan = this.storage.getPlan();
    if (!plan) throw new Error("No plan exists");

    const stepIndex = plan.steps.findIndex((s) => s.id === stepId);
    if (stepIndex === -1) throw new Error(`Step ${stepId} not found`);

    const step = plan.steps[stepIndex];

    // Create subtasks with IDs like "S-1.1", "S-1.2", etc.
    step.subtasks = subtasks.map((action, i) => ({
      id: `${stepId}.${i + 1}` as `${StepId}.${number}`,
      action,
      status: "pending" as const,
    }));

    plan.updated_at = now();
    this.storage.writePlan(plan);
    this.index.index(step, "step");

    this.audit(agent, "step.complete", { type: "plan", id: step.id }, {
      operation: "update",
      after: { subtasks: step.subtasks },
    });

    return step;
  }

  /**
   * Complete a subtask within a step
   */
  completeSubtask(agent: AgentRole, stepId: StepId, subtaskIndex: number): PlanStep {
    this.assertPermission(agent, "complete_step");

    const plan = this.storage.getPlan();
    if (!plan) throw new Error("No plan exists");

    const stepIndex = plan.steps.findIndex((s) => s.id === stepId);
    if (stepIndex === -1) throw new Error(`Step ${stepId} not found`);

    const step = plan.steps[stepIndex];
    if (!step.subtasks || subtaskIndex >= step.subtasks.length) {
      throw new Error(`Subtask ${subtaskIndex} not found in step ${stepId}`);
    }

    step.subtasks[subtaskIndex].status = "complete";
    step.subtasks[subtaskIndex].completed_at = now();

    // Check if all subtasks complete
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
  updateStatus(agent: AgentRole, request: UpdateStatusRequest): Status {
    this.assertPermission(agent, "update_status");

    const before = this.storage.getStatus();
    const status = this.storage.updateStatus({
      phase: request.phase,
      verification: request.verification
        ? {
            ...before.verification,
            ...request.verification,
            plan_passes: request.verification.plan_verdict
              ? before.verification.plan_passes + 1
              : before.verification.plan_passes,
            result_passes: request.verification.result_verdict
              ? before.verification.result_passes + 1
              : before.verification.result_passes,
          }
        : before.verification,
      last_action: {
        agent,
        action: "update_status",
        at: now(),
      },
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
      after: status,
    });

    return status;
  }

  /**
   * Raise alert
   */
  raiseAlert(agent: AgentRole, request: RaiseAlertRequest): Alert {
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
      tags: request.tags || [],
    });

    this.index.index(alert, "alert");
    this.indexInGraphAndTemporal(alert, "alert", agent);
    this.audit(agent, "alert.raise", { type: "alert", id: alert.id }, {
      operation: "create",
      after: alert,
    });

    // If blocker, update status
    if (request.severity === "blocker") {
      this.storage.setPhase("blocked");
    }

    return alert;
  }

  /**
   * Resolve alert
   */
  resolveAlert(agent: AgentRole, request: ResolveAlertRequest): Alert {
    this.assertPermission(agent, "resolve_alert");

    const before = this.storage.getAlert(request.id as AlertId);
    if (!before) throw new Error(`Alert ${request.id} not found`);

    const alert = this.storage.updateAlert(request.id as AlertId, {
      resolved: true,
      resolved_by: agent,
      resolved_at: now(),
      resolution: request.resolution,
    });

    this.index.index(alert, "alert");
    this.audit(agent, "alert.resolve", { type: "alert", id: alert.id }, {
      operation: "update",
      before,
      after: alert,
    });

    // Check if we can unblock
    if (before.severity === "blocker") {
      const unresolvedBlockers = this.getAlerts({ severity: ["blocker"], resolved: false });
      if (unresolvedBlockers.length === 0) {
        const status = this.storage.getStatus();
        if (status.phase === "blocked") {
          // Return to execution phase
          this.storage.setPhase("execution");
        }
      }
    }

    return alert;
  }

  /**
   * Add snippet (all agents can add)
   */
  addSnippet(agent: AgentRole, request: AddSnippetRequest): Snippet {
    this.assertPermission(agent, "add_snippet");

    const snippet = this.storage.appendSnippet({
      path: request.path,
      lines: request.lines,
      content: request.content,
      purpose: request.purpose,
      added_by: agent,
      added_at: now(),
      linked_to: request.linked_to,
      tags: request.tags || [],
    });

    this.index.index(snippet, "snippet");
    this.indexInGraphAndTemporal(snippet, "snippet", agent);
    this.audit(agent, "snippet.add", { type: "snippet", id: snippet.id }, {
      operation: "create",
      after: snippet,
    });

    return snippet;
  }

  /**
   * Update snippet (all agents can update)
   */
  updateSnippet(agent: AgentRole, request: UpdateSnippetRequest): Snippet {
    this.assertPermission(agent, "update_snippet");

    const before = this.storage.getSnippet(request.id as SnippetId);
    if (!before) throw new Error(`Snippet ${request.id} not found`);

    const snippet = this.storage.updateSnippet(request.id as SnippetId, {
      content: request.content,
      purpose: request.purpose,
      linked_to: request.linked_to,
      tags: request.tags,
    });

    this.index.index(snippet, "snippet");
    this.audit(agent, "snippet.update", { type: "snippet", id: snippet.id }, {
      operation: "update",
      before,
      after: snippet,
    });

    return snippet;
  }

  /**
   * Verify snippet - marks as recently verified (resets staleness timer)
   * Optionally updates content if the file has changed
   */
  verifySnippet(agent: AgentRole, request: VerifySnippetRequest): Snippet {
    this.assertPermission(agent, "verify_snippet");

    const before = this.storage.getSnippet(request.id as SnippetId);
    if (!before) throw new Error(`Snippet ${request.id} not found`);

    const updates: Partial<Snippet> = {
      verified_at: now(),
    };

    if (request.content) {
      updates.content = request.content;
    }

    const snippet = this.storage.updateSnippet(request.id as SnippetId, updates);

    this.index.index(snippet, "snippet");
    this.audit(agent, "snippet.verify", { type: "snippet", id: snippet.id }, {
      operation: "update",
      before,
      after: snippet,
    });

    return snippet;
  }

  // ============================================================
  // SEARCH (Direct Index)
  // ============================================================

  /**
   * Search using direct index
   */
  search(query: SearchQuery): SearchResponse {
    const startTime = Date.now();
    const limit = query.options?.limit || 10;

    // Build filters for direct index
    const filters: DirectIndexFilters = {
      types: query.filters?.types,
      agents: query.filters?.agents,
      confidence: query.filters?.confidence,
      tags: query.filters?.tags,
      files: query.filters?.files,
      createdAfter: query.filters?.timeRange?.after,
      createdBefore: query.filters?.timeRange?.before,
      limit: limit,
      offset: query.options?.offset,
    };

    let results: SearchResult[];

    if (query.text) {
      // Use FTS5 for text queries — much better than substring matching
      const ftsResults = this.index.ftsSearch(query.text, {
        types: query.filters?.types,
        limit: limit * 2, // over-fetch to allow post-filtering
      });

      if (ftsResults.length > 0) {
        // Apply additional filters if needed
        results = ftsResults.map(r => ({
          entity: r.entity,
          entityType: r.entityType,
          score: r.score,
        }));
      } else {
        // FTS returned nothing — fall back to substring matching
        const allEntities = this.index.query(filters);
        const textLower = query.text.toLowerCase();

        results = allEntities
          .filter((entity) => {
            const content = this.getSearchableContent(entity);
            return content.toLowerCase().includes(textLower);
          })
          .map((entity) => ({
            entity,
            entityType: this.getEntityTypeFromEntity(entity),
            score: 1.0,
            highlights: [],
          }));
      }
    } else {
      results = this.index.query(filters).map((entity) => ({
        entity,
        entityType: this.getEntityTypeFromEntity(entity),
        score: 1.0,
      }));
    }

    return {
      results: results.slice(0, limit),
      total: results.length,
      query_time_ms: Date.now() - startTime,
      search_mode: query.text ? "fts" : "direct",
    };
  }

  private getSearchableContent(entity: Entity): string {
    const parts: string[] = [];

    if ("content" in entity) parts.push(entity.content);
    if ("title" in entity) parts.push(entity.title);
    if ("description" in entity) parts.push(entity.description);
    if ("rationale" in entity) parts.push(entity.rationale);
    if ("action" in entity) parts.push(entity.action);
    if ("evidence" in entity) {
      for (const e of entity.evidence) {
        parts.push(e.reference);
        if (e.excerpt) parts.push(e.excerpt);
      }
    }
    if ("files" in entity) parts.push(...entity.files);
    if ("tags" in entity) parts.push(...entity.tags);

    return parts.join(" ");
  }

  private getEntityTypeFromEntity(entity: Entity): EntityType {
    if ("id" in entity) {
      const id = entity.id as string;
      if (id.startsWith("F-")) return "fact";
      if (id.startsWith("D-")) return "decision";
      if (id.startsWith("A-")) return "alert";
      if (id.startsWith("S-")) return "step";
      if (id.startsWith("C-")) return "constraint";
    }
    return "fact"; // Default
  }

  // ============================================================
  // VIEW COMPILATION
  // ============================================================

  /**
   * Compile minimal view for agent
   */
  compileView(request: ViewRequest): CompiledView {
    const agent = request.agent;
    const budget = request.budget || {};
    const include = request.include || {
      mission: true,
      facts: true,
      decisions: true,
      plan: agent === "executor" || agent === "verifier",
      alerts: true,
    };

    const maxTokens = budget.max_tokens || 1000;
    const maxFacts = budget.max_facts || 20;
    const maxDecisions = budget.max_decisions || 5;

    let tokensUsed = 0;

    // Mission (always included, ~100 tokens)
    const mission = this.getMission();
    const status = this.getStatus();
    const plan = this.getPlan();

    const missionView = {
      goal: mission.goal,
      constraints: mission.constraints.map((c) => c.description),
      current_step: status.current_step,
      total_steps: status.total_steps,
    };
    tokensUsed += this.estimateTokens(missionView);

    // Current step (if executor/verifier and plan exists)
    let currentStepView: CompiledView["current_step"] = undefined;
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
        verification: step.verification,
      };
      tokensUsed += this.estimateTokens(currentStepView);
    }

    // Facts
    const factsView: CompactFact[] = [];
    if (include.facts) {
      const remainingBudget = maxTokens - tokensUsed - 100; // Reserve for alerts
      const facts = this.selectRelevantFacts(agent, request.focus, remainingBudget, maxFacts);

      for (const fact of facts) {
        factsView.push({
          id: fact.id,
          content: fact.content,
          confidence: fact.confidence,
          evidence: this.collapseEvidence(fact),
        });
      }
      tokensUsed += this.estimateTokens(factsView);
    }

    // Decisions (approved only)
    const decisionsView: CompactDecision[] = [];
    if (include.decisions) {
      const decisions = this.getDecisions({ status: ["approved"] });
      for (const d of decisions.slice(0, maxDecisions)) {
        decisionsView.push({
          id: d.id,
          title: d.title,
          description: d.description,
        });
      }
      tokensUsed += this.estimateTokens(decisionsView);
    }

    // Alerts (unresolved only)
    const alertsView: CompactAlert[] = [];
    if (include.alerts) {
      const alerts = this.getAlerts({ resolved: false });
      for (const a of alerts) {
        alertsView.push({
          id: a.id,
          severity: a.severity,
          title: a.title,
          blocking_step: a.blocking_step
            ? plan?.steps.findIndex((s) => s.id === a.blocking_step)
            : undefined,
        });
      }
      tokensUsed += this.estimateTokens(alertsView);
    }

    const view: CompiledView = {
      mission: missionView,
      facts: factsView,
      decisions: decisionsView,
      alerts: alertsView,
      current_step: currentStepView,
      compiled_at: now(),
      token_estimate: tokensUsed,
      entities_included: factsView.length + decisionsView.length + alertsView.length,
      entities_available: this.countTotalEntities(),
    };

    this.audit("orchestrator", "view.compile", { type: "status" }, {
      operation: "create",
      after: { agent, tokens: tokensUsed, entities: view.entities_included },
    });

    return view;
  }

  private selectRelevantFacts(
    agent: AgentRole,
    focus: ViewRequest["focus"],
    tokenBudget: number,
    maxFacts: number
  ): Fact[] {
    const allFacts = this.getFacts();
    const plan = this.getPlan();

    // Score each fact
    const scored = allFacts.map((fact) => ({
      fact,
      score: this.scoreFact(fact, agent, focus, plan),
    }));

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Select within budget
    const selected: Fact[] = [];
    let tokens = 0;

    for (const { fact } of scored) {
      if (selected.length >= maxFacts) break;

      const factTokens = this.estimateTokens({
        id: fact.id,
        content: fact.content,
        confidence: fact.confidence,
        evidence: this.collapseEvidence(fact),
      });

      if (tokens + factTokens > tokenBudget) continue;

      selected.push(fact);
      tokens += factTokens;
    }

    return selected;
  }

  private scoreFact(
    fact: Fact,
    agent: AgentRole,
    focus: ViewRequest["focus"] | undefined,
    plan: Plan | null
  ): number {
    let score = 0;

    // Base score by confidence
    score += fact.confidence === "high" ? 1.0 : fact.confidence === "medium" ? 0.6 : 0.3;

    // Boost if related to current step
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

    // Boost if supports approved decision
    if (fact.supports?.length) {
      const approvedDecisions = this.getDecisions({ status: ["approved"] });
      if (fact.supports.some((id) => approvedDecisions.some((d) => d.id === id))) {
        score += 0.3;
      }
    }

    // Recency boost
    const age = Date.now() - new Date(fact.discovered_at).getTime();
    const ageMinutes = age / 60000;
    score += Math.max(0, 0.2 - ageMinutes * 0.01);

    // Agent-specific boosts
    if (agent === "verifier" && !fact.verified_at) {
      score += 0.2;
    }

    // Explicit focus
    if (focus?.entities?.includes(fact.id)) {
      score += 1.0;
    }

    return score;
  }

  private collapseEvidence(fact: Fact): string {
    if (fact.evidence.length === 0) return "(no evidence)";
    if (fact.evidence.length === 1) return fact.evidence[0].reference;
    return `${fact.evidence[0].reference} (+${fact.evidence.length - 1} more)`;
  }

  private estimateTokens(data: unknown): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(JSON.stringify(data).length / 4);
  }

  private countTotalEntities(): number {
    return (
      this.storage.getFacts().length +
      this.storage.getDecisions().length +
      this.storage.getAlerts().length +
      this.storage.getMission().constraints.length +
      (this.storage.getPlan()?.steps.length || 0)
    );
  }

  // ============================================================
  // AUDIT
  // ============================================================

  private audit(
    agent: AgentRole,
    action: AuditAction,
    target: { type: string; id?: EntityId },
    change: { operation: string; before?: unknown; after?: unknown }
  ): void {
    this.storage.appendAudit({
      id: crypto.randomUUID(),
      timestamp: now(),
      agent,
      action,
      target: target as { type: "mission" | "fact" | "decision" | "plan" | "status" | "alert"; id?: EntityId },
      change: change as { operation: "create" | "update" | "delete"; before?: unknown; after?: unknown },
      context: {
        phase: this.storage.getMeta().phase,
        step: this.storage.getStatus().current_step,
      },
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
  close(): void {
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
  async advancedSearch(query: UnifiedSearchQuery): Promise<UnifiedSearchResponse> {
    return this.unifiedSearch.search(query);
  }

  /**
   * Text search with hybrid mode (BM25 + semantic)
   */
  async textSearch(
    text: string,
    options?: {
      mode?: "lexical" | "semantic" | "hybrid";
      limit?: number;
      types?: EntityType[];
    }
  ): Promise<SearchResult[]> {
    return this.unifiedSearch.textSearch(text, options);
  }

  /**
   * Find entities related to a given entity via graph traversal
   */
  findRelated(
    id: EntityId,
    options?: {
      relation?: RelationType | RelationType[];
      direction?: "outgoing" | "incoming" | "both";
      depth?: number;
    }
  ): { nodes: Entity[]; edges: Edge[] } {
    return this.unifiedSearch.findRelated(id, options);
  }

  /**
   * Find shortest path between two entities
   */
  findPath(
    fromId: EntityId,
    toId: EntityId,
    relation?: RelationType | RelationType[]
  ): GraphPath | null {
    return this.unifiedSearch.findPath(fromId, toId, relation);
  }

  /**
   * Find recent entities
   */
  findRecent(limit: number = 10, types?: EntityType[]): Entity[] {
    return this.unifiedSearch.findRecent(limit, types);
  }

  /**
   * Find entities in time range
   */
  findInTimeRange(after: string, before: string, types?: EntityType[]): Entity[] {
    return this.unifiedSearch.findInTimeRange(after, before, types);
  }

  /**
   * Find entities by workflow phase
   */
  findByPhase(phase: TaskPhase, types?: EntityType[]): Entity[] {
    return this.unifiedSearch.findByPhase(phase, types);
  }

  /**
   * Get activity timeline
   */
  getTimeline(after?: string, before?: string): TemporalEntry[] {
    const entries = this.temporalIndex.getHourlyTimeline(after, before);
    return entries.map(e => ({
      id: "" as EntityId, // Timeline entries don't have single IDs
      type: "fact" as EntityType,
      timestamp: e.timestamp,
      phase: "execution" as TaskPhase,
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
  getSupporting(id: EntityId): Entity[] {
    const supporterIds = this.graphIndex.getSupporting(id);
    return supporterIds
      .map((sid) => this.getEntity(sid))
      .filter((e): e is Entity => e !== null);
  }

  /**
   * Get entities that contradict a given entity
   */
  getContradicting(id: EntityId): Entity[] {
    const contradictorIds = this.graphIndex.getContradicting(id);
    return contradictorIds
      .map((cid) => this.getEntity(cid))
      .filter((e): e is Entity => e !== null);
  }

  /**
   * Get dependencies for a step
   */
  getDependencies(stepId: StepId): Entity[] {
    const depIds = this.graphIndex.getDependencies(stepId);
    return depIds
      .map((did) => this.getEntity(did))
      .filter((e): e is Entity => e !== null);
  }

  /**
   * Get dependents of a step
   */
  getDependents(stepId: StepId): Entity[] {
    const depIds = this.graphIndex.getDependents(stepId);
    return depIds
      .map((did) => this.getEntity(did))
      .filter((e): e is Entity => e !== null);
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
  async compileEnhancedView(request: ViewRequest): Promise<CompiledView & {
    related_facts?: EntityId[];
    context_from_graph?: { supporting: number; contradicting: number };
  }> {
    const baseView = this.compileView(request);

    // If we have focus entities, find related facts via graph
    if (request.focus?.entities && request.focus.entities.length > 0) {
      const relatedFactIds = new Set<EntityId>();
      let supportingCount = 0;
      let contradictingCount = 0;

      for (const entityId of request.focus.entities) {
        // Get supporting facts
        const supporting = this.graphIndex.getSupporting(entityId);
        supporting.forEach(id => {
          if (id.startsWith("F-")) {
            relatedFactIds.add(id);
            supportingCount++;
          }
        });

        // Get contradicting facts
        const contradicting = this.graphIndex.getContradicting(entityId);
        contradicting.forEach(id => {
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
          contradicting: contradictingCount,
        },
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
  appendTrail(agent: AgentRole, request: AppendTrailRequest): TrailEntry {
    if (!this.exists()) {
      throw new Error("No board exists");
    }

    this.assertPermission(agent, "append_trail");

    this.trailSequence++;
    const taskId = this.storage.getMeta().task_id;
    const trailId = `T-${taskId}-${this.trailSequence}` as TrailId;

    const entry: TrailEntry = {
      ts: now(),
      schema_version: "1.1",
      id: trailId,
      task_id: taskId,
      marker: request.marker as TrailMarker,
      summary: request.summary,
      agent,
      details: request.details as unknown as TrailDetails,
      evidence: request.evidence || [],
    };

    // Append to trails.jsonl
    appendFileSync(this.trailsPath, JSON.stringify(entry) + "\n");

    return entry;
  }

  /**
   * Get all trail entries
   */
  getTrails(filter?: TrailFilter): TrailEntry[] {
    if (!existsSync(this.trailsPath)) {
      return [];
    }

    const lines = readFileSync(this.trailsPath, "utf-8").trim().split("\n").filter(Boolean);
    let entries: TrailEntry[] = lines.map((line) => JSON.parse(line));

    // Apply filters
    if (filter?.markers && filter.markers.length > 0) {
      entries = entries.filter((e) => filter.markers!.includes(e.marker));
    }

    if (filter?.after) {
      entries = entries.filter((e) => e.ts >= filter.after!);
    }

    if (filter?.before) {
      entries = entries.filter((e) => e.ts <= filter.before!);
    }

    // Apply limit
    if (filter?.limit && filter.limit > 0) {
      entries = entries.slice(-filter.limit);
    }

    return entries;
  }

  /**
   * Get recent trail entries
   */
  getRecentTrails(limit: number = 10): TrailEntry[] {
    return this.getTrails({ limit });
  }

  /**
   * Get trail count
   */
  getTrailCount(): number {
    if (!existsSync(this.trailsPath)) {
      return 0;
    }
    const lines = readFileSync(this.trailsPath, "utf-8").trim().split("\n").filter(Boolean);
    return lines.length;
  }

  // ============================================================
  // PRIVATE HELPERS FOR INDEXING
  // ============================================================

  /**
   * Index entity in graph (relationships) and temporal indexes
   */
  private indexInGraphAndTemporal(
    entity: Entity,
    type: EntityType,
    agent: AgentRole
  ): void {
    const id = this.getEntityId(entity);
    const phase = this.storage.getMeta().phase;

    // Index relationships in graph
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

    // Index in temporal
    const timestamp = this.getEntityTimestamp(entity);
    this.temporalIndex.recordEvent(id, type, timestamp, phase, agent);
  }

  private getEntityId(entity: Entity): EntityId {
    if ("id" in entity) return entity.id;
    throw new Error("Entity has no id");
  }

  private getEntityTimestamp(entity: Entity): string {
    if ("discovered_at" in entity) return entity.discovered_at;
    if ("proposed_at" in entity) return entity.proposed_at;
    if ("raised_at" in entity) return entity.raised_at;
    if ("added_at" in entity) return entity.added_at;
    return new Date().toISOString();
  }
}
