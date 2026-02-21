/**
 * TypeScript types for Copilot CLI worker management
 */

/** Options for spawning a new worker */
export interface SpawnOptions {
  /** Prompt for the Copilot CLI worker (required) */
  prompt: string;
  /** Custom agent (e.g., 'Scout', 'Executor', 'Planner') */
  agent?: string;
  /** Model override (e.g., 'claude-opus-4.6', 'claude-sonnet-4.5') */
  model?: string;
  /** Base directory for worktrees (default: '../worktrees/') */
  worktreeBase?: string;
  /** Branch name prefix (default: 'worker') */
  branchPrefix?: string;
  /** Directories to allow access to */
  addDirs?: string[];
  /** Allow access to all paths */
  allowAllPaths?: boolean;
  /** Allow all URL access */
  allowAllUrls?: boolean;
  /** Enable autopilot mode */
  autopilot?: boolean;
}

/** Information about a spawned worker */
export interface WorkerInfo {
  workerId: string;
  pid: number;
  worktreePath: string;
  branchName: string;
  stateDir: string;
  outputLog: string;
  status: 'running' | 'stopped' | 'unknown';
}

/** Detailed worker status */
export interface WorkerStatus extends WorkerInfo {
  prompt: string;
  agent: string | null;
  model: string | null;
  startedAt: string;
  worktreeExists: boolean;
  logSizeBytes: number;
  logLines: number;
}

/** Result of cleaning up a worker */
export interface CleanupResult {
  workerId: string;
  status: 'cleaned';
  worktreeRemoved: boolean;
  branchDeleted: boolean;
  stateRemoved: boolean;
}

/** Worker metadata stored in meta.json */
export interface WorkerMeta {
  worker_id: string;
  pid: number;
  worktree_path: string;
  branch_name: string;
  prompt: string;
  agent: string;
  model: string;
  started_at: string;
  status: string;
}
