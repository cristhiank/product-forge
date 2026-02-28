# agents-hub — Technical Architecture

## Project Structure

```
agents-hub/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── SKILL.md                    ← Published to ~/.copilot/skills/agents-hub/
├── publish-skill.sh            ← Copies SKILL.md + scripts/ to skill dir
├── specs/                      ← This directory (design specs)
│   ├── 00-vision.md
│   ├── 01-data-model.md
│   ├── 02-cli-api.md
│   ├── 03-concurrency.md
│   ├── 04-protocols.md
│   ├── 05-skill-definition.md
│   ├── 06-migration.md
│   └── 07-architecture.md
├── references/                 ← Published alongside SKILL.md
│   ├── api-reference.md        ← Complete CLI reference
│   └── examples.md             ← Workflow examples
├── scripts/
│   └── hub.js                  ← Compiled CLI entry point (used by agents)
├── src/
│   ├── index.ts                ← Library entry point
│   ├── cli.ts                  ← CLI argument parser + dispatcher
│   ├── db/
│   │   ├── connection.ts       ← SQLite connection factory (WAL mode)
│   │   ├── schema.ts           ← Table creation, migrations
│   │   └── migrations/         ← Schema versioning
│   ├── core/
│   │   ├── types.ts            ← Message, Channel, HubMeta types
│   │   ├── messages.ts         ← CRUD operations on messages
│   │   ├── channels.ts         ← Channel management
│   │   ├── search.ts           ← FTS5 search + future semantic search
│   │   └── watch.ts            ← fs.watch-based real-time notifications
│   ├── hub.ts                  ← Hub class — main API facade
│   └── utils/
│       ├── ids.ts              ← UUID generation
│       ├── time.ts             ← ISO-8601 helpers
│       └── json.ts             ← Safe JSON parse/stringify
├── test/
│   ├── unit/
│   │   ├── messages.test.ts
│   │   ├── channels.test.ts
│   │   ├── search.test.ts
│   │   └── watch.test.ts
│   ├── integration/
│   │   ├── cli.test.ts         ← End-to-end CLI tests
│   │   ├── concurrency.test.ts ← Multi-process write tests
│   │   └── protocols.test.ts   ← Full workflow protocol tests
│   └── fixtures/
│       └── seed.ts             ← Test data generators
└── dist/                       ← Compiled output
    └── scripts/
        └── hub.js              ← Entry point for agents
```

## Technology Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Language | TypeScript | Consistent with agents-board, type safety |
| Runtime | Node.js 20+ | Available in Copilot CLI environment |
| Database | better-sqlite3 | Synchronous API (simpler for CLI), WAL support, fast |
| Search | FTS5 (built into SQLite) | No external deps, BM25 ranking |
| CLI Parser | Commander.js or yargs | Battle-tested, auto-help |
| Testing | Vitest | Fast, ESM support, consistent with agents-board |
| Build | tsup or esbuild | Fast, bundles to single file |

## Key Classes

### Hub (facade)

```typescript
class Hub {
  constructor(dbPath: string);

  // Lifecycle
  static init(dbPath: string, mode: 'single' | 'multi'): Hub;

  // Channels
  channelCreate(name: string, opts?: { description?: string; workerId?: string }): Channel;
  channelList(includeStats?: boolean): ChannelInfo[];

  // Messages
  post(opts: PostOptions): Message;
  reply(threadId: string, opts: ReplyOptions): Message;
  update(id: string, opts: UpdateOptions): Message;
  read(opts: ReadOptions): { messages: Message[]; total: number; hasMore: boolean };
  readThread(messageId: string): Message[];

  // Search
  search(query: string, opts?: SearchOptions): SearchResult[];

  // Watch
  watch(opts: WatchOptions): AsyncGenerator<Message>;

  // Status
  status(channel?: string): HubStatus;

  // Maintenance
  export(opts?: ExportOptions): string;  // NDJSON
  import(ndjson: string): number;        // returns count
  gc(olderThan?: string): { removed: number };
  stats(): HubStats;
}
```

### Message Types

```typescript
interface Message {
  id: string;
  channel: string;
  type: 'note' | 'decision' | 'request' | 'status';
  author: string;
  content: string;
  tags: string[];
  threadId: string | null;
  metadata: Record<string, unknown>;
  workerId: string | null;
  createdAt: string;
  updatedAt: string | null;
}

interface PostOptions {
  channel: string;
  type: Message['type'];
  author: string;
  content: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  workerId?: string;
}

interface ReadOptions {
  channel?: string;
  type?: Message['type'];
  author?: string;
  tags?: string[];
  since?: string;
  until?: string;
  limit?: number;
  offset?: number;
  threadId?: string;
  unresolved?: boolean;
  workerId?: string;
}

interface SearchResult extends Message {
  rank: number;
  highlightedContent?: string;
}

interface WatchOptions {
  channel?: string;
  type?: Message['type'];
  timeout?: number;  // seconds
  count?: number;    // return after N messages
}
```

## Build & Distribution

### Build Pipeline

```bash
# Development
npm run dev          # Watch mode with tsup
npm run test         # Vitest
npm run test:watch   # Vitest watch mode

# Build
npm run build        # tsup → dist/

# Publish skill
./publish-skill.sh   # Copies SKILL.md + scripts/hub.js + references/ to ~/.copilot/skills/agents-hub/
```

### Published Skill Layout

```
~/.copilot/skills/agents-hub/
├── SKILL.md                    ← Skill definition (triggers, quick reference)
├── scripts/
│   └── hub.js                  ← Compiled CLI (agents invoke this)
├── references/
│   ├── api-reference.md        ← Full CLI reference
│   └── examples.md             ← Workflow examples
└── node_modules/               ← Bundled dependencies (better-sqlite3)
```

## Performance Targets

| Operation | Target | Notes |
|-----------|--------|-------|
| `hub post` | <50ms | Single INSERT + FTS trigger |
| `hub read` (50 messages) | <20ms | Indexed query |
| `hub search` | <100ms | FTS5 BM25 ranking |
| `hub status` | <30ms | Aggregate queries |
| `hub watch` latency | <500ms | fs.watch + query |
| Database size (1000 messages) | <5MB | Text-heavy content |

## Security Considerations

- **No secrets in messages**: Constitution rule carries over. Agents must not post credentials.
- **No SQL injection**: All queries use parameterized statements via better-sqlite3.
- **File permissions**: hub.db is created with user-only permissions (0600).
- **No network**: agents-hub is purely local. No HTTP server, no network communication.
