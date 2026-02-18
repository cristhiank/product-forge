/**
 * Agent Collaboration Board - Core Types
 *
 * This file contains all the core type definitions for the Board system.
 */

// ============================================================
// IDENTIFIERS
// ============================================================

/** Task ID format: YYYYMMDD-HHMMSS */
export type TaskId = string;

/** Entity ID with type prefix */
export type EntityId = FactId | DecisionId | AlertId | StepId | ConstraintId | SnippetId;

/** ISO-8601 UTC timestamp with Z suffix */
export type Timestamp = string;

// Entity ID types with branded prefixes
export type FactId = `F-${number}`;
export type DecisionId = `D-${number}`;
export type AlertId = `A-${number}`;
export type StepId = `S-${number}`;
export type SubTaskId = `${StepId}.${number}`; // e.g., "S-1.1", "S-1.2"
export type ConstraintId = `C-${number}`;
export type SnippetId = `X-${number}`;

// ============================================================
// ENUMS
// ============================================================

export type AgentRole = string;

export type Confidence = "high" | "medium" | "low";

export type DecisionStatus = "proposed" | "approved" | "rejected" | "superseded";

export type AlertSeverity = "blocker" | "major" | "minor" | "info";

export type TaskPhase =
  | "setup"
  | "exploration"
  | "ideation"
  | "planning"
  | "plan_verify"
  | "execution"
  | "result_verify"
  | "complete"
  | "blocked"
  | "cancelled";

export type TaskClassification = "simple" | "standard" | "complex";

export type EntityType = "fact" | "decision" | "alert" | "step" | "constraint" | "snippet";

export type TaskType = "bugfix" | "feature" | "refactor" | "docs" | "incident";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type Scope = "single-file" | "module" | "cross-cutting";

export type StepStatus = "pending" | "in_progress" | "complete" | "skipped" | "failed";

// ============================================================
// BOARD METADATA
// ============================================================

export interface BoardMeta {
  schema_version: "2.0";
  task_id: TaskId;
  created_at: Timestamp;
  updated_at: Timestamp;
  phase: TaskPhase;
  classification: TaskClassification;

  sequences: {
    fact: number;
    decision: number;
    alert: number;
    step: number;
    constraint: number;
    snippet: number;
  };
}

// ============================================================
// MISSION SECTION
// ============================================================

export interface Mission {
  goal: string;
  constraints: Constraint[];
  definition_of_done: string[];
  context: string;

  routing: {
    task_type: TaskType;
    risk_level: RiskLevel;
    scope: Scope;
  };
}

export interface Constraint {
  id: ConstraintId;
  description: string;
  source: "user" | "discovered";
  added_by: AgentRole;
  added_at: Timestamp;
}

// ============================================================
// FACTS SECTION
// ============================================================

export interface Fact {
  id: FactId;
  content: string;
  confidence: Confidence;
  evidence: Evidence[];

  source: AgentRole;
  discovered_at: Timestamp;
  verified_at?: Timestamp;
  verified_by?: AgentRole;

  supports?: EntityId[];
  contradicts?: FactId[];
  supersedes?: FactId[];

  tags: string[];
}

export interface Evidence {
  type: "file" | "symbol" | "test" | "docs" | "web" | "user";
  reference: string;
  excerpt?: string;
  url?: string;
}

// ============================================================
// DECISIONS SECTION
// ============================================================

export interface Decision {
  id: DecisionId;
  title: string;
  description: string;
  rationale: string;

  status: DecisionStatus;

  alternatives: Alternative[];

  proposed_by: AgentRole;
  proposed_at: Timestamp;
  approved_by?: AgentRole;
  approved_at?: Timestamp;

  based_on: FactId[];
  affects: StepId[];
  supersedes?: DecisionId[];

  tags: string[];
}

export interface Alternative {
  name: string;
  description: string;
  pros: string[];
  cons: string[];
  rejected_reason?: string;
}

// ============================================================
// PLAN SECTION
// ============================================================

export interface Plan {
  goal: string;
  approach: string;

  steps: PlanStep[];
  current_step: number;

  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface PlanStep {
  id: StepId;
  number: number;
  action: string;
  files: string[];

  depends_on: StepId[];
  verification: string;

  status: StepStatus;
  completed_at?: Timestamp;

  result?: StepResult;

  // Optional subtasks for complex steps
  subtasks?: SubTask[];
}

export interface SubTask {
  id: SubTaskId;
  action: string;
  status: StepStatus;
  completed_at?: Timestamp;
}

export interface StepResult {
  files_changed: string[];
  files_created: string[];
  verification_passed: boolean;
  notes?: string;
}

// ============================================================
// STATUS SECTION
// ============================================================

export interface Status {
  phase: TaskPhase;
  current_step: number;
  total_steps: number;

  progress: {
    exploration: "pending" | "complete";
    ideation: "pending" | "skipped" | "complete";
    planning: "pending" | "complete";
    plan_verification: "pending" | "skipped" | "complete" | "failed";
    execution: "pending" | "in_progress" | "complete" | "blocked";
    result_verification: "pending" | "complete" | "failed";
  };

  verification: {
    plan_verdict?: "approved" | "revision_required" | "blocked";
    plan_passes: number;
    result_verdict?: "approved" | "revision_required" | "blocked";
    result_passes: number;
  };

  last_action: {
    agent: AgentRole;
    action: string;
    at: Timestamp;
  };

  updated_at: Timestamp;
}

// ============================================================
// ALERTS SECTION
// ============================================================

export interface Alert {
  id: AlertId;
  severity: AlertSeverity;
  title: string;
  description: string;

  raised_by: AgentRole;
  raised_at: Timestamp;

  resolved: boolean;
  resolved_by?: AgentRole;
  resolved_at?: Timestamp;
  resolution?: string;

  references: EntityId[];
  blocking_step?: StepId;

  tags: string[];
}

// ============================================================
// SNIPPETS SECTION (Ephemeral Context Buffer)
// ============================================================

/**
 * Staleness thresholds for snippet warnings
 */
export const SNIPPET_STALENESS = {
  /** Minutes after which snippet shows "may be stale" warning */
  WARN_AFTER_MINUTES: 30,
  /** Minutes after which snippet shows "likely stale, verify before use" */
  STALE_AFTER_MINUTES: 120,
} as const;

/**
 * Snippet - Cached context that can be reused by other agents.
 * Avoids redundant file reads across agent phases.
 */
export interface Snippet {
  id: SnippetId;

  /** File path this snippet came from (if applicable) */
  path?: string;

  /** Line range in source file [start, end] inclusive */
  lines?: [number, number];

  /** The actual content (code, text, analysis) */
  content: string;

  /** Why this was captured - helps other agents understand relevance */
  purpose: string;

  /** Agent that created this snippet */
  added_by: AgentRole;

  /** When snippet was created */
  added_at: Timestamp;

  /** When snippet was last verified as current (for staleness tracking) */
  verified_at?: Timestamp;

  /** Optional link to entities this snippet supports */
  linked_to?: EntityId[];

  /** Searchable tags */
  tags: string[];
}

/**
 * Get staleness status for a snippet
 */
export function getSnippetStaleness(snippet: Snippet): "fresh" | "warn" | "stale" {
  const referenceTime = snippet.verified_at || snippet.added_at;
  const ageMinutes = (Date.now() - new Date(referenceTime).getTime()) / (1000 * 60);

  if (ageMinutes >= SNIPPET_STALENESS.STALE_AFTER_MINUTES) return "stale";
  if (ageMinutes >= SNIPPET_STALENESS.WARN_AFTER_MINUTES) return "warn";
  return "fresh";
}

/**
 * Format snippet with staleness header for agent consumption
 */
export function formatSnippetWithStaleness(snippet: Snippet): string {
  const staleness = getSnippetStaleness(snippet);
  const ageMinutes = Math.round(
    (Date.now() - new Date(snippet.verified_at || snippet.added_at).getTime()) / (1000 * 60)
  );

  let header = "";
  if (staleness === "warn") {
    header = `⚠️ SNIPPET MAY BE STALE (${ageMinutes}min old) - verify if critical\n`;
  } else if (staleness === "stale") {
    header = `🔴 SNIPPET LIKELY STALE (${ageMinutes}min old) - re-read file before using\n`;
  }

  const sourceInfo = snippet.path
    ? `Source: ${snippet.path}${snippet.lines ? `#L${snippet.lines[0]}-${snippet.lines[1]}` : ""}\n`
    : "";

  return `${header}${sourceInfo}Purpose: ${snippet.purpose}\n---\n${snippet.content}`;
}

// ============================================================
// AUDIT LOG
// ============================================================

export interface AuditEntry {
  id: string;
  timestamp: Timestamp;

  agent: AgentRole;
  action: AuditAction;

  target: {
    type: "mission" | "fact" | "decision" | "plan" | "status" | "alert" | "snippet";
    id?: EntityId;
  };

  change: {
    operation: "create" | "update" | "delete";
    before?: unknown;
    after?: unknown;
    diff?: string;
  };

  context?: {
    phase: TaskPhase;
    step?: number;
    reason?: string;
  };
}

export type AuditAction =
  | "board.create"
  | "mission.set"
  | "constraint.add"
  | "fact.add"
  | "fact.update"
  | "fact.verify"
  | "decision.propose"
  | "decision.approve"
  | "decision.reject"
  | "plan.set"
  | "plan.advance"
  | "step.start"
  | "step.complete"
  | "step.fail"
  | "status.update"
  | "alert.raise"
  | "alert.resolve"
  | "snippet.add"
  | "snippet.update"
  | "snippet.verify"
  | "snippet.evict"
  | "view.compile";

// ============================================================
// COMPLETE BOARD STATE
// ============================================================

export interface Board {
  meta: BoardMeta;
  mission: Mission;
  facts: Fact[];
  decisions: Decision[];
  plan: Plan | null;
  status: Status;
  alerts: Alert[];
  snippets: Snippet[];
}

// ============================================================
// ENTITY UNION TYPE
// ============================================================

export type Entity = Fact | Decision | Alert | PlanStep | Constraint | Snippet;

// ============================================================
// TRAILS (Memory Candidates)
// ============================================================

export type TrailId = `T-${string}`;

export type TrailMarker =
  | "[BUG_FIX]"
  | "[PREFERENCE]"
  | "[DECISION]"
  | "[PATTERN]"
  | "[SURPRISE]"
  | "[GATE]";

export interface TrailEntry {
  ts: Timestamp;
  schema_version: "1.1";
  id: TrailId;
  task_id: TaskId;
  marker: TrailMarker;
  summary: string;
  agent: AgentRole;
  details: TrailDetails;
  evidence: string[];
}

export type TrailDetails =
  | BugFixDetails
  | PreferenceDetails
  | DecisionDetails
  | PatternDetails
  | SurpriseDetails
  | GateDetails;

export interface BugFixDetails {
  symptoms: string;
  root_cause: string;
  fix: string;
  files: string[];
}

export interface PreferenceDetails {
  statement: string;
  scope: "task" | "project" | "global";
  source: "user" | "inferred";
}

export interface DecisionDetails {
  context: string;
  options: string[];
  choice: string;
  rationale: string;
}

export interface PatternDetails {
  name: string;
  when_to_use: string;
  implementation: string;
}

export interface SurpriseDetails {
  expected: string;
  actual: string;
  resolution: string;
}

export interface GateDetails {
  phase: TaskPhase;
  outcome: "passed" | "blocked" | "user_override";
  reason?: string;
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

export function isFactId(id: string): id is FactId {
  return /^F-\d+$/.test(id);
}

export function isDecisionId(id: string): id is DecisionId {
  return /^D-\d+$/.test(id);
}

export function isAlertId(id: string): id is AlertId {
  return /^A-\d+$/.test(id);
}

export function isStepId(id: string): id is StepId {
  return /^S-\d+$/.test(id);
}

export function isConstraintId(id: string): id is ConstraintId {
  return /^C-\d+$/.test(id);
}

export function isSnippetId(id: string): id is SnippetId {
  return /^X-\d+$/.test(id);
}

export function getEntityType(id: EntityId): EntityType {
  if (isFactId(id)) return "fact";
  if (isDecisionId(id)) return "decision";
  if (isAlertId(id)) return "alert";
  if (isStepId(id)) return "step";
  if (isConstraintId(id)) return "constraint";
  if (isSnippetId(id)) return "snippet";
  throw new Error(`Unknown entity ID format: ${id}`);
}

export function generateTaskId(): TaskId {
  const now = new Date();
  const pad = (n: number, len = 2) => n.toString().padStart(len, "0");

  // Include milliseconds for uniqueness in fast operations
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}-${pad(now.getMilliseconds(), 3)}`;
}

export function now(): Timestamp {
  return new Date().toISOString();
}
