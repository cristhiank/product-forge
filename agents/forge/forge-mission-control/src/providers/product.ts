import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

import type {
  FeatureOverview,
  ProductDoc,
  ProductFeature,
  ProductHealth,
  ProductMeta,
} from './types.js';

// Raw shape returned by product-hub CLI (frontmatter not flattened)
interface RawDoc {
  path: string;
  frontmatter?: Record<string, unknown>;
  content?: string;
  // Sometimes the CLI returns flattened fields directly
  title?: string;
  type?: string;
  version?: string;
  status?: string;
  tags?: string[];
  created?: string;
  updated?: string;
  featureStatus?: string;
  feature_status?: string;
  epicId?: string;
  epic_id?: string;
}

function extractTitle(content?: string): string {
  if (!content) return 'Untitled';
  const match = /^#\s+(.+)$/m.exec(content);
  return match ? match[1].trim() : 'Untitled';
}

function normalizeDoc(raw: RawDoc): ProductDoc {
  const fm = raw.frontmatter ?? {};
  return {
    path: raw.path,
    type: raw.type ?? String(fm.type ?? 'unknown'),
    title: raw.title ?? extractTitle(raw.content ?? String(fm.content ?? '')),
    version: raw.version ?? String(fm.version ?? ''),
    status: raw.status ?? String(fm.status ?? ''),
    tags: raw.tags ?? (Array.isArray(fm.tags) ? fm.tags.map(String) : []),
    created: raw.created ?? String(fm.created ?? ''),
    updated: raw.updated ?? String(fm.updated ?? ''),
    content: raw.content ?? String(fm.content ?? ''),
  };
}

function normalizeFeature(raw: RawDoc): ProductFeature {
  const fm = raw.frontmatter ?? {};
  return {
    path: raw.path,
    title: raw.title ?? extractTitle(raw.content ?? String(fm.content ?? '')),
    featureStatus: raw.featureStatus ?? raw.feature_status ?? String(fm.feature_status ?? fm.featureStatus ?? 'defined'),
    epicId: raw.epicId ?? raw.epic_id ?? (fm.epic_id != null ? String(fm.epic_id) : fm.epicId != null ? String(fm.epicId) : undefined),
    version: raw.version ?? String(fm.version ?? ''),
    tags: raw.tags ?? (Array.isArray(fm.tags) ? fm.tags.map(String) : []),
  };
}

export class ProductProvider {
  private repoRoot: string;
  private cliPath: string;

  constructor(repoRoot: string) {
    this.repoRoot = repoRoot;
    this.cliPath = this.resolveCliPath();
  }

  private resolveCliPath(): string {
    const candidates = [
      resolve(import.meta.dirname, '../../../product-hub/scripts/index.js'),
      resolve(import.meta.dirname, '../../../product-hub/dist/cli.js'),
      resolve(import.meta.dirname, '../../../product-hub/dist/index.js'),
    ];

    const found = candidates.find((candidate) => existsSync(candidate));
    if (!found) {
      throw new Error(
        `ProductProvider CLI entry point not found. Checked: ${candidates.join(', ')}`,
      );
    }

    return found;
  }

  // Run product-hub CLI and parse JSON output
  private run<T>(args: string[]): T {
    try {
      const tmpFile = join(tmpdir(), `forge-product-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
      spawnSync('sh', ['-c', `node ${JSON.stringify(this.cliPath)} ${args.join(' ')} > ${JSON.stringify(tmpFile)}`], {
        cwd: this.repoRoot,
        encoding: 'utf-8',
        timeout: 10_000,
      });
      const stdout = readFileSync(tmpFile, 'utf-8');
      unlinkSync(tmpFile);
      return JSON.parse(stdout) as T;
    } catch (error) {
      if (error instanceof Error && 'stderr' in error) {
        const stderr = String((error as { stderr?: string }).stderr ?? '').trim();
        if (stderr) {
          throw new Error(`product-hub command failed (${args.join(' ')}): ${stderr}`);
        }
      }
      throw error;
    }
  }

  getMeta(): ProductMeta {
    return this.run<ProductMeta>(['meta']);
  }

  listDocs(type?: string): ProductDoc[] {
    const args = ['list'];
    if (type) args.push('--type', type);
    const raw = this.run<RawDoc[]>(args);
    return raw.map(normalizeDoc);
  }

  readDoc(path: string): ProductDoc {
    const raw = this.run<RawDoc>(['read', path]);
    return normalizeDoc(raw);
  }

  searchDocs(query: string): ProductDoc[] {
    const raw = this.run<RawDoc[]>(['search', query]);
    return raw.map(normalizeDoc);
  }

  getHealth(): ProductHealth {
    return this.run<ProductHealth>(['health']);
  }

  getFeatureOverview(): FeatureOverview {
    return this.run<FeatureOverview>(['feature', 'overview']);
  }

  listFeatures(status?: string): ProductFeature[] {
    const args = ['feature', 'list'];
    if (status) args.push('--status', status);
    const raw = this.run<RawDoc[]>(args);
    return raw.map(normalizeFeature);
  }
}
