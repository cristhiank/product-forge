import { spawnSync } from 'node:child_process';
import { isAbsolute, resolve } from 'node:path';

export interface GitCommit {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  date: string;        // ISO string
  relativeDate: string; // "2 days ago"
}

export interface GitDiff {
  fromSha: string;
  toSha: string;
  patch: string;       // unified diff text
  additions: number;
  deletions: number;
}

// SOH (0x01) — highly unlikely to appear in commit messages or author names
const SEP = '\x01';

export class GitProvider {
  constructor(private readonly repoRoot: string) {}

  static isAvailable(repoRoot: string): boolean {
    const result = spawnSync('git', ['rev-parse', '--git-dir'], {
      cwd: repoRoot,
      encoding: 'utf-8',
      timeout: 5000,
    });
    return result.status === 0;
  }

  /** Get commit history for a specific file */
  getHistory(filePath: string, limit = 20): GitCommit[] {
    this.validateFilePath(filePath);
    const fmt = `%H${SEP}%h${SEP}%s${SEP}%an${SEP}%aI${SEP}%ar`;
    const result = this.exec(['log', `--format=${fmt}`, `-n`, String(limit), '--', filePath]);
    if (!result.stdout) return [];
    return result.stdout.split('\n').filter(Boolean).map(line => {
      const [sha, shortSha, message, author, date, relativeDate] = line.split(SEP);
      return {
        sha: sha ?? '',
        shortSha: shortSha ?? '',
        message: message ?? '',
        author: author ?? '',
        date: date ?? '',
        relativeDate: relativeDate ?? '',
      };
    });
  }

  /** Get file contents at a specific commit */
  getFileAtCommit(filePath: string, sha: string): string {
    this.validateFilePath(filePath);
    this.validateSha(sha);
    const result = this.exec(['show', `${sha}:${filePath}`]);
    if (!result.success) {
      throw new Error(`git show failed: ${result.stderr}`);
    }
    return result.stdout;
  }

  /** Get diff between two commits for a file (or working copy if toSha omitted) */
  getDiff(filePath: string, fromSha: string, toSha?: string): GitDiff {
    this.validateFilePath(filePath);
    this.validateSha(fromSha);
    if (toSha) this.validateSha(toSha);

    const range = toSha ? `${fromSha}..${toSha}` : fromSha;
    const patch = this.exec(['diff', range, '--', filePath]).stdout;

    const statResult = this.exec(['diff', '--numstat', range, '--', filePath]);
    let additions = 0;
    let deletions = 0;
    const statMatch = /^(\d+)\s+(\d+)/.exec(statResult.stdout);
    if (statMatch) {
      additions = parseInt(statMatch[1], 10);
      deletions = parseInt(statMatch[2], 10);
    }

    return { fromSha, toSha: toSha ?? 'working', patch, additions, deletions };
  }

  /** Stage and commit a file with a message */
  commitFile(filePath: string, message: string): GitCommit {
    this.validateFilePath(filePath);
    this.exec(['add', filePath]);
    const commit = this.exec(['commit', '-m', message]);
    if (!commit.success) {
      throw new Error(`git commit failed: ${commit.stderr}`);
    }
    const history = this.getHistory(filePath, 1);
    if (history.length === 0) {
      throw new Error('Could not retrieve commit after committing');
    }
    return history[0];
  }

  /** Revert a file to a specific commit's version and auto-commit */
  revertFile(filePath: string, sha: string, message?: string): GitCommit {
    this.validateFilePath(filePath);
    this.validateSha(sha);
    const checkout = this.exec(['checkout', sha, '--', filePath]);
    if (!checkout.success) {
      throw new Error(`git checkout failed: ${checkout.stderr}`);
    }
    return this.commitFile(filePath, message ?? `Revert ${filePath} to ${sha}`);
  }

  private validateFilePath(filePath: string): void {
    if (!filePath || filePath.includes('..') || isAbsolute(filePath)) {
      throw new Error(`Invalid file path: ${filePath}`);
    }
    const resolved = resolve(this.repoRoot, filePath);
    const rootWithSep = this.repoRoot.endsWith('/') ? this.repoRoot : `${this.repoRoot}/`;
    if (!resolved.startsWith(rootWithSep) && resolved !== this.repoRoot) {
      throw new Error(`File path escapes repo root: ${filePath}`);
    }
  }

  private validateSha(sha: string): void {
    if (!/^[a-f0-9]{4,40}$/.test(sha) && !/^HEAD(~\d+)?$/.test(sha)) {
      throw new Error(`Invalid SHA: ${sha}`);
    }
  }

  private exec(args: string[]): { stdout: string; stderr: string; success: boolean } {
    const result = spawnSync('git', args, {
      cwd: this.repoRoot,
      encoding: 'utf-8',
      timeout: 10000,
    });
    return {
      stdout: result.stdout?.trim() ?? '',
      stderr: result.stderr?.trim() ?? '',
      success: result.status === 0,
    };
  }
}
