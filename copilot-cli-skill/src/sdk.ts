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
  /** Enable autopilot by default */
  autopilot?: boolean;
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
      autopilot: opts.autopilot ?? this.defaults.autopilot,
      worktreeBase: opts.worktreeBase,
      branchPrefix: opts.branchPrefix,
      addDirs: opts.addDirs,
      allowAllPaths: opts.allowAllPaths,
      allowAllUrls: opts.allowAllUrls,
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
