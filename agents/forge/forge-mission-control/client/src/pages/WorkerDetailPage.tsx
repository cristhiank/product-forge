import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ChevronRight, Loader2, Terminal } from "lucide-react";

interface Worker {
  id: string;
  agentType?: string;
  status?: string;
  pid?: number;
  worktree?: string;
  toolCalls?: number;
  turns?: number;
  errors?: number;
  tokens?: number;
}

interface WorkerDetail {
  worker: Worker;
  log: string[];
}

const statusColors: Record<string, string> = {
  active: "bg-green-500/15 text-green-400 border-green-500/30",
  completed: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  failed: "bg-red-500/15 text-red-400 border-red-500/30",
  lost: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
};

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-center">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

export function WorkerDetailPage() {
  const { id } = useParams();
  const { data, isLoading, error } = useQuery<WorkerDetail>({
    queryKey: ["agents", "worker", id],
    queryFn: () => api.get(`/api/agents/worker/${id}`),
    enabled: !!id,
  });

  const worker = data?.worker;
  const log = data?.log ?? [];
  const status = worker?.status ?? "unknown";

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link to="/agents" className="hover:text-foreground transition-colors">
          Agents
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-mono text-foreground">{id ?? "—"}</span>
      </nav>

      <h1 className="text-2xl font-bold">Worker Detail</h1>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading worker…
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          Failed to load worker: {(error as Error).message}
        </div>
      )}

      {worker && (
        <>
          {/* Metadata card */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-5">
              <div>
                <p className="text-xs text-muted-foreground">ID</p>
                <p className="font-mono">{worker.id}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Agent Type</p>
                <p>{worker.agentType ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize",
                    statusColors[status] ?? "bg-muted text-muted-foreground border-border",
                  )}
                >
                  {status}
                </span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">PID</p>
                <p className="font-mono">{worker.pid ?? "—"}</p>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <p className="text-xs text-muted-foreground">Worktree</p>
                <p className="truncate font-mono text-xs">{worker.worktree ?? "—"}</p>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Tool Calls" value={worker.toolCalls ?? 0} />
            <StatCard label="Turns" value={worker.turns ?? 0} />
            <StatCard label="Errors" value={worker.errors ?? 0} />
            <StatCard label="Tokens" value={worker.tokens ?? "—"} />
          </div>

          {/* Log viewer */}
          <div className="space-y-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Terminal className="h-4 w-4" />
              Log Output
            </h2>
            <div className="max-h-96 overflow-auto rounded-xl border border-border bg-black/40 p-4 font-mono text-xs leading-relaxed text-green-400">
              {log.length === 0 ? (
                <p className="text-muted-foreground">No log output available.</p>
              ) : (
                log.map((line, i) => (
                  <div key={i} className="whitespace-pre-wrap">
                    {line}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
