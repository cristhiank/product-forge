import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bot,
  CheckCircle2,
  XCircle,
  Circle,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { SessionDetail, Turn } from "@/types/sessions";

// ── helpers ───────────────────────────────────────────────────────────────────

function formatDuration(ms?: number): string {
  if (ms === undefined) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

function durationColor(ms?: number): string {
  if (ms === undefined) return "text-muted-foreground";
  if (ms < 1000) return "text-green-500";
  if (ms < 10_000) return "text-yellow-500";
  return "text-red-500";
}

function agentBorderColor(name: string): string {
  if (name.includes("explore")) return "border-l-blue-500";
  if (name.includes("task")) return "border-l-green-500";
  if (name.includes("general")) return "border-l-purple-500";
  if (name.includes("code-review") || name.includes("review"))
    return "border-l-amber-500";
  return "border-l-border";
}

function agentBadgeColor(name: string): string {
  if (name.includes("explore"))
    return "bg-blue-500/15 text-blue-400 border-blue-500/30";
  if (name.includes("task"))
    return "bg-green-500/15 text-green-400 border-green-500/30";
  if (name.includes("general"))
    return "bg-purple-500/15 text-purple-400 border-purple-500/30";
  if (name.includes("code-review") || name.includes("review"))
    return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-muted text-muted-foreground border-border";
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface FlatSubagentCall {
  toolCallId: string;
  toolName: string;
  subagentName?: string;
  subagentDisplayName?: string;
  success?: boolean;
  duration?: number;
  turnIndex: number;
  result?: string;
  arguments: unknown;
}

// ── Invocation row ────────────────────────────────────────────────────────────

function AgentInvocationRow({ call }: { call: FlatSubagentCall }) {
  const [open, setOpen] = useState(false);
  const displayName =
    call.subagentDisplayName ?? call.subagentName ?? call.toolName;
  const agentType = call.subagentName ?? "";

  return (
    <div
      className={cn(
        "rounded-xl border border-border overflow-hidden border-l-4",
        agentBorderColor(agentType),
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30"
      >
        <span
          className={cn(
            "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
            agentBadgeColor(agentType),
          )}
        >
          {agentType || "agent"}
        </span>
        <span className="flex-1 truncate text-sm">{displayName}</span>
        <span className="text-xs text-muted-foreground">
          Turn {call.turnIndex}
        </span>
        <span
          className={cn(
            "tabular-nums text-xs",
            durationColor(call.duration),
          )}
        >
          {formatDuration(call.duration)}
        </span>
        {call.success === true ? (
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" />
        ) : call.success === false ? (
          <XCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
        ) : (
          <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="space-y-2 border-t border-border bg-muted/10 px-4 pb-3 pt-2">
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Arguments
            </p>
            <pre className="overflow-x-auto rounded-md bg-black/30 p-2 font-mono text-[11px] leading-relaxed text-foreground/80 whitespace-pre-wrap break-all">
              {(JSON.stringify(call.arguments, null, 2) ?? "").slice(0, 1000)}
            </pre>
          </div>
          {call.result !== undefined && (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Result
              </p>
              <pre className="overflow-x-auto rounded-md bg-black/30 p-2 font-mono text-[11px] leading-relaxed text-foreground/80 whitespace-pre-wrap break-all">
                {call.result.slice(0, 1000)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────

interface AgentsTabProps {
  sessionId: string;
  detail: SessionDetail;
}

export function AgentsTab({ sessionId, detail }: AgentsTabProps) {
  const { data: turns, isLoading } = useQuery<Turn[]>({
    queryKey: ["sessions", sessionId, "timeline"],
    queryFn: () => api.get(`/api/sessions/${sessionId}/timeline`),
  });

  const subagentCalls = useMemo<FlatSubagentCall[]>(() => {
    if (!turns) return [];
    const result: FlatSubagentCall[] = [];
    turns.forEach((turn, ti) => {
      turn.assistantMessages.forEach((msg) => {
        msg.toolGroups.forEach((group) => {
          group.calls.forEach((call) => {
            if (call.isSubagent) {
              result.push({
                toolCallId: call.toolCallId,
                toolName: call.toolName,
                subagentName: call.subagentName,
                subagentDisplayName: call.subagentDisplayName,
                success: call.success,
                duration: call.duration,
                turnIndex: ti + 1,
                result: call.result,
                arguments: call.arguments,
              });
            }
          });
        });
      });
    });
    return result;
  }, [turns]);

  if (detail.stats.subagents === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <Bot className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          No sub-agents were spawned in this session.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section A: Agent Summary Cards */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          Agent Summary
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {detail.subagentBreakdown.map((agent) => (
            <div
              key={agent.agentName}
              className={cn(
                "rounded-xl border border-border bg-card p-4 border-l-4",
                agentBorderColor(agent.agentName),
              )}
            >
              <div className="mb-2 flex items-center gap-2">
                <Bot className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-xs font-medium text-foreground">
                  {agent.agentName}
                </span>
              </div>
              <p className="text-2xl font-bold tabular-nums">{agent.count}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                invocations
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Section B: Agent Invocations Timeline */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          Agent Invocations
        </h2>
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : subagentCalls.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No agent invocations found in timeline.
          </p>
        ) : (
          <div className="space-y-2">
            {subagentCalls.map((call, i) => (
              <AgentInvocationRow key={`${call.toolCallId}-${i}`} call={call} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
