import { useQuery } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { api } from "@/lib/api";
import { DataTable } from "@/components/DataTable";
import { Loader2, MessageSquare } from "lucide-react";
import { useMemo } from "react";

interface HubMessage {
  timestamp?: string;
  author?: string;
  channel?: string;
  type?: string;
  content?: string;
}

export function MessagesPage() {
  const { data, isLoading, error } = useQuery<HubMessage[]>({
    queryKey: ["agents", "messages"],
    queryFn: () => api.get("/api/agents/messages"),
  });

  const columns = useMemo<ColumnDef<HubMessage, unknown>[]>(
    () => [
      {
        accessorKey: "timestamp",
        header: "Timestamp",
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
      {
        accessorKey: "author",
        header: "Author",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">{String(getValue() ?? "—")}</span>
        ),
      },
      {
        accessorKey: "channel",
        header: "Channel",
        cell: ({ getValue }) => String(getValue() ?? "—"),
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ getValue }) => (
          <span className="inline-flex rounded-full border border-border bg-muted px-2 py-0.5 text-xs">
            {String(getValue() ?? "—")}
          </span>
        ),
      },
      {
        accessorKey: "content",
        header: "Content",
        cell: ({ getValue }) => {
          const v = String(getValue() ?? "");
          return (
            <span className="block max-w-md truncate" title={v}>
              {v || "—"}
            </span>
          );
        },
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">💬 Hub Messages</h1>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading messages…
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          Failed to load messages: {(error as Error).message}
        </div>
      )}

      {data && data.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <MessageSquare className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">No hub messages found.</p>
        </div>
      )}

      {data && data.length > 0 && <DataTable columns={columns} data={data} />}
    </div>
  );
}
