import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { type ColumnDef } from "@tanstack/react-table";
import { Terminal, Loader2, GitBranch } from "lucide-react";
import { api } from "@/lib/api";
import { DataTable } from "@/components/DataTable";
import { cn } from "@/lib/utils";
import type { SessionSummary } from "@/types/sessions";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function lastTwoSegments(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts.slice(-2).join("/");
}

export function SessionsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = useQuery<SessionSummary[]>({
    queryKey: ["sessions"],
    queryFn: () => api.get("/api/sessions"),
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.toLowerCase();
    if (!q) return data;
    return data.filter((s) => s.summary.toLowerCase().includes(q));
  }, [data, search]);

  const columns = useMemo<ColumnDef<SessionSummary, unknown>[]>(
    () => [
      {
        id: "status",
        header: "",
        size: 32,
        cell: () => (
          <span
            className="inline-block h-2 w-2 rounded-full bg-blue-400"
            title="Session"
          />
        ),
      },
      {
        accessorKey: "summary",
        header: "Summary",
        cell: ({ getValue }) => {
          const v = String(getValue() ?? "");
          return (
            <span className="font-medium">
              {v.length > 60 ? v.slice(0, 60) + "…" : v}
            </span>
          );
        },
      },
      {
        accessorKey: "branch",
        header: "Branch",
        size: 120,
        cell: ({ getValue }) => {
          const v = String(getValue() ?? "—");
          return (
            <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
              <GitBranch className="h-3 w-3 shrink-0" />
              <span className="truncate max-w-[100px]">{v}</span>
            </span>
          );
        },
      },
      {
        accessorKey: "updatedAt",
        header: "Updated",
        size: 100,
        sortingFn: "datetime",
        cell: ({ getValue }) => (
          <span className="text-xs text-muted-foreground">
            {relativeTime(String(getValue() ?? ""))}
          </span>
        ),
      },
      {
        accessorKey: "cwd",
        header: "CWD",
        size: 200,
        cell: ({ getValue }) => (
          <span className="font-mono text-xs text-muted-foreground truncate block max-w-[190px]">
            {lastTwoSegments(String(getValue() ?? ""))}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Terminal className="h-6 w-6" />
          Sessions
        </h1>
        <input
          type="search"
          placeholder="Filter by summary…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={cn(
            "w-64 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-sm",
            "placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary",
          )}
        />
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading sessions…
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          Failed to load sessions: {(error as Error).message}
        </div>
      )}

      {data && data.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Terminal className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">No sessions found.</p>
        </div>
      )}

      {filtered.length > 0 && (
        <DataTable
          columns={columns}
          data={filtered}
          onRowClick={(row) => navigate(`/sessions/${row.id}`)}
        />
      )}

      {data && data.length > 0 && filtered.length === 0 && search && (
        <p className="text-sm text-muted-foreground">
          No sessions match "{search}".
        </p>
      )}
    </div>
  );
}
