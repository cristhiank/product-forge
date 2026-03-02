import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Circle, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { SessionDetail, Turn, ToolCall } from "@/types/sessions";

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

interface FlatToolCall extends ToolCall {
  turnIndex: number;
}

function flattenCalls(turns: Turn[]): FlatToolCall[] {
  const result: FlatToolCall[] = [];
  turns.forEach((turn, ti) => {
    turn.assistantMessages.forEach((msg) => {
      msg.toolGroups.forEach((group) => {
        group.calls.forEach((call) => {
          result.push({ ...call, turnIndex: ti + 1 });
        });
      });
    });
  });
  return result;
}

// ── Main tab ──────────────────────────────────────────────────────────────────

interface AnalyticsTabProps {
  sessionId: string;
  detail: SessionDetail;
}

export function AnalyticsTab({ sessionId, detail }: AnalyticsTabProps) {
  const { data: turns, isLoading } = useQuery<Turn[]>({
    queryKey: ["sessions", sessionId, "timeline"],
    queryFn: () => api.get(`/api/sessions/${sessionId}/timeline`),
  });

  const flatCalls = useMemo<FlatToolCall[]>(
    () => (turns ? flattenCalls(turns) : []),
    [turns],
  );

  const slowestCalls = useMemo(
    () =>
      [...flatCalls]
        .filter((c) => c.duration !== undefined)
        .sort((a, b) => (b.duration ?? 0) - (a.duration ?? 0))
        .slice(0, 10),
    [flatCalls],
  );

  const builtinTools = detail.toolBreakdown.filter((t) => !t.isMcp);
  const mcpTools = detail.toolBreakdown.filter((t) => t.isMcp);

  const topTools = useMemo(
    () => [...detail.toolBreakdown].sort((a, b) => b.count - a.count).slice(0, 20),
    [detail.toolBreakdown],
  );
  const maxCount = topTools.reduce((m, t) => Math.max(m, t.count), 1);

  // Group MCP tools by server
  const mcpByServer = useMemo(() => {
    const acc: Record<string, { count: number; success: number }> = {};
    mcpTools.forEach((t) => {
      const server = t.mcpServer ?? "unknown";
      if (!acc[server]) acc[server] = { count: 0, success: 0 };
      acc[server].count += t.count;
      acc[server].success += t.successCount;
    });
    return acc;
  }, [mcpTools]);

  const totalMcpCalls = mcpTools.reduce((s, t) => s + t.count, 0);

  return (
    <div className="space-y-6">
      {/* Section A: Tool Frequency Bars */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          Tool Frequency
        </h2>
        {topTools.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tool calls recorded.
          </p>
        ) : (
          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            {topTools.map((tool) => (
              <div key={tool.name} className="flex items-center gap-3">
                <span className="w-48 shrink-0 truncate text-right font-mono text-xs text-muted-foreground">
                  {tool.name}
                </span>
                <div className="h-5 flex-1 overflow-hidden rounded-sm bg-muted/30">
                  <div
                    className={cn(
                      "h-full rounded-sm transition-all",
                      tool.isMcp ? "bg-violet-500/70" : "bg-primary/70",
                    )}
                    style={{ width: `${(tool.count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-right tabular-nums text-xs text-muted-foreground">
                  {tool.count}
                </span>
              </div>
            ))}
            {detail.toolBreakdown.length > 20 && (
              <p className="pt-1 text-center text-xs text-muted-foreground">
                +{detail.toolBreakdown.length - 20} more tools
              </p>
            )}
            <div className="mt-2 flex gap-4 border-t border-border pt-2">
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-primary/70" />
                Built-in ({builtinTools.length})
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-violet-500/70" />
                MCP ({mcpTools.length})
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Section B: MCP Server Distribution */}
      {Object.keys(mcpByServer).length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            MCP Server Distribution
          </h2>
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            {Object.entries(mcpByServer).map(([server, stats]) => {
              const pct =
                totalMcpCalls > 0 ? (stats.count / totalMcpCalls) * 100 : 0;
              const successRate =
                stats.count > 0
                  ? Math.round((stats.success / stats.count) * 100)
                  : 0;
              return (
                <div key={server}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-mono text-xs">{server}</span>
                    <span className="text-xs text-muted-foreground">
                      {stats.count} calls · {successRate}% success
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-sm bg-muted/30">
                    <div
                      className="h-full rounded-sm bg-violet-500/70 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Section C: Skills Used */}
      {detail.skillsUsed.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Skills Used
          </h2>
          <div className="flex flex-wrap gap-2">
            {detail.skillsUsed.map((skill) => (
              <span
                key={skill.name}
                className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/15 px-3 py-1 text-xs font-medium text-violet-400"
              >
                {skill.name}
                <span className="rounded-full bg-violet-500/30 px-1.5 py-0.5 text-[10px] font-bold">
                  {skill.count}
                </span>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Section D: Performance Summary */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          Slowest Tool Calls
        </h2>
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : slowestCalls.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No timed calls found.
          </p>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Tool
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Duration
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Turn
                  </th>
                  <th className="px-4 py-2 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {slowestCalls.map((call, i) => (
                  <tr
                    key={`${call.toolCallId}-${i}`}
                    className="transition-colors hover:bg-muted/30"
                  >
                    <td className="px-4 py-2 font-mono text-xs">
                      {call.toolName}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-2 text-right text-xs tabular-nums font-semibold",
                        durationColor(call.duration),
                      )}
                    >
                      {formatDuration(call.duration)}
                    </td>
                    <td className="px-4 py-2 text-right text-xs tabular-nums text-muted-foreground">
                      {call.turnIndex}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {call.success === true ? (
                        <CheckCircle2 className="mx-auto h-3.5 w-3.5 text-green-500" />
                      ) : call.success === false ? (
                        <XCircle className="mx-auto h-3.5 w-3.5 text-red-500" />
                      ) : (
                        <Circle className="mx-auto h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
