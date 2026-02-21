/**
 * WorkerManager - TypeScript equivalent of spawn-worker.sh, worker-status.sh, cleanup-worker.sh
 *
 * Manages Copilot CLI worker processes in isolated git worktrees.
 */

import { execSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync, statSync, createWriteStream } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { SpawnOptions, WorkerInfo, WorkerStatus, CleanupResult, WorkerMeta } from './types.js';

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
    args.push('-p', opts.prompt);

    // Spawn detached copilot process
    const outputLog = join(stateDir, 'output.log');
    const child = spawn('copilot', args, {
      cwd: worktreePath,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
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
    let status: 'running' | 'stopped' | 'unknown' = 'unknown';
    const pidPath = join(stateDir, 'worker.pid');
    if (existsSync(pidPath)) {
      pid = parseInt(readFileSync(pidPath, 'utf-8').trim(), 10);
      status = isProcessRunning(pid) ? 'running' : 'stopped';
    }

    // Check worktree
    const worktreeExists = existsSync(meta.worktree_path);

    // Check log
    const logPath = join(stateDir, 'output.log');
    let logSizeBytes = 0;
    let logLines = 0;
    if (existsSync(logPath)) {
      const logStat = statSync(logPath);
      logSizeBytes = logStat.size;
      logLines = readFileSync(logPath, 'utf-8').split('\n').length;
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
    };
  }

  /** List all workers with basic info */
  listWorkers(): Array<{ workerId: string; pid: number; status: 'running' | 'stopped' | 'unknown' }> {
    if (!existsSync(this.workersDir)) return [];

    const entries = readdirSync(this.workersDir, { withFileTypes: true });
    const workers: Array<{ workerId: string; pid: number; status: 'running' | 'stopped' | 'unknown' }> = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const workerId = entry.name;
      const pidPath = join(this.workersDir, workerId, 'worker.pid');

      let pid = 0;
      let status: 'running' | 'stopped' | 'unknown' = 'unknown';

      if (existsSync(pidPath)) {
        pid = parseInt(readFileSync(pidPath, 'utf-8').trim(), 10);
        status = isProcessRunning(pid) ? 'running' : 'stopped';
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
