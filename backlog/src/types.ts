export type Folder = "next" | "working" | "done" | "archive";

export interface BacklogItemSummary {
  id: string;
  title: string;
  folder: Folder;
  path: string;
  kind?: string;
  priority?: string;
  status?: string;
  tags?: string[];
}

export interface BacklogItem extends BacklogItemSummary {
  body: string;
  metadata: Record<string, string>;
}

export interface BacklogHistoryEntry {
  id: string;
  version: number;
  timestamp: string;
  path: string;
  message?: string;
}

export function isFolder(value: unknown): value is Folder {
  return value === "next" || value === "working" || value === "done" || value === "archive";
}
