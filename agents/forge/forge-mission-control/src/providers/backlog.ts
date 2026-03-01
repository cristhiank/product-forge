import { spawnSync } from 'node:child_process';
import { accessSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

export interface BacklogItem {
  id: string;
  title: string;
  kind: string;
  priority: string;
  folder: string;
  tags: string[];
  depends_on: string[];
  related: string[];
  body?: string;
  metadata?: Record<string, string>;
}

export interface BacklogStats {
  [project: string]: {
    next: number;
    working: number;
    done: number;
    archive: number;
  };
}

export interface BacklogHygiene {
  stale: BacklogItem[];
  old_done: BacklogItem[];
  warnings: string[];
}

export interface BacklogBrief {
  markdown: string;
}

export type BacklogFolder = 'next' | 'working' | 'done' | 'archive';

export class BacklogProvider {
  private readonly repoRoot: string;

  constructor(repoRoot: string) {
    this.repoRoot = repoRoot;
  }

  private run(args: string[]): unknown {
    const cliPath = this.findCli();
    const tmpFile = join(tmpdir(), `forge-backlog-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);

    spawnSync('sh', ['-c', `node ${JSON.stringify(cliPath)} --root ${JSON.stringify(this.repoRoot)} ${args.join(' ')} > ${JSON.stringify(tmpFile)}`], {
      encoding: 'utf-8',
      timeout: 10000,
    });

    try {
      const stdout = readFileSync(tmpFile, 'utf-8');
      unlinkSync(tmpFile);
      return JSON.parse(stdout) as unknown;
    } catch (error) {
      try { unlinkSync(tmpFile); } catch { /* ignore */ }
      throw new Error(
        `Failed to parse backlog CLI JSON output for command "${args.join(' ')}": ${String(error)}`,
      );
    }
  }

  private findCli(): string {
    const home = process.env.HOME || process.env.USERPROFILE || '';

    const paths = [
      resolve(home, '.copilot/skills/backlog/scripts/index.js'),
      resolve(home, '.copilot/skills/backlog/dist/skill-cli.js'),
      resolve(import.meta.dirname, '../../../node_modules/@copilot/skill-backlog/dist/skill-cli.js'),
    ];

    for (const candidate of paths) {
      try {
        accessSync(candidate);
        return candidate;
      } catch {
        // Continue searching known locations.
      }
    }

    throw new Error('Backlog CLI not found. Install the backlog skill.');
  }

  listItems(opts?: { folder?: BacklogFolder; limit?: number; unblocked?: boolean }): BacklogItem[] {
    const args = ['list'];

    if (opts?.folder) {
      args.push('--folder', opts.folder);
    }
    if (opts?.limit) {
      args.push('--limit', String(opts.limit));
    }
    if (opts?.unblocked) {
      args.push('--unblocked');
    }

    return (this.run(args)) as BacklogItem[];
  }

  getItem(id: string): BacklogItem {
    return (this.run(['get', id])) as BacklogItem;
  }

  searchItems(query: string, opts?: { folder?: BacklogFolder; limit?: number }): BacklogItem[] {
    const args = ['search', query];

    if (opts?.folder) {
      args.push('--folder', opts.folder);
    }
    if (opts?.limit) {
      args.push('--limit', String(opts.limit));
    }

    return (this.run(args)) as BacklogItem[];
  }

  getStats(): BacklogStats {
    return (this.run(['stats'])) as BacklogStats;
  }

  getHygiene(opts?: { staleDays?: number; doneDays?: number }): BacklogHygiene {
    const args = ['hygiene'];

    if (opts?.staleDays) {
      args.push('--stale-days', String(opts.staleDays));
    }

    if (opts?.doneDays) {
      args.push('--done-days', String(opts.doneDays));
    }

    const raw = (this.run(args)) as Record<string, unknown>;
    return {
      stale: (raw.stale ?? raw.stale_in_next ?? raw.stuck_in_working ?? []) as BacklogItem[],
      old_done: (raw.old_done ?? raw.old_in_done ?? []) as BacklogItem[],
      warnings: (raw.warnings ?? raw.status_folder_mismatches ?? []) as string[],
    };
  }

  getBrief(): BacklogBrief {
    return (this.run(['brief'])) as BacklogBrief;
  }

  pickItem(id: string): BacklogItem {
    return (this.run(['pick', id])) as BacklogItem;
  }

  completeItem(id: string): unknown {
    return this.run(['complete', id]);
  }

  moveItem(id: string, to: BacklogFolder): unknown {
    return this.run(['move', id, '--to', to]);
  }

  createItem(opts: { kind: string; title: string; priority?: string; description?: string }): BacklogItem {
    const args = ['create', '--kind', opts.kind, '--title', opts.title];
    if (opts.priority) args.push('--priority', opts.priority);
    if (opts.description) args.push('--description', opts.description);
    return this.run(args) as BacklogItem;
  }
}
