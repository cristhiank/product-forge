/**
 * HubSDK - High-level, agent-friendly API for DevPartner workflows
 *
 * Wraps the Hub class with domain-specific convenience methods.
 * Agents generate code using these methods instead of constructing CLI commands.
 */

import { Hub } from './hub.js';
import { detectHealth } from './core/reactor.js';
import type { Message, Worker, WorkerStatus, RegisterWorkerOptions, WorkerSyncResult } from './core/types.js';

export interface SDKOptions {
  /** Default channel for all operations (e.g., '#main', '#worker-B042') */
  channel?: string;
  /** Default author for all operations (e.g., 'scout', 'executor') */
  author?: string;
}

export interface FindingOptions {
  tags?: string[];
  path?: string;
  lines?: [number, number];
  metadata?: Record<string, unknown>;
  channel?: string;
  author?: string;
}

export interface SnippetOptions {
  gitHash?: string;
  language?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  channel?: string;
  author?: string;
}

export interface DecisionOptions {
  approachId?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  channel?: string;
  author?: string;
}

export interface RequestOptions {
  target?: string;
  requestType?: 'help' | 'scout' | 'review';
  tags?: string[];
  metadata?: Record<string, unknown>;
  channel?: string;
  author?: string;
}

export interface ProgressOptions {
  checkpointNumber?: number;
  filesChanged?: string[];
  tags?: string[];
  metadata?: Record<string, unknown>;
  channel?: string;
  author?: string;
}

export interface TrailOptions {
  details?: string;
  evidence?: string[];
  tags?: string[];
  metadata?: Record<string, unknown>;
  channel?: string;
  author?: string;
}

export interface QueryOptions {
  channel?: string;
  since?: string;
  limit?: number;
  tags?: string[];
}

/**
 * HubSDK — domain-specific helpers for agent workflows.
 *
 * Usage:
 * ```ts
 * const sdk = new HubSDK(hub, { channel: '#main', author: 'scout' });
 * sdk.postFinding('Auth uses bcrypt', { tags: ['auth'], path: 'src/auth.ts' });
 * ```
 */
export class HubSDK {
  constructor(
    private hub: Hub,
    private defaults: SDKOptions = {},
  ) {}

  private ch(override?: string): string {
    const c = override ?? this.defaults.channel;
    if (!c) throw new Error('No channel specified. Pass channel or set default in SDKOptions.');
    return c;
  }

  private au(override?: string): string {
    const a = override ?? this.defaults.author;
    if (!a) throw new Error('No author specified. Pass author or set default in SDKOptions.');
    return a;
  }

  // ========== Findings & Notes ==========

  /** Post a finding (note tagged "finding") */
  postFinding(content: string, opts: FindingOptions = {}): Message {
    const meta: Record<string, unknown> = { ...opts.metadata };
    if (opts.path) meta.path = opts.path;
    if (opts.lines) meta.lines = opts.lines;

    return this.hub.post({
      channel: this.ch(opts.channel),
      type: 'note',
      author: this.au(opts.author),
      content,
      tags: uniqueTags(['finding'], opts.tags),
      metadata: meta,
    });
  }

  /** Post a code snippet (note tagged "snippet" with path metadata) */
  postSnippet(path: string, content: string, opts: SnippetOptions = {}): Message {
    const meta: Record<string, unknown> = { path, ...opts.metadata };
    if (opts.gitHash) meta.git_hash = opts.gitHash;
    if (opts.language) meta.language = opts.language;

    return this.hub.post({
      channel: this.ch(opts.channel),
      type: 'note',
      author: this.au(opts.author),
      content,
      tags: uniqueTags(['snippet'], opts.tags),
      metadata: meta,
    });
  }

  /** Post a constraint (note tagged "constraint") */
  postConstraint(content: string, opts: FindingOptions = {}): Message {
    const meta: Record<string, unknown> = { ...opts.metadata };
    if (opts.path) meta.path = opts.path;

    return this.hub.post({
      channel: this.ch(opts.channel),
      type: 'note',
      author: this.au(opts.author),
      content,
      tags: uniqueTags(['constraint'], opts.tags),
      metadata: meta,
    });
  }

  // ========== Decisions ==========

  /** Propose a decision (decision with status=proposed) */
  proposeDecision(content: string, opts: DecisionOptions = {}): Message {
    const meta: Record<string, unknown> = { status: 'proposed', ...opts.metadata };
    if (opts.approachId) meta.approach_id = opts.approachId;

    return this.hub.post({
      channel: this.ch(opts.channel),
      type: 'decision',
      author: this.au(opts.author),
      content,
      tags: opts.tags,
      metadata: meta,
    });
  }

  /** Approve a decision (reply with status=approved) */
  approveDecision(threadId: string, resolution: string, opts: { author?: string } = {}): Message {
    return this.hub.reply(threadId, {
      author: this.au(opts.author),
      content: resolution,
      metadata: { status: 'approved' },
    });
  }

  /** Reject a decision (reply with status=rejected) */
  rejectDecision(threadId: string, reason: string, opts: { author?: string } = {}): Message {
    return this.hub.reply(threadId, {
      author: this.au(opts.author),
      content: reason,
      metadata: { status: 'rejected' },
    });
  }

  // ========== Requests & Blocking ==========

  /** Request help (post type=request with severity) */
  requestHelp(
    content: string,
    severity: 'info' | 'minor' | 'major' | 'blocker',
    opts: RequestOptions = {},
  ): Message {
    const meta: Record<string, unknown> = {
      severity,
      resolved: false,
      ...opts.metadata,
    };
    if (opts.target) meta.target = opts.target;
    if (opts.requestType) meta.request_type = opts.requestType;

    return this.hub.post({
      channel: this.ch(opts.channel),
      type: 'request',
      author: this.au(opts.author),
      content,
      tags: uniqueTags(['blocked'], opts.tags),
      metadata: meta,
    });
  }

  /** Resolve a request (reply with resolved=true) */
  resolveRequest(threadId: string, resolution: string, opts: { author?: string } = {}): Message {
    return this.hub.reply(threadId, {
      author: this.au(opts.author),
      content: resolution,
      metadata: { resolved: true },
    });
  }

  // ========== Status & Progress ==========

  /** Post progress update (status with step info) */
  postProgress(
    step: number,
    totalSteps: number,
    content: string,
    opts: ProgressOptions = {},
  ): Message {
    const meta: Record<string, unknown> = {
      step,
      total_steps: totalSteps,
      ...opts.metadata,
    };
    if (opts.filesChanged) meta.files_changed = opts.filesChanged;

    return this.hub.post({
      channel: this.ch(opts.channel),
      type: 'status',
      author: this.au(opts.author),
      content,
      tags: uniqueTags(['progress'], opts.tags),
      metadata: meta,
    });
  }

  /** Post a checkpoint (status tagged "checkpoint") */
  postCheckpoint(content: string, opts: ProgressOptions = {}): Message {
    const meta: Record<string, unknown> = { ...opts.metadata };
    if (opts.checkpointNumber) meta.checkpoint_number = opts.checkpointNumber;
    if (opts.filesChanged) meta.files_changed = opts.filesChanged;

    return this.hub.post({
      channel: this.ch(opts.channel),
      type: 'status',
      author: this.au(opts.author),
      content,
      tags: uniqueTags(['checkpoint'], opts.tags),
      metadata: meta,
    });
  }

  // ========== Trails ==========

  /** Log a trail entry (note tagged "trail" with marker) */
  logTrail(marker: string, summary: string, opts: TrailOptions = {}): Message {
    const meta: Record<string, unknown> = { marker, ...opts.metadata };
    if (opts.evidence) meta.evidence = opts.evidence;

    const details = typeof opts.details === 'string'
      ? opts.details
      : opts.details ? JSON.stringify(opts.details, null, 2) : undefined;
    const content = details ? `${summary}\n\n${details}` : summary;

    return this.hub.post({
      channel: this.ch(opts.channel),
      type: 'note',
      author: this.au(opts.author),
      content,
      tags: uniqueTags(['trail'], opts.tags),
      metadata: meta,
    });
  }

  // ========== Queries ==========

  /** Get findings (notes tagged "finding") */
  getFindings(opts: QueryOptions = {}): Message[] {
    return this.hub.read({
      channel: opts.channel ?? this.defaults.channel,
      type: 'note',
      tags: uniqueTags(['finding'], opts.tags),
      since: opts.since,
      limit: opts.limit ?? 50,
    }).messages;
  }

  /** Get unresolved requests */
  getUnresolved(opts: QueryOptions = {}): Message[] {
    return this.hub.read({
      channel: opts.channel ?? this.defaults.channel,
      type: 'request',
      unresolved: true,
      since: opts.since,
      limit: opts.limit ?? 50,
    }).messages;
  }

  /** Get decisions, optionally filtered by status */
  getDecisions(status?: 'proposed' | 'approved' | 'rejected', opts: QueryOptions = {}): Message[] {
    const messages = this.hub.read({
      channel: opts.channel ?? this.defaults.channel,
      type: 'decision',
      since: opts.since,
      limit: opts.limit ?? 50,
    }).messages;

    if (!status) return messages;
    return messages.filter(m => m.metadata?.status === status);
  }

  /** Search messages across hub */
  search(query: string, opts: QueryOptions = {}): Message[] {
    return this.hub.search(query, {
      channel: opts.channel ?? this.defaults.channel,
      tags: opts.tags,
      limit: opts.limit ?? 20,
      since: opts.since,
    });
  }

  /** Get hub status overview */
  status() {
    return this.hub.status();
  }

  // ========== Workers ==========

  /** Register a worker and auto-discover its session */
  registerWorker(opts: RegisterWorkerOptions): Worker {
    return this.hub.workerRegister(opts);
  }

  /** Get detailed worker status including sync */
  getWorkerStatus(id: string, sync = true): (Worker & { health?: string }) | null {
    if (sync) {
      const syncResult = this.hub.workerSync(id);
      if (syncResult.syncStatus === 'no_worker') return null;
    }
    const worker = this.hub.workerGet(id);
    if (!worker) return null;
    return { ...worker, health: detectHealth(worker.lastEventAt) };
  }

  /** List all workers with optional status filter */
  listWorkers(opts?: { status?: WorkerStatus }): Worker[] {
    return this.hub.workerList(opts);
  }

  /** Sync all active workers and return results */
  syncAll(): WorkerSyncResult[] {
    return this.hub.workerSyncAll();
  }

  /** Deregister a worker — marks it as completed (preserves history) */
  deregisterWorker(id: string): boolean {
    return this.hub.workerDeregister(id);
  }

  /** Prune stale workers with dead PIDs */
  pruneWorkers(): { pruned: string[] } {
    return this.hub.workerPrune();
  }
}

/** Merge base tags with optional additional tags, deduplicated */
function uniqueTags(base: string[], extra?: string[]): string[] {
  if (!extra) return base;
  return [...new Set([...base, ...extra])];
}
