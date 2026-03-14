/**
 * WorkerManager — slim orchestrator delegating to WorktreeManager, StateStore, and SessionRunner.
 *
 * Manages Copilot CLI worker SDK sessions in isolated git worktrees.
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { WorktreeManager } from './worktree.js';
import { StateStore, type ExitData } from './state.js';
import { SessionRunner } from './session.js';
import { applyContext } from './context.js';
import type {
  SpawnOptions,
  WorkerInfo,
  WorkerStatus,
  CleanupResult,
  WorkerMeta,
  ValidateWorkerOptions,
  ValidationResult,
  AwaitOptions,
} from './types.js';

export class WorkerManager {
  private readonly worktreeManager: WorktreeManager;
  private readonly stateStore: StateStore;
  private readonly sessionRunner: SessionRunner;
  private readonly workersDir: string;

  private static readonly TERMINAL_STATUSES = new Set([
    'completed', 'failed', 'spawn_failed', 'completed_no_exit',
  ]);

  constructor(private readonly repoRoot: string) {
    this.workersDir = join(repoRoot, '.copilot-workers');
    this.worktreeManager = new WorktreeManager(repoRoot);
    this.stateStore = new StateStore(this.workersDir);
    this.sessionRunner = new SessionRunner(this.stateStore);
  }

  /**
   * Spawn a new worker SDK session in an isolated git worktree.
   * Returns a WorkerInfo immediately; the session runs asynchronously.
   */
  async spawn(opts: SpawnOptions): Promise<WorkerInfo> {
    if (!opts.prompt) throw new Error('prompt is required');

    // Task deduplication: reject if a running session shares this taskId
    if (opts.taskId) {
      for (const wid of this.stateStore.listWorkerIds()) {
        try {
          const existing = this.stateStore.readMeta(wid);
          if (existing.task_id !== opts.taskId) continue;
          if (this.sessionRunner.isActive(wid) ||
              existing.status === 'spawning' ||
              existing.status === 'running') {
            throw new Error(
              `taskId already active: ${opts.taskId} (workerId=${wid}, status=${existing.status})`,
            );
          }
        } catch (err) {
          if (err instanceof Error && err.message.includes('taskId already active:')) throw err;
        }
      }
    }

    const workerId = randomUUID();

    // 1. Create git worktree + state directory
    const { worktreePath, branchName, baseSha, stateDir } = this.worktreeManager.create({
      workerId,
      worktreeBase: opts.worktreeBase,
      branchPrefix: opts.branchPrefix,
    });

    // 2. Apply context providers (symlinks, files, prompt sections)
    //    NOTE: env vars from context providers are not forwarded to the in-process SDK session.
    const { prompt: augmentedPrompt, result: contextResult } = applyContext(
      opts.contextProviders ?? [],
      this.repoRoot,
      worktreePath,
      workerId,
      opts.prompt,
    );

    // 3. Initialise persistent state
    const meta: WorkerMeta = {
      worker_id: workerId,
      pid: 0,
      worktree_path: worktreePath,
      branch_name: branchName,
      prompt: opts.prompt,
      agent: opts.agent ?? '',
      model: opts.model ?? '',
      started_at: new Date().toISOString(),
      status: 'spawning',
      task_id: opts.taskId,
      context_providers: contextResult,
      base_sha: baseSha,
    };
    this.stateStore.initWorker(workerId, meta);

    // 4. Start SDK session (fire-and-forget; errors are captured into state)
    const sessionOpts: SpawnOptions = { ...opts, prompt: augmentedPrompt };
    this.sessionRunner.start(workerId, worktreePath, sessionOpts).catch((err: unknown) => {
      this.stateStore.updateStatus(workerId, 'spawn_failed');
      this.stateStore.appendEvent(workerId, {
        type: 'session.error',
        data: { error: err instanceof Error ? err.message : String(err) },
        timestamp: new Date().toISOString(),
      });
    });

    const eventsLog = join(stateDir, 'events.ndjson');

    return {
      workerId,
      pid: 0,
      copilotPid: 0,
      worktreePath,
      branchName,
      stateDir,
      outputLog: eventsLog,
      status: 'spawning',
      baseSha,
      interactive: true,
      eventsLog,
    };
  }

  /**
   * Get detailed status for a worker, combining state store and live session info.
   */
  getStatus(workerId: string): WorkerStatus {
    if (!this.stateStore.exists(workerId)) {
      throw new Error(`Worker not found: ${workerId}`);
    }

    const meta = this.stateStore.readMeta(workerId);
    const stateDir = join(this.workersDir, workerId);
    const isActive = this.sessionRunner.isActive(workerId);
    const sessionInfo = this.sessionRunner.getSessionInfo(workerId);

    // Read exit.json once (used for status + hasDirtyWorkingTree + fallback fields)
    const exitPath = join(stateDir, 'exit.json');
    let exitData: ExitData | null = null;
    if (existsSync(exitPath)) {
      try {
        exitData = JSON.parse(readFileSync(exitPath, 'utf-8')) as ExitData;
      } catch {
        // Malformed exit.json — treat as absent
      }
    }

    // Determine effective status
    let status: WorkerStatus['status'];
    if (meta.status === 'spawn_failed') {
      status = 'spawn_failed';
    } else if (isActive) {
      status = meta.status === 'spawning' ? 'spawning' : 'running';
    } else if (exitData !== null) {
      status = exitData.exitCode === 0 ? 'completed' : 'failed';
    } else if (meta.status === 'completed') {
      status = 'completed';
    } else if (meta.status === 'failed') {
      status = 'failed';
    } else if (meta.status === 'running') {
      status = 'completed_no_exit';
    } else {
      status = 'unknown';
    }

    // Read WorkerHistory for completed workers (rich commit/exit data)
    const history = this.stateStore.readHistory(workerId);

    let exitCode: number | null = null;
    let completedAt: string | null = null;
    let commits: string[] = [];
    let filesChanged: string[] = [];
    const hasDirtyWorkingTree = exitData?.hasDirtyWorkingTree ?? false;

    if (history) {
      exitCode = history.exitCode;
      completedAt = history.completedAt;
      commits = history.commits.map(c => c.message);
      filesChanged = history.filesChanged;
    } else if (exitData) {
      exitCode = exitData.exitCode;
      completedAt = exitData.completedAt;
      commits = exitData.commits ?? [];
      filesChanged = exitData.filesChanged ?? [];
    }

    // Events tail serves as the log equivalent for SDK sessions
    const events = this.stateStore.readEvents(workerId, { tail: 20 });
    const logTail = events.map(e => JSON.stringify(e));

    // Error summary from the most recent session.error event
    let errorSummary: string | null = null;
    if (status === 'failed') {
      for (let i = events.length - 1; i >= 0; i--) {
        const evt = events[i];
        if (evt.type === 'session.error') {
          errorSummary = evt.data.error;
          break;
        }
      }
    }

    const worktreeExists = Boolean(meta.worktree_path) && existsSync(meta.worktree_path);
    const eventsLog = join(stateDir, 'events.ndjson');

    return {
      workerId,
      pid: meta.pid,
      copilotPid: 0,
      worktreePath: meta.worktree_path,
      branchName: meta.branch_name,
      stateDir,
      outputLog: eventsLog,
      status,
      prompt: meta.prompt,
      agent: meta.agent || null,
      model: meta.model || null,
      startedAt: meta.started_at,
      worktreeExists,
      logSizeBytes: 0,
      logLines: events.length,
      exitCode,
      completedAt,
      logTail,
      errorSummary,
      commits,
      filesChanged,
      hasDirtyWorkingTree,
      eventCount: sessionInfo?.eventCount ?? history?.eventCount ?? events.length,
      lastToolUsed: sessionInfo?.lastToolUsed ?? null,
      turnCount: sessionInfo?.turnCount ?? history?.turnCount ?? 0,
      baseSha: meta.base_sha,
      sessionId: meta.session_id,
      interactive: true,
      eventsLog,
    };
  }

  /**
   * List all known workers with lightweight status info.
   * When autoCleanup is true, stale workers are cleaned up asynchronously.
   */
  listWorkers(
    opts?: { autoCleanup?: boolean },
  ): Array<{ workerId: string; pid: number; status: WorkerStatus['status']; taskId?: string }> {
    const workerIds = this.stateStore.listWorkerIds();
    const workers: Array<{ workerId: string; pid: number; status: WorkerStatus['status']; taskId?: string }> = [];

    for (const workerId of workerIds) {
      let status: WorkerStatus['status'] = 'unknown';
      let taskId: string | undefined;

      try {
        const meta = this.stateStore.readMeta(workerId);
        taskId = meta.task_id;

        if (meta.status === 'spawn_failed') {
          status = 'spawn_failed';
        } else if (this.sessionRunner.isActive(workerId)) {
          status = meta.status === 'spawning' ? 'spawning' : 'running';
        } else {
          const exitPath = join(this.workersDir, workerId, 'exit.json');
          if (existsSync(exitPath)) {
            try {
              const exitData: ExitData = JSON.parse(readFileSync(exitPath, 'utf-8'));
              status = exitData.exitCode === 0 ? 'completed' : 'failed';
            } catch {
              status = 'unknown';
            }
          } else if (meta.status === 'completed') {
            status = 'completed';
          } else if (meta.status === 'failed') {
            status = 'failed';
          } else if (meta.status === 'running') {
            status = 'completed_no_exit';
          }
        }
      } catch {
        // Skip workers with unreadable metadata
      }

      workers.push({ workerId, pid: 0, status, taskId });
    }

    if (opts?.autoCleanup) {
      const stale = workers.filter(w => w.status !== 'running' && w.status !== 'spawning');
      for (const w of stale) {
        this.cleanup(w.workerId, true).catch(() => { /* ignore cleanup errors in autoCleanup */ });
      }
      return workers.filter(w => !stale.some(s => s.workerId === w.workerId));
    }

    return workers;
  }

  /**
   * Wait for a worker session to reach a terminal state.
   * Event-driven via SessionRunner — no Atomics.wait polling.
   */
  async awaitCompletion(workerId: string, opts: AwaitOptions = {}): Promise<WorkerStatus> {
    if (!this.stateStore.exists(workerId)) {
      throw new Error(`Worker not found: ${workerId}`);
    }

    // Return immediately if already terminal
    const current = this.getStatus(workerId);
    if (WorkerManager.TERMINAL_STATUSES.has(current.status)) {
      return current;
    }

    // Optional progress reporting while the session runs
    let progressTimer: ReturnType<typeof setInterval> | undefined;
    if (opts.onProgress) {
      const onProgress = opts.onProgress;
      progressTimer = setInterval(() => {
        try { onProgress(this.getStatus(workerId)); } catch { /* ignore callback errors */ }
      }, opts.pollIntervalMs ?? 3_000);
    }

    try {
      await this.sessionRunner.awaitCompletion(workerId, opts.timeoutMs);
    } finally {
      if (progressTimer !== undefined) clearInterval(progressTimer);
    }

    return this.getStatus(workerId);
  }

  /**
   * Send a follow-up message to an active worker session.
   * Returns the assistant's response text, or null if the session is inactive.
   */
  async sendMessage(workerId: string, message: string): Promise<string | null> {
    return this.sessionRunner.sendMessage(workerId, message);
  }

  /**
   * Validate a worker's output: commits present, file scope, optional build check.
   * Uses base_sha for accurate diff base.
   */
  validateWorker(workerId: string, opts: ValidateWorkerOptions = {}): ValidationResult {
    if (!this.stateStore.exists(workerId)) {
      throw new Error(`Worker not found: ${workerId}`);
    }

    const meta = this.stateStore.readMeta(workerId);
    const requireCommits = opts.requireCommits !== false;
    const diffBase = meta.base_sha ?? 'HEAD';

    const result: ValidationResult = {
      valid: true,
      hasCommits: false,
      commitCount: 0,
      commitMessages: [],
      filesChanged: [],
      scopeViolations: [],
      buildPassed: null,
      buildOutput: '',
      errors: [],
    };

    // 1. Commits on worker branch since base
    try {
      const commitLog = execSync(
        `git log --oneline ${diffBase}..${meta.branch_name}`,
        { cwd: this.repoRoot, stdio: 'pipe', encoding: 'utf-8' },
      ).trim();
      if (commitLog.length > 0) {
        const lines = commitLog.split('\n').filter(l => l.trim().length > 0);
        result.hasCommits = true;
        result.commitCount = lines.length;
        result.commitMessages = lines.map(l => l.replace(/^[a-f0-9]+ /, ''));
      }
    } catch (err) {
      result.errors.push(`Failed to read commits: ${err instanceof Error ? err.message : String(err)}`);
      result.valid = false;
    }

    if (requireCommits && !result.hasCommits) {
      result.valid = false;
      result.errors.push('No commits found on worker branch');
    }

    // 2. Changed files vs base (three-dot diff finds the merge base)
    try {
      const diffOutput = execSync(
        `git diff --name-only ${diffBase}...${meta.branch_name}`,
        { cwd: this.repoRoot, stdio: 'pipe', encoding: 'utf-8' },
      ).trim();
      if (diffOutput.length > 0) {
        result.filesChanged = diffOutput.split('\n').filter(l => l.trim().length > 0);
      }
    } catch (err) {
      result.errors.push(`Failed to read changed files: ${err instanceof Error ? err.message : String(err)}`);
      result.valid = false;
    }

    // 3. Path scope check
    for (const file of result.filesChanged) {
      if (opts.requiredPathPrefixes?.length) {
        if (!opts.requiredPathPrefixes.some(prefix => file.startsWith(prefix))) {
          result.scopeViolations.push(file);
        }
      }
      if (opts.forbiddenPathPrefixes?.length) {
        if (opts.forbiddenPathPrefixes.some(prefix => file.startsWith(prefix)) &&
            !result.scopeViolations.includes(file)) {
          result.scopeViolations.push(file);
        }
      }
    }
    if (result.scopeViolations.length > 0) result.valid = false;

    // 4. Optional build command run inside the worktree
    if (opts.buildCommand) {
      if (meta.worktree_path && existsSync(meta.worktree_path)) {
        try {
          result.buildOutput = execSync(opts.buildCommand, {
            cwd: meta.worktree_path,
            stdio: 'pipe',
            encoding: 'utf-8',
            timeout: 120_000,
          });
          result.buildPassed = true;
        } catch (err) {
          result.buildPassed = false;
          const e = err as { stdout?: string; stderr?: string; message?: string };
          result.buildOutput = (e.stdout ?? '') + (e.stderr ?? '') || (e.message ?? 'Build failed');
          result.valid = false;
        }
      } else {
        result.buildPassed = false;
        result.buildOutput = 'Worktree does not exist';
        result.errors.push('Cannot run build: worktree does not exist');
        result.valid = false;
      }
    }

    return result;
  }

  /**
   * Clean up a worker: stop SDK session, remove worktree + branch,
   * deregister from agents-hub, then delete state.
   */
  async cleanup(workerId: string, force = false): Promise<CleanupResult> {
    if (!this.stateStore.exists(workerId)) {
      throw new Error(`Worker not found: ${workerId}`);
    }

    const meta = this.stateStore.readMeta(workerId);

    if (!force && this.sessionRunner.isActive(workerId)) {
      throw new Error(`Worker ${workerId} is still active; use force=true to force cleanup.`);
    }

    // 1. Gracefully stop SDK session (no-op if already stopped)
    await this.sessionRunner.stop(workerId);

    // 2. Remove git worktree + branch
    const { worktreeRemoved, branchDeleted } = this.worktreeManager.remove(
      meta.worktree_path,
      meta.branch_name,
    );

    // 3. Best-effort hub deregistration
    tryDeregisterFromHub(workerId, this.repoRoot);

    // 4. Delete state directory
    this.stateStore.remove(workerId);

    return {
      workerId,
      status: 'cleaned',
      worktreeRemoved,
      branchDeleted,
      stateRemoved: true,
    };
  }
}

/**
 * Best-effort deregister a worker from the agents-hub SQLite DB.
 * Uses the sqlite3 CLI for zero-dependency interaction.
 * Swallows all errors — cleanup must never fail due to hub unavailability.
 */
function tryDeregisterFromHub(workerId: string, repoRoot: string): void {
  // sqlite3 CLI is unavailable on Windows; workers remain 'active' until next hub sync.
  if (process.platform === 'win32') return;
  try {
    const gitCommonDir = execSync('git rev-parse --git-common-dir', {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    const dbPath = resolve(repoRoot, gitCommonDir, 'devpartner', 'hub.db');
    if (!existsSync(dbPath)) return;

    const sql = `UPDATE workers SET status='completed', completed_at=datetime('now') WHERE id='${workerId.replace(/'/g, "''")}' AND status='active';`;
    execSync(`sqlite3 "${dbPath}" "${sql}"`, {
      cwd: repoRoot,
      stdio: 'pipe',
      timeout: 5_000,
    });
  } catch {
    // Silently ignore if hub DB or sqlite3 is unavailable
  }
}
