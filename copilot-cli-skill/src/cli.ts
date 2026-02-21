/**
 * CLI for Copilot CLI Worker Management using Commander.js
 * All commands output JSON to stdout
 */

import { Command } from 'commander';
import { resolve } from 'node:path';
import { WorkerManager } from './workers.js';
import { WorkerSDK } from './sdk.js';

function output(data: unknown, pretty: boolean): void {
  console.log(JSON.stringify(data, null, pretty ? 2 : undefined));
}

function handleError(err: unknown): never {
  const message = err instanceof Error ? err.message : String(err);
  console.log(JSON.stringify({ error: message }));
  process.exit(1);
}

export function runCli(): void {
  const program = new Command();

  program
    .name('worker')
    .description('Copilot CLI Worker Management - Spawn, monitor, and cleanup workers')
    .version('0.1.0')
    .option('--repo-root <path>', 'Repository root path', '.')
    .option('--pretty', 'Pretty-print JSON output', false);

  // ============ spawn command ============
  program
    .command('spawn')
    .description('Spawn a new Copilot CLI worker in an isolated worktree')
    .requiredOption('--prompt <text>', 'Prompt for the worker')
    .option('--agent <agent>', 'Custom agent (e.g., Scout, Executor)')
    .option('--model <model>', 'Model override (e.g., claude-opus-4.6)')
    .option('--worktree-base <path>', 'Base directory for worktrees')
    .option('--branch-prefix <prefix>', 'Branch name prefix')
    .option('--add-dir <dir...>', 'Allow access to directories')
    .option('--allow-all-paths', 'Allow access to all paths')
    .option('--allow-all-urls', 'Allow all URL access')
    .option('--autopilot', 'Enable autopilot mode')
    .action((opts) => {
      try {
        const repoRoot = resolve(program.opts().repoRoot);
        const manager = new WorkerManager(repoRoot);
        const result = manager.spawn({
          prompt: opts.prompt,
          agent: opts.agent,
          model: opts.model,
          worktreeBase: opts.worktreeBase,
          branchPrefix: opts.branchPrefix,
          addDirs: opts.addDir,
          allowAllPaths: opts.allowAllPaths,
          allowAllUrls: opts.allowAllUrls,
          autopilot: opts.autopilot,
        });
        output(result, program.opts().pretty);
      } catch (err) {
        handleError(err);
      }
    });

  // ============ status command ============
  program
    .command('status')
    .description('Check status of a worker or list all workers')
    .argument('[worker-id]', 'Worker ID (omit to list all)')
    .option('--list', 'List all workers')
    .action((workerId, opts) => {
      try {
        const repoRoot = resolve(program.opts().repoRoot);
        const manager = new WorkerManager(repoRoot);

        if (!workerId || opts.list) {
          const workers = manager.listWorkers();
          output({ workers }, program.opts().pretty);
        } else {
          const status = manager.getStatus(workerId);
          output(status, program.opts().pretty);
        }
      } catch (err) {
        handleError(err);
      }
    });

  // ============ cleanup command ============
  program
    .command('cleanup')
    .description('Clean up a worker and its worktree')
    .argument('<worker-id>', 'Worker ID to clean up')
    .option('--force', 'Force kill process if graceful shutdown fails')
    .action((workerId, opts) => {
      try {
        const repoRoot = resolve(program.opts().repoRoot);
        const manager = new WorkerManager(repoRoot);
        const result = manager.cleanup(workerId, opts.force);
        output(result, program.opts().pretty);
      } catch (err) {
        handleError(err);
      }
    });

  // ============ cleanup-all command ============
  program
    .command('cleanup-all')
    .description('Clean up all stopped workers')
    .option('--force', 'Force cleanup of running workers too')
    .action((opts) => {
      try {
        const repoRoot = resolve(program.opts().repoRoot);
        const manager = new WorkerManager(repoRoot);
        const sdk = new WorkerSDK(manager);
        const results = sdk.cleanupAll(opts.force);
        output({ cleaned: results, total: results.length }, program.opts().pretty);
      } catch (err) {
        handleError(err);
      }
    });

  // ============ exec command ============
  program
    .command('exec')
    .description('Execute JavaScript code with WorkerManager and SDK pre-loaded')
    .argument('<code>', 'JavaScript code to evaluate (manager and sdk are in scope)')
    .option('--agent <agent>', 'Default agent for SDK operations')
    .option('--model <model>', 'Default model for SDK operations')
    .option('--autopilot', 'Default autopilot for SDK operations')
    .action(async (code, opts) => {
      try {
        const repoRoot = resolve(program.opts().repoRoot);
        const manager = new WorkerManager(repoRoot);
        const sdk = new WorkerSDK(manager, {
          agent: opts.agent,
          model: opts.model,
          autopilot: opts.autopilot,
        });

        const fn = new Function(
          'manager', 'sdk',
          `return (async () => { ${code} })();`,
        ) as (manager: WorkerManager, sdk: WorkerSDK) => Promise<unknown>;

        const result = await fn(manager, sdk);

        if (result !== undefined) {
          output(result, program.opts().pretty);
        }
      } catch (err) {
        handleError(err);
      }
    });

  program.parse();
}
