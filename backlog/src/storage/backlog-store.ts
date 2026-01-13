import type { Folder } from "../types.js";

export interface StoredItem {
  id: string;
  folder: Folder;
  path: string;
  body: string;
}

export interface BacklogStore {
  list(folder?: Folder): Promise<Array<{ id: string; folder: Folder; path: string; body: string }>>;
  getById(id: string): Promise<StoredItem>;
  search(text: string, folder?: Folder): Promise<Array<{ id: string; folder: Folder; path: string; body: string }>>;
  stats(): Promise<Record<Folder, number>>;
  createFile(folder: Folder, filename: string, body: string): Promise<{ path: string }>;
  move(id: string, to: Folder): Promise<{ from: Folder; to: Folder; path: string }>;
  writeBody(id: string, body: string): Promise<{ path: string }>;
  exists(id: string): Promise<boolean>;
  getRoot(): string;
}
