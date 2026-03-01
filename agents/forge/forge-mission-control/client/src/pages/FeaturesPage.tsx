import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Loader2 } from "lucide-react";

interface Feature {
  id: string;
  title: string;
  status: string;
  [key: string]: unknown;
}

interface FeaturesData {
  featureOverview: Record<string, number>;
  features: Feature[];
}

const stages = [
  "discovery",
  "defined",
  "validated",
  "planned",
  "building",
  "shipped",
  "deprecated",
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
    const bucket = byStage.get(f.status) ?? byStage.get("discovery")!;
    bucket.push(f);
  }

  // Only show stages that have features or are in the main pipeline
  const visibleStages = stages.filter(
    (s) => (byStage.get(s)?.length ?? 0) > 0,
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Feature Board</h1>

      {visibleStages.length === 0 ? (
        <p className="text-muted-foreground">No features found.</p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {visibleStages.map((stage) => {
            const items = byStage.get(stage)!;
            const colors = stageColors[stage] ?? stageColors.deprecated;
            return (
              <div
                key={stage}
                className={`flex w-56 shrink-0 flex-col rounded-xl border ${colors.split(" ").slice(0, 1).join(" ")} bg-card`}
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
                  {items.map((f) => (
                    <div
                      key={f.id ?? f.title}
                      className="rounded-lg border border-border bg-background p-3"
                    >
                      <p className="text-sm font-medium text-foreground">
                        {f.title}
                      </p>
                      <span
                        className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${badgeColors[f.status] ?? badgeColors.deprecated}`}
                      >
                        {f.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
