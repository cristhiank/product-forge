import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Inbox,
  PlayCircle,
  CheckCircle2,
  Archive,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";

interface BacklogInfo {
  id: string;
  name: string;
  relativePath: string;
  itemCount?: number;
}

interface ProjectStats {
  next: number;
  working: number;
  done: number;
  archive: number;
}

interface HygieneData {
  stale: unknown[];
  old_done: unknown[];
  warnings: string[];
}

interface StatsResponse {
  stats: Record<string, ProjectStats>;
  hygiene: HygieneData;
}

const FOLDER_META: {
  key: keyof ProjectStats;
  label: string;
  icon: ComponentType<LucideProps>;
  accent: string;
  badge: string;
}[] = [
  { key: "next", label: "Next", icon: Inbox, accent: "border-t-blue-500", badge: "bg-blue-500/15 text-blue-400" },
  { key: "working", label: "Working", icon: PlayCircle, accent: "border-t-yellow-500", badge: "bg-yellow-500/15 text-yellow-400" },
  { key: "done", label: "Done", icon: CheckCircle2, accent: "border-t-green-500", badge: "bg-green-500/15 text-green-400" },
  { key: "archive", label: "Archive", icon: Archive, accent: "border-t-gray-500", badge: "bg-gray-500/15 text-gray-400" },
];

export function BacklogStatsPage() {
  const { data: backlogs = [] } = useQuery<BacklogInfo[]>({
    queryKey: ["backlogs"],
    queryFn: () => api.get<BacklogInfo[]>("/api/backlogs"),
  });

  const sortedBacklogs = useMemo(
    () => [...backlogs].sort((a, b) => (b.itemCount ?? 0) - (a.itemCount ?? 0)),
    [backlogs],
  );

  const [selectedBacklog, setSelectedBacklog] = useState<string | null>(null);

  useEffect(() => {
    if (sortedBacklogs.length > 0 && selectedBacklog === null) {
      const saved = localStorage.getItem("selectedBacklog");
      const valid = saved !== null && sortedBacklogs.some(b => b.id === saved);
      setSelectedBacklog(valid ? saved! : sortedBacklogs[0].id);
    }
  }, [sortedBacklogs, selectedBacklog]);

  useEffect(() => {
    if (selectedBacklog !== null) localStorage.setItem("selectedBacklog", selectedBacklog);
  }, [selectedBacklog]);

  const backlogParam = selectedBacklog ?? "";

  const { data, isLoading } = useQuery<StatsResponse>({
    queryKey: ["backlog-stats", backlogParam],
    queryFn: () => api.get<StatsResponse>(`/api/backlog/stats?backlog=${encodeURIComponent(backlogParam)}`),
    enabled: selectedBacklog !== null,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading stats…
      </div>
    );
  }

  const stats = data?.stats ?? {};
  const hygiene = data?.hygiene ?? { stale: [], old_done: [], warnings: [] };

  // Aggregate counts across all projects
  const totals: ProjectStats = { next: 0, working: 0, done: 0, archive: 0 };
  for (const proj of Object.values(stats)) {
    totals.next += proj.next ?? 0;
    totals.working += proj.working ?? 0;
    totals.done += proj.done ?? 0;
    totals.archive += proj.archive ?? 0;
  }

  const hasHygieneIssues =
    hygiene.stale.length > 0 || hygiene.old_done.length > 0 || hygiene.warnings.length > 0;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">📊 Backlog Stats</h1>

      {/* Backlog picker */}
      {sortedBacklogs.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {sortedBacklogs.map((bl) => (
            <button
              key={bl.id}
              type="button"
              onClick={() => setSelectedBacklog(bl.id)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                selectedBacklog === bl.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
              )}
            >
              {bl.name}
              {bl.itemCount !== undefined && (
                <span className="opacity-75">({bl.itemCount})</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Metric cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FOLDER_META.map((m) => (
          <div
            key={m.key}
            className={cn(
              "rounded-xl border border-border border-t-2 bg-card p-4 transition-colors",
              m.accent,
            )}
          >
            <div className="flex items-center gap-3">
              <m.icon className={cn("h-5 w-5", m.badge.split(" ")[1])} />
              <div>
                <p className="text-2xl font-bold text-foreground">{totals[m.key]}</p>
                <p className="text-xs text-muted-foreground">{m.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Per-project breakdown */}
      {Object.keys(stats).length > 1 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-foreground">By Project</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(stats).map(([project, counts]) => (
              <div key={project} className="rounded-xl border border-border bg-card p-4">
                <p className="mb-2 font-semibold text-foreground">{project}</p>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  {FOLDER_META.map((m) => (
                    <div key={m.key}>
                      <p className="text-lg font-bold text-foreground">{counts[m.key] ?? 0}</p>
                      <p className="text-muted-foreground">{m.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hygiene alerts */}
      {hasHygieneIssues && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-foreground">Hygiene Alerts</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {hygiene.stale.length > 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  <span className="font-semibold text-amber-400">Stale Items</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{hygiene.stale.length}</p>
                <p className="text-xs text-muted-foreground">Items stuck without progress</p>
              </div>
            )}
            {hygiene.old_done.length > 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  <span className="font-semibold text-amber-400">Old Done</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{hygiene.old_done.length}</p>
                <p className="text-xs text-muted-foreground">Done items ready to archive</p>
              </div>
            )}
            {hygiene.warnings.length > 0 && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                  <span className="font-semibold text-red-400">Warnings</span>
                </div>
                <ul className="mt-2 space-y-1">
                  {hygiene.warnings.map((w, i) => (
                    <li key={i} className="text-xs text-muted-foreground">• {w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
