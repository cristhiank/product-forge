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
  /** Lifecycle hooks for SDK-level events */
  hooks?: WorkerHooks;
  /** Custom tools to register with the worker */
  tools?: WorkerTool[];
  /** Error recovery policy */
  errorPolicy?: ErrorPolicy;
  /** Callback invoked for each streaming worker event */
  onEvent?: (event: WorkerEvent) => void;
}

/** Information about a spawned worker */
export interface WorkerInfo {
  workerId: string;
  pid: number;
  /** PID of the actual copilot process spawned by the wrapper (0 if unknown) */
  copilotPid: number;
  worktreePath: string;
  branchName: string;
  stateDir: string;
  outputLog: string;
  status: 'spawning' | 'running' | 'completed' | 'failed' | 'unknown' | 'spawn_failed' | 'completed_no_exit';
  /** Git SHA of the base commit when the worktree was created */
  baseSha?: string;
  /** SDK session identifier */
  sessionId?: string;
  /** Whether the worker is running in interactive mode */
  interactive?: boolean;
  /** Path to the events log file */
  eventsLog?: string;
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
  /** Commit messages on the worker branch (from exit.json git report) */
  commits: string[];
  /** Files changed on the worker branch (from exit.json git report) */
  filesChanged: string[];
  /** Whether the worker had uncommitted changes at exit time */
  hasDirtyWorkingTree: boolean;
  /** Total number of streaming events emitted */
  eventCount?: number;
  /** Name of the last tool invoked, or null if none */
  lastToolUsed?: string | null;
  /** Number of assistant turns completed */
  turnCount?: number;
  /** Token usage summary (input/output) if available */
  tokenUsage?: { input: number; output: number };
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
  /** Git SHA of the base commit when the worktree was created */
  base_sha?: string;
  /** SDK session identifier */
  session_id?: string;
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

/** Options for validateWorker */
export interface ValidateWorkerOptions {
  /** Build command to run in the worktree (e.g. "dotnet build Kania.slnx -v minimal") */
  buildCommand?: string;
  /** Changed files must be under at least one of these path prefixes */
  requiredPathPrefixes?: string[];
  /** Changed files must NOT be under any of these path prefixes */
  forbiddenPathPrefixes?: string[];
  /** Require at least one commit on the worker branch (default: true) */
  requireCommits?: boolean;
}

/** Result of validateWorker */
export interface ValidationResult {
  /** Overall pass/fail */
  valid: boolean;
  /** Whether the worker branch has commits beyond HEAD */
  hasCommits: boolean;
  /** Number of commits on the worker branch */
  commitCount: number;
  /** Commit messages on the worker branch */
  commitMessages: string[];
  /** Files changed on the worker branch */
  filesChanged: string[];
  /** Files outside required prefixes or inside forbidden prefixes */
  scopeViolations: string[];
  /** Build pass/fail (null if no buildCommand provided) */
  buildPassed: boolean | null;
  /** Build stdout+stderr output */
  buildOutput: string;
  /** Error messages encountered during validation */
  errors: string[];
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

// ---------------------------------------------------------------------------
// SDK Migration Types
// ---------------------------------------------------------------------------

/** Input passed to onPreToolUse hook */
export interface ToolUseInput {
  /** Name of the tool being invoked */
  toolName: string;
  /** Arguments the model supplied to the tool */
  toolArgs: Record<string, unknown>;
}

/** Decision returned by the onPreToolUse hook */
export interface ToolUseDecision {
  /** Whether to allow, deny, or prompt the user */
  permissionDecision: 'allow' | 'deny' | 'ask';
  /** Optionally override the args passed to the tool */
  modifiedArgs?: Record<string, unknown>;
  /** Extra context injected into the session before tool execution */
  additionalContext?: string;
}

/** Result payload passed to onPostToolUse hook */
export interface ToolUseResult {
  /** Name of the tool that completed */
  toolName: string;
  /** Raw result returned by the tool */
  result: unknown;
}

/** Decision returned by the onError hook */
export type ErrorDecision = { errorHandling: 'retry' | 'skip' | 'abort' };

/** Lifecycle hooks that fire during SDK-driven worker sessions */
export interface WorkerHooks {
  /** Called before a tool is executed; may allow/deny/modify the call */
  onPreToolUse?: (input: ToolUseInput) => ToolUseDecision | void;
  /** Called after a tool completes; may inject additional context */
  onPostToolUse?: (input: ToolUseResult) => { additionalContext?: string } | void;
  /** Called when a prompt is submitted; may rewrite the prompt */
  onPromptSubmitted?: (input: { prompt: string }) => { modifiedPrompt?: string } | void;
  /** Called when a worker session begins; may inject startup context */
  onSessionStart?: (input: { source: string }) => { additionalContext?: string } | void;
  /** Called when a worker session ends */
  onSessionEnd?: (input: { reason: string }) => void;
  /** Called on unhandled errors; returns recovery decision */
  onError?: (input: { error: Error; context: string }) => ErrorDecision;
}

/** A custom tool registered with a worker session */
export interface WorkerTool {
  /** Unique tool name visible to the model */
  name: string;
  /** Human-readable description shown to the model */
  description: string;
  /** JSON Schema for the tool's parameters */
  parameters?: Record<string, unknown>;
  /** Implementation invoked when the model calls this tool */
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

/** Error recovery policy applied to a worker session */
export interface ErrorPolicy {
  /** How to handle HTTP 429 rate-limit responses */
  onRateLimit?: 'retry' | 'abort';
  /** How to handle context-window overflow */
  onContextOverflow?: 'abort' | 'compact';
  /** How to handle tool execution errors */
  onToolError?: 'retry' | 'skip' | 'abort';
  /** Maximum number of automatic retries */
  maxRetries?: number;
}

/**
 * Discriminated union of streaming events emitted by a worker session.
 * Each variant carries a `type`, a `data` payload, and an ISO-8601 `timestamp`.
 */
export type WorkerEvent =
  | { type: 'assistant.message_delta'; data: { deltaContent: string }; timestamp: string }
  | { type: 'tool.execution_start'; data: { toolName: string; toolArgs: Record<string, unknown> }; timestamp: string }
  | { type: 'tool.execution_complete'; data: { toolName: string; result: unknown }; timestamp: string }
  | { type: 'session.idle'; data: Record<string, never>; timestamp: string }
  | { type: 'session.error'; data: { error: string }; timestamp: string }
  | { type: 'status.change'; data: { from: string; to: string }; timestamp: string };

/** Condensed summary of a single tool invocation (used in WorkerHistory) */
export interface ToolCallSummary {
  /** Tool name */
  toolName: string;
  /** Number of times this tool was called */
  count: number;
  /** Arguments from the most recent invocation */
  lastArgs?: Record<string, unknown>;
}

/** Condensed summary of a commit on the worker branch */
export interface CommitSummary {
  /** Full commit SHA */
  sha: string;
  /** Commit message */
  message: string;
  /** Number of files changed in this commit */
  filesChanged: number;
}

/** Full history record for a completed worker — used in retrospectives */
export interface WorkerHistory {
  /** Worker identifier */
  workerId: string;
  /** Optional caller-supplied task identifier */
  taskId?: string;
  /** Original prompt submitted to the worker */
  prompt: string;
  /** Agent override, or null if default */
  agent: string | null;
  /** Model override, or null if default */
  model: string | null;
  /** ISO-8601 timestamp when the worker started */
  startedAt: string;
  /** ISO-8601 timestamp when the worker completed, or null if still running */
  completedAt: string | null;
  /** Process exit code, or null if still running */
  exitCode: number | null;
  /** Git SHA of the base commit */
  baseSha: string;
  /** Worker branch name */
  branchName: string;
  /** Number of assistant turns completed */
  turnCount: number;
  /** Per-tool invocation summaries */
  toolCalls: ToolCallSummary[];
  /** Commits pushed on the worker branch */
  commits: CommitSummary[];
  /** Paths of files changed across all commits */
  filesChanged: string[];
  /** Total streaming events emitted */
  eventCount: number;
  /** Wall-clock duration in milliseconds */
  durationMs: number;
  /** Number of errors encountered */
  errorCount: number;
  /** Message of the last error, or null if none */
  lastError: string | null;
}
