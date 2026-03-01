import { spawnSync } from 'node:child_process';
import { accessSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';


export interface AgentWorker {
  id: string;
  status: string;
  agent?: string;
  model?: string;
  branch?: string;
  turns?: number;
  errors?: number;
  costUsd?: number;
  lastEventAt?: string;
  registeredAt?: string;
  completedAt?: string;
  prompt?: string;
  pid?: number;
  exitCode?: number;
  commits?: string[];
  filesChanged?: string[];
}

export interface HubMessage {
  id: string;
  channel?: string;
  type?: string;
  author?: string;
  content?: string;
  tags?: string[];
  threadId?: string;
  workerId?: string;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface OpsSummary {
  totalWorkers?: number;
  activeWorkers?: number;
  completedWorkers?: number;
  failedWorkers?: number;
  lostWorkers?: number;
  totalMessages?: number;
  messagesLast24h?: number;
  estimatedCostUsd?: number;
  errorsLast24h?: number;
  [key: string]: unknown;
}

function canAccess(path: string): boolean {
  try {
    accessSync(path);
    return true;
  } catch {
    return false;
  }
}

function readJsonFile<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T;
  } catch {
    return null;
  }
}

export class AgentsProvider {
  private readonly repoRoot: string;
  private readonly hubDbPath: string | null;
  private readonly workersDir: string | null;

  constructor(repoRoot: string) {
    this.repoRoot = repoRoot;

    const hubCurrent = join(repoRoot, '.git', 'devpartner', 'hub.db');
    const hubLegacy = join(repoRoot, '.devpartner', 'hub.db');
    this.hubDbPath = canAccess(hubCurrent) ? hubCurrent : canAccess(hubLegacy) ? hubLegacy : null;

    const workersPath = join(repoRoot, '.copilot-workers');
    this.workersDir = this.isDirectory(workersPath) ? workersPath : null;
  }

  get hasHub(): boolean {
    return this.hubDbPath !== null;
  }

  get hasWorkers(): boolean {
    return this.workersDir !== null;
  }

  private isDirectory(path: string): boolean {
    try {
      return statSync(path).isDirectory();
    } catch {
      return false;
    }
  }

  private findHubCli(): string {
    const home = homedir();
    const candidates = [resolve(home, '.copilot/skills/agents-hub/scripts/index.js')];

    for (const candidate of candidates) {
      if (canAccess(candidate)) {
        return candidate;
      }
    }

    throw new Error('Agents-hub CLI not found');
  }

  private runHub(args: string[]): unknown | null {
    if (!this.hubDbPath) {
      return null;
    }

    try {
      const cliPath = this.findHubCli();
      const result = spawnSync('node', [cliPath, '--db', this.hubDbPath, ...args], {
        cwd: this.repoRoot,
        encoding: 'utf-8',
        timeout: 15000,
        maxBuffer: 10 * 1024 * 1024,
      });
      if (result.error) return null;
      return JSON.parse(result.stdout) as unknown;
    } catch {
      return null;
    }
  }

  private runHubFallback(primaryArgs: string[], fallbackArgs: string[]): unknown | null {
    const primary = this.runHub(primaryArgs);
    if (primary !== null) {
      return primary;
    }
    return this.runHub(fallbackArgs);
  }

  listHubWorkers(status?: string): AgentWorker[] {
    const args = ['worker', 'list'];
    if (status) {
      args.push('--status', status);
    }
    const result = this.runHub(args);
    return Array.isArray(result) ? (result as AgentWorker[]) : [];
  }

  getHubWorker(id: string, sync?: boolean): AgentWorker | null {
    if (sync) {
      this.syncWorker(id);
    }

    const result = this.runHubFallback(['worker', 'get', id], ['worker', 'status', id]);
    return result && typeof result === 'object' ? (result as AgentWorker) : null;
  }

  syncWorker(id: string): boolean {
    return (this.runHub(['worker', 'sync', '--id', id])) !== null;
  }

  syncAllWorkers(): boolean {
    return (this.runHub(['worker', 'sync'])) !== null;
  }

  listMessages(opts?: { channel?: string; limit?: number; type?: string }): HubMessage[] {
    const modernArgs = ['read'];
    const legacyArgs = ['message', 'list'];

    if (opts?.channel) {
      modernArgs.push('--channel', opts.channel);
      legacyArgs.push('--channel', opts.channel);
    }
    if (opts?.limit) {
      modernArgs.push('--limit', String(opts.limit));
      legacyArgs.push('--limit', String(opts.limit));
    }
    if (opts?.type) {
      modernArgs.push('--type', opts.type);
      legacyArgs.push('--type', opts.type);
    }

    const result = this.runHubFallback(modernArgs, legacyArgs);
    return Array.isArray(result) ? (result as HubMessage[]) : [];
  }

  searchMessages(query: string, opts?: { limit?: number }): HubMessage[] {
    const modernArgs = ['search', query];
    const legacyArgs = ['message', 'search', query];

    if (opts?.limit) {
      modernArgs.push('--limit', String(opts.limit));
      legacyArgs.push('--limit', String(opts.limit));
    }

    const result = this.runHubFallback(modernArgs, legacyArgs);
    return Array.isArray(result) ? (result as HubMessage[]) : [];
  }

  getStatus(): Record<string, unknown> {
    const result = this.runHub(['status']);
    return result && typeof result === 'object' ? (result as Record<string, unknown>) : {};
  }

  getStats(): Record<string, unknown> {
    const result = this.runHub(['stats']);
    return result && typeof result === 'object' ? (result as Record<string, unknown>) : {};
  }

  getOpsSummary(): OpsSummary {
    const result = this.runHub(['exec', 'sdk.opsSummary()']);
    return result && typeof result === 'object' ? (result as OpsSummary) : {};
  }

  listFileWorkers(): AgentWorker[] {
    if (!this.workersDir) {
      return [];
    }

    try {
      const entries = readdirSync(this.workersDir, { withFileTypes: true });
      return entries
        .filter(entry => entry.isDirectory())
        .map(entry => this.readFileWorker(entry.name))
        .filter((worker): worker is AgentWorker => worker !== null);
    } catch {
      return [];
    }
  }

  private readFileWorker(workerId: string): AgentWorker | null {
    if (!this.workersDir) {
      return null;
    }

    const workerDir = join(this.workersDir, workerId);
    const metaPath = join(workerDir, 'meta.json');
    const meta = readJsonFile<Record<string, unknown>>(metaPath);
    if (!meta) {
      return null;
    }

    const worker: AgentWorker = {
      id: workerId,
      status: typeof meta.status === 'string' ? meta.status : 'unknown',
      agent: typeof meta.agent === 'string' ? meta.agent : undefined,
      model: typeof meta.model === 'string' ? meta.model : undefined,
      prompt: typeof meta.prompt === 'string' ? meta.prompt : undefined,
      pid: typeof meta.pid === 'number' ? meta.pid : undefined,
    };

    const exitPath = join(workerDir, 'exit.json');
    const exit = readJsonFile<Record<string, unknown>>(exitPath);
    if (exit) {
      worker.exitCode = typeof exit.exitCode === 'number' ? exit.exitCode : undefined;
      worker.commits = Array.isArray(exit.commits) ? (exit.commits as string[]) : undefined;
      worker.filesChanged = Array.isArray(exit.filesChanged) ? (exit.filesChanged as string[]) : undefined;
    }

    return worker;
  }

  getWorkerLog(workerId: string, tail?: number): string {
    if (!this.workersDir) {
      return '';
    }

    const logPath = join(this.workersDir, workerId, 'output.log');
    if (!canAccess(logPath)) {
      return '';
    }

    try {
      const content = readFileSync(logPath, 'utf-8');
      if (!tail || tail <= 0) {
        return content;
      }
      const lines = content.split('\n');
      return lines.slice(-tail).join('\n');
    } catch {
      return '';
    }
  }

  listAllWorkers(status?: string): AgentWorker[] {
    const hubWorkers = this.hasHub ? this.listHubWorkers(status) : [];
    const fileWorkers = this.listFileWorkers();
    const merged = new Map<string, AgentWorker>();

    for (const fileWorker of fileWorkers) {
      merged.set(fileWorker.id, fileWorker);
    }

    for (const hubWorker of hubWorkers) {
      const existing = merged.get(hubWorker.id);
      const metadata = (hubWorker as unknown as { metadata?: Record<string, unknown> }).metadata;
      const telemetry = metadata?.opsTelemetry as Record<string, unknown> | undefined;

      if (existing) {
        Object.assign(existing, {
          status: hubWorker.status || existing.status,
          turns: hubWorker.turns,
          errors: hubWorker.errors,
          costUsd:
            typeof telemetry?.estimatedCostUsd === 'number'
              ? telemetry.estimatedCostUsd
              : hubWorker.costUsd,
          lastEventAt: hubWorker.lastEventAt ?? (hubWorker as { last_event_at?: string }).last_event_at,
          registeredAt:
            hubWorker.registeredAt ?? (hubWorker as { registered_at?: string }).registered_at,
          completedAt:
            hubWorker.completedAt ?? (hubWorker as { completed_at?: string }).completed_at,
          branch:
            typeof metadata?.branch === 'string' ? metadata.branch : existing.branch,
        });
      } else {
        merged.set(hubWorker.id, {
          id: hubWorker.id,
          status: hubWorker.status,
          turns: hubWorker.turns,
          errors: hubWorker.errors,
          costUsd:
            typeof telemetry?.estimatedCostUsd === 'number'
              ? telemetry.estimatedCostUsd
              : hubWorker.costUsd,
          lastEventAt: hubWorker.lastEventAt ?? (hubWorker as { last_event_at?: string }).last_event_at,
          registeredAt:
            hubWorker.registeredAt ?? (hubWorker as { registered_at?: string }).registered_at,
          completedAt:
            hubWorker.completedAt ?? (hubWorker as { completed_at?: string }).completed_at,
          branch: typeof metadata?.branch === 'string' ? metadata.branch : undefined,
          agent: hubWorker.agent,
          model: hubWorker.model,
        });
      }
    }

    return Array.from(merged.values());
  }
}
