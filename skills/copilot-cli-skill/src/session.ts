/**
 * SessionRunner — manages per-worker CopilotClient SDK sessions.
 *
 * Each worker gets its own CopilotClient instance (isolated SDK server process).
 * Sessions are in-process — they die with the manager (no resume after restart).
 * Events are streamed to NDJSON via StateStore.appendEvent().
 */

import { EventEmitter } from 'node:events';
import { execSync } from 'node:child_process';
import { StateStore } from './state.js';
import type {
  SpawnOptions,
  WorkerEvent,
  WorkerHooks,
  WorkerTool,
  ErrorPolicy,
  WorkerHistory,
  ToolCallSummary,
  CommitSummary,
} from './types.js';

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface ActiveSession {
  workerId: string;
  /** CopilotClient — typed as any: @github/copilot-sdk not installed, loaded via dynamic import */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any;
  /** SDK Session — typed as any: @github/copilot-sdk not installed, loaded via dynamic import */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  session: any;
  worktreePath: string;
  opts: SpawnOptions;
  status: 'starting' | 'running' | 'idle' | 'stopped' | 'error';
  turnCount: number;
  toolCalls: Map<string, number>;
  lastToolUsed: string | null;
  eventCount: number;
  startedAt: number;
  completionPromise: Promise<void>;
  resolve: () => void;
  reject: (err: Error) => void;
}

/** Session info returned by getSessionInfo(). */
export interface SessionInfo {
  status: string;
  turnCount: number;
  eventCount: number;
  lastToolUsed: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Maps a raw SDK event (PascalCase Type/Data) to a typed WorkerEvent, or null for unknowns. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSdkEvent(sdkEvent: any): WorkerEvent | null {
  const timestamp = new Date().toISOString();
  switch (sdkEvent.Type) {
    case 'assistant.message_delta':
      return {
        type: 'assistant.message_delta',
        data: { deltaContent: String(sdkEvent.Data?.DeltaContent ?? '') },
        timestamp,
      };
    case 'session.idle':
      return { type: 'session.idle', data: {}, timestamp };
    case 'tool.execution_start':
      return {
        type: 'tool.execution_start',
        data: {
          toolName: String(sdkEvent.Data?.ToolName ?? ''),
          toolArgs: (sdkEvent.Data?.ToolArgs as Record<string, unknown>) ?? {},
        },
        timestamp,
      };
    case 'tool.execution_complete':
      return {
        type: 'tool.execution_complete',
        data: {
          toolName: String(sdkEvent.Data?.ToolName ?? ''),
          result: (sdkEvent.Data?.Result as unknown) ?? null,
        },
        timestamp,
      };
    default:
      return null;
  }
}

/**
 * Builds the onPermissionRequest handler for a session based on SpawnOptions.
 * Priority: denyTools denied > allowTools approved > default approved.
 */
function buildPermissionHandler(
  opts: SpawnOptions,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): (_req: any, _inv: any) => Promise<{ kind: 'approved' | 'denied' }> {
  if (opts.allowAll) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return async (_req: any, _inv: any) => ({ kind: 'approved' as const });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (req: any, _inv: any) => {
    const toolName = String(req.toolName ?? '');
    if (opts.denyTools?.includes(toolName)) {
      return { kind: 'denied' as const };
    }
    if (opts.allowTools?.includes(toolName)) {
      return { kind: 'approved' as const };
    }
    return { kind: 'approved' as const };
  };
}

/**
 * Builds the onErrorOccurred hook that merges user error hook with policy-based handling.
 * User hook decision wins; policy-based fallback applies when user hook returns void.
 */
function buildErrorHook(
  policy?: ErrorPolicy,
  userHook?: WorkerHooks['onError'],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): (input: any, _inv: any) => { errorHandling: 'retry' | 'skip' | 'abort' } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (input: any, _inv: any): { errorHandling: 'retry' | 'skip' | 'abort' } => {
    if (userHook) {
      const decision = userHook({
        error: input.error instanceof Error ? input.error : new Error(String(input.error ?? 'unknown')),
        context: String(input.context ?? ''),
      });
      if (decision) return decision;
    }
    if (policy) {
      const errMsg = String(input.error ?? '');
      if (policy.onRateLimit && /rate.?limit/i.test(errMsg)) {
        return { errorHandling: policy.onRateLimit };
      }
      if (policy.onContextOverflow && /context/i.test(errMsg)) {
        return { errorHandling: policy.onContextOverflow === 'compact' ? 'skip' : 'abort' };
      }
      if (policy.onToolError) {
        return { errorHandling: policy.onToolError };
      }
    }
    return { errorHandling: 'skip' as const };
  };
}

/** Runs a git command in a worktree directory; returns empty string on failure. */
function runGit(cmd: string, cwd: string): string {
  try {
    return execSync(cmd, { cwd, stdio: 'pipe', encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}

/** Collects git state (commits, changed files, dirty flag) from a worktree after session end. */
function collectGitReport(worktreePath: string): {
  commits: CommitSummary[];
  filesChanged: string[];
  hasDirty: boolean;
} {
  const logOut = runGit('git log --oneline -20', worktreePath);
  const commits: CommitSummary[] = logOut
    .split('\n')
    .filter(Boolean)
    .map((line): CommitSummary => {
      const spaceIdx = line.indexOf(' ');
      return {
        sha: spaceIdx > 0 ? line.slice(0, spaceIdx) : line,
        message: spaceIdx > 0 ? line.slice(spaceIdx + 1) : '',
        filesChanged: 0,
      };
    });

  // Try recent range first; fall back to last commit only
  let filesOut = runGit('git diff --name-only HEAD~20..HEAD', worktreePath);
  if (!filesOut) {
    filesOut = runGit('git diff --name-only HEAD^..HEAD', worktreePath);
  }
  const filesChanged = filesOut.split('\n').filter(Boolean);

  const hasDirty = runGit('git status --porcelain', worktreePath).length > 0;

  return { commits, filesChanged, hasDirty };
}

// ---------------------------------------------------------------------------
// SessionRunner
// ---------------------------------------------------------------------------

export class SessionRunner extends EventEmitter {
  private sessions = new Map<string, ActiveSession>();

  constructor(private stateStore: StateStore) {
    super();
  }

  /**
   * Start a new SDK session for a worker.
   *
   * Creates a CopilotClient, configures the session with hooks/tools/permissions,
   * sends the initial prompt as a fire-and-forget operation, and returns immediately.
   * Use awaitCompletion() to wait for the prompt to finish processing.
   *
   * @param workerId     - Unique worker identifier (must be initialised in StateStore)
   * @param worktreePath - Absolute path to the worker's git worktree
   * @param opts         - Spawn options: prompt, model, tools, hooks, permissions
   */
  async start(workerId: string, worktreePath: string, opts: SpawnOptions): Promise<void> {
    if (this.sessions.has(workerId)) {
      throw new Error(`Session already active for worker: ${workerId}`);
    }

    this.stateStore.updateStatus(workerId, 'running');

    // 1. Dynamic import — string literal required so ncc can statically trace and bundle the SDK.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { CopilotClient } = (await import('@github/copilot-sdk')) as any;

    // 2. Create and start the client
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client: any = new CopilotClient();
    await client.start();

    // 3. Permission handler
    const onPermissionRequest = buildPermissionHandler(opts);

    // 4. Build SDK tool descriptors from WorkerTool definitions
    const sdkTools = (opts.tools ?? []).map((t: WorkerTool) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters ?? {},
      execute: t.execute,
    }));

    // 5. Build lifecycle hooks (user hooks run first, internal cleanup follows)
    const sdkHooks = this.buildSdkHooks(workerId, worktreePath, opts);

    // 6. Create session
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session: any = await client.createSession({
      model: opts.model ?? 'gpt-4.1',
      streaming: true,
      tools: sdkTools,
      hooks: sdkHooks,
      onPermissionRequest,
    });

    // 7. Build completion promise — resolve/reject stored for awaitCompletion() and stop()
    let resolveCompletion!: () => void;
    let rejectCompletion!: (err: Error) => void;
    const completionPromise = new Promise<void>((res, rej) => {
      resolveCompletion = res;
      rejectCompletion = rej;
    });

    // 8. Register active session before wiring events (closure captures it)
    const active: ActiveSession = {
      workerId,
      client,
      session,
      worktreePath,
      opts,
      status: 'running',
      turnCount: 1,
      toolCalls: new Map(),
      lastToolUsed: null,
      eventCount: 0,
      startedAt: Date.now(),
      completionPromise,
      resolve: resolveCompletion,
      reject: rejectCompletion,
    };
    this.sessions.set(workerId, active);

    // 9. Wire event listener — forward SDK events to StateStore + EventEmitter
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    session.On((sdkEvent: any) => {
      const workerEvent = mapSdkEvent(sdkEvent);
      if (!workerEvent) return;

      this.stateStore.appendEvent(workerId, workerEvent);
      active.eventCount++;
      this.emit('event', workerId, workerEvent);
      opts.onEvent?.(workerEvent);

      if (sdkEvent.Type === 'tool.execution_complete') {
        const name = String(sdkEvent.Data?.ToolName ?? '');
        active.toolCalls.set(name, (active.toolCalls.get(name) ?? 0) + 1);
        active.lastToolUsed = name;
      }
      if (sdkEvent.Type === 'session.idle') {
        active.status = 'idle';
      }
    });

    // 10. Fire-and-forget initial prompt — store promise for awaitCompletion()
    (session.sendAndWait({ prompt: opts.prompt }) as Promise<unknown>)
      .then(() => {
        active.status = 'idle';
        active.resolve();
      })
      .catch((err: unknown) => {
        active.status = 'error';
        const error = err instanceof Error ? err : new Error(String(err));
        this.stateStore.appendEvent(workerId, {
          type: 'session.error',
          data: { error: error.message },
          timestamp: new Date().toISOString(),
        });
        active.reject(error);
      });
  }

  /**
   * Send a follow-up message to an active session.
   *
   * Increments the turn counter and accumulates assistant response text via
   * the event stream. Returns the full response for this turn, or null if
   * the session is inactive.
   *
   * @param workerId - Worker identifier
   * @param message  - Follow-up prompt text
   */
  async sendMessage(workerId: string, message: string): Promise<string | null> {
    const active = this.sessions.get(workerId);
    if (!active || active.status === 'stopped' || active.status === 'error') {
      return null;
    }

    active.status = 'running';
    active.turnCount++;

    let responseContent = '';
    const onEvent = (evtWorkerId: string, evt: WorkerEvent): void => {
      if (evtWorkerId === workerId && evt.type === 'assistant.message_delta') {
        responseContent += evt.data.deltaContent;
      }
    };
    this.on('event', onEvent);

    try {
      await (active.session.sendAndWait({ prompt: message }) as Promise<unknown>);
      return responseContent || null;
    } catch (err) {
      active.status = 'error';
      const error = err instanceof Error ? err : new Error(String(err));
      this.emit('error', workerId, error);
      return null;
    } finally {
      this.off('event', onEvent);
    }
  }

  /**
   * Wait for the session's current operation to complete (reach idle/stopped state).
   *
   * @param workerId  - Worker identifier
   * @param timeoutMs - Optional timeout in milliseconds; rejects with Error on expiry
   */
  async awaitCompletion(workerId: string, timeoutMs?: number): Promise<void> {
    const active = this.sessions.get(workerId);
    if (!active) throw new Error(`No active session for worker: ${workerId}`);
    if (active.status === 'idle' || active.status === 'stopped') return;
    if (active.status === 'error') throw new Error(`Session errored for worker: ${workerId}`);

    if (timeoutMs !== undefined) {
      const timeout = new Promise<never>((_, rej) =>
        setTimeout(
          () => rej(new Error(`Session timeout after ${timeoutMs}ms: ${workerId}`)),
          timeoutMs,
        ),
      );
      await Promise.race([active.completionPromise, timeout]);
    } else {
      await active.completionPromise;
    }
  }

  /**
   * Stop a session gracefully.
   *
   * Resolves any pending awaitCompletion() callers, stops the underlying
   * CopilotClient, and removes the session from the active map.
   *
   * @param workerId - Worker identifier
   */
  async stop(workerId: string): Promise<void> {
    const active = this.sessions.get(workerId);
    if (!active) return;

    active.status = 'stopped';
    active.resolve(); // Unblock any awaitCompletion() callers

    try {
      await (active.client.stop() as Promise<unknown>);
    } catch {
      // Best-effort — stop failures must not propagate to callers
    }

    this.sessions.delete(workerId);
    this.stateStore.updateStatus(workerId, 'completed');
  }

  /**
   * Returns true if a session exists and is not in a terminal state.
   *
   * @param workerId - Worker identifier
   */
  isActive(workerId: string): boolean {
    const active = this.sessions.get(workerId);
    return active !== undefined && active.status !== 'stopped' && active.status !== 'error';
  }

  /**
   * Returns runtime info for an active session, or null if no session exists.
   *
   * @param workerId - Worker identifier
   */
  getSessionInfo(workerId: string): SessionInfo | null {
    const active = this.sessions.get(workerId);
    if (!active) return null;
    return {
      status: active.status,
      turnCount: active.turnCount,
      eventCount: active.eventCount,
      lastToolUsed: active.lastToolUsed,
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Builds the SDK hooks object, composing user-provided WorkerHooks with
   * internal lifecycle handlers (auto-commit, git report, history snapshot).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private buildSdkHooks(workerId: string, worktreePath: string, opts: SpawnOptions): Record<string, any> {
    const errorHook = buildErrorHook(opts.errorPolicy, opts.hooks?.onError);

    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onPreToolUse: (input: any, _inv: any) => {
        const userDecision = opts.hooks?.onPreToolUse?.({
          toolName: String(input.toolName ?? ''),
          toolArgs: (input.toolArgs as Record<string, unknown>) ?? {},
        });
        if (userDecision) {
          return {
            permissionDecision: userDecision.permissionDecision,
            ...(userDecision.modifiedArgs !== undefined && { modifiedArgs: userDecision.modifiedArgs }),
            ...(userDecision.additionalContext !== undefined && {
              additionalContext: userDecision.additionalContext,
            }),
          };
        }
        return { permissionDecision: 'allow' as const };
      },

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onPostToolUse: (input: any, _inv: any) => {
        const userResult = opts.hooks?.onPostToolUse?.({
          toolName: String(input.toolName ?? ''),
          result: input.result as unknown,
        });
        if (userResult?.additionalContext !== undefined) {
          return { additionalContext: userResult.additionalContext };
        }
        return undefined;
      },

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onUserPromptSubmitted: (input: any, _inv: any) => {
        const userResult = opts.hooks?.onPromptSubmitted?.({
          prompt: String(input.prompt ?? ''),
        });
        if (userResult?.modifiedPrompt !== undefined) {
          return { modifiedPrompt: userResult.modifiedPrompt };
        }
        return undefined;
      },

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onSessionStart: (input: any, _inv: any) => {
        const userResult = opts.hooks?.onSessionStart?.({
          source: String(input.source ?? ''),
        });
        if (userResult?.additionalContext !== undefined) {
          return { additionalContext: userResult.additionalContext };
        }
        return undefined;
      },

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onSessionEnd: (input: any, _inv: any) => {
        opts.hooks?.onSessionEnd?.({ reason: String(input.reason ?? '') });
        this.handleSessionEnd(workerId, worktreePath, opts).catch((err: unknown) => {
          this.emit('error', workerId, err instanceof Error ? err : new Error(String(err)));
        });
      },

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onErrorOccurred: (input: any, inv: any) => errorHook(input, inv),
    };
  }

  /**
   * Runs post-session cleanup after the SDK session ends:
   *   1. Auto-commits uncommitted changes (if opts.autoCommit is set)
   *   2. Collects git report (commits, changed files, dirty flag)
   *   3. Persists WorkerHistory and ExitData to the state store
   */
  private async handleSessionEnd(
    workerId: string,
    worktreePath: string,
    opts: SpawnOptions,
  ): Promise<void> {
    const active = this.sessions.get(workerId);
    if (!active) return;

    // Auto-commit uncommitted changes when requested
    if (opts.autoCommit) {
      try {
        execSync('git add -A', { cwd: worktreePath, stdio: 'pipe' });
        const msg =
          typeof opts.autoCommit === 'string'
            ? opts.autoCommit
            : 'chore: auto-commit worker changes';
        execSync(`git commit -m "${msg}" --allow-empty`, { cwd: worktreePath, stdio: 'pipe' });
      } catch {
        // No changes to commit or commit failed — non-fatal
      }
    }

    const gitReport = collectGitReport(worktreePath);

    // Read base SHA from state meta (may be absent for SDK-only sessions)
    let baseSha = '';
    try {
      const meta = this.stateStore.readMeta(workerId);
      baseSha = meta.base_sha ?? '';
    } catch {
      // Non-fatal — baseSha left as empty string
    }

    const branchName = runGit('git rev-parse --abbrev-ref HEAD', worktreePath);

    const toolCalls: ToolCallSummary[] = Array.from(active.toolCalls.entries()).map(
      ([toolName, count]): ToolCallSummary => ({ toolName, count }),
    );

    const now = Date.now();
    const history: WorkerHistory = {
      workerId,
      taskId: opts.taskId,
      prompt: opts.prompt,
      agent: opts.agent ?? null,
      model: opts.model ?? null,
      startedAt: new Date(active.startedAt).toISOString(),
      completedAt: new Date(now).toISOString(),
      exitCode: active.status === 'error' ? 1 : 0,
      baseSha,
      branchName,
      turnCount: active.turnCount,
      toolCalls,
      commits: gitReport.commits,
      filesChanged: gitReport.filesChanged,
      eventCount: active.eventCount,
      durationMs: now - active.startedAt,
      errorCount: active.status === 'error' ? 1 : 0,
      lastError: null,
    };

    this.stateStore.writeHistory(workerId, history);
    this.stateStore.writeExit(workerId, {
      exitCode: active.status === 'error' ? 1 : 0,
      completedAt: history.completedAt ?? new Date().toISOString(),
      commits: gitReport.commits.map(c => c.message),
      filesChanged: gitReport.filesChanged,
      hasDirtyWorkingTree: gitReport.hasDirty,
    });
    this.stateStore.updateStatus(workerId, 'completed');
  }
}
