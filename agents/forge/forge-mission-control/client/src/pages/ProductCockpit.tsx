import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Link, useNavigate } from "react-router-dom";
import {
  Loader2,
  Compass,
  Target,
  Users,
  Palette,
  MessageCircle,
} from "lucide-react";
import { useState } from "react";
import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";
import { AIChatPanel } from "@/components/AIChatPanel";

interface ProductMeta {
  name: string;
  stage: string;
  version: string;
  description: string;
  north_star: string;
}

interface ProductHealth {
  total_docs: number;
  stale_docs: string[];
  orphaned_features: string[];
  draft_count: number;
}

interface FeatureOverview {
  discovery: string[];
  defined: string[];
  validated: string[];
  planned: string[];
  building: string[];
  shipped: string[];
  measuring?: string[];
}

interface ProductDoc {
  path: string;
  type: string;
  title: string;
  updated: string;
}

interface ProductData {
  meta: ProductMeta;
  health: ProductHealth;
  featureOverview: FeatureOverview;
  docs: ProductDoc[];
}

const stageBadgeColors: Record<string, string> = {
  discovery: "bg-purple-500/20 text-purple-400",
  defined: "bg-blue-500/20 text-blue-400",
  validated: "bg-cyan-500/20 text-cyan-400",
  planned: "bg-yellow-500/20 text-yellow-400",
  building: "bg-orange-500/20 text-orange-400",
  shipped: "bg-green-500/20 text-green-400",
  measuring: "bg-teal-500/20 text-teal-400",
};

const pipelineBarColors: Record<string, string> = {
  discovery: "bg-purple-500/30 hover:bg-purple-500/45",
  defined: "bg-blue-500/30 hover:bg-blue-500/45",
  validated: "bg-cyan-500/30 hover:bg-cyan-500/45",
  planned: "bg-yellow-500/30 hover:bg-yellow-500/45",
  building: "bg-orange-500/30 hover:bg-orange-500/45",
  shipped: "bg-green-500/30 hover:bg-green-500/45",
};

const pipelineStages = [
  "discovery",
  "defined",
  "validated",
  "planned",
  "building",
  "shipped",
] as const;

type QuickAccessType = "vision" | "strategy" | "customer" | "brand";

const quickAccessConfig: Record<
  QuickAccessType,
  { label: string; icon: ComponentType<LucideProps> }
> = {
  vision: { label: "Vision", icon: Compass },
  strategy: { label: "Strategy", icon: Target },
  customer: { label: "Customers", icon: Users },
  brand: { label: "Brand", icon: Palette },
};

export function ProductCockpit() {
  const navigate = useNavigate();
  const [chatOpen, setChatOpen] = useState(false);

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

  const featuresTotal = pipelineStages.reduce(
    (acc, s) => acc + (featureOverview?.[s] ?? []).length,
    0,
  );

  const staleDocs = health?.stale_docs ?? [];
  const orphanedFeatures = health?.orphaned_features ?? [];
  const draftCount = health?.draft_count ?? 0;

  // Group non-feature docs by type
  const nonFeatureDocs = (docs ?? []).filter((d) => d.type !== "feature");
  const docsByType = new Map<string, ProductDoc[]>();
  for (const doc of nonFeatureDocs) {
    const arr = docsByType.get(doc.type) ?? [];
    arr.push(doc);
    docsByType.set(doc.type, arr);
  }

  return (
    <div className={chatOpen ? "space-y-8 lg:pr-96" : "space-y-8"}>
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-foreground">
            {meta?.name ?? "Product"}
          </h1>
          {meta?.stage && (
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${stageBadgeColors[meta.stage] ?? "bg-zinc-500/20 text-zinc-400"}`}
            >
              {meta.stage}
            </span>
          )}
          {meta?.version && (
            <span className="text-sm text-muted-foreground">
              v{meta.version}
            </span>
          )}
          <button
            onClick={() => setChatOpen((v) => !v)}
            title="AI Chat"
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Chat
          </button>
        </div>
        {meta?.description && (
          <p className="mt-1.5 text-sm text-muted-foreground max-w-2xl">
            {meta.description}
          </p>
        )}
        {meta?.north_star && (
          <p className="mt-1 text-xs text-muted-foreground/60 italic">
            ⭐ {meta.north_star}
          </p>
        )}
      </div>

      {/* Health Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Features</p>
          <p className="text-2xl font-bold text-foreground">{featuresTotal}</p>
        </div>

        <div
          className={`rounded-xl border bg-card p-4 ${staleDocs.length > 0 ? "border-yellow-500/40 border-l-4 border-l-yellow-500/70" : "border-border"}`}
          title={staleDocs.length > 0 ? staleDocs.join(", ") : undefined}
        >
          <p className="text-xs text-muted-foreground">Stale Docs</p>
          <p
            className={`text-2xl font-bold ${staleDocs.length > 0 ? "text-yellow-400" : "text-foreground"}`}
          >
            {staleDocs.length}
          </p>
        </div>

        <div
          className={`rounded-xl border bg-card p-4 ${orphanedFeatures.length > 0 ? "border-red-500/40 border-l-4 border-l-red-500/70" : "border-border"}`}
          title={
            orphanedFeatures.length > 0
              ? orphanedFeatures.join(", ")
              : undefined
          }
        >
          <p className="text-xs text-muted-foreground">Orphaned Features</p>
          <p
            className={`text-2xl font-bold ${orphanedFeatures.length > 0 ? "text-red-400" : "text-foreground"}`}
          >
            {orphanedFeatures.length}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Draft Docs</p>
          <p className="text-2xl font-bold text-foreground">{draftCount}</p>
        </div>
      </div>

      {/* Feature Pipeline */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">
          Feature Pipeline
        </h2>
        <div className="space-y-2">
          {pipelineStages.map((stage) => {
            const items = featureOverview?.[stage] ?? [];
            const count = items.length;
            const pct = Math.max((count / maxCount) * 100, count > 0 ? 8 : 0);
            const barColor =
              pipelineBarColors[stage] ?? "bg-zinc-500/20 hover:bg-zinc-500/35";
            return (
              <div key={stage} className="flex items-center gap-3">
                <span className="w-20 text-right text-xs capitalize text-muted-foreground">
                  {stage}
                </span>
                <div className="flex-1 relative">
                  <button
                    className={`h-6 rounded ${barColor} flex items-center px-2 text-xs font-medium transition-all cursor-pointer`}
                    style={{
                      width: `${pct}%`,
                      minWidth: count > 0 ? "2.5rem" : "0.5rem",
                    }}
                    title={items.length > 0 ? items.join(", ") : undefined}
                    onClick={() => navigate("/product/features")}
                  >
                    {count > 0 && (
                      <span className="text-foreground/80">{count}</span>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <Link
          to="/product/features"
          className="mt-2 inline-block text-xs text-primary hover:underline"
        >
          View Feature Board →
        </Link>
      </div>

      {/* Quick Access */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">
          Quick Access
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(
            ["vision", "strategy", "customer", "brand"] as QuickAccessType[]
          ).map((type) => {
            const { label, icon: Icon } = quickAccessConfig[type];
            const typeDocs = [...(docsByType.get(type) ?? [])].sort((a, b) =>
              (b.updated ?? "").localeCompare(a.updated ?? ""),
            );
            const mostRecent = typeDocs[0];
            return (
              <Link
                key={type}
                to={`/product/library/${type}`}
                className="rounded-xl border border-border bg-card p-4 hover:border-foreground/20 transition-colors flex flex-col gap-2"
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">
                    {label}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {typeDocs.length}
                  </span>
                </div>
                {mostRecent ? (
                  <p className="text-xs text-muted-foreground truncate">
                    {mostRecent.title}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground/40 italic">
                    No docs yet
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recent Changes */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">
          Recent Changes
        </h2>
        <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>Browse git history for product documents</span>
          <Link to="/product/library" className="text-xs text-primary hover:underline">
            Browse Library →
          </Link>
        </div>
      </div>

      <AIChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        scope="product"
      />
    </div>
  );
}
