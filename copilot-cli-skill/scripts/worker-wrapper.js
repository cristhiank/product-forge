#!/usr/bin/env node
/**
 * Wrapper script for copilot worker processes.
 * Captures exit code and writes exit.json with completion metadata.
 *
 * Usage: node worker-wrapper.js <copilot-args>
 * Environment: WORKER_STATE_DIR must be set
 */
import { spawn, execSync } from 'node:child_process';
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
    execSync(`git commit -m "${msg}"`, { timeout: 30000 });
  } catch {
    // Best-effort — don't fail the wrapper if commit fails
  }
};

const writeExitJson = (exitCode) => {
  const data = {
    exitCode,
    completedAt: new Date().toISOString(),
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
