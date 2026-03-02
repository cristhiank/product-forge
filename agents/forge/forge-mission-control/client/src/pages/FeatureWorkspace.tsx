import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import {
  Loader2,
  ChevronRight,
  Pencil,
  History,
  Sparkles,
} from "lucide-react";
import { MarkdownViewer } from "@/components/MarkdownViewer";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { GitHistoryPanel } from "@/components/GitHistoryPanel";

interface ProductFeature {
  id: string;
  path: string;
  title: string;
  featureStatus: string;
  epicId?: string;
  version: string;
  tags: string[];
  updated?: string;
  created?: string;
}

interface FeaturesData {
  features: ProductFeature[];
}

interface DocData {
  doc: {
    path: string;
    title: string;
    content: string;
    frontmatter: Record<string, unknown>;
  };
}

interface BacklogItem {
  id: string;
  title: string;
  folder: string;
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

function relativeTime(dateStr: string | undefined): string {
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

export function FeatureWorkspace() {
  const { featureId } = useParams<{ featureId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Fetch features list to find the matching feature
  const { data: featuresData, isLoading: featuresLoading } = useQuery({
    queryKey: ["product", "features"],
    queryFn: () => api.get<FeaturesData>("/api/product/features"),
  });

  const feature = featuresData?.features?.find(
    (f) => f.id === featureId || f.id.startsWith(featureId ?? ""),
  );

  // Fetch doc content once we know the feature path
  const { data: docData, isLoading: docLoading } = useQuery({
    queryKey: ["product", "doc", feature?.path],
    queryFn: () =>
      api.get<DocData>(`/api/product/doc/${feature!.path}`),
    enabled: !!feature?.path,
  });

  // Backlog items linked to epicId
  const { data: backlogItems } = useQuery<BacklogItem[]>({
    queryKey: ["backlog", "search", feature?.epicId],
    queryFn: () =>
      api.get<BacklogItem[]>(
        `/api/backlog/search?q=${encodeURIComponent(feature!.epicId!)}`,
      ),
    enabled: !!feature?.epicId,
  });

  useEffect(() => {
    if (docData?.doc?.content !== undefined) {
      setEditContent(docData.doc.content);
    }
  }, [docData?.doc?.content, feature?.path]);

  async function handleSave() {
    if (!feature?.path) return;
    setSaving(true);
    try {
      await api.put(`/api/product/doc/${feature.path}`, {
        content: editContent,
        commitMessage: "Update via Mission Control",
      });
      await queryClient.invalidateQueries({
        queryKey: ["product", "doc", feature.path],
      });
      setEditMode(false);
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function handleRevert(sha: string) {
    if (!feature?.path) return;
    await api.post("/api/git/revert", {
      file: `.product/${feature.path}`,
      commit: sha,
    });
    await queryClient.invalidateQueries({
      queryKey: ["product", "doc", feature.path],
    });
    setHistoryOpen(false);
  }

  const isLoading = featuresLoading || (!!feature && docLoading);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  if (!feature) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">
          Feature{" "}
          <span className="font-mono text-foreground">{featureId}</span> not
          found.
        </p>
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-primary hover:underline"
        >
          ← Back
        </button>
      </div>
    );
  }

  const doc = docData?.doc;
  const filePath = `.product/${feature.path}`;

  return (
    <div className="space-y-6">
      {/* Breadcrumb + Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <nav className="flex items-center gap-1 text-sm text-muted-foreground flex-1 min-w-0">
          <Link to="/product" className="hover:text-foreground">
            Product
          </Link>
          <ChevronRight className="h-3 w-3 shrink-0" />
          <Link to="/product/features" className="hover:text-foreground">
            Features
          </Link>
          <ChevronRight className="h-3 w-3 shrink-0" />
          <span className="font-mono text-muted-foreground shrink-0">
            {feature.id}
          </span>
          <span className="text-foreground truncate ml-1">{feature.title}</span>
        </nav>
        <div className="flex items-center gap-2 shrink-0">
          {savedMsg && (
            <span className="text-xs text-green-400 animate-pulse">
              Saved ✓
            </span>
          )}
          {!editMode && (
            <>
              <button
                onClick={() => {
                  setEditContent(doc?.content ?? "");
                  setEditMode(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
              <button
                onClick={() => setHistoryOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <History className="h-3.5 w-3.5" />
                History
              </button>
              <button
                disabled
                title="AI assistance — coming in Phase 4"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground opacity-40 cursor-not-allowed"
              >
                <Sparkles className="h-3.5 w-3.5" />
                AI
              </button>
            </>
          )}
        </div>
      </div>

      {/* 2-pane layout */}
      <div className="flex gap-6 flex-col lg:flex-row">
        {/* Main content (70%) */}
        <div className="flex-1 min-w-0">
          {editMode ? (
            <MarkdownEditor
              content={editContent}
              onChange={setEditContent}
              onSave={handleSave}
              onCancel={() => setEditMode(false)}
              saving={saving}
            />
          ) : (
            <div>
              {doc ? (
                <MarkdownViewer content={doc.content} />
              ) : (
                <p className="text-muted-foreground text-sm">
                  No content found.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Properties sidebar (30%, fixed width on large screens) */}
        <aside className="lg:w-72 shrink-0 space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">
              Properties
            </h2>

            {/* Status */}
            <div>
              <p className="text-xs text-muted-foreground mb-1">Status</p>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${stageColors[feature.featureStatus] ?? "bg-zinc-500/20 text-zinc-400"}`}
              >
                {feature.featureStatus}
              </span>
            </div>

            {/* Epic */}
            {feature.epicId && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Epic</p>
                <Link
                  to={`/backlog/item/${feature.epicId}`}
                  className="inline-flex items-center gap-1 font-mono text-sm text-primary hover:underline"
                >
                  {feature.epicId} →
                </Link>
              </div>
            )}

            {/* Tags */}
            {feature.tags && feature.tags.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Tags</p>
                <div className="flex flex-wrap gap-1">
                  {feature.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded px-2 py-0.5 text-xs bg-muted text-muted-foreground"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Version */}
            {feature.version && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Version</p>
                <span className="text-sm text-foreground font-mono">
                  {feature.version}
                </span>
              </div>
            )}

            {/* Updated */}
            {feature.updated && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Updated</p>
                <span className="text-sm text-foreground">
                  {relativeTime(feature.updated)}
                </span>
              </div>
            )}

            {/* Created */}
            {feature.created && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Created</p>
                <span className="text-sm text-foreground">
                  {relativeTime(feature.created)}
                </span>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Linked Backlog Items */}
      {feature.epicId && backlogItems && backlogItems.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Linked Backlog Items
          </h2>
          <div className="flex gap-2 flex-wrap">
            {backlogItems.map((item) => (
              <Link
                key={item.id}
                to={`/backlog/item/${item.id}`}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 hover:border-foreground/20 transition-colors"
              >
                <span className="text-xs font-mono text-muted-foreground">
                  {item.id}
                </span>
                <span className="text-sm text-foreground max-w-[200px] truncate">
                  {item.title}
                </span>
                {item.folder && (
                  <span className="rounded px-1.5 py-0.5 text-[10px] bg-muted text-muted-foreground">
                    {item.folder}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Git history panel */}
      <GitHistoryPanel
        filePath={filePath}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onRevert={handleRevert}
      />
    </div>
  );
}
