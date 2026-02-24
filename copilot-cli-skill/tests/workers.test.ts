import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
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
