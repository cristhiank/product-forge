import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Pencil, History } from "lucide-react";
import { MarkdownViewer } from "@/components/MarkdownViewer";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { GitHistoryPanel } from "@/components/GitHistoryPanel";

interface BacklogItem {
  id: string;
  title: string;
  kind?: string;
  priority?: string;
  folder?: string;
  tags?: string[];
  depends_on?: string[];
  related?: string[];
  body?: string;
  metadata?: Record<string, unknown>;
}

const KIND_BADGE: Record<string, string> = {
  epic: "bg-blue-500/15 text-blue-400",
  task: "bg-gray-500/15 text-gray-400",
  bug: "bg-red-500/15 text-red-400",
  feature: "bg-green-500/15 text-green-400",
  chore: "bg-yellow-500/15 text-yellow-400",
};

const PRIORITY_BADGE: Record<string, string> = {
  high: "bg-red-500/15 text-red-400",
  medium: "bg-yellow-500/15 text-yellow-400",
  low: "bg-green-500/15 text-green-400",
};

const FOLDER_BADGE: Record<string, string> = {
  next: "bg-blue-500/15 text-blue-400",
  working: "bg-yellow-500/15 text-yellow-400",
  done: "bg-green-500/15 text-green-400",
  archive: "bg-gray-500/15 text-gray-400",
};

function Badge({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide",
        className,
      )}
    >
      {label}
    </span>
  );
}

export function BacklogItemPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  // Use the backlog selection persisted by BacklogPage/BacklogSearchPage
  const backlogParam = localStorage.getItem("selectedBacklog") ?? "";

  const [editMode, setEditMode] = useState(false);
  const [editBody, setEditBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const { data: item, isLoading } = useQuery<BacklogItem>({
    queryKey: ["backlog", "item", backlogParam, id],
    queryFn: () => api.get<BacklogItem>(`/api/backlog/item/${id}?backlog=${encodeURIComponent(backlogParam)}`),
    enabled: !!id,
  });

  useEffect(() => {
    if (item?.body !== undefined) {
      setEditBody(item.body ?? "");
    }
  }, [item?.body, id]);

  async function handleSave() {
    if (!id) return;
    setSaving(true);
    try {
      await api.put(`/api/backlog/item/${id}/body?backlog=${encodeURIComponent(backlogParam)}`, {
        body: editBody,
      });
      await queryClient.invalidateQueries({ queryKey: ["backlog", "item", backlogParam, id] });
      setEditMode(false);
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function handleRevert(sha: string) {
    if (!id || !item) return;
    const prefix = backlogParam ? `${backlogParam}/` : "";
    const filePath = `${prefix}.backlog/${item.folder ?? "next"}/${id}.md`;
    await api.post("/api/git/revert", { file: filePath, commit: sha });
    await queryClient.invalidateQueries({ queryKey: ["backlog", "item", backlogParam, id] });
    setHistoryOpen(false);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!item) {
    return (
      <div className="py-10 text-center text-muted-foreground">
        Item not found
      </div>
    );
  }

  const meta = item.metadata as
    | { created_at?: string; updated_at?: string }
    | undefined;
  const prefix = backlogParam ? `${backlogParam}/` : "";
  const filePath = `${prefix}.backlog/${item.folder ?? "next"}/${item.id}.md`;

  return (
    <div className="max-w-3xl">
      {/* Breadcrumb */}
      <nav className="mb-4 text-sm text-muted-foreground flex items-center gap-1.5">
        <Link to="/backlog" className="hover:text-foreground transition-colors">
          Backlog
        </Link>
        <span>›</span>
        <span className="font-mono text-foreground">{item.id}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <h1 className="text-2xl font-bold">{item.title}</h1>
        <div className="flex items-center gap-2 shrink-0">
          {savedMsg && (
            <span className="text-xs text-green-400 animate-pulse">Saved ✓</span>
          )}
          {!editMode && (
            <>
              <button
                onClick={() => {
                  setEditBody(item.body ?? "");
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
            </>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mb-6">
        {item.kind && (
          <Badge
            label={item.kind}
            className={KIND_BADGE[item.kind] ?? "bg-gray-500/15 text-gray-400"}
          />
        )}
        {item.priority && (
          <Badge
            label={item.priority}
            className={
              PRIORITY_BADGE[item.priority] ?? "bg-gray-500/15 text-gray-400"
            }
          />
        )}
        {item.folder && (
          <Badge
            label={item.folder}
            className={
              FOLDER_BADGE[item.folder] ?? "bg-gray-500/15 text-gray-400"
            }
          />
        )}
      </div>

      {/* Metadata */}
      {meta && (meta.created_at || meta.updated_at) && (
        <section className="rounded-lg border border-border bg-card p-4 mb-6">
          <h2 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
            Metadata
          </h2>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            {meta.created_at && (
              <>
                <dt className="text-muted-foreground">Created</dt>
                <dd>{meta.created_at}</dd>
              </>
            )}
            {meta.updated_at && (
              <>
                <dt className="text-muted-foreground">Updated</dt>
                <dd>{meta.updated_at}</dd>
              </>
            )}
          </dl>
        </section>
      )}

      {/* Dependencies */}
      {item.depends_on && item.depends_on.length > 0 && (
        <section className="rounded-lg border border-border bg-card p-4 mb-6">
          <h2 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
            Dependencies
          </h2>
          <ul className="space-y-1">
            {item.depends_on.map((dep) => (
              <li key={dep}>
                <Link
                  to={`/backlog/item/${dep}`}
                  className="font-mono text-sm text-primary hover:underline"
                >
                  {dep}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Tags */}
      {item.tags && item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-6">
          {item.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Body / Description */}
      {editMode ? (
        <MarkdownEditor
          content={editBody}
          onChange={setEditBody}
          onSave={handleSave}
          onCancel={() => setEditMode(false)}
          saving={saving}
        />
      ) : (
        item.body && <MarkdownViewer content={item.body} size="sm" />
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
