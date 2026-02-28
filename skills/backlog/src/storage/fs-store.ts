import type { Dirent } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";

import type { Folder } from "../types.js";
import type { BacklogStore, StoredItem } from "./backlog-store.js";

const FOLDERS: Folder[] = ["next", "working", "done", "archive"];

function assertValidId(id: string): void {
  // B-040, B-040.1, etc
  if (!/^[A-Z]+-\d+(?:\.\d+)*$/.test(id)) {
    throw new Error(`Invalid backlog id: ${id}`);
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class FileSystemBacklogStore implements BacklogStore {
  private readonly rootAbs: string;

  public constructor(opts: { root: string }) {
    this.rootAbs = path.resolve(opts.root);
  }

  public getRoot(): string {
    return this.rootAbs;
  }

  private resolveUnderRoot(...segments: string[]): string {
    const candidate = path.resolve(this.rootAbs, ...segments);
    const rootWithSep = this.rootAbs.endsWith(path.sep) ? this.rootAbs : this.rootAbs + path.sep;
    if (candidate !== this.rootAbs && !candidate.startsWith(rootWithSep)) {
      throw new Error("Path traversal detected");
    }
    return candidate;
  }

  private async findPathById(id: string): Promise<{ folder: Folder; absPath: string; relPath: string }> {
    assertValidId(id);
    const idRe = new RegExp(`^${escapeRegExp(id)}(?:_|$).*\\.md$`, "i");

    for (const folder of FOLDERS) {
      const dirAbs = this.resolveUnderRoot(folder);
      let entries: Array<Dirent>;
      try {
        entries = await fs.readdir(dirAbs, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const e of entries) {
        if (!e.isFile()) continue;
        if (!idRe.test(e.name)) continue;
        const absPath = this.resolveUnderRoot(folder, e.name);
        return { folder, absPath, relPath: path.posix.join(folder, e.name) };
      }
    }

    throw new Error(`Backlog item not found: ${id}`);
  }

  public async exists(id: string): Promise<boolean> {
    try {
      await this.findPathById(id);
      return true;
    } catch {
      return false;
    }
  }

  public async list(folder?: Folder): Promise<Array<{ id: string; folder: Folder; path: string; body: string }>> {
    const folders = folder ? [folder] : FOLDERS;
    const out: Array<{ id: string; folder: Folder; path: string; body: string }> = [];

    for (const f of folders) {
      const dirAbs = this.resolveUnderRoot(f);
      let entries: Array<Dirent>;
      try {
        entries = await fs.readdir(dirAbs, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const e of entries) {
        if (!e.isFile()) continue;
        if (!e.name.toLowerCase().endsWith(".md")) continue;
        // Allow either "B-001_slug.md" (preferred) or "B-001.md" (legacy/edge)
        const idMatch = e.name.match(/^([A-Z]+-\d+(?:\.\d+)*)(?:_|$)/);
        if (!idMatch) continue;
        const id = idMatch[1];
        const absPath = this.resolveUnderRoot(f, e.name);
        const body = await fs.readFile(absPath, "utf8");
        out.push({ id, folder: f, path: path.posix.join(f, e.name), body });
      }
    }

    // Stable ordering: by id, then path
    out.sort((a, b) => (a.id === b.id ? a.path.localeCompare(b.path) : a.id.localeCompare(b.id)));
    return out;
  }

  public async getById(id: string): Promise<StoredItem> {
    const found = await this.findPathById(id);
    const body = await fs.readFile(found.absPath, "utf8");
    return { id, folder: found.folder, path: found.relPath, body };
  }

  public async search(text: string, folder?: Folder): Promise<Array<{ id: string; folder: Folder; path: string; body: string }>> {
    const q = text.toLowerCase();
    const items = await this.list(folder);
    return items.filter((i) => i.body.toLowerCase().includes(q));
  }

  public async stats(): Promise<Record<Folder, number>> {
    const result: Record<Folder, number> = { next: 0, working: 0, done: 0, archive: 0 };
    for (const f of FOLDERS) {
      const items = await this.list(f);
      result[f] = items.length;
    }
    return result;
  }

  public async createFile(folder: Folder, filename: string, body: string): Promise<{ path: string }> {
    const abs = this.resolveUnderRoot(folder, filename);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    // Atomic-ish create: fail if exists
    const handle = await fs.open(abs, "wx");
    try {
      await handle.writeFile(body, "utf8");
    } finally {
      await handle.close();
    }
    return { path: path.posix.join(folder, filename) };
  }

  public async move(id: string, to: Folder): Promise<{ from: Folder; to: Folder; path: string }> {
    const found = await this.findPathById(id);
    const filename = path.basename(found.absPath);
    const toAbs = this.resolveUnderRoot(to, filename);
    await fs.mkdir(path.dirname(toAbs), { recursive: true });
    await fs.rename(found.absPath, toAbs);
    return { from: found.folder, to, path: path.posix.join(to, filename) };
  }

  public async writeBody(id: string, body: string): Promise<{ path: string }> {
    const found = await this.findPathById(id);
    const abs = found.absPath;
    const tmp = abs + ".tmp";
    await fs.writeFile(tmp, body, "utf8");
    await fs.rename(tmp, abs);
    return { path: found.relPath };
  }
}
