/**
 * Hub - Main API facade for Agents Hub
 * Wraps all core modules behind a clean, cohesive interface
 */

import type { Database } from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { openDatabase } from './db/connection.js';
import { initSchema } from './db/schema.js';
import { createChannel, listChannels, ensureChannel } from './core/channels.js';
import {
  postMessage,
  replyToMessage,
  updateMessage,
  readMessages,
  readThread,
} from './core/messages.js';
import { searchMessages } from './core/search.js';
import { watchMessages } from './core/watch.js';
import {
  getStatus,
  getStats,
  exportMessages,
  importMessages,
  garbageCollect,
} from './core/maintenance.js';
import {
  registerWorker,
  getWorker,
  listWorkers,
  updateWorker,
  removeWorker,
  discoverSession,
} from './core/workers.js';
import {
  readNewEvents,
  processEvents,
  buildSyncResult,
} from './core/reactor.js';
import { generateId } from './utils/ids.js';
import { now } from './utils/time.js';
import type {
  Channel,
  ChannelInfo,
  Message,
  PostOptions,
  ReplyOptions,
  UpdateOptions,
  ReadOptions,
  SearchOptions,
  SearchResult,
  WatchOptions,
  HubStatus,
  HubStats,
  Worker,
  WorkerStatus,
  RegisterWorkerOptions,
  WorkerSyncResult,
} from './core/types.js';

/**
 * Hub class - main entry point for Agents Hub
 */
export class Hub {
  private db: Database;
  private dbPath: string;

  /**
   * Create a Hub instance from an existing database
   * @param dbPath - Path to SQLite database file
   */
  constructor(dbPath: string) {
    this.dbPath = dbPath;
    this.db = openDatabase(dbPath);
    initSchema(this.db);
  }

  /**
   * Initialize a new Hub with metadata and default channels
   * @param dbPath - Path to SQLite database file
   * @param mode - Hub mode: 'single' for single-agent, 'multi' for multi-agent
   * @param hubId - Optional hub ID (auto-generated if not provided)
   * @returns Hub instance with initialized metadata
   */
  static init(
    dbPath: string,
    mode: 'single' | 'multi' = 'single',
    hubId?: string
  ): Hub {
    // Ensure parent directory exists
    const dir = dirname(dbPath);
    mkdirSync(dir, { recursive: true });

    // Create Hub instance (constructor handles DB open + schema init)
    const hub = new Hub(dbPath);

    // Insert hub metadata as key-value pairs
    const id = hubId ?? generateId();
    const createdAt = now();
    const insertMeta = hub.db.prepare('INSERT INTO hub_meta (key, value) VALUES (?, ?)');
    insertMeta.run('schema_version', '1.0');
    insertMeta.run('created_at', createdAt);
    insertMeta.run('mode', mode);
    insertMeta.run('hub_id', id);

    // Create #main channel (always present)
    createChannel(hub.db, '#main', {
      createdBy: 'system',
      description: 'Main communication channel',
    });

    // Create #general channel for multi-agent mode
    if (mode === 'multi') {
      createChannel(hub.db, '#general', {
        createdBy: 'system',
        description: 'General discussion and coordination',
      });
    }

    return hub;
  }

  // ============ Channel Methods ============

  /**
   * Create a new channel
   * @param name - Channel name (must start with #)
   * @param opts - Optional channel metadata
   * @returns Created channel
   */
  channelCreate(
    name: string,
    opts?: {
      description?: string;
      workerId?: string;
      createdBy?: string;
    }
  ): Channel {
    return createChannel(this.db, name, {
      createdBy: opts?.createdBy ?? 'unknown',
      description: opts?.description,
      workerId: opts?.workerId,
    });
  }

  /**
   * List all channels
   * @param includeStats - Include message counts and last activity
   * @returns Array of channels or channel info with stats
   */
  channelList(includeStats = false): Channel[] | ChannelInfo[] {
    return listChannels(this.db, includeStats);
  }

  // ============ Message Methods ============

  /**
   * Post a new message to a channel
   * Automatically creates the channel if it doesn't exist
   * @param opts - Message options
   * @returns Created message
   */
  post(opts: PostOptions): Message {
    // Ensure channel exists before posting
    ensureChannel(this.db, opts.channel, opts.author);
    return postMessage(this.db, opts);
  }

  /**
   * Reply to an existing message (creates threaded message)
   * @param threadId - ID of the message to reply to
   * @param opts - Reply options
   * @returns Created reply message
   */
  reply(threadId: string, opts: ReplyOptions): Message {
    return replyToMessage(this.db, threadId, opts);
  }

  /**
   * Update an existing message
   * @param id - Message ID
   * @param opts - Update options
   * @returns Updated message
   */
  update(id: string, opts: UpdateOptions): Message {
    return updateMessage(this.db, id, opts);
  }

  /**
   * Read messages with optional filtering
   * @param opts - Query options
   * @returns Paginated message results
   */
  read(opts?: ReadOptions): { messages: Message[]; total: number; hasMore: boolean } {
    return readMessages(this.db, opts);
  }

  /**
   * Read all messages in a thread
   * @param messageId - ID of any message in the thread
   * @returns Array of messages in chronological order
   */
  readThread(messageId: string): Message[] {
    return readThread(this.db, messageId);
  }

  // ============ Search & Watch ============

  /**
   * Full-text search across messages
   * @param query - FTS5 search query
   * @param opts - Search options
   * @returns Ranked search results
   */
  search(query: string, opts?: SearchOptions): SearchResult[] {
    return searchMessages(this.db, query, opts);
  }

  /**
   * Watch for new messages (async generator)
   * @param opts - Watch options
   * @returns Async generator yielding new messages
   */
  watch(opts?: WatchOptions): AsyncGenerator<Message> {
    return watchMessages(this.db, this.dbPath, opts);
  }

  // ============ Status & Maintenance ============

  /**
   * Get hub status overview
   * @returns Hub status with message counts and activity
   */
  status(): HubStatus {
    return getStatus(this.db);
  }

  /**
   * Export messages to NDJSON format
   * @param opts - Export options
   * @returns NDJSON string
   */
  export(opts?: {
    channel?: string;
    since?: string;
    format?: 'ndjson' | 'csv';
  }): string {
    return exportMessages(this.db, opts);
  }

  /**
   * Import messages from NDJSON format
   * @param ndjson - NDJSON string of messages
   * @returns Number of messages imported
   */
  import(ndjson: string): number {
    return importMessages(this.db, ndjson);
  }

  /**
   * Garbage collect old messages
   * @param olderThan - ISO timestamp (messages older than this will be removed)
   * @param dryRun - If true, only count without deleting
   * @returns Object with number of messages removed
   */
  gc(olderThan?: string, dryRun = false): { removed: number } {
    return garbageCollect(this.db, olderThan, dryRun);
  }

  /**
   * Get hub statistics
   * @returns Hub statistics including DB size and message counts
   */
  stats(): HubStats {
    return getStats(this.db, this.dbPath);
  }

  // ============ Worker Methods ============

  /**
   * Register a new worker
   */
  workerRegister(opts: RegisterWorkerOptions): Worker {
    return registerWorker(this.db, opts);
  }

  /**
   * Get a worker by ID
   */
  workerGet(id: string): Worker | null {
    return getWorker(this.db, id);
  }

  /**
   * List workers with optional status filter
   */
  workerList(opts?: { status?: WorkerStatus }): Worker[] {
    return listWorkers(this.db, opts);
  }

  /**
   * Sync a worker's events — reads new events from events.jsonl, updates counters and status
   */
  workerSync(id: string): WorkerSyncResult | null {
    const worker = getWorker(this.db, id);
    if (!worker) return null;

    // Lazy re-discovery: if eventsPath is missing, retry discoverSession
    if (!worker.eventsPath) {
      const session = discoverSession(id);
      if (!session) return null;
      updateWorker(this.db, id, { sessionId: session.sessionId, eventsPath: session.eventsPath });
      worker.eventsPath = session.eventsPath;
      worker.sessionId = session.sessionId;
    }

    const { events, newOffset } = readNewEvents(worker.eventsPath, worker.eventsOffset);
    if (events.length === 0) return buildSyncResult(id, events, processEvents([]), worker.status);

    const processed = processEvents(events);
    const result = buildSyncResult(id, events, processed, worker.status);

    // Update worker state
    const updates: Partial<{
      eventsOffset: number;
      toolCalls: number;
      turns: number;
      errors: number;
      lastEventAt: string;
      lastEventType: string;
      status: WorkerStatus;
      exitCode: number;
      completedAt: string;
    }> = {
      eventsOffset: newOffset,
      toolCalls: worker.toolCalls + processed.toolCalls,
      turns: worker.turns + processed.turns,
      errors: worker.errors + processed.errors,
    };

    if (processed.lastEventAt) updates.lastEventAt = processed.lastEventAt;
    if (processed.lastEventType) updates.lastEventType = processed.lastEventType;

    if (processed.terminalStatus) {
      updates.status = processed.terminalStatus;
      if (processed.exitCode !== null && processed.exitCode !== undefined) {
        updates.exitCode = processed.exitCode;
      }
      if (processed.lastEventAt) {
        updates.completedAt = processed.lastEventAt;
      }
    }

    updateWorker(this.db, id, updates);

    return result;
  }

  /**
   * Sync all active workers
   */
  workerSyncAll(): WorkerSyncResult[] {
    const workers = listWorkers(this.db, { status: 'active' });
    return workers.map(w => this.workerSync(w.id)).filter((r): r is WorkerSyncResult => r !== null);
  }

  /**
   * Remove a worker
   */
  workerRemove(id: string): boolean {
    return removeWorker(this.db, id);
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }
}
