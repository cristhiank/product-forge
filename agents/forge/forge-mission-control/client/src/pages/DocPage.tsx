import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Loader2, ChevronRight, Pencil, History } from "lucide-react";
import { MarkdownViewer } from "@/components/MarkdownViewer";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { GitHistoryPanel } from "@/components/GitHistoryPanel";

interface DocData {
  doc: {
    path: string;
    title: string;
    content: string;
    frontmatter: Record<string, unknown>;
  };
}

export function DocPage() {
  const { "*": path } = useParams();
  const queryClient = useQueryClient();

  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["product", "doc", path],
    queryFn: () => api.get<DocData>(`/api/product/doc/${path}`),
    enabled: !!path,
  });

  // Sync edit buffer when doc loads or path changes
  useEffect(() => {
    if (data?.doc?.content !== undefined) {
      setEditContent(data.doc.content);
    }
  }, [data?.doc?.content, path]);

  async function handleSave() {
    if (!path) return;
    setSaving(true);
    try {
      await api.put(`/api/product/doc/${path}`, {
        content: editContent,
        commitMessage: "Update via Mission Control",
      });
      await queryClient.invalidateQueries({ queryKey: ["product", "doc", path] });
      setEditMode(false);
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function handleRevert(sha: string) {
    if (!path) return;
    const filePath = `.product/${path}`;
    await api.post("/api/git/revert", { file: filePath, commit: sha });
    await queryClient.invalidateQueries({ queryKey: ["product", "doc", path] });
    setHistoryOpen(false);
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  if (error || !data?.doc) {
    return (
      <div className="text-muted-foreground">
        {error ? String(error) : "Document not found."}
      </div>
    );
  }

  const { doc } = data;
  const fm = doc.frontmatter ?? {};
  const metaEntries = Object.entries(fm).filter(
    ([, v]) => v !== null && v !== undefined && v !== "",
  );
  const filePath = `.product/${path}`;

  return (
    <div className="space-y-6">
      {/* Breadcrumb + actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <nav className="flex items-center gap-1 text-sm text-muted-foreground flex-1 min-w-0">
          <Link to="/product" className="hover:text-foreground">
            Product
          </Link>
          <ChevronRight className="h-3 w-3 shrink-0" />
          <span className="text-foreground truncate">{doc.title || path}</span>
        </nav>
        <div className="flex items-center gap-2 shrink-0">
          {savedMsg && (
            <span className="text-xs text-green-400 animate-pulse">Saved ✓</span>
          )}
          {!editMode && (
            <>
              <button
                onClick={() => {
                  setEditContent(doc.content);
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

      {/* Frontmatter card */}
      {metaEntries.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-2 text-lg font-semibold text-foreground">
            {doc.title}
          </h2>
          <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
            {metaEntries.map(([key, value]) => (
              <div key={key} className="flex gap-2 text-sm">
                <span className="font-medium capitalize text-muted-foreground">
                  {key}:
                </span>
                <span className="text-foreground">{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Markdown body or editor */}
      {editMode ? (
        <MarkdownEditor
          content={editContent}
          onChange={setEditContent}
          onSave={handleSave}
          onCancel={() => setEditMode(false)}
          saving={saving}
        />
      ) : (
        <MarkdownViewer content={doc.content} />
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
