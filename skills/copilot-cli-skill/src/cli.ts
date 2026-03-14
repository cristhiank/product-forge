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

function collectStringOption(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function parseNonNegativeInt(value: string, optionName: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid value for ${optionName}: ${value}. Expected a non-negative integer.`);
  }
  return parsed;
}

function parseStreamMode(value: string): 'on' | 'off' {
  if (value === 'on' || value === 'off') return value;
  throw new Error(`Invalid value for --stream: ${value}. Expected "on" or "off".`);
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
    .option('--allow-all', 'Enable all permissions (--allow-all-tools --allow-all-paths --allow-all-urls)')
    .option('--allow-all-paths', 'Allow access to all paths')
    .option('--allow-all-urls', 'Allow all URL access')
    .option('--allow-tool <tool>', 'Allow a specific tool without confirmation (repeatable)', collectStringOption, [])
    .option('--deny-tool <tool>', 'Deny a specific tool (repeatable)', collectStringOption, [])
    .option('--available-tools <tool>', 'Restrict model-visible tools to this set (repeatable)', collectStringOption, [])
    .option('--excluded-tools <tool>', 'Exclude model-visible tools from this set (repeatable)', collectStringOption, [])
    .option('--allow-url <url>', 'Allow a specific URL/domain without confirmation (repeatable)', collectStringOption, [])
    .option('--deny-url <url>', 'Deny a specific URL/domain (repeatable)', collectStringOption, [])
    .option('--disallow-temp-dir', 'Prevent automatic access to system temp directory')
    .option('--no-ask-user', 'Disable ask_user tool for autonomous worker runs')
    .option('--disable-parallel-tools-execution', 'Disable parallel execution of tool calls')
    .option('--stream <mode>', 'Streaming mode (on|off)')
    .option('--autopilot', 'Enable autopilot mode')
    .option('--max-autopilot-continues <count>', 'Limit autopilot continuation messages')
    .option('--task-id <id>', 'Associate spawn request with a task ID for deduplication')
    .option('--auto-commit [message]', 'Auto-commit changes on successful exit (optionally with custom message)')
    .option('--context-providers <json>', 'JSON array of context providers to apply to the worktree')
    .action((opts) => {
      try {
        const repoRoot = resolve(program.opts().repoRoot);
        const manager = new WorkerManager(repoRoot);
        const maxAutopilotContinues = opts.maxAutopilotContinues !== undefined
          ? parseNonNegativeInt(opts.maxAutopilotContinues, '--max-autopilot-continues')
          : undefined;
        const stream = opts.stream !== undefined
          ? parseStreamMode(opts.stream)
          : undefined;
        let contextProviders;
        if (opts.contextProviders) {
          try {
            contextProviders = JSON.parse(opts.contextProviders);
          } catch {
            throw new Error('Invalid JSON for --context-providers');
          }
        }
        const result = manager.spawn({
          prompt: opts.prompt,
          agent: opts.agent,
          model: opts.model,
          worktreeBase: opts.worktreeBase,
          branchPrefix: opts.branchPrefix,
          addDirs: opts.addDir,
          allowAll: opts.allowAll,
          allowAllPaths: opts.allowAllPaths,
          allowAllUrls: opts.allowAllUrls,
          allowTools: opts.allowTool?.length ? opts.allowTool : undefined,
          denyTools: opts.denyTool?.length ? opts.denyTool : undefined,
          availableTools: opts.availableTools?.length ? opts.availableTools : undefined,
          excludedTools: opts.excludedTools?.length ? opts.excludedTools : undefined,
          allowUrls: opts.allowUrl?.length ? opts.allowUrl : undefined,
          denyUrls: opts.denyUrl?.length ? opts.denyUrl : undefined,
          disallowTempDir: opts.disallowTempDir,
          noAskUser: opts.askUser === false,
          disableParallelToolsExecution: opts.disableParallelToolsExecution,
          stream,
          autopilot: opts.autopilot,
          maxAutopilotContinues,
          taskId: opts.taskId,
          autoCommit: opts.autoCommit === true ? true : opts.autoCommit || undefined,
          contextProviders,
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

  // ============ await command ============
  program
    .command('await')
    .description('Wait for a worker to reach a terminal state')
    .argument('<worker-id>', 'Worker ID to wait for')
    .option('--poll-interval <ms>', 'Polling interval in ms (default: 3000)')
    .option('--timeout <ms>', 'Maximum wait time in ms (0 = no limit, default: 0)')
    .action((workerId, opts) => {
      try {
        const repoRoot = resolve(program.opts().repoRoot);
        const manager = new WorkerManager(repoRoot);
        const pollIntervalMs = opts.pollInterval !== undefined
          ? parseNonNegativeInt(opts.pollInterval, '--poll-interval')
          : undefined;
        const timeoutMs = opts.timeout !== undefined
          ? parseNonNegativeInt(opts.timeout, '--timeout')
          : undefined;
        const result = manager.awaitCompletion(workerId, { pollIntervalMs, timeoutMs });
        output(result, program.opts().pretty);
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

  // ============ validate command ============
  program
    .command('validate')
    .description('Validate a worker\'s output: commits, file scope, build result')
    .argument('<worker-id>', 'Worker ID to validate')
    .option('--build-command <cmd>', 'Build command to run in the worktree')
    .option('--required-path-prefix <prefix>', 'Files must be under these prefixes (repeatable)', collectStringOption, [])
    .option('--forbidden-path-prefix <prefix>', 'Files must NOT be under these prefixes (repeatable)', collectStringOption, [])
    .option('--no-require-commits', 'Do not require commits on the worker branch')
    .action((workerId, opts) => {
      try {
        const repoRoot = resolve(program.opts().repoRoot);
        const manager = new WorkerManager(repoRoot);
        const result = manager.validateWorker(workerId, {
          buildCommand: opts.buildCommand,
          requiredPathPrefixes: opts.requiredPathPrefix?.length ? opts.requiredPathPrefix : undefined,
          forbiddenPathPrefixes: opts.forbiddenPathPrefix?.length ? opts.forbiddenPathPrefix : undefined,
          requireCommits: opts.requireCommits,
        });
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
    .action(async (opts) => {
      try {
        const repoRoot = resolve(program.opts().repoRoot);
        const manager = new WorkerManager(repoRoot);
        const sdk = new WorkerSDK(manager);
        const results = await sdk.cleanupAll(opts.force);
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
