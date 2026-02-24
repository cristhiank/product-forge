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
  /** Enable all permissions shortcut (--allow-all) */
  allowAll?: boolean;
  /** Directories to allow access to */
  addDirs?: string[];
  /** Allow access to all paths */
  allowAllPaths?: boolean;
  /** Allow all URL access */
  allowAllUrls?: boolean;
  /** Allow specific tools without confirmation (repeatable) */
  allowTools?: string[];
  /** Deny specific tools (repeatable) */
  denyTools?: string[];
  /** Restrict model-visible tools to this set */
  availableTools?: string[];
  /** Exclude specific tools from model-visible set */
  excludedTools?: string[];
  /** Allow specific URLs or domains without confirmation */
  allowUrls?: string[];
  /** Deny specific URLs or domains */
  denyUrls?: string[];
  /** Prevent automatic access to system temp directory */
  disallowTempDir?: boolean;
  /** Disable ask_user tool for autonomous runs */
  noAskUser?: boolean;
  /** Disable parallel execution of tool calls */
  disableParallelToolsExecution?: boolean;
  /** Streaming mode */
  stream?: 'on' | 'off';
  /** Enable autopilot mode */
  autopilot?: boolean;
  /** Maximum continuation messages in autopilot mode */
  maxAutopilotContinues?: number;
  /** Context providers to apply to the worker worktree (symlinks, env, files, prompt sections) */
  contextProviders?: WorkerContextProvider[];
  /** Optional caller-provided task ID for deduplication and tracking */
  taskId?: string;
  /** Auto-commit uncommitted changes when worker exits successfully (exit code 0) */
  autoCommit?: boolean | string;
}

/** Information about a spawned worker */
export interface WorkerInfo {
  workerId: string;
  pid: number;
  worktreePath: string;
  branchName: string;
  stateDir: string;
  outputLog: string;
  status: 'spawning' | 'running' | 'completed' | 'failed' | 'unknown' | 'spawn_failed' | 'completed_no_exit';
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
  exitCode: number | null;
  completedAt: string | null;
  logTail: string[];
  errorSummary: string | null;
}

/** Result of cleaning up a worker */
export interface CleanupResult {
  workerId: string;
  status: 'cleaned';
  worktreeRemoved: boolean;
  branchDeleted: boolean;
  stateRemoved: boolean;
}

/** Options for awaitCompletion */
export interface AwaitOptions {
  /** Polling interval in milliseconds (default: 3000) */
  pollIntervalMs?: number;
  /** Maximum wait time in milliseconds (default: no limit) */
  timeoutMs?: number;
  /** Callback invoked on each poll with current status */
  onProgress?: (status: WorkerStatus) => void;
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
  status: 'spawning' | 'running' | 'completed' | 'failed' | 'spawn_failed';
  task_id?: string;
  context_providers?: ContextProviderResult;
}

/** Specification for a symlink in a worker context */
export interface SymlinkSpec {
  /** Source path (supports {{repoRoot}}, {{worktreePath}}, {{workerId}} templates) */
  source: string;
  /** Target path relative to worktree root */
  target: string;
}

/** A context provider declared by a skill */
export interface WorkerContextProvider {
  /** Skill name that provides this context */
  provider: string;
  /** Schema version */
  version: string;
  /** Context configuration */
  context: {
    /** Symlinks to create in the worktree */
    symlinks?: SymlinkSpec[];
    /** Environment variables to set for the worker process */
    env?: Record<string, string>;
    /** Files to write in the worktree (relative path → content) */
    files?: Record<string, string>;
    /** Prompt sections to append (key → text) */
    prompt_sections?: Record<string, string>;
  };
}

/** Result of applying context providers */
export interface ContextProviderResult {
  /** Providers that were discovered and applied */
  providers: string[];
  /** Number of symlinks created */
  symlinksCreated: number;
  /** Number of env vars added */
  envVarsAdded: number;
  /** Number of files written */
  filesWritten: number;
  /** Number of prompt sections injected */
  promptSectionsInjected: number;
  /** Warnings encountered during application */
  warnings: string[];
}
