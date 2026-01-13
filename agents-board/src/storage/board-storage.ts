/**
 * Agent Collaboration Board - Board Storage Layer
 *
 * Handles persistence of board data to the filesystem.
 * Uses JSON files for structured data and JSONL for append-only logs.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type {
    Alert,
    AlertId,
    AuditEntry,
    Board,
    BoardMeta,
    Constraint,
    ConstraintId,
    Decision,
    DecisionId,
    Fact,
    FactId,
    Mission,
    Plan,
    Snippet,
    SnippetId,
    Status,
    StepId,
    TaskId,
    TaskPhase,
} from "../types/index.js";
import { generateTaskId, now } from "../types/index.js";

// ============================================================
// CONSTANTS
// ============================================================

const SCHEMA_VERSION = "2.0" as const;

// ============================================================
// BOARD STORAGE CLASS
// ============================================================

export class BoardStorage {
  private boardPath: string;
  private auditPath: string;

  /**
   * @param boardPath Absolute (or project-relative) path to a specific task board directory.
   *        Expected layout: <project>/.dev_partner/tasks/<task_id>/
   *
  * This storage layer does not support the older single-board layout
  * (a single shared board directory under .dev_partner).
   */
  constructor(boardPath: string) {
    this.boardPath = boardPath;
    // Audit is stored alongside tasks/ and archive/ under <project>/.dev_partner/audit/
    this.auditPath = join(dirname(dirname(boardPath)), "audit");
  }

  // ============================================================
  // INITIALIZATION
  // ============================================================

  /**
   * Check if a board exists
   */
  exists(): boolean {
    return existsSync(join(this.boardPath, "meta.json"));
  }

  /**
   * Create a new board
   * @param taskId Optional task ID (generated if not provided)
   */
  create(
    goal: string,
    context?: string,
    constraints?: string[],
    taskId?: TaskId
  ): { task_id: TaskId; board_path: string } {
    if (this.exists()) {
      throw new Error("Board already exists. Archive or delete existing board first.");
    }

    const task_id = taskId || generateTaskId();

    // Create directories
    mkdirSync(this.boardPath, { recursive: true });
    mkdirSync(join(this.boardPath, ".index"), { recursive: true });
    mkdirSync(this.auditPath, { recursive: true });

    // Initialize meta
    const meta: BoardMeta = {
      schema_version: SCHEMA_VERSION,
      task_id,
      created_at: now(),
      updated_at: now(),
      phase: "setup",
      classification: "standard",
      sequences: { fact: 0, decision: 0, alert: 0, step: 0, constraint: 0, snippet: 0 },
    };
    this.writeMeta(meta);

    // Initialize mission
    const mission: Mission = {
      goal,
      constraints: (constraints || []).map((c, i) => ({
        id: `C-${i + 1}` as ConstraintId,
        description: c,
        source: "user" as const,
        added_by: "orchestrator" as const,
        added_at: now(),
      })),
      definition_of_done: [],
      context: context || "",
      routing: {
        task_type: "feature",
        risk_level: "medium",
        scope: "module",
      },
    };

    // Update sequence if we added constraints
    if (constraints && constraints.length > 0) {
      meta.sequences.constraint = constraints.length;
      this.writeMeta(meta);
    }

    this.writeMission(mission);

    // Initialize status
    const status: Status = {
      phase: "setup",
      current_step: 0,
      total_steps: 0,
      progress: {
        exploration: "pending",
        ideation: "pending",
        planning: "pending",
        plan_verification: "pending",
        execution: "pending",
        result_verification: "pending",
      },
      verification: {
        plan_passes: 0,
        result_passes: 0,
      },
      last_action: {
        agent: "orchestrator",
        action: "board.create",
        at: now(),
      },
      updated_at: now(),
    };
    this.writeStatus(status);

    // Initialize empty JSONL files
    writeFileSync(join(this.boardPath, "facts.jsonl"), "");
    writeFileSync(join(this.boardPath, "decisions.jsonl"), "");
    writeFileSync(join(this.boardPath, "alerts.jsonl"), "");
    writeFileSync(join(this.boardPath, "snippets.jsonl"), "");

    // Initialize audit log
    writeFileSync(join(this.auditPath, `${task_id}.jsonl`), "");

    // Log creation
    this.appendAudit({
      id: crypto.randomUUID(),
      timestamp: now(),
      agent: "orchestrator",
      action: "board.create",
      target: { type: "mission" },
      change: { operation: "create", after: mission },
    });

    return { task_id, board_path: this.boardPath };
  }

  // ============================================================
  // READ OPERATIONS
  // ============================================================

  /**
   * Read the complete board state
   */
  getBoard(): Board {
    return {
      meta: this.getMeta(),
      mission: this.getMission(),
      facts: this.getFacts(),
      decisions: this.getDecisions(),
      plan: this.getPlan(),
      status: this.getStatus(),
      alerts: this.getAlerts(),
      snippets: this.getSnippets(),
    };
  }

  /**
   * Read board metadata
   */
  getMeta(): BoardMeta {
    return this.readJson<BoardMeta>("meta.json");
  }

  /**
   * Read mission
   */
  getMission(): Mission {
    return this.readJson<Mission>("mission.json");
  }

  /**
   * Read all facts
   */
  getFacts(): Fact[] {
    return this.readJsonl<Fact>("facts.jsonl");
  }

  /**
   * Read a single fact by ID
   */
  getFact(id: FactId): Fact | null {
    const facts = this.getFacts();
    return facts.find((f) => f.id === id) || null;
  }

  /**
   * Read all decisions
   */
  getDecisions(): Decision[] {
    return this.readJsonl<Decision>("decisions.jsonl");
  }

  /**
   * Read a single decision by ID
   */
  getDecision(id: DecisionId): Decision | null {
    const decisions = this.getDecisions();
    return decisions.find((d) => d.id === id) || null;
  }

  /**
   * Read the plan (may not exist)
   */
  getPlan(): Plan | null {
    const path = join(this.boardPath, "plan.json");
    if (!existsSync(path)) return null;
    return this.readJson<Plan>("plan.json");
  }

  /**
   * Read status
   */
  getStatus(): Status {
    return this.readJson<Status>("status.json");
  }

  /**
   * Read all alerts
   */
  getAlerts(): Alert[] {
    return this.readJsonl<Alert>("alerts.jsonl");
  }

  /**
   * Read a single alert by ID
   */
  getAlert(id: AlertId): Alert | null {
    const alerts = this.getAlerts();
    return alerts.find((a) => a.id === id) || null;
  }

  /**
   * Read all snippets
   */
  getSnippets(): Snippet[] {
    const path = join(this.boardPath, "snippets.jsonl");
    if (!existsSync(path)) return [];
    return this.readJsonl<Snippet>("snippets.jsonl");
  }

  /**
   * Read a single snippet by ID
   */
  getSnippet(id: SnippetId): Snippet | null {
    const snippets = this.getSnippets();
    return snippets.find((s) => s.id === id) || null;
  }

  // ============================================================
  // WRITE OPERATIONS
  // ============================================================

  /**
   * Write board metadata
   */
  writeMeta(meta: BoardMeta): void {
    meta.updated_at = now();
    this.writeJson("meta.json", meta);
  }

  /**
   * Write mission
   */
  writeMission(mission: Mission): void {
    this.writeJson("mission.json", mission);
    this.updateMeta({ updated_at: now() });
  }

  /**
   * Add a constraint to the mission
   */
  addConstraint(constraint: Omit<Constraint, "id">): Constraint {
    const meta = this.getMeta();
    const id = `C-${++meta.sequences.constraint}` as ConstraintId;

    const fullConstraint: Constraint = { ...constraint, id };

    const mission = this.getMission();
    mission.constraints.push(fullConstraint);
    this.writeMission(mission);
    this.writeMeta(meta);

    return fullConstraint;
  }

  /**
   * Append a fact
   */
  appendFact(fact: Omit<Fact, "id">): Fact {
    const meta = this.getMeta();
    const id = `F-${++meta.sequences.fact}` as FactId;

    const fullFact: Fact = { ...fact, id };
    this.appendJsonl("facts.jsonl", fullFact);
    this.writeMeta(meta);

    return fullFact;
  }

  /**
   * Update a fact (rewrite the entire JSONL file)
   */
  updateFact(id: FactId, updates: Partial<Omit<Fact, "id">>): Fact {
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
  appendDecision(decision: Omit<Decision, "id">): Decision {
    const meta = this.getMeta();
    const id = `D-${++meta.sequences.decision}` as DecisionId;

    const fullDecision: Decision = { ...decision, id };
    this.appendJsonl("decisions.jsonl", fullDecision);
    this.writeMeta(meta);

    return fullDecision;
  }

  /**
   * Update a decision
   */
  updateDecision(id: DecisionId, updates: Partial<Omit<Decision, "id">>): Decision {
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
  writePlan(plan: Plan): void {
    // Assign step IDs
    const meta = this.getMeta();
    for (const step of plan.steps) {
      if (!step.id) {
        step.id = `S-${++meta.sequences.step}` as StepId;
      }
    }

    this.writeJson("plan.json", plan);
    this.writeMeta(meta);

    // Update status with step count
    const status = this.getStatus();
    status.total_steps = plan.steps.length;
    this.writeStatus(status);
  }

  /**
   * Write status
   */
  writeStatus(status: Status): void {
    status.updated_at = now();
    this.writeJson("status.json", status);
  }

  /**
   * Update status partially
   */
  updateStatus(updates: Partial<Status>): Status {
    const status = this.getStatus();
    const updated = { ...status, ...updates, updated_at: now() };
    this.writeStatus(updated);
    return updated;
  }

  /**
   * Append an alert
   */
  appendAlert(alert: Omit<Alert, "id">): Alert {
    const meta = this.getMeta();
    const id = `A-${++meta.sequences.alert}` as AlertId;

    const fullAlert: Alert = { ...alert, id };
    this.appendJsonl("alerts.jsonl", fullAlert);
    this.writeMeta(meta);

    return fullAlert;
  }

  /**
   * Update an alert
   */
  updateAlert(id: AlertId, updates: Partial<Omit<Alert, "id">>): Alert {
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
  appendSnippet(snippet: Omit<Snippet, "id">): Snippet {
    const meta = this.getMeta();
    const id = `X-${++meta.sequences.snippet}` as SnippetId;

    const fullSnippet: Snippet = { ...snippet, id };
    this.appendJsonl("snippets.jsonl", fullSnippet);
    this.writeMeta(meta);

    return fullSnippet;
  }

  /**
   * Update a snippet
   */
  updateSnippet(id: SnippetId, updates: Partial<Omit<Snippet, "id">>): Snippet {
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
  deleteSnippet(id: SnippetId): boolean {
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
  deleteSnippets(ids: SnippetId[]): number {
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
  setPhase(phase: TaskPhase): void {
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
  appendAudit(entry: AuditEntry): void {
    const meta = this.getMeta();
    const auditFile = join(this.auditPath, `${meta.task_id}.jsonl`);
    appendFileSync(auditFile, JSON.stringify(entry) + "\n");
  }

  /**
   * Read audit log
   */
  getAuditLog(): AuditEntry[] {
    const meta = this.getMeta();
    const auditFile = join(this.auditPath, `${meta.task_id}.jsonl`);
    if (!existsSync(auditFile)) return [];
    return this.readJsonlFile<AuditEntry>(auditFile);
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private readJson<T>(filename: string): T {
    const path = join(this.boardPath, filename);
    const content = readFileSync(path, "utf-8");
    return JSON.parse(content) as T;
  }

  private writeJson<T>(filename: string, data: T): void {
    const path = join(this.boardPath, filename);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(data, null, 2));
  }

  private readJsonl<T>(filename: string): T[] {
    const path = join(this.boardPath, filename);
    return this.readJsonlFile<T>(path);
  }

  private readJsonlFile<T>(path: string): T[] {
    if (!existsSync(path)) return [];

    const content = readFileSync(path, "utf-8").trim();
    if (!content) return [];

    return content.split("\n").map((line) => JSON.parse(line) as T);
  }

  private appendJsonl<T>(filename: string, data: T): void {
    const path = join(this.boardPath, filename);
    appendFileSync(path, JSON.stringify(data) + "\n");
  }

  private rewriteJsonl<T>(filename: string, data: T[]): void {
    const path = join(this.boardPath, filename);
    const content = data.map((d) => JSON.stringify(d)).join("\n") + (data.length > 0 ? "\n" : "");
    writeFileSync(path, content);
  }

  private updateMeta(updates: Partial<BoardMeta>): void {
    const meta = this.getMeta();
    const updated = { ...meta, ...updates };
    this.writeMeta(updated);
  }

  /**
   * Get the board path
   */
  getBoardPath(): string {
    return this.boardPath;
  }
}
