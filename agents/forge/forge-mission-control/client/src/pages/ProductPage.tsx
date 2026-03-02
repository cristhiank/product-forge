import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Link } from "react-router-dom";
import { Loader2, FileText } from "lucide-react";

interface ProductMeta {
  name: string;
  stage: string;
  version: string;
}

interface ProductHealth {
  total_docs: number;
  stale_docs: string[];
  orphaned_features: string[];
}

interface FeatureOverview {
  discovery: string[];
  defined: string[];
  validated: string[];
  planned: string[];
  building: string[];
  shipped: string[];
  deprecated?: string[];
}

interface ProductDoc {
  path: string;
  title: string;
}

interface ProductData {
  meta: ProductMeta;
  health: ProductHealth;
  featureOverview: FeatureOverview;
  docs: ProductDoc[];
}

const stageColors: Record<string, string> = {
  discovery: "bg-purple-500/20 text-purple-400",
  defined: "bg-blue-500/20 text-blue-400",
  validated: "bg-cyan-500/20 text-cyan-400",
  planned: "bg-yellow-500/20 text-yellow-400",
  building: "bg-orange-500/20 text-orange-400",
  shipped: "bg-green-500/20 text-green-400",
  deprecated: "bg-zinc-500/20 text-zinc-400",
};

const pipelineStages: (keyof FeatureOverview)[] = [
  "discovery",
  "defined",
  "validated",
  "planned",
  "building",
  "shipped",
];

export function ProductPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["product"],
    queryFn: () => api.get<ProductData>("/api/product"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  const { meta, health, featureOverview, docs } = data ?? ({} as ProductData);
  const maxCount = Math.max(
    ...pipelineStages.map((s) => (featureOverview?.[s] ?? []).length),
    1,
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">
          {meta?.name ?? "Product"}
        </h1>
        {meta?.stage && (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${stageColors[meta.stage] ?? "bg-zinc-500/20 text-zinc-400"}`}
          >
            {meta.stage}
          </span>
        )}
        {meta?.version && (
          <span className="text-sm text-muted-foreground">
            v{meta.version}
          </span>
        )}
      </div>

      {/* Health metrics */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total Docs", value: health?.total_docs ?? 0 },
          { label: "Stale Docs", value: health?.stale_docs?.length ?? 0 },
          {
            label: "Orphaned Features",
            value: health?.orphaned_features?.length ?? 0,
          },
        ].map((m) => (
          <div
            key={m.label}
            className="rounded-xl border border-border bg-card p-4"
          >
            <p className="text-xs text-muted-foreground">{m.label}</p>
            <p className="text-2xl font-bold text-foreground">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Feature pipeline */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">
          Feature Pipeline
        </h2>
        <div className="space-y-2">
          {pipelineStages.map((stage) => {
            const count = (featureOverview?.[stage] ?? []).length;
            const pct = Math.max((count / maxCount) * 100, count > 0 ? 8 : 0);
            return (
              <div key={stage} className="flex items-center gap-3">
                <span className="w-20 text-right text-xs capitalize text-muted-foreground">
                  {stage}
                </span>
                <div className="flex-1">
                  <div
                    className={`h-6 rounded ${stageColors[stage]?.replace("text-", "bg-").split(" ")[0] ?? "bg-zinc-500/20"} flex items-center px-2 text-xs font-medium transition-all`}
                    style={{ width: `${pct}%`, minWidth: count > 0 ? "2rem" : 0 }}
                  >
                    {count > 0 && count}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Doc list */}
      {docs && docs.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Documents
          </h2>
          <div className="space-y-1">
            {docs.map((doc) => (
              <Link
                key={doc.path}
                to={`/product/doc/${doc.path}`}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-card"
              >
                <FileText className="h-4 w-4 text-muted-foreground" />
                {doc.title || doc.path}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
