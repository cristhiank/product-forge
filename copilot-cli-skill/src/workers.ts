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
import type { SpawnOptions, WorkerInfo, WorkerStatus, CleanupResult, WorkerMeta } from './types.js';
import { applyContext } from './context-providers.js';

export class WorkerManager {
  private workersDir: string;

  constructor(private repoRoot: string) {
    this.workersDir = join(repoRoot, '.copilot-workers');
  }

  /** Spawn a new Copilot CLI worker in an isolated worktree */
  spawn(opts: SpawnOptions): WorkerInfo {
    if (!opts.prompt) throw new Error('prompt is required');

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
    const args = ['--allow-all-tools'];
    if (opts.agent) args.push('--agent', opts.agent);
    if (opts.model) args.push('--model', opts.model);
    if (opts.allowAllPaths) {
      args.push('--allow-all-paths');
    } else if (opts.addDirs) {
      for (const dir of opts.addDirs) {
        args.push('--add-dir', dir);
      }
    }
    if (opts.allowAllUrls) args.push('--allow-all-urls');
    if (opts.autopilot) args.push('--autopilot');
    args.push('-p', augmentedPrompt);

    // Spawn detached copilot process via wrapper script
    const outputLog = join(stateDir, 'output.log');
    const wrapperPath = join(dirname(fileURLToPath(import.meta.url)), 'worker-wrapper.sh');
    const child = spawn(wrapperPath, args, {
      cwd: worktreePath,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...contextEnv, WORKER_STATE_DIR: stateDir },
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
      status: 'running',
      context_providers: contextResult,
    };
    writeFileSync(join(stateDir, 'meta.json'), JSON.stringify(meta, null, 2));

    return {
      workerId,
      pid,
      worktreePath,
      branchName,
      stateDir,
      outputLog,
      status: 'running',
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

    // Check PID
    let pid = 0;
    let status: 'running' | 'completed' | 'failed' | 'unknown' = 'unknown';
    const pidPath = join(stateDir, 'worker.pid');
    if (existsSync(pidPath)) {
      pid = parseInt(readFileSync(pidPath, 'utf-8').trim(), 10);
      const isRunning = isProcessRunning(pid);
      
      if (isRunning) {
        status = 'running';
      } else {
        // Process not running, default to unknown (will check exit.json below)
        status = 'unknown';
      }
    }

    // Read exit.json if process is not running
    let exitCode: number | null = null;
    let completedAt: string | null = null;
    let logTail: string[] = [];
    let errorSummary: string | null = null;

    if (status !== 'running') {
      const exitPath = join(stateDir, 'exit.json');
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
  listWorkers(): Array<{ workerId: string; pid: number; status: 'running' | 'completed' | 'failed' | 'unknown' }> {
    if (!existsSync(this.workersDir)) return [];

    const entries = readdirSync(this.workersDir, { withFileTypes: true });
    const workers: Array<{ workerId: string; pid: number; status: 'running' | 'completed' | 'failed' | 'unknown' }> = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const workerId = entry.name;
      const pidPath = join(this.workersDir, workerId, 'worker.pid');

      let pid = 0;
      let status: 'running' | 'completed' | 'failed' | 'unknown' = 'unknown';

      if (existsSync(pidPath)) {
        pid = parseInt(readFileSync(pidPath, 'utf-8').trim(), 10);
        const isRunning = isProcessRunning(pid);
        
        if (isRunning) {
          status = 'running';
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
          }
        }
      }

      workers.push({ workerId, pid, status });
    }

    return workers;
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
    if (existsSync(pidPath)) {
      const pid = parseInt(readFileSync(pidPath, 'utf-8').trim(), 10);
      if (isProcessRunning(pid)) {
        try {
          process.kill(pid, 'SIGTERM');
        } catch { /* ignore */ }

        // Wait for graceful shutdown (max 5s)
        const deadline = Date.now() + 5000;
        while (Date.now() < deadline && isProcessRunning(pid)) {
          execSync('sleep 0.5', { stdio: 'pipe' });
        }

        // Force kill if still running
        if (isProcessRunning(pid)) {
          if (!force) {
            throw new Error(`Process ${pid} still running. Use force=true to kill.`);
          }
          try {
            process.kill(pid, 'SIGKILL');
          } catch { /* ignore */ }
        }
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

    return {
      workerId,
      status: 'cleaned',
      worktreeRemoved,
      branchDeleted,
      stateRemoved: true,
    };
  }
}

/** Check if a process is running by PID */
function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
