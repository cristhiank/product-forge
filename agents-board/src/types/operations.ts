/**
 * Agent Collaboration Board - Operation Types
 *
 * Types for board operations, permissions, and requests/responses.
 */

import type {
    AgentRole,
    Alert,
    AlertSeverity,
    Alternative,
    Confidence,
    Constraint,
    Decision,
    EntityId,
    EntityType,
    Evidence,
    Fact,
    FactId,
    PlanStep,
    RiskLevel,
    Scope,
    Snippet,
    StepId,
    StepResult,
    TaskClassification,
    TaskPhase,
    TaskType,
    Timestamp,
} from "./core.js";

// ============================================================
// WRITE OPERATIONS
// ============================================================

export type WriteOperation =
  | "set_mission"
  | "add_constraint"
  | "add_fact"
  | "update_fact"
  | "verify_fact"
  | "propose_decision"
  | "approve_decision"
  | "reject_decision"
  | "set_plan"
  | "advance_step"
  | "complete_step"
  | "fail_step"
  | "decompose_step"
  | "update_status"
  | "raise_alert"
  | "resolve_alert"
  | "append_trail"
  | "add_snippet"
  | "update_snippet"
  | "verify_snippet";

// Permission matrix: which agents can perform which operations
export const PERMISSIONS: Record<WriteOperation, AgentRole[]> = {
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
  verify_snippet: ["orchestrator", "scout", "creative", "verifier", "executor"],
};

export function canPerform(agent: AgentRole, operation: WriteOperation): boolean {
  return PERMISSIONS[operation]?.includes(agent) ?? false;
}

// ============================================================
// OPERATION REQUESTS
// ============================================================

export interface CreateBoardRequest {
  goal: string;
  context?: string;
  constraints?: string[];
  /** Optional task ID (generated if not provided) */
  taskId?: string;
}

export interface CreateBoardResponse {
  task_id: string;
  board_path: string;
}

export interface SetMissionRequest {
  goal: string;
  context?: string;
  constraints?: string[];
  definition_of_done?: string[];
  routing?: {
    task_type?: TaskType;
    risk_level?: RiskLevel;
    scope?: Scope;
  };
}

export interface AddConstraintRequest {
  description: string;
  source?: "user" | "discovered";
}

export interface AddFactRequest {
  content: string;
  confidence: Confidence;
  evidence: Evidence[];
  tags?: string[];
  supports?: EntityId[];
  contradicts?: FactId[];
}

export interface UpdateFactRequest {
  id: FactId;
  content?: string;
  confidence?: Confidence;
  evidence?: Evidence[];
  tags?: string[];
  supports?: EntityId[];
  contradicts?: FactId[];
}

export interface VerifyFactRequest {
  id: FactId;
  confidence?: Confidence;
  notes?: string;
}

export interface ProposeDecisionRequest {
  title: string;
  description: string;
  rationale: string;
  alternatives?: Alternative[];
  based_on?: FactId[];
  tags?: string[];
}

export interface ApproveDecisionRequest {
  id: string;
  affects?: StepId[];
}

export interface RejectDecisionRequest {
  id: string;
  reason: string;
}

export interface SetPlanRequest {
  goal: string;
  approach: string;
  steps: Array<{
    action: string;
    files: string[];
    depends_on?: number[]; // Step numbers (1-indexed)
    verification: string;
  }>;
}

export interface AdvanceStepRequest {
  notes?: string;
}

export interface CompleteStepRequest {
  result: StepResult;
}

export interface FailStepRequest {
  reason: string;
  blockers?: string[];
}

export interface UpdateStatusRequest {
  phase?: TaskPhase;
  classification?: TaskClassification;
  verification?: {
    plan_verdict?: "approved" | "revision_required" | "blocked";
    result_verdict?: "approved" | "revision_required" | "blocked";
  };
}

export interface DecomposeStepRequest {
  step_id: StepId;
  subtasks: string[]; // Action descriptions for each subtask
}

export interface RaiseAlertRequest {
  severity: AlertSeverity;
  title: string;
  description: string;
  references?: EntityId[];
  blocking_step?: StepId;
  tags?: string[];
}

export interface ResolveAlertRequest {
  id: string;
  resolution: string;
}

// Trail requests
export interface AppendTrailRequest {
  marker: "[BUG_FIX]" | "[PREFERENCE]" | "[DECISION]" | "[PATTERN]" | "[SURPRISE]" | "[GATE]";
  summary: string;
  details: Record<string, unknown>;
  evidence?: string[];
}

export interface TrailFilter {
  markers?: ("[BUG_FIX]" | "[PREFERENCE]" | "[DECISION]" | "[PATTERN]" | "[SURPRISE]" | "[GATE]")[];
  after?: Timestamp;
  before?: Timestamp;
  limit?: number;
}

// Snippet requests
export interface AddSnippetRequest {
  /** File path this snippet came from (if applicable) */
  path?: string;
  /** Line range in source file [start, end] inclusive */
  lines?: [number, number];
  /** The actual content (code, text, analysis) */
  content: string;
  /** Why this was captured - helps other agents understand relevance */
  purpose: string;
  /** Optional link to entities this snippet supports */
  linked_to?: EntityId[];
  /** Searchable tags */
  tags?: string[];
}

export interface UpdateSnippetRequest {
  id: string;
  /** Update content */
  content?: string;
  /** Update purpose */
  purpose?: string;
  /** Update linked entities */
  linked_to?: EntityId[];
  /** Update tags */
  tags?: string[];
}

export interface VerifySnippetRequest {
  id: string;
  /** Optionally update content if it changed */
  content?: string;
}

export interface SnippetFilter {
  /** Filter by tags */
  tags?: string[];
  /** Filter by source path (substring match) */
  path?: string;
  /** Filter by staleness: "fresh" | "warn" | "stale" | "all" (default: "all") */
  staleness?: "fresh" | "warn" | "stale" | "all";
  /** Include staleness header in content (default: true) */
  include_staleness_header?: boolean;
  /** Auto-evict stale snippets in background before returning results (default: true) */
  evict_stale?: boolean;
}

// ============================================================
// READ OPERATIONS
// ============================================================

export interface FactFilter {
  confidence?: Confidence[];
  tags?: string[];
  source?: AgentRole[];
  verified?: boolean;
}

export interface DecisionFilter {
  status?: ("proposed" | "approved" | "rejected" | "superseded")[];
  tags?: string[];
}

export interface AlertFilter {
  severity?: AlertSeverity[];
  resolved?: boolean;
  tags?: string[];
}

// ============================================================
// VIEW COMPILATION
// ============================================================

export interface ViewRequest {
  agent: AgentRole;
  focus?: {
    step?: number;
    entities?: EntityId[];
  };
  budget?: {
    max_tokens?: number;
    max_facts?: number;
    max_decisions?: number;
  };
  include?: {
    mission?: boolean;
    facts?: boolean;
    decisions?: boolean;
    plan?: boolean;
    alerts?: boolean;
    history?: boolean;
  };
}

export interface CompiledView {
  mission: {
    goal: string;
    constraints: string[];
    current_step: number;
    total_steps: number;
  };

  facts: CompactFact[];
  decisions: CompactDecision[];
  alerts: CompactAlert[];

  current_step?: {
    number: number;
    action: string;
    files: string[];
    depends_on: string[];
    verification: string;
  };

  compiled_at: Timestamp;
  token_estimate: number;
  entities_included: number;
  entities_available: number;
}

export interface CompactFact {
  id: FactId;
  content: string;
  confidence: Confidence;
  evidence: string;
}

export interface CompactDecision {
  id: string;
  title: string;
  description: string;
}

export interface CompactAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  blocking_step?: number;
}

// ============================================================
// SEARCH TYPES
// ============================================================

export interface SearchQuery {
  text?: string;

  filters?: {
    types?: EntityType[];
    agents?: AgentRole[];
    confidence?: Confidence[];
    severity?: AlertSeverity[];
    status?: string[];
    tags?: string[];
    files?: string[];
    timeRange?: {
      after?: Timestamp;
      before?: Timestamp;
    };
  };

  options?: {
    mode?: "lexical" | "semantic" | "hybrid";
    limit?: number;
    offset?: number;
    minScore?: number;
    includeRelated?: boolean;
    rerank?: boolean;
  };
}

export interface SearchResult {
  entity: Fact | Decision | PlanStep | Constraint | Alert | Snippet;
  entityType: EntityType;
  score: number;
  highlights?: string[];
  matchedFields?: string[];
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query_time_ms: number;
  search_mode: "lexical" | "semantic" | "hybrid" | "direct";
}

// ============================================================
// GRAPH TYPES
// ============================================================

export type RelationType =
  | "supports"
  | "contradicts"
  | "supersedes"
  | "depends_on"
  | "based_on"
  | "affects"
  | "references"
  | "blocks";

export interface GraphQuery {
  from: EntityId;
  relation?: RelationType;
  depth?: number;
  direction?: "outgoing" | "incoming" | "both";
}

export interface Edge {
  from: EntityId;
  to: EntityId;
  relation: RelationType;
  created_at: Timestamp;
}

export interface GraphResult {
  nodes: Array<Fact | Decision | PlanStep | Constraint | Alert>;
  edges: Edge[];
}

// ============================================================
// BOARD CHANGE EVENT
// ============================================================

export interface BoardChange {
  type: EntityType | "mission" | "plan" | "status";
  operation: "create" | "update" | "delete";
  entityId?: EntityId;
  timestamp: Timestamp;
}
