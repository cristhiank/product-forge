import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { type ColumnDef } from "@tanstack/react-table";
import { api } from "@/lib/api";
import { DataTable } from "@/components/DataTable";
import { Bot, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

interface Worker {
  id: string;
  agentType?: string;
  status?: string;
  toolCalls?: number;
  turns?: number;
  errors?: number;
  lastActivity?: string;
}

const statusColors: Record<string, string> = {
  active: "bg-green-500/15 text-green-400 border-green-500/30",
  completed: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  failed: "bg-red-500/15 text-red-400 border-red-500/30",
  lost: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
};

function StatusBadge({ status }: { status?: string }) {
  const s = status ?? "unknown";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize",
        statusColors[s] ?? "bg-muted text-muted-foreground border-border",
      )}
    >
      {s}
    </span>
  );
}

export function AgentsPage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery<Worker[]>({
    queryKey: ["agents", "workers"],
    queryFn: () => api.get("/api/agents/workers"),
  });

  const columns = useMemo<ColumnDef<Worker, unknown>[]>(
    () => [
      {
        accessorKey: "id",
        header: "ID",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">{String(getValue())}</span>
        ),
      },
      {
        accessorKey: "agentType",
        header: "Agent Type",
        cell: ({ getValue }) => String(getValue() ?? "—"),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
      },
      {
        accessorKey: "toolCalls",
        header: "Tool Calls",
        cell: ({ getValue }) => getValue() ?? 0,
      },
      {
        accessorKey: "turns",
        header: "Turns",
        cell: ({ getValue }) => getValue() ?? 0,
      },
      {
        accessorKey: "errors",
        header: "Errors",
        cell: ({ getValue }) => getValue() ?? 0,
      },
      {
        accessorKey: "lastActivity",
        header: "Last Activity",
        cell: ({ getValue }) => {
          const v = getValue() as string | undefined;
          if (!v) return "—";
          try {
            return new Date(v).toLocaleString();
          } catch {
            return v;
          }
        },
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">🤖 Agents & Workers</h1>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading agents…
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          Failed to load agents: {(error as Error).message}
        </div>
      )}

      {data && data.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Bot className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">
            No agents found. Agent data will appear when workers are spawned in this project.
          </p>
        </div>
      )}

      {data && data.length > 0 && (
        <DataTable
          columns={columns}
          data={data}
          onRowClick={(row) => navigate(`/agents/worker/${row.id}`)}
        />
      )}
    </div>
  );
}
