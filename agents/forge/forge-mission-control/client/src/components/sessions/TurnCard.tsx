import { useState } from "react";
import { cn } from "@/lib/utils";
import { ToolCallGroup } from "@/components/sessions/ToolCallGroup";
import type { Turn, InlineEvent } from "@/types/sessions";

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function EventChip({ event }: { event: InlineEvent }) {
  const d = event.data ?? {};

  switch (event.type) {
    case "skill.invoked":
      return (
        <span className="inline-flex items-center rounded-full bg-violet-500/15 border border-violet-500/30 px-2 py-0.5 text-[10px] font-medium text-violet-400">
          skill: {String(d.skillName ?? d.name ?? "?")}
        </span>
      );
    case "model_change":
      return (
        <span className="inline-flex items-center rounded-full bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 text-[10px] font-medium text-blue-400">
          Model → {String(d.newModel ?? d.model ?? "?")}
        </span>
      );
    case "mode_changed":
      return (
        <span className="inline-flex items-center rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-medium text-amber-400">
          → {String(d.mode ?? d.newMode ?? "?")}
        </span>
      );
    case "compaction":
      return (
        <span className="inline-flex items-center rounded-full bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 text-[10px] font-medium text-purple-400">
          Compacted: {String(d.preTokens ?? "?")}→{String(d.postTokens ?? "?")} tokens
        </span>
      );
    case "error":
      return (
        <span className="inline-flex items-center rounded-full bg-red-500/15 border border-red-500/30 px-2 py-0.5 text-[10px] font-medium text-red-400">
          ⚠ {truncate(String(d.message ?? d.error ?? "error"), 60)}
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center rounded-full bg-muted border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          {event.type}
        </span>
      );
  }
}

function EventsRow({ events }: { events: InlineEvent[] }) {
  if (!events.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 py-1.5">
      {events.map((ev, i) => (
        <EventChip key={i} event={ev} />
      ))}
    </div>
  );
}

interface TurnCardProps {
  turn: Turn;
  index: number;
}

export function TurnCard({ turn, index }: TurnCardProps) {
  const hasUser = !!turn.userMessage;
  const [userExpanded, setUserExpanded] = useState(false);

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card overflow-hidden",
        "border-l-2",
        hasUser ? "border-l-blue-500" : "border-l-border",
      )}
    >
      {/* Turn header */}
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Turn {index + 1}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {formatTime(turn.startTime)}
          {turn.endTime && ` → ${formatTime(turn.endTime)}`}
        </span>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Events before content */}
        <EventsRow events={turn.events.filter((e) => !e.data?._after)} />

        {/* User message */}
        {turn.userMessage && (
          <div className="rounded-lg border-l-2 border-blue-500 bg-blue-500/10 px-3 py-2">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-blue-400">
              User
            </p>
            <p className="text-sm whitespace-pre-wrap break-words">
              {userExpanded
                ? turn.userMessage.content
                : truncate(turn.userMessage.content, 500)}
            </p>
            {turn.userMessage.content.length > 500 && (
              <button
                type="button"
                onClick={() => setUserExpanded((v) => !v)}
                className="mt-1 text-[11px] text-blue-400 hover:underline"
              >
                {userExpanded ? "Show less" : "Show more"}
              </button>
            )}
          </div>
        )}

        {/* Assistant messages */}
        {turn.assistantMessages.map((msg) => (
          <AssistantBlock key={msg.messageId} msg={msg} />
        ))}
      </div>
    </div>
  );
}

function AssistantBlock({
  msg,
}: {
  msg: Turn["assistantMessages"][number];
}) {
  const [expanded, setExpanded] = useState(false);
  const content = msg.content ?? "";
  const LIMIT = 300;

  return (
    <div className="space-y-1">
      {content.length > 0 && (
        <div className="text-sm text-foreground/90 whitespace-pre-wrap break-words">
          {expanded ? content : truncate(content, LIMIT)}
          {content.length > LIMIT && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="ml-1 text-[11px] text-muted-foreground hover:text-foreground hover:underline"
            >
              {expanded ? "less" : "more"}
            </button>
          )}
        </div>
      )}
      {msg.toolGroups.map((group, gi) => (
        <ToolCallGroup key={gi} group={group} />
      ))}
    </div>
  );
}
