import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Link } from "react-router-dom";
import { Loader2, Plus } from "lucide-react";

interface Feature {
  id: string;
  title: string;
  status: string;
  featureStatus: string;
  path: string;
  epicId?: string;
  tags?: string[];
  updated?: string;
  [key: string]: unknown;
}

interface FeaturesData {
  featureOverview: Record<string, string[]>;
  features: Feature[];
}

const stages = [
  "discovery",
  "defined",
  "validated",
  "planned",
  "building",
  "shipped",
];

const stageColors: Record<string, string> = {
  discovery: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  defined: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  validated: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  planned: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  building: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  shipped: "bg-green-500/20 text-green-400 border-green-500/30",
  deprecated: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
};

const badgeColors: Record<string, string> = {
  discovery: "bg-purple-500/20 text-purple-400",
  defined: "bg-blue-500/20 text-blue-400",
  validated: "bg-cyan-500/20 text-cyan-400",
  planned: "bg-yellow-500/20 text-yellow-400",
  building: "bg-orange-500/20 text-orange-400",
  shipped: "bg-green-500/20 text-green-400",
  deprecated: "bg-zinc-500/20 text-zinc-400",
};

function relativeTime(dateStr: string | undefined): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function FeaturesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["product", "features"],
    queryFn: () => api.get<FeaturesData>("/api/product/features"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  const features = data?.features ?? [];
  const byStage = new Map<string, Feature[]>();
  for (const s of stages) byStage.set(s, []);
  for (const f of features) {
    const stage = f.featureStatus ?? f.status;
    const bucket = byStage.get(stage) ?? byStage.get("discovery")!;
    bucket.push(f);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">Feature Board</h1>
        <Link
          to="/product/features/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
        >
          <Plus className="h-3.5 w-3.5" />
          New Feature
        </Link>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const items = byStage.get(stage) ?? [];
          const colors = stageColors[stage] ?? stageColors.deprecated;
          const borderClass = colors.split(" ").find((c) => c.startsWith("border-")) ?? "border-border";
          return (
            <div
              key={stage}
              className={`flex w-60 shrink-0 flex-col rounded-xl border ${borderClass} bg-card`}
            >
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {stage}
                </span>
                <span className="text-xs text-muted-foreground">
                  {items.length}
                </span>
              </div>
              <div className="flex-1 space-y-2 p-2">
                {items.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border/50 p-3 text-center">
                    <p className="text-xs text-muted-foreground/50">
                      No features in {stage}
                    </p>
                  </div>
                ) : (
                  items.map((f) => (
                    <Link
                      key={f.id ?? f.title}
                      to={`/product/features/${f.id}`}
                      className="block rounded-lg border border-border bg-background p-3 hover:border-foreground/20 transition-colors"
                    >
                      <p className="text-sm font-medium text-foreground leading-snug">
                        {f.title}
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                        {f.id}
                      </p>
                      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                        {f.epicId && (
                          <span className="rounded px-1.5 py-0.5 text-[10px] bg-blue-500/10 text-blue-400 font-mono">
                            {f.epicId}
                          </span>
                        )}
                        {f.tags?.slice(0, 3).map((t) => (
                          <span
                            key={t}
                            className="rounded px-1.5 py-0.5 text-[10px] bg-muted text-muted-foreground"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                      {f.updated && (
                        <p className="mt-1.5 text-[10px] text-muted-foreground/60">
                          {relativeTime(f.updated)}
                        </p>
                      )}
                    </Link>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
