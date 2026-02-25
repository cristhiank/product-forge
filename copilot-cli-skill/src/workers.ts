/**
 * WorkerManager - TypeScript equivalent of spawn-worker.sh, worker-status.sh, cleanup-worker.sh
 *
 * Manages Copilot CLI worker processes in isolated git worktrees.
 */

import { execSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync, statSync, createWriteStream } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import type { SpawnOptions, WorkerInfo, WorkerStatus, CleanupResult, WorkerMeta, ValidateWorkerOptions, ValidationResult } from './types.js';
import { applyContext } from './context-providers.js';

export class WorkerManager {
  private workersDir: string;

  constructor(private repoRoot: string) {
    this.workersDir = join(repoRoot, '.copilot-workers');
  }

  /** Spawn a new Copilot CLI worker in an isolated worktree */
  spawn(opts: SpawnOptions): WorkerInfo {
    if (!opts.prompt) throw new Error('prompt is required');
    if (opts.taskId && existsSync(this.workersDir)) {
      const entries = readdirSync(this.workersDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const metaPath = join(this.workersDir, entry.name, 'meta.json');
        if (!existsSync(metaPath)) continue;
        try {
          const existingMeta: WorkerMeta = JSON.parse(readFileSync(metaPath, 'utf-8'));
          if (existingMeta.task_id !== opts.taskId) continue;
          const existing = this.getStatus(entry.name);
          if (existing.status === 'running' || existing.status === 'spawning') {
            throw new Error(
              `taskId already active: ${opts.taskId} (workerId=${existing.workerId}, status=${existing.status}, pid=${existing.pid})`
            );
          }
        } catch (error) {
          if (error instanceof Error && error.message.includes('taskId already active:')) {
            throw error;
          }
        }
      }
    }

    const workerId = randomUUID();
    const worktreeBase = opts.worktreeBase ?? '../worktrees';
    const branchPrefix = opts.branchPrefix ?? 'worker';

    // Resolve worktree path
    const worktreeBaseAbs = resolve(this.repoRoot, worktreeBase);
    mkdirSync(worktreeBaseAbs, { recursive: true });
    const worktreePath = join(worktreeBaseAbs, workerId);

    // Branch name
    const branchName = `${branchPrefix}/${workerId}`;

    // State directory
    const stateDir = join(this.workersDir, workerId);
    mkdirSync(stateDir, { recursive: true });

    // Create git worktree
    try {
      execSync(`git worktree add -b "${branchName}" "${worktreePath}" HEAD`, {
        cwd: this.repoRoot,
        stdio: 'pipe',
      });
    } catch {
      rmSync(stateDir, { recursive: true, force: true });
      throw new Error('Failed to create git worktree');
    }

    // Apply context providers (symlinks, env, files, prompt sections)
    const { env: contextEnv, prompt: augmentedPrompt, result: contextResult } = applyContext(
      opts.contextProviders ?? [],
      this.repoRoot,
      worktreePath,
      workerId,
      opts.prompt
    );

    // Build copilot command
    const args: string[] = [];
    if (opts.allowAll) {
      args.push('--allow-all');
    } else {
      args.push('--allow-all-tools');
    }
    if (opts.agent) args.push('--agent', opts.agent);
    if (opts.model) args.push('--model', opts.model);
    if (!opts.allowAll && opts.allowAllPaths) {
      args.push('--allow-all-paths');
    } else if (!opts.allowAll && opts.addDirs) {
      for (const dir of opts.addDirs) {
        args.push('--add-dir', dir);
      }
    }
    if (!opts.allowAll && opts.allowAllUrls) args.push('--allow-all-urls');
    appendVariadicFlag(args, '--allow-tool', opts.allowTools);
    appendVariadicFlag(args, '--deny-tool', opts.denyTools);
    appendVariadicFlag(args, '--available-tools', opts.availableTools);
    appendVariadicFlag(args, '--excluded-tools', opts.excludedTools);
    appendVariadicFlag(args, '--allow-url', opts.allowUrls);
    appendVariadicFlag(args, '--deny-url', opts.denyUrls);
    if (opts.disallowTempDir) args.push('--disallow-temp-dir');
    if (opts.noAskUser) args.push('--no-ask-user');
    if (opts.disableParallelToolsExecution) args.push('--disable-parallel-tools-execution');
    if (opts.stream !== undefined) {
      if (opts.stream !== 'on' && opts.stream !== 'off') {
        throw new Error(`Invalid stream mode: ${opts.stream}`);
      }
      args.push('--stream', opts.stream);
    }
    if (opts.autopilot) args.push('--autopilot');
    if (opts.maxAutopilotContinues !== undefined) {
      if (!Number.isInteger(opts.maxAutopilotContinues) || opts.maxAutopilotContinues < 0) {
        throw new Error(`Invalid maxAutopilotContinues: ${opts.maxAutopilotContinues}`);
      }
      args.push('--max-autopilot-continues', String(opts.maxAutopilotContinues));
    }
    args.push('--prompt', augmentedPrompt);

    // Build env for wrapper
    const wrapperEnv: Record<string, string> = {
      ...process.env as Record<string, string>,
      ...contextEnv,
      WORKER_STATE_DIR: stateDir,
    };
    if (opts.autoCommit) {
      wrapperEnv.WORKER_AUTO_COMMIT = '1';
      if (typeof opts.autoCommit === 'string') {
        wrapperEnv.WORKER_COMMIT_MSG = opts.autoCommit;
      }
    }

    // Spawn detached copilot process via wrapper script
    const outputLog = join(stateDir, 'output.log');
    const wrapperPath = resolveWorkerWrapperPath(dirname(fileURLToPath(import.meta.url)));
    const child = spawn(process.execPath, [wrapperPath, ...args], {
      cwd: worktreePath,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: wrapperEnv,
    });

    // Redirect stdout+stderr to log file
    const logStream = createWriteStream(outputLog);
    child.stdout?.pipe(logStream);
    child.stderr?.pipe(logStream);
    child.unref();

    const pid = child.pid!;

    // Write PID file
    writeFileSync(join(stateDir, 'worker.pid'), String(pid));

    // Write metadata
    const meta: WorkerMeta = {
      worker_id: workerId,
      pid,
      worktree_path: worktreePath,
      branch_name: branchName,
      prompt: opts.prompt,
      agent: opts.agent ?? '',
      model: opts.model ?? '',
      started_at: new Date().toISOString(),
      status: 'spawning',
      task_id: opts.taskId,
      context_providers: contextResult,
    };
    const metaPath = join(stateDir, 'meta.json');
    writeFileSync(metaPath, JSON.stringify(meta, null, 2));

    const setMetaStatus = (nextStatus: WorkerMeta['status']): void => {
      try {
        const current: WorkerMeta = JSON.parse(readFileSync(metaPath, 'utf-8'));
        if (current.status !== 'spawning') return;
        current.status = nextStatus;
        writeFileSync(metaPath, JSON.stringify(current, null, 2));
      } catch {
        // Ignore transient IO/parse races for status updates
      }
    };
    child.once('spawn', () => setMetaStatus('running'));
    child.once('error', () => setMetaStatus('spawn_failed'));
    setTimeout(() => {
      setMetaStatus(isProcessRunning(pid) ? 'running' : 'spawn_failed');
    }, 100);

    return {
      workerId,
      pid,
      copilotPid: 0,
      worktreePath,
      branchName,
      stateDir,
      outputLog,
      status: 'spawning',
    };
  }

  /** Get detailed status of a specific worker */
  getStatus(workerId: string): WorkerStatus {
    const stateDir = join(this.workersDir, workerId);
    if (!existsSync(stateDir)) {
      throw new Error(`Worker not found: ${workerId}`);
    }

    const metaPath = join(stateDir, 'meta.json');
    if (!existsSync(metaPath)) {
      throw new Error(`Worker metadata not found: ${workerId}`);
    }

    const meta: WorkerMeta = JSON.parse(readFileSync(metaPath, 'utf-8'));
    const metaStatus = meta.status ?? 'running';

    // Check PID
    let pid = 0;
    let copilotPid = 0;
    let status: WorkerStatus['status'] = metaStatus === 'spawn_failed' ? 'spawn_failed' : 'unknown';
    const pidPath = join(stateDir, 'worker.pid');
    const copilotPidPath = join(stateDir, 'copilot.pid');
    if (status !== 'spawn_failed' && existsSync(pidPath)) {
      pid = parseInt(readFileSync(pidPath, 'utf-8').trim(), 10);
      if (existsSync(copilotPidPath)) {
        copilotPid = parseInt(readFileSync(copilotPidPath, 'utf-8').trim(), 10);
      }
      const wrapperRunning = isProcessRunning(pid);
      const copilotRunning = copilotPid > 0 && isProcessRunning(copilotPid);
      
      if (wrapperRunning || copilotRunning) {
        status = 'running';
      } else {
        // Neither process running, default to unknown (will check exit.json below)
        status = 'unknown';
      }
    }

    // Read exit.json if process is not running
    let exitCode: number | null = null;
    let completedAt: string | null = null;
    let logTail: string[] = [];
    let errorSummary: string | null = null;
    const exitPath = join(stateDir, 'exit.json');

    if (status !== 'running' && status !== 'spawn_failed') {
      if (existsSync(exitPath)) {
        try {
          const exitData = JSON.parse(readFileSync(exitPath, 'utf-8'));
          exitCode = exitData.exitCode ?? null;
          completedAt = exitData.completedAt ?? null;
          
          // Set status based on exit code
          if (exitCode === 0) {
            status = 'completed';
          } else if (exitCode !== null) {
            status = 'failed';
          }
        } catch {
          // Invalid exit.json, keep status as 'unknown'
        }
      } else if (metaStatus === 'running') {
        status = 'completed_no_exit';
      }
    }

    // Check worktree
    const worktreeExists = existsSync(meta.worktree_path);

    // Check log and read tail
    const logPath = join(stateDir, 'output.log');
    let logSizeBytes = 0;
    let logLines = 0;
    if (existsSync(logPath)) {
      const logStat = statSync(logPath);
      logSizeBytes = logStat.size;
      const logContent = readFileSync(logPath, 'utf-8');
      const allLines = logContent.split('\n');
      logLines = allLines.length;
      
      // Get last 20 non-empty lines
      const nonEmptyLines = allLines.filter(l => l.trim().length > 0);
      logTail = nonEmptyLines.slice(-20);
      
      // If failed, get error summary (last non-empty line)
      if (status === 'failed' && logTail.length > 0) {
        errorSummary = logTail[logTail.length - 1];
      }
    }

    return {
      workerId,
      pid,
      copilotPid,
      worktreePath: meta.worktree_path,
      branchName: meta.branch_name,
      stateDir,
      outputLog: logPath,
      status,
      prompt: meta.prompt,
      agent: meta.agent || null,
      model: meta.model || null,
      startedAt: meta.started_at,
      worktreeExists,
      logSizeBytes,
      logLines,
      exitCode,
      completedAt,
      logTail,
      errorSummary,
    };
  }

  /** List all workers with basic info */
  listWorkers(): Array<{ workerId: string; pid: number; status: WorkerStatus['status']; taskId?: string }> {
    if (!existsSync(this.workersDir)) return [];

    const entries = readdirSync(this.workersDir, { withFileTypes: true });
    const workers: Array<{ workerId: string; pid: number; status: WorkerStatus['status']; taskId?: string }> = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const workerId = entry.name;
      const pidPath = join(this.workersDir, workerId, 'worker.pid');
      const metaPath = join(this.workersDir, workerId, 'meta.json');

      let pid = 0;
      let status: WorkerStatus['status'] = 'unknown';
      let taskId: string | undefined;
      let metaStatus: string | undefined;

      if (existsSync(metaPath)) {
        try {
          const meta: WorkerMeta = JSON.parse(readFileSync(metaPath, 'utf-8'));
          taskId = meta.task_id;
          metaStatus = meta.status;
        } catch {
          // Ignore invalid metadata while listing workers
        }
      }

      // Honor spawn_failed from meta before PID checks
      if (metaStatus === 'spawn_failed') {
        status = 'spawn_failed';
      } else if (existsSync(pidPath)) {
        pid = parseInt(readFileSync(pidPath, 'utf-8').trim(), 10);
        const isRunning = isProcessRunning(pid);
        
        if (isRunning) {
          status = metaStatus === 'spawning' ? 'spawning' : 'running';
        } else {
          // Process stopped, check for exit.json
          const exitPath = join(this.workersDir, workerId, 'exit.json');
          if (existsSync(exitPath)) {
            try {
              const exitData = JSON.parse(readFileSync(exitPath, 'utf-8'));
              const exitCode = exitData.exitCode ?? null;
              if (exitCode === 0) {
                status = 'completed';
              } else if (exitCode !== null) {
                status = 'failed';
              }
            } catch {
              // Invalid exit.json
              status = 'unknown';
            }
          } else if (metaStatus === 'running') {
            status = 'completed_no_exit';
          }
        }
      }

      workers.push({ workerId, pid, status, taskId });
    }

    return workers;
  }

  /** Terminal statuses that awaitCompletion considers "done" */
  private static TERMINAL_STATUSES = new Set([
    'completed', 'failed', 'spawn_failed', 'completed_no_exit',
  ]);

  /**
   * Poll getStatus() until the worker reaches a terminal state.
   * Returns the final WorkerStatus.
   *
   * @throws if timeout is exceeded
   * @throws if worker is not found
   */
  awaitCompletion(workerId: string, opts: import('./types.js').AwaitOptions = {}): WorkerStatus {
    const pollInterval = opts.pollIntervalMs ?? 3000;
    const timeout = opts.timeoutMs ?? 0; // 0 = no limit
    const deadline = timeout > 0 ? Date.now() + timeout : 0;

    while (true) {
      const status = this.getStatus(workerId);

      if (opts.onProgress) {
        try { opts.onProgress(status); } catch { /* ignore callback errors */ }
      }

      if (WorkerManager.TERMINAL_STATUSES.has(status.status)) {
        return status;
      }

      // Check timeout
      if (deadline > 0 && Date.now() + pollInterval > deadline) {
        throw new Error(
          `Timed out waiting for worker ${workerId} after ${timeout}ms (last status: ${status.status})`
        );
      }

      sleepMs(pollInterval);
    }
  }

  /** Validate a worker's actual output: commits, file scope, build result */
  validateWorker(workerId: string, opts: ValidateWorkerOptions = {}): ValidationResult {
    const stateDir = join(this.workersDir, workerId);
    if (!existsSync(stateDir)) {
      throw new Error(`Worker not found: ${workerId}`);
    }

    const metaPath = join(stateDir, 'meta.json');
    if (!existsSync(metaPath)) {
      throw new Error(`Worker metadata not found: ${workerId}`);
    }

    const meta: WorkerMeta = JSON.parse(readFileSync(metaPath, 'utf-8'));
    const requireCommits = opts.requireCommits !== false;

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

    // 1. Get commits on worker branch vs HEAD
    try {
      const commitLog = execSync(
        `git log --oneline HEAD..${meta.branch_name}`,
        { cwd: this.repoRoot, stdio: 'pipe', encoding: 'utf-8' }
      ).trim();
      if (commitLog.length > 0) {
        const lines = commitLog.split('\n').filter(l => l.trim().length > 0);
        result.hasCommits = true;
        result.commitCount = lines.length;
        result.commitMessages = lines.map(l => l.replace(/^[a-f0-9]+ /, ''));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Failed to read commits: ${msg}`);
      result.valid = false;
    }

    if (requireCommits && !result.hasCommits) {
      result.valid = false;
      result.errors.push('No commits found on worker branch');
    }

    // 2. Get changed files
    try {
      const diffOutput = execSync(
        `git diff --name-only HEAD...${meta.branch_name}`,
        { cwd: this.repoRoot, stdio: 'pipe', encoding: 'utf-8' }
      ).trim();
      if (diffOutput.length > 0) {
        result.filesChanged = diffOutput.split('\n').filter(l => l.trim().length > 0);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Failed to read changed files: ${msg}`);
      result.valid = false;
    }

    // 3. Check path scope
    if (result.filesChanged.length > 0) {
      for (const file of result.filesChanged) {
        // Check required prefixes (file must match at least one)
        if (opts.requiredPathPrefixes && opts.requiredPathPrefixes.length > 0) {
          const matchesRequired = opts.requiredPathPrefixes.some(prefix => file.startsWith(prefix));
          if (!matchesRequired) {
            result.scopeViolations.push(file);
          }
        }
        // Check forbidden prefixes (file must not match any)
        if (opts.forbiddenPathPrefixes && opts.forbiddenPathPrefixes.length > 0) {
          const matchesForbidden = opts.forbiddenPathPrefixes.some(prefix => file.startsWith(prefix));
          if (matchesForbidden && !result.scopeViolations.includes(file)) {
            result.scopeViolations.push(file);
          }
        }
      }
      if (result.scopeViolations.length > 0) {
        result.valid = false;
      }
    }

    // 4. Run build command in worktree if provided
    if (opts.buildCommand && meta.worktree_path && existsSync(meta.worktree_path)) {
      try {
        const buildOutput = execSync(opts.buildCommand, {
          cwd: meta.worktree_path,
          stdio: 'pipe',
          encoding: 'utf-8',
          timeout: 120000,
        });
        result.buildPassed = true;
        result.buildOutput = buildOutput;
      } catch (err: unknown) {
        result.buildPassed = false;
        const execErr = err as { stdout?: string; stderr?: string; message?: string };
        result.buildOutput = (execErr.stdout ?? '') + (execErr.stderr ?? '');
        if (!result.buildOutput) {
          result.buildOutput = execErr.message ?? 'Build failed';
        }
        result.valid = false;
      }
    } else if (opts.buildCommand && (!meta.worktree_path || !existsSync(meta.worktree_path))) {
      result.buildPassed = false;
      result.buildOutput = 'Worktree does not exist';
      result.errors.push('Cannot run build: worktree does not exist');
      result.valid = false;
    }

    return result;
  }

  /** Clean up a worker: kill process, remove worktree, delete state */
  cleanup(workerId: string, force = false): CleanupResult {
    const stateDir = join(this.workersDir, workerId);
    if (!existsSync(stateDir)) {
      throw new Error(`Worker not found: ${workerId}`);
    }

    const metaPath = join(stateDir, 'meta.json');
    if (!existsSync(metaPath)) {
      throw new Error(`Worker metadata not found: ${workerId}`);
    }

    const meta: WorkerMeta = JSON.parse(readFileSync(metaPath, 'utf-8'));

    // Kill process if running
    const pidPath = join(stateDir, 'worker.pid');
    const copilotPidPath = join(stateDir, 'copilot.pid');
    const exitPath = join(stateDir, 'exit.json');
    if (existsSync(pidPath)) {
      const pid = parseInt(readFileSync(pidPath, 'utf-8').trim(), 10);
      let copilotPid = 0;
      if (existsSync(copilotPidPath)) {
        copilotPid = parseInt(readFileSync(copilotPidPath, 'utf-8').trim(), 10);
      }

      // Helper: terminate a single PID with SIGTERM, wait, escalate to group/force
      const terminatePid = (targetPid: number): void => {
        if (!isProcessRunning(targetPid)) return;

        const lifecycleStatus = meta.status ?? 'running';
        if (!force && lifecycleStatus === 'spawning') {
          throw new Error(`Worker ${workerId} is still spawning; cleanup requires force=true.`);
        }
        try {
          process.kill(targetPid, 'SIGTERM');
        } catch { /* ignore */ }

        // Wait for graceful shutdown (max 5s)
        const deadline = Date.now() + 5000;
        while (Date.now() < deadline && isProcessRunning(targetPid)) {
          sleepMs(500);
        }

        // Escalate to process tree TERM for any remaining descendants.
        if (isProcessRunning(targetPid)) {
          if (process.platform === 'win32') {
            try {
              execSync(`taskkill /PID ${targetPid} /T`, { stdio: 'ignore' });
            } catch { /* ignore */ }
          } else {
            try {
              process.kill(-targetPid, 'SIGTERM');
            } catch { /* ignore */ }
          }

          const groupDeadline = Date.now() + 5000;
          while (Date.now() < groupDeadline && isProcessRunning(targetPid)) {
            sleepMs(500);
          }
        }

        // Force kill if still running
        if (isProcessRunning(targetPid)) {
          if (!force) {
            throw new Error(`Process ${targetPid} still running. Use force=true to kill.`);
          }
          if (process.platform === 'win32') {
            try {
              execSync(`taskkill /PID ${targetPid} /T /F`, { stdio: 'ignore' });
            } catch { /* ignore */ }
          } else {
            try {
              process.kill(-targetPid, 'SIGKILL');
            } catch { /* ignore */ }
          }

          const killDeadline = Date.now() + 2000;
          while (Date.now() < killDeadline && isProcessRunning(targetPid)) {
            sleepMs(500);
          }
        }

        if (isProcessRunning(targetPid)) {
          throw new Error(`Process ${targetPid} still running after force cleanup.`);
        }
      };

      // Terminate wrapper first, then copilot child
      if (isProcessRunning(pid)) {
        terminatePid(pid);
      }
      if (copilotPid > 0 && isProcessRunning(copilotPid)) {
        terminatePid(copilotPid);
      }

      if (force && !isProcessRunning(pid) && !existsSync(exitPath)) {
        writeSyntheticExitMetadata(exitPath, 'cleanup');
      }
    }

    // Remove worktree
    let worktreeRemoved = false;
    if (meta.worktree_path && existsSync(meta.worktree_path)) {
      try {
        execSync(`git worktree remove "${meta.worktree_path}" --force`, {
          cwd: this.repoRoot,
          stdio: 'pipe',
        });
        worktreeRemoved = true;
      } catch {
        worktreeRemoved = false;
      }
    } else {
      worktreeRemoved = true;
    }

    // Delete branch
    let branchDeleted = false;
    if (meta.branch_name) {
      try {
        execSync(`git branch -D "${meta.branch_name}"`, {
          cwd: this.repoRoot,
          stdio: 'pipe',
        });
        branchDeleted = true;
      } catch {
        branchDeleted = false;
      }
    }

    // Remove state directory
    rmSync(stateDir, { recursive: true, force: true });

    // Prune worktrees
    try {
      execSync('git worktree prune', { cwd: this.repoRoot, stdio: 'pipe' });
    } catch { /* ignore */ }

    // Best-effort: deregister worker from agents-hub so it doesn't persist as active
    tryDeregisterFromHub(workerId, this.repoRoot);

    return {
      workerId,
      status: 'cleaned',
      worktreeRemoved,
      branchDeleted,
      stateRemoved: true,
    };
  }
}

function resolveWorkerWrapperPath(moduleDir: string): string {
  const candidates = [
    join(moduleDir, 'worker-wrapper.js'),
    join(moduleDir, '..', 'scripts', 'worker-wrapper.js'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`Worker wrapper not found (checked: ${candidates.join(', ')})`);
}

function appendVariadicFlag(args: string[], flag: string, values?: string[]): void {
  if (!values || values.length === 0) return;
  args.push(flag, ...values);
}

/** Check if a process is running by PID */
function isProcessRunning(pid: number): boolean {
  if (!Number.isFinite(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch { /* ignore */ }
  if (process.platform !== 'win32') {
    try {
      process.kill(-pid, 0);
      return true;
    } catch { /* ignore */ }
  }
  return false;
}

function sleepMs(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function writeSyntheticExitMetadata(exitPath: string, terminatedBy: string): void {
  const exitData = {
    exitCode: 137,
    completedAt: new Date().toISOString(),
    terminatedBy,
  };
  writeFileSync(exitPath, `${JSON.stringify(exitData, null, 2)}\n`);
}

/**
 * Best-effort deregister a worker from agents-hub.
 * Uses git to resolve the hub DB path and sqlite3 CLI to update the record.
 * Swallows all errors — cleanup must never fail due to hub unavailability.
 */
function tryDeregisterFromHub(workerId: string, repoRoot: string): void {
  try {
    const gitCommonDir = execSync('git rev-parse --git-common-dir', {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    const dbPath = resolve(repoRoot, gitCommonDir, 'devpartner', 'hub.db');
    if (!existsSync(dbPath)) return;

    // Use sqlite3 CLI for zero-dependency hub interaction
    const sql = `UPDATE workers SET status='completed', completed_at=datetime('now') WHERE id='${workerId.replace(/'/g, "''")}' AND status='active';`;
    execSync(`sqlite3 "${dbPath}" "${sql}"`, {
      cwd: repoRoot,
      stdio: 'pipe',
      timeout: 5000,
    });
  } catch {
    // Best-effort: silently ignore if hub DB or sqlite3 is unavailable
  }
}
