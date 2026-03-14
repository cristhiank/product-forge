import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { WorktreeManager } from '../src/worktree.js';

/**
 * Creates a temporary git repository with an initial commit.
 * Returns the path and a cleanup function.
 */
function makeGitRepo(label: string): { repoRoot: string; cleanup: () => void } {
  const repoRoot = join(tmpdir(), `wt-test-${label}-${Date.now()}-${Math.random()}`);
  mkdirSync(repoRoot, { recursive: true });

  // Init bare enough git config
  execFileSync('git', ['init'], { cwd: repoRoot, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: repoRoot, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: repoRoot, stdio: 'pipe' });

  // Create an initial commit so HEAD exists
  writeFileSync(join(repoRoot, 'README.md'), '# test');
  execFileSync('git', ['add', '.'], { cwd: repoRoot, stdio: 'pipe' });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: repoRoot, stdio: 'pipe' });

  return {
    repoRoot,
    cleanup: () => rmSync(repoRoot, { recursive: true, force: true }),
  };
}

// ─── create ──────────────────────────────────────────────────────────────────

test('create makes worktree directory and branch, returns valid baseSha', () => {
  const { repoRoot, cleanup } = makeGitRepo('create');
  const manager = new WorktreeManager(repoRoot);

  const result = manager.create({ workerId: 'w-create', worktreeBase: 'worktrees' });

  assert.ok(existsSync(result.worktreePath), 'worktree path should exist');
  assert.ok(/^[0-9a-f]{40}$/.test(result.baseSha), 'baseSha should be a 40-char hex SHA');
  assert.equal(result.branchName, 'worker/w-create');
  assert.ok(existsSync(result.stateDir), 'stateDir should exist');

  cleanup();
});

test('create uses custom branchPrefix and worktreeBase', () => {
  const { repoRoot, cleanup } = makeGitRepo('create-custom');
  const manager = new WorktreeManager(repoRoot);

  const result = manager.create({
    workerId: 'myworker',
    worktreeBase: 'custom-wt',
    branchPrefix: 'task',
  });

  assert.equal(result.branchName, 'task/myworker');
  assert.ok(result.worktreePath.includes('custom-wt'));

  cleanup();
});

// ─── remove ───────────────────────────────────────────────────────────────────

test('remove cleans up worktree and branch', () => {
  const { repoRoot, cleanup } = makeGitRepo('remove');
  const manager = new WorktreeManager(repoRoot);

  const created = manager.create({ workerId: 'w-remove', worktreeBase: 'worktrees' });
  assert.ok(existsSync(created.worktreePath));

  const result = manager.remove(created.worktreePath, created.branchName);

  assert.equal(result.worktreeRemoved, true);
  assert.equal(result.branchDeleted, true);
  assert.equal(existsSync(created.worktreePath), false);

  cleanup();
});

test('remove returns worktreeRemoved=true when path already absent', () => {
  const { repoRoot, cleanup } = makeGitRepo('remove-absent');
  const manager = new WorktreeManager(repoRoot);

  const result = manager.remove('/nonexistent/path', '');

  assert.equal(result.worktreeRemoved, true);
  // No branch to delete — branchDeleted will be false
  assert.equal(result.branchDeleted, false);

  cleanup();
});

// ─── listBranches ─────────────────────────────────────────────────────────────

test('listBranches filters by prefix', () => {
  const { repoRoot, cleanup } = makeGitRepo('list-branches');
  const manager = new WorktreeManager(repoRoot);

  // Create two branches with different prefixes
  execFileSync('git', ['branch', 'worker/one'], { cwd: repoRoot, stdio: 'pipe' });
  execFileSync('git', ['branch', 'task/two'], { cwd: repoRoot, stdio: 'pipe' });

  const workerBranches = manager.listBranches('worker');
  assert.ok(workerBranches.includes('worker/one'), 'should include worker/one');
  assert.ok(!workerBranches.some(b => b.startsWith('task/')), 'should not include task/ branches');

  cleanup();
});

test('listBranches returns all branches when no prefix given', () => {
  const { repoRoot, cleanup } = makeGitRepo('list-all');
  const manager = new WorktreeManager(repoRoot);

  execFileSync('git', ['branch', 'worker/a'], { cwd: repoRoot, stdio: 'pipe' });
  execFileSync('git', ['branch', 'worker/b'], { cwd: repoRoot, stdio: 'pipe' });

  const all = manager.listBranches();
  assert.ok(all.length >= 3); // main/master + worker/a + worker/b

  cleanup();
});

// ─── listWorkerIds ────────────────────────────────────────────────────────────

test('listWorkerIds returns worker state directory names', () => {
  const { repoRoot, cleanup } = makeGitRepo('list-workers');
  const manager = new WorktreeManager(repoRoot);

  // Create two workers — state dirs created by WorktreeManager.create
  manager.create({ workerId: 'alpha', worktreeBase: 'worktrees' });
  manager.create({ workerId: 'beta', worktreeBase: 'worktrees' });

  const ids = manager.listWorkerIds().sort();
  assert.ok(ids.includes('alpha'));
  assert.ok(ids.includes('beta'));

  cleanup();
});

test('listWorkerIds returns empty array when .copilot-workers absent', () => {
  const { repoRoot, cleanup } = makeGitRepo('list-workers-empty');
  const manager = new WorktreeManager(repoRoot);

  assert.deepEqual(manager.listWorkerIds(), []);

  cleanup();
});
