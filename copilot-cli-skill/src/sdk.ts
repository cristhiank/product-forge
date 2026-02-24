/**
 * WorkerSDK - High-level convenience API for worker management
 *
 * Wraps WorkerManager with agent-friendly defaults and helpers.
 */

import { WorkerManager } from './workers.js';
import type { SpawnOptions, WorkerInfo, WorkerStatus, CleanupResult } from './types.js';

export interface WorkerSDKOptions {
  /** Default agent for spawned workers */
  agent?: string;
  /** Default model for spawned workers */
  model?: string;
  /** Default all-permissions mode */
  allowAll?: boolean;
  /** Default directory allow-list */
  addDirs?: string[];
  /** Default path permission mode */
  allowAllPaths?: boolean;
  /** Default URL permission mode */
  allowAllUrls?: boolean;
  /** Default tool allow-list */
  allowTools?: string[];
  /** Default tool deny-list */
  denyTools?: string[];
  /** Default model-visible tool allow-list */
  availableTools?: string[];
  /** Default model-visible tool deny-list */
  excludedTools?: string[];
  /** Default URL allow-list */
  allowUrls?: string[];
  /** Default URL deny-list */
  denyUrls?: string[];
  /** Default temp-dir policy */
  disallowTempDir?: boolean;
  /** Default ask_user behavior */
  noAskUser?: boolean;
  /** Default parallel tool execution policy */
  disableParallelToolsExecution?: boolean;
  /** Default streaming mode */
  stream?: 'on' | 'off';
  /** Enable autopilot by default */
  autopilot?: boolean;
  /** Default autopilot continuation limit */
  maxAutopilotContinues?: number;
}

/**
 * WorkerSDK — agent-friendly helpers for managing Copilot CLI workers.
 *
 * Usage:
 * ```ts
 * const sdk = new WorkerSDK(manager, { agent: 'Executor', autopilot: true });
 * const worker = sdk.spawnWorker('Implement magic link auth');
 * const status = sdk.checkWorker(worker.workerId);
 * ```
 */
export class WorkerSDK {
  constructor(
    private manager: WorkerManager,
    private defaults: WorkerSDKOptions = {},
  ) {}

  /** Spawn a new worker with sensible defaults */
  spawnWorker(prompt: string, opts: Partial<SpawnOptions> = {}): WorkerInfo {
    return this.manager.spawn({
      prompt,
      agent: opts.agent ?? this.defaults.agent,
      model: opts.model ?? this.defaults.model,
      allowAll: opts.allowAll ?? this.defaults.allowAll,
      autopilot: opts.autopilot ?? this.defaults.autopilot,
      maxAutopilotContinues: opts.maxAutopilotContinues ?? this.defaults.maxAutopilotContinues,
      worktreeBase: opts.worktreeBase,
      branchPrefix: opts.branchPrefix,
      addDirs: opts.addDirs ?? this.defaults.addDirs,
      allowAllPaths: opts.allowAllPaths ?? this.defaults.allowAllPaths,
      allowAllUrls: opts.allowAllUrls ?? this.defaults.allowAllUrls,
      allowTools: opts.allowTools ?? this.defaults.allowTools,
      denyTools: opts.denyTools ?? this.defaults.denyTools,
      availableTools: opts.availableTools ?? this.defaults.availableTools,
      excludedTools: opts.excludedTools ?? this.defaults.excludedTools,
      allowUrls: opts.allowUrls ?? this.defaults.allowUrls,
      denyUrls: opts.denyUrls ?? this.defaults.denyUrls,
      disallowTempDir: opts.disallowTempDir ?? this.defaults.disallowTempDir,
      noAskUser: opts.noAskUser ?? this.defaults.noAskUser,
      disableParallelToolsExecution:
        opts.disableParallelToolsExecution ?? this.defaults.disableParallelToolsExecution,
      stream: opts.stream ?? this.defaults.stream,
      contextProviders: opts.contextProviders,
    });
  }

  /** Get detailed status of a worker */
  checkWorker(workerId: string): WorkerStatus {
    return this.manager.getStatus(workerId);
  }

  /** List all workers */
  listAll(): Array<{ workerId: string; pid: number; status: string }> {
    return this.manager.listWorkers();
  }

  /** Clean up a single worker */
  cleanupWorker(workerId: string, force = false): CleanupResult {
    return this.manager.cleanup(workerId, force);
  }

  /** Clean up all stopped workers */
  cleanupAll(force = false): CleanupResult[] {
    const workers = this.manager.listWorkers();
    const results: CleanupResult[] = [];

    for (const w of workers) {
      if (w.status !== 'running' || force) {
        try {
          results.push(this.manager.cleanup(w.workerId, force));
        } catch {
          // Skip workers that fail to clean up
        }
      }
    }

    return results;
  }
}
