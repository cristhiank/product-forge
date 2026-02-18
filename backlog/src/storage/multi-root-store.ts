/**
 * MultiRootBacklogStore — coordinates multiple FileSystemBacklogStore instances,
 * one per project. Delegates operations based on project-qualified IDs.
 *
 * In single-project mode (one store), bare IDs work without qualification.
 * In multi-project mode, IDs should be qualified as `project/B-NNN`.
 */

import type { Folder } from "../types.js";
import { isValidProjectName, parseQualifiedId } from "../id-utils.js";
import type { BacklogStore, StoredItem } from "./backlog-store.js";
import { FileSystemBacklogStore } from "./fs-store.js";

export interface MultiRootStoredItem extends StoredItem {
  project: string;
}

export class MultiRootBacklogStore {
  private readonly stores: Map<string, FileSystemBacklogStore>;
  private readonly defaultProject: string | undefined;

  constructor(projects: Array<{ name: string; root: string }>) {
    if (projects.length === 0) throw new Error("At least one project is required");

    this.stores = new Map();
    for (const p of projects) {
      if (!isValidProjectName(p.name)) {
        throw new Error(`Invalid project name: ${p.name}`);
      }
      this.stores.set(p.name, new FileSystemBacklogStore({ root: p.root }));
    }

    // When there's exactly one project, it's the default (no qualification needed)
    if (projects.length === 1) {
      this.defaultProject = projects[0].name;
    }
  }

  public getProjects(): string[] {
    return [...this.stores.keys()].sort();
  }

  public isSingleProject(): boolean {
    return this.stores.size === 1;
  }

  public getDefaultProject(): string | undefined {
    return this.defaultProject;
  }

  public getStore(project: string): BacklogStore {
    const store = this.stores.get(project);
    if (!store) throw new Error(`Unknown project: ${project}. Available: ${this.getProjects().join(", ")}`);
    return store;
  }

  public getRoot(project: string): string {
    return this.getStore(project).getRoot();
  }

  /**
   * Resolve a potentially qualified ID to a project + local ID.
   * In single-project mode, bare IDs resolve to the default project.
   */
  public resolveId(id: string): { project: string; localId: string } {
    const parsed = parseQualifiedId(id);
    const project = parsed.project ?? this.defaultProject;
    if (!project) {
      throw new Error(
        `Ambiguous id "${id}": multiple projects available. Use qualified id (e.g. project/B-001). Projects: ${this.getProjects().join(", ")}`
      );
    }
    if (!this.stores.has(project)) {
      throw new Error(`Unknown project: ${project}. Available: ${this.getProjects().join(", ")}`);
    }
    return { project, localId: parsed.localId };
  }

  public async list(project?: string, folder?: Folder): Promise<MultiRootStoredItem[]> {
    if (project) {
      const store = this.getStore(project);
      const items = await store.list(folder);
      return items.map((i) => ({ ...i, project }));
    }

    // List across all projects
    const all: MultiRootStoredItem[] = [];
    for (const [name, store] of this.stores) {
      const items = await store.list(folder);
      all.push(...items.map((i) => ({ ...i, project: name })));
    }
    all.sort((a, b) => {
      const projCmp = a.project.localeCompare(b.project);
      return projCmp !== 0 ? projCmp : a.id.localeCompare(b.id);
    });
    return all;
  }

  public async getById(id: string): Promise<MultiRootStoredItem> {
    const { project, localId } = this.resolveId(id);
    const store = this.getStore(project);
    const item = await store.getById(localId);
    return { ...item, project };
  }

  public async search(text: string, project?: string, folder?: Folder): Promise<MultiRootStoredItem[]> {
    if (project) {
      const store = this.getStore(project);
      const items = await store.search(text, folder);
      return items.map((i) => ({ ...i, project }));
    }

    const all: MultiRootStoredItem[] = [];
    for (const [name, store] of this.stores) {
      const items = await store.search(text, folder);
      all.push(...items.map((i) => ({ ...i, project: name })));
    }
    return all;
  }

  public async stats(project?: string): Promise<Record<string, Record<Folder, number>>> {
    if (project) {
      const store = this.getStore(project);
      return { [project]: await store.stats() };
    }

    const result: Record<string, Record<Folder, number>> = {};
    for (const [name, store] of this.stores) {
      result[name] = await store.stats();
    }
    return result;
  }

  public async createFile(
    project: string,
    folder: Folder,
    filename: string,
    body: string
  ): Promise<{ path: string }> {
    const store = this.getStore(project);
    return store.createFile(folder, filename, body);
  }

  public async move(id: string, to: Folder): Promise<{ from: Folder; to: Folder; path: string; project: string }> {
    const { project, localId } = this.resolveId(id);
    const store = this.getStore(project);
    const result = await store.move(localId, to);
    return { ...result, project };
  }

  public async writeBody(id: string, body: string): Promise<{ path: string; project: string }> {
    const { project, localId } = this.resolveId(id);
    const store = this.getStore(project);
    const result = await store.writeBody(localId, body);
    return { ...result, project };
  }

  public async exists(id: string): Promise<boolean> {
    const { project, localId } = this.resolveId(id);
    const store = this.getStore(project);
    return store.exists(localId);
  }

  /**
   * Find all items across all projects that reference the given qualified ID
   * in their Depends-On or Related metadata.
   */
  public async findReferences(qualifiedId: string): Promise<MultiRootStoredItem[]> {
    const all = await this.list();
    return all.filter((item) => {
      const lower = item.body.toLowerCase();
      const target = qualifiedId.toLowerCase();
      return lower.includes(target);
    });
  }
}

/**
 * Create a MultiRootBacklogStore from a single root (backward-compatible wrapper).
 */
export function singleProjectStore(root: string, name = "default"): MultiRootBacklogStore {
  return new MultiRootBacklogStore([{ name, root }]);
}
