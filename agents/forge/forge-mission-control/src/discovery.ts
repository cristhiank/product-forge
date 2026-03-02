import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

export interface DiscoveredSystem {
  name: string;
  type: 'product' | 'backlog' | 'agents' | 'workers' | 'sessions';
  path: string;
  icon: string;
}

export interface DiscoveredBacklog {
  /** Display name derived from parent directory, e.g. "platform", "pet_boarding/app" */
  name: string;
  /** Absolute path to the .backlog directory */
  path: string;
  /** Path relative to repoRoot of the parent directory containing .backlog (empty string = root) */
  relativePath: string;
}

export interface DiscoveryResult {
  repoRoot: string;
  systems: DiscoveredSystem[];
  hasProduct: boolean;
  hasBacklog: boolean;
  hasAgents: boolean;
  hasWorkers: boolean;
  hasSessions: boolean;
  sessionsPath: string;
  backlogs: DiscoveredBacklog[];
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build']);

function walkForBacklogs(dir: string, repoRoot: string, depth: number, result: DiscoveredBacklog[]): void {
  if (depth > 4) return;
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry === '.backlog') {
      const backlogPath = join(dir, '.backlog');
      try {
        if (statSync(backlogPath).isDirectory()) {
          const relativePath = dir === repoRoot ? '' : dir.slice(repoRoot.length + 1);
          result.push({ name: '', path: backlogPath, relativePath });
        }
      } catch { /* skip */ }
    } else if (!SKIP_DIRS.has(entry) && !entry.startsWith('.')) {
      const fullPath = join(dir, entry);
      try {
        if (statSync(fullPath).isDirectory()) {
          walkForBacklogs(fullPath, repoRoot, depth + 1, result);
        }
      } catch { /* skip */ }
    }
  }
}

function computeBacklogNames(backlogs: DiscoveredBacklog[]): void {
  // Count how many backlogs share the same last path segment
  const baseCount = new Map<string, number>();
  for (const b of backlogs) {
    const base = b.relativePath ? b.relativePath.split('/').pop()! : 'root';
    baseCount.set(base, (baseCount.get(base) ?? 0) + 1);
  }
  for (const b of backlogs) {
    if (!b.relativePath) {
      b.name = 'root';
    } else {
      const segments = b.relativePath.split('/');
      const base = segments[segments.length - 1];
      // Use last two segments when basename is ambiguous
      b.name = (baseCount.get(base) ?? 0) > 1 && segments.length >= 2
        ? segments.slice(-2).join('/')
        : base;
    }
  }
}

export async function discover(repoPath: string, sessionsPath?: string): Promise<DiscoveryResult> {
  const root = resolve(repoPath);

  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new Error(`Path does not exist or is not a directory: ${root}`);
  }

  const systems: DiscoveredSystem[] = [];

  // Product Hub: .product/_meta.yaml
  const productPath = join(root, '.product');
  const productMeta = join(productPath, '_meta.yaml');
  if (existsSync(productPath) && existsSync(productMeta)) {
    systems.push({
      name: 'Product',
      type: 'product',
      path: productPath,
      icon: '📋',
    });
  }

  // Backlogs: recursively find all .backlog/ directories up to depth 4
  const backlogs: DiscoveredBacklog[] = [];
  walkForBacklogs(root, root, 0, backlogs);
  computeBacklogNames(backlogs);

  for (const bl of backlogs) {
    systems.push({
      name: bl.name,
      type: 'backlog',
      path: bl.path,
      icon: '📦',
    });
  }

  // Agents Hub: .git/devpartner/hub.db or .devpartner/hub.db
  const agentsPath1 = join(root, '.git', 'devpartner', 'hub.db');
  const agentsPath2 = join(root, '.devpartner', 'hub.db');
  const agentsDbPath = existsSync(agentsPath1) ? agentsPath1 : existsSync(agentsPath2) ? agentsPath2 : null;
  if (agentsDbPath) {
    systems.push({
      name: 'Agents Hub',
      type: 'agents',
      path: agentsDbPath,
      icon: '🤖',
    });
  }

  // Copilot Workers: .copilot-workers/
  const workersPath = join(root, '.copilot-workers');
  if (existsSync(workersPath) && statSync(workersPath).isDirectory()) {
    systems.push({
      name: 'Workers',
      type: 'workers',
      path: workersPath,
      icon: '⚙️',
    });
  }

  // Copilot CLI Sessions: ~/.copilot/session-state/ (or custom path)
  const resolvedSessionsPath = sessionsPath ?? join(homedir(), '.copilot', 'session-state');
  let hasSessions = false;
  if (existsSync(resolvedSessionsPath) && statSync(resolvedSessionsPath).isDirectory()) {
    try {
      const entries = readdirSync(resolvedSessionsPath);
      hasSessions = entries.some(entry => {
        try {
          return statSync(join(resolvedSessionsPath, entry)).isDirectory();
        } catch {
          return false;
        }
      });
    } catch {
      hasSessions = false;
    }
    if (hasSessions) {
      systems.push({
        name: 'Sessions',
        type: 'sessions',
        path: resolvedSessionsPath,
        icon: '🕐',
      });
    }
  }

  return {
    repoRoot: root,
    systems,
    hasProduct: systems.some(s => s.type === 'product'),
    hasBacklog: backlogs.length > 0,
    hasAgents: systems.some(s => s.type === 'agents'),
    hasWorkers: systems.some(s => s.type === 'workers'),
    hasSessions,
    sessionsPath: resolvedSessionsPath,
    backlogs,
  };
}
