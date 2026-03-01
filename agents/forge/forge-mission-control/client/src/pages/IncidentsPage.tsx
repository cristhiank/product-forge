import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

interface Worker {
  id: string;
  agentType?: string;
  status?: string;
  errors?: number;
  lastActivity?: string;
}

interface HubMessage {
  timestamp?: string;
  author?: string;
  channel?: string;
  type?: string;
  content?: string;
}

interface IncidentsData {
  workers: Worker[];
  messages: HubMessage[];
}

export function IncidentsPage() {
  const { data, isLoading, error } = useQuery<IncidentsData>({
    queryKey: ["agents", "incidents"],
    queryFn: () => api.get("/api/agents/incidents"),
  });

  const failedWorkers = data?.workers?.filter(
    (w) => w.status === "failed" || w.status === "lost" || (w.errors ?? 0) > 0,
  ) ?? [];
  const errorMessages = data?.messages?.filter(
    (m) => m.type === "error" || m.channel === "errors",
  ) ?? [];
  const hasIncidents = failedWorkers.length > 0 || errorMessages.length > 0;
  const hasData = data != null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">🚨 Incidents</h1>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading incidents…
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          Failed to load incidents: {(error as Error).message}
        </div>
      )}

      {hasData && !hasIncidents && (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-green-400" />
          <p className="text-muted-foreground">No incidents. All systems nominal. ✅</p>
        </div>
      )}

      {hasData && hasIncidents && (
        <>
          {/* Failed workers */}
          {failedWorkers.length > 0 && (
            <div className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle className="h-4 w-4 text-red-400" />
                Failed / Lost Workers ({failedWorkers.length})
              </h2>
              <div className="space-y-2">
                {failedWorkers.map((w) => (
                  <div
                    key={w.id}
                    className={cn(
                      "rounded-xl border p-4 text-sm",
                      w.status === "failed"
                        ? "border-red-500/30 bg-red-500/10"
                        : "border-yellow-500/30 bg-yellow-500/10",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs">{w.id}</span>
                      <span className="text-xs capitalize text-muted-foreground">
                        {w.status} · {w.agentType ?? "unknown type"}
                      </span>
                    </div>
                    {(w.errors ?? 0) > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {w.errors} error{w.errors !== 1 ? "s" : ""} reported
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error messages */}
          {errorMessages.length > 0 && (
            <div className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle className="h-4 w-4 text-yellow-400" />
                Error Messages ({errorMessages.length})
              </h2>
              <div className="space-y-2">
                {errorMessages.map((m, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-border bg-card p-4 text-sm"
                  >
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-mono">{m.author ?? "unknown"}</span>
                      <span>
                        {m.timestamp
                          ? new Date(m.timestamp).toLocaleString()
                          : "—"}
                      </span>
                    </div>
                    <p className="mt-1">{m.content ?? "—"}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
