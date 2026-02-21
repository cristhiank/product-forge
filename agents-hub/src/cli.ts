/**
 * CLI for Agents Hub using Commander.js
 * All commands output JSON to stdout
 */

import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { Hub } from './hub.js';
import { HubSDK } from './sdk.js';
import type { PostOptions, ReplyOptions, UpdateOptions, ReadOptions, SearchOptions, WatchOptions } from './core/types.js';

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

/**
 * Main CLI function
 */
export function runCli(): void {
  const program = new Command();

  program
    .name('hub')
    .description('Agents Hub CLI - Distributed communication for AI agents')
    .version('1.0.0')
    .option('--db <path>', 'Database path', '.devpartner/hub.db')
    .option('--pretty', 'Pretty-print JSON output', false);

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

  // Parse arguments
  program.parse();
}
