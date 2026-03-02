import { useState } from "react";
import { CheckCircle2, XCircle, Circle, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToolCallGroup as ToolCallGroupType, ToolCall } from "@/types/sessions";

function durationColor(ms?: number): string {
  if (ms === undefined) return "text-muted-foreground";
  if (ms < 1000) return "text-green-500";
  if (ms < 10000) return "text-yellow-500";
  return "text-red-500";
}

function formatDuration(ms?: number): string {
  if (ms === undefined) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function ToolCallRow({ call }: { call: ToolCall }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-border/50 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-muted/50 transition-colors"
      >
        {/* Status icon */}
        {call.success === true ? (
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" />
        ) : call.success === false ? (
          <XCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
        ) : (
          <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}

        {/* Tool name */}
        <span className="font-mono text-xs font-medium flex-1">
          {call.toolName}
        </span>

        {/* Subagent badge */}
        {call.isSubagent && (
          <span className="rounded-md bg-secondary/60 px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground border border-border/50">
            {call.subagentDisplayName ?? call.subagentName ?? "agent"}
          </span>
        )}

        {/* Duration */}
        <span className={cn("text-xs tabular-nums", durationColor(call.duration))}>
          {formatDuration(call.duration)}
        </span>

        {/* Expand indicator */}
        {open ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 space-y-2">
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Arguments
            </p>
            <pre className="overflow-x-auto rounded-md bg-black/30 p-2 font-mono text-[11px] leading-relaxed text-foreground/80 whitespace-pre-wrap break-all">
              {truncate(
                JSON.stringify(call.arguments, null, 2) ?? "",
                800,
              )}
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
      )}
    </div>
  );
}

interface ToolCallGroupProps {
  group: ToolCallGroupType;
}

export function ToolCallGroup({ group }: ToolCallGroupProps) {
  return (
    <div
      className={cn(
        "my-1.5 rounded-md border border-border overflow-hidden",
        group.parallel && "border-l-2 border-l-primary",
      )}
    >
      {group.parallel && group.calls.length > 1 && (
        <div className="flex items-center gap-1.5 border-b border-border bg-primary/5 px-3 py-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
            {group.calls.length} parallel
          </span>
        </div>
      )}
      {group.calls.map((call) => (
        <ToolCallRow key={call.toolCallId} call={call} />
      ))}
    </div>
  );
}
