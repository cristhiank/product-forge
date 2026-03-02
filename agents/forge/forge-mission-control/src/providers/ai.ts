import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { CopilotClient, defineTool, approveAll } from '@github/copilot-sdk';

export interface ChatSession {
  sessionId: string;
  scope: 'product' | 'feature' | 'doc';
  contextId?: string;
}

export interface AIStreamEvent {
  type: 'delta' | 'done' | 'error' | 'tool_call';
  content?: string;
  error?: string;
  toolName?: string;
  toolArgs?: unknown;
}

export class AIProvider {
  private client: CopilotClient | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sessions = new Map<string, { sdkSession: any; chunks: string[]; done: boolean; error: string | null }>();

  constructor(private readonly repoRoot: string = '', private readonly productName = 'your product') {}

  async initialize(): Promise<boolean> {
    try {
      this.client = new CopilotClient();
      return true;
    } catch {
      return false;
    }
  }

  // ── Chat session management ──────────────────────────────────────────────

  async createChatSession(
    scope: 'product' | 'feature' | 'doc',
    contextId?: string,
    docContent?: string,
  ): Promise<ChatSession> {
    if (!this.client) throw new Error('AI not initialized');

    const sessionId = `forge-chat-${scope}${contextId ? `-${contextId}` : ''}-${Date.now()}`;
    const systemMessage = this.buildSystemMessage(scope, contextId, docContent);

    const tools = this.repoRoot ? this.createProductTools() : [];

    const sdkSession = await this.client.createSession({
      model: 'claude-sonnet-4.6',
      streaming: true,
      tools,
      onPermissionRequest: approveAll,
      systemMessage: { mode: 'replace', content: systemMessage },
    });

    const state = { sdkSession, chunks: [] as string[], done: false, error: null as string | null };
    this.sessions.set(sessionId, state);

    sdkSession.on('assistant.message_delta', (event: { data: { deltaContent?: string } }) => {
      if (event.data.deltaContent) state.chunks.push(event.data.deltaContent);
    });
    sdkSession.on('session.idle', () => { state.done = true; });
    sdkSession.on('session.error', (event: { data?: { message?: string } }) => {
      state.error = String(event.data?.message ?? event);
      state.done = true;
    });

    return { sessionId, scope, contextId };
  }

  async *sendMessage(sessionId: string, message: string): AsyncGenerator<AIStreamEvent> {
    const state = this.sessions.get(sessionId);
    if (!state) {
      yield { type: 'error', error: `Session not found: ${sessionId}` };
      return;
    }

    // Reset state for this turn
    state.chunks = [];
    state.done = false;
    state.error = null;

    // Fire without top-level await so events stream in parallel
    state.sdkSession.sendAndWait({ prompt: message }).catch(() => {/* errors come via session.error event */});

    while (!state.done) {
      await new Promise<void>((r) => setTimeout(r, 30));
      while (state.chunks.length > 0) {
        yield { type: 'delta', content: state.chunks.shift()! };
      }
    }

    // Drain any remaining chunks
    while (state.chunks.length > 0) {
      yield { type: 'delta', content: state.chunks.shift()! };
    }

    if (state.error) {
      yield { type: 'error', error: state.error };
    } else {
      yield { type: 'done' };
    }
  }

  destroySession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  // ── Product-hub tools ────────────────────────────────────────────────────

  private resolveCliPath(): string | null {
    const candidates = [
      resolve(import.meta.dirname, '../../../product-hub/scripts/index.js'),
      resolve(import.meta.dirname, '../../../product-hub/dist/cli.js'),
      resolve(import.meta.dirname, '../../../product-hub/dist/index.js'),
    ];
    return candidates.find((c) => existsSync(c)) ?? null;
  }

  private createProductTools() {
    const cliPath = this.resolveCliPath();
    if (!cliPath) return [];

    const repoRoot = this.repoRoot;
    const runCli = (args: string[]): string => {
      const result = spawnSync('node', [cliPath, ...args], {
        cwd: repoRoot,
        encoding: 'utf-8',
        timeout: 10_000,
      });
      return result.stdout?.trim() ?? result.stderr?.trim() ?? '';
    };

    return [
      defineTool('read_product_doc', {
        description: "Read a product document by its path (e.g., 'vision/VISION.md', 'features/F-003_pricing_page.md')",
        parameters: {
          type: 'object',
          properties: { path: { type: 'string', description: 'Document path relative to .product/' } },
          required: ['path'],
        },
        handler: async (args: { path: string }) => runCli(['read', args.path]),
      }),

      defineTool('list_product_docs', {
        description: 'List all product documents, optionally filtered by type (feature, brand, strategy, customer, vision)',
        parameters: {
          type: 'object',
          properties: { type: { type: 'string', description: 'Optional doc type filter' } },
        },
        handler: async (args: { type?: string }) => {
          const cmdArgs = ['list'];
          if (args.type) cmdArgs.push('--type', args.type);
          return runCli(cmdArgs);
        },
      }),

      defineTool('search_product_docs', {
        description: 'Search product documents by keyword query',
        parameters: {
          type: 'object',
          properties: { query: { type: 'string', description: 'Search query' } },
          required: ['query'],
        },
        handler: async (args: { query: string }) => runCli(['search', args.query]),
      }),

      defineTool('get_feature_overview', {
        description: 'Get the feature pipeline overview showing which features are in each stage',
        parameters: { type: 'object', properties: {} },
        handler: async () => runCli(['feature', 'overview']),
      }),

      defineTool('get_product_health', {
        description: 'Get product health report including stale docs, orphaned features, and draft count',
        parameters: { type: 'object', properties: {} },
        handler: async () => runCli(['health']),
      }),

      defineTool('get_product_meta', {
        description: 'Get product metadata (name, stage, version, description, north star metric)',
        parameters: { type: 'object', properties: {} },
        handler: async () => runCli(['meta']),
      }),
    ];
  }

  // ── System messages ──────────────────────────────────────────────────────

  private buildSystemMessage(scope: string, contextId?: string, docContent?: string): string {
    const base = `You are a Product Management assistant for the "${this.productName}" product. You help refine specs, analyze features, answer product questions, and improve documentation.

You have access to the product hub with tools to read docs, search, list features, and check health. Use these tools to ground your answers in actual product data.

When asked to write or improve content, provide markdown that can be directly inserted into the document. Always be specific and use the product's actual terminology, features, and context.`;

    if (scope === 'feature' && docContent) {
      return `${base}\n\nYou are currently working on feature ${contextId}. Here is the current spec:\n\n---\n${docContent.slice(0, 8000)}\n---\n\nHelp the user refine this spec. When suggesting changes, output clean markdown sections that can be inserted.`;
    }

    if (scope === 'doc' && docContent) {
      return `${base}\n\nYou are currently helping refine the document at ${contextId}. Here is the current content:\n\n---\n${docContent.slice(0, 8000)}\n---\n\nHelp improve this document. When suggesting changes, output clean markdown.`;
    }

    return `${base}\n\nYou are in product-wide mode. Use the product tools to explore features, docs, and health data before answering questions. Help with cross-cutting product decisions, strategy, and planning.`;
  }

  async *streamCompletion(prompt: string): AsyncGenerator<AIStreamEvent> {
    if (!this.client) {
      yield { type: 'error', error: 'AI not initialized' };
      return;
    }

    const chunks: string[] = [];
    let done = false;
    let error: string | null = null;

    const session = await this.client.createSession({
      model: 'claude-sonnet-4.6',
      streaming: true,
      onPermissionRequest: approveAll,
    });

    session.on('assistant.message_delta', (event) => {
      if (event.data.deltaContent) chunks.push(event.data.deltaContent);
    });
    session.on('session.idle', () => { done = true; });
    session.on('session.error', (event) => { error = String(event.data?.message ?? event); done = true; });

    // Send and don't await here — events fire as it streams
    const sendPromise = session.sendAndWait({ prompt }).catch(() => {});

    while (!done) {
      await new Promise<void>(r => setTimeout(r, 30));
      while (chunks.length > 0) {
        yield { type: 'delta', content: chunks.shift()! };
      }
    }

    // Drain remaining chunks
    while (chunks.length > 0) {
      yield { type: 'delta', content: chunks.shift()! };
    }

    await sendPromise;

    if (error) {
      yield { type: 'error', error };
    } else {
      yield { type: 'done' };
    }
  }

  async stop(): Promise<void> {
    if (this.client) {
      await this.client.stop();
      this.client = null;
    }
  }
}
