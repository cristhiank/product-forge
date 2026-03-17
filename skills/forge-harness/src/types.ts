// ── Metrics ────────────────────────────────────────────

export interface MetricEntry {
  id: number;
  run_id: string;
  session_id: string | null;
  mode: string;
  metric: string;
  value: string;
  tier: string | null;
  created_at: string;
}

export interface MetricLogOpts {
  runId: string;
  metric: string;
  value: string;
  mode?: string;
  tier?: string;
  sessionId?: string;
}

export interface MetricQueryOpts {
  runId?: string;
  since?: string;
  mode?: string;
  metric?: string;
  limit?: number;
}

export interface MetricSummary {
  totalRuns: number;
  totalEntries: number;
  passRate: number;
  avgRetries: number;
  scopeDriftRate: number;
  correctionRate: number;
  byMetric: Record<string, number>;
}

export interface ModeAggregate {
  runs: number;
  passRate: number;
  avgRetries: number;
  avgCorrections: number;
}

// ── GC Scanner ─────────────────────────────────────────

export type GcScanType = "debt" | "stale-docs" | "dead-exports" | "all";
export type GcSeverity = "critical" | "warning" | "info";

export interface GcScanOpts {
  type: GcScanType;
  path?: string;
}

export interface GcFinding {
  id?: number;
  scan_type: string;
  file_path: string | null;
  line?: number;
  finding: string;
  severity: GcSeverity;
  created_at?: string;
}

export interface GcFindingQueryOpts {
  severity?: GcSeverity;
  type?: string;
  limit?: number;
}

export interface GcClearOpts {
  olderThan?: string;
}

// ── Changelog ──────────────────────────────────────────

export interface ChangelogEntry {
  id?: number;
  mode_file: string;
  entry: string;
  created_at?: string;
}

export interface ChangelogAddOpts {
  modeFile: string;
  entry: string;
}

export interface ChangelogShowOpts {
  modeFile?: string;
}

export interface ChangelogRecentOpts {
  limit?: number;
}

// ── Health ──────────────────────────────────────────────

export interface HealthReport {
  metricsCount: number;
  lastGcScan: string | null;
  suggestGc: boolean;
  runsSinceLastGc: number;
  recentFailRate: number;
  recentEntries: number;
  gcFindingsCount: number;
}

export interface GcSuggestion {
  suggest: boolean;
  reason: string;
  runsSinceLastGc: number;
}

// ── Sandbox ────────────────────────────────────────────

export interface ExecRequest {
  code: string;
  timeout?: number;
}

export interface ExecResponse {
  success: boolean;
  result?: unknown;
  error?: string;
  execution_time_ms: number;
}
