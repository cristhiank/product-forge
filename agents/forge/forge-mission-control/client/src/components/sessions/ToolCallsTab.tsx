import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  XCircle,
  Circle,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";
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

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
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

// ── Expanded row content ──────────────────────────────────────────────────────

function ToolCallExpandRow({
  call,
  index,
}: {
  call: FlatToolCall;
  index: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr
        className={cn(
          "cursor-pointer transition-colors hover:bg-muted/30",
          call.success === false && "bg-red-500/5",
        )}
        onClick={() => setOpen((v) => !v)}
      >
        <td className="px-4 py-2 text-xs text-muted-foreground tabular-nums">
          {index + 1}
        </td>
        <td className="px-4 py-2 font-mono text-xs">{call.toolName}</td>
        <td className="px-4 py-2 text-center">
          {call.success === true ? (
            <CheckCircle2 className="mx-auto h-3.5 w-3.5 text-green-500" />
          ) : call.success === false ? (
            <XCircle className="mx-auto h-3.5 w-3.5 text-red-500" />
          ) : (
            <Circle className="mx-auto h-3.5 w-3.5 text-muted-foreground" />
          )}
        </td>
        <td
          className={cn(
            "px-4 py-2 text-right text-xs tabular-nums",
            durationColor(call.duration),
          )}
        >
          {formatDuration(call.duration)}
        </td>
        <td className="px-4 py-2 text-right text-xs text-muted-foreground tabular-nums">
          {call.turnIndex}
        </td>
        <td className="px-3 py-2 text-right">
          {open ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          )}
        </td>
      </tr>
      {open && (
        <tr
          className={cn(
            call.success === false ? "bg-red-500/5" : "bg-muted/20",
          )}
        >
          <td colSpan={6} className="px-4 pb-3 pt-1">
            <div className="space-y-2">
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Arguments
                </p>
                <pre className="overflow-x-auto rounded-md bg-black/30 p-2 font-mono text-[11px] leading-relaxed text-foreground/80 whitespace-pre-wrap break-all">
                  {truncate(JSON.stringify(call.arguments, null, 2) ?? "", 800)}
                </pre>
              </div>
              {call.result !== undefined && (
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Result
                  </p>
                  <pre className="overflow-x-auto rounded-md bg-black/30 p-2 font-mono text-[11px] leading-relaxed text-foreground/80 whitespace-pre-wrap break-all">
                    {truncate(call.result, 800)}
                  </pre>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────

interface ToolCallsTabProps {
  sessionId: string;
  detail: SessionDetail;
}

export function ToolCallsTab({ sessionId, detail }: ToolCallsTabProps) {
  const { data: turns, isLoading } = useQuery<Turn[]>({
    queryKey: ["sessions", sessionId, "timeline"],
    queryFn: () => api.get(`/api/sessions/${sessionId}/timeline`),
  });

  const flatCalls = useMemo<FlatToolCall[]>(
    () => (turns ? flattenCalls(turns) : []),
    [turns],
  );

  const sortedBreakdown = useMemo(
    () => [...detail.toolBreakdown].sort((a, b) => b.count - a.count),
    [detail.toolBreakdown],
  );

  const [filterName, setFilterName] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [sortByDuration, setSortByDuration] = useState(false);

  const toolNames = useMemo(
    () => ["all", ...Array.from(new Set(flatCalls.map((c) => c.toolName)))],
    [flatCalls],
  );

  const filteredCalls = useMemo(() => {
    let calls = flatCalls;
    if (filterName !== "all") calls = calls.filter((c) => c.toolName === filterName);
    if (filterStatus === "success") calls = calls.filter((c) => c.success === true);
    if (filterStatus === "fail") calls = calls.filter((c) => c.success === false);
    if (sortByDuration)
      calls = [...calls].sort((a, b) => (b.duration ?? 0) - (a.duration ?? 0));
    return calls;
  }, [flatCalls, filterName, filterStatus, sortByDuration]);

  return (
    <div className="space-y-6">
      {/* Section A: Breakdown table */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          Tool Usage Breakdown
        </h2>
        {sortedBreakdown.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tool calls recorded.</p>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Tool
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Count
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Success
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Failed
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Avg Duration
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    MCP
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedBreakdown.map((tool) => (
                  <tr
                    key={tool.name}
                    className="transition-colors hover:bg-muted/30"
                  >
                    <td className="px-4 py-2 font-mono text-xs">{tool.name}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {tool.count}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-green-500">
                      {tool.successCount}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-2 text-right tabular-nums",
                        tool.failCount > 0
                          ? "text-red-500"
                          : "text-muted-foreground",
                      )}
                    >
                      {tool.failCount}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-2 text-right tabular-nums text-xs",
                        durationColor(tool.avgDuration),
                      )}
                    >
                      {formatDuration(tool.avgDuration)}
                    </td>
                    <td className="px-4 py-2">
                      {tool.isMcp && (
                        <span className="inline-flex items-center rounded-full border border-violet-500/30 bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium text-violet-400">
                          {tool.mcpServer ?? "MCP"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Section B: Tool call list */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          All Tool Calls
        </h2>

        {/* Filters */}
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <select
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {toolNames.map((n) => (
              <option key={n} value={n}>
                {n === "all" ? "All tools" : n}
              </option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All statuses</option>
            <option value="success">Success</option>
            <option value="fail">Failed</option>
          </select>
          <label className="flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={sortByDuration}
              onChange={(e) => setSortByDuration(e.target.checked)}
              className="rounded border-border"
            />
            Sort by duration
          </label>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading calls…
          </div>
        ) : filteredCalls.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tool calls match the filter.
          </p>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="w-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    #
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Tool
                  </th>
                  <th className="w-16 px-4 py-2 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Status
                  </th>
                  <th className="w-24 px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Duration
                  </th>
                  <th className="w-16 px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Turn
                  </th>
                  <th className="w-8 px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredCalls.map((call, i) => (
                  <ToolCallExpandRow
                    key={`${call.toolCallId}-${i}`}
                    call={call}
                    index={i}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
