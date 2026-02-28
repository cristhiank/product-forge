#!/usr/bin/env node
/**
 * Wrapper script for copilot worker processes.
 * Captures exit code and writes exit.json with completion metadata.
 *
 * Usage: node worker-wrapper.js <copilot-args>
 * Environment: WORKER_STATE_DIR must be set
 */
import { spawn, execSync, spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const workerStateDir = process.env.WORKER_STATE_DIR;
if (!workerStateDir) {
  console.error('ERROR: WORKER_STATE_DIR not set');
  process.exit(1);
}

const autoCommit = process.env.WORKER_AUTO_COMMIT === '1';

let child = null;
let settled = false;

const tryAutoCommit = () => {
  if (!autoCommit) return;
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf-8', timeout: 10000 }).trim();
    if (!status) return; // nothing to commit
    execSync('git add -A', { timeout: 10000 });
    const msg = process.env.WORKER_COMMIT_MSG || 'chore: auto-commit worker changes';
    // Use spawnSync with args array to avoid cmd.exe shell interpolation on Windows
    spawnSync('git', ['commit', '-m', msg], { timeout: 30000, stdio: 'pipe' });
  } catch {
    // Best-effort — don't fail the wrapper if commit fails
  }
};

const gatherGitReport = () => {
  const report = { commits: [], filesChanged: [], hasDirtyWorkingTree: false };
  try {
    const log = execSync('git log --oneline upstream..HEAD', { encoding: 'utf-8', timeout: 10000 }).trim();
    if (log) report.commits = log.split('\n').filter(l => l.length > 0);
  } catch {
    // upstream ref may not exist — try origin/main, main, or skip
    try {
      const log = execSync('git log --oneline @{upstream}..HEAD', { encoding: 'utf-8', timeout: 10000 }).trim();
      if (log) report.commits = log.split('\n').filter(l => l.length > 0);
    } catch {
      // No upstream tracking — skip commits
    }
  }
  try {
    const diff = execSync('git diff --name-only upstream..HEAD', { encoding: 'utf-8', timeout: 10000 }).trim();
    if (diff) report.filesChanged = diff.split('\n').filter(l => l.length > 0);
  } catch {
    try {
      const diff = execSync('git diff --name-only @{upstream}..HEAD', { encoding: 'utf-8', timeout: 10000 }).trim();
      if (diff) report.filesChanged = diff.split('\n').filter(l => l.length > 0);
    } catch {
      // No upstream tracking — skip filesChanged
    }
  }
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf-8', timeout: 10000 }).trim();
    report.hasDirtyWorkingTree = status.length > 0;
  } catch {
    // Best-effort
  }
  return report;
};

const writeExitJson = (exitCode) => {
  const gitReport = gatherGitReport();
  const data = {
    exitCode,
    completedAt: new Date().toISOString(),
    commits: gitReport.commits,
    filesChanged: gitReport.filesChanged,
    hasDirtyWorkingTree: gitReport.hasDirtyWorkingTree,
  };
  writeFileSync(join(workerStateDir, 'exit.json'), `${JSON.stringify(data, null, 2)}\n`);
};

const finalize = (exitCode) => {
  if (settled) return;
  settled = true;
  if (exitCode === 0) tryAutoCommit();
  writeExitJson(exitCode);
  process.exit(exitCode);
};

const forwardSignal = (signal) => {
  if (!child?.pid) {
    finalize(143);
    return;
  }
  try {
    child.kill(signal);
  } catch {
    finalize(143);
  }
};

process.on('SIGTERM', () => forwardSignal('SIGTERM'));
process.on('SIGINT', () => forwardSignal('SIGINT'));
if (process.platform !== 'win32') {
  process.on('SIGHUP', () => forwardSignal('SIGHUP'));
}

const copilotCommand = process.platform === 'win32' ? 'copilot.cmd' : 'copilot';

child = spawn(copilotCommand, process.argv.slice(2), {
  stdio: ['ignore', 'pipe', 'pipe'],
});

// Write copilot child PID so lifecycle detection tracks the real process
if (child.pid) {
  writeFileSync(join(workerStateDir, 'copilot.pid'), String(child.pid));
}

child.stdout?.pipe(process.stdout);
child.stderr?.pipe(process.stderr);

child.on('error', () => finalize(1));
child.on('exit', (code, signal) => {
  if (typeof code === 'number') {
    finalize(code);
    return;
  }

  if (signal) {
    finalize(143);
    return;
  }

  finalize(1);
});
