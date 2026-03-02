import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Loader2 } from "lucide-react";

const STATUS_OPTIONS = [
  "discovery",
  "defined",
  "validated",
  "planned",
  "building",
  "shipped",
] as const;

interface FormState {
  title: string;
  featureStatus: string;
  epicId: string;
  tags: string;
  description: string;
}

const EMPTY: FormState = {
  title: "",
  featureStatus: "discovery",
  epicId: "",
  tags: "",
  description: "",
};

export function NewFeaturePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === "title" && value.trim()) setTitleError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setTitleError("Title is required");
      return;
    }

    setSubmitting(true);
    setServerError(null);
    try {
      const tags = form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const data = await api.post<{ feature: { id: string; path: string } }>(
        "/api/product/features",
        {
          title: form.title.trim(),
          featureStatus: form.featureStatus,
          epicId: form.epicId.trim() || undefined,
          tags,
          description: form.description.trim() || undefined,
        },
      );
      navigate(`/product/features/${data.feature.id}`);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6 py-6">
      <div>
        <nav className="text-xs text-muted-foreground mb-1">
          <Link to="/product" className="hover:text-foreground">
            Product
          </Link>
          {" / "}
          <Link to="/product/features" className="hover:text-foreground">
            Features
          </Link>
          {" / "}
          <span>New</span>
        </nav>
        <h1 className="text-xl font-semibold text-foreground">
          Create New Feature
        </h1>
      </div>

      {serverError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Title */}
        <div className="space-y-1.5">
          <label
            htmlFor="title"
            className="block text-sm font-medium text-foreground"
          >
            Title <span className="text-red-400">*</span>
          </label>
          <input
            id="title"
            type="text"
            autoFocus
            placeholder="Feature title…"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          {titleError && (
            <p className="text-xs text-red-400">{titleError}</p>
          )}
        </div>

        {/* Status */}
        <div className="space-y-1.5">
          <label
            htmlFor="featureStatus"
            className="block text-sm font-medium text-foreground"
          >
            Initial Status
          </label>
          <select
            id="featureStatus"
            value={form.featureStatus}
            onChange={(e) => set("featureStatus", e.target.value)}
            className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Epic ID */}
        <div className="space-y-1.5">
          <label
            htmlFor="epicId"
            className="block text-sm font-medium text-foreground"
          >
            Epic ID{" "}
            <span className="text-xs font-normal text-muted-foreground">
              (optional)
            </span>
          </label>
          <input
            id="epicId"
            type="text"
            placeholder="B-XXX"
            value={form.epicId}
            onChange={(e) => set("epicId", e.target.value)}
            className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* Tags */}
        <div className="space-y-1.5">
          <label
            htmlFor="tags"
            className="block text-sm font-medium text-foreground"
          >
            Tags{" "}
            <span className="text-xs font-normal text-muted-foreground">
              (optional, comma-separated)
            </span>
          </label>
          <input
            id="tags"
            type="text"
            placeholder="mvp, pricing"
            value={form.tags}
            onChange={(e) => set("tags", e.target.value)}
            className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label
            htmlFor="description"
            className="block text-sm font-medium text-foreground"
          >
            Initial Description{" "}
            <span className="text-xs font-normal text-muted-foreground">
              (optional, markdown)
            </span>
          </label>
          <textarea
            id="description"
            rows={6}
            placeholder="Write initial spec content…"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y font-mono"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            to="/product/features"
            className="inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Create Feature
          </button>
        </div>
      </form>
    </div>
  );
}
