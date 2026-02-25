import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { WorkerManager } from '../src/workers.js';
import { WorkerSDK } from '../src/sdk.js';
import type { WorkerMeta } from '../src/types.js';

function makeRepoRoot(testName: string): string {
  const root = join(tmpdir(), `workers-test-${testName}-${Date.now()}-${Math.random()}`);
  mkdirSync(join(root, '.copilot-workers'), { recursive: true });
  return root;
}

function writeWorkerState(repoRoot: string, workerId: string, metaOverrides: Partial<WorkerMeta> = {}, pid?: number): string {
  const stateDir = join(repoRoot, '.copilot-workers', workerId);
  mkdirSync(stateDir, { recursive: true });
  const meta: WorkerMeta = {
    worker_id: workerId,
    pid: pid ?? 0,
    worktree_path: join(repoRoot, 'worktree', workerId),
    branch_name: `worker/${workerId}`,
    prompt: 'test prompt',
    agent: '',
    model: '',
    started_at: new Date().toISOString(),
    status: 'running',
    ...metaOverrides,
  };
  writeFileSync(join(stateDir, 'meta.json'), JSON.stringify(meta, null, 2));
  writeFileSync(join(stateDir, 'worker.pid'), String(pid ?? 0));
  writeFileSync(join(stateDir, 'output.log'), '');
  return stateDir;
}

test('getStatus returns spawn_failed when metadata status is spawn_failed', () => {
  const repoRoot = makeRepoRoot('spawn-failed');
  const workerId = 'w-spawn-failed';
  writeWorkerState(repoRoot, workerId, { status: 'spawn_failed' }, 0);
  const manager = new WorkerManager(repoRoot);

  const status = manager.getStatus(workerId);
  assert.equal(status.status, 'spawn_failed');

  rmSync(repoRoot, { recursive: true, force: true });
});

test('getStatus returns completed_no_exit when process is gone and no exit.json exists', () => {
  const repoRoot = makeRepoRoot('completed-no-exit');
  const workerId = 'w-completed-no-exit';
  writeWorkerState(repoRoot, workerId, { status: 'running' }, 999999);
  const manager = new WorkerManager(repoRoot);

  const status = manager.getStatus(workerId);
  assert.equal(status.status, 'completed_no_exit');

  rmSync(repoRoot, { recursive: true, force: true });
});

test('cleanup rejects non-force cleanup while worker is still spawning', () => {
  const repoRoot = makeRepoRoot('cleanup-spawning');
  const workerId = 'w-cleanup-spawning';
  writeWorkerState(repoRoot, workerId, { status: 'spawning' }, process.pid);
  const manager = new WorkerManager(repoRoot);

  assert.throws(
    () => manager.cleanup(workerId, false),
    /still spawning; cleanup requires force=true/,
  );

  rmSync(repoRoot, { recursive: true, force: true });
});

test('cleanup with force bypasses spawning lock when process is not running', () => {
  const repoRoot = makeRepoRoot('cleanup-force');
  const workerId = 'w-cleanup-force';
  writeWorkerState(repoRoot, workerId, { status: 'spawning' }, 999999);
  const manager = new WorkerManager(repoRoot);

  const result = manager.cleanup(workerId, true);
  assert.equal(result.status, 'cleaned');

  rmSync(repoRoot, { recursive: true, force: true });
});

test('spawn deduplicates active taskId by throwing with existing worker info', () => {
  const repoRoot = makeRepoRoot('spawn-dedup');
  const workerId = 'w-existing';
  writeWorkerState(repoRoot, workerId, { status: 'running', task_id: 'TASK-123' }, process.pid);
  const manager = new WorkerManager(repoRoot);

  assert.throws(
    () => manager.spawn({ prompt: 'hello', taskId: 'TASK-123' }),
    /taskId already active: TASK-123 \(workerId=w-existing, status=running, pid=/,
  );

  rmSync(repoRoot, { recursive: true, force: true });
});

test('listWorkers includes taskId from metadata', () => {
  const repoRoot = makeRepoRoot('list-taskid');
  const workerId = 'w-list';
  writeWorkerState(repoRoot, workerId, { task_id: 'TASK-LIST' }, 0);
  const manager = new WorkerManager(repoRoot);

  const workers = manager.listWorkers();
  assert.equal(workers.length, 1);
  assert.equal(workers[0]?.taskId, 'TASK-LIST');

  rmSync(repoRoot, { recursive: true, force: true });
});

test('listWorkers surfaces spawn_failed and completed_no_exit status from meta', () => {
  const repoRoot = makeRepoRoot('list-statuses');
  writeWorkerState(repoRoot, 'w-sfail', { status: 'spawn_failed' }, 0);
  writeWorkerState(repoRoot, 'w-noexit', { status: 'running' }, 999999);
  const manager = new WorkerManager(repoRoot);

  const workers = manager.listWorkers();
  const sfail = workers.find(w => w.workerId === 'w-sfail');
  const noexit = workers.find(w => w.workerId === 'w-noexit');
  assert.equal(sfail?.status, 'spawn_failed');
  assert.equal(noexit?.status, 'completed_no_exit');

  rmSync(repoRoot, { recursive: true, force: true });
});

test('sdk.spawnWorker forwards taskId into manager.spawn options', () => {
  let capturedTaskId: string | undefined;
  const manager = {
    spawn(opts: { taskId?: string }) {
      capturedTaskId = opts.taskId;
      return {
        workerId: 'w1',
        pid: 1,
        worktreePath: '/tmp/w1',
        branchName: 'worker/w1',
        stateDir: '/tmp/state',
        outputLog: '/tmp/log',
        status: 'running' as const,
      };
    },
    getStatus() {
      throw new Error('not used');
    },
    listWorkers() {
      return [];
    },
    cleanup() {
      throw new Error('not used');
    },
  } as unknown as WorkerManager;
  const sdk = new WorkerSDK(manager);

  sdk.spawnWorker('hello', { taskId: 'TASK-SDK' });
  assert.equal(capturedTaskId, 'TASK-SDK');
});

// ──────────────────────────────────────────────────
// awaitCompletion tests
// ──────────────────────────────────────────────────

test('awaitCompletion returns immediately for already-completed worker', () => {
  const root = makeRepoRoot('await-completed');
  const stateDir = writeWorkerState(root, 'done-w', { status: 'running' });
  writeFileSync(join(stateDir, 'exit.json'), JSON.stringify({ exitCode: 0, completedAt: new Date().toISOString() }));

  const manager = new WorkerManager(root);
  const result = manager.awaitCompletion('done-w');
  assert.equal(result.status, 'completed');
  rmSync(root, { recursive: true, force: true });
});

test('awaitCompletion returns immediately for spawn_failed worker', () => {
  const root = makeRepoRoot('await-spawn-failed');
  writeWorkerState(root, 'sf-w', { status: 'spawn_failed' });

  const manager = new WorkerManager(root);
  const result = manager.awaitCompletion('sf-w');
  assert.equal(result.status, 'spawn_failed');
  rmSync(root, { recursive: true, force: true });
});

test('awaitCompletion throws on timeout', () => {
  const root = makeRepoRoot('await-timeout');
  writeWorkerState(root, 'slow-w', { status: 'running' }, process.pid);

  const manager = new WorkerManager(root);
  assert.throws(
    () => manager.awaitCompletion('slow-w', { pollIntervalMs: 50, timeoutMs: 100 }),
    /Timed out waiting for worker slow-w/,
  );
  rmSync(root, { recursive: true, force: true });
});

test('awaitCompletion invokes onProgress callback', () => {
  const root = makeRepoRoot('await-progress');
  const stateDir = writeWorkerState(root, 'prog-w', { status: 'running' });
  writeFileSync(join(stateDir, 'exit.json'), JSON.stringify({ exitCode: 1, completedAt: new Date().toISOString() }));

  const calls: string[] = [];
  const manager = new WorkerManager(root);
  const result = manager.awaitCompletion('prog-w', {
    onProgress: (s) => calls.push(s.status),
  });
  assert.equal(result.status, 'failed');
  assert.ok(calls.includes('failed'), 'onProgress should be called with terminal status');
  rmSync(root, { recursive: true, force: true });
});

test('sdk.awaitWorker delegates to manager.awaitCompletion', () => {
  const root = makeRepoRoot('sdk-await');
  const stateDir = writeWorkerState(root, 'sdk-aw', { status: 'running' });
  writeFileSync(join(stateDir, 'exit.json'), JSON.stringify({ exitCode: 0, completedAt: new Date().toISOString() }));

  const manager = new WorkerManager(root);
  const sdk = new WorkerSDK(manager);
  const result = sdk.awaitWorker('sdk-aw');
  assert.equal(result.status, 'completed');
  rmSync(root, { recursive: true, force: true });
});

// ──────────────────────────────────────────────────
// validateWorker tests
// ──────────────────────────────────────────────────

import { execSync } from 'node:child_process';
import type { ValidateWorkerOptions, ValidationResult } from '../src/types.js';

function makeGitRepo(testName: string): string {
  const root = join(tmpdir(), `validate-test-${testName}-${Date.now()}-${Math.random()}`);
  mkdirSync(root, { recursive: true });
  execSync('git init', { cwd: root, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: root, stdio: 'pipe' });
  execSync('git config user.name "Test"', { cwd: root, stdio: 'pipe' });
  writeFileSync(join(root, 'README.md'), 'init');
  execSync('git add -A && git commit -m "init"', { cwd: root, stdio: 'pipe' });
  mkdirSync(join(root, '.copilot-workers'), { recursive: true });
  return root;
}

function createWorkerBranch(repoRoot: string, workerId: string, branchName: string, files: Record<string, string>): string {
  const stateDir = join(repoRoot, '.copilot-workers', workerId);
  mkdirSync(stateDir, { recursive: true });
  // Create branch and add commits
  execSync(`git checkout -b "${branchName}"`, { cwd: repoRoot, stdio: 'pipe' });
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = join(repoRoot, filePath);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content);
  }
  execSync('git add -A', { cwd: repoRoot, stdio: 'pipe' });
  execSync(`git commit -m "worker changes"`, { cwd: repoRoot, stdio: 'pipe' });
  execSync('git checkout -', { cwd: repoRoot, stdio: 'pipe' });
  // Write meta
  const meta: WorkerMeta = {
    worker_id: workerId,
    pid: 0,
    worktree_path: repoRoot,
    branch_name: branchName,
    prompt: 'test',
    agent: '',
    model: '',
    started_at: new Date().toISOString(),
    status: 'completed',
  };
  writeFileSync(join(stateDir, 'meta.json'), JSON.stringify(meta, null, 2));
  writeFileSync(join(stateDir, 'worker.pid'), '0');
  writeFileSync(join(stateDir, 'output.log'), '');
  return stateDir;
}

test('validateWorker detects commits and files within required scope', () => {
  const root = makeGitRepo('validate-pass');
  createWorkerBranch(root, 'v-pass', 'worker/v-pass', { 'src/auth/login.ts': 'export const login = () => {};' });

  const manager = new WorkerManager(root);
  const result = manager.validateWorker('v-pass', {
    requiredPathPrefixes: ['src/auth/'],
  });

  assert.equal(result.valid, true);
  assert.equal(result.hasCommits, true);
  assert.equal(result.commitCount, 1);
  assert.deepEqual(result.scopeViolations, []);
  assert.ok(result.filesChanged.includes('src/auth/login.ts'));

  rmSync(root, { recursive: true, force: true });
});

test('validateWorker reports scope violations for files outside required prefix', () => {
  const root = makeGitRepo('validate-scope-fail');
  createWorkerBranch(root, 'v-scope', 'worker/v-scope', {
    'src/auth/login.ts': 'export const login = () => {};',
    'verticals-forms-api/handler.ts': 'bad scope',
  });

  const manager = new WorkerManager(root);
  const result = manager.validateWorker('v-scope', {
    requiredPathPrefixes: ['src/auth/'],
  });

  assert.equal(result.valid, false);
  assert.ok(result.scopeViolations.includes('verticals-forms-api/handler.ts'));
  assert.ok(!result.scopeViolations.includes('src/auth/login.ts'));

  rmSync(root, { recursive: true, force: true });
});

test('validateWorker reports scope violations for forbidden prefixes', () => {
  const root = makeGitRepo('validate-forbidden');
  createWorkerBranch(root, 'v-forbidden', 'worker/v-forbidden', {
    'src/auth/login.ts': 'ok',
    'node_modules/pkg/index.js': 'forbidden',
  });

  const manager = new WorkerManager(root);
  const result = manager.validateWorker('v-forbidden', {
    forbiddenPathPrefixes: ['node_modules/'],
  });

  assert.equal(result.valid, false);
  assert.ok(result.scopeViolations.includes('node_modules/pkg/index.js'));

  rmSync(root, { recursive: true, force: true });
});

test('validateWorker fails when no commits and requireCommits is true', () => {
  const root = makeGitRepo('validate-no-commits');
  // Create branch with no commits (same as HEAD)
  execSync('git checkout -b "worker/v-nocommit"', { cwd: root, stdio: 'pipe' });
  execSync('git checkout -', { cwd: root, stdio: 'pipe' });
  const stateDir = join(root, '.copilot-workers', 'v-nocommit');
  mkdirSync(stateDir, { recursive: true });
  const meta: WorkerMeta = {
    worker_id: 'v-nocommit',
    pid: 0,
    worktree_path: root,
    branch_name: 'worker/v-nocommit',
    prompt: 'test',
    agent: '',
    model: '',
    started_at: new Date().toISOString(),
    status: 'completed',
  };
  writeFileSync(join(stateDir, 'meta.json'), JSON.stringify(meta, null, 2));
  writeFileSync(join(stateDir, 'worker.pid'), '0');
  writeFileSync(join(stateDir, 'output.log'), '');

  const manager = new WorkerManager(root);
  const result = manager.validateWorker('v-nocommit');

  assert.equal(result.valid, false);
  assert.equal(result.hasCommits, false);
  assert.equal(result.commitCount, 0);
  assert.ok(result.errors.some(e => e.includes('No commits found')));

  rmSync(root, { recursive: true, force: true });
});

test('validateWorker succeeds with no commits when requireCommits is false', () => {
  const root = makeGitRepo('validate-no-commits-ok');
  execSync('git checkout -b "worker/v-nocommit2"', { cwd: root, stdio: 'pipe' });
  execSync('git checkout -', { cwd: root, stdio: 'pipe' });
  const stateDir = join(root, '.copilot-workers', 'v-nocommit2');
  mkdirSync(stateDir, { recursive: true });
  const meta: WorkerMeta = {
    worker_id: 'v-nocommit2',
    pid: 0,
    worktree_path: root,
    branch_name: 'worker/v-nocommit2',
    prompt: 'test',
    agent: '',
    model: '',
    started_at: new Date().toISOString(),
    status: 'completed',
  };
  writeFileSync(join(stateDir, 'meta.json'), JSON.stringify(meta, null, 2));
  writeFileSync(join(stateDir, 'worker.pid'), '0');
  writeFileSync(join(stateDir, 'output.log'), '');

  const manager = new WorkerManager(root);
  const result = manager.validateWorker('v-nocommit2', { requireCommits: false });

  assert.equal(result.valid, true);
  assert.equal(result.hasCommits, false);

  rmSync(root, { recursive: true, force: true });
});

test('validateWorker runs build command and captures pass', () => {
  const root = makeGitRepo('validate-build-pass');
  createWorkerBranch(root, 'v-build-pass', 'worker/v-build-pass', { 'src/index.ts': 'ok' });

  const manager = new WorkerManager(root);
  const result = manager.validateWorker('v-build-pass', {
    buildCommand: 'echo "build ok"',
    requireCommits: false,
  });

  assert.equal(result.buildPassed, true);
  assert.ok(result.buildOutput.includes('build ok'));

  rmSync(root, { recursive: true, force: true });
});

test('validateWorker runs build command and captures failure', () => {
  const root = makeGitRepo('validate-build-fail');
  createWorkerBranch(root, 'v-build-fail', 'worker/v-build-fail', { 'src/index.ts': 'bad' });

  const manager = new WorkerManager(root);
  const result = manager.validateWorker('v-build-fail', {
    buildCommand: 'echo "compile error" && exit 1',
    requireCommits: false,
  });

  assert.equal(result.valid, false);
  assert.equal(result.buildPassed, false);
  assert.ok(result.buildOutput.includes('compile error'));

  rmSync(root, { recursive: true, force: true });
});

test('sdk.validateWorker delegates to manager.validateWorker', () => {
  let capturedOpts: ValidateWorkerOptions | undefined;
  const mockResult: ValidationResult = {
    valid: true, hasCommits: true, commitCount: 1, commitMessages: ['test'],
    filesChanged: ['a.ts'], scopeViolations: [], buildPassed: null, buildOutput: '', errors: [],
  };
  const manager = {
    spawn() { throw new Error('not used'); },
    getStatus() { throw new Error('not used'); },
    listWorkers() { return []; },
    cleanup() { throw new Error('not used'); },
    awaitCompletion() { throw new Error('not used'); },
    validateWorker(_id: string, opts?: ValidateWorkerOptions) {
      capturedOpts = opts;
      return mockResult;
    },
  } as unknown as WorkerManager;
  const sdk = new WorkerSDK(manager);

  const result = sdk.validateWorker('w1', { requiredPathPrefixes: ['src/'] });
  assert.deepEqual(result, mockResult);
  assert.deepEqual(capturedOpts?.requiredPathPrefixes, ['src/']);
});
