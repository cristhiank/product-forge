import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import matter from 'gray-matter';
import type { DiscoveryResult } from './discovery.js';
import { AgentsProvider } from './providers/agents.js';
import { ProductProvider } from './providers/product.js';
import { BacklogProvider } from './providers/backlog.js';
import { SessionsProvider } from './providers/sessions.js';
import { GitProvider } from './providers/git.js';
import { AIProvider } from './providers/ai.js';
import { registerEvents } from './events.js';

interface ServerOptions {
  port: number;
  verbose: boolean;
}

export async function createServer(discovery: DiscoveryResult, opts: ServerOptions) {
  const app = Fastify({
    logger: opts.verbose ? { level: 'info' } : false,
  });
  const agentsProvider = new AgentsProvider(discovery.repoRoot);
  const gitProvider = GitProvider.isAvailable(discovery.repoRoot)
    ? new GitProvider(discovery.repoRoot)
    : null;

  // --- AI Provider ---
  const aiProvider = new AIProvider();
  const hasAI = await aiProvider.initialize();
  app.addHook('onClose', async () => { await aiProvider.stop(); });

  // ===== JSON API Routes =====

  // --- Discovery API ---
  app.get('/api/discovery', async () => {
    return discovery;
  });

  // --- Product API ---
  if (discovery.hasProduct) {
    const productApi = new ProductProvider(discovery.repoRoot);

    app.get('/api/product', async (_req, reply) => {
      try {
        const [meta, health, featureOverview, docs] = await Promise.all([
          productApi.getMeta(),
          productApi.getHealth(),
          productApi.getFeatureOverview(),
          productApi.listDocs(),
        ]);
        return { meta, health, featureOverview, docs };
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });

    app.get('/api/product/features', async (_req, reply) => {
      try {
        const [featureOverview, features] = await Promise.all([
          productApi.getFeatureOverview(),
          productApi.listFeatures(),
        ]);
        return { featureOverview, features };
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });

    app.get<{ Params: { '*': string } }>('/api/product/doc/*', async (req, reply) => {
      try {
        const rawParam = req.params['*'] ?? '';
        const docPath = decodeURIComponent(rawParam).replace(/^\/+/, '');
        if (!docPath) {
          reply.code(400);
          return { error: 'Missing document path' };
        }
        const doc = await productApi.readDoc(docPath);
        return { doc };
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });

    app.get<{ Querystring: { q?: string } }>('/api/product/search', async (req, reply) => {
      try {
        const query = (req.query.q ?? '').trim();
        const results = query ? await productApi.searchDocs(query) : [];
        return { results };
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });

    app.put<{ Params: { '*': string }; Body: { content: string; commitMessage?: string } }>('/api/product/doc/*', async (req, reply) => {
      try {
        const rawParam = req.params['*'] ?? '';
        const docPath = decodeURIComponent(rawParam).replace(/^\/+/, '');
        if (!docPath || docPath.includes('..')) {
          reply.code(400);
          return { error: 'Invalid document path' };
        }
        const filePath = join(discovery.repoRoot, '.product', docPath);
        const productRoot = join(discovery.repoRoot, '.product');
        if (!filePath.startsWith(productRoot + '/') && filePath !== productRoot) {
          reply.code(400);
          return { error: 'Invalid document path' };
        }
        if (!existsSync(filePath)) {
          reply.code(404);
          return { error: 'Document not found' };
        }
        const raw = readFileSync(filePath, 'utf-8');
        const parsed = matter(raw);
        const newRaw = matter.stringify(req.body.content, parsed.data);
        writeFileSync(filePath, newRaw, 'utf-8');
        let commit: ReturnType<GitProvider['commitFile']> | undefined;
        if (gitProvider) {
          try {
            commit = gitProvider.commitFile(`.product/${docPath}`, req.body.commitMessage ?? `Update doc: ${docPath}`);
          } catch { /* git commit failure is non-blocking */ }
        }
        return { success: true, commit };
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });

    app.get<{ Params: { id: string } }>('/api/product/features/:id', async (req, reply) => {
      try {
        const { id } = req.params;
        const features = productApi.listFeatures();
        const feature = features.find((f) => f.id === id || f.id.startsWith(id));
        if (!feature) {
          reply.code(404);
          return { error: `Feature ${id} not found` };
        }
        const doc = productApi.readDoc(feature.path);
        return { feature, doc };
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });

    app.patch<{ Params: { id: string }; Body: { featureStatus: string } }>('/api/product/features/:id/status', async (req, reply) => {
      try {
        const { id } = req.params;
        const { featureStatus } = req.body ?? {};
        if (!featureStatus) { reply.code(400); return { error: 'featureStatus is required' }; }
        const features = productApi.listFeatures();
        const feature = features.find((f) => f.id === id || f.id.startsWith(id));
        if (!feature) { reply.code(404); return { error: `Feature ${id} not found` }; }
        const filePath = join(discovery.repoRoot, '.product', feature.path);
        const productRoot = join(discovery.repoRoot, '.product');
        if (!filePath.startsWith(productRoot + '/')) { reply.code(400); return { error: 'Invalid feature path' }; }
        const raw = readFileSync(filePath, 'utf-8');
        const parsed = matter(raw);
        parsed.data.feature_status = featureStatus;
        const newRaw = matter.stringify(parsed.content, parsed.data);
        writeFileSync(filePath, newRaw, 'utf-8');
        let commit: ReturnType<GitProvider['commitFile']> | undefined;
        if (gitProvider) {
          try {
            commit = gitProvider.commitFile(`.product/${feature.path}`, `Update feature status: ${id} → ${featureStatus}`);
          } catch { /* non-blocking */ }
        }
        return { success: true, commit };
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });

    app.post<{ Body: { title: string; featureStatus?: string; epicId?: string; tags?: string[]; description?: string } }>('/api/product/features', async (req, reply) => {
      try {
        const { title, featureStatus = 'discovery', epicId, tags = [], description = '' } = req.body ?? {};
        if (!title) { reply.code(400); return { error: 'title is required' }; }
        const featuresDir = join(discovery.repoRoot, '.product', 'features');
        const existingFiles = existsSync(featuresDir)
          ? readdirSync(featuresDir).filter((f) => /^F-\d+/i.test(f))
          : [];
        const maxNum = existingFiles.reduce((max, f) => {
          const m = /^F-(\d+)/i.exec(f);
          return m ? Math.max(max, parseInt(m[1], 10)) : max;
        }, 0);
        const nextId = `F-${String(maxNum + 1).padStart(3, '0')}`;
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const filename = `${nextId}_${slug}.md`;
        const relPath = `features/${filename}`;
        const filePath = join(featuresDir, filename);
        const today = new Date().toISOString().split('T')[0];
        const fm: Record<string, unknown> = { type: 'feature', feature_status: featureStatus, version: '0.1.0', tags, created: today, updated: today };
        if (epicId) fm.epic_id = epicId;
        const body = description ? `# ${title}\n\n${description}` : `# ${title}\n`;
        writeFileSync(filePath, matter.stringify(body, fm), 'utf-8');
        let commit: ReturnType<GitProvider['commitFile']> | undefined;
        if (gitProvider) {
          try {
            commit = gitProvider.commitFile(`.product/${relPath}`, `feat: add feature ${nextId} ${title}`);
          } catch { /* non-blocking */ }
        }
        return { feature: { id: nextId, path: relPath, title }, commit };
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });
  }

  // --- Backlog API ---
  if (discovery.backlogs.length > 0) {
    // Build a provider per discovered backlog (keyed by relativePath)
    const backlogProviders = new Map<string, BacklogProvider>();
    for (const bl of discovery.backlogs) {
      const parentDir = bl.relativePath ? join(discovery.repoRoot, bl.relativePath) : discovery.repoRoot;
      backlogProviders.set(bl.relativePath, new BacklogProvider(parentDir));
    }
    const defaultKey = discovery.backlogs[0].relativePath;

    function resolveBacklog(backlogParam?: string): BacklogProvider {
      const key = (backlogParam === undefined || backlogParam === null) ? defaultKey : backlogParam;
      const provider = backlogProviders.get(key);
      if (!provider) throw new Error(`Backlog not found: ${backlogParam}`);
      return provider;
    }

    function resolveBacklogPath(backlogParam?: string): string {
      const key = (backlogParam === undefined || backlogParam === null) ? defaultKey : backlogParam;
      const bl = discovery.backlogs.find(b => b.relativePath === key);
      if (!bl) throw new Error(`Backlog not found: ${backlogParam}`);
      return bl.path;
    }

    function countBacklogItems(backlogPath: string): number {
      let count = 0;
      for (const folder of ['next', 'working', 'done', 'archive']) {
        try {
          const files = readdirSync(join(backlogPath, folder));
          count += files.filter(f => f.endsWith('.md')).length;
        } catch { /* folder may not exist */ }
      }
      return count;
    }

    // List all discovered backlogs
    app.get('/api/backlogs', async () => {
      return discovery.backlogs.map(bl => ({
        id: bl.relativePath,
        name: bl.name,
        path: bl.path,
        relativePath: bl.relativePath,
        itemCount: countBacklogItems(bl.path),
      }));
    });

    app.get<{ Querystring: { backlog?: string } }>('/api/backlog/items', async (req, reply) => {
      try {
        return await resolveBacklog(req.query.backlog).listItems();
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });

    app.get<{ Params: { id: string }; Querystring: { backlog?: string } }>('/api/backlog/item/:id', async (req, reply) => {
      try {
        return await resolveBacklog(req.query.backlog).getItem(req.params.id);
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });

    app.get<{ Querystring: { backlog?: string } }>('/api/backlog/stats', async (req, reply) => {
      try {
        const api = resolveBacklog(req.query.backlog);
        const [stats, hygiene] = await Promise.all([
          api.getStats(),
          api.getHygiene(),
        ]);
        return { stats, hygiene };
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });

    app.get<{ Querystring: { q?: string; backlog?: string } }>('/api/backlog/search', async (req, reply) => {
      try {
        const query = (req.query.q ?? '').trim();
        const results = query ? await resolveBacklog(req.query.backlog).searchItems(query) : [];
        return results;
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });

    app.post<{ Body: { kind?: string; title?: string; priority?: string; description?: string }; Querystring: { backlog?: string } }>('/api/backlog/items', async (req, reply) => {
      try {
        const { kind, title, priority, description } = req.body ?? {};
        if (!kind || !title) {
          reply.code(400);
          return { error: 'kind and title are required' };
        }
        const item = resolveBacklog(req.query.backlog).createItem({ kind, title, priority, description });
        return item;
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });

    app.post<{ Params: { id: string }; Body: { to?: string }; Querystring: { backlog?: string } }>('/api/backlog/item/:id/move', async (req, reply) => {
      try {
        const destination = req.body?.to;
        if (destination !== 'next' && destination !== 'working' && destination !== 'done' && destination !== 'archive') {
          reply.code(400);
          return { error: 'Invalid destination folder. Must be one of: next, working, done, archive' };
        }
        const api = resolveBacklog(req.query.backlog);
        await api.moveItem(req.params.id, destination);
        const item = await api.getItem(req.params.id);
        return item;
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });

    app.put<{ Params: { id: string }; Body: { body: string; commitMessage?: string }; Querystring: { backlog?: string } }>('/api/backlog/item/:id/body', async (req, reply) => {
      try {
        const { id } = req.params;
        const backlogPath = resolveBacklogPath(req.query.backlog);
        let itemFilePath: string | null = null;
        let itemFolder: string | null = null;
        for (const folder of ['next', 'working', 'done', 'archive']) {
          const dirPath = join(backlogPath, folder);
          try {
            const files = readdirSync(dirPath).filter(
              f => (f === `${id}.md` || f.startsWith(`${id}_`)) && f.endsWith('.md'),
            );
            if (files.length > 0) {
              itemFilePath = join(dirPath, files[0]);
              itemFolder = folder;
              break;
            }
          } catch { /* folder may not exist */ }
        }
        if (!itemFilePath || !itemFolder) {
          reply.code(404);
          return { error: `Backlog item ${id} not found` };
        }
        const raw = readFileSync(itemFilePath, 'utf-8');
        // Backlog items use a markdown separator (---), not YAML frontmatter.
        // Preserve everything up to and including the separator line, replace body.
        const sepIdx = raw.indexOf('\n---\n');
        const newRaw = sepIdx !== -1
          ? raw.slice(0, sepIdx + 5) + '\n' + req.body.body
          : raw + '\n\n---\n\n' + req.body.body;
        writeFileSync(itemFilePath, newRaw, 'utf-8');
        let commit: ReturnType<GitProvider['commitFile']> | undefined;
        if (gitProvider) {
          try {
            const bl = discovery.backlogs.find(b => b.path === backlogPath)!;
            const filename = itemFilePath.split('/').pop()!;
            const relPath = join(bl.relativePath || '', '.backlog', itemFolder, filename);
            commit = gitProvider.commitFile(relPath, req.body.commitMessage ?? `Update backlog item: ${id}`);
          } catch { /* git commit failure is non-blocking */ }
        }
        return { success: true, commit };
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });
  }

  // --- Agents API ---
  if (discovery.hasAgents || discovery.hasWorkers) {
    const agentsApi = agentsProvider;

    app.get('/api/agents/workers', async (_req, reply) => {
      try {
        return await agentsApi.listAllWorkers();
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });

    app.get<{ Params: { id: string } }>('/api/agents/worker/:id', async (req, reply) => {
      try {
        const { id } = req.params;
        const fromList = (await agentsApi.listAllWorkers()).find(w => w.id === id) ?? null;
        const fromHub = (await agentsApi.getHubWorker(id)) ?? null;
        const worker = fromList
          ? { ...fromList, ...fromHub, id: fromList.id }
          : fromHub;

        if (!worker) {
          reply.code(404);
          return { error: `Worker ${id} not found` };
        }

        const log = agentsApi.getWorkerLog(id, 100);
        return { worker, log };
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });

    app.get('/api/agents/messages', async (_req, reply) => {
      try {
        return await agentsApi.listMessages({ limit: 500 });
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });

    app.get('/api/agents/costs', async (_req, reply) => {
      try {
        return await agentsApi.listAllWorkers();
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });

    app.get('/api/agents/incidents', async (_req, reply) => {
      try {
        const [workers, messages] = await Promise.all([
          agentsApi.listAllWorkers(),
          agentsApi.listMessages({ limit: 500 }),
        ]);
        return { workers, messages };
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });

    app.post<{ Params: { id: string } }>('/api/agents/worker/:id/sync', async (req, reply) => {
      try {
        await agentsApi.syncWorker(req.params.id);
        return { ok: true };
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });
  }

  // --- Health check ---
  app.get('/api/health', async () => {
    return {
      status: 'ok',
      systems: discovery.systems.map(s => ({ name: s.name, type: s.type })),
    };
  });

  app.get('/health', async () => {
    return { status: 'ok', uptime: process.uptime() };
  });

  // --- Sessions API ---
  if (discovery.hasSessions) {
    const sessionsApi = new SessionsProvider(discovery.sessionsPath);

    app.get('/api/sessions', async (_req, reply) => {
      try {
        return await sessionsApi.listSessions();
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });

    app.get<{ Params: { id: string } }>('/api/sessions/:id', async (req, reply) => {
      try {
        const session = await sessionsApi.getSession(req.params.id);
        if (!session) {
          reply.code(404);
          return { error: `Session ${req.params.id} not found` };
        }
        return session;
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });

    app.get<{ Params: { id: string } }>('/api/sessions/:id/timeline', async (req, reply) => {
      try {
        return await sessionsApi.getTimeline(req.params.id);
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });

    app.get<{ Params: { id: string }; Querystring: { type?: string } }>('/api/sessions/:id/events', async (req, reply) => {
      try {
        return await sessionsApi.getEvents(req.params.id, req.query.type);
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });
  }

  // --- Git API ---
  if (gitProvider) {
    app.get<{ Querystring: { file: string; limit?: string } }>('/api/git/history', async (req, reply) => {
      const { file, limit } = req.query;
      if (!file) { reply.code(400); return { error: 'file parameter required' }; }
      try {
        return gitProvider.getHistory(file, parseInt(limit ?? '20', 10));
      } catch (err) {
        reply.code(400);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });

    app.get<{ Querystring: { file: string; commit: string } }>('/api/git/show', async (req, reply) => {
      const { file, commit } = req.query;
      if (!file || !commit) { reply.code(400); return { error: 'file and commit parameters required' }; }
      try {
        return { content: gitProvider.getFileAtCommit(file, commit) };
      } catch (err) {
        reply.code(400);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });

    app.get<{ Querystring: { file: string; from: string; to?: string } }>('/api/git/diff', async (req, reply) => {
      const { file, from, to } = req.query;
      if (!file || !from) { reply.code(400); return { error: 'file and from parameters required' }; }
      try {
        return gitProvider.getDiff(file, from, to);
      } catch (err) {
        reply.code(400);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });

    app.post<{ Body: { file: string; commit: string; message?: string } }>('/api/git/revert', async (req, reply) => {
      const { file, commit, message } = req.body ?? {};
      if (!file || !commit) { reply.code(400); return { error: 'file and commit required' }; }
      try {
        return gitProvider.revertFile(file, commit, message);
      } catch (err) {
        reply.code(400);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });
  }

  // --- AI Assist API ---
  app.get('/api/ai/status', async () => ({ available: hasAI }));

  if (hasAI) {
    const FEATURE_ASSIST_PROMPTS: Record<string, (spec: string) => string> = {
      acceptance_criteria: (spec) =>
        `You are a product manager assistant. Given this feature spec, generate detailed acceptance criteria in markdown format.\n\nFeature Spec:\n${spec}\n\nGenerate acceptance criteria:`,
      gap_analysis: (spec) =>
        `You are a product manager assistant. Analyze this feature spec for gaps, missing sections, unclear requirements, or potential risks.\n\nFeature Spec:\n${spec}\n\nAnalysis:`,
      mock_ui: (spec) =>
        `You are a UI/UX designer assistant. Based on this feature spec, describe a detailed UI mockup using markdown with ASCII layout diagrams.\n\nFeature Spec:\n${spec}\n\nUI Mockup:`,
      backlog_breakdown: (spec) =>
        `You are a product manager assistant. Break this feature spec down into concrete backlog items (stories/tasks) with titles and brief descriptions in markdown.\n\nFeature Spec:\n${spec}\n\nBacklog Items:`,
    };

    app.post<{ Body: { action: string; featureId: string; specContent: string } }>(
      '/api/ai/feature-assist',
      async (req, reply) => {
        const { action, specContent = '' } = req.body ?? {};
        const buildPrompt = FEATURE_ASSIST_PROMPTS[action];
        if (!buildPrompt) {
          reply.code(400);
          return { error: `Unknown action: ${action}` };
        }
        const prompt = buildPrompt(specContent);

        reply.hijack();
        reply.raw.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });

        try {
          for await (const event of aiProvider.streamCompletion(prompt)) {
            reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
          }
        } catch (err) {
          reply.raw.write(`data: ${JSON.stringify({ type: 'error', error: String(err) })}\n\n`);
        }
        reply.raw.end();
      },
    );
  }

  const cleanupEvents = registerEvents(app, discovery);
  app.addHook('onClose', async () => {
    await cleanupEvents();
  });

  // --- SPA static serving (production) ---
  const prodClientDir = join(import.meta.dirname, 'client');
  const devClientDir = join(import.meta.dirname, '../client/dist');
  const clientDir = existsSync(prodClientDir) ? prodClientDir : devClientDir;
  if (existsSync(clientDir)) {
    await app.register(fastifyStatic, { root: clientDir, serve: false });
    app.setNotFoundHandler(async (req, reply) => {
      // Try to serve the static file; fall back to index.html for SPA routing
      const filePath = req.url.split('?')[0].replace(/^\/+/, '');
      const fullPath = join(clientDir, filePath);
      if (filePath && existsSync(fullPath) && !statSync(fullPath).isDirectory()) {
        return reply.sendFile(filePath);
      }
      return reply.sendFile('index.html');
    });
  }

  return app;
}
