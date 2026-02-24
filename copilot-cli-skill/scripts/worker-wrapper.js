#!/usr/bin/env node
/**
 * Wrapper script for copilot worker processes.
 * Captures exit code and writes exit.json with completion metadata.
 *
 * Usage: node worker-wrapper.js <copilot-args>
 * Environment: WORKER_STATE_DIR must be set
 */
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const workerStateDir = process.env.WORKER_STATE_DIR;
if (!workerStateDir) {
  console.error('ERROR: WORKER_STATE_DIR not set');
  process.exit(1);
}

let child = null;
let settled = false;

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
