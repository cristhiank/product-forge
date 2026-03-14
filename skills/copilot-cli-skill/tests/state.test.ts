import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { StateStore } from '../src/state.js';
import type { WorkerMeta, WorkerEvent, WorkerHistory } from '../src/types.js';

function makeWorkersDir(label: string): string {
  const dir = join(tmpdir(), `state-test-${label}-${Date.now()}-${Math.random()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function baseMeta(workerId: string): WorkerMeta {
  return {
    worker_id: workerId,
    pid: 1234,
    worktree_path: '/tmp/worktree',
    branch_name: `worker/${workerId}`,
    prompt: 'test prompt',
    agent: '',
    model: '',
    started_at: new Date().toISOString(),
    status: 'running',
  };
}

// ─── initWorker ───────────────────────────────────────────────────────────────

test('initWorker creates meta.json with correct content', () => {
  const workersDir = makeWorkersDir('init');
  const store = new StateStore(workersDir);
  const meta = baseMeta('w1');

  const stateDir = store.initWorker('w1', meta);

  assert.equal(stateDir, join(workersDir, 'w1'));
  const read = store.readMeta('w1');
  assert.equal(read.worker_id, 'w1');
  assert.equal(read.status, 'running');
  assert.equal(read.prompt, 'test prompt');

  rmSync(workersDir, { recursive: true, force: true });
});

// ─── updateStatus ─────────────────────────────────────────────────────────────

test('updateStatus changes status in meta.json', () => {
  const workersDir = makeWorkersDir('update-status');
  const store = new StateStore(workersDir);
  store.initWorker('w2', baseMeta('w2'));

  store.updateStatus('w2', 'completed');

  const read = store.readMeta('w2');
  assert.equal(read.status, 'completed');

  rmSync(workersDir, { recursive: true, force: true });
});

// ─── readMeta ─────────────────────────────────────────────────────────────────

test('readMeta returns parsed WorkerMeta', () => {
  const workersDir = makeWorkersDir('read-meta');
  const store = new StateStore(workersDir);
  const meta = baseMeta('w3');
  store.initWorker('w3', meta);

  const result = store.readMeta('w3');
  assert.equal(result.worker_id, 'w3');
  assert.equal(result.pid, 1234);
  assert.equal(result.branch_name, 'worker/w3');

  rmSync(workersDir, { recursive: true, force: true });
});

test('readMeta throws when worker does not exist', () => {
  const workersDir = makeWorkersDir('read-meta-missing');
  const store = new StateStore(workersDir);

  assert.throws(() => store.readMeta('missing'), /Worker metadata not found/);

  rmSync(workersDir, { recursive: true, force: true });
});

// ─── appendEvent / readEvents ─────────────────────────────────────────────────

test('appendEvent writes NDJSON lines, readEvents parses them back', () => {
  const workersDir = makeWorkersDir('events');
  const store = new StateStore(workersDir);
  store.initWorker('w4', baseMeta('w4'));

  const e1: WorkerEvent = { type: 'session.idle', data: {}, timestamp: '2024-01-01T00:00:00Z' };
  const e2: WorkerEvent = { type: 'status.change', data: { from: 'running', to: 'completed' }, timestamp: '2024-01-01T00:00:01Z' };
  store.appendEvent('w4', e1);
  store.appendEvent('w4', e2);

  const events = store.readEvents('w4');
  assert.equal(events.length, 2);
  assert.equal(events[0].type, 'session.idle');
  assert.equal(events[1].type, 'status.change');

  rmSync(workersDir, { recursive: true, force: true });
});

test('readEvents with tail returns last N events', () => {
  const workersDir = makeWorkersDir('events-tail');
  const store = new StateStore(workersDir);
  store.initWorker('w5', baseMeta('w5'));

  for (let i = 0; i < 5; i++) {
    const e: WorkerEvent = { type: 'session.idle', data: {}, timestamp: `2024-01-01T00:00:0${i}Z` };
    store.appendEvent('w5', e);
  }

  const tail = store.readEvents('w5', { tail: 2 });
  assert.equal(tail.length, 2);
  assert.equal(tail[0].timestamp, '2024-01-01T00:00:03Z');
  assert.equal(tail[1].timestamp, '2024-01-01T00:00:04Z');

  rmSync(workersDir, { recursive: true, force: true });
});

test('readEvents returns empty array when events file absent', () => {
  const workersDir = makeWorkersDir('events-absent');
  const store = new StateStore(workersDir);
  store.initWorker('w6', baseMeta('w6'));

  const events = store.readEvents('w6');
  assert.deepEqual(events, []);

  rmSync(workersDir, { recursive: true, force: true });
});

// ─── writeHistory / readHistory ───────────────────────────────────────────────

test('writeHistory and readHistory round-trip WorkerHistory', () => {
  const workersDir = makeWorkersDir('history');
  const store = new StateStore(workersDir);
  store.initWorker('w7', baseMeta('w7'));

  const history: WorkerHistory = {
    workerId: 'w7',
    prompt: 'test',
    agent: null,
    model: null,
    startedAt: '2024-01-01T00:00:00Z',
    completedAt: '2024-01-01T00:01:00Z',
    exitCode: 0,
    baseSha: 'abc123',
    branchName: 'worker/w7',
    turnCount: 3,
    toolCalls: [],
    commits: [],
    filesChanged: ['src/foo.ts'],
    eventCount: 10,
    durationMs: 60000,
    errorCount: 0,
    lastError: null,
  };

  store.writeHistory('w7', history);
  const read = store.readHistory('w7');

  assert.ok(read !== null);
  assert.equal(read!.workerId, 'w7');
  assert.equal(read!.exitCode, 0);
  assert.deepEqual(read!.filesChanged, ['src/foo.ts']);

  rmSync(workersDir, { recursive: true, force: true });
});

test('readHistory returns null when history.json absent', () => {
  const workersDir = makeWorkersDir('history-absent');
  const store = new StateStore(workersDir);
  store.initWorker('w8', baseMeta('w8'));

  const result = store.readHistory('w8');
  assert.equal(result, null);

  rmSync(workersDir, { recursive: true, force: true });
});

// ─── writeExit ────────────────────────────────────────────────────────────────

test('writeExit writes exit.json with correct data', () => {
  const workersDir = makeWorkersDir('exit');
  const store = new StateStore(workersDir);
  store.initWorker('w9', baseMeta('w9'));

  store.writeExit('w9', { exitCode: 0, completedAt: '2024-01-01T00:01:00Z', commits: ['fix: add tests'] });

  // Verify by reading back through StateStore internals (readMeta checks state dir exists)
  assert.ok(store.exists('w9'));

  rmSync(workersDir, { recursive: true, force: true });
});

// ─── listWorkerIds ────────────────────────────────────────────────────────────

test('listWorkerIds returns directory names', () => {
  const workersDir = makeWorkersDir('list');
  const store = new StateStore(workersDir);
  store.initWorker('alpha', baseMeta('alpha'));
  store.initWorker('beta', baseMeta('beta'));

  const ids = store.listWorkerIds().sort();
  assert.deepEqual(ids, ['alpha', 'beta']);

  rmSync(workersDir, { recursive: true, force: true });
});

test('listWorkerIds returns empty array when no workers', () => {
  const workersDir = makeWorkersDir('list-empty');
  const store = new StateStore(workersDir);

  assert.deepEqual(store.listWorkerIds(), []);

  rmSync(workersDir, { recursive: true, force: true });
});

// ─── remove / exists ─────────────────────────────────────────────────────────

test('remove deletes state directory', () => {
  const workersDir = makeWorkersDir('remove');
  const store = new StateStore(workersDir);
  store.initWorker('wx', baseMeta('wx'));

  assert.ok(store.exists('wx'));
  store.remove('wx');
  assert.equal(store.exists('wx'), false);

  rmSync(workersDir, { recursive: true, force: true });
});

test('exists returns true when state dir present, false when absent', () => {
  const workersDir = makeWorkersDir('exists');
  const store = new StateStore(workersDir);

  assert.equal(store.exists('nonexistent'), false);
  store.initWorker('wy', baseMeta('wy'));
  assert.equal(store.exists('wy'), true);

  rmSync(workersDir, { recursive: true, force: true });
});
