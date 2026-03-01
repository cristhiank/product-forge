import { useQuery } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { api } from "@/lib/api";
import { DataTable } from "@/components/DataTable";
import { DollarSign, Loader2 } from "lucide-react";
import { useMemo } from "react";

interface WorkerCost {
  id: string;
  agentType?: string;
  status?: string;
  toolCalls?: number;
  turns?: number;
  tokens?: number;
  errors?: number;
}

export function CostsPage() {
  const { data, isLoading, error } = useQuery<WorkerCost[]>({
    queryKey: ["agents", "costs"],
    queryFn: () => api.get("/api/agents/costs"),
  });

  const totals = useMemo(() => {
    if (!data || data.length === 0) return null;
    return {
      toolCalls: data.reduce((s, w) => s + (w.toolCalls ?? 0), 0),
      turns: data.reduce((s, w) => s + (w.turns ?? 0), 0),
      tokens: data.reduce((s, w) => s + (w.tokens ?? 0), 0),
      errors: data.reduce((s, w) => s + (w.errors ?? 0), 0),
    };
  }, [data]);

  const columns = useMemo<ColumnDef<WorkerCost, unknown>[]>(
    () => [
      {
        accessorKey: "id",
        header: "Worker ID",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">{String(getValue())}</span>
        ),
      },
      {
        accessorKey: "agentType",
        header: "Type",
        cell: ({ getValue }) => String(getValue() ?? "—"),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => String(getValue() ?? "—"),
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
        accessorKey: "tokens",
        header: "Tokens",
        cell: ({ getValue }) => {
          const v = getValue() as number | undefined;
          return v != null ? v.toLocaleString() : "—";
        },
      },
      {
        accessorKey: "errors",
        header: "Errors",
        cell: ({ getValue }) => getValue() ?? 0,
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">💰 Costs</h1>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading cost data…
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          Failed to load costs: {(error as Error).message}
        </div>
      )}

      {data && data.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <DollarSign className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">
            No cost data available. Costs will appear once agents are spawned.
          </p>
        </div>
      )}

      {data && data.length > 0 && (
        <>
          {/* Aggregate metrics */}
          {totals && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-xl border border-border bg-card p-4 text-center">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Tool Calls</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{totals.toolCalls}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 text-center">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Turns</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{totals.turns}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 text-center">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Tokens</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{totals.tokens.toLocaleString()}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 text-center">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Errors</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{totals.errors}</p>
              </div>
            </div>
          )}

          <DataTable columns={columns} data={data} />
        </>
      )}
    </div>
  );
}
