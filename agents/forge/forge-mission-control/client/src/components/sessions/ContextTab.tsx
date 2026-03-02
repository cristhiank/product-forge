import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { cn } from "@/lib/utils";
import type { SessionDetail } from "@/types/sessions";

// ── helpers ───────────────────────────────────────────────────────────────────

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
  return String(n);
}

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

// ── Chart data builder ────────────────────────────────────────────────────────

interface ChartEvent {
  type: "compaction" | "truncation";
  ts: string;
  pre: number;
  post?: number;
  removed?: number;
}

interface ChartPoint {
  idx: number;
  tokens: number;
  label: string;
  eventType?: "compaction" | "truncation";
  preTokens?: number;
  postTokens?: number;
  tokensRemoved?: number;
}

function buildChartData(detail: SessionDetail): {
  points: ChartPoint[];
  refLines: { idx: number; type: "compaction" | "truncation" }[];
} {
  const events: ChartEvent[] = [
    ...detail.compactionEvents.map((e) => ({
      type: "compaction" as const,
      ts: e.timestamp,
      pre: e.preTokens,
      post: e.postTokens,
    })),
    ...detail.truncationEvents.map((e) => ({
      type: "truncation" as const,
      ts: e.timestamp,
      pre: e.preTokens,
      post: e.postTokens,
      removed: e.tokensRemoved,
    })),
  ].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

  if (events.length === 0) return { points: [], refLines: [] };

  const points: ChartPoint[] = [];
  const refLines: { idx: number; type: "compaction" | "truncation" }[] = [];
  let idx = 0;

  events.forEach((ev) => {
    // Point at the pre-event token count
    points.push({
      idx,
      tokens: ev.pre,
      label: formatTime(ev.ts),
      eventType: ev.type,
      preTokens: ev.pre,
      postTokens: ev.post,
      tokensRemoved: ev.removed,
    });
    refLines.push({ idx, type: ev.type });
    idx++;

    // Point after the event (drop/save)
    if (ev.post !== undefined) {
      points.push({
        idx,
        tokens: ev.post,
        label: formatTime(ev.ts),
      });
      idx++;
    }
  });

  return { points, refLines };
}

// ── Compaction row ────────────────────────────────────────────────────────────

function CompactionRow({
  ev,
}: {
  ev: SessionDetail["compactionEvents"][number];
}) {
  const [open, setOpen] = useState(false);
  const saved =
    ev.postTokens !== undefined ? ev.preTokens - ev.postTokens : undefined;

  return (
    <>
      <tr className="transition-colors hover:bg-muted/30">
        <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
          {formatTime(ev.timestamp)}
        </td>
        <td className="px-4 py-2 text-right tabular-nums text-xs">
          {formatTokens(ev.preTokens)}
        </td>
        <td className="px-4 py-2 text-right tabular-nums text-xs">
          {ev.postTokens !== undefined ? formatTokens(ev.postTokens) : "—"}
        </td>
        <td className="px-4 py-2 text-right tabular-nums text-xs text-green-500">
          {saved !== undefined ? formatTokens(saved) : "—"}
        </td>
        <td className="px-4 py-2">
          {ev.summaryContent ? (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              {open ? "Hide" : `${ev.summaryContent.slice(0, 40)}…`}
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </td>
      </tr>
      {open && ev.summaryContent && (
        <tr className="bg-muted/10">
          <td colSpan={5} className="px-4 pb-3 pt-1">
            <pre className="overflow-x-auto rounded-md bg-black/30 p-2 font-mono text-[11px] leading-relaxed text-foreground/80 whitespace-pre-wrap break-all">
              {ev.summaryContent}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Error row ─────────────────────────────────────────────────────────────────

function ErrorRow({ ev }: { ev: SessionDetail["errorEvents"][number] }) {
  const [open, setOpen] = useState(false);
  const LIMIT = 80;
  const isLong = ev.message.length > LIMIT;

  return (
    <>
      <tr className="bg-red-500/5 transition-colors hover:bg-red-500/10">
        <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
          {formatTime(ev.timestamp)}
        </td>
        <td className="px-4 py-2">
          <span className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-400">
            {ev.errorType}
          </span>
        </td>
        <td className="px-4 py-2">
          {isLong ? (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="text-left text-xs text-red-400/80 hover:text-red-400 hover:underline"
            >
              {open ? ev.message : `${ev.message.slice(0, LIMIT)}…`}
            </button>
          ) : (
            <span className="text-xs text-red-400/80">{ev.message}</span>
          )}
        </td>
      </tr>
      {open && isLong && (
        <tr className="bg-red-500/5">
          <td colSpan={3} className="px-4 pb-3 pt-1">
            <pre className="overflow-x-auto rounded-md bg-black/30 p-2 font-mono text-[11px] leading-relaxed text-foreground/80 whitespace-pre-wrap break-all">
              {ev.message}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ChartPoint }[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-md">
      {d.eventType && (
        <p className="mb-1 font-semibold capitalize">{d.eventType}</p>
      )}
      <p>Tokens: {formatTokens(d.tokens)}</p>
      {d.preTokens !== undefined && <p>Before: {formatTokens(d.preTokens)}</p>}
      {d.postTokens !== undefined && <p>After: {formatTokens(d.postTokens)}</p>}
      {d.tokensRemoved !== undefined && (
        <p>Removed: {formatTokens(d.tokensRemoved)}</p>
      )}
    </div>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────

interface ContextTabProps {
  detail: SessionDetail;
}

export function ContextTab({ detail }: ContextTabProps) {
  const hasEvents =
    detail.compactionEvents.length > 0 || detail.truncationEvents.length > 0;

  const { points, refLines } = buildChartData(detail);

  return (
    <div className="space-y-6">
      {/* Section A: Token Pressure Chart */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          Token Pressure
        </h2>
        {!hasEvents ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No context pressure events in this session.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-4">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart
                data={points}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id="tokenGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="idx"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(v: number) => points[v]?.label ?? ""}
                  tick={{
                    fontSize: 10,
                    fill: "hsl(var(--muted-foreground))",
                  }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v: number) => formatTokens(v)}
                  tick={{
                    fontSize: 10,
                    fill: "hsl(var(--muted-foreground))",
                  }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip content={<ChartTooltip />} />
                {refLines.map((rl, i) => (
                  <ReferenceLine
                    key={i}
                    x={rl.idx}
                    stroke={
                      rl.type === "compaction"
                        ? "rgb(34,197,94)"
                        : "rgb(239,68,68)"
                    }
                    strokeDasharray="4 2"
                    strokeWidth={1}
                  />
                ))}
                <Area
                  type="monotone"
                  dataKey="tokens"
                  stroke="hsl(var(--primary))"
                  fill="url(#tokenGradient)"
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
            <div className="mt-2 flex justify-center gap-4">
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span
                  className="inline-block h-0.5 w-6"
                  style={{
                    borderTop: "2px dashed rgb(34,197,94)",
                  }}
                />
                Compaction
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span
                  className="inline-block h-0.5 w-6"
                  style={{
                    borderTop: "2px dashed rgb(239,68,68)",
                  }}
                />
                Truncation
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Section B: Compaction Events */}
      {detail.compactionEvents.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Compaction Events
          </h2>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Time
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Pre-Tokens
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Post-Tokens
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Saved
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Summary
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {detail.compactionEvents.map((ev, i) => (
                  <CompactionRow key={i} ev={ev} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Section C: Truncation Events */}
      {detail.truncationEvents.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Truncation Events
          </h2>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Time
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Pre-Tokens
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Post-Tokens
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Removed
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Messages
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {detail.truncationEvents.map((ev, i) => (
                  <tr
                    key={i}
                    className="transition-colors hover:bg-muted/30"
                  >
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                      {formatTime(ev.timestamp)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-xs">
                      {formatTokens(ev.preTokens)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-xs">
                      {formatTokens(ev.postTokens)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-xs text-red-400">
                      {formatTokens(ev.tokensRemoved)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-xs">
                      {ev.messagesRemoved}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Section D: Error Events */}
      {detail.errorEvents.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Error Events
          </h2>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Time
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Type
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Message
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {detail.errorEvents.map((ev, i) => (
                  <ErrorRow key={i} ev={ev} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
