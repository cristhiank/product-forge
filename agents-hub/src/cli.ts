/**
 * CLI for Agents Hub using Commander.js
 * All commands output JSON to stdout
 */

import { Command } from 'commander';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { Hub } from './hub.js';
import { HubSDK } from './sdk.js';
import { detectHealth } from './core/reactor.js';
import type { PostOptions, ReplyOptions, UpdateOptions, ReadOptions, SearchOptions, WatchOptions, RegisterWorkerOptions, WorkerStatus, WorkerSyncResult } from './core/types.js';

/**
 * Resolve the default database path using .git/devpartner/hub.db
 * Uses git rev-parse --git-common-dir so all worktrees share the same DB.
 * Falls back to .devpartner/hub.db if not inside a git repo.
 */
function resolveDefaultDbPath(): string {
  try {
    const gitCommonDir = execSync('git rev-parse --git-common-dir', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    const dir = join(resolve(gitCommonDir), 'devpartner');
    mkdirSync(dir, { recursive: true });
    return join(dir, 'hub.db');
  } catch {
    return '.devpartner/hub.db';
  }
}

/**
 * Migrate legacy .devpartner/hub.db to new .git/devpartner/hub.db location.
 * Moves db, wal, and shm files atomically and leaves a tombstone.
 */
function migrateIfNeeded(newDbPath: string): void {
  try {
    const topLevel = execSync('git rev-parse --show-toplevel', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    const legacyDb = join(topLevel, '.devpartner', 'hub.db');

    if (existsSync(legacyDb) && !existsSync(newDbPath)) {
      mkdirSync(dirname(newDbPath), { recursive: true });
      for (const ext of ['', '-wal', '-shm']) {
        const src = legacyDb + ext;
        if (existsSync(src)) renameSync(src, newDbPath + ext);
      }
      writeFileSync(
        legacyDb + '.migrated',
        `Migrated to ${newDbPath} on ${new Date().toISOString()}\n`,
      );
      console.error(`[hub] Migrated database to ${newDbPath}`);
    }
  } catch {
    // Migration is best-effort
  }
}

/**
 * Output JSON to stdout
 */
function output(data: unknown, pretty: boolean): void {
  console.log(JSON.stringify(data, null, pretty ? 2 : undefined));
}

/**
 * Handle errors and exit
 */
function handleError(err: unknown): never {
  const message = err instanceof Error ? err.message : String(err);
  console.log(JSON.stringify({ error: message }));
  process.exit(1);
}

/**
 * Parse JSON string with error handling
 */
function parseJson<T>(str: string, field: string): T {
  try {
    return JSON.parse(str) as T;
  } catch {
    throw new Error(`Invalid JSON for ${field}: ${str}`);
  }
}

/**
 * Parse comma-separated tags
 */
function parseTags(str: string): string[] {
  return str.split(',').map(t => t.trim()).filter(Boolean);
}

function describeWorkerSyncResult(result: WorkerSyncResult): string {
  if (result.ok) return 'Worker synced successfully';
  switch (result.syncStatus) {
    case 'no_worker':
      return `Worker not found: ${result.workerId}`;
    case 'no_events_path':
      return `No events path available for worker: ${result.workerId}`;
    case 'events_missing':
      return `Events file missing for worker: ${result.workerId}`;
    case 'parse_error':
      return `Unable to parse events for worker: ${result.workerId}`;
    default:
      return result.error ?? `Worker sync failed: ${result.workerId}`;
  }
}

/**
 * Main CLI function
 */
export function runCli(): void {
  const program = new Command();

  program
    .name('hub')
    .description('Agents Hub CLI - Distributed communication for AI agents')
    .version('1.0.0')
    .option('--db <path>', 'Database path (default: .git/devpartner/hub.db)')
    .option('--pretty', 'Pretty-print JSON output', false)
    .hook('preAction', () => {
      if (!program.opts().db) {
        const resolved = resolveDefaultDbPath();
        migrateIfNeeded(resolved);
        program.setOptionValue('db', resolved);
      }
    });

  // ============ init command ============
  program
    .command('init')
    .description('Initialize a new hub')
    .option('--mode <mode>', 'Hub mode: single or multi', 'single')
    .option('--hub-id <uuid>', 'Hub ID (auto-generated if not provided)')
    .action((opts) => {
      try {
        const dbPath = program.opts().db;
        const mode = opts.mode === 'multi' ? 'multi' : 'single';
        const hub = Hub.init(dbPath, mode, opts.hubId);
        const status = hub.status();
        const channels = hub.channelList();
        hub.close();

        output({
          hub_id: status.hubId,
          mode: status.mode,
          db_path: dbPath,
          channels: channels.map(c => c.name),
        }, program.opts().pretty);
      } catch (err) {
        handleError(err);
      }
    });

  // ============ channel commands ============
  const channel = program.command('channel').description('Channel management');

  channel
    .command('create')
    .description('Create a new channel')
    .argument('<name>', 'Channel name (must start with #)')
    .option('--description <text>', 'Channel description')
    .option('--worker-id <id>', 'Worker ID')
    .action((name, opts) => {
      try {
        const dbPath = program.opts().db;
        const hub = new Hub(dbPath);
        const result = hub.channelCreate(name, {
          description: opts.description,
          workerId: opts.workerId,
        });
        hub.close();
        output(result, program.opts().pretty);
      } catch (err) {
        handleError(err);
      }
    });

  channel
    .command('list')
    .description('List all channels')
    .option('--include-stats', 'Include message counts and last activity', false)
    .action((opts) => {
      try {
        const dbPath = program.opts().db;
        const hub = new Hub(dbPath);
        const channels = hub.channelList(opts.includeStats);
        hub.close();
        output({ channels }, program.opts().pretty);
      } catch (err) {
        handleError(err);
      }
    });

  // ============ post command ============
  program
    .command('post')
    .description('Post a new message to a channel')
    .requiredOption('--channel <name>', 'Channel name')
    .requiredOption('--type <type>', 'Message type: note, decision, request, status')
    .requiredOption('--author <role>', 'Author role')
    .requiredOption('--content <text>', 'Message content')
    .option('--tags <json>', 'Tags as JSON array (e.g., \'["auth","security"]\')')
    .option('--metadata <json>', 'Metadata as JSON object')
    .option('--worker-id <id>', 'Worker ID')
    .action((opts) => {
      try {
        const dbPath = program.opts().db;
        const hub = new Hub(dbPath);

        const postOpts: PostOptions = {
          channel: opts.channel,
          type: opts.type,
          author: opts.author,
          content: opts.content,
        };

        if (opts.tags) {
          postOpts.tags = parseJson<string[]>(opts.tags, 'tags');
        }
        if (opts.metadata) {
          postOpts.metadata = parseJson<Record<string, unknown>>(opts.metadata, 'metadata');
        }
        if (opts.workerId) {
          postOpts.workerId = opts.workerId;
        }

        const message = hub.post(postOpts);
        hub.close();

        output({
          id: message.id,
          channel: message.channel,
          type: message.type,
          created_at: message.createdAt,
        }, program.opts().pretty);
      } catch (err) {
        handleError(err);
      }
    });

  // ============ reply command ============
  program
    .command('reply')
    .description('Reply to an existing message')
    .requiredOption('--thread <message-id>', 'ID of the message to reply to')
    .requiredOption('--author <role>', 'Author role')
    .requiredOption('--content <text>', 'Reply content')
    .option('--tags <json>', 'Tags as JSON array')
    .option('--metadata <json>', 'Metadata as JSON object')
    .option('--type <type>', 'Message type (overrides parent type)')
    .action((opts) => {
      try {
        const dbPath = program.opts().db;
        const hub = new Hub(dbPath);

        const replyOpts: ReplyOptions = {
          author: opts.author,
          content: opts.content,
        };

        if (opts.tags) {
          replyOpts.tags = parseJson<string[]>(opts.tags, 'tags');
        }
        if (opts.metadata) {
          replyOpts.metadata = parseJson<Record<string, unknown>>(opts.metadata, 'metadata');
        }
        if (opts.type) {
          replyOpts.type = opts.type;
        }

        const message = hub.reply(opts.thread, replyOpts);
        hub.close();

        output({
          id: message.id,
          channel: message.channel,
          type: message.type,
          created_at: message.createdAt,
        }, program.opts().pretty);
      } catch (err) {
        handleError(err);
      }
    });

  // ============ read command ============
  program
    .command('read')
    .description('Read messages with optional filtering')
    .option('--channel <name>', 'Filter by channel')
    .option('--type <type>', 'Filter by message type')
    .option('--author <role>', 'Filter by author')
    .option('--tags <t1,t2>', 'Filter by tags (comma-separated)')
    .option('--since <iso>', 'Filter by timestamp (ISO 8601)')
    .option('--until <iso>', 'Filter by timestamp (ISO 8601)')
    .option('--limit <n>', 'Limit number of results', parseInt)
    .option('--offset <n>', 'Offset for pagination', parseInt)
    .option('--thread <id>', 'Filter by thread ID')
    .option('--unresolved', 'Show only unresolved requests', false)
    .option('--worker-id <id>', 'Filter by worker ID')
    .action((opts) => {
      try {
        const dbPath = program.opts().db;
        const hub = new Hub(dbPath);

        const readOpts: ReadOptions = {};

        if (opts.channel) readOpts.channel = opts.channel;
        if (opts.type) readOpts.type = opts.type;
        if (opts.author) readOpts.author = opts.author;
        if (opts.tags) readOpts.tags = parseTags(opts.tags);
        if (opts.since) readOpts.since = opts.since;
        if (opts.until) readOpts.until = opts.until;
        if (opts.limit) readOpts.limit = opts.limit;
        if (opts.offset) readOpts.offset = opts.offset;
        if (opts.thread) readOpts.threadId = opts.thread;
        if (opts.unresolved) readOpts.unresolved = true;
        if (opts.workerId) readOpts.workerId = opts.workerId;

        const result = hub.read(readOpts);
        hub.close();

        output({
          messages: result.messages,
          total: result.total,
          has_more: result.hasMore,
        }, program.opts().pretty);
      } catch (err) {
        handleError(err);
      }
    });

  // ============ read-thread command ============
  program
    .command('read-thread')
    .description('Read all messages in a thread')
    .argument('<message-id>', 'ID of any message in the thread')
    .action((messageId) => {
      try {
        const dbPath = program.opts().db;
        const hub = new Hub(dbPath);
        const messages = hub.readThread(messageId);
        hub.close();
        output({ messages }, program.opts().pretty);
      } catch (err) {
        handleError(err);
      }
    });

  // ============ search command ============
  program
    .command('search')
    .description('Full-text search across messages')
    .argument('<query>', 'Search query (FTS5 syntax)')
    .option('--channel <name>', 'Filter by channel')
    .option('--type <type>', 'Filter by message type')
    .option('--tags <t1,t2>', 'Filter by tags (comma-separated)')
    .option('--limit <n>', 'Limit number of results', parseInt)
    .option('--since <iso>', 'Filter by timestamp (ISO 8601)')
    .action((query, opts) => {
      try {
        const dbPath = program.opts().db;
        const hub = new Hub(dbPath);

        const searchOpts: SearchOptions = {};

        if (opts.channel) searchOpts.channel = opts.channel;
        if (opts.type) searchOpts.type = opts.type;
        if (opts.tags) searchOpts.tags = parseTags(opts.tags);
        if (opts.limit) searchOpts.limit = opts.limit;
        if (opts.since) searchOpts.since = opts.since;

        const results = hub.search(query, searchOpts);
        hub.close();

        output({ results, total: results.length }, program.opts().pretty);
      } catch (err) {
        handleError(err);
      }
    });

  // ============ watch command ============
  program
    .command('watch')
    .description('Watch for new messages (NDJSON output)')
    .option('--channel <name>', 'Filter by channel')
    .option('--type <type>', 'Filter by message type')
    .option('--timeout <seconds>', 'Timeout in seconds (0 = forever)', parseInt)
    .option('--count <n>', 'Number of messages to wait for', parseInt)
    .action(async (opts) => {
      try {
        const dbPath = program.opts().db;
        const hub = new Hub(dbPath);

        const watchOpts: WatchOptions = {};

        if (opts.channel) watchOpts.channel = opts.channel;
        if (opts.type) watchOpts.type = opts.type;
        if (opts.timeout !== undefined) watchOpts.timeout = opts.timeout;
        if (opts.count) watchOpts.count = opts.count;

        const watcher = hub.watch(watchOpts);

        for await (const message of watcher) {
          // Output each message as a JSON line (NDJSON)
          console.log(JSON.stringify(message));
        }

        hub.close();
      } catch (err) {
        handleError(err);
      }
    });

  // ============ status command ============
  program
    .command('status')
    .description('Get hub status overview')
    .option('--channel <name>', 'Get status for specific channel')
    .action((opts) => {
      try {
        const dbPath = program.opts().db;
        const hub = new Hub(dbPath);
        const status = hub.status();
        hub.close();

        if (opts.channel) {
          // Filter to specific channel
          const channelData = status.channels[opts.channel];
          if (!channelData) {
            throw new Error(`Channel not found: ${opts.channel}`);
          }
          output({
            hubId: status.hubId,
            mode: status.mode,
            channel: opts.channel,
            ...channelData,
          }, program.opts().pretty);
        } else {
          output(status, program.opts().pretty);
        }
      } catch (err) {
        handleError(err);
      }
    });

  // ============ update command ============
  program
    .command('update')
    .description('Update an existing message')
    .argument('<message-id>', 'Message ID to update')
    .option('--content <text>', 'New content')
    .option('--metadata <json>', 'Metadata as JSON object (merged)')
    .option('--tags <json>', 'Tags as JSON array')
    .action((messageId, opts) => {
      try {
        const dbPath = program.opts().db;
        const hub = new Hub(dbPath);

        const updateOpts: UpdateOptions = {};

        if (opts.content) updateOpts.content = opts.content;
        if (opts.metadata) {
          updateOpts.metadata = parseJson<Record<string, unknown>>(opts.metadata, 'metadata');
        }
        if (opts.tags) {
          updateOpts.tags = parseJson<string[]>(opts.tags, 'tags');
        }

        const message = hub.update(messageId, updateOpts);
        hub.close();

        output(message, program.opts().pretty);
      } catch (err) {
        handleError(err);
      }
    });

  // ============ export command ============
  program
    .command('export')
    .description('Export messages to NDJSON format')
    .option('--channel <name>', 'Export specific channel')
    .option('--since <iso>', 'Export messages since timestamp')
    .option('--format <format>', 'Export format: ndjson or csv', 'ndjson')
    .action((opts) => {
      try {
        const dbPath = program.opts().db;
        const hub = new Hub(dbPath);

        const exportOpts: { channel?: string; since?: string; format?: 'ndjson' | 'csv' } = {};

        if (opts.channel) exportOpts.channel = opts.channel;
        if (opts.since) exportOpts.since = opts.since;
        if (opts.format) exportOpts.format = opts.format;

        const ndjson = hub.export(exportOpts);
        hub.close();

        // Output raw NDJSON string (not as JSON)
        console.log(ndjson);
      } catch (err) {
        handleError(err);
      }
    });

  // ============ import command ============
  program
    .command('import')
    .description('Import messages from NDJSON file')
    .argument('<file>', 'Path to NDJSON file')
    .action((file) => {
      try {
        const dbPath = program.opts().db;
        const ndjson = readFileSync(file, 'utf-8');
        const hub = new Hub(dbPath);
        const imported = hub.import(ndjson);
        hub.close();

        output({ imported }, program.opts().pretty);
      } catch (err) {
        handleError(err);
      }
    });

  // ============ gc command ============
  program
    .command('gc')
    .description('Garbage collect old messages')
    .option('--older-than <duration>', 'ISO timestamp (remove messages older than this)')
    .option('--dry-run', 'Count without deleting', false)
    .action((opts) => {
      try {
        const dbPath = program.opts().db;
        const hub = new Hub(dbPath);
        const result = hub.gc(opts.olderThan, opts.dryRun);
        hub.close();

        output({ removed: result.removed }, program.opts().pretty);
      } catch (err) {
        handleError(err);
      }
    });

  // ============ stats command ============
  program
    .command('stats')
    .description('Get hub statistics')
    .action(() => {
      try {
        const dbPath = program.opts().db;
        const hub = new Hub(dbPath);
        const stats = hub.stats();
        hub.close();

        output(stats, program.opts().pretty);
      } catch (err) {
        handleError(err);
      }
    });

  // ============ exec command ============
  program
    .command('exec')
    .description('Execute JavaScript code with Hub and SDK pre-loaded')
    .argument('<code>', 'JavaScript code to evaluate (hub and sdk are in scope)')
    .option('--channel <name>', 'Default channel for SDK operations')
    .option('--author <role>', 'Default author for SDK operations')
    .action(async (code, opts) => {
      let hub: Hub | undefined;
      try {
        const dbPath = program.opts().db;
        hub = new Hub(dbPath);
        const sdk = new HubSDK(hub, {
          channel: opts.channel,
          author: opts.author,
        });

        // Build async function with hub and sdk in scope
        const fn = new Function(
          'hub', 'sdk',
          `return (async () => { ${code} })();`,
        ) as (hub: Hub, sdk: HubSDK) => Promise<unknown>;

        const result = await fn(hub, sdk);

        if (result !== undefined) {
          output(result, program.opts().pretty);
        }
        hub.close();
      } catch (err) {
        hub?.close();
        handleError(err);
      }
    });

  // ============ worker commands ============
  const worker = program.command('worker').description('Worker management and observability');

  worker
    .command('register')
    .description('Register a new worker')
    .requiredOption('--id <id>', 'Worker ID')
    .option('--channel <name>', 'Hub channel (default: #worker-{id})')
    .option('--agent-type <type>', 'Agent type (e.g., scout, executor)')
    .option('--agent-name <name>', 'Human-readable agent name')
    .option('--worktree <path>', 'Path to worktree')
    .option('--pid <n>', 'Process ID', parseInt)
    .option('--metadata <json>', 'Metadata as JSON object')
    .action((opts) => {
      try {
        const dbPath = program.opts().db;
        const hub = new Hub(dbPath);
        const regOpts: RegisterWorkerOptions = {
          id: opts.id,
          channel: opts.channel,
          agentType: opts.agentType,
          agentName: opts.agentName,
          worktreePath: opts.worktree,
          pid: opts.pid,
        };
        if (opts.metadata) {
          regOpts.metadata = parseJson<Record<string, unknown>>(opts.metadata, 'metadata');
        }
        const result = hub.workerRegister(regOpts);
        hub.close();
        output(result, program.opts().pretty);
      } catch (err) {
        handleError(err);
      }
    });

  worker
    .command('list')
    .description('List workers')
    .option('--status <status>', 'Filter by status (active, completed, failed, lost)')
    .action((opts) => {
      try {
        const dbPath = program.opts().db;
        const hub = new Hub(dbPath);
        const workers = hub.workerList(opts.status ? { status: opts.status as WorkerStatus } : undefined);
        hub.close();
        output({ workers }, program.opts().pretty);
      } catch (err) {
        handleError(err);
      }
    });

  worker
    .command('status')
    .description('Get detailed worker status')
    .argument('<id>', 'Worker ID')
    .option('--sync', 'Sync events before showing status', true)
    .action((id, opts) => {
      try {
        const dbPath = program.opts().db;
        const hub = new Hub(dbPath);
        const syncResult = opts.sync ? hub.workerSync(id) : null;
        const w = hub.workerGet(id);
        hub.close();
        if (syncResult && syncResult.syncStatus === 'no_worker') {
          throw new Error(describeWorkerSyncResult(syncResult));
        }
        if (!w) throw new Error(`Worker not found: ${id}`);
        output({
          ...w,
          health: detectHealth(w.lastEventAt),
          sync: syncResult ? {
            ok: syncResult.ok,
            status: syncResult.syncStatus,
            message: describeWorkerSyncResult(syncResult),
          } : undefined,
        }, program.opts().pretty);
      } catch (err) {
        handleError(err);
      }
    });

  worker
    .command('sync')
    .description('Sync worker events from events.jsonl')
    .option('--id <id>', 'Sync specific worker (default: sync all active)')
    .action((opts) => {
      try {
        const dbPath = program.opts().db;
        const hub = new Hub(dbPath);
        if (opts.id) {
          const result = hub.workerSync(opts.id);
          hub.close();
          output({
            ...result,
            message: describeWorkerSyncResult(result),
          }, program.opts().pretty);
        } else {
          const results = hub.workerSyncAll();
          hub.close();
          output({
            synced: results.map(result => ({
              ...result,
              message: describeWorkerSyncResult(result),
            })),
          }, program.opts().pretty);
        }
      } catch (err) {
        handleError(err);
      }
    });

  // ============ serve command ============
  program
    .command('serve')
    .description('Start real-time web dashboard for agent communications')
    .option('--port <number>', 'Port to listen on', '3000')
    .action(async (opts) => {
      let hub: Hub | undefined;
      try {
        const dbPath = program.opts().db;
        hub = new Hub(dbPath);
        const { startServer } = await import('./serve/server.js');
        await startServer({ port: parseInt(opts.port, 10), hub });
      } catch (err) {
        hub?.close();
        handleError(err);
      }
    });

  // Parse arguments
  program.parse();
}
