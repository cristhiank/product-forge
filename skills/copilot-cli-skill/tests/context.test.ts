import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { applyContext, replaceTemplateVars } from '../src/context.js';
import type { WorkerContextProvider } from '../src/types.js';

function makeWorktree(label: string): { worktreePath: string; repoRoot: string; cleanup: () => void } {
  const base = join(tmpdir(), `ctx-test-${label}-${Date.now()}-${Math.random()}`);
  const repoRoot = join(base, 'repo');
  const worktreePath = join(base, 'worktree');
  mkdirSync(repoRoot, { recursive: true });
  mkdirSync(worktreePath, { recursive: true });
  return {
    repoRoot,
    worktreePath,
    cleanup: () => rmSync(base, { recursive: true, force: true }),
  };
}

// ─── replaceTemplateVars ──────────────────────────────────────────────────────

test('replaceTemplateVars substitutes all template variables', () => {
  const result = replaceTemplateVars(
    'root={{repoRoot}} tree={{worktreePath}} id={{workerId}}',
    { repoRoot: '/repo', worktreePath: '/wt', workerId: 'abc' }
  );
  assert.equal(result, 'root=/repo tree=/wt id=abc');
});

test('replaceTemplateVars replaces multiple occurrences', () => {
  const result = replaceTemplateVars(
    '{{repoRoot}}/{{repoRoot}}',
    { repoRoot: '/r', worktreePath: '/w', workerId: 'x' }
  );
  assert.equal(result, '/r//r');
});

test('replaceTemplateVars leaves unknown placeholders intact', () => {
  const result = replaceTemplateVars(
    '{{unknown}} {{repoRoot}}',
    { repoRoot: '/r', worktreePath: '/w', workerId: 'x' }
  );
  assert.equal(result, '{{unknown}} /r');
});

// ─── Empty providers ──────────────────────────────────────────────────────────

test('empty providers array is a no-op', () => {
  const { worktreePath, repoRoot, cleanup } = makeWorktree('empty');
  const { env, prompt, result } = applyContext([], repoRoot, worktreePath, 'wid', 'base prompt');

  assert.deepEqual(env, {});
  assert.equal(prompt, 'base prompt');
  assert.equal(result.symlinksCreated, 0);
  assert.equal(result.envVarsAdded, 0);
  assert.equal(result.filesWritten, 0);
  assert.equal(result.promptSectionsInjected, 0);
  assert.deepEqual(result.warnings, []);

  cleanup();
});

// ─── Path escape blocking ─────────────────────────────────────────────────────

test('symlink target with ../ escape is blocked and adds warning', () => {
  const { worktreePath, repoRoot, cleanup } = makeWorktree('escape-symlink');

  const providers: WorkerContextProvider[] = [{
    provider: 'test',
    version: '1',
    context: {
      symlinks: [{ source: repoRoot, target: '../escaped' }],
    },
  }];

  const { result } = applyContext(providers, repoRoot, worktreePath, 'wid', '');
  assert.equal(result.symlinksCreated, 0);
  assert.ok(result.warnings.some(w => w.includes('escapes worktree boundary')));

  cleanup();
});

test('file path with ../ escape is blocked and adds warning', () => {
  const { worktreePath, repoRoot, cleanup } = makeWorktree('escape-file');

  const providers: WorkerContextProvider[] = [{
    provider: 'test',
    version: '1',
    context: {
      files: { '../outside.txt': 'bad content' },
    },
  }];

  const { result } = applyContext(providers, repoRoot, worktreePath, 'wid', '');
  assert.equal(result.filesWritten, 0);
  assert.ok(result.warnings.some(w => w.includes('escapes worktree boundary')));

  cleanup();
});

// ─── Normal symlink creation ──────────────────────────────────────────────────

test('normal symlink is created successfully', () => {
  const { worktreePath, repoRoot, cleanup } = makeWorktree('symlink-ok');

  // Create a real source file to link
  const sourceFile = join(repoRoot, 'real-file.txt');
  writeFileSync(sourceFile, 'hello');

  const providers: WorkerContextProvider[] = [{
    provider: 'test',
    version: '1',
    context: {
      symlinks: [{ source: sourceFile, target: 'link.txt' }],
    },
  }];

  const { result } = applyContext(providers, repoRoot, worktreePath, 'wid', '');
  assert.equal(result.symlinksCreated, 1);
  assert.equal(result.warnings.length, 0);
  assert.ok(existsSync(join(worktreePath, 'link.txt')));

  cleanup();
});

// ─── Environment variables ────────────────────────────────────────────────────

test('env variables are returned with template substitution', () => {
  const { worktreePath, repoRoot, cleanup } = makeWorktree('env');

  const providers: WorkerContextProvider[] = [{
    provider: 'test',
    version: '1',
    context: {
      env: { MY_ROOT: '{{repoRoot}}', MY_ID: '{{workerId}}' },
    },
  }];

  const { env, result } = applyContext(providers, repoRoot, worktreePath, 'wid-42', '');
  assert.equal(env['MY_ROOT'], repoRoot);
  assert.equal(env['MY_ID'], 'wid-42');
  assert.equal(result.envVarsAdded, 2);

  cleanup();
});

// ─── Files written ────────────────────────────────────────────────────────────

test('files are written to worktree with template substitution in content', () => {
  const { worktreePath, repoRoot, cleanup } = makeWorktree('files');

  const providers: WorkerContextProvider[] = [{
    provider: 'test',
    version: '1',
    context: {
      files: { 'config.txt': 'root={{repoRoot}} id={{workerId}}' },
    },
  }];

  const { result } = applyContext(providers, repoRoot, worktreePath, 'myworker', '');
  assert.equal(result.filesWritten, 1);
  const content = readFileSync(join(worktreePath, 'config.txt'), 'utf-8');
  assert.equal(content, `root=${repoRoot} id=myworker`);

  cleanup();
});

test('files are created in subdirectories inside worktree', () => {
  const { worktreePath, repoRoot, cleanup } = makeWorktree('files-subdir');

  const providers: WorkerContextProvider[] = [{
    provider: 'test',
    version: '1',
    context: {
      files: { 'subdir/nested/file.txt': 'content' },
    },
  }];

  const { result } = applyContext(providers, repoRoot, worktreePath, 'wid', '');
  assert.equal(result.filesWritten, 1);
  assert.ok(existsSync(join(worktreePath, 'subdir', 'nested', 'file.txt')));

  cleanup();
});

// ─── Prompt sections ──────────────────────────────────────────────────────────

test('prompt sections are appended with template substitution', () => {
  const { worktreePath, repoRoot, cleanup } = makeWorktree('prompt');

  const providers: WorkerContextProvider[] = [{
    provider: 'test',
    version: '1',
    context: {
      prompt_sections: { section1: 'Hello from {{workerId}}' },
    },
  }];

  const { prompt, result } = applyContext(providers, repoRoot, worktreePath, 'agent-1', 'base');
  assert.ok(prompt.includes('Hello from agent-1'));
  assert.equal(result.promptSectionsInjected, 1);

  cleanup();
});

test('multiple prompt sections from multiple providers are all appended', () => {
  const { worktreePath, repoRoot, cleanup } = makeWorktree('prompt-multi');

  const providers: WorkerContextProvider[] = [
    { provider: 'p1', version: '1', context: { prompt_sections: { a: 'Section A' } } },
    { provider: 'p2', version: '1', context: { prompt_sections: { b: 'Section B' } } },
  ];

  const { prompt, result } = applyContext(providers, repoRoot, worktreePath, 'wid', 'start');
  assert.ok(prompt.includes('Section A'));
  assert.ok(prompt.includes('Section B'));
  assert.equal(result.promptSectionsInjected, 2);
  assert.deepEqual(result.providers, ['p1', 'p2']);

  cleanup();
});
