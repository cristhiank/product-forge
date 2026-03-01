import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { accessSync } from 'node:fs';
import { resolve } from 'node:path';

const execFileAsync = promisify(execFile);

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

  private async run(args: string[]): Promise<unknown> {
    const cliPath = this.findCli();

    const { stdout } = await execFileAsync('node', [cliPath, '--root', this.repoRoot, ...args], {
      encoding: 'utf-8',
      timeout: 10000,
    });

    try {
      return JSON.parse(stdout) as unknown;
    } catch (error) {
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

  async listItems(opts?: { folder?: BacklogFolder; limit?: number; unblocked?: boolean }): Promise<BacklogItem[]> {
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

    return (await this.run(args)) as BacklogItem[];
  }

  async getItem(id: string): Promise<BacklogItem> {
    return (await this.run(['get', id])) as BacklogItem;
  }

  async searchItems(query: string, opts?: { folder?: BacklogFolder; limit?: number }): Promise<BacklogItem[]> {
    const args = ['search', query];

    if (opts?.folder) {
      args.push('--folder', opts.folder);
    }
    if (opts?.limit) {
      args.push('--limit', String(opts.limit));
    }

    return (await this.run(args)) as BacklogItem[];
  }

  async getStats(): Promise<BacklogStats> {
    return (await this.run(['stats'])) as BacklogStats;
  }

  async getHygiene(opts?: { staleDays?: number; doneDays?: number }): Promise<BacklogHygiene> {
    const args = ['hygiene'];

    if (opts?.staleDays) {
      args.push('--stale-days', String(opts.staleDays));
    }

    if (opts?.doneDays) {
      args.push('--done-days', String(opts.doneDays));
    }

    const raw = (await this.run(args)) as Record<string, unknown>;
    return {
      stale: (raw.stale ?? raw.stale_in_next ?? raw.stuck_in_working ?? []) as BacklogItem[],
      old_done: (raw.old_done ?? raw.old_in_done ?? []) as BacklogItem[],
      warnings: (raw.warnings ?? raw.status_folder_mismatches ?? []) as string[],
    };
  }

  async getBrief(): Promise<BacklogBrief> {
    return (await this.run(['brief'])) as BacklogBrief;
  }

  async pickItem(id: string): Promise<BacklogItem> {
    return (await this.run(['pick', id])) as BacklogItem;
  }

  async completeItem(id: string): Promise<unknown> {
    return this.run(['complete', id]);
  }

  async moveItem(id: string, to: BacklogFolder): Promise<unknown> {
    return this.run(['move', id, '--to', to]);
  }
}
