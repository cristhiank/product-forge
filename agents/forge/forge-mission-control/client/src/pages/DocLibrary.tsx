import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Link, useParams } from "react-router-dom";
import {
  Loader2,
  Compass,
  Target,
  Users,
  Palette,
  FileText,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";

interface ProductDoc {
  path: string;
  type: string;
  title: string;
  version: string;
  status: string;
  tags: string[];
  updated: string;
}

interface ProductData {
  docs: ProductDoc[];
}

const DOC_TYPES = ["vision", "strategy", "customer", "brand"] as const;
type DocType = (typeof DOC_TYPES)[number];

const typeConfig: Record<
  DocType,
  { label: string; icon: ComponentType<LucideProps> }
> = {
  vision: { label: "Vision", icon: Compass },
  strategy: { label: "Strategy", icon: Target },
  customer: { label: "Customers", icon: Users },
  brand: { label: "Brand", icon: Palette },
};

const statusBadge: Record<string, string> = {
  draft: "bg-yellow-500/20 text-yellow-400",
  active: "bg-green-500/20 text-green-400",
  archived: "bg-zinc-500/20 text-zinc-400",
  review: "bg-blue-500/20 text-blue-400",
};

function relativeTime(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function DocSection({
  type,
  docs,
  defaultOpen,
}: {
  type: DocType;
  docs: ProductDoc[];
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { label, icon: Icon } = typeConfig[type];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/30 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {docs.length}
        </span>
        <span className="ml-auto text-muted-foreground">
          {open ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </span>
      </button>

      {open && docs.length > 0 && (
        <div className="border-t border-border divide-y divide-border/50">
          {docs.map((doc) => (
            <Link
              key={doc.path}
              to={`/product/doc/${doc.path}`}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors"
            >
              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="flex-1 text-sm text-foreground truncate">
                {doc.title || doc.path}
              </span>
              {doc.status && (
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadge[doc.status] ?? "bg-zinc-500/20 text-zinc-400"}`}
                >
                  {doc.status}
                </span>
              )}
              {doc.version && (
                <span className="shrink-0 text-xs text-muted-foreground font-mono">
                  v{doc.version}
                </span>
              )}
              {doc.updated && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {relativeTime(doc.updated)}
                </span>
              )}
              {doc.tags && doc.tags.length > 0 && (
                <span className="shrink-0 flex gap-1">
                  {doc.tags.slice(0, 3).map((t) => (
                    <span
                      key={t}
                      className="rounded px-1.5 py-0.5 text-[10px] bg-muted text-muted-foreground"
                    >
                      {t}
                    </span>
                  ))}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}

      {open && docs.length === 0 && (
        <div className="border-t border-border px-4 py-3 text-sm text-muted-foreground/60 italic">
          No {label.toLowerCase()} documents yet
        </div>
      )}
    </div>
  );
}

export function DocLibrary() {
  const { docType } = useParams<{ docType?: string }>();
  const [activeFilter, setActiveFilter] = useState<string>(docType ?? "all");

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

  const allDocs = (data?.docs ?? []).filter((d) => d.type !== "feature");

  const docsByType = new Map<string, ProductDoc[]>();
  for (const doc of allDocs) {
    const arr = docsByType.get(doc.type) ?? [];
    arr.push(doc);
    docsByType.set(doc.type, arr);
  }

  const visibleTypes =
    activeFilter === "all"
      ? DOC_TYPES
      : DOC_TYPES.filter((t) => t === activeFilter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Doc Library</h1>
        <p className="text-sm text-muted-foreground mt-1">
          All product documents — vision, strategy, customers, and brand.
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 flex-wrap">
        {(["all", ...DOC_TYPES] as const).map((tab) => {
          const label =
            tab === "all" ? "All" : typeConfig[tab as DocType].label;
          const count =
            tab === "all"
              ? allDocs.length
              : (docsByType.get(tab) ?? []).length;
          return (
            <button
              key={tab}
              onClick={() => setActiveFilter(tab)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                activeFilter === tab
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              {label}
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {visibleTypes.map((type) => (
          <DocSection
            key={type}
            type={type}
            docs={docsByType.get(type) ?? []}
            defaultOpen={activeFilter === type || activeFilter === "all"}
          />
        ))}
      </div>
    </div>
  );
}
