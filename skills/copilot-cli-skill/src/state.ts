/**
 * StateStore — filesystem state persistence for worker processes.
 * Manages meta.json, events.ndjson, history.json, and exit.json
 * under `.copilot-workers/<workerId>/`.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { WorkerMeta, WorkerEvent, WorkerHistory, ContextProviderResult } from './types.js';

/** Data written to exit.json when a worker process terminates */
export interface ExitData {
  /** Process exit code */
  exitCode: number;
  /** ISO-8601 timestamp of when the worker completed */
  completedAt: string;
  /** Commit messages on the worker branch */
  commits?: string[];
  /** Paths of files changed on the worker branch */
  filesChanged?: string[];
  /** Whether the working tree had uncommitted changes at exit time */
  hasDirtyWorkingTree?: boolean;
  /** What triggered this exit record (e.g., 'cleanup') */
  terminatedBy?: string;
}

// Re-export so callers can import ExitData and ContextProviderResult from one place
export type { ContextProviderResult };

export class StateStore {
  constructor(private workersDir: string) {}

  /**
   * Initialises a worker state directory and writes the initial meta.json.
   *
   * @param workerId - Unique worker identifier
   * @param meta - Worker metadata to persist
   * @returns Absolute path to the created state directory
   */
  initWorker(workerId: string, meta: WorkerMeta): string {
    const stateDir = join(this.workersDir, workerId);
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(join(stateDir, 'meta.json'), JSON.stringify(meta, null, 2));
    return stateDir;
  }

  /**
   * Updates the `status` field in meta.json.
   * Silently ignores transient IO/parse races.
   *
   * @param workerId - Unique worker identifier
   * @param status - New status value
   */
  updateStatus(workerId: string, status: WorkerMeta['status']): void {
    const metaPath = join(this.workersDir, workerId, 'meta.json');
    try {
      const current: WorkerMeta = JSON.parse(readFileSync(metaPath, 'utf-8'));
      current.status = status;
      writeFileSync(metaPath, JSON.stringify(current, null, 2));
    } catch {
      // Ignore transient IO/parse races for status updates
    }
  }

  /**
   * Reads and parses meta.json for the given worker.
   *
   * @param workerId - Unique worker identifier
   * @returns Parsed WorkerMeta object
   * @throws if the state directory or meta.json does not exist
   */
  readMeta(workerId: string): WorkerMeta {
    const metaPath = join(this.workersDir, workerId, 'meta.json');
    if (!existsSync(metaPath)) {
      throw new Error(`Worker metadata not found: ${workerId}`);
    }
    return JSON.parse(readFileSync(metaPath, 'utf-8')) as WorkerMeta;
  }

  /**
   * Writes exit.json with completion metadata.
   *
   * @param workerId - Unique worker identifier
   * @param exitData - Exit metadata to persist
   */
  writeExit(workerId: string, exitData: ExitData): void {
    const exitPath = join(this.workersDir, workerId, 'exit.json');
    writeFileSync(exitPath, `${JSON.stringify(exitData, null, 2)}\n`);
  }

  /**
   * Appends a single WorkerEvent as an NDJSON line to events.ndjson.
   *
   * @param workerId - Unique worker identifier
   * @param event - Event to append
   */
  appendEvent(workerId: string, event: WorkerEvent): void {
    const eventsPath = join(this.workersDir, workerId, 'events.ndjson');
    appendFileSync(eventsPath, `${JSON.stringify(event)}\n`);
  }

  /**
   * Reads all events from events.ndjson, optionally returning only the last N lines.
   *
   * @param workerId - Unique worker identifier
   * @param opts - Optional read options (e.g., `tail` for last N events)
   * @returns Array of parsed WorkerEvent objects; empty array if file absent
   */
  readEvents(workerId: string, opts?: { tail?: number }): WorkerEvent[] {
    const eventsPath = join(this.workersDir, workerId, 'events.ndjson');
    if (!existsSync(eventsPath)) return [];

    const lines = readFileSync(eventsPath, 'utf-8')
      .split('\n')
      .filter(l => l.trim().length > 0);

    const slice = opts?.tail !== undefined ? lines.slice(-opts.tail) : lines;

    const events: WorkerEvent[] = [];
    for (const line of slice) {
      try {
        events.push(JSON.parse(line) as WorkerEvent);
      } catch {
        // Skip malformed NDJSON lines
      }
    }
    return events;
  }

  /**
   * Writes a WorkerHistory snapshot to history.json.
   *
   * @param workerId - Unique worker identifier
   * @param history - History record to persist
   */
  writeHistory(workerId: string, history: WorkerHistory): void {
    const historyPath = join(this.workersDir, workerId, 'history.json');
    writeFileSync(historyPath, `${JSON.stringify(history, null, 2)}\n`);
  }

  /**
   * Reads history.json if it exists.
   *
   * @param workerId - Unique worker identifier
   * @returns Parsed WorkerHistory, or null if file absent
   */
  readHistory(workerId: string): WorkerHistory | null {
    const historyPath = join(this.workersDir, workerId, 'history.json');
    if (!existsSync(historyPath)) return null;
    try {
      return JSON.parse(readFileSync(historyPath, 'utf-8')) as WorkerHistory;
    } catch {
      return null;
    }
  }

  /**
   * Returns the last N non-empty lines from events.ndjson as raw strings.
   *
   * @param workerId - Unique worker identifier
   * @param lines - Number of lines to return (default: 20)
   * @returns Array of raw NDJSON line strings
   */
  readLogTail(workerId: string, lines = 20): string[] {
    const eventsPath = join(this.workersDir, workerId, 'events.ndjson');
    if (!existsSync(eventsPath)) return [];
    return readFileSync(eventsPath, 'utf-8')
      .split('\n')
      .filter(l => l.trim().length > 0)
      .slice(-lines);
  }

  /**
   * Checks whether the state directory for a worker exists.
   *
   * @param workerId - Unique worker identifier
   * @returns true if the state directory exists
   */
  exists(workerId: string): boolean {
    return existsSync(join(this.workersDir, workerId));
  }

  /**
   * Removes the state directory and all its contents for a worker.
   *
   * @param workerId - Unique worker identifier
   */
  remove(workerId: string): void {
    rmSync(join(this.workersDir, workerId), { recursive: true, force: true });
  }

  /**
   * Lists all worker IDs that have state directories.
   *
   * @returns Array of worker ID strings
   */
  listWorkerIds(): string[] {
    if (!existsSync(this.workersDir)) return [];
    return readdirSync(this.workersDir, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name);
  }
}
