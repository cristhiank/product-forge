/**
 * WorktreeManager — pure git worktree/branch operations.
 * No SDK knowledge; only shell-level git commands via execFileSync.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** Options for creating a new worktree */
export interface WorktreeCreateOptions {
  /** Unique worker identifier used for branch and path naming */
  workerId: string;
  /** Base directory for worktrees relative to repoRoot (default: '../worktrees') */
  worktreeBase?: string;
  /** Branch name prefix (default: 'worker') */
  branchPrefix?: string;
}

/** Result of a successful worktree creation */
export interface WorktreeCreateResult {
  /** Absolute path to the created worktree */
  worktreePath: string;
  /** Git branch name created for this worktree */
  branchName: string;
  /** Git SHA of HEAD at the moment the worktree was created */
  baseSha: string;
  /** Absolute path to the per-worker state directory */
  stateDir: string;
}

/** Result of a worktree removal */
export interface WorktreeRemoveResult {
  /** Whether the worktree directory was successfully removed */
  worktreeRemoved: boolean;
  /** Whether the worker branch was successfully deleted */
  branchDeleted: boolean;
}

export class WorktreeManager {
  constructor(private repoRoot: string) {}

  /**
   * Creates a git worktree and branch for the given worker.
   * Also creates the state directory under `.copilot-workers/<workerId>/`.
   *
   * @param opts - Creation options including workerId, optional base path and branch prefix
   * @returns Paths and metadata for the newly created worktree
   * @throws if the git worktree command fails
   */
  create(opts: WorktreeCreateOptions): WorktreeCreateResult {
    const { workerId } = opts;
    const worktreeBase = opts.worktreeBase ?? '../worktrees';
    const branchPrefix = opts.branchPrefix ?? 'worker';

    // Resolve worktree path
    const worktreeBaseAbs = resolve(this.repoRoot, worktreeBase);
    mkdirSync(worktreeBaseAbs, { recursive: true });
    const worktreePath = join(worktreeBaseAbs, workerId);

    const branchName = `${branchPrefix}/${workerId}`;

    // Capture base SHA before creating worktree
    const baseSha = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: this.repoRoot,
      encoding: 'utf-8',
      stdio: 'pipe',
    }).trim();

    // Create state directory
    const stateDir = join(this.repoRoot, '.copilot-workers', workerId);
    mkdirSync(stateDir, { recursive: true });

    // Create worktree + branch
    try {
      execFileSync('git', ['worktree', 'add', '-b', branchName, worktreePath, 'HEAD'], {
        cwd: this.repoRoot,
        stdio: 'pipe',
      });
    } catch {
      rmSync(stateDir, { recursive: true, force: true });
      throw new Error('Failed to create git worktree');
    }

    return { worktreePath, branchName, baseSha, stateDir };
  }

  /**
   * Removes a git worktree and deletes the associated branch.
   * Also runs `git worktree prune` to clean up stale metadata.
   *
   * @param worktreePath - Absolute path to the worktree to remove
   * @param branchName - Name of the git branch to delete
   * @returns Flags indicating whether each step succeeded
   */
  remove(worktreePath: string, branchName: string): WorktreeRemoveResult {
    let worktreeRemoved = false;
    if (existsSync(worktreePath)) {
      try {
        execFileSync('git', ['worktree', 'remove', worktreePath, '--force'], {
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

    let branchDeleted = false;
    if (branchName) {
      try {
        execFileSync('git', ['branch', '-D', branchName], {
          cwd: this.repoRoot,
          stdio: 'pipe',
        });
        branchDeleted = true;
      } catch {
        branchDeleted = false;
      }
    }

    try {
      execFileSync('git', ['worktree', 'prune'], { cwd: this.repoRoot, stdio: 'pipe' });
    } catch { /* ignore */ }

    return { worktreeRemoved, branchDeleted };
  }

  /**
   * Resolves the absolute path to the worktree base directory.
   *
   * @param worktreeBase - Relative path from repoRoot (default: '../worktrees')
   * @returns Absolute path to the worktree base directory
   */
  getWorktreeBase(worktreeBase = '../worktrees'): string {
    return resolve(this.repoRoot, worktreeBase);
  }

  /**
   * Lists branches in the repository matching an optional prefix.
   *
   * @param prefix - Branch name prefix to filter by (e.g. 'worker')
   * @returns Array of matching branch names
   */
  listBranches(prefix?: string): string[] {
    try {
      const output = execFileSync(
        'git',
        ['branch', '--format=%(refname:short)'],
        { cwd: this.repoRoot, encoding: 'utf-8', stdio: 'pipe' }
      ).trim();
      const branches = output.length > 0 ? output.split('\n') : [];
      return prefix ? branches.filter(b => b.startsWith(prefix)) : branches;
    } catch {
      return [];
    }
  }

  /**
   * Returns the worker IDs that have state directories under `.copilot-workers/`.
   *
   * @returns Array of worker ID strings
   */
  listWorkerIds(): string[] {
    const workersDir = join(this.repoRoot, '.copilot-workers');
    if (!existsSync(workersDir)) return [];
    return readdirSync(workersDir, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name);
  }
}
