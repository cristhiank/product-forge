import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Search, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { DataTable } from "@/components/DataTable";
import type { ColumnDef } from "@tanstack/react-table";

interface BacklogInfo {
  id: string;
  name: string;
  relativePath: string;
  itemCount?: number;
}

interface BacklogItem {
  id: string;
  title: string;
  kind?: string;
  priority?: string;
  folder?: string;
}

const KIND_BADGE: Record<string, string> = {
  epic: "bg-blue-500/15 text-blue-400",
  task: "bg-gray-500/15 text-gray-400",
  bug: "bg-red-500/15 text-red-400",
  feature: "bg-green-500/15 text-green-400",
  story: "bg-purple-500/15 text-purple-400",
  chore: "bg-yellow-500/15 text-yellow-400",
};

const PRIORITY_BADGE: Record<string, string> = {
  high: "bg-red-500/15 text-red-400",
  medium: "bg-yellow-500/15 text-yellow-400",
  low: "bg-green-500/15 text-green-400",
};

const FOLDER_BADGE: Record<string, string> = {
  next: "bg-blue-500/15 text-blue-400",
  working: "bg-yellow-500/15 text-yellow-400",
  done: "bg-green-500/15 text-green-400",
  archive: "bg-gray-500/15 text-gray-400",
};

function Badge({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        className,
      )}
    >
      {label}
    </span>
  );
}

export function BacklogSearchPage() {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), 300);
    return () => clearTimeout(timer);
  }, [input]);

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

  const { data: results = [], isLoading } = useQuery<BacklogItem[]>({
    queryKey: ["backlog-search", backlogParam, query],
    queryFn: () => api.get<BacklogItem[]>(`/api/backlog/search?q=${encodeURIComponent(query)}&backlog=${encodeURIComponent(backlogParam)}`),
    enabled: query.length > 0 && selectedBacklog !== null,
  });

  const columns = useMemo<ColumnDef<BacklogItem, unknown>[]>(
    () => [
      {
        accessorKey: "id",
        header: "ID",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs text-muted-foreground">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: "title",
        header: "Title",
        cell: ({ getValue }) => (
          <span className="font-medium text-foreground">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: "kind",
        header: "Kind",
        cell: ({ getValue }) => {
          const v = getValue<string>();
          return v ? <Badge label={v} className={KIND_BADGE[v] ?? "bg-gray-500/15 text-gray-400"} /> : null;
        },
      },
      {
        accessorKey: "priority",
        header: "Priority",
        cell: ({ getValue }) => {
          const v = getValue<string>();
          return v ? <Badge label={v} className={PRIORITY_BADGE[v] ?? "bg-gray-500/15 text-gray-400"} /> : null;
        },
      },
      {
        accessorKey: "folder",
        header: "Folder",
        cell: ({ getValue }) => {
          const v = getValue<string>();
          return v ? <Badge label={v} className={FOLDER_BADGE[v] ?? "bg-gray-500/15 text-gray-400"} /> : null;
        },
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">🔍 Backlog Search</h1>

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

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search backlog items…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full rounded-md border border-border bg-muted py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Searching…
        </div>
      )}

      {!isLoading && query.length === 0 && (
        <p className="text-sm text-muted-foreground">Type a query to search backlog items.</p>
      )}

      {!isLoading && query.length > 0 && results.length === 0 && (
        <p className="text-sm text-muted-foreground">No results found for &ldquo;{query}&rdquo;.</p>
      )}

      {!isLoading && results.length > 0 && (
        <DataTable
          columns={columns}
          data={results}
          onRowClick={(row) => navigate(`/backlog/item/${row.id}`)}
        />
      )}
    </div>
  );
}
