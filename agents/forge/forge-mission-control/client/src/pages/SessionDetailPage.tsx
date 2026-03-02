import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronRight,
  Loader2,
  Terminal,
  GitBranch,
  Wrench,
  Users,
  AlertTriangle,
  Scissors,
  Clock,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { SessionDetail, Turn } from "@/types/sessions";
import { TurnCard } from "@/components/sessions/TurnCard";
import { ToolCallsTab } from "@/components/sessions/ToolCallsTab";
import { AgentsTab } from "@/components/sessions/AgentsTab";
import { ContextTab } from "@/components/sessions/ContextTab";
import { AnalyticsTab } from "@/components/sessions/AnalyticsTab";

// ── helpers ──────────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.round((ms % 60_000) / 1000);
  if (mins < 60) return `${mins}m ${secs}s`;
  const hrs = Math.floor(mins / 60);
  const m = mins % 60;
  return `${hrs}h ${m}m`;
}

function lastTwoSegments(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts.slice(-2).join("/");
}

// ── KPI stat card ─────────────────────────────────────────────────────────────

interface StatBlockProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  danger?: boolean;
}

function StatBlock({ label, value, icon, danger }: StatBlockProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-lg border px-4 py-2 min-w-[80px]",
        danger && Number(value) > 0
          ? "border-red-500/30 bg-red-500/10"
          : "border-border bg-card",
      )}
    >
      <div
        className={cn(
          "mb-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider",
          danger && Number(value) > 0 ? "text-red-400" : "text-muted-foreground",
        )}
      >
        {icon}
        {label}
      </div>
      <span
        className={cn(
          "text-xl font-bold tabular-nums",
          danger && Number(value) > 0 ? "text-red-400" : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ── Tab bar ──────────────────────────────────────────────────────────────────

type TabId = "timeline" | "tools" | "agents" | "context" | "analytics";

const TABS: { id: TabId; label: string }[] = [
  { id: "timeline", label: "Timeline" },
  { id: "tools", label: "Tool Calls" },
  { id: "agents", label: "Agents" },
  { id: "context", label: "Context" },
  { id: "analytics", label: "Analytics" },
];

// ── Timeline tab ─────────────────────────────────────────────────────────────

function TimelineTab({ sessionId }: { sessionId: string }) {
  const { data: turns, isLoading, error } = useQuery<Turn[]>({
    queryKey: ["sessions", sessionId, "timeline"],
    queryFn: () => api.get(`/api/sessions/${sessionId}/timeline`),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading timeline…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
        Failed to load timeline: {(error as Error).message}
      </div>
    );
  }

  if (!turns || turns.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No turns recorded for this session.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {turns.map((turn, i) => (
        <TurnCard key={turn.turnId} turn={turn} index={i} />
      ))}
    </div>
  );
}

// ── Placeholder tab ───────────────────────────────────────────────────────────
// (removed — all tabs are now implemented)

// ── Main page ─────────────────────────────────────────────────────────────────

export function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<TabId>("timeline");

  const { data, isLoading, error } = useQuery<SessionDetail>({
    queryKey: ["sessions", id],
    queryFn: () => api.get(`/api/sessions/${id}`),
    enabled: !!id,
  });

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link to="/sessions" className="transition-colors hover:text-foreground">
          Sessions
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-mono text-xs text-foreground">{id ?? "—"}</span>
      </nav>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading session…
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          Failed to load session: {(error as Error).message}
        </div>
      )}

      {data && (
        <>
          {/* Summary heading */}
          <h1 className="text-xl font-bold leading-tight">{data.summary || id}</h1>

          {/* KPI header */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex flex-wrap gap-3">
              <StatBlock
                label="Turns"
                value={data.stats.turns}
                icon={<Terminal className="h-3 w-3" />}
              />
              <StatBlock
                label="Tools"
                value={data.stats.toolCalls}
                icon={<Wrench className="h-3 w-3" />}
              />
              <StatBlock
                label="Skills"
                value={data.stats.skills}
                icon={<Terminal className="h-3 w-3" />}
              />
              <StatBlock
                label="Agents"
                value={data.stats.subagents}
                icon={<Users className="h-3 w-3" />}
              />
              <StatBlock
                label="Errors"
                value={data.stats.errors}
                icon={<AlertTriangle className="h-3 w-3" />}
                danger
              />
              <StatBlock
                label="Compacted"
                value={data.stats.compactions}
                icon={<Scissors className="h-3 w-3" />}
              />
              <StatBlock
                label="Duration"
                value={formatDuration(data.stats.duration)}
                icon={<Clock className="h-3 w-3" />}
              />
            </div>

            {/* Metadata line */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground border-t border-border pt-3">
              {data.models.map((m) => (
                <span
                  key={m}
                  className="rounded-md border border-border bg-muted/50 px-2 py-0.5 font-mono text-[11px]"
                >
                  {m}
                </span>
              ))}
              <span className="flex items-center gap-1 font-mono">
                <GitBranch className="h-3 w-3" />
                {data.branch}
              </span>
              <span className="font-mono">{lastTwoSegments(data.cwd)}</span>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex border-b border-border">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-colors",
                  activeTab === tab.id
                    ? "border-b-2 border-primary text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div>
            {activeTab === "timeline" && id && <TimelineTab sessionId={id} />}
            {activeTab === "tools" && id && (
              <ToolCallsTab sessionId={id} detail={data} />
            )}
            {activeTab === "agents" && id && (
              <AgentsTab sessionId={id} detail={data} />
            )}
            {activeTab === "context" && <ContextTab detail={data} />}
            {activeTab === "analytics" && id && (
              <AnalyticsTab sessionId={id} detail={data} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
