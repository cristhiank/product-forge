import { existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

export interface DiscoveredSystem {
  name: string;
  type: 'product' | 'backlog' | 'agents' | 'workers';
  path: string;
  icon: string;
}

export interface DiscoveryResult {
  repoRoot: string;
  systems: DiscoveredSystem[];
  hasProduct: boolean;
  hasBacklog: boolean;
  hasAgents: boolean;
  hasWorkers: boolean;
}

export async function discover(repoPath: string): Promise<DiscoveryResult> {
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

  // Backlog: .backlog/ with at least one status folder
  const backlogPath = join(root, '.backlog');
  if (existsSync(backlogPath) && statSync(backlogPath).isDirectory()) {
    systems.push({
      name: 'Backlog',
      type: 'backlog',
      path: backlogPath,
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

  return {
    repoRoot: root,
    systems,
    hasProduct: systems.some(s => s.type === 'product'),
    hasBacklog: systems.some(s => s.type === 'backlog'),
    hasAgents: systems.some(s => s.type === 'agents'),
    hasWorkers: systems.some(s => s.type === 'workers'),
  };
}
