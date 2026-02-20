export type Folder = "next" | "working" | "done" | "archive";

export interface BacklogItemSummary {
  id: string;
  title: string;
  folder: Folder;
  path: string;
  project?: string;
  kind?: string;
  priority?: string;
  status?: string;
  tags?: string[];
  depends_on?: string[];
  related?: string[];
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

export interface HygieneItemInfo {
  id: string;
  title: string;
  folder: string;
  age_days: number;
  project: string;
}

export interface HygieneResult {
  stale_in_next: HygieneItemInfo[];
  stuck_in_working: HygieneItemInfo[];
  old_in_done: HygieneItemInfo[];
  status_folder_mismatches: Array<HygieneItemInfo & { status: string; expected_status: string }>;
  total_items: number;
  health_score: "healthy" | "needs_attention" | "unhealthy";
  fixed?: number;
}

const STATUS_MAP: Record<Folder, string> = {
  next: "Not Started",
  working: "In Progress",
  done: "Done",
  archive: "Archived",
};

export function folderToStatus(folder: Folder): string {
  return STATUS_MAP[folder];
}

export function isFolder(value: unknown): value is Folder {
  return value === "next" || value === "working" || value === "done" || value === "archive";
}
