import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type {
  FeatureOverview,
  ProductDoc,
  ProductFeature,
  ProductHealth,
  ProductMeta,
} from './types.js';

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
      const result = execFileSync('node', [this.cliPath, ...args], {
        cwd: this.repoRoot,
        encoding: 'utf-8',
        timeout: 10_000,
      });
      return JSON.parse(result) as T;
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
    return this.run<ProductDoc[]>(args);
  }

  readDoc(path: string): ProductDoc {
    return this.run<ProductDoc>(['read', path]);
  }

  searchDocs(query: string): ProductDoc[] {
    return this.run<ProductDoc[]>(['search', query]);
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
    return this.run<ProductFeature[]>(args);
  }
}
